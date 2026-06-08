#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { parseBenchmarkSuite, runBenchmarkSuite, type BenchmarkRun } from "@theorem-workbench/benchmarks";
import {
  checkClaimFile,
  createReceipt,
  replayReceipt,
  type ClaimFileCheck,
  type Receipt,
  type ReplayResult
} from "@theorem-workbench/core";

const program = new Command();

program
  .name("theorem")
  .description("Verified math for AI agents: proof receipts, exact computation, refutation, and benchmarks.")
  .version("0.0.0");

program
  .command("ask")
  .description("Create a proof receipt for a math prompt.")
  .allowUnknownOption(true)
  .argument("[tokens...]", "Problem tokens plus optional --json and --out <path> flags")
  .addHelpText(
    "after",
    `

Ask flags:
  --json              Print the full receipt JSON
  --out <path>        Write the full receipt JSON to a file

With npm scripts, pass ask flags after an extra separator:
  npm run cli -- ask "compute 2 + 2" -- --json
`
  )
  .action(async (tokens: string[]) => {
    const options = parseAskArgs(tokens);
    const receipt = createReceipt(options.problem);

    if (options.out) {
      await writeJson(options.out, receipt);
    }

    if (options.json) {
      printJson(receipt);
      return;
    }

    printReceipt(receipt, options.out);
  });

const bench = program.command("bench").description("Run and compare verification benchmark suites.");

bench
  .command("run")
  .description("Run a benchmark suite JSON file.")
  .argument("<suite>", "Path to a benchmark suite JSON file")
  .option("--json", "Print the full benchmark run JSON")
  .option("--out <path>", "Write the benchmark run JSON to a file")
  .action(async (suitePath: string, options: { json?: boolean; out?: string }) => {
    const raw = JSON.parse(await readFile(resolve(suitePath), "utf8")) as unknown;
    const suite = parseBenchmarkSuite(raw);
    const run = runBenchmarkSuite(suite);

    if (options.out) {
      await writeJson(options.out, run);
    }

    if (options.json) {
      printJson(run);
      return;
    }

    printBenchmarkRun(run, options.out);
  });

program
  .command("replay")
  .description("Replay a saved receipt JSON and compare trust-critical fields.")
  .argument("<receipt>", "Path to a receipt JSON file")
  .option("--json", "Print the full replay result JSON")
  .action(async (receiptPath: string, options: { json?: boolean }) => {
    const receipt = JSON.parse(await readFile(resolve(receiptPath), "utf8")) as Receipt;
    const replay = replayReceipt(receipt);

    if (options.json) {
      printJson(replay);
      return;
    }

    printReplayResult(replay);
    if (!replay.passed) {
      process.exitCode = 1;
    }
  });

program
  .command("check")
  .description("Check theorem-workbench fenced claim blocks in Markdown files.")
  .argument("<files...>", "Markdown files to check")
  .option("--json", "Print the full claim check JSON")
  .action(async (files: string[], options: { json?: boolean }) => {
    const results = await Promise.all(
      files.map(async (file) => checkClaimFile(await readFile(resolve(file), "utf8"), file))
    );

    if (options.json) {
      printJson({
        total: results.reduce((sum, result) => sum + result.total, 0),
        passed: results.reduce((sum, result) => sum + result.passed, 0),
        failed: results.reduce((sum, result) => sum + result.failed, 0),
        results
      });
      return;
    }

    printClaimFileChecks(results);
    if (results.some((result) => result.failed > 0)) {
      process.exitCode = 1;
    }
  });

