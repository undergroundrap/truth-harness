import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { extname, join, normalize, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const MAX_JSON_BODY_BYTES = 128 * 1024;
const MAX_RESEARCH_MAP_SNAPSHOTS = 100;
const VISUAL_ARTIFACT_KINDS = new Set([
  "plot",
  "proof-tree",
  "lineage-graph",
  "mind-map",
  "concept-map",
  "simulation-view",
  "notebook-output",
  "teaching-animation",
  "report-figure"
]);
const VISUAL_ARTIFACT_RENDERERS = new Set([
  "truth-harness-native",
  "plotly",
  "graphviz",
  "mermaid",
  "tldraw",
  "manim",
  "sage",
  "matplotlib",
  "external-file"
]);
const VISUAL_PAYLOAD_FORMATS = new Set([
  "svg",
  "plotly-json",
  "graph-json",
  "canvas-json",
  "html",
  "png-ref",
  "table-json"
]);
const VISUAL_RENDERER_SOURCE_LANGUAGES = new Set([
  "mermaid",
  "dot",
  "plotly-json",
  "python",
  "tldraw-json",
  "svg",
  "html",
  "text"
]);
const VISUAL_SOURCE_KINDS = new Set([
  "visual",
  "receipt",
  "claim",
  "route",
  "proof",
  "smt",
  "cas",
  "notebook",
  "simulation",
  "experiment",
  "source",
  "workspace-graph",
  "workspace-review",
  "manual"
]);
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
const root = resolve(args.get("web-root") ?? "apps/web");
const projectRoot = resolve(args.get("project-root") ?? ".");
const coreModulePath = args.get("core-module") ?? process.env.TRUTH_HARNESS_WEB_CORE_MODULE ?? "packages/core/dist/index.js";
const host = args.get("host") ?? "127.0.0.1";
const port = Number(args.get("port") ?? "4180");
const allowNonLocalWeb = isTruthyEnv(process.env.TRUTH_HARNESS_WEB_ALLOW_NONLOCAL);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

const server = createServer(async (request, response) => {
  response.truthHarnessRequestId = `web_req_${randomUUID()}`;
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
    if (request.url?.startsWith("/api/")) {
      writeApiError(response, status, error instanceof HttpError ? error.message : "internal server error", request);
      return;
    }

    setWebSecurityHeaders(response);
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(status === 404 ? "Not found" : "Server error");
  }
});

