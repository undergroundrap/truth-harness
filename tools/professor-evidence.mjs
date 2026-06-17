#!/usr/bin/env node
import { spawnSync } from "node:child_process";

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
    label: "write Docker-core engine evidence",
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "engines",
      "verify",
      "--write",
      "--require-docker-core",
      "--timeout-ms",
      "5000"
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
    label: "write professor credibility pack",
    command: "node",
    args: [
      "apps/cli/dist/index.js",
      "workspace",
      "credibility-pack",
      ".",
      "--require-docker-core",
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0"
    ]
  }
];

for (const step of steps) {
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

console.log("");
console.log("Professor evidence sequence completed.");
console.log("Generated local engine, benchmark, and credibility-pack artifacts are under .truth-harness/.");
console.log("Inspect the latest credibility pack before claiming reviewer-ready; stricter proof or all-engine gates may still block it.");
