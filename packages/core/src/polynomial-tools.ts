import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type PolynomialOperation = "compare" | "sum" | "recurrence";
const scripts = {
  compare: new URL("../../../tools/polynomial-compare.mjs", import.meta.url),
  sum: new URL("../../../tools/polynomial-sum.mjs", import.meta.url),
  recurrence: new URL("../../../tools/polynomial-recurrence.mjs", import.meta.url)
};
const schemas = {
  compare: "truth-harness.polynomial-equivalence-report.v0",
  sum: "truth-harness.polynomial-sum-report.v0",
  recurrence: "truth-harness.polynomial-recurrence-report.v0"
};

export interface PolynomialToolResult {
  exit_code: number;
  report: Record<string, unknown> & { status: string; checked: boolean };
}

export function polynomialCapabilities() {
  const assetsPresent = Object.values(scripts).every(existsSync) &&
    ["polynomial_equivalence.py", "polynomial_sum.py", "polynomial_recurrence.py", "exponential_recurrence.py", "pit_witness.py", "pit_certificate.py", "pit-witness.mjs"]
      .every(name => existsSync(new URL(`../../../tools/${name}`, import.meta.url)));
  return {
    schema_version: "truth-harness.polynomial-capabilities.v0",
    execution: process.env.TRUTH_HARNESS_CONTAINER === "1" && assetsPresent ? "configured" : "unavailable",
    assets_present: assetsPresent,
    runtime: "Docker source checkout; Python and SymPy required; dependency health checked on execution",
    operations: [
      { operation: "compare", request_schema: "truth-harness.polynomial-equivalence.v0", max_variables: 8, max_terms_per_side: 64, max_degree_per_variable: 1000000 },
      { operation: "sum", request_schema: "truth-harness.polynomial-sum.v0", max_variables: 1, max_terms_per_side: 32, max_degree: 12 },
      { operation: "recurrence", request_schema: "truth-harness.polynomial-recurrence.v0", accepted_request_schemas: ["truth-harness.polynomial-recurrence.v0", "truth-harness.exponential-recurrence.v0"], max_variables: 1, max_terms_per_side: 32, max_degree: 12, max_order: 4, max_counterexample_index: 16, max_candidate_bases: 4, min_base_magnitude: "1/16", max_base_magnitude: "16" }
    ],
    replay: true,
    lookup: { match_basis: "exact-request-bytes-sha256", max_entries: 256, requires_replay: true },
    max_input_bytes: 65536,
    exit_codes: { accepted: 0, refuted: 1, tool_error: 2, unknown: 3 },
    proof_checker_backed: false,
    artifact_store: "source-checkout/.truth-harness/witnesses",
    isolation: "Use network-disabled pit-experiment; the container environment marker is not a security attestation",
    network: "none required", cloud: "none", telemetry: "none"
  };
}

function failure(error: string): PolynomialToolResult {
  return { exit_code: 2, report: { status: "unverified", checked: false, error } };
}

export async function runPolynomialTool(input: {
  operation: PolynomialOperation;
  requestJson?: string;
  requestPath?: string;
  receiptPath?: string;
}): Promise<PolynomialToolResult> {
  if (input.operation !== "compare" && input.operation !== "sum" && input.operation !== "recurrence") return failure("Unsupported polynomial operation");
  if (polynomialCapabilities().execution !== "configured") return failure("Use the Docker pit-experiment source checkout with polynomial tool assets installed");
  if ((input.requestJson === undefined) === (input.requestPath === undefined)) return failure("Supply exactly one requestJson or requestPath");
  if (input.receiptPath !== undefined && input.requestPath === undefined) return failure("Replay requires requestPath and receiptPath");
  if (input.requestJson !== undefined && Buffer.byteLength(input.requestJson, "utf8") > 65536) return failure("Input exceeds 65536 bytes");
  if (input.requestPath === "-" || input.receiptPath === "-") return failure("Pass stdin data as requestJson, not a path");
  const args = input.receiptPath !== undefined
    ? ["--check", resolve(input.requestPath!), resolve(input.receiptPath)]
    : input.requestPath !== undefined ? [resolve(input.requestPath)] : ["-"];
  return new Promise(resolveResult => {
    const child = spawn(process.execPath, [fileURLToPath(scripts[input.operation]), ...args], {
      stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let size = 0;
    let fault: string | undefined;
    const timer = setTimeout(() => { fault = "Polynomial tool timed out"; child.kill(); }, 70000);
    const collect = (parts: Buffer[]) => (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1024 * 1024) { fault = "Polynomial output exceeds limit"; child.kill(); }
      else parts.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.on("error", error => { fault = error.message; });
    child.stdin.on("error", error => { fault ??= error.message; });
    child.on("close", code => {
      clearTimeout(timer);
      if (fault) return resolveResult(failure(fault));
      try {
        const report = JSON.parse(Buffer.concat(stdout).toString("utf8"));
        const expectedStatus = code === 0 ? (input.operation === "compare" ? "equivalent" : "identity-checked")
          : code === 1 ? "refuted" : code === 3 ? "unknown" : "unverified";
        if (![0, 1, 2, 3].includes(code ?? -1) || report.schema_version !== schemas[input.operation] ||
            report.status !== expectedStatus || report.checked !== (code === 0 || code === 1) ||
            (code !== 2 && (report.proof_checker_backed !== false || report.trust !== (code === 0 ? "exact-computed" : code === 1 ? "refuted" : "unverified")))) {
          return resolveResult(failure("Inconsistent polynomial tool response"));
        }
        resolveResult({ exit_code: code!, report });
      } catch {
        resolveResult(failure("Invalid polynomial tool response"));
      }
    });
    child.stdin.end(input.requestJson ?? "");
  });
}