server.listen(port, host, () => {
  console.log(`Truth Harness web: http://${host}:${port}`);
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
    const engineManifest = await readEngineManifest();
    const verification = await readVerificationEngineStatus();
    const mcpCodeRunExposed = isTruthyEnv(process.env.TRUTH_HARNESS_ALLOW_CODE_RUN);
    const unsandboxedCodeRunAllowed = isTruthyEnv(process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN);
    const webServer = webServerSafetyStatus();

    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-status.v0",
      localOnly: true,
      externalCalls: false,
      api: "local-node",
      engine: "@truth-harness/core",
      safety: {
        status: codeRunSandbox.canAttestNetworkNone ? "sandbox-attested" : "sandbox-unavailable",
        codeRunSandbox,
        mcpCodeRun: {
          exposed: mcpCodeRunExposed,
          unsandboxedAllowed: unsandboxedCodeRunAllowed,
          requiredForExecution: mcpCodeRunExposed ? "policy.allowedExecutables" : "TRUTH_HARNESS_ALLOW_CODE_RUN=1",
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
      engineManifest,
      verification,
      dockerVerifier: dockerVerifierGuidance(verification),
      capabilities: [
        "receipt-create",
        "claim-ledger",
        "trace-render",
        "activity-log",
        "agent-runbook",
        "research-session",
        "research-session-list",
        "research-map",
        "visual-artifacts",
        "catalog-search",
        "workspace-events",
        "validation-plan",
        "engine-manifest",
        "verification-readiness",
        "workspace-review-queue",
        "workspace-run-next-dry-run",
        "docker-verifier-guidance",
        "sandbox-status",
        "safety-center",
        "workspace-maintenance"
      ]
    });
    return;
  }

  if (requestUrl.pathname === "/api/catalog/status" && request.method === "GET") {
    const { getWorkspaceCatalogStatus } = await loadCoreModule();
    await ensureLocalWorkspace();
    const catalog = await getWorkspaceCatalogStatus(projectRoot, { checkFiles: true });
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-catalog-status-response.v0",
      localOnly: true,
      externalCalls: [],
      catalog
    });
    return;
  }

  if (requestUrl.pathname === "/api/catalog/rebuild" && request.method === "POST") {
    try {
      const { getWorkspaceCatalogStatus, rebuildWorkspaceCatalog } = await loadCoreModule();
      await ensureLocalWorkspace();
      const rebuild = await rebuildWorkspaceCatalog({ rootPath: projectRoot });
      const catalog = await getWorkspaceCatalogStatus(projectRoot, { checkFiles: true });
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-catalog-rebuild-response.v0",
        localOnly: true,
        externalCalls: [],
        rebuild,
        catalog,
        activity: [
          {
            actor: "local-api",
            action: "rebuilt-catalog",
            detail: `${rebuild.artifactCount} artifacts indexed into .truth-harness/indexes/catalog.db. Canonical JSON remains the source of truth.`,
            at: rebuild.rebuiltAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Catalog rebuild failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/catalog/search" && request.method === "GET") {
    try {
      const { searchWorkspaceCatalog } = await loadCoreModule();
      await ensureLocalWorkspace();
      const query = optionalText(requestUrl.searchParams.get("query"));
      const kind = optionalText(requestUrl.searchParams.get("kind"));
      const trust = optionalText(requestUrl.searchParams.get("trust"));
      const domain = optionalText(requestUrl.searchParams.get("domain"));
      const tag = optionalText(requestUrl.searchParams.get("tag"));
      const limit = boundedPositiveNumberOrUndefined(requestUrl.searchParams.get("limit"), 200);
      const search = await searchWorkspaceCatalog({
        rootPath: projectRoot,
        query,
        kind,
        trust,
        domain,
        tag,
        limit
      });
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-catalog-search-response.v0",
        localOnly: true,
        externalCalls: [],
        search
      });
    } catch (error) {
      writeApiError(response, 409, error instanceof Error ? error.message : "Catalog search failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/events" && request.method === "GET") {
    try {
      const { listWorkspaceEvents } = await loadCoreModule();
      await ensureLocalWorkspace();
      const limit = boundedPositiveNumberOrUndefined(requestUrl.searchParams.get("limit"), 1_000) ?? 100;
      const eventLog = await listWorkspaceEvents(projectRoot, limit);
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-events-response.v0",
        localOnly: true,
        externalCalls: [],
        eventLog
      });
    } catch (error) {
      writeApiError(response, 409, error instanceof Error ? error.message : "Workspace event log read failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/workspace-maintenance" && request.method === "GET") {
    try {
      const maintenance = await readWorkspaceMaintenance();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-workspace-maintenance-response.v0",
        localOnly: true,
        externalCalls: [],
        maintenance
      });
    } catch (error) {
      writeApiError(response, 409, error instanceof Error ? error.message : "Workspace maintenance read failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/workspace-maintenance/repair-artifacts" && request.method === "POST") {
    try {
      const input = await readJsonBody(request);
      const { repairWorkspaceArtifacts } = await loadCoreModule();
      await ensureLocalWorkspace();
      const repair = await repairWorkspaceArtifacts({
        rootPath: projectRoot,
        dryRun: input.preview === true || input.dryRun === true
      });
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-workspace-artifact-repair-response.v0",
        localOnly: true,
        externalCalls: [],
        repair,
        activity: [
          {
            actor: "local-api",
            action: repair.dryRun ? "previewed-artifact-repair" : "repaired-artifact-metadata",
            detail: `${repair.actions.length} local artifact metadata action${repair.actions.length === 1 ? "" : "s"} ${repair.dryRun ? "previewed" : "applied"} without changing trust labels.`,
            at: new Date().toISOString()
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Workspace artifact repair failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/workspace-maintenance/clean" && request.method === "POST") {
    try {
      const input = await readJsonBody(request);
      const { cleanLocalWorkspace } = await loadCoreModule();
      await ensureLocalWorkspace();
      const targets = normalizeWorkspaceCleanTargets(input.targets);
      const clean = await cleanLocalWorkspace({
        rootPath: projectRoot,
        targets,
        dryRun: input.confirmDelete !== true
      });
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-workspace-clean-response.v0",
        localOnly: true,
        externalCalls: [],
        clean,
        activity: [
          {
            actor: "local-api",
            action: clean.dryRun ? "previewed-workspace-clean" : "cleaned-workspace",
            detail: clean.dryRun
              ? `${clean.entries.length} .truth-harness director${clean.entries.length === 1 ? "y" : "ies"} previewed; no files deleted.`
              : `${clean.deletedFiles} scratch file${clean.deletedFiles === 1 ? "" : "s"} deleted from selected .truth-harness directories.`,
            at: new Date().toISOString()
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Workspace cleanup failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/workspace-maintenance/archive" && request.method === "POST") {
    try {
      const input = await readJsonBody(request);
      const { archiveLocalWorkspace } = await loadCoreModule();
      await ensureLocalWorkspace();
      const targets = normalizeWorkspaceCleanTargets(input.targets);
      const archive = await archiveLocalWorkspace({
        rootPath: projectRoot,
        targets,
        reason: typeof input.reason === "string" && input.reason.trim() ? input.reason.trim() : "web workspace maintenance"
      });
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-workspace-archive-response.v0",
        localOnly: true,
        externalCalls: [],
        archive,
        activity: [
          {
            actor: "local-api",
            action: "archived-workspace",
            detail: `${archive.archivedFiles} file${archive.archivedFiles === 1 ? "" : "s"} copied into ${archive.archiveDir}; no files deleted.`,
            at: new Date().toISOString()
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Workspace archive failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/claims" && request.method === "GET") {
    const snapshot = await readClaimLedgerSnapshot();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-claims-response.v0",
      localOnly: true,
      externalCalls: [],
      ...snapshot
    });
    return;
  }

  if (requestUrl.pathname === "/api/routes" && request.method === "GET") {
    const routes = await readRouteLedgerSnapshot();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-routes-response.v0",
      localOnly: true,
      externalCalls: [],
      routes
    });
    return;
  }

  if (requestUrl.pathname === "/api/sessions" && request.method === "GET") {
    const sessions = await readResearchSessionSnapshot();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-sessions-response.v0",
      localOnly: true,
      externalCalls: [],
      sessions
    });
    return;
  }

  if (requestUrl.pathname === "/api/workspace-review" && request.method === "GET") {
    const { createWorkspaceReview } = await loadCoreModule();
    await ensureLocalWorkspace();
    const review = await createWorkspaceReview({ rootPath: projectRoot });
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-workspace-review-response.v0",
      localOnly: true,
      externalCalls: [],
      review
    });
    return;
  }

  if (requestUrl.pathname === "/api/workspace-run-next" && request.method === "GET") {
    if (isTruthyQueryParam(requestUrl.searchParams.get("executeLocal"))) {
      writeApiError(
        response,
        400,
        "The web run-next endpoint is dry-run only. Use the CLI or MCP executeLocal gate for bounded local execution.",
        request
      );
      return;
    }

    const { createWorkspaceReview, createWorkspaceRunNextPlan } = await loadCoreModule();
    await ensureLocalWorkspace();
    const review = await createWorkspaceReview({ rootPath: projectRoot });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: projectRoot,
      review,
      executeLocal: false
    });
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-workspace-run-next-response.v0",
      localOnly: true,
      externalCalls: [],
      plan
    });
    return;
  }

  if (requestUrl.pathname === "/api/workspace-graph" && request.method === "GET") {
    const { createWorkspaceGraph } = await loadCoreModule();
    await ensureLocalWorkspace();
    const graph = await createWorkspaceGraph({ rootPath: projectRoot });
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-workspace-graph-response.v0",
      localOnly: true,
      externalCalls: [],
      graph
    });
    return;
  }

  if (requestUrl.pathname === "/api/workspace-readiness" && request.method === "GET") {
    const readiness = await readWorkspaceReadiness();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-workspace-readiness-response.v0",
      localOnly: true,
      externalCalls: [],
      readiness
    });
    return;
  }

  if (requestUrl.pathname === "/api/research-map" && request.method === "GET") {
    await ensureLocalWorkspace();
    const map = await readResearchMapRecord();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-research-map-response.v0",
      localOnly: true,
      externalCalls: [],
      map,
      paths: {
        json: researchMapPath()
      }
    });
    return;
  }

  if (requestUrl.pathname === "/api/research-map" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      await ensureLocalWorkspace();
      const snapshot = normalizeResearchMapSnapshot(input.snapshot ?? input);
      const map = await appendResearchMapSnapshot(snapshot);
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-research-map-write-response.v0",
        localOnly: true,
        externalCalls: [],
        map,
        snapshot,
        paths: {
          json: researchMapPath()
        },
        activity: [
          {
            actor: "local-api",
            action: "saved-research-map",
            detail: `${snapshot.snapshotId} saved ${snapshot.nodes.length} nodes and ${snapshot.edges.length} edges to .truth-harness/artifacts/research-map.json.`,
            at: snapshot.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Research map save failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/visuals" && request.method === "GET") {
    const { listVisualArtifacts } = await loadCoreModule();
    await ensureLocalWorkspace();
    const visuals = await listVisualArtifacts(projectRoot);
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-visual-artifacts-response.v0",
      localOnly: true,
      externalCalls: [],
      visuals
    });
    return;
  }

  if (requestUrl.pathname === "/api/visuals" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { writeVisualArtifact } = await loadCoreModule();
      await ensureLocalWorkspace();
      const result = await writeVisualArtifact(normalizeVisualArtifactInput(input));
      const visuals = await listVisualArtifactsSafe();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-visual-artifact-write-response.v0",
        localOnly: true,
        externalCalls: [],
        visual: result.visual,
        paths: {
          json: result.jsonPath,
          markdown: result.markdownPath
        },
        visuals,
        activity: [
          {
            actor: "local-api",
            action: "saved-visual-artifact",
            detail: `${result.visual.visualId} saved ${result.visual.kind} visual to .truth-harness/visuals without changing any trust label.`,
            at: result.visual.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Visual artifact save failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/visuals/graph" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { writeWorkspaceGraphVisualArtifact } = await loadCoreModule();
      await ensureLocalWorkspace();
      const renderer = parseGraphVisualRenderer(optionalText(input?.renderer) ?? "graphviz");
      const result = await writeWorkspaceGraphVisualArtifact({
        rootPath: projectRoot,
        renderer,
        title: optionalText(input?.title),
        maxNodes: boundedPositiveNumberOrUndefined(input?.maxNodes, 500)
      });
      const visuals = await listVisualArtifactsSafe();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-visual-graph-response.v0",
        localOnly: true,
        externalCalls: [],
        renderer,
        visual: result.visual,
        paths: {
          json: result.jsonPath,
          markdown: result.markdownPath
        },
        visuals,
        activity: [
          {
            actor: "local-api",
            action: "saved-workspace-graph-visual",
            detail: `${result.visual.visualId} saved a ${renderer} workspace graph visual from the local evidence graph.`,
            at: result.visual.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Visual graph artifact save failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/visuals/plot" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { writeReceiptPlotVisualArtifact } = await loadCoreModule();
      await ensureLocalWorkspace();
      const renderer = parsePlotVisualRenderer(optionalText(input?.renderer) ?? "plotly");
      const result = await writeReceiptPlotVisualArtifact({
        rootPath: projectRoot,
        receiptPath: optionalText(input?.receiptPath),
        problem: optionalText(input?.problem),
        renderer,
        title: optionalText(input?.title)
      });
      const visuals = await listVisualArtifactsSafe();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-visual-plot-response.v0",
        localOnly: true,
        externalCalls: [],
        renderer,
        visual: result.visual,
        paths: {
          json: result.jsonPath,
          markdown: result.markdownPath
        },
        visuals,
        activity: [
          {
            actor: "local-api",
            action: "saved-receipt-plot-visual",
            detail: `${result.visual.visualId} saved a ${renderer} plot source visual from receipt data.`,
            at: result.visual.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Visual plot artifact save failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/visuals/canvas" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { writeResearchCanvasVisualArtifact } = await loadCoreModule();
      await ensureLocalWorkspace();
      const result = await writeResearchCanvasVisualArtifact({
        rootPath: projectRoot,
        title: optionalText(input?.title),
        maxNodes: boundedPositiveNumberOrUndefined(input?.maxNodes, 500)
      });
      const visuals = await listVisualArtifactsSafe();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-visual-canvas-response.v0",
        localOnly: true,
        externalCalls: [],
        renderer: "tldraw",
        visual: result.visual,
        paths: {
          json: result.jsonPath,
          markdown: result.markdownPath
        },
        visuals,
        activity: [
          {
            actor: "local-api",
            action: "saved-research-canvas-visual",
            detail: `${result.visual.visualId} saved an editable research canvas seed from the local evidence graph.`,
            at: result.visual.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Visual canvas artifact save failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/visuals/render" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { renderGraphvizVisualArtifact, renderPlotlyVisualArtifact } = await loadCoreModule();
      await ensureLocalWorkspace();
      const engine = optionalText(input?.engine) ?? "graphviz";
      if (engine !== "graphviz" && engine !== "plotly") {
        throw new Error(`Unsupported visual render engine: ${engine}`);
      }
      const visualRef = boundedText(input?.visualRef, "", 240);
      if (!visualRef) {
        throw new Error("visualRef is required.");
      }
      const result = engine === "graphviz"
        ? await renderGraphvizVisualArtifact({
            rootPath: projectRoot,
            visualRef,
            title: optionalText(input?.title),
            timeoutMs: positiveNumberOrUndefined(input?.timeoutMs)
          })
        : await renderPlotlyVisualArtifact({
            rootPath: projectRoot,
            visualRef,
            title: optionalText(input?.title)
          });
      const visuals = await listVisualArtifactsSafe();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-visual-render-response.v0",
        localOnly: true,
        externalCalls: [],
        renderer: engine,
        visual: result.visual,
        sourceVisual: result.sourceVisual,
        sourceVisualRef: result.sourceVisualRef,
        paths: {
          json: result.jsonPath,
          markdown: result.markdownPath
        },
        visuals,
        activity: [
          {
            actor: "local-api",
            action: "rendered-visual-artifact",
            detail: `${result.sourceVisual.visualId} rendered into ${result.visual.visualId} with local ${engine}.`,
            at: result.visual.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Visual artifact render failed.", request);
    }
    return;
  }

  const visualReadMatch = requestUrl.pathname.match(/^\/api\/visuals\/([^/]+)$/u);
  if (visualReadMatch && request.method === "GET") {
    try {
      const { readVisualArtifact } = await loadCoreModule();
      await ensureLocalWorkspace();
      const visual = await readVisualArtifact(projectRoot, decodeURIComponent(visualReadMatch[1]));
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-visual-artifact-response.v0",
        localOnly: true,
        externalCalls: [],
        visual
      });
    } catch (error) {
      writeApiError(response, 404, error instanceof Error ? error.message : "Visual artifact not found.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/cas" && request.method === "GET") {
    const checks = await readCasCheckSnapshot();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-cas-list-response.v0",
      localOnly: true,
      externalCalls: [],
      checks
    });
    return;
  }

  if (requestUrl.pathname === "/api/smt" && request.method === "GET") {
    const checks = await readSmtCheckSnapshot();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-smt-list-response.v0",
      localOnly: true,
      externalCalls: [],
      checks
    });
    return;
  }

  if (requestUrl.pathname === "/api/smt/solve" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { solveSmtProblem } = await loadCoreModule();
      const variables = stringList(input.variables);
      const constraints = stringList(input.constraints);
      const timeoutMs = Number.isFinite(input.timeoutMs) ? Number(input.timeoutMs) : undefined;

      await ensureLocalWorkspace();
      const result = await solveSmtProblem({
        rootPath: projectRoot,
        queryName: optionalText(input.queryName),
        variables,
        constraints,
        includeModel: input.includeModel === true,
        z3Command: optionalText(input.z3Command),
        timeoutMs
      });
      const checks = await readSmtCheckSnapshot();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-smt-solve-response.v0",
        localOnly: true,
        externalCalls: [],
        problem: result.problem,
        sourcePath: result.sourcePath,
        sourceRef: result.sourceRef,
        record: result.check.record,
        paths: {
          json: result.check.jsonPath,
          markdown: result.check.markdownPath
        },
        checks,
        activity: [
          {
            actor: "local-api",
            action: "created-smt-check",
            detail: `${result.check.record.checkId} wrote ${result.check.record.status} Z3 SMT record with trust ${result.check.record.trust}.`,
            at: result.check.record.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "SMT solve failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/cas/check" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { writeSymbolicCasCheckRecord } = await loadCoreModule();
      const operation = parseCasOperation(input.operation);
      const expression = requiredText(input.expression, "expression");
      const result = requiredText(input.result, "result");
      const variable = optionalText(input.variable) ?? "x";
      const timeoutMs = Number.isFinite(input.timeoutMs) ? Number(input.timeoutMs) : undefined;

      await ensureLocalWorkspace();
      const write = await writeSymbolicCasCheckRecord({
        rootPath: projectRoot,
        prompt: {
          operation,
          expression,
          variable
        },
        result,
        maximaCommand: optionalText(input.maximaCommand),
        timeoutMs
      });
      const checks = await readCasCheckSnapshot();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-cas-check-response.v0",
        localOnly: true,
        externalCalls: [],
        record: write.record,
        paths: {
          json: write.jsonPath,
          markdown: write.markdownPath
        },
        checks,
        activity: [
          {
            actor: "local-api",
            action: "created-cas-check",
            detail: `${write.record.checkId} wrote ${write.record.status} Maxima CAS record with trust ${write.record.trust}.`,
            at: write.record.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "CAS check failed.", request);
    }
    return;
  }

  const routeReadMatch = requestUrl.pathname.match(/^\/api\/routes\/([^/]+)$/u);
  if (routeReadMatch && request.method === "GET") {
    try {
      const { listVerifierRoutes, readVerifierRoute } = await loadCoreModule();
      await ensureLocalWorkspace();
      const routeRef = decodeURIComponent(routeReadMatch[1]);
      const route = await readVerifierRoute(projectRoot, routeRef);
      const summary = (await listVerifierRoutes(projectRoot)).find((item) => item.routeId === route.routeId);
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-route-response.v0",
        localOnly: true,
        externalCalls: [],
        route,
        routePaths: routePathsFor(summary?.path ?? routeRef)
      });
    } catch (error) {
      writeApiError(response, 404, error instanceof Error ? error.message : "Verifier route not found.", request);
    }
    return;
  }

  const routeSatisfyMatch = requestUrl.pathname.match(/^\/api\/routes\/([^/]+)\/obligations\/([^/]+)\/satisfy$/u);
  if (routeSatisfyMatch && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { satisfyVerifierRouteObligation } = await loadCoreModule();
      const routeRef = decodeURIComponent(routeSatisfyMatch[1]);
      const obligationId = decodeURIComponent(routeSatisfyMatch[2]);
      const routeEvidenceRef = parseRouteEvidenceRef(input.evidenceRef);
      await ensureLocalWorkspace();
      const result = await satisfyVerifierRouteObligation({
        rootPath: projectRoot,
        routeRef,
        obligationId,
        evidenceRef: routeEvidenceRef
      });
      const routes = await readRouteLedgerSnapshot();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-route-satisfy-response.v0",
        localOnly: true,
        externalCalls: [],
        route: result.route,
        obligation: result.obligation,
        evidence: result.evidence,
        message: result.message,
        routePaths: {
          json: result.jsonPath,
          markdown: result.markdownPath
        },
        routes,
        activity: [
          {
            actor: "local-api",
            action: "satisfied-route-obligation",
            detail: result.message,
            at: result.obligation.satisfiedAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Route obligation satisfaction failed.", request);
    }
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
        schemaVersion: "truth-harness.web-claim-write-response.v0",
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
            detail: `${result.claim.claimId} written to the local .truth-harness claim ledger.`,
            at: result.claim.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Claim ledger write failed.", request);
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
        schemaVersion: "truth-harness.web-claim-response.v0",
        localOnly: true,
        externalCalls: [],
        claim
      });
    } catch (error) {
      writeApiError(response, 404, error instanceof Error ? error.message : "Claim not found.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/receipt" && request.method === "POST") {
    const receivedAt = new Date().toISOString();
    const input = await readJsonBody(request);
    const problem = typeof input.problem === "string" ? input.problem.trim() : "";
    if (!problem) {
      writeApiError(response, 400, "problem is required", request);
      return;
    }

    const { writeVerifierRoute } = await loadCoreModule();
    await ensureLocalWorkspace();
    const routeWrite = await writeVerifierRoute({
      rootPath: projectRoot,
      problem
    });
    const route = routeWrite.route;
    const receipt = route.receipt;
    const receiptPaths = await writeReceiptArtifact(receipt);
    const completedAt = new Date().toISOString();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-receipt-response.v0",
      localOnly: true,
      externalCalls: [],
      route,
      routePaths: {
        json: routeWrite.jsonPath,
        markdown: routeWrite.markdownPath
      },
      receiptPaths,
      receipt,
      activity: [
        {
          actor: "web-ui",
          action: "submitted-local-problem",
          detail: "Browser submitted selected prompt text to the local Truth Harness API.",
          at: receivedAt
        },
        {
          actor: "local-api",
          action: "created-verifier-route",
          detail: `The local API selected ${route.usedCapabilities.length} verifier capabilities, recorded ${route.gaps.length} route gaps, and wrote ${route.routeId} to .truth-harness/routes.`,
          at: completedAt
        },
        {
          actor: "local-api",
          action: "persisted-receipt",
          detail: `The local API wrote ${receipt.runId} to ${receiptPaths.ref} without a hosted model or external service.`,
          at: completedAt
        }
      ]
    });
    return;
  }

  writeApiError(response, 404, "unknown API route", request);
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

async function readRouteLedgerSnapshot() {
  const { listVerifierRoutes } = await loadCoreModule();
  await ensureLocalWorkspace();
  const routes = await listVerifierRoutes(projectRoot);
  return routes.map((route) => ({
    ...route,
    routePaths: routePathsFor(route.path)
  }));
}

async function readResearchSessionSnapshot() {
  const { listResearchSessions } = await loadCoreModule();
  await ensureLocalWorkspace();
  const sessions = await listResearchSessions(projectRoot);
  return sessions.map((session) => ({
    sessionId: session.sessionId,
    projectId: session.projectId,
    title: session.title,
    objective: session.objective,
    domains: session.domains,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    privacy: session.privacy,
    modelPolicy: session.modelPolicy,
    taskCount: session.tasks?.length ?? 0,
    openTaskCount: (session.tasks ?? []).filter((task) => task.status !== "done").length,
    checkpointCount: session.checkpoints?.length ?? 0,
    evidenceRefCount: session.evidenceRefs?.length ?? 0,
    snapshotRefCount: session.snapshotRefs?.length ?? 0,
    warningCount: session.warnings?.length ?? 0
  }));
}

async function writeReceiptArtifact(receipt) {
  const workspace = await ensureLocalWorkspace();
  const { refreshWorkspaceCatalogArtifact } = await loadCoreModule();
  const receiptsDirectory = workspace.manifest.directories.receipts ?? ".truth-harness/receipts";
  const portableDirectory = portablePath(receiptsDirectory).replace(/\/+$/u, "");
  const fileName = `${receipt.createdAt.slice(0, 10)}-${receipt.runId}.json`;
  const ref = `${portableDirectory}/${fileName}`;
  const jsonPath = resolve(workspace.root, ref);
  await mkdir(resolve(workspace.root, receiptsDirectory), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: workspace.root,
    path: ref,
    kind: "receipts",
    now: receipt.createdAt,
    staleReason: "receipt artifact written"
  });

  return {
    json: jsonPath,
    ref
  };
}

async function readWorkspaceReadiness() {
  const {
    createWorkspaceGraph,
    createWorkspaceReview,
    validateWorkspaceArtifacts
  } = await loadCoreModule();
  await ensureLocalWorkspace();
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();
  const [validation, review, graph] = await Promise.all([
    validateWorkspaceArtifacts({ rootPath: projectRoot, now: checkedAt }),
    createWorkspaceReview({ rootPath: projectRoot, now: checkedAt }),
    createWorkspaceGraph({ rootPath: projectRoot, now: checkedAt })
  ]);
  const validationErrors = validation.summary?.errors ?? 0;
  const validationWarnings = validation.summary?.warnings ?? 0;
  const missingRefs = graph.summary?.missingRefs ?? 0;
  const criticalItems = review.summary?.criticalItems ?? 0;
  const totalItems = review.summary?.totalItems ?? 0;
  const status = workspaceReadinessStatus({
    validationPassed: validation.passed === true,
    validationErrors,
    missingRefs,
    criticalItems,
    totalItems
  });

  return {
    schemaVersion: "truth-harness.workspace-readiness.v0",
    checkedAt,
    workspacePath: projectRoot,
    localOnly: true,
    networkAccess: "none",
    status,
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
    summary: {
      validation: {
        passed: validation.passed === true,
        checkedFiles: validation.summary?.checkedFiles ?? 0,
        validFiles: validation.summary?.validFiles ?? 0,
        invalidFiles: validation.summary?.invalidFiles ?? 0,
        errors: validationErrors,
        warnings: validationWarnings
      },
      review: {
        totalItems,
        criticalItems,
        highItems: review.summary?.highItems ?? 0,
        mediumItems: review.summary?.mediumItems ?? 0,
        lowItems: review.summary?.lowItems ?? 0,
        routeObligations: review.summary?.routeObligations ?? 0,
        blockedClaims: review.summary?.blockedClaims ?? 0
      },
      graph: {
        nodes: graph.summary?.nodes ?? 0,
        edges: graph.summary?.edges ?? 0,
        missingRefs
      }
    },
    gates: [
      readinessGate({
        id: "workspace-validation",
        label: "Workspace validation",
        status: validation.passed === true ? "passed" : "blocked",
        detail: `${validationErrors} errors, ${validationWarnings} warnings across ${validation.summary?.checkedFiles ?? 0} checked JSON files.`,
        command: `truth-harness workspace validate ${quoteCommandArg(projectRoot)} --json`
      }),
      readinessGate({
        id: "missing-refs",
        label: "Missing refs",
        status: missingRefs === 0 ? "passed" : "blocked",
        detail: missingRefs === 0 ? "No missing local evidence refs in the workspace graph." : `${missingRefs} missing local evidence refs need repair.`,
        command: `truth-harness workspace graph ${quoteCommandArg(projectRoot)} --json`
      }),
      readinessGate({
        id: "project-queue",
        label: "Project queue",
        status: criticalItems > 0 ? "blocked" : totalItems > 0 ? "waiting" : "passed",
        detail: `${totalItems} open local next actions, including ${criticalItems} critical items.`,
        command: `truth-harness workspace review ${quoteCommandArg(projectRoot)} --json`
      }),
      readinessGate({
        id: "stress-fixture",
        label: "Scale fixture",
        status: "waiting",
        detail: "Run this in a throwaway path before trusting large-workspace UX or performance.",
        command: `truth-harness workspace stress ${quoteCommandArg(resolve(projectRoot, "..", "truth-harness-stress"))} --receipts 100 --claims 50 --routes 20 --fail-on-validation`
      })
    ],
    commands: {
      validate: `truth-harness workspace validate ${quoteCommandArg(projectRoot)} --json`,
      review: `truth-harness workspace review ${quoteCommandArg(projectRoot)} --json`,
      graph: `truth-harness workspace graph ${quoteCommandArg(projectRoot)} --json`,
      stress: `truth-harness workspace stress ${quoteCommandArg(resolve(projectRoot, "..", "truth-harness-stress"))} --receipts 100 --claims 50 --routes 20 --fail-on-validation`
    },
    warnings: [
      "Workspace readiness is a local product-health check. It does not prove any mathematical, scientific, medical, financial, safety, or patent claim.",
      "The web UI does not run workspace stress automatically because stress fixtures can write many local files.",
      ...(validation.warnings ?? []),
      ...(graph.warnings ?? [])
    ].slice(0, 8)
  };
}

async function readWorkspaceMaintenance() {
  const {
    cleanLocalWorkspace,
    repairWorkspaceArtifacts,
    validateWorkspaceArtifacts
  } = await loadCoreModule();
  await ensureLocalWorkspace();
  const checkedAt = new Date().toISOString();
  const [repairPreview, scratchPreview, validation] = await Promise.all([
    repairWorkspaceArtifacts({
      rootPath: projectRoot,
      dryRun: true,
      now: checkedAt
    }),
    cleanLocalWorkspace({
      rootPath: projectRoot,
      targets: ["scratch"],
      dryRun: true
    }),
    validateWorkspaceArtifacts({
      rootPath: projectRoot,
      now: checkedAt
    })
  ]);

  return {
    schemaVersion: "truth-harness.workspace-maintenance.v0",
    checkedAt,
    workspacePath: projectRoot,
    localOnly: true,
    networkAccess: "none",
    validation: {
      passed: validation.passed === true,
      checkedFiles: validation.summary?.checkedFiles ?? 0,
      errors: validation.summary?.errors ?? 0,
      warnings: validation.summary?.warnings ?? 0
    },
    artifactRepair: repairPreview,
    scratchCleanup: scratchPreview,
    commands: {
      archiveScratch: `node apps/cli/dist/index.js workspace archive ${quoteCommandArg(projectRoot)} --target scratch --reason ${quoteCommandArg("before scratch cleanup")}`,
      repairPreview: "npm run workspace:repair-artifacts:preview",
      repairApply: "npm run workspace:repair-artifacts",
      cleanPreview: "npm run workspace:clean",
      cleanScratch: `node apps/cli/dist/index.js workspace clean ${quoteCommandArg(projectRoot)} --target scratch --confirm-delete`
    },
    warnings: [
      "Maintenance is local workspace hygiene; it does not prove or upgrade any claim.",
      "Cleanup defaults to dry-run. Deletion can only target manifest-known .truth-harness directories.",
      ...repairPreview.warnings,
      ...scratchPreview.warnings
    ].slice(0, 10)
  };
}

function workspaceReadinessStatus(input) {
  if (!input.validationPassed || input.validationErrors > 0) {
    return "blocked";
  }
  if (input.missingRefs > 0) {
    return "missing-refs";
  }
  if (input.criticalItems > 0) {
    return "critical-work";
  }
  if (input.totalItems > 0) {
    return "open-work";
  }
  return "healthy";
}

function readinessGate(input) {
  return {
    id: input.id,
    label: input.label,
    status: input.status,
    detail: input.detail,
    command: input.command
  };
}

function quoteCommandArg(value) {
  return JSON.stringify(value);
}

function normalizeWorkspaceCleanTargets(value) {
  const targets = stringList(value);
  return targets.length > 0 ? targets.slice(0, 12) : ["scratch"];
}

async function readCasCheckSnapshot() {
  const { listSymbolicCasChecks } = await loadCoreModule();
  await ensureLocalWorkspace();
  const checks = await listSymbolicCasChecks(projectRoot);
  return checks.map((check) => ({
    ...check,
    paths: artifactPathsFor(check.path)
  }));
}

async function readSmtCheckSnapshot() {
  const { listSmtChecks } = await loadCoreModule();
  await ensureLocalWorkspace();
  const checks = await listSmtChecks(projectRoot);
  return checks.map((check) => ({
    ...check,
    paths: artifactPathsFor(check.path)
  }));
}

function researchMapPath() {
  return resolve(projectRoot, ".truth-harness", "artifacts", "research-map.json");
}

async function readResearchMapRecord() {
  const fallbackTime = new Date().toISOString();
  try {
    const raw = await readFile(researchMapPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion === "truth-harness.research-map.v0" && Array.isArray(parsed.snapshots)) {
      return {
        ...parsed,
        localOnly: true,
        networkAccess: "none",
        snapshots: parsed.snapshots.slice(-MAX_RESEARCH_MAP_SNAPSHOTS)
      };
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  return {
    schemaVersion: "truth-harness.research-map.v0",
    mapId: "research_map_local",
    createdAt: fallbackTime,
    updatedAt: fallbackTime,
    localOnly: true,
    networkAccess: "none",
    snapshotCount: 0,
    snapshots: [],
    warnings: []
  };
}

async function appendResearchMapSnapshot(snapshot) {
  const existing = await readResearchMapRecord();
  const snapshots = [...(existing.snapshots ?? []), snapshot].slice(-MAX_RESEARCH_MAP_SNAPSHOTS);
  const map = {
    schemaVersion: "truth-harness.research-map.v0",
    mapId: existing.mapId ?? "research_map_local",
    createdAt: existing.createdAt ?? snapshot.createdAt,
    updatedAt: snapshot.createdAt,
    localOnly: true,
    networkAccess: "none",
    snapshotCount: snapshots.length,
    snapshots,
    warnings: [
      "Research maps are navigation and provenance artifacts. They do not prove or validate a claim by themselves."
    ]
  };
  const path = researchMapPath();
  const ref = ".truth-harness/artifacts/research-map.json";
  await mkdir(resolve(projectRoot, ".truth-harness", "artifacts"), { recursive: true });
  await writeFile(path, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  const { refreshWorkspaceCatalogArtifact } = await loadCoreModule();
  await refreshWorkspaceCatalogArtifact({
    rootPath: projectRoot,
    path: ref,
    kind: "artifacts",
    now: snapshot.createdAt,
    staleReason: "research map snapshot written"
  });
  return map;
}

async function listVisualArtifactsSafe() {
  const { listVisualArtifacts } = await loadCoreModule();
  try {
    return await listVisualArtifacts(projectRoot);
  } catch {
    return [];
  }
}

function normalizeVisualArtifactInput(value) {
  if (!value || typeof value !== "object") {
    throw new Error("visual artifact body is required");
  }

  const renderer = value.renderer && typeof value.renderer === "object" ? value.renderer : {};
  return {
    rootPath: projectRoot,
    title: boundedText(value.title, "Untitled visual artifact", 180),
    kind: parseVisualArtifactKind(optionalText(value.kind) ?? "plot"),
    renderer: {
      engine: parseVisualArtifactRenderer(optionalText(renderer.engine) ?? optionalText(value.renderer) ?? "truth-harness-native"),
      engineVersion: optionalText(renderer.engineVersion),
      adapter: optionalText(renderer.adapter) ?? "truth-harness-web",
      adapterVersion: optionalText(renderer.adapterVersion)
    },
    sourceRefs: visualSourceRefList(value.sourceRefs),
    replayCommand: optionalText(value.replayCommand),
    payload: normalizeVisualPayload(value.payload),
    data: normalizeVisualDataTable(value.data),
    tags: stringList(value.tags).slice(0, 32),
    warnings: stringList(value.warnings).slice(0, 16)
  };
}

function normalizeVisualPayload(value) {
  if (!value || typeof value !== "object") {
    throw new Error("payload is required");
  }
  if (!("content" in value)) {
    throw new Error("payload.content is required");
  }

  return {
    format: parseVisualPayloadFormat(optionalText(value.format) ?? "svg"),
    content: value.content,
    contentRef: optionalText(value.contentRef),
    rendererSource: normalizeVisualRendererSource(value.rendererSource),
    width: positiveNumberOrUndefined(value.width),
    height: positiveNumberOrUndefined(value.height)
  };
}

function normalizeVisualRendererSource(value) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const language = parseVisualRendererSourceLanguage(optionalText(value.language) ?? "text");
  const content = boundedText(value.content, "", 200_000);
  if (!content) {
    throw new Error("rendererSource.content is required when rendererSource is provided");
  }

  return {
    language,
    content,
    filename: optionalText(value.filename),
    contentHash: optionalText(value.contentHash)
  };
}

function normalizeVisualDataTable(value) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const columns = stringList(value.columns).slice(0, 32);
  const rows = tupleRows(value.rows, 400, 32, 260);
  if (columns.length === 0 && rows.length === 0) {
    return undefined;
  }

  return {
    columns,
    rows
  };
}

function visualSourceRefList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 64)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      kind: parseVisualSourceKind(optionalText(item.kind) ?? "manual"),
      ref: boundedText(item.ref, "", 260),
      label: optionalText(item.label)
    }))
    .filter((item) => item.ref);
}

