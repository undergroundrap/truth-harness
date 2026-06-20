#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4180;

if (isMainModule()) {
  try {
    const options = parseDoctorArgs(process.argv.slice(2));
    const report = await collectWebRuntimeDoctor(options);
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printDoctorReport(report);
    }
    process.exitCode = report.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export function parseDoctorArgs(args) {
  return {
    host: optionValue(args, "--host") ?? DEFAULT_HOST,
    port: positiveInteger(optionValue(args, "--port"), DEFAULT_PORT),
    expectedRoot: optionValue(args, "--expected-root") ?? process.cwd(),
    json: args.includes("--json")
  };
}

export async function collectWebRuntimeDoctor(options = {}) {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const expectedRoot = resolve(options.expectedRoot ?? process.cwd());
  const baseUrl = `http://${host}:${port}`;
  const [apiResult, remoteIndexResult, localScriptSrc, portOwners] = await Promise.all([
    fetchJson(`${baseUrl}/api/status`, options.fetchImpl),
    fetchText(`${baseUrl}/`, options.fetchImpl),
    readLocalScriptSrc(expectedRoot, options.readFileImpl),
    detectPortOwners(port, options)
  ]);
  const remoteScriptSrc = remoteIndexResult.ok ? parseIndexScriptSrc(remoteIndexResult.text) : undefined;
  const assessment = buildRuntimeAssessment({
    host,
    port,
    expectedRoot,
    statusPayload: apiResult.ok ? apiResult.json : undefined,
    apiError: apiResult.ok ? undefined : apiResult.error,
    remoteScriptSrc,
    localScriptSrc,
    portOwners
  });

  return {
    schemaVersion: "truth-harness.web-runtime-doctor.v0",
    createdAt: new Date().toISOString(),
    target: {
      host,
      port,
      baseUrl,
      expectedRoot: portablePath(expectedRoot)
    },
    portOwners,
    api: apiResult,
    staticAssets: {
      localScriptSrc,
      remoteScriptSrc,
      current: assessment.staticCurrent
    },
    assessment,
    exitCode: assessment.severity === "blocked" ? 1 : 0
  };
}

export function buildRuntimeAssessment(input) {
  const status = input.statusPayload;
  const hasRuntimeIdentity =
    status?.runtime?.schemaVersion === "truth-harness.web-runtime.v0" ||
    (Array.isArray(status?.capabilities) && status.capabilities.includes("web-runtime-identity"));
  const inferredLegacyDocker =
    !hasRuntimeIdentity &&
    status?.safety?.codeRunSandbox?.platform === "linux" &&
    status?.safety?.webServer?.bindHost === "0.0.0.0";
  const runtimeKind = hasRuntimeIdentity
    ? status.runtime?.runtimeKind ?? "reported-runtime"
    : status
      ? inferredLegacyDocker
        ? "probable-docker-container"
        : "legacy-local-api"
      : "unreachable";
  const ownerKind = classifyPortOwner(input.portOwners ?? []);
  const staticCurrent = staticAssetCurrent(input.localScriptSrc, input.remoteScriptSrc);
  const apiCurrent = Boolean(hasRuntimeIdentity);
  const projectRoot = status?.runtime?.projectRoot ?? "not reported";
  const diagnosis = runtimeDiagnosis({
    apiCurrent,
    runtimeKind,
    ownerKind,
    staticCurrent,
    apiReachable: Boolean(status),
    apiError: input.apiError
  });
  const recommendations = buildRuntimeRecommendations({
    apiCurrent,
    runtimeKind,
    ownerKind,
    staticCurrent,
    apiReachable: Boolean(status)
  });

  return {
    severity: diagnosis.severity,
    status: diagnosis.status,
    runtimeKind,
    runtimeLabel: runtimeLabel(runtimeKind),
    ownerKind,
    apiReachable: Boolean(status),
    apiCurrent,
    staticCurrent,
    projectRoot,
    summary: diagnosis.summary,
    recommendations,
    boundaries: [
      "This doctor is read-only. It does not stop containers, kill ports, rebuild images, run engines, or execute verifier work.",
      "A web runtime being current does not prove math. Claims still need receipts, replay, CAS/SMT/proof artifacts, sources, or review.",
      "Docker web is a localhost workbench runtime, not the no-network CLI/MCP verifier sandbox."
    ]
  };
}

export function parseIndexScriptSrc(html) {
  const match = String(html).match(/<script[^>]+src=["']([^"']*src\/app\.js\?v=[^"']+)["'][^>]*>/iu);
  return match?.[1];
}

export function parseWindowsNetstat(output, port) {
  const target = String(port);
  return String(output)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/u))
    .filter((columns) => columns[0]?.toUpperCase() === "TCP" && columns[3]?.toUpperCase() === "LISTENING")
    .filter((columns) => localAddressUsesPort(columns[1] ?? "", target))
    .map((columns) => ({
      pid: columns[4] ?? "",
      processName: "unknown",
      command: "netstat",
      source: "netstat"
    }))
    .filter((owner) => owner.pid);
}

