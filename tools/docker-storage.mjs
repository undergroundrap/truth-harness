#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const json = process.argv.includes("--json");
const cwd = process.cwd();

const report = {
  workspace: {
    truthHarnessStore: directorySize(join(cwd, ".truth-harness")),
    nodeModules: directorySize(join(cwd, "node_modules"))
  },
  dockerDesktop: dockerDesktopStorage(),
  docker: dockerCliStorage()
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHuman(report);
}

function printHuman(input) {
  console.log("Truth Harness Docker storage");
  console.log("");
  console.log("Local project store");
  console.log(`  .truth-harness: ${formatBytes(input.workspace.truthHarnessStore.bytes)}`);
  console.log(`  node_modules:    ${formatBytes(input.workspace.nodeModules.bytes)}`);
  console.log("");

  console.log("Docker Desktop storage");
  if (input.dockerDesktop.available) {
    console.log(`  Docker folder: ${formatBytes(input.dockerDesktop.total.bytes)} (${input.dockerDesktop.root})`);
    for (const item of input.dockerDesktop.largeFiles) {
      console.log(`  ${formatBytes(item.bytes).padStart(9)}  ${item.path}`);
    }
  } else {
    console.log("  Not found on this platform.");
  }
  console.log("");

  console.log("Docker engine accounting");
  if (input.docker.available) {
    console.log(indent(input.docker.systemDf.trim()));
    if (input.docker.truthHarnessImages.trim()) {
      console.log("");
      console.log("Truth Harness images");
      console.log(indent(input.docker.truthHarnessImages.trim()));
    }
    if (input.docker.truthHarnessVolumes.trim()) {
      console.log("");
      console.log("Truth Harness volumes");
      console.log(indent(input.docker.truthHarnessVolumes.trim()));
    }
  } else {
    console.log(`  Docker CLI not available from this process: ${input.docker.error}`);
  }
  console.log("");

  console.log("Cleanup commands");
  console.log("  Preview heavy Truth Harness image cleanup:");
  console.log("    npm run docker:cleanup -- heavy-images");
  console.log("  Delete heavy Truth Harness images after review:");
  console.log("    npm run docker:cleanup -- heavy-images --confirm-delete");
  console.log("  Preview old build-cache cleanup:");
  console.log("    npm run docker:cleanup -- build-cache");
  console.log("  Delete old build cache after review:");
  console.log("    npm run docker:cleanup -- build-cache --confirm-delete");
  console.log("  Delete all unused build cache after review:");
  console.log("    npm run docker:cleanup -- all-build-cache --confirm-delete");
  console.log("");
  console.log("Note: Docker Desktop may keep docker_data.vhdx allocated until Docker/WSL compacts it.");
}

function dockerCliStorage() {
  const systemDf = runDocker(["system", "df"]);
  if (!systemDf.ok) {
    return {
      available: false,
      error: systemDf.output,
      systemDf: "",
      truthHarnessImages: "",
      truthHarnessVolumes: ""
    };
  }

  return {
    available: true,
    error: "",
    systemDf: systemDf.output,
    truthHarnessImages: runDocker([
      "image",
      "ls",
      "--filter",
      "reference=truth-harness:*",
      "--format",
      "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"
    ]).output,
    truthHarnessVolumes: runDocker([
      "volume",
      "ls",
      "--filter",
      "name=truth-harness",
      "--format",
      "table {{.Name}}\t{{.Driver}}"
    ]).output
  };
}

function dockerDesktopStorage() {
  const root = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Docker") : "";
  if (!root || !existsSync(root)) {
    return {
      available: false,
      root,
      total: { bytes: 0 },
      largeFiles: []
    };
  }

  const largeFiles = [];
  collectLargeFiles(root, largeFiles);
  largeFiles.sort((left, right) => right.bytes - left.bytes);

  return {
    available: true,
    root,
    total: directorySize(root),
    largeFiles: largeFiles.slice(0, 8)
  };
}

function collectLargeFiles(path, output) {
  let entries = [];
  try {
    entries = readdirSync(path, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) {
      collectLargeFiles(fullPath, output);
      continue;
    }

    try {
      const stats = statSync(fullPath);
      if (stats.size >= 1024 * 1024) {
        output.push({ path: fullPath, bytes: stats.size });
      }
    } catch {
      // Ignore files Docker rotates while we read.
    }
  }
}

function directorySize(path) {
  if (!existsSync(path)) {
    return { bytes: 0 };
  }

  let bytes = 0;
  const stack = [path];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      try {
        bytes += statSync(fullPath).size;
      } catch {
        // Ignore transient files.
      }
    }
  }

  return { bytes };
}

function runDocker(args) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    shell: false
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`.trim();
  return {
    ok: result.status === 0,
    output
  };
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function indent(value) {
  return value
    .split(/\r?\n/u)
    .map((line) => `  ${line}`)
    .join("\n");
}