function parseVisualArtifactKind(value) {
  if (VISUAL_ARTIFACT_KINDS.has(value)) {
    return value;
  }

  throw new Error(`Unsupported visual artifact kind: ${value}`);
}

function parseVisualArtifactRenderer(value) {
  if (VISUAL_ARTIFACT_RENDERERS.has(value)) {
    return value;
  }

  throw new Error(`Unsupported visual renderer: ${value}`);
}

function parseGraphVisualRenderer(value) {
  if (value === "graphviz" || value === "mermaid") {
    return value;
  }

  throw new Error(`Unsupported graph visual renderer: ${value}`);
}

function parsePlotVisualRenderer(value) {
  if (value === "plotly" || value === "matplotlib" || value === "sage") {
    return value;
  }

  throw new Error(`Unsupported plot visual renderer: ${value}`);
}

function parseVisualPayloadFormat(value) {
  if (VISUAL_PAYLOAD_FORMATS.has(value)) {
    return value;
  }

  throw new Error(`Unsupported visual payload format: ${value}`);
}

function parseVisualRendererSourceLanguage(value) {
  if (VISUAL_RENDERER_SOURCE_LANGUAGES.has(value)) {
    return value;
  }

  throw new Error(`Unsupported visual renderer source language: ${value}`);
}