program
  .command("doctor")
  .description("Show local adapter and trust-surface status.")
  .action(() => {
    console.log("Theorem Workbench doctor");
    console.log("");
    console.log("Available local adapters:");
    console.log("  exact arithmetic      ready   local Rational evaluator");
    console.log("  counterexample search ready   finite integer search over exact arithmetic");
    console.log("  dimensional analysis  ready   local SI base-dimension evaluator");
    console.log("  SymPy CAS             ready   local Python subprocess when sympy is installed");
    console.log("  Lean proof checker    planned adapter");
    console.log("  Sage CAS              planned adapter");
    console.log("  Z3/cvc5 SMT           planned adapter");
    console.log("  RAG citations         planned adapter");
    console.log("");
    console.log("Trust rule: the MVP will not label a theorem `proved` until a proof-checker adapter exists.");
  });

await program.parseAsync(process.argv);

function parseAskArgs(tokens: string[]): { problem: string; json: boolean; out?: string } {
  const problemTokens: string[] = [];
  let json = false;
  let out: string | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "--") {
      continue;
    }

    if (token === "--json") {
      json = true;
      continue;
    }

    if (token === "--out") {
      out = tokens[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith("--out=")) {
      out = token.slice("--out=".length);
      continue;
    }

    problemTokens.push(token);
  }

  const problem = problemTokens.join(" ").trim();
  if (!problem) {
    throw new Error("Missing problem. Example: theorem ask \"compute 2 + 2\"");
  }

  return { problem, json, out };
}

function printReceipt(receipt: Receipt, outPath?: string): void {
  console.log(`Theorem receipt ${receipt.runId}`);
  console.log(`Trust: ${receipt.trust}`);
  console.log(`Summary: ${receipt.summary}`);
  console.log(`Replay: ${receipt.replay}`);
  console.log("");
  console.log("Evidence graph:");

  for (const node of receipt.graph.nodes) {
    console.log(`  ${node.id} ${node.kind} [${node.trust}] ${node.summary}`);
  }

  if (receipt.findings.length > 0) {
    console.log("");
    console.log("Findings:");
    for (const finding of receipt.findings) {
      console.log(`  ${finding.level}: ${finding.message}`);
    }
  }

  if (outPath) {
    console.log("");
    console.log(`Wrote receipt JSON: ${outPath}`);
  }
}

function printBenchmarkRun(run: BenchmarkRun, outPath?: string): void {
  console.log(`${run.title} (${run.suiteId})`);
  console.log(`Passed: ${run.passed}/${run.total}`);
  console.log(`Trust accuracy: ${(run.trustAccuracy * 100).toFixed(1)}%`);
  console.log("");

  for (const result of run.results) {
    const status = result.passed ? "PASS" : "FAIL";
    console.log(`${status} ${result.task.id}: ${result.receipt.trust} - ${result.receipt.summary}`);

    for (const failure of result.failures) {
      console.log(`  ${failure}`);
    }
  }

  if (outPath) {
    console.log("");
    console.log(`Wrote benchmark JSON: ${outPath}`);
  }
}

function printReplayResult(replay: ReplayResult): void {
  const status = replay.passed ? "PASS" : "FAIL";
  console.log(`${status} replay ${replay.expectedRunId}`);
  console.log(`Expected trust: ${replay.expectedTrust}`);
  console.log(`Actual trust: ${replay.actualTrust}`);
  console.log(`Actual run: ${replay.actualRunId}`);

  if (replay.differences.length > 0) {
    console.log("");
    console.log("Differences:");
    for (const difference of replay.differences) {
      console.log(`  ${difference}`);
    }
  }
}

function printClaimFileChecks(results: ClaimFileCheck[]): void {
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const passed = results.reduce((sum, result) => sum + result.passed, 0);
  const failed = results.reduce((sum, result) => sum + result.failed, 0);

  console.log(`Theorem claim check: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`Failed: ${failed}`);
  }
  console.log("");

  for (const result of results) {
    console.log(`${result.filePath}: ${result.passed}/${result.total} passed`);

    for (const check of result.checks) {
      const status = check.passed ? "PASS" : "FAIL";
      console.log(
        `  ${status} L${check.block.startLine}: ${check.receipt.trust} - ${check.receipt.summary}`
      );
      console.log(`       ${check.message}`);
    }
  }
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}
