#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const positionalTarget = args.find((arg) => !arg.startsWith("-"));
const target = optionValue("--target") ?? positionalTarget ?? "heavy-images";
const confirmDelete = args.includes("--confirm-delete");

const plans = {
  "heavy-images": {
    title: "heavy Truth Harness reviewer images",
    description:
      "Removes heavyweight optional reviewer images while keeping truth-harness:dev for the local web/container workflow.",
    commands: [
      ["docker", ["image", "rm", "truth-harness:all-engines"]],
      ["docker", ["image", "rm", "truth-harness:sage-math"]],
      ["docker", ["image", "rm", "truth-harness:lean-proof"]],
      ["docker", ["image", "rm", "truth-harness:verify"]]
    ],
    missingIsOk: true
  },
  "build-cache": {
    title: "Docker build cache older than 24 hours",
    description:
      "Removes unused build-cache entries older than 24 hours. This is usually the safest cache cleanup after reviewer runs.",
    commands: [["docker", ["builder", "prune", "--force", "--filter", "until=24h"]]]
  },
  "all-build-cache": {
    title: "all unused Docker build cache",
    description:
      "Removes all unused build cache. Rebuilding Sage/Lean/all-engines will be slower afterward.",
    commands: [["docker", ["builder", "prune", "--all", "--force"]]]
  },
  dangling: {
    title: "dangling Docker images",
    description: "Removes untagged image layers only.",
    commands: [["docker", ["image", "prune", "--force"]]]
  }
};

const plan = plans[target];
if (!plan) {
  console.error(`Unknown cleanup target: ${JSON.stringify(target)}`);
  console.error(`Supported targets: ${Object.keys(plans).join(", ")}`);
  process.exit(1);
}

console.log(`Truth Harness Docker cleanup: ${plan.title}`);
console.log(plan.description);
console.log("");

if (!confirmDelete) {
  console.log("Preview only. No Docker data was deleted.");
  console.log("");
  console.log("Commands that would run:");
  for (const [command, commandArgs] of plan.commands) {
    console.log(`  ${command} ${commandArgs.join(" ")}`);
  }
  console.log("");
  console.log("Run again with --confirm-delete when you intentionally want to delete this target.");
  console.log(`  npm run docker:cleanup -- ${target} --confirm-delete`);
  console.log("");
  console.log("Use `npm run docker:storage` before and after cleanup to inspect Docker's disk accounting.");
  process.exit(0);
}

for (const [command, commandArgs] of plan.commands) {
  run(command, commandArgs, { missingIsOk: plan.missingIsOk === true });
}

console.log("");
console.log("Cleanup command(s) completed.");
console.log("Docker Desktop may keep docker_data.vhdx allocated until Docker/WSL compacts it.");
console.log("Run `npm run docker:storage` to inspect current Docker accounting.");

function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }
  return args[index + 1];
}

function run(command, commandArgs, options = {}) {
  console.log(`\n==> ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (output) {
    console.log(output);
  }

  if (result.status === 0) {
    return;
  }

  if (options.missingIsOk && /No such image|image is referenced in multiple repositories/u.test(output)) {
    console.log("Skipped missing or already-shared image reference.");
    return;
  }

  console.error(`Command failed with exit code ${result.status ?? 1}.`);
  process.exit(result.status ?? 1);
}
