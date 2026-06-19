#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
    label: "write concrete Maxima/Z3/cvc5/Lean engine evidence",
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "engines",
      "verify",
      "--write",
      "--require-maxima",
      "--require-z3",
      "--require-cvc5",
      "--require-lean",
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
    label: "write professor credibility pack",
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "workspace",
      "credibility-pack",
      ".",
      "--require-maxima",
      "--require-z3",
      "--require-cvc5",
      "--require-lean",
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
    label: "write portable reviewer bundle",
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "workspace",
      "credibility-bundle",
      ".",
      "--require-maxima",
      "--require-z3",
      "--require-cvc5",
      "--require-lean",
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
console.log("Professor evidence sequence completed.");
console.log("Generated local engine, benchmark, credibility-pack, and reviewer-bundle artifacts are under .truth-harness/.");
console.log(`Verified portable reviewer bundle: ${bundleRef}`);
console.log("Inspect the latest credibility pack before claiming broader discovery readiness; optional all-engine gates may still block stricter review.");

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
