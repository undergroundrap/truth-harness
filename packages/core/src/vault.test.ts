import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { listVaultEntries, openVaultEntry, sealVaultFile, verifyVaultEntry } from "./vault.js";

const roots: string[] = [];
const keyEnv = "THEOREM_WORKBENCH_TEST_VAULT_KEY";
const originalKey = process.env[keyEnv];

afterEach(async () => {
  restoreKey();
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("local encrypted vault", () => {
  it("requires a local workspace before sealing private files", async () => {
    const root = await tempRoot();
    process.env[keyEnv] = "test vault passphrase";
    await writeFile(join(root, "private-notes.md"), "secret local note", "utf8");

    await expect(
      sealVaultFile({
        rootPath: root,
        sourcePath: "private-notes.md",
        keyEnv
      })
    ).rejects.toThrow("Run `theorem workspace init`");
  });

  it("seals, lists, verifies, and opens local files without public plaintext metadata", async () => {
    const root = await tempRoot();
    process.env[keyEnv] = "test vault passphrase";
    await initLocalWorkspace(root, { displayName: "Vault Lab", now: "2026-06-08T00:00:00.000Z" });
    await writeFile(join(root, "private-notes.md"), "hair loss pathway hypothesis stays local", "utf8");

    const sealed = await sealVaultFile({
      rootPath: root,
      sourcePath: "private-notes.md",
      label: "Private pathway notes",
      keyEnv,
      now: "2026-06-08T00:01:00.000Z"
    });
    const listed = await listVaultEntries(root);
    const verified = await verifyVaultEntry({
      rootPath: root,
      vaultRef: sealed.entry.vaultId,
      keyEnv
    });
    const opened = await openVaultEntry({
      rootPath: root,
      vaultRef: sealed.path,
      keyEnv
    });

    expect(sealed.path).toContain(join(".theorem-workbench", "vault"));
    expect(sealed.entry.schemaVersion).toBe("theorem.vault.v0");
    expect(sealed.entry.vaultId).toMatch(/^vault_[a-f0-9]{16}$/);
    expect(sealed.entry.label).toBe("Private pathway notes");
    expect(sealed.entry.ciphertextBase64).not.toContain("hair loss");
    expect(JSON.stringify(sealed.entry)).not.toContain("private-notes.md");
    expect(sealed.entry.encryption.keyPolicy).toBe("environment-only");
    expect(sealed.entry.privacy.networkAccess).toBe("none");
    expect(sealed.entry.warnings[1]).toContain("Do not store passphrases");
    expect(listed).toHaveLength(1);
    expect(verified.verified).toBe(true);
    expect(verified.payload.sourceRef).toBe("private-notes.md");
    expect(verified.payload.plaintextBytes).toBe(Buffer.byteLength("hair loss pathway hypothesis stays local"));
    expect(Buffer.from(opened.bytes).toString("utf8")).toBe("hair loss pathway hypothesis stays local");
    expect(await readFile(sealed.path, "utf8")).not.toContain("hair loss pathway");
  });

  it("rejects wrong vault keys", async () => {
    const root = await tempRoot();
    process.env[keyEnv] = "correct vault passphrase";
    await initLocalWorkspace(root);
    await writeFile(join(root, "private-notes.md"), "secret local note", "utf8");
    const sealed = await sealVaultFile({
      rootPath: root,
      sourcePath: "private-notes.md",
      keyEnv
    });

    process.env[keyEnv] = "incorrect vault pass";

    await expect(
      verifyVaultEntry({
        rootPath: root,
        vaultRef: sealed.entry.vaultId,
        keyEnv
      })
    ).rejects.toThrow("Vault decrypt failed");
  });

  it("rejects source paths outside the workspace root", async () => {
    const root = await tempRoot();
    process.env[keyEnv] = "test vault passphrase";
    await initLocalWorkspace(root);

    await expect(
      sealVaultFile({
        rootPath: root,
        sourcePath: "../outside.md",
        keyEnv
      })
    ).rejects.toThrow("Path escapes workspace root");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-vault-"));
  roots.push(root);
  return root;
}

function restoreKey(): void {
  if (originalKey === undefined) {
    delete process.env[keyEnv];
    return;
  }

  process.env[keyEnv] = originalKey;
}