function parseVisualSourceKind(value) {
  if (VISUAL_SOURCE_KINDS.has(value)) {
    return value;
  }

  throw new Error(`Unsupported visual source kind: ${value}`);
}

function positiveNumberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
}

function boundedPositiveNumberOrUndefined(value, max) {
  const number = positiveNumberOrUndefined(value);
  return number === undefined ? undefined : Math.min(max, number);
}

function normalizeResearchMapSnapshot(value) {
  if (!value || typeof value !== "object") {
    throw new Error("snapshot is required");
  }

  const createdAt = new Date().toISOString();
  const nodes = mapNodeList(value.nodes);
  const edges = mapEdgeList(value.edges, nodes);
  return {
    schemaVersion: "truth-harness.research-map-snapshot.v0",
    snapshotId: `map_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
    createdAt,
    visualMode: boundedText(value.visualMode, "visual", 64),
    kind: boundedText(value.kind, "visual", 80),
    title: boundedText(value.title, "Untitled research map", 160),
    caption: boundedText(value.caption, "", 360),
    receiptRef: researchMapReceiptRef(value.receiptRef),
    facts: tupleRows(value.facts, 24, 2, 120),
    dataColumns: stringList(value.dataColumns).slice(0, 16).map((item) => boundedText(item, "column", 60)),
    dataRows: tupleRows(value.dataRows, 120, 16, 180),
    nodes,
    edges,
    tags: stringList(value.tags).slice(0, 24).map((item) => boundedText(item, "tag", 48)),
    privacy: {
      localOnly: true,
      networkAccess: "none",
      externalCalls: []
    },
    warnings: nodes.length === 0
      ? ["No map nodes were provided; this snapshot is data-only."]
      : []
  };
}

function researchMapReceiptRef(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    runId: boundedText(source.runId, "", 96),
    claimId: boundedText(source.claimId, "", 96),
    routeId: boundedText(source.routeId, "", 96),
    title: boundedText(source.title, "", 160),
    trust: boundedText(source.trust, "unverified", 48)
  };
}

function mapNodeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 100)
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: safeMapId(item.id, `node_${index + 1}`),
      label: boundedText(item.label, `Node ${index + 1}`, 96),
      detail: boundedText(item.detail, "", 280),
      kind: boundedText(item.kind, "concept", 48),
      sourceRef: boundedText(item.sourceRef, "", 180),
      tone: boundedText(item.tone, "muted", 32)
    }));
}

function mapEdgeList(value, nodes) {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = new Set(nodes.map((node) => node.id));
  return value
    .slice(0, 160)
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: safeMapId(item.id, `edge_${index + 1}`),
      from: safeMapId(item.from, ""),
      to: safeMapId(item.to, ""),
      kind: boundedText(item.kind, "linked-to", 48),
      label: boundedText(item.label, "", 120)
    }))
    .filter((edge) => ids.has(edge.from) && ids.has(edge.to));
}

function tupleRows(value, maxRows, maxColumns, maxLength) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, maxRows).map((row) => {
    const cells = Array.isArray(row) ? row : [row];
    return cells.slice(0, maxColumns).map((cell) => boundedText(cell, "", maxLength));
  });
}

function safeMapId(value, fallback) {
  const text = boundedText(value, fallback, 96)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return text || fallback;
}

function boundedText(value, fallback, maxLength) {
  const text = typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value).replace(/\s+/gu, " ").trim()
    : "";
  const resolved = text || fallback;
  return resolved.length > maxLength ? `${resolved.slice(0, Math.max(0, maxLength - 3))}...` : resolved;
}

function routePathsFor(routePathOrId) {
  if (typeof routePathOrId === "string" && routePathOrId.endsWith(".json")) {
    return artifactPathsFor(routePathOrId);
  }

  return {
    json: undefined,
    markdown: undefined
  };
}

function artifactPathsFor(relativeOrAbsoluteJsonPath) {
  const json = resolve(projectRoot, relativeOrAbsoluteJsonPath);
  return {
    json,
    markdown: json.replace(/\.json$/u, ".md")
  };
}

async function ensureLocalWorkspace() {
  const { initLocalWorkspace } = await loadCoreModule();
  return initLocalWorkspace(projectRoot, {
    displayName: "Truth Harness Local Web Session"
  });
}

function portablePath(value) {
  return String(value).replace(/\\/gu, "/");
}

function requiredText(value, fieldName) {
  const text = optionalText(value);
  if (!text) {
    throw new Error(`${fieldName} is required`);
  }

  return text;
}

function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseCasOperation(value) {
  const operation = optionalText(value) ?? "simplify";
  if (["simplify", "factor", "expand", "differentiate", "integrate"].includes(operation)) {
    return operation;
  }

  throw new Error(`Unsupported CAS operation: ${operation}`);
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

function parseRouteEvidenceRef(value) {
  if (!value || typeof value !== "object") {
    throw new Error("evidenceRef is required");
  }

  const kind = requiredText(value.kind, "evidenceRef.kind");
  if (!["cas", "proof", "smt", "receipt", "route"].includes(kind)) {
    throw new Error(`Unsupported route evidence kind: ${kind}`);
  }

  return {
    kind,
    ref: requiredText(value.ref, "evidenceRef.ref"),
    trust: optionalText(value.trust),
    summary: optionalText(value.summary)
  };
}

function guardApiRequest(request, response) {
  if (!isAllowedLocalHostHeader(request.headers.host)) {
    writeApiError(response, 403, "non-local API host rejected", request);
    return false;
  }

  if (!isReadMethod(request.method) && !isAllowedSameOriginWrite(request)) {
    writeApiError(response, 403, "cross-origin API write rejected", request);
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
    schemaVersion: "truth-harness.web-server-safety.v0",
    bindHost: host,
    port,
    localHostGuard: !allowNonLocalWeb,
    sameOriginWritesOnly: true,
    securityHeaders: true,
    maxJsonBodyBytes: MAX_JSON_BODY_BYTES,
    apiErrorFormat: "json",
    recommendation: allowNonLocalWeb
      ? "Non-local web access was explicitly enabled; do not expose this server to untrusted networks."
      : "The local API rejects non-local Host headers and cross-origin browser writes."
  };
}

function dockerVerifierGuidance(verification) {
  const engines = Array.isArray(verification?.engines) ? verification.engines : [];
  const totalCount = Number.isFinite(verification?.totalCount) ? verification.totalCount : engines.length;
  const readyCount = Number.isFinite(verification?.readyCount)
    ? verification.readyCount
    : engines.filter((engine) => engine.status === "available").length;
  const missingEngines = engines
    .filter((engine) => engine.status !== "available")
    .map((engine) => engine.displayName ?? engine.id ?? "Backend");
  const recommended = totalCount === 0 || readyCount < totalCount;

  return {
    schemaVersion: "truth-harness.docker-verifier-guidance.v0",
    localOnly: true,
    externalCalls: false,
    recommended,
    status: recommended ? "recommended" : "optional",
    commands: {
      proof: "npm run docker:proof",
      verify: "npm run docker:verify"
    },
    missingEngines,
    runtimeBoundary: {
      service: "truth-harness",
      composeNetworkMode: "none",
      autoRunsDocker: false,
      buildMayDownloadDependencies: true,
      repositoryBindMount: true
    },
    notes: [
      "The web UI never runs Docker automatically; it only exposes copyable commands.",
      "npm run docker:proof runs the truth-harness compose service with no external network route after the dev image exists.",
      "npm run docker:verify builds and tests the verification image; image builds may download dependencies.",
      "Docker status does not prove a claim. Trust labels still require concrete Lean, Z3, Maxima, or other accepted evidence artifacts."
    ]
  };
}

async function readCodeRunSandboxStatus() {
  try {
    const { getCodeRunSandboxStatus } = await loadCoreModule();
    return getCodeRunSandboxStatus();
  } catch (error) {
    return {
      schemaVersion: "truth-harness.code-run-sandbox-status.v0",
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

async function readEngineManifest() {
  try {
    const { getEngineManifest } = await loadCoreModule();
    return getEngineManifest({ timeoutMs: 1500 });
  } catch (error) {
    return {
      schemaVersion: "truth-harness.engine-manifest.v0",
      createdAt: new Date().toISOString(),
      localOnly: true,
      networkAccess: "none",
      status: "missing",
      readyCount: 0,
      totalCount: 0,
      nativeCount: 0,
      adapterCount: 0,
      plannedCount: 0,
      capabilities: [],
      trustBoundary: {
        aiOutputIsNotEvidence: true,
        statusProbeIsNotEvidence: true,
        claimTrustRequiresResolvableEvidence: true,
        provedRequiresAcceptedProofCheckerRun: true,
        smtCheckedRequiresConcreteSolverRun: true,
        crossCheckedRequiresIndependentAgreementRun: true
      },
      warnings: [
        `Engine manifest unavailable: ${error instanceof Error ? error.message : "unknown error"}`
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
        command: "truth-harness cas backends",
        trustBoundary: "Can support `cross-checked` only after a concrete independent Maxima agreement run.",
        probe: cas.backends[0]
      }),
      engineProbeRow({
        lane: "Formal proof",
        command: "truth-harness proof backends",
        trustBoundary: "Can support `proved` only after Lean accepts a concrete proof artifact.",
        probe: proof.backends[0]
      }),
      engineProbeRow({
        lane: "SMT solver",
        command: "truth-harness smt backends",
        trustBoundary: "Can support `smt-checked` only after Z3 returns sat or unsat for a concrete SMT-LIB artifact.",
        probe: smt.backends[0]
      })
    ];
    const readyCount = engines.filter((engine) => engine.status === "available").length;

    return {
      schemaVersion: "truth-harness.verification-readiness.v0",
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
      schemaVersion: "truth-harness.verification-readiness.v0",
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
  coreModulePromise ??= import(pathToFileURL(resolve(coreModulePath)).href);
  return coreModulePromise;
}

function isTruthyEnv(value) {
  return /^(1|true|yes|on)$/iu.test(value ?? "");
}

function isTruthyQueryParam(value) {
  return /^(1|true|yes|on)$/iu.test(value ?? "");
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let byteLength = 0;
    let bodyTooLarge = false;

    request.on("data", (chunk) => {
      byteLength += chunk.length;
      if (byteLength > MAX_JSON_BODY_BYTES) {
        bodyTooLarge = true;
        return;
      }

      if (!bodyTooLarge) {
        chunks.push(chunk);
      }
    });

    request.on("end", () => {
      if (bodyTooLarge) {
        rejectBody(new HttpError(413, "JSON body too large"));
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new HttpError(400, "invalid JSON body"));
      }
    });

    request.on("error", rejectBody);
  });
}

function writeJson(response, status, payload) {
  const requestId = payload?.requestId ?? response.truthHarnessRequestId ?? `web_req_${randomUUID()}`;
  const responsePayload = payload && typeof payload === "object" && !Array.isArray(payload)
    ? {
      requestId,
      ...payload
    }
    : payload;
  const headers = {
    ...webSecurityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Truth-Harness-Request-Id": requestId
  };

  response.writeHead(status, headers);
  response.end(`${JSON.stringify(responsePayload, null, 2)}\n`);
}

function writeApiError(response, status, error, request) {
  const requestId = `web_err_${randomUUID()}`;
  writeJson(response, status, {
    schemaVersion: "truth-harness.web-error.v0",
    requestId,
    createdAt: new Date().toISOString(),
    localOnly: true,
    externalCalls: [],
    method: request?.method ?? "UNKNOWN",
    path: apiRequestPath(request),
    status,
    error
  });
}

function apiRequestPath(request) {
  if (!request?.url) {
    return "unknown";
  }

  try {
    return new URL(request.url, `http://${host}:${port}`).pathname;
  } catch {
    return request.url.split("?")[0] || "unknown";
  }
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
  constructor(status, message = `HTTP ${status}`) {
    super(message);
    this.status = status;
  }
}
