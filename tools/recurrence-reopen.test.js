import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, it } from "vitest";
import { recurrenceContract } from "./polynomial-recurrence.mjs";

const script = fileURLToPath(new URL("./recurrence-reopen.mjs", import.meta.url));
const raw = readFileSync(new URL("../docs/examples/exponential-recurrence-tree.json", import.meta.url), "utf8");
beforeAll(() => {
  if (process.env.TRUTH_HARNESS_REQUIRE_DOCKER_TESTS === "1") expect(process.env.TRUTH_HARNESS_CONTAINER).toBe("1");
});
it("reopens in fresh processes through pagination, rejects bad evidence and changed assumptions", () => {
  const root = mkdtempSync(join(tmpdir(), "recurrence reopen "));
  const request = join(root, "target request.json"), store = join(root, ".truth-harness/witnesses");
  const run = (env = process.env) => spawnSync(process.execPath, [script, request, "--root", root], { env, encoding: "utf8", timeout: 30000, windowsHide: true });
  try {
    writeFileSync(request, raw);
    const refused = run({ ...process.env, TRUTH_HARNESS_CONTAINER: "" });
    expect(refused.status).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ status: "unverified", checked: false });
    if (process.env.TRUTH_HARNESS_CONTAINER !== "1") return;
    mkdirSync(store, { recursive: true });
    for (let i = 0; i < 256; i++) writeFileSync(join(store, `a${i}`), "");
    const receipt = recurrenceContract("construct", raw);
    const put = (name, requestText, receiptText) => {
      const dir = join(store, name); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "request.json"), requestText); writeFileSync(join(dir, "receipt.json"), receiptText);
    };
    put("polynomial-recurrence-bad", raw, "malformed");
    put("polynomial-recurrence-good", raw, JSON.stringify(receipt));
    const snapshot = () => readdirSync(root, { recursive: true }).sort().map(name => {
      try { return [name, readFileSync(join(root, name), "hex")]; } catch { return [name]; }
    });
    const before = snapshot();
    for (let i = 0; i < 2; i++) {
      const result = run(); expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ status: "reopened", pages: 2, attempts: 2, modeling_status: "not-code-verified",
        replay: { status: "identity-checked", proof_checker_backed: false, artifact_directory: null } });
      expect(JSON.parse(result.stdout).rejected).toHaveLength(1);
    }
    expect(snapshot()).toEqual(before);
    const changed = JSON.stringify({ ...JSON.parse(raw), initial_values: ["0"] });
    writeFileSync(request, changed);
    expect(run().status).toBe(2);
    // Even relabeling a saved request cannot make its stale receipt valid.
    put("polynomial-recurrence-good", changed, JSON.stringify(receipt));
    const stale = run(); expect(stale.status).toBe(2);
    expect(JSON.parse(stale.stdout)).toMatchObject({ checked: false, status: "unverified" });
    writeFileSync(request, raw);
    for (let i = 0; i < 4; i++) put(`polynomial-recurrence-a${i}`, raw, "bad");
    expect(JSON.parse(run().stdout).error).toContain("Replay budget exhausted");
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);
