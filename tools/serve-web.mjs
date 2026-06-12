import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve("apps/web");
const projectRoot = resolve(".");
const MAX_JSON_BODY_BYTES = 16 * 1024;
let coreModulePromise;
const args = new Map(
  process.argv.slice(2).flatMap((arg, index, values) => {
    if (!arg.startsWith("--")) {
      return [];
    }
    const next = values[index + 1];
    return [[arg.slice(2), next && !next.startsWith("--") ? next : "true"]];
  })
);
const host = args.get("host") ?? "127.0.0.1";
const port = Number(args.get("port") ?? "4180");
const allowNonLocalWeb = isTruthyEnv(process.env.THEOREM_WEB_ALLOW_NONLOCAL);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (requestUrl.pathname.startsWith("/api/")) {
      if (!guardApiRequest(request, response)) {
        return;
      }
      await handleApiRequest(request, response, requestUrl);
      return;
    }

    const filePath = await resolveRequestPath(requestUrl.pathname);
    setWebSecurityHeaders(response);
    response.setHeader("Content-Type", mimeTypes.get(extname(filePath)) ?? "application/octet-stream");
    createReadStream(filePath).pipe(response);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) {
      console.error(error);
    }
    setWebSecurityHeaders(response);
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(status === 404 ? "Not found" : "Server error");
  }
});

server.listen(port, host, () => {
  console.log(`Theorem Workbench web: http://${host}:${port}`);
});

async function resolveRequestPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded.replace(/^\/+/, "")) || "index.html";
  let candidate = resolve(root, relative);
  if (candidate === root || decoded.endsWith("/")) {
    candidate = join(candidate, "index.html");
  }

  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) {
    throw new HttpError(404);
  }

  const info = await stat(candidate);
  if (info.isDirectory()) {
    return join(candidate, "index.html");
  }
  if (!info.isFile()) {
    throw new HttpError(404);
  }
  return candidate;
}

async function handleApiRequest(request, response, requestUrl) {
  if (requestUrl.pathname === "/api/status" && request.method === "GET") {
    const codeRunSandbox = await readCodeRunSandboxStatus();
    const verification = await readVerificationEngineStatus();
    const mcpCodeRunExposed = isTruthyEnv(process.env.THEOREM_ALLOW_CODE_RUN);
    const unsandboxedCodeRunAllowed = isTruthyEnv(process.env.THEOREM_ALLOW_UNSANDBOXED_CODE_RUN);
    const webServer = webServerSafetyStatus();

    writeJson(response, 200, {
      schemaVersion: "theorem.web-status.v0",
      localOnly: true,
      externalCalls: false,
      api: "local-node",
      engine: "@theorem-workbench/core",
      safety: {
        status: codeRunSandbox.canAttestNetworkNone ? "sandbox-attested" : "sandbox-unavailable",
        codeRunSandbox,
        mcpCodeRun: {
          exposed: mcpCodeRunExposed,
          unsandboxedAllowed: unsandboxedCodeRunAllowed,
          requiredForExecution: mcpCodeRunExposed ? "policy.allowedExecutables" : "THEOREM_ALLOW_CODE_RUN=1",
          recommendation: codeRunSandbox.canAttestNetworkNone
            ? "Prefer policy.requireSandbox=true for agent-triggered code runs."
            : "Keep MCP code execution disabled or require a measured sandbox before running untrusted commands."
        },
        webServer,
        privacy: {
          localApiOnly: true,
          hostedModelCalls: false,
          selectedContextRequiredForExternalModels: true
        }
      },
      verification,
      capabilities: [
        "receipt-create",
        "claim-ledger",
        "trace-render",
        "activity-log",
        "agent-runbook",
        "research-session",
        "validation-plan",
        "verification-readiness",
        "sandbox-status",
        "safety-center"
      ]
    });
    return;
  }

  if (requestUrl.pathname === "/api/claims" && request.method === "GET") {
    const snapshot = await readClaimLedgerSnapshot();
    writeJson(response, 200, {
      schemaVersion: "theorem.web-claims-response.v0",
      localOnly: true,
      externalCalls: [],
      ...snapshot
    });
    return;
  }

  if (requestUrl.pathname === "/api/claims" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { writeClaimLedgerRecord } = await loadCoreModule();
      const result = await writeClaimLedgerRecord({
        rootPath: projectRoot,
        title: optionalText(input.title),
        statement: String(input.statement ?? "").trim(),
        domain: optionalText(input.domain),
        status: optionalText(input.status),
        trust: optionalText(input.trust),
        tags: stringList(input.tags),
        dependsOn: stringList(input.dependsOn),
        supersedes: stringList(input.supersedes),
        derivedBy: optionalText(input.derivedBy),
        authors: stringList(input.authors),
        evidenceRefs: evidenceRefList(input.evidenceRefs),
        nextChecks: stringList(input.nextChecks)
      });
      const snapshot = await readClaimLedgerSnapshot();
      writeJson(response, 200, {
        schemaVersion: "theorem.web-claim-write-response.v0",
        localOnly: true,
        externalCalls: [],
        claim: result.claim,
        paths: {
          json: result.jsonPath,
          markdown: result.markdownPath
        },
        ...snapshot,
        activity: [
          {
            actor: "local-api",
            action: "created-claim-ledger-record",
            detail: `${result.claim.claimId} written to the local .theorem-workbench claim ledger.`,
            at: result.claim.createdAt
          }
        ]
      });
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "Claim ledger write failed."
      });
    }
    return;
  }

  const claimReadMatch = requestUrl.pathname.match(/^\/api\/claims\/([^/]+)$/u);
  if (claimReadMatch && request.method === "GET") {
    try {
      const { readClaimRecord } = await loadCoreModule();
      await ensureLocalWorkspace();
      const claim = await readClaimRecord(projectRoot, decodeURIComponent(claimReadMatch[1]));
      writeJson(response, 200, {
        schemaVersion: "theorem.web-claim-response.v0",
        localOnly: true,
        externalCalls: [],
        claim
      });
    } catch (error) {
      writeJson(response, 404, {
        error: error instanceof Error ? error.message : "Claim not found."
      });
    }
    return;
  }

  if (requestUrl.pathname === "/api/receipt" && request.method === "POST") {
    const receivedAt = new Date().toISOString();
    const input = await readJsonBody(request);
    const problem = typeof input.problem === "string" ? input.problem.trim() : "";
    if (!problem) {
      writeJson(response, 400, {
        error: "problem is required"
      });
      return;
    }

    const { createReceipt } = await loadCoreModule();
    const receipt = createReceipt(problem);
    const completedAt = new Date().toISOString();
    writeJson(response, 200, {
      schemaVersion: "theorem.web-receipt-response.v0",
      localOnly: true,
      externalCalls: [],
      receipt,
      activity: [
        {
          actor: "web-ui",
          action: "submitted-local-problem",
          detail: "Browser submitted selected prompt text to the local Theorem Workbench API.",
          at: receivedAt
        },
        {
          actor: "local-api",
          action: "created-receipt",
          detail: "The local API called @theorem-workbench/core createReceipt without a hosted model or external service.",
          at: completedAt
        }
      ]
    });
    return;
  }

  writeJson(response, 404, {
    error: "unknown API route"
  });
}

