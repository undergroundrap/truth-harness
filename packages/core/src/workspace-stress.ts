import { mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createClaimLedgerGraph, listClaimRecords, writeClaimLedgerRecord } from "./claim-ledger.js";
import { writeJsonFileAtomic } from "./fs-util.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { createReceipt } from "./receipt.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import type { TrustLabel } from "./types.js";
import { writeVerifierRoute } from "./verifier-route.js";
import { createWorkspaceGraph } from "./workspace-graph.js";
import { createWorkspaceReview } from "./workspace-review.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

export interface WorkspaceStressInput {
  rootPath: string;
  receipts?: number;
  claims?: number;
  routes?: number;
  now?: string;
}

export interface WorkspaceStressResult {
  schemaVersion: "truth-harness.workspace-stress.v0";
  stressId: string;
  createdAt: string;
  workspacePath: string;
  localOnly: true;
  networkAccess: "none";
  requested: {
    receipts: number;
    claims: number;
    routes: number;
  };
  written: {
    receipts: number;
    claims: number;
    routes: number;
  };
  timingsMs: {
    init: number;
    writeReceipts: number;
    writeRoutes: number;
    writeClaims: number;
    validate: number;
    review: number;
    graph: number;
    total: number;
  };
  validation: {
    passed: boolean;
    checkedFiles: number;
    validFiles: number;
    invalidFiles: number;
    errors: number;
    warnings: number;
    byKind: Record<string, number>;
    byTrust: Partial<Record<TrustLabel, number>>;
  };
  review: {
    totalItems: number;
    criticalItems: number;
    highItems: number;
    mediumItems: number;
    lowItems: number;
    routeObligations: number;
    blockedClaims: number;
  };
  graph: {
    nodes: number;
    edges: number;
    missingRefs: number;
  };
  claimGraph: {
    nodes: number;
    edges: number;
    warnings: number;
  };
  sampleRefs: {
    receipts: string[];
    claims: string[];
    routes: string[];
  };
  sampleCommands: {
    validate: string;
    review: string;
    graph: string;
    snapshot: string;
  };
  warnings: string[];
}

const WORKSPACE_STRESS_SCHEMA_VERSION = "truth-harness.workspace-stress.v0" as const;
const DEFAULT_RECEIPTS = 100;
const DEFAULT_CLAIMS = 50;
const DEFAULT_ROUTES = 20;
const MAX_RECEIPTS = 5000;
const MAX_CLAIMS = 5000;
const MAX_ROUTES = 500;

