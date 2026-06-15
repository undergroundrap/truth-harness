import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withWorkspaceLock, writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("filesystem utilities", () => {
  it("writes files through same-directory temp files and leaves only the target", async () => {
    const root = await tempRoot();
    const target = join(root, ".truth-harness", "artifacts", "atomic.json");

    await writeJsonFileAtomic(target, { schemaVersion: "truth-harness.artifact.v0", value: 1 });
    await writeFileAtomic(target, "{\"schemaVersion\":\"truth-harness.artifact.v0\",\"value\":2}\n");

    const files = await readdir(join(root, ".truth-harness", "artifacts"));
    expect(JSON.parse(await readFile(target, "utf8"))).toMatchObject({ value: 2 });
    expect(files).toEqual(["atomic.json"]);
  });

  it("serializes same-workspace critical sections with a local lock", async () => {
    const root = await tempRoot();
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];

    await Promise.all(
      ["first", "second", "third"].map((label) =>
        withWorkspaceLock(
          root,
          "research-session",
          async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            order.push(`${label}:start`);
            await delay(20);
            order.push(`${label}:end`);
            active -= 1;
          },
          { timeoutMs: 2_000, retryMs: 5 }
        )
      )
    );

    expect(maxActive).toBe(1);
    expect(order.filter((event) => event.endsWith(":start"))).toHaveLength(3);
    expect(order.filter((event) => event.endsWith(":end"))).toHaveLength(3);
    await expect(readdir(join(root, ".truth-harness", "indexes", "locks"))).resolves.toEqual([]);
  });

  it("reclaims stale locks instead of blocking forever", async () => {
    const root = await tempRoot();
    const lockPath = join(root, ".truth-harness", "indexes", "locks", "stale.lock");
    await mkdir(join(root, ".truth-harness", "indexes", "locks"), { recursive: true });
    await writeFile(lockPath, "{\"lockId\":\"abandoned\"}\n", "utf8");

    await withWorkspaceLock(root, "stale", async () => "ok", { timeoutMs: 500, retryMs: 5, staleMs: 0 });

    await expect(readdir(join(root, ".truth-harness", "indexes", "locks"))).resolves.toEqual([]);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-fs-"));
  roots.push(root);
  return root;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
