import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { open, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const script = fileURLToPath(new URL("./pit_witness.py", import.meta.url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";

export function runPython(mode, raw) {
  const result = spawnSync("python", [script, mode], {
    input: raw, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024,
    windowsHide: true, shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? result.stderr.trim() ?? "Checker failed");
  }
  return JSON.parse(result.stdout);
}

export async function boundedInput(source) {
  let bytes;
  if (source === "-") {
    const chunks = [];
    let length = 0;
    for await (const chunk of process.stdin) {
      length += chunk.length;
      if (length > 65536) throw new Error("Input exceeds 65536 bytes");
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
  } else {
    const handle = await open(source, "r");
    try {
      const buffer = Buffer.alloc(65537);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > 65536) throw new Error("Input exceeds 65536 bytes");
      bytes = buffer.subarray(0, length);
    } finally {
      await handle.close();
    }
  }
  if (bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191]))) throw new Error("UTF-8 BOM is not accepted");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function main(args) {
  if (process.env.TRUTH_HARNESS_CONTAINER !== "1") throw new Error("Run through the offline Docker pit-experiment service");
  const recheck = args[0] === "--check";
  if (recheck ? args.length !== 3 : args.length !== 1 || args[0].startsWith("--")) {
    throw new Error("Usage: pit-witness.mjs <request.json|-> OR --check <request.json> <receipt.json>");
  }
  if (recheck && args.slice(1).includes("-")) throw new Error("Recheck requires two file paths");
  const raw = await boundedInput(args[recheck ? 1 : 0]);
  let receiptRaw;
  let directory;
  if (recheck) {
    receiptRaw = await boundedInput(args[2]);
  } else {
    const receipt = runPython("construct", raw);
    // Persist compact receipts so all accepted bounded inputs remain recheckable.
    receiptRaw = JSON.stringify(receipt) + "\n";
    if (Buffer.byteLength(receiptRaw) > 65536) throw new Error("Receipt exceeds 65536 bytes");
    const root = path.join(repo, ".truth-harness", "witnesses");
    await mkdir(root, { recursive: true });
    directory = await mkdtemp(path.join(root, "pit-"));
    await writeFile(path.join(directory, "request.json"), raw, "utf8");
    await writeFile(path.join(directory, "receipt.json"), receiptRaw, "utf8");
    receiptRaw = await boundedInput(path.join(directory, "receipt.json"));
  }
  const checked = runPython("check", JSON.stringify({ request_json: raw, receipt_json: receiptRaw }));
  const report = {
    schema_version: "truth-harness.pit-witness-report.v0",
    ...checked,
    request_sha256: hash(raw), receipt_sha256: hash(receiptRaw),
    checker_sha256: hash(await readFile(script)),
    checker_helper_sha256: hash(await readFile(new URL("./pit_certificate.py", import.meta.url))),
    artifact_directory: directory ? path.relative(repo, directory).split(path.sep).join("/") : null,
    limitations: ["Exact evaluation, not a formally verified implementation or a new theorem.",
      "Unknown diagnostics and earliest-witness minimality are not certified.",
      "Integer limits are not a process memory guarantee."],
  };
  if (directory) {
    await writeFile(path.join(directory, "report.json"), json(report), "utf8");
    await writeFile(path.join(directory, "PROGRESS.md"),
      `# Sparse Polynomial Witness\n\nRecorded: ${new Date().toISOString()}\n\nStatus: ${report.status}; trust: ${report.trust}.\n\n` +
      "[Input](request.json) | [Receipt](receipt.json) | [Independent check](report.json)\n\n" + report.limitations.join("\n\n") + "\n", "utf8");
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await main(process.argv.slice(2));
    process.stdout.write(json(report));
    process.exitCode = report.checked ? 0 : 1;
  } catch (error) {
    process.stdout.write(json({ schema_version: "truth-harness.pit-witness-report.v0", status: "tool-failure", trust: "unverified", checked: false, error: error.message }));
    process.exitCode = 2;
  }
}