export async function runWorkspaceStress(input: WorkspaceStressInput): Promise<WorkspaceStressResult> {
  const rootPath = resolve(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const requested = {
    receipts: normalizeStressCount(input.receipts, DEFAULT_RECEIPTS, MAX_RECEIPTS, "receipts"),
    claims: normalizeStressCount(input.claims, DEFAULT_CLAIMS, MAX_CLAIMS, "claims"),
    routes: normalizeStressCount(input.routes, DEFAULT_ROUTES, MAX_ROUTES, "routes")
  };
  const stressId = `stress_${stableHash({ rootPath, createdAt, requested }).slice(0, 16)}`;
  const totalStart = performance.now();

  const initStart = performance.now();
  const workspace = await initLocalWorkspace(rootPath, {
    displayName: "Truth Harness Stress Workspace",
    now: createdAt
  });
  const initMs = elapsedMs(initStart);

  const receiptsDir = resolve(workspace.root, workspace.manifest.directories.receipts);
  await mkdir(receiptsDir, { recursive: true });

  const writeReceiptsStart = performance.now();
  const receiptRefs: string[] = [];
  for (let index = 0; index < requested.receipts; index += 1) {
    const receipt = createReceipt(stressReceiptProblem(index));
    const fileName = `${createdAt.slice(0, 10)}-${stressId}-receipt-${String(index + 1).padStart(5, "0")}-${receipt.runId}.json`;
    const jsonPath = join(receiptsDir, fileName);
    await assertJsonSchemaBeforeWrite({
      value: receipt,
      schemaFile: "receipt.schema.json",
      artifactName: "Workspace stress receipt"
    });
    await writeJsonFileAtomic(jsonPath, receipt);
    receiptRefs.push(toPortablePath(relative(workspace.root, jsonPath)));
  }
  const writeReceiptsMs = elapsedMs(writeReceiptsStart);

  const writeRoutesStart = performance.now();
  const routeRefs: string[] = [];
  for (let index = 0; index < requested.routes; index += 1) {
    const routeWrite = await writeVerifierRoute({
      rootPath: workspace.root,
      problem: stressRouteProblem(index, stressId),
      now: new Date(Date.parse(createdAt) + index * 1000)
    });
    routeRefs.push(routeWrite.route.routeId);
  }
  const writeRoutesMs = elapsedMs(writeRoutesStart);

  const writeClaimsStart = performance.now();
  const claimRefs: string[] = [];
  for (let index = 0; index < requested.claims; index += 1) {
    const receiptRef = receiptRefs[index % Math.max(receiptRefs.length, 1)];
    const claimWrite = await writeClaimLedgerRecord({
      rootPath: workspace.root,
      title: `Stress claim ${index + 1}`,
      statement: stressClaimStatement(index, stressId),
      domain: "math",
      trust: "exact-computed",
      tags: ["stress", "math", `batch-${stressId.slice(-6)}`, index % 2 === 0 ? "linked-work" : "scale-fixture"],
      dependsOn: index > 0 ? [claimRefs[index - 1]] : [],
      evidenceRefs:
        receiptRef === undefined
          ? []
          : [
              {
                kind: "receipt",
                ref: receiptRef
              }
            ],
      nextChecks: index % 5 === 0 ? ["Review this generated stress claim before using it as real evidence."] : [],
      now: new Date(Date.parse(createdAt) + (requested.routes + index + 1) * 1000).toISOString()
    });
    claimRefs.push(claimWrite.claim.claimId);
  }
  const writeClaimsMs = elapsedMs(writeClaimsStart);

  const validateStart = performance.now();
  const validation = await validateWorkspaceArtifacts({ rootPath: workspace.root, now: createdAt });
  const validateMs = elapsedMs(validateStart);

  const reviewStart = performance.now();
  const review = await createWorkspaceReview({
    rootPath: workspace.root,
    maxRoutes: Math.max(requested.routes, 100),
    maxClaims: Math.max(requested.claims, 200),
    now: createdAt
  });
  const reviewMs = elapsedMs(reviewStart);

  const graphStart = performance.now();
  const graph = await createWorkspaceGraph({ rootPath: workspace.root, now: createdAt });
  const graphMs = elapsedMs(graphStart);

  const claims = await listClaimRecords(workspace.root);
  const claimGraph = createClaimLedgerGraph(claims);

  return {
    schemaVersion: WORKSPACE_STRESS_SCHEMA_VERSION,
    stressId,
    createdAt,
    workspacePath: workspace.root,
    localOnly: true,
    networkAccess: "none",
    requested,
    written: {
      receipts: receiptRefs.length,
      claims: claimRefs.length,
      routes: routeRefs.length
    },
    timingsMs: {
      init: initMs,
      writeReceipts: writeReceiptsMs,
      writeRoutes: writeRoutesMs,
      writeClaims: writeClaimsMs,
      validate: validateMs,
      review: reviewMs,
      graph: graphMs,
      total: elapsedMs(totalStart)
    },
    validation: {
      passed: validation.passed,
      checkedFiles: validation.summary.checkedFiles,
      validFiles: validation.summary.validFiles,
      invalidFiles: validation.summary.invalidFiles,
      errors: validation.summary.errors,
      warnings: validation.summary.warnings,
      byKind: validation.summary.byKind,
      byTrust: validation.summary.byTrust
    },
    review: {
      totalItems: review.summary.totalItems,
      criticalItems: review.summary.criticalItems,
      highItems: review.summary.highItems,
      mediumItems: review.summary.mediumItems,
      lowItems: review.summary.lowItems,
      routeObligations: review.summary.routeObligations,
      blockedClaims: review.summary.blockedClaims
    },
    graph: {
      nodes: graph.summary.nodes,
      edges: graph.summary.edges,
      missingRefs: graph.summary.missingRefs
    },
    claimGraph: {
      nodes: claimGraph.nodes.length,
      edges: claimGraph.edges.length,
      warnings: claimGraph.warnings.length
    },
    sampleRefs: {
      receipts: receiptRefs.slice(0, 5),
      claims: claimRefs.slice(0, 5),
      routes: routeRefs.slice(0, 5)
    },
    sampleCommands: {
      validate: `truth-harness workspace validate ${quoteCommandArg(workspace.root)} --json`,
      review: `truth-harness workspace review ${quoteCommandArg(workspace.root)} --json`,
      graph: `truth-harness workspace graph ${quoteCommandArg(workspace.root)} --json`,
      snapshot: `truth-harness workspace snapshot ${quoteCommandArg(workspace.root)} --json`
    },
    warnings: [
      "Workspace stress fixtures are synthetic scale probes. They are not real research evidence.",
      "A passing stress run means local artifact plumbing survived this fixture size; it does not prove the UI is polished or the system is ready for public launch.",
      ...validation.warnings
    ]
  };
}

function stressReceiptProblem(index: number): string {
  const a = (index % 17) + 1;
  const b = (index % 11) + 2;
  const c = (index % 7) + 1;
  const d = (index % 13) + 3;
  switch (index % 6) {
    case 0:
      return `compute ${a} / ${b} + ${c} / ${d}`;
    case 1:
      return `for all integers n, n^2+n+1 is even`;
    case 2:
      return "dimension check force = mass * acceleration";
    case 3:
      return `bound x^2 + ${a}*x + ${c} for x in [0, ${d}]`;
    case 4:
      return "dimension check force = mass * velocity";
    default:
      return `compute ${a + c} * ${d} - ${b}`;
  }
}

function stressRouteProblem(index: number, stressId: string): string {
  if (index % 4 === 0) {
    return `symbolic simplify sin(x)^2 + cos(x)^2`;
  }
  if (index % 4 === 1) {
    return `compute ${(index % 9) + 2} / ${(index % 5) + 3} + ${(index % 7) + 1} / ${(index % 11) + 4}`;
  }
  if (index % 4 === 2) {
    return "for all integers n, n^2+n is even";
  }
  return `stress route ${stressId} unsupported conjecture ${index + 1}`;
}

function stressClaimStatement(index: number, stressId: string): string {
  return `Stress workspace claim ${index + 1} for ${stressId}: generated local evidence remains replayable and linked.`;
}

function normalizeStressCount(value: number | undefined, fallback: number, max: number, label: string): number {
  const count = value ?? fallback;
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Workspace stress ${label} must be a non-negative safe integer.`);
  }
  if (count > max) {
    throw new Error(`Workspace stress ${label} count ${count} exceeds the safety cap of ${max}.`);
  }
  return count;
}

function elapsedMs(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

function toPortablePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function quoteCommandArg(value: string): string {
  return JSON.stringify(value);
}
