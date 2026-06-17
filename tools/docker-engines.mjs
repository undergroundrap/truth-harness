#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function main() {
  ensureDockerEngine();
  runDocker(["compose", "build", "truth-harness"], "build the Truth Harness Docker image");
  runDocker(["compose", "run", "--rm", "engine-smoke"], "run the no-network Maxima/Z3 engine smoke");
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
  console.error("Docker engine is not reachable, so Truth Harness cannot run the containerized engine smoke.");
  console.error("Start Docker Desktop, wait until the Linux engine is running, then rerun `npm run docker:engines`.");
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
