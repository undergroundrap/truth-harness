import { mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  type LeanProofCheckWriteResult,
  type ProofBackendCommandRunner,
  writeLeanProofCheckRecord
} from "./proof-backend.js";
import { stableHash } from "./stable-hash.js";
import {
  type ProofObligation,
  renderVerifierRouteMarkdown,
  satisfyVerifierRouteObligation,
  type SatisfyVerifierRouteObligationResult,
  verifierRouteStatementBoundaryHash,
  type VerifierRoute,
  type VerifierRouteWriteResult,
  writeVerifierRoute
} from "./verifier-route.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";
import { createWorkspaceReview, type WorkspaceReview } from "./workspace-review.js";
import {
  createWorkspaceRunNextPlan,
  type WorkspaceRunNextPlan,
  type WorkspaceRunNextWriteResult,
  writeWorkspaceRunNextPlan
} from "./workspace-run-next.js";

export const PROOF_REPAIR_FIXTURE_SCHEMA_VERSION = "truth-harness.proof-repair-fixture.v0" as const;

export interface ProofRepairFixtureInput {
  rootPath: string;
  now?: string;
  leanCommand?: string;
  timeoutMs?: number;
  writeRunNextPlan?: boolean;
  runner?: ProofBackendCommandRunner;
}

export interface ProofRepairFixtureResult {
  schemaVersion: typeof PROOF_REPAIR_FIXTURE_SCHEMA_VERSION;
  fixtureId: string;
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  workspacePath: string;
  sourcePath: string;
  statement: string;
  route: VerifierRouteWriteResult;
  obligation: ProofObligation;
  rejectedProof: LeanProofCheckWriteResult;
  repairReview: WorkspaceReview;
  repairRunNext: WorkspaceRunNextWriteResult | { plan: WorkspaceRunNextPlan };
  repairedProof: LeanProofCheckWriteResult;
  routeSatisfaction?: SatisfyVerifierRouteObligationResult;
  finalReview: WorkspaceReview;
  warnings: string[];
}

const DEFAULT_CREATED_AT = "2026-06-21T12:00:00.000Z";
const SOURCE_PATH = "Proofs/TruthHarnessRepair.lean";
const DECLARATION_NAME = "truth_harness_repair_fixture";
const STATEMENT = `${DECLARATION_NAME} : True`;

const BAD_SOURCE = `theorem ${DECLARATION_NAME} : True := by
  exact False.elim
`;

const REPAIRED_SOURCE = `theorem ${DECLARATION_NAME} : True := by
  trivial
`;

export async function writeProofRepairFixtureWorkspace(input: ProofRepairFixtureInput): Promise<ProofRepairFixtureResult> {
  const createdAt = input.now ?? DEFAULT_CREATED_AT;
  const workspace = await initLocalWorkspace(input.rootPath, {
    displayName: "Truth Harness",
    now: createdAt
  });
  const root = workspace.root;
  const sourcePath = join(root, SOURCE_PATH);
  const obligationId = `obl_${stableHash({ createdAt, root, statement: STATEMENT }).slice(0, 16)}`;
  const statementHash = verifierRouteStatementBoundaryHash(STATEMENT);

  await writeLeanProjectFiles(root);
  await writeFileAtomic(sourcePath, BAD_SOURCE, "utf8");

  const route = await writeVerifierRoute({
    rootPath: root,
    problem: STATEMENT,
    now: new Date(timestampOffset(createdAt, 1)),
    leanCommand: input.leanCommand,
    timeoutMs: input.timeoutMs
  });
  const obligation = await rewriteRouteWithProofRepairObligation({
    rootPath: root,
    route,
    obligationId,
    statement: STATEMENT,
    statementHash,
    sourcePath: SOURCE_PATH,
    createdAt: timestampOffset(createdAt, 2)
  });

  const proofScope = {
    routeId: route.route.routeId,
    obligationId,
    statementHash,
    statement: STATEMENT
  };
  const checkOptions = {
    rootPath: root,
    sourcePath: SOURCE_PATH,
    declarationName: DECLARATION_NAME,
    scope: proofScope,
    leanCommand: input.leanCommand,
    timeoutMs: input.timeoutMs,
    runner: input.runner
  };
  const rejectedProof = await writeLeanProofCheckRecord({
    ...checkOptions,
    now: new Date(timestampOffset(createdAt, 3))
  });
  const repairReview = await createWorkspaceReview({
    rootPath: root,
    maxRoutes: 1,
    maxClaims: 0,
    maxSessions: 0,
    now: timestampOffset(createdAt, 4)
  });
  const repairPlan = await createWorkspaceRunNextPlan({
    rootPath: root,
    review: repairReview,
    executeLocal: false,
    now: timestampOffset(createdAt, 5)
  });
  const repairRunNext = input.writeRunNextPlan === false
    ? { plan: repairPlan }
    : await writeWorkspaceRunNextPlan({
        rootPath: root,
        plan: repairPlan
      });

  await writeFileAtomic(sourcePath, REPAIRED_SOURCE, "utf8");
  const repairedProof = await writeLeanProofCheckRecord({
    ...checkOptions,
    now: new Date(timestampOffset(createdAt, 6))
  });
  const proofRef = relative(root, repairedProof.jsonPath).replace(/\\/gu, "/");
  const routeSatisfaction = repairedProof.record.trust === "proved"
    ? await satisfyVerifierRouteObligation({
        rootPath: root,
        routeRef: route.route.routeId,
        obligationId,
        evidenceRef: {
          kind: "proof",
          ref: proofRef
        },
        now: new Date(timestampOffset(createdAt, 7))
      })
    : undefined;
  const finalReview = await createWorkspaceReview({
    rootPath: root,
    maxRoutes: 1,
    maxClaims: 0,
    maxSessions: 0,
    now: timestampOffset(createdAt, 8)
  });

  return {
    schemaVersion: PROOF_REPAIR_FIXTURE_SCHEMA_VERSION,
    fixtureId: `prfix_${stableHash({
      createdAt,
      routeId: route.route.routeId,
      rejected: rejectedProof.record.checkId,
      repaired: repairedProof.record.checkId
    }).slice(0, 16)}`,
    createdAt,
    localOnly: true,
    networkAccess: "none",
    workspacePath: root,
    sourcePath: SOURCE_PATH,
    statement: STATEMENT,
    route,
    obligation,
    rejectedProof,
    repairReview,
    repairRunNext,
    repairedProof,
    ...(routeSatisfaction ? { routeSatisfaction } : {}),
    finalReview,
    warnings: fixtureWarnings({ rejectedProof, repairedProof, routeSatisfaction })
  };
}

