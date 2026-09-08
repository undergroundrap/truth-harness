import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lookupPolynomialReceipts } from "../packages/core/dist/index.js";
import { boundedInput } from "./pit-witness.mjs";
import { checkRecurrence } from "./polynomial-recurrence.mjs";

export async function reopenRecurrence(requestPath, rootPath) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker pit-experiment service");
  const root = await realpath(rootPath);
  const request = await realpath(requestPath);
  const hash = createHash("sha256").update(await boundedInput(request)).digest("hex");
  let cursor, pages = 0, attempts = 0;
  const rejected = [];
  do {
    const page = await lookupPolynomialReceipts(root, hash, cursor);
    pages++;
    assert.ok(pages <= 32, "Lookup page budget exceeded");
    for (const candidate of page.matches) {
      assert.ok(attempts < 4, "Replay budget exhausted; no accepted evidence");
      attempts++;
      try {
        const receipt = await realpath(path.resolve(root, candidate.receipt_path));
        const rel = path.relative(root, receipt);
        assert.ok(rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), "Receipt escapes workspace");
        const replay = await checkRecurrence(["--check", request, receipt]);
        assert.equal(replay.request_sha256, hash, "Request changed during reopen");
        assert.equal(replay.receipt_sha256, candidate.receipt_sha256, "Receipt changed after lookup");
        assert.equal(replay.status, "identity-checked", "No accepted recurrence identity");
        assert.equal(replay.checked, true);
        assert.equal(replay.proof_checker_backed, false);
        return { schema_version: "truth-harness.recurrence-reopen.v0", status: "reopened", pages, attempts, rejected,
          request_sha256: hash, receipt_path: candidate.receipt_path, replay,
          modeling_status: "not-code-verified", limitations: "Read-only scripted discovery and replay, not autonomous discovery. Only the supplied recurrence is checked; source-code assumptions remain unverified." };
      } catch {
        rejected.push({ receipt_path: candidate.receipt_path, status: "replay-rejected" });
      }
    }
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  throw new Error(`No accepted saved recurrence evidence after ${pages} page(s) and ${attempts} replay(s)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 1 || (args.length === 3 && args[1] === "--root"), "Usage: recurrence-reopen.mjs <request.json> [--root <workspace>]");
    assert.notEqual(args[0], "-", "Reopen requires a saved request file");
    console.log(JSON.stringify(await reopenRecurrence(args[0], args[2] ?? process.cwd()), null, 2));
  } catch (error) {
    console.log(JSON.stringify({ schema_version: "truth-harness.recurrence-reopen.v0", status: "unverified", checked: false, error: error.message }, null, 2));
    process.exitCode = 2;
  }
}