async function readClaimLedgerSnapshot() {
  const { createClaimLedgerGraph, listClaimRecords } = await loadCoreModule();
  await ensureLocalWorkspace();
  const claims = await listClaimRecords(projectRoot);
  return {
    claims,
    graph: createClaimLedgerGraph(claims)
  };
}

async function ensureLocalWorkspace() {
  const { initLocalWorkspace } = await loadCoreModule();
  await initLocalWorkspace(projectRoot, {
    displayName: "Theorem Workbench Local Web Session"
  });
}

function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function evidenceRefList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      kind: optionalText(item.kind) ?? "other",
      ref: optionalText(item.ref) ?? "",
      trust: optionalText(item.trust),
      summary: optionalText(item.summary)
    }))
    .filter((item) => item.ref);
}

function guardApiRequest(request, response) {
  if (!isAllowedLocalHostHeader(request.headers.host)) {
    writeJson(response, 403, {
      error: "non-local API host rejected"
    });
    return false;
  }

  if (!isReadMethod(request.method) && !isAllowedSameOriginWrite(request)) {
    writeJson(response, 403, {
      error: "cross-origin API write rejected"
    });
    return false;
  }

  return true;
}

function isReadMethod(method) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function isAllowedLocalHostHeader(hostHeader) {
  if (allowNonLocalWeb) {
    return true;
  }

  const hostname = parseHostHeader(hostHeader);
  return isLocalHostname(hostname);
}

function isAllowedSameOriginWrite(request) {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return ["http:", "https:"].includes(originUrl.protocol)
      && originUrl.host === request.headers.host
      && isAllowedLocalHostHeader(originUrl.host);
  } catch {
    return false;
  }
}

function parseHostHeader(hostHeader) {
  if (!hostHeader) {
    return "";
  }

  if (hostHeader.startsWith("[")) {
    const end = hostHeader.indexOf("]");
    return end === -1 ? hostHeader : hostHeader.slice(1, end);
  }

  return hostHeader.split(":")[0] ?? "";
}

