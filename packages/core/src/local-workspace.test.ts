import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLocalWorkspaceManifest,
  getLocalWorkspaceStatus,
  initLocalWorkspace,
  LOCAL_WORKSPACE_DIR,
  repairLocalWorkspace
} from "./local-workspace.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("local workspace", () => {
  it("creates a local-only portable manifest", () => {
    const manifest = createLocalWorkspaceManifest("example-project", "2026-06-08T00:00:00.000Z", "Example");

    expect(manifest.schemaVersion).toBe("theorem.workspace.v0");
    expect(manifest.displayName).toBe("Example");
    expect(manifest.privacy).toEqual({
      mode: "local-only",
      localFirst: true,
      networkAccess: "none",
      dataResidency: "local-workspace",
      externalDisclosures: []
    });
    expect(Object.values(manifest.directories).every((directory) => directory.startsWith(LOCAL_WORKSPACE_DIR))).toBe(true);
    expect(manifest.directories.cas).toBe(".theorem-workbench/cas");
    expect(manifest.directories.proofs).toBe(".theorem-workbench/proofs");
    expect(manifest.directories.smt).toBe(".theorem-workbench/smt");
    expect(manifest.directories.disclosures).toBe(".theorem-workbench/disclosures");
    expect(manifest.directories.simulations).toBe(".theorem-workbench/simulations");
    expect(manifest.directories.patents).toBe(".theorem-workbench/patents");
    expect(manifest.directories.experiments).toBe(".theorem-workbench/experiments");
    expect(manifest.directories.vault).toBe(".theorem-workbench/vault");
    expect(manifest.directories.audits).toBe(".theorem-workbench/audits");
    expect(manifest.directories.snapshots).toBe(".theorem-workbench/snapshots");
    expect(manifest.directories.sessions).toBe(".theorem-workbench/sessions");
    expect(manifest.directories.reviews).toBe(".theorem-workbench/reviews");
    expect(manifest.directories.validation).toBe(".theorem-workbench/validation");
    expect(manifest.directories.literature).toBe(".theorem-workbench/literature");
    expect(manifest.directories["notebook-runs"]).toBe(".theorem-workbench/notebook-runs");
    expect(manifest.directories["code-runs"]).toBe(".theorem-workbench/code-runs");
    expect(manifest.directories["model-contexts"]).toBe(".theorem-workbench/model-contexts");
    expect(manifest.directories.routes).toBe(".theorem-workbench/routes");
    expect(manifest.policies.externalCalls).toBe("disabled-by-default");
    expect(manifest.policies.disclosure).toBe("required-for-external-calls");
  });

  it("initializes workspace directories and is idempotent", async () => {
    const root = await tempRoot();
    const first = await initLocalWorkspace(root, {
      displayName: "Local Discovery Lab",
      now: "2026-06-08T00:00:00.000Z"
    });
    const second = await initLocalWorkspace(root);
    const status = await getLocalWorkspaceStatus(root);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.manifest.projectId).toBe(first.manifest.projectId);
    expect(status.exists).toBe(true);
    expect(status.missingDirectories).toEqual([]);
  });

  it("reports a missing workspace before initialization", async () => {
    const root = await tempRoot();
    const status = await getLocalWorkspaceStatus(root);

    expect(status.exists).toBe(false);
    expect(status.manifest).toBeUndefined();
    expect(status.missingDirectories).toEqual([]);
  });

  it("detects missing private workspace directories without recreating them", async () => {
    const root = await tempRoot();
    const initialized = await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await rm(join(root, initialized.manifest.directories.inventions), { recursive: true, force: true });

    const status = await getLocalWorkspaceStatus(root);

    expect(status.exists).toBe(true);
    expect(status.missingDirectories).toEqual([initialized.manifest.directories.inventions]);
  });

  it("reports and repairs manifests missing newer default directories", async () => {
    const root = await tempRoot();
    const initialized = await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const legacyDirectories = { ...initialized.manifest.directories } as Partial<typeof initialized.manifest.directories>;
    delete legacyDirectories.routes;
    const legacyManifest = {
      ...initialized.manifest,
      directories: legacyDirectories
    };
    await rm(join(root, initialized.manifest.directories.routes), { recursive: true, force: true });
    await writeFile(initialized.manifestPath, `${JSON.stringify(legacyManifest, null, 2)}\n`, "utf8");

    const status = await getLocalWorkspaceStatus(root);

    expect(status.exists).toBe(true);
    expect(status.manifest?.directories.routes).toBe(".theorem-workbench/routes");
    expect(status.manifestRepair).toEqual({
      applied: false,
      addedDirectories: ["routes"]
    });
    expect(status.missingDirectories).toEqual([".theorem-workbench/routes"]);
    expect(JSON.parse(await readFile(initialized.manifestPath, "utf8")).directories.routes).toBeUndefined();

    const repaired = await repairLocalWorkspace(root, { now: "2026-06-09T00:00:00.000Z" });
    const repairedStatus = await getLocalWorkspaceStatus(root);
    const rawManifest = JSON.parse(await readFile(initialized.manifestPath, "utf8")) as typeof initialized.manifest;

    expect(repaired.repaired).toBe(true);
    expect(repaired.manifest.updatedAt).toBe("2026-06-09T00:00:00.000Z");
    expect(repaired.manifestRepair).toEqual({
      applied: true,
      addedDirectories: ["routes"]
    });
    expect(repaired.createdDirectories).toEqual([".theorem-workbench/routes"]);
    expect(repaired.missingDirectoriesAfter).toEqual([]);
    expect(rawManifest.directories.routes).toBe(".theorem-workbench/routes");
    expect(repairedStatus.manifestRepair).toBeUndefined();
    expect(repairedStatus.missingDirectories).toEqual([]);
  });

  it("rejects manifest directories that escape the private workspace", async () => {
    const root = await tempRoot();
    const initialized = await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const tampered = {
      ...initialized.manifest,
      directories: {
        ...initialized.manifest.directories,
        artifacts: "../outside-artifacts"
      }
    };
    await writeFile(initialized.manifestPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");

    await expect(getLocalWorkspaceStatus(root)).rejects.toThrow("Workspace directory escapes");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-"));
  roots.push(root);
  return root;
}
