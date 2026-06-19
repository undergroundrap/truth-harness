#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const strictAllEngines = process.argv.slice(2).some((arg) => arg === "--all-engines" || arg === "--strict");
const engineRequirementArgs = strictAllEngines
  ? ["--require-all-engines"]
  : ["--require-maxima", "--require-z3", "--require-cvc5", "--require-lean"];
const evidenceModeLabel = strictAllEngines
  ? "strict Maxima/Z3/cvc5/Lean/SageMath all-engine"
  : "Maxima/Z3/cvc5/Lean professor";

const steps = [
  {
    label: "build TypeScript artifacts",
    command: "npm",
    args: ["run", "build"]
  },
  {
    label: "ensure local workspace manifest",
    command: "node",
    args: ["apps/cli/dist/index.js", "workspace", "init", ".", "--name", "Truth Harness"]
  },
  {
    label: `write concrete ${evidenceModeLabel} engine evidence`,
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "engines",
      "verify",
      "--write",
      ...engineRequirementArgs,
      "--timeout-ms",
      "30000"
    ]
  },
  {
    label: "write adversarial AI-failure benchmark evidence",
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "bench",
      "run",
      "packages/benchmarks/suites/ai-failure-seed.json",
      "--write",
      "--fail-on-failures"
    ]
  },
  {
    label: "write math credibility ladder evidence",
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "bench",
      "run",
      "packages/benchmarks/suites/math-credibility-ladder.json",
      "--write",
      "--fail-on-failures"
    ]
  },
  {
    label: `write ${strictAllEngines ? "strict " : ""}professor credibility pack`,
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "workspace",
      "credibility-pack",
      ".",
      ...engineRequirementArgs,
      "--timeout-ms",
      "30000",
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--fail-on-blocked"
    ]
  },
  {
    label: `write ${strictAllEngines ? "strict " : ""}portable reviewer bundle`,
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "workspace",
      "credibility-bundle",
      ".",
      ...engineRequirementArgs,
      "--timeout-ms",
      "30000",
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--fail-on-blocked"
    ]
  }
];

for (const step of steps) {
  runStep(step);
}

const bundleRef = latestCredibilityBundleRef();
runStep({
  label: `verify portable reviewer bundle ${bundleRef}`,
  command: "node",
  args: [
    "apps/cli/dist/index.js",
    "workspace",
    "verify-credibility-bundle",
    ".",
    bundleRef,
    "--fail-on-bundle-change",
    "--fail-on-source-drift"
  ]
});

console.log("");
console.log(`${strictAllEngines ? "Strict all-engine p" : "P"}rofessor evidence sequence completed.`);
console.log("Generated local engine, benchmark, credibility-pack, and reviewer-bundle artifacts are under .truth-harness/.");
console.log(`Verified portable reviewer bundle: ${bundleRef}`);
if (strictAllEngines) {
  console.log("This strict reviewer packet required Maxima, Z3, cvc5, Lean, and SageMath to earn scoped evidence.");
} else {
  console.log("Inspect the latest credibility pack before claiming broader discovery readiness; run with --all-engines when SageMath must be included in the same reviewer packet.");
}

function runStep(step) {
  console.log(`\n==> ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: false
  });

  if (result.status !== 0) {
    console.error("");
    console.error(`Professor evidence gate stopped while trying to ${step.label}.`);
    console.error("No later reviewer packet was written, because earlier evidence did not pass.");
    process.exit(result.status ?? 1);
  }
}

function latestCredibilityBundleRef() {
  const findingsDir = join(".", ".truth-harness", "findings");
  const candidates = readdirSync(findingsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("-credibility-bundle"))
    .map((entry) => {
      const path = join(findingsDir, entry.name);
      return {
        path,
        mtimeMs: statSync(path).mtimeMs
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (candidates.length === 0) {
    throw new Error("No credibility reviewer bundle was written under .truth-harness/findings.");
  }

  return candidates[0].path.replace(/\\/gu, "/");
}