function isLocalHostname(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function webServerSafetyStatus() {
  return {
    schemaVersion: "theorem.web-server-safety.v0",
    bindHost: host,
    port,
    localHostGuard: !allowNonLocalWeb,
    sameOriginWritesOnly: true,
    securityHeaders: true,
    recommendation: allowNonLocalWeb
      ? "Non-local web access was explicitly enabled; do not expose this server to untrusted networks."
      : "The local API rejects non-local Host headers and cross-origin browser writes."
  };
}

async function readCodeRunSandboxStatus() {
  try {
    const { getCodeRunSandboxStatus } = await loadCoreModule();
    return getCodeRunSandboxStatus();
  } catch (error) {
    return {
      schemaVersion: "theorem.code-run-sandbox-status.v0",
      platform: process.platform,
      available: false,
      provider: "none",
      processSandbox: "none",
      networkIsolation: "not-enforced",
      filesystemIsolation: "working-directory-only",
      canAttestNetworkNone: false,
      reason: `Sandbox status unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      notes: [
        "The local web status endpoint could not load the core sandbox detector.",
        "Treat agent-triggered code execution as unavailable until the local API reports a measured sandbox.",
        "Receipt creation can still run, but code-run networkAccess none must not be claimed from this process."
      ]
    };
  }
}

async function readVerificationEngineStatus() {
  try {
    const {
      getCasBackendStatus,
      getProofBackendStatus,
      getSmtBackendStatus
    } = await loadCoreModule();
    const timeoutMs = 1500;
    const cas = getCasBackendStatus({ timeoutMs });
    const proof = getProofBackendStatus({ timeoutMs });
    const smt = getSmtBackendStatus({ timeoutMs });
    const engines = [
      engineProbeRow({
        lane: "Symbolic CAS",
        command: "theorem cas backends",
        trustBoundary: "Can support `cross-checked` only after a concrete independent Maxima agreement run.",
        probe: cas.backends[0]
      }),
      engineProbeRow({
        lane: "Formal proof",
        command: "theorem proof backends",
        trustBoundary: "Can support `proved` only after Lean accepts a concrete proof artifact.",
        probe: proof.backends[0]
      }),
      engineProbeRow({
        lane: "SMT solver",
        command: "theorem smt backends",
        trustBoundary: "Can support `smt-checked` only after Z3 returns sat or unsat for a concrete SMT-LIB artifact.",
        probe: smt.backends[0]
      })
    ];
    const readyCount = engines.filter((engine) => engine.status === "available").length;

    return {
      schemaVersion: "theorem.verification-readiness.v0",
      createdAt: new Date().toISOString(),
      localOnly: true,
      networkAccess: "none",
      status: readyCount === engines.length ? "ready" : readyCount > 0 ? "partial" : "missing",
      readyCount,
      totalCount: engines.length,
      engines,
      trustBoundary: {
        statusProbeIsNotEvidence: true,
        crossCheckedRequiresIndependentAgreementRun: true,
        smtCheckedRequiresConcreteSolverRun: true,
        provedRequiresAcceptedProofCheckerRun: true
      },
      warnings: [
        ...cas.warnings,
        ...proof.warnings,
        ...smt.warnings
      ],
      reports: {
        cas,
        proof,
        smt
      }
    };
  } catch (error) {
    return {
      schemaVersion: "theorem.verification-readiness.v0",
      createdAt: new Date().toISOString(),
      localOnly: true,
      networkAccess: "none",
      status: "error",
      readyCount: 0,
      totalCount: 3,
      engines: [],
      trustBoundary: {
        statusProbeIsNotEvidence: true,
        crossCheckedRequiresIndependentAgreementRun: true,
        smtCheckedRequiresConcreteSolverRun: true,
        provedRequiresAcceptedProofCheckerRun: true
      },
      warnings: [
        `Verification readiness unavailable: ${error instanceof Error ? error.message : "unknown error"}`
      ]
    };
  }
}

function engineProbeRow(input) {
  const probe = input.probe ?? {};

  return {
    id: probe.backendId ?? "unknown",
    displayName: probe.displayName ?? "Unknown backend",
    lane: input.lane,
    adapter: probe.adapter ?? "unknown",
    role: probe.role ?? "checker",
    status: probe.status ?? "missing",
    command: input.command,
    executable: probe.command ?? "not configured",
    version: probe.version,
    localOnly: probe.localOnly === true,
    networkAccess: probe.networkAccess ?? "unknown",
    acceptedProofChecker: probe.acceptedProofChecker === true,
    statusProbeMintedEvidence: false,
    canRun: Boolean(probe.canCheckSymbolic ?? probe.canCheckProofs ?? probe.canCheckSmt),
    trustBoundary: input.trustBoundary,
    note: Array.isArray(probe.limitations) && probe.limitations.length > 0
      ? probe.limitations[0]
      : "Backend status probe did not return a limitation note."
  };
}

function loadCoreModule() {
  coreModulePromise ??= import(pathToFileURL(resolve("packages/core/dist/index.js")).href);
  return coreModulePromise;
}

function isTruthyEnv(value) {
  return /^(1|true|yes|on)$/iu.test(value ?? "");
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let byteLength = 0;

    request.on("data", (chunk) => {
      byteLength += chunk.length;
      if (byteLength > MAX_JSON_BODY_BYTES) {
        rejectBody(new HttpError(413));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new HttpError(400));
      }
    });

    request.on("error", rejectBody);
  });
}

function writeJson(response, status, payload) {
  response.writeHead(status, {
    ...webSecurityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function setWebSecurityHeaders(response) {
  for (const [key, value] of Object.entries(webSecurityHeaders())) {
    response.setHeader(key, value);
  }
}

function webSecurityHeaders() {
  return {
    "Content-Security-Policy": "default-src 'self'; base-uri 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self'",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  };
}

class HttpError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}