async function writeLeanProjectFiles(root: string): Promise<void> {
  await mkdir(resolve(root, "Proofs"), { recursive: true });
  await writeFileAtomic(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
  await writeFileAtomic(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\n", "utf8");
}

async function rewriteRouteWithProofRepairObligation(input: {
  rootPath: string;
  route: VerifierRouteWriteResult;
  obligationId: string;
  statement: string;
  statementHash: string;
  sourcePath: string;
  createdAt: string;
}): Promise<ProofObligation> {
  const obligation: ProofObligation = {
    obligationId: input.obligationId,
    kind: "formal-proof",
    status: "open",
    severity: "critical",
    sourceCapabilityId: "lean-proof-checker",
    title: "Lean proof repair fixture obligation",
    statement: input.statement,
    requiredBefore: "Before labeling this scoped fixture claim proved.",
    acceptanceCriteria: [
      "Attach an accepted proof-check record scoped to this exact route and obligation.",
      "The proof-check record must include the exact statement boundary hash.",
      "Rejected proof attempts are repair hints only; they do not prove or refute the claim."
    ],
    command:
      `truth-harness proof check ${input.sourcePath} --declaration ${DECLARATION_NAME} --route ${input.route.route.routeId}` +
      ` --obligation ${input.obligationId} --statement-hash ${input.statementHash}` +
      ` --statement "${input.statement}" --write`,
    nextStep: "Repair the workspace-local Lean source, rerun the scoped proof check, then attach the accepted proof record."
  };
  const route: VerifierRoute = {
    ...input.route.route,
    proofObligations: [obligation],
    nextActions: [
      obligation.command ?? "Run a scoped Lean proof check.",
      "If Lean rejects the proof, use workspace run-next to repair the same source file before rerunning."
    ]
  };
  const markdown = renderVerifierRouteMarkdown(route);

  await writeJsonFileAtomic(input.route.jsonPath, route);
  await writeFileAtomic(input.route.markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: input.rootPath,
    path: relative(input.rootPath, input.route.jsonPath),
    kind: "routes",
    now: input.createdAt,
    staleReason: "proof repair fixture route obligation written"
  });

  input.route.route = route;
  input.route.markdown = markdown;
  return obligation;
}

function fixtureWarnings(input: {
  rejectedProof: LeanProofCheckWriteResult;
  repairedProof: LeanProofCheckWriteResult;
  routeSatisfaction?: SatisfyVerifierRouteObligationResult;
}): string[] {
  const warnings = [
    "This fixture rehearses proof repair mechanics; it proves only the tiny formal statement checked by Lean.",
    "Rejected proof attempts are preserved as diagnostics and must not be treated as refutations."
  ];

  if (input.rejectedProof.record.status === "accepted") {
    warnings.push("The initial proof was accepted unexpectedly; the repair handoff may not demonstrate a failing proof attempt.");
  }
  if (input.repairedProof.record.trust !== "proved") {
    warnings.push("The repaired proof did not earn `proved`; install or configure Lean before using this fixture as a closure rehearsal.");
  }
  if (!input.routeSatisfaction) {
    warnings.push("The route obligation remains open because no accepted scoped proof-check record was available to attach.");
  }

  return warnings;
}

function timestampOffset(createdAt: string, seconds: number): string {
  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) {
    return createdAt;
  }
  return new Date(base.getTime() + seconds * 1000).toISOString();
}
