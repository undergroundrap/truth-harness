import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseBenchmarkSuite, runBenchmarkSuite, type BenchmarkRun } from "@theorem-workbench/benchmarks";
import { createReceipt, replayReceipt, type Receipt, type ReplayResult } from "@theorem-workbench/core";

export interface TheoremAskInput {
  problem: string;
  strict?: boolean;
}

export interface TheoremAskOutput {
  error: boolean;
  receipt: Receipt;
  message: string;
}

export interface TheoremBenchmarkRunInput {
  suitePath?: string;
}

export interface TheoremReplayInput {
  receiptJson?: string;
  receiptPath?: string;
}

export function handleTheoremAsk(input: TheoremAskInput): TheoremAskOutput {
  const receipt = createReceipt(input.problem);
  const strictFailure = input.strict === true && receipt.trust === "unverified";

  return {
    error: strictFailure,
    receipt,
    message: strictFailure
      ? "Strict mode failed because the receipt is unverified."
      : `Receipt ${receipt.runId} completed with trust ${receipt.trust}.`
  };
}

export async function handleTheoremBenchmarkRun(input: TheoremBenchmarkRunInput): Promise<BenchmarkRun> {
  const suitePath = resolveWorkspacePath(input.suitePath ?? "packages/benchmarks/suites/foundations-seed.json");
  const suite = parseBenchmarkSuite(JSON.parse(await readFile(suitePath, "utf8")) as unknown);
  return runBenchmarkSuite(suite);
}

export async function handleTheoremReplay(input: TheoremReplayInput): Promise<ReplayResult> {
  if (input.receiptJson && input.receiptPath) {
    throw new Error("Provide receiptJson or receiptPath, not both.");
  }

  const raw = input.receiptJson ?? (input.receiptPath ? await readFile(resolveWorkspacePath(input.receiptPath), "utf8") : undefined);
  if (!raw) {
    throw new Error("Provide receiptJson or receiptPath.");
  }

  return replayReceipt(JSON.parse(raw) as Receipt);
}

export function toolJson(value: unknown, options: { isError?: boolean } = {}) {
  return {
    isError: options.isError,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function resolveWorkspacePath(path: string): string {
  const workspaceRoot = resolve(process.env.THEOREM_WORKBENCH_ROOT ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  const target = resolve(workspaceRoot, path);
  const rootWithSep = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`;

  if (target !== workspaceRoot && !target.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace root: ${pathToFileURL(target).href}`);
  }

  return target;
}