export function parseTasklistCsv(output) {
  const row = parseCsvLine(String(output).split(/\r?\n/u).find((line) => line.trim()) ?? "");
  if (row.length < 2 || row[0] === "INFO: No tasks are running which match the specified criteria.") {
    return undefined;
  }
  return {
    processName: row[0] ?? "unknown",
    pid: row[1] ?? ""
  };
}

function runtimeDiagnosis(input) {
  if (!input.apiReachable) {
    return {
      severity: "blocked",
      status: "web-api-unreachable",
      summary: `No Truth Harness web API responded on the target port${input.apiError ? `: ${input.apiError}` : "."}`
    };
  }

  if (!input.apiCurrent && input.runtimeKind === "probable-docker-container") {
    return {
      severity: "warning",
      status: "legacy-docker-api",
      summary: "The browser is probably talking to Docker on this port, but the API lacks current runtime identity metadata."
    };
  }

  if (!input.apiCurrent) {
    return {
      severity: "warning",
      status: "legacy-web-api",
      summary: "The web API responded, but it does not expose current runtime identity metadata."
    };
  }

  if (input.staticCurrent === false) {
    return {
      severity: "warning",
      status: "static-assets-stale",
      summary: "The API reports current runtime identity, but the served web script differs from the local source."
    };
  }

  return {
    severity: "ok",
    status: input.runtimeKind === "docker-container" ? "docker-web-current" : "host-web-current",
    summary:
      input.runtimeKind === "docker-container"
        ? "The web API reports the current Docker /workspace runtime identity."
        : "The web API reports the current local host runtime identity."
  };
}

function buildRuntimeRecommendations(input) {
  if (!input.apiReachable) {
    return [
      {
        title: "Start the host web server on the canonical port",
        command: "npm run web:restart",
        reason: "Use this when you want the Windows host repo to serve the workbench."
      },
      {
        title: "Start the Docker web service on the canonical port",
        command: "docker compose up web",
        reason: "Use this when you want the Docker-first web runtime."
      }
    ];
  }

  const recommendations = [];
  if (!input.apiCurrent || input.staticCurrent === false) {
    if (input.ownerKind === "docker" || input.runtimeKind === "docker-container" || input.runtimeKind === "probable-docker-container") {
      recommendations.push({
        title: "Refresh Docker web from the current source tree",
        command: "docker compose up --build web",
        reason: "Rebuilds/recreates the web service without force-killing unrelated processes."
      });
      recommendations.push({
        title: "Switch from Docker web to host web",
        command: "docker compose stop web && npm run web:restart",
        reason: "Stops only the compose web service, then starts the local Node web server on the same port."
      });
      return recommendations;
    }

    recommendations.push({
      title: "Restart the host web server",
      command: "npm run web:restart",
      reason: "Refreshes the local Node listener without changing Docker state."
    });
    return recommendations;
  }

  recommendations.push({
    title: "Reload the browser tab",
    command: "browser reload http://127.0.0.1:4180/",
    reason: "The API/runtime identity is current; a simple browser reload is enough for static UI changes."
  });
  if (input.runtimeKind === "docker-container") {
    recommendations.push({
      title: "Use Docker verifier gates for serious checks",
      command: "npm run docker:professor",
      reason: "Web runtime status is not evidence; verifier claims still need concrete no-network engine runs."
    });
  }
  return recommendations;
}

function classifyPortOwner(owners) {
  const names = owners.map((owner) => owner.processName.toLowerCase());
  if (names.some((name) => name.includes("docker") || name.includes("com.docker"))) {
    return "docker";
  }
  if (names.some((name) => name === "node.exe" || name === "node")) {
    return "node";
  }
  if (owners.length === 0) {
    return "none";
  }
  return "other";
}

function staticAssetCurrent(localScriptSrc, remoteScriptSrc) {
  if (!localScriptSrc || !remoteScriptSrc) {
    return "unknown";
  }
  return localScriptSrc === remoteScriptSrc;
}

function runtimeLabel(kind) {
  switch (kind) {
    case "docker-container":
      return "Docker /workspace";
    case "probable-docker-container":
      return "probable Docker/container";
    case "windows-host":
      return "Windows host repo";
    case "local-host":
      return "local host repo";
    case "legacy-local-api":
      return "legacy local API";
    case "unreachable":
      return "unreachable";
    default:
      return String(kind ?? "unknown");
  }
}

