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
report.recommendations = buildCleanupRecommendations(report);

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
  console.log("  Preview dev image cleanup after stopping Docker web/check workflows:");
  console.log("    npm run docker:cleanup -- dev-image");
  console.log("  Delete dev image after stopping Docker web/check workflows:");
  console.log("    npm run docker:cleanup -- dev-image --confirm-delete");
  console.log("  Preview old build-cache cleanup:");
  console.log("    npm run docker:cleanup -- build-cache");
  console.log("  Delete old build cache after review:");
  console.log("    npm run docker:cleanup -- build-cache --confirm-delete");
  console.log("  Delete all unused build cache after review:");
  console.log("    npm run docker:cleanup -- all-build-cache --confirm-delete");
  console.log("");
  console.log("Recommended scoped cleanup");
  if (input.recommendations.length === 0) {
    console.log("  No scoped Truth Harness cleanup target looks useful right now.");
  } else {
    for (const recommendation of input.recommendations) {
      const estimate = recommendation.estimatedBytes > 0 ? ` (~${formatBytes(recommendation.estimatedBytes)})` : "";
      console.log(`  ${recommendation.title}${estimate}`);
      console.log(`    Preview: ${recommendation.previewCommand}`);
      if (recommendation.deleteCommand) {
        console.log(`    Delete:  ${recommendation.deleteCommand}`);
      }
      if (recommendation.note) {
        console.log(`    Note:    ${recommendation.note}`);
      }
    }
  }
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
      truthHarnessVolumes: "",
      truthHarnessImageRows: [],
      imageReclaimable: { bytes: 0 },
      buildCacheReclaimable: { bytes: 0 }
    };
  }

  const truthHarnessImages = runDocker([
    "image",
    "ls",
    "--filter",
    "reference=truth-harness:*",
    "--format",
    "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"
  ]).output;

  return {
    available: true,
    error: "",
    systemDf: systemDf.output,
    truthHarnessImages,
    truthHarnessVolumes: runDocker([
      "volume",
      "ls",
      "--filter",
      "name=truth-harness",
      "--format",
      "table {{.Name}}\t{{.Driver}}"
    ]).output,
    truthHarnessImageRows: parseTruthHarnessImageRows(truthHarnessImages),
    imageReclaimable: parseDockerDfReclaimable(systemDf.output, "Images"),
    buildCacheReclaimable: parseDockerDfReclaimable(systemDf.output, "Build Cache")
  };
}

function buildCleanupRecommendations(input) {
  const recommendations = [];
  if (!input.docker.available) {
    recommendations.push({
      title: "Docker CLI accounting unavailable",
      estimatedBytes: 0,
      previewCommand: "npm run docker:storage",
      deleteCommand: "",
      note: "Run the read-only storage command from an approved local shell before deleting Docker data."
    });
    return recommendations;
  }

  const imageRows = input.docker.truthHarnessImageRows ?? [];
  const heavyImageNames = new Set([
    "truth-harness:all-engines",
    "truth-harness:sage-math",
    "truth-harness:lean-proof",
    "truth-harness:verify"
  ]);
  const heavyBytes = imageRows
    .filter((row) => heavyImageNames.has(row.image))
    .reduce((sum, row) => sum + row.bytes, 0);
  if (heavyBytes > 0) {
    recommendations.push({
      title: "Remove optional reviewer engine images",
      estimatedBytes: heavyBytes,
      previewCommand: "npm run docker:cleanup -- heavy-images",
      deleteCommand: "npm run docker:cleanup -- heavy-images --confirm-delete",
      note: "Keeps truth-harness:dev so the default Docker web/check path can still start quickly."
    });
  }

  const devBytes = imageRows
    .filter((row) => row.image === "truth-harness:dev")
    .reduce((sum, row) => sum + row.bytes, 0);
  if (devBytes > 0) {
    recommendations.push({
      title: "Remove dev image when Docker web/check work is paused",
      estimatedBytes: devBytes,
      previewCommand: "npm run docker:cleanup -- dev-image",
      deleteCommand: "npm run docker:cleanup -- dev-image --confirm-delete",
      note: "The next Docker web/check run will rebuild this image."
    });
  }

  if (input.docker.buildCacheReclaimable.bytes > 0) {
    recommendations.push({
      title: "Prune unused Docker build cache older than 24 hours",
      estimatedBytes: input.docker.buildCacheReclaimable.bytes,
      previewCommand: "npm run docker:cleanup -- build-cache",
      deleteCommand: "npm run docker:cleanup -- build-cache --confirm-delete",
      note: "Usually safe after reviewer runs; rebuilds may be slower afterward."
    });
  }

  return recommendations;
}

function parseTruthHarnessImageRows(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("REPOSITORY:TAG"))
    .map((line) => {
      const [image = "", size = "", created = ""] = line.split(/\s{2,}/u);
      return {
        image,
        size,
        created,
        bytes: parseDockerSize(size)
      };
    })
    .filter((row) => row.image.startsWith("truth-harness:"));
}

function parseDockerDfReclaimable(output, label) {
  const line = output
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .find((value) => value.startsWith(label));
  if (!line) {
    return { bytes: 0 };
  }

  const columns = line.split(/\s{2,}/u);
  const reclaimable = columns[4] ?? "";
  return { bytes: parseDockerSize(reclaimable.split(/\s+/u)[0] ?? "") };
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

function parseDockerSize(value) {
  const match = value.trim().match(/^([\d.]+)\s*([kmgt]?b)$/iu);
  if (!match) {
    return 0;
  }

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) {
    return 0;
  }

  const unit = match[2].toLowerCase();
  const multipliers = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4
  };
  return Math.round(amount * (multipliers[unit] ?? 1));
}

function indent(value) {
  return value
    .split(/\r?\n/u)
    .map((line) => `  ${line}`)
    .join("\n");
}
