#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function main() {
  console.log("Truth Harness Docker reviewer flow");
  console.log("This builds the pinned Lean reviewer image, then writes no-network professor evidence.");
  console.log("Use `npm run docker:storage` to inspect Docker disk use before or after the run.");
  console.log("");
  ensureDockerEngine();
  runDocker(["compose", "build", "lean-proof"], "build the pinned Lean professor evidence image");
  runDocker(["compose", "run", "--rm", "professor-evidence"], "write professor evidence inside the no-network compose service");
  console.log("");
  console.log("Docker reviewer flow completed.");
  console.log("Next useful checks:");
  console.log("  npm run audit:release");
  console.log("  npm run docker:storage");
  console.log("  npm run docker:cleanup -- heavy-images");
}

function ensureDockerEngine() {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    shell: false
  });

  if (result.status === 0) {
    return;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`.trim();
  console.error("Docker engine is not reachable, so Truth Harness cannot write containerized professor evidence.");
  console.error("Start Docker Desktop, wait until the Linux engine is running, then rerun `npm run docker:professor`.");
  if (output) {
    console.error("");
    console.error("Docker reported:");
    console.error(output);
  }
  process.exit(result.status ?? 1);
}

function runDocker(args, label) {
  const result = spawnSync("docker", args, {
    stdio: "inherit",
    shell: false
  });

  if (result.status === 0) {
    return;
  }

  console.error("");
  console.error(`Failed to ${label}.`);
  process.exit(result.status ?? 1);
}

main();
