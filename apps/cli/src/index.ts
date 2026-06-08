#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { parseBenchmarkSuite, runBenchmarkSuite, type BenchmarkRun } from "@theorem-workbench/benchmarks";
import { createReceipt, type Receipt } from "@theorem-workbench/core";

const program = new Command();

program
  .name("theorem")
  .description("Verified math for AI agents: proof receipts, exact computation, refutation, and benchmarks.")
  .version("0.0.0");

program
  .command("ask")
  .description("Create a proof receipt for a math prompt.")
  .argument("<problem...>", "Problem statement")
  .option("--json", "Print the full receipt JSON")
  .option("--out <path>", "Write the full receipt JSON to a file")
  .action(async (problemParts: string[], options: { json?: boolean; out?: string }) => {
    const problem = problemParts.join(" ");
    const receipt = createReceipt(problem);

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
  .command("doctor")
  .description("Show local adapter and trust-surface status.")
  .action(() => {
    console.log("Theorem Workbench doctor");
    console.log("");
    console.log("Available local adapters:");
    console.log("  exact arithmetic      ready   local Rational evaluator");
    console.log("  counterexample search ready   finite integer search over exact arithmetic");
    console.log("  Lean proof checker    planned adapter");
    console.log("  SymPy/Sage CAS        planned adapter");
    console.log("  Z3/cvc5 SMT           planned adapter");
    console.log("  RAG citations         planned adapter");
    console.log("");
    console.log("Trust rule: the MVP will not label a theorem `proved` until a proof-checker adapter exists.");
  });

await program.parseAsync(process.argv);

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

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}