async function detectPortOwners(port, options = {}) {
  const platform = options.platform ?? process.platform;
  const runCommand = options.runCommand ?? runCommandDefault;
  if (platform === "win32") {
    return detectWindowsPortOwners(port, runCommand);
  }

  const lsof = await runCommand("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"]);
  if (!lsof.ok) {
    return [];
  }

  return lsof.stdout
    .split(/\r?\n/u)
    .slice(1)
    .map((line) => line.trim().split(/\s+/u))
    .filter((columns) => columns.length >= 2)
    .map((columns) => ({
      pid: columns[1] ?? "",
      processName: columns[0] ?? "unknown",
      command: "lsof",
      source: "lsof"
    }));
}

async function detectWindowsPortOwners(port, runCommand) {
  const netstat = await runCommand("netstat", ["-ano", "-p", "tcp"]);
  if (!netstat.ok) {
    return [];
  }

  const owners = parseWindowsNetstat(netstat.stdout, port);
  const seen = new Set();
  const output = [];
  for (const owner of owners) {
    if (seen.has(owner.pid)) {
      continue;
    }
    seen.add(owner.pid);
    const task = await runCommand("tasklist", ["/FI", `PID eq ${owner.pid}`, "/FO", "CSV", "/NH"]);
    const taskInfo = task.ok ? parseTasklistCsv(task.stdout) : undefined;
    output.push({
      ...owner,
      processName: taskInfo?.processName ?? owner.processName
    });
  }

  return output;
}

async function fetchJson(url, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json"
      }
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, error: text.slice(0, 300) };
    }
    return { ok: true, status: response.status, json: JSON.parse(text) };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchText(url, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(url);
    const text = await response.text();
    return response.ok
      ? { ok: true, status: response.status, text }
      : { ok: false, status: response.status, error: text.slice(0, 300), text: "" };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error), text: "" };
  }
}

async function readLocalScriptSrc(root, readFileImpl = readFile) {
  try {
    const html = await readFileImpl(resolve(root, "apps/web/index.html"), "utf8");
    return parseIndexScriptSrc(html);
  } catch {
    return undefined;
  }
}

async function runCommandDefault(command, args) {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8",
      windowsHide: true
    });
    return { ok: true, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  } catch (error) {
    return {
      ok: false,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function printDoctorReport(report) {
  console.log("Truth Harness web runtime doctor");
  console.log("");
  console.log(`Target: ${report.target.baseUrl}/`);
  console.log(`Expected repo: ${report.target.expectedRoot}`);
  console.log("");
  console.log("Port owner");
  if (report.portOwners.length === 0) {
    console.log("  No listener detected by the local process probe.");
  } else {
    for (const owner of report.portOwners) {
      console.log(`  ${owner.processName} (pid ${owner.pid}) via ${owner.source}`);
    }
  }
  console.log("");
  console.log("Runtime");
  console.log(`  Status:       ${report.assessment.status}`);
  console.log(`  Runtime:      ${report.assessment.runtimeLabel}`);
  console.log(`  Project root: ${portablePath(report.assessment.projectRoot)}`);
  console.log(`  API current:  ${yesNo(report.assessment.apiCurrent)}`);
  console.log(`  Static UI:    ${formatStaticCurrent(report.assessment.staticCurrent)}`);
  if (report.staticAssets.localScriptSrc || report.staticAssets.remoteScriptSrc) {
    console.log(`  Local script: ${report.staticAssets.localScriptSrc ?? "not found"}`);
    console.log(`  Served script:${report.staticAssets.remoteScriptSrc ? ` ${report.staticAssets.remoteScriptSrc}` : " not reported"}`);
  }
  console.log("");
  console.log("Diagnosis");
  console.log(`  ${report.assessment.summary}`);
  console.log("");
  console.log("Recommended next commands");
  for (const recommendation of report.assessment.recommendations) {
    console.log(`  ${recommendation.title}`);
    console.log(`    ${recommendation.command}`);
    console.log(`    ${recommendation.reason}`);
  }
  console.log("");
  console.log("Boundaries");
  for (const boundary of report.assessment.boundaries) {
    console.log(`  - ${boundary}`);
  }
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || index === args.length - 1) {
    return undefined;
  }
  return args[index + 1];
}

function positiveInteger(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function portablePath(value) {
  return String(value ?? "").replace(/\\/gu, "/");
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function formatStaticCurrent(value) {
  if (value === true) {
    return "current";
  }
  if (value === false) {
    return "stale/mismatch";
  }
  return "unknown";
}

function localAddressUsesPort(address, port) {
  const normalized = address.trim();
  if (normalized.endsWith(`:${port}`)) {
    return true;
  }
  return normalized.endsWith(`]:${port}`);
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      if (character === '"') {
        quoted = false;
        continue;
      }
      current += character;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current);
  return cells;
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
