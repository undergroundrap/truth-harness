import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { orderCredibilityActionsForRunNext } from "./credibility-action-order.js";
import type { CredibilityBundleVerification } from "./credibility-bundle.js";
import { createCredibilityPack, type CredibilityPack, type CreateCredibilityPackInput } from "./credibility-pack.js";
import type { EngineVerificationCommandRunner, EngineVerificationRequirements } from "./engine-verification.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import {
  getCodeRunSandboxStatus,
  listCodeRunSandboxRuns,
  type CodeRunSandboxRunSummary,
  type CodeRunSandboxStatus
} from "./sandbox.js";
import { listWebUiReviews, type WebUiReviewSummary } from "./web-ui-review.js";
import { getWorkspaceCatalogStatus, type WorkspaceCatalogStatus } from "./workspace-catalog.js";

export type ReleaseAuditStatus = "ready" | "blocked";
export type ReleaseAuditMode = "prototype" | "public-review";
export type ReleaseAuditCheckStatus = "pass" | "warn" | "fail";
export type ReleaseAuditFrontierReadinessStatus =
  | "blocked"
  | "credible-verification-harness"
  | "bounded-hard-math-harness";
export type ReleaseAuditFrontierStageStatus = "ready" | "partial" | "blocked";

export interface ReleaseAuditCheck {
  id: string;
  title: string;
  status: ReleaseAuditCheckStatus;
  blocking: boolean;
  summary: string;
  command?: string;
  details: string[];
}

export interface ReleaseAuditFrontierReadinessStage {
  id: string;
  title: string;
  status: ReleaseAuditFrontierStageStatus;
  summary: string;
  evidence: string[];
  blockers: string[];
  nextAction?: string;
}

export interface ReleaseAuditFrontierReadiness {
  schemaVersion: "truth-harness.frontier-readiness.v0";
  status: ReleaseAuditFrontierReadinessStatus;
  frontierDiscoveryReadiness: "not-ready";
  canClaimWorldHardestProblems: false;
  strongestHonestClaim: string;
  summary: string;
  nextMilestone: string;
  stages: ReleaseAuditFrontierReadinessStage[];
}

export interface CreateReleaseAuditInput
  extends Pick<
    CreateCredibilityPackInput,
    | "rootPath"
    | "now"
    | "maxRoutes"
    | "maxClaims"
    | "maxSessions"
    | "maxReports"
    | "timeoutMs"
    | "maximaCommand"
    | "z3Command"
    | "cvc5Command"
    | "leanCommand"
    | "sageCommand"
    | "smtSourcePath"
    | "smtSourceText"
    | "leanSourcePath"
    | "leanSourceText"
  > {
  mode?: ReleaseAuditMode;
  engineRequirements?: EngineVerificationRequirements;
  requireSandbox?: boolean;
  requireSavedStrictEngineRun?: boolean;
  runner?: EngineVerificationCommandRunner;
}

export interface ReleaseAudit {
  schemaVersion: "truth-harness.release-audit.v0";
  createdAt: string;
  mode: ReleaseAuditMode;
  status: ReleaseAuditStatus;
  professorReady: boolean;
  publicLaunchReady: boolean;
  frontierReadiness: ReleaseAuditFrontierReadiness;
  localOnly: true;
  networkAccess: "none";
  workspacePath: string;
  projectId?: string;
  summary: {
    totalChecks: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
    blockingFailures: number;
    validationPassed: boolean;
    catalogFresh: boolean;
    requiredEngineGates: string;
    concreteEngineGates: string;
    savedEngineLadderLevel?: string;
    adversarialBenchmark: string;
    mathCredibilityLadder: string;
    professorMathChallenge: string;
    hardMathClosure: string;
    reportDrafts: number;
    reportDraftsNeedingAttention: number;
    leanProofSafetyItems: number;
    researchSessions: number;
    sessionContinuationItems: number;
    reviewItems: number;
    criticalReviewItems: number;
    sandboxAvailable: boolean;
    webUiReview: "missing" | "passed" | "warning" | "failed";
  };
  workspace: LocalWorkspaceStatus;
  catalog?: WorkspaceCatalogStatus;
  sandbox: CodeRunSandboxStatus;
  sandboxEvidence?: CodeRunSandboxRunSummary;
  webUiReview?: WebUiReviewSummary;
  reviewerBundleVerification?: ReleaseAuditReviewerBundleVerificationSummary;
  credibilityPack?: CredibilityPack;
  checks: ReleaseAuditCheck[];
  commands: {
    releaseAudit: string;
    rebuildCatalog: string;
    validateWorkspace: string;
    credibilityPack: string;
    credibilityActions: string;
    adversarialBenchmark: string;
    mathCredibilityLadder: string;
    professorMathChallenge: string;
    hardMathExactClosure: string;
    hardMathSymbolicClosure: string;
    hardMathSmtClosure: string;
    engineVerify: string;
    dockerProfessor: string;
    dockerProfessorAll: string;
    dockerEngines: string;
    dockerSandbox: string;
    dockerAllEngines: string;
    dockerLeanRepairGate: string;
    dockerProof: string;
    dockerVerify: string;
    workspaceStress: string;
    browserUrl: string;
  };
  nextActions: string[];
  limitations: string[];
}

export interface ReleaseAuditReviewerBundleVerificationSummary {
  verificationId: string;
  bundleId: string;
  packId: string;
  verifiedAt: string;
  artifactPath: string;
  bundleRef: string;
  passed: boolean;
  sourceMatchesWorkspace: boolean;
  checkedBundleFiles: number;
  checkedSourceFiles: number;
  manifestDigestStatus: "verified" | "mismatch" | "not-recorded";
}

export async function createReleaseAudit(input: CreateReleaseAuditInput): Promise<ReleaseAudit> {
  const rootPath = resolve(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const mode = input.mode ?? "public-review";
  const engineRequirements = input.engineRequirements ?? {};
  const commands = releaseAuditCommands(rootPath, engineRequirements, {
    requireSandbox: input.requireSandbox === true,
    requireSavedStrictEngineRun: input.requireSavedStrictEngineRun === true
  });
  const workspace = await getLocalWorkspaceStatus(rootPath);
  const sandbox = getCodeRunSandboxStatus();
  const sandboxEvidence = workspace.exists && workspace.manifest ? await latestPassingSandboxRun(rootPath) : undefined;
  const webUiReview = workspace.exists && workspace.manifest ? await latestWebUiReview(rootPath) : undefined;
  const reviewerBundleVerification = workspace.exists && workspace.manifest
    ? await latestReviewerBundleVerification(rootPath)
    : undefined;

  if (!workspace.exists || !workspace.manifest) {
    const checks = [
      failCheck({
        id: "workspace",
        title: "Workspace initialized",
        blocking: true,
        summary: "No Truth Harness workspace manifest was found.",
        command: `truth-harness workspace init ${quoteCommandArg(rootPath)}`,
        details: ["Initialize a local .truth-harness workspace before relying on audit, catalog, or release readiness."]
      }),
      sandboxCheck(sandbox, input.requireSandbox === true, sandboxEvidence)
    ];
    return buildAudit({
      createdAt,
      mode,
      rootPath,
      workspace,
      sandbox,
      sandboxEvidence,
      webUiReview,
      reviewerBundleVerification,
      commands,
      checks,
      validationPassed: false,
      catalogFresh: false,
      requiredEngineGates: "0/0",
      concreteEngineGates: "0/0",
      adversarialBenchmark: "missing",
      mathCredibilityLadder: "missing",
      professorMathChallenge: "missing",
      hardMathClosure: "missing",
      reportDrafts: 0,
      reportDraftsNeedingAttention: 0,
      leanProofSafetyItems: 0,
      researchSessions: 0,
      sessionContinuationItems: 0,
      reviewItems: 0,
      criticalReviewItems: 0
    });
  }

  const catalog = await getWorkspaceCatalogStatus(rootPath, { checkFiles: true });
  const credibilityPack = await createCredibilityPack({
    rootPath,
    now: createdAt,
    maxRoutes: input.maxRoutes,
    maxClaims: input.maxClaims,
    maxSessions: input.maxSessions,
    maxReports: input.maxReports,
    timeoutMs: input.timeoutMs,
    maximaCommand: input.maximaCommand,
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command,
    leanCommand: input.leanCommand,
    sageCommand: input.sageCommand,
    smtSourcePath: input.smtSourcePath,
    smtSourceText: input.smtSourceText,
    leanSourcePath: input.leanSourcePath,
    leanSourceText: input.leanSourceText,
    engineRequirements,
    runner: input.runner
  });
  const checks = [
    workspaceCheck(workspace),
    validationCheck(credibilityPack),
    catalogCheck(catalog),
    engineCheck(credibilityPack, hasRequiredEngine(engineRequirements)),
    adversarialBenchmarkCheck(credibilityPack),
    mathCredibilityLadderCheck(credibilityPack),
    professorMathChallengeCheck(credibilityPack),
    hardMathClosureCheck(credibilityPack),
    reportDraftsCheck(credibilityPack),
    leanProofSafetyCheck(credibilityPack),
    researchSessionContinuityCheck(credibilityPack),
    savedStrictEngineRunCheck(credibilityPack, input.requireSavedStrictEngineRun === true),
    reviewerBundleVerificationCheck(reviewerBundleVerification),
    reviewQueueCheck(credibilityPack),
    sandboxCheck(sandbox, input.requireSandbox === true, sandboxEvidence),
    manualUiCheck(webUiReview)
  ];

  return buildAudit({
    createdAt,
    mode,
    rootPath,
    workspace,
    catalog,
    sandbox,
    sandboxEvidence,
    webUiReview,
    reviewerBundleVerification,
    credibilityPack,
    commands,
    checks,
    validationPassed: credibilityPack.summary.validationPassed,
    catalogFresh: catalog.readable && !catalog.stale,
    requiredEngineGates: credibilityPack.summary.requiredEngineGates,
    concreteEngineGates: credibilityPack.summary.concreteEngineGates,
    savedEngineLadderLevel: credibilityPack.summary.savedEngineLadderLevel,
    adversarialBenchmark: credibilityPack.summary.latestAdversarialBenchmarkStatus,
    mathCredibilityLadder: credibilityPack.summary.latestMathCredibilityLadderStatus,
    professorMathChallenge: credibilityPack.summary.latestProfessorMathChallengeStatus,
    hardMathClosure: hardMathClosureSummary(credibilityPack),
    reportDrafts: credibilityPack.summary.savedReportDrafts,
    reportDraftsNeedingAttention: credibilityPack.summary.reportDraftsNeedingAttention,
    leanProofSafetyItems: credibilityPack.summary.leanProofSafetyItems,
    researchSessions: credibilityPack.workspaceReview.summary.sessions,
    sessionContinuationItems:
      credibilityPack.workspaceReview.summary.sessionTasks + credibilityPack.workspaceReview.summary.sessionNextChecks,
    reviewItems: credibilityPack.summary.reviewItems,
    criticalReviewItems: credibilityPack.summary.criticalReviewItems
  });
}

export function renderReleaseAuditMarkdown(audit: ReleaseAudit): string {
  const lines = [
    "# Truth Harness Release Audit",
    "",
    `- Status: \`${audit.status}\``,
    `- Mode: \`${audit.mode}\``,
    `- Professor ready: \`${String(audit.professorReady)}\``,
    `- Public launch ready: \`${String(audit.publicLaunchReady)}\``,
    `- Workspace: \`${audit.workspacePath}\``,
    `- Created: \`${audit.createdAt}\``,
    "",
    "## Summary",
    "",
    `- Checks: ${audit.summary.passedChecks} pass, ${audit.summary.warningChecks} warn, ${audit.summary.failedChecks} fail`,
    `- Blocking failures: ${audit.summary.blockingFailures}`,
    `- Validation: ${audit.summary.validationPassed ? "passed" : "failed"}`,
    `- Catalog fresh: ${String(audit.summary.catalogFresh)}`,
    `- Engine evidence: ${formatReleaseAuditEngineSummary(audit)}`,
    `- Required engine gates: ${audit.summary.requiredEngineGates}`,
    `- Concrete engine gates: ${audit.summary.concreteEngineGates}`,
    `- Saved engine ladder: ${audit.summary.savedEngineLadderLevel ?? "missing"}`,
    `- Adversarial benchmark: ${audit.summary.adversarialBenchmark}`,
    `- Math credibility ladder: ${audit.summary.mathCredibilityLadder}`,
    `- Professor math challenge: ${audit.summary.professorMathChallenge}`,
    `- Hard-math closure: ${audit.summary.hardMathClosure}`,
    `- Report drafts: ${audit.summary.reportDrafts} saved, ${audit.summary.reportDraftsNeedingAttention} needing attention`,
    `- Lean proof-safety blockers: ${audit.summary.leanProofSafetyItems}`,
    `- Research sessions: ${audit.summary.researchSessions} inspected, ${audit.summary.sessionContinuationItems} continuation item(s)`,
    `- Review queue: ${audit.summary.reviewItems} item(s), ${audit.summary.criticalReviewItems} critical`,
    `- Code-run sandbox: ${audit.summary.sandboxAvailable ? "available" : "not measured"}`,
    `- Web UI review: ${audit.summary.webUiReview}`,
    "",
    "## Frontier Readiness",
    "",
    `- Current honest position: \`${audit.frontierReadiness.status}\``,
    `- Frontier discovery readiness: \`${audit.frontierReadiness.frontierDiscoveryReadiness}\``,
    `- Can claim world-hardest-problem solving: \`${String(audit.frontierReadiness.canClaimWorldHardestProblems)}\``,
    `- Strongest honest claim: ${audit.frontierReadiness.strongestHonestClaim}`,
    `- Summary: ${audit.frontierReadiness.summary}`,
    `- Next milestone: ${audit.frontierReadiness.nextMilestone}`,
    "",
    "### Frontier Stages",
    ""
  ];

  for (const stage of audit.frontierReadiness.stages) {
    lines.push(`- \`${stage.status}\` ${stage.title}: ${stage.summary}`);
    if (stage.nextAction) {
      lines.push(`  - Next: \`${stage.nextAction}\``);
    }
    if (stage.blockers.length > 0) {
      lines.push(`  - Blockers: ${stage.blockers.join("; ")}`);
    }
  }

  lines.push(
    "",
    "## Checks",
    ""
  );

  for (const check of audit.checks) {
    lines.push(`### ${check.status.toUpperCase()} ${check.title}`);
    lines.push("");
    lines.push(`- Blocking: \`${String(check.blocking)}\``);
    lines.push(`- Summary: ${check.summary}`);
    if (check.command) {
      lines.push(`- Command: \`${check.command}\``);
    }
    for (const detail of check.details) {
      lines.push(`- ${detail}`);
    }
    lines.push("");
  }

  if (audit.nextActions.length > 0) {
    lines.push("## Next Actions");
    lines.push("");
    for (const action of audit.nextActions) {
      lines.push(`- \`${action}\``);
    }
    lines.push("");
  }

  lines.push("## Release Commands");
  lines.push("");
  for (const [name, command] of Object.entries(audit.commands)) {
    lines.push(`- ${name}: \`${command}\``);
  }
  lines.push("");
  lines.push("## Limitations");
  lines.push("");
  for (const limitation of audit.limitations) {
    lines.push(`- ${limitation}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatReleaseAuditEngineSummary(audit: Pick<ReleaseAudit, "summary" | "checks">): string {
  const liveGateSummary = `${audit.summary.concreteEngineGates} concrete, ${audit.summary.requiredEngineGates} required`;
  const engineCheck = audit.checks.find((check) => check.id === "engine-evidence");
  if (
    engineCheck?.status === "pass" &&
    engineCheck.summary.includes("Saved no-network Docker engine evidence")
  ) {
    const savedLevel = audit.summary.savedEngineLadderLevel ? `; saved ladder: ${audit.summary.savedEngineLadderLevel}` : "";
    return `${engineCheck.summary} (live host: ${liveGateSummary}${savedLevel})`;
  }
  return liveGateSummary;
}

function buildAudit(input: {
  createdAt: string;
  mode: ReleaseAuditMode;
  rootPath: string;
  workspace: LocalWorkspaceStatus;
  catalog?: WorkspaceCatalogStatus;
  sandbox: CodeRunSandboxStatus;
  sandboxEvidence?: CodeRunSandboxRunSummary;
  webUiReview?: WebUiReviewSummary;
  reviewerBundleVerification?: ReleaseAuditReviewerBundleVerificationSummary;
  credibilityPack?: CredibilityPack;
  commands: ReleaseAudit["commands"];
  checks: ReleaseAuditCheck[];
  validationPassed: boolean;
  catalogFresh: boolean;
  requiredEngineGates: string;
  concreteEngineGates: string;
  savedEngineLadderLevel?: string;
  adversarialBenchmark: string;
  mathCredibilityLadder: string;
  professorMathChallenge: string;
  hardMathClosure: string;
  reportDrafts: number;
  reportDraftsNeedingAttention: number;
  leanProofSafetyItems: number;
  researchSessions: number;
  sessionContinuationItems: number;
  reviewItems: number;
  criticalReviewItems: number;
}): ReleaseAudit {
  const blockingFailures = input.checks.filter((check) => check.blocking && check.status === "fail").length;
  const status: ReleaseAuditStatus = blockingFailures === 0 ? "ready" : "blocked";
  const warningChecks = input.checks.filter((check) => check.status === "warn").length;
  const failedChecks = input.checks.filter((check) => check.status === "fail").length;
  const professorReady = Boolean(input.credibilityPack?.summary.professorReady) && input.catalogFresh && blockingFailures === 0;
  const frontierReadiness = frontierReadinessFor({
    checks: input.checks,
    commands: input.commands,
    credibilityPack: input.credibilityPack,
    professorReady,
    requiredEngineGates: input.requiredEngineGates,
    concreteEngineGates: input.concreteEngineGates,
    hardMathClosure: input.hardMathClosure,
    catalogFresh: input.catalogFresh
  });

  return {
    schemaVersion: "truth-harness.release-audit.v0",
    createdAt: input.createdAt,
    mode: input.mode,
    status,
    professorReady,
    publicLaunchReady: status === "ready" && professorReady && warningChecks === 0,
    frontierReadiness,
    localOnly: true,
    networkAccess: "none",
    workspacePath: input.rootPath,
    projectId: input.workspace.manifest?.projectId,
    summary: {
      totalChecks: input.checks.length,
      passedChecks: input.checks.filter((check) => check.status === "pass").length,
      warningChecks,
      failedChecks,
      blockingFailures,
      validationPassed: input.validationPassed,
      catalogFresh: input.catalogFresh,
      requiredEngineGates: input.requiredEngineGates,
      concreteEngineGates: input.concreteEngineGates,
      savedEngineLadderLevel: input.savedEngineLadderLevel,
      adversarialBenchmark: input.adversarialBenchmark,
      mathCredibilityLadder: input.mathCredibilityLadder,
      professorMathChallenge: input.professorMathChallenge,
      hardMathClosure: input.hardMathClosure,
      reportDrafts: input.reportDrafts,
      reportDraftsNeedingAttention: input.reportDraftsNeedingAttention,
      leanProofSafetyItems: input.leanProofSafetyItems,
      researchSessions: input.researchSessions,
      sessionContinuationItems: input.sessionContinuationItems,
      reviewItems: input.reviewItems,
      criticalReviewItems: input.criticalReviewItems,
      sandboxAvailable: input.sandbox.available || input.sandboxEvidence?.status === "passed",
      webUiReview: input.webUiReview?.status ?? "missing"
    },
    workspace: input.workspace,
    catalog: input.catalog,
    sandbox: input.sandbox,
    sandboxEvidence: input.sandboxEvidence,
    webUiReview: input.webUiReview,
    reviewerBundleVerification: input.reviewerBundleVerification,
    credibilityPack: input.credibilityPack,
    checks: input.checks,
    commands: input.commands,
    nextActions: nextActions(input.checks, input.credibilityPack),
    limitations: [
      "Release audit composes existing local evidence checks; it does not prove mathematical, scientific, medical, regulatory, or legal truth.",
      "Engine evidence is scoped to concrete smoke checks. Future claims still need their own receipts, proof checks, SMT/CAS artifacts, sources, simulations, or expert review.",
      "Saved web UI review records can clear launch-polish warnings for the inspected viewport, but they do not replace future automated screenshot regression tests.",
      "Docker commands are recommended for strict reviewer gates, but this audit does not start Docker by itself."
    ]
  };
}

function frontierReadinessFor(input: {
  checks: ReleaseAuditCheck[];
  commands: ReleaseAudit["commands"];
  credibilityPack?: CredibilityPack;
  professorReady: boolean;
  requiredEngineGates: string;
  concreteEngineGates: string;
  savedEngineLadderLevel?: string;
  hardMathClosure: string;
  catalogFresh: boolean;
}): ReleaseAuditFrontierReadiness {
  const localHarnessReady =
    checkPassed(input.checks, "workspace") &&
    checkPassed(input.checks, "workspace-validation") &&
    checkPassed(input.checks, "catalog") &&
    checkPassed(input.checks, "adversarial-ai-benchmark") &&
    checkPassed(input.checks, "math-credibility-ladder") &&
    checkPassed(input.checks, "professor-math-challenge") &&
    checkPassed(input.checks, "lean-proof-safety");
  const engineEvidenceReady = checkPassed(input.checks, "engine-evidence");
  const hardMathClosureReady = checkPassed(input.checks, "hard-math-closure");
  const strictAllEngineEvidenceReady =
    input.credibilityPack?.summary.savedEngineLadderLevel === "engine-level-5-strict-all-engines" ||
    input.credibilityPack?.summary.latestStrictEngineRunStatus === "passed" ||
    (engineEvidenceReady &&
      gateRatioAtLeast(input.requiredEngineGates, 5, 5) &&
      gateRatioAtLeast(input.concreteEngineGates, 5, 5));
  const leanFixtureReady =
    input.credibilityPack?.engineEvidenceLadder.some(
      (entry) =>
        entry.status === "passed" &&
        (entry.displayName.toLowerCase().includes("lean") || entry.trust === "proved")
    ) === true ||
    input.credibilityPack?.summary.latestStrictEngineRunStatus === "passed" ||
    input.credibilityPack?.summary.latestProfessorEngineRunStatus === "passed";
  const boundedHardMathReady = input.professorReady && engineEvidenceReady && hardMathClosureReady;
  const status: ReleaseAuditFrontierReadinessStatus = boundedHardMathReady
    ? "bounded-hard-math-harness"
    : localHarnessReady
      ? "credible-verification-harness"
      : "blocked";
  const stages: ReleaseAuditFrontierReadinessStage[] = [
    {
      id: "local-verification-harness",
      title: "Credible local verification harness",
      status: localHarnessReady ? "ready" : input.catalogFresh ? "partial" : "blocked",
      summary: localHarnessReady
        ? "Workspace validation, catalog freshness, adversarial AI-failure checks, the native math ladder, and the professor challenge are present."
        : "The local evidence floor is not complete yet.",
      evidence: [
        `Workspace: ${checkSummary(input.checks, "workspace")}.`,
        `Validation: ${checkSummary(input.checks, "workspace-validation")}.`,
        `Catalog: ${checkSummary(input.checks, "catalog")}.`,
        `AI-failure benchmark: ${checkSummary(input.checks, "adversarial-ai-benchmark")}.`,
        `Math ladder: ${checkSummary(input.checks, "math-credibility-ladder")}.`,
        `Professor challenge: ${checkSummary(input.checks, "professor-math-challenge")}.`,
        `Lean proof safety: ${checkSummary(input.checks, "lean-proof-safety")}.`
      ],
      blockers: localHarnessReady
        ? []
        : ["Complete the local validation, catalog, adversarial benchmark, native hard-math ladder, professor challenge, and Lean proof-safety evidence."],
      nextAction: localHarnessReady ? undefined : firstCommand(input.checks, ["lean-proof-safety", "catalog", "adversarial-ai-benchmark", "math-credibility-ladder", "professor-math-challenge"])
    },
    {
      id: "independent-engine-stack",
      title: "Independent engine stack",
      status: strictAllEngineEvidenceReady ? "ready" : engineEvidenceReady ? "partial" : "blocked",
      summary: strictAllEngineEvidenceReady
        ? "Maxima, Z3, cvc5, Lean, and SageMath have a strict reviewer evidence path."
        : engineEvidenceReady
          ? "Some concrete engine evidence is present, but the strict all-engine gate is not fully cited here."
          : "The required engine evidence gate is not satisfied.",
      evidence: [
        `Engine check: ${checkSummary(input.checks, "engine-evidence")}.`,
        `Live concrete gates: ${input.concreteEngineGates}.`,
        `Live required gates: ${input.requiredEngineGates}.`,
        `Strongest saved engine ladder: ${input.savedEngineLadderLevel ?? "missing"}.`,
        `Saved strict engine run: ${input.credibilityPack?.summary.latestStrictEngineRunStatus ?? "missing"}.`
      ],
      blockers: strictAllEngineEvidenceReady
        ? []
        : ["Earn or cite the strict no-network all-engine reviewer run before claiming broad independent verifier coverage."],
      nextAction: strictAllEngineEvidenceReady ? undefined : input.commands.dockerAllEngines
    },
    {
      id: "bounded-hard-math-autonomy",
      title: "Bounded hard-math autonomy",
      status: hardMathClosureReady && localHarnessReady ? "ready" : localHarnessReady ? "partial" : "blocked",
      summary: hardMathClosureReady
        ? "Seeded exact, symbolic CAS, and SMT validation blockers have replayable closure reports."
        : "The harness still needs saved closure reports proving it can close scoped validation-plan gates.",
      evidence: [
        `Hard-math closure: ${input.hardMathClosure}.`,
        `Research continuity: ${checkSummary(input.checks, "research-session-continuity")}.`,
        `Review queue: ${checkSummary(input.checks, "review-queue")}.`
      ],
      blockers: hardMathClosureReady
        ? []
        : ["Run the Docker hard-math closure smokes for exact, symbolic CAS, and SMT blockers."],
      nextAction: hardMathClosureReady ? undefined : input.commands.hardMathExactClosure
    },
    {
      id: "formal-theorem-workflows",
      title: "Formal theorem workflows",
      status: leanFixtureReady ? "partial" : "blocked",
      summary: leanFixtureReady
        ? "Lean fixture evidence exists, but this is not yet a mature proof-search or mathlib-scale workflow."
        : "No accepted Lean proof fixture is cited in this audit scope.",
      evidence: [
        `Lean/proved fixture evidence: ${leanFixtureReady ? "present" : "missing"}.`,
        "`proved` remains reserved for accepted proof-checker artifacts.",
        `Lean repair gate: ${input.commands.dockerLeanRepairGate}.`
      ],
      blockers: [
        "Add larger Lean/mathlib templates, proof-hole tracking, theorem corpora, and external mathematical review before treating this as frontier theorem infrastructure."
      ],
      nextAction: leanFixtureReady ? input.commands.dockerLeanRepairGate : input.commands.dockerProof
    },
    {
      id: "autonomous-frontier-discovery",
      title: "Autonomous frontier discovery",
      status: "blocked",
      summary:
        "Not ready: the harness can route, verify, and audit bounded claims, but cannot responsibly claim autonomous solutions to frontier open problems.",
      evidence: [
        "No local audit artifact can by itself establish a new frontier result.",
        "Breakthrough claims still require formal proof, independent replay, expert review, and domain-specific validation."
      ],
      blockers: [
        "Long-horizon benchmark suites",
        "Proof-search regression budgets",
        "Independent verifier diversity on real research tasks",
        "Human expert review and publication-grade artifacts"
      ],
      nextAction: "Grow from bounded fixtures into curated professor-reviewed hard-problem benchmark suites."
    }
  ];
  const nextMilestone = stages.find((stage) => stage.status !== "ready")?.title ?? "External professor review";
  const strongestHonestClaim =
    status === "bounded-hard-math-harness"
      ? "Truth Harness is a bounded, local-first hard-math verification harness for scoped claims with replayable evidence."
      : status === "credible-verification-harness"
        ? "Truth Harness is a credible local verification harness for narrow supported claims, with larger autonomy gates still open."
        : "Truth Harness is still blocked from professor-level readiness until the local evidence floor is complete.";

  return {
    schemaVersion: "truth-harness.frontier-readiness.v0",
    status,
    frontierDiscoveryReadiness: "not-ready",
    canClaimWorldHardestProblems: false,
    strongestHonestClaim,
    summary:
      "We are building the evidence layer needed before agents attack hard problems; we are not yet an autonomous frontier solver.",
    nextMilestone,
    stages
  };
}

function checkPassed(checks: ReleaseAuditCheck[], id: string): boolean {
  return checks.find((check) => check.id === id)?.status === "pass";
}

function checkSummary(checks: ReleaseAuditCheck[], id: string): string {
  const check = checks.find((candidate) => candidate.id === id);
  return check ? `${check.status} - ${check.summary}` : "missing";
}

function firstCommand(checks: ReleaseAuditCheck[], ids: string[]): string | undefined {
  return ids.map((id) => checks.find((check) => check.id === id)?.command).find(Boolean);
}

function gateRatioAtLeast(value: string, numerator: number, denominator: number): boolean {
  const match = /^(\d+)\/(\d+)$/u.exec(value.trim());
  if (!match) {
    return false;
  }
  return Number(match[1]) >= numerator && Number(match[2]) >= denominator;
}

function workspaceCheck(status: LocalWorkspaceStatus): ReleaseAuditCheck {
  if (!status.exists || !status.manifest) {
    return failCheck({
      id: "workspace",
      title: "Workspace initialized",
      blocking: true,
      summary: "No Truth Harness workspace manifest was found.",
      details: ["Run workspace init or repair before release review."]
    });
  }
  if (status.missingDirectories.length > 0) {
    return failCheck({
      id: "workspace",
      title: "Workspace initialized",
      blocking: true,
      summary: `${status.missingDirectories.length} workspace directories are missing.`,
      command: `truth-harness workspace repair ${quoteCommandArg(status.root)}`,
      details: status.missingDirectories.slice(0, 8)
    });
  }
  return passCheck({
    id: "workspace",
    title: "Workspace initialized",
    summary: `Workspace ${status.manifest.projectId} is ready.`,
    details: [`Privacy mode: ${status.manifest.privacy.mode}.`]
  });
}

function validationCheck(pack: CredibilityPack): ReleaseAuditCheck {
  if (!pack.summary.validationPassed) {
    return failCheck({
      id: "workspace-validation",
      title: "Workspace validation",
      blocking: true,
      summary: `${pack.summary.validationErrors} validation error(s), ${pack.summary.validationWarnings} warning(s).`,
      command: "truth-harness workspace validate .",
      details: pack.validation.issueCodes.length > 0 ? pack.validation.issueCodes : ["Workspace validation failed."]
    });
  }
  return passCheck({
    id: "workspace-validation",
    title: "Workspace validation",
    summary: `${pack.summary.checkedFiles} artifact(s) checked with no validation errors.`,
    command: "truth-harness workspace validate .",
    details: ["Receipt validation is backend-aware and fails toward missing evidence."]
  });
}

function catalogCheck(status: WorkspaceCatalogStatus): ReleaseAuditCheck {
  if (!status.readable) {
    return failCheck({
      id: "catalog",
      title: "Catalog search index",
      blocking: true,
      summary: "Catalog is missing or unreadable.",
      command: "truth-harness catalog rebuild .",
      details: status.warnings
    });
  }
  if (status.stale) {
    return failCheck({
      id: "catalog",
      title: "Catalog search index",
      blocking: true,
      summary: `${status.freshness.changedArtifacts} changed, ${status.freshness.newArtifacts} new, ${status.freshness.missingArtifacts} missing artifact(s).`,
      command: "truth-harness catalog rebuild .",
      details: status.freshness.examples.length > 0 ? status.freshness.examples : ["Catalog freshness check says rebuild is required."]
    });
  }
  return passCheck({
    id: "catalog",
    title: "Catalog search index",
    summary: `${status.artifactCount} artifact(s) indexed; catalog is fresh.`,
    command: "truth-harness catalog status .",
    details: ["Catalog is a rebuildable index over canonical workspace JSON; it never upgrades trust."]
  });
}

function engineCheck(pack: CredibilityPack, required: boolean): ReleaseAuditCheck {
  const detail = [
    `Required gates: ${pack.summary.requiredEngineGates}.`,
    `Concrete gates: ${pack.summary.concreteEngineGates}.`,
    `Evidence minted: ${pack.summary.engineEvidenceMinted}.`,
    ...engineEvidenceLadderDetails(pack)
  ];
  const command = preferredEngineEvidenceCommand(pack);
  const details = [
    ...detail,
    ...engineEvidenceGuidance(pack)
  ];
  const savedRunCoversHostGaps = engineEvidenceHostGapsCoveredBySavedRun(pack, required);

  if (required && pack.summary.engineStatus !== "passed") {
    if (savedRunCoversHostGaps) {
      return passCheck({
        id: "engine-evidence",
        title: "Required engine evidence",
        summary: "Saved no-network Docker engine evidence covers the required gates; live host probes remain non-blocking.",
        command: pack.reviewerCommands.dockerProfessorEvidence,
        details: [
          ...detail,
          ...savedEngineCoverageDetails(pack),
          "Current host probes did not earn all required engine evidence, but the durable saved run covers the same required capabilities."
        ]
      });
    }

    return failCheck({
      id: "engine-evidence",
      title: "Required engine evidence",
      blocking: true,
      summary: "One or more required proof/CAS/SMT engine gates did not earn concrete evidence.",
      command,
      details: [...details, ...pack.engineEvidence.warnings.slice(0, 8)]
    });
  }
  if (!required && pack.summary.engineStatus !== "passed") {
    if (savedRunCoversHostGaps) {
      return passCheck({
        id: "engine-evidence",
        title: "Engine evidence",
        summary: "Saved no-network Docker engine evidence covers the concrete engine gates for this audit scope.",
        command: pack.reviewerCommands.dockerProfessorEvidence,
        details: [
          ...detail,
          ...savedEngineCoverageDetails(pack),
          "Host probes are allowed to be unavailable when a replayable no-network Docker engine run already covers the same capabilities."
        ]
      });
    }

    return warnCheck({
      id: "engine-evidence",
      title: "Engine evidence",
      blocking: false,
      summary: "Concrete optional engine checks are not all passing on this host.",
      command,
      details: details.length > detail.length ? details : [...detail, "Use Docker engine gates before a public or professor-facing demo."]
    });
  }
  return passCheck({
    id: "engine-evidence",
    title: "Engine evidence",
    summary: "Required engine gates earned their scoped evidence labels.",
    command: pack.reviewerCommands.verifyEngines,
    details: detail
  });
}

function engineEvidenceHostGapsCoveredBySavedRun(pack: CredibilityPack, requiredOnly: boolean): boolean {
  const gaps = pack.engineEvidence.cases.filter((entry) => {
    if (entry.status === "passed" || entry.status === "not-required") {
      return false;
    }
    if (requiredOnly) {
      return entry.required;
    }
    if (!entry.required && (entry.id === "cvc5-smt-check" || entry.id === "sage-symbolic-cross-check")) {
      return false;
    }
    return true;
  });

  return gaps.length > 0 && gaps.every((entry) => savedEngineRunCoversCapability(pack, entry.capabilityId));
}

function savedEngineRunCoversCapability(pack: CredibilityPack, capabilityId: string): boolean {
  const runs = [
    pack.engineRunLedger.latestProfessorReviewerRun,
    pack.engineRunLedger.latestStrictReviewerRun,
    ...pack.engineRunLedger.latestRuns
  ].filter((run): run is NonNullable<typeof run> => run !== undefined);

  return runs.some((run) => run.status === "passed" && run.tags.includes(capabilityId));
}

function savedEngineCoverageDetails(pack: CredibilityPack): string[] {
  const details: string[] = [];
  const professor = pack.engineRunLedger.latestProfessorReviewerRun;
  const strict = pack.engineRunLedger.latestStrictReviewerRun;
  if (professor?.status === "passed") {
    details.push(
      `Saved professor Docker run ${professor.runId} passed with ${professor.requiredPassed}/${professor.requiredTotal} required gates${formatSavedEngineRunLevel(professor)}.`
    );
  }
  if (strict?.status === "passed" && strict.runId !== professor?.runId) {
    details.push(
      `Saved strict all-engine run ${strict.runId} passed with ${strict.requiredPassed}/${strict.requiredTotal} required gates${formatSavedEngineRunLevel(strict)}.`
    );
  }
  return details.length > 0 ? details : ["A saved passing engine run covers the missing host capability."];
}

function formatSavedEngineRunLevel(run: { strongestLevelId?: string }): string {
  return run.strongestLevelId ? `; strongest level ${run.strongestLevelId}` : "";
}

function preferredEngineEvidenceCommand(pack: CredibilityPack): string {
  const dockerCommands = engineEvidenceDockerCommands(pack);
  return dockerCommands[0] ?? pack.reviewerCommands.verifyEngines;
}

function engineEvidenceGuidance(pack: CredibilityPack): string[] {
  const commands = engineEvidenceDockerCommands(pack);
  if (commands.length === 0) {
    return [];
  }

  return [
    "Host subprocess launch appears blocked for at least one engine; use the matching no-network Docker gate before treating host failures as engine failures.",
    ...commands.map((command) => `Docker fallback: ${command}.`)
  ];
}

function engineEvidenceLadderDetails(pack: CredibilityPack): string[] {
  return pack.engineEvidenceLadder.slice(0, 8).map((entry) => {
    const gate = entry.gate === "required" ? "required" : "optional";
    return `Gate ${entry.displayName} (${gate}): ${entry.evidenceTier}; status ${entry.status}; trust ${entry.trust}. ${entry.reviewerMeaning}`;
  });
}

function engineEvidenceDockerCommands(pack: CredibilityPack): string[] {
  const present = new Set(
    pack.reviewerActionPlan.actions
      .filter((action) => action.category === "engine" && action.command !== pack.reviewerCommands.verifyEngines)
      .map((action) => action.command)
  );
  return [
    pack.reviewerCommands.dockerCoreEngines,
    pack.reviewerCommands.dockerLeanFixture,
    pack.reviewerCommands.dockerSageFixture,
    pack.reviewerCommands.dockerAllEngines
  ].filter((command) => present.has(command));
}

function savedStrictEngineRunCheck(pack: CredibilityPack, required: boolean): ReleaseAuditCheck {
  const latest = pack.engineRunLedger.latestStrictReviewerRun;
  if (latest?.status === "passed") {
    return passCheck({
      id: "saved-strict-engine-run",
      title: "Saved strict engine run",
      summary: `Latest strict reviewer run ${latest.runId} passed${formatSavedEngineRunLevel(latest)}.`,
      command: "truth-harness engines verify --write --require-all-engines",
      details: [
        `Saved engine runs: ${pack.engineRunLedger.savedRuns}.`,
        latest.strictAllEngineLevelPassed
          ? "Explicit strict all-engine ladder level passed."
          : "Legacy strict reviewer record inferred from its required gate count."
      ]
    });
  }
  if (required) {
    return failCheck({
      id: "saved-strict-engine-run",
      title: "Saved strict engine run",
      blocking: true,
      summary: "No saved all-engine reviewer run has passed.",
      command: "truth-harness engines verify --write --require-all-engines",
      details: ["Write a durable engine-run record before treating release evidence as reviewer-ready."]
    });
  }
  return warnCheck({
    id: "saved-strict-engine-run",
    title: "Saved strict engine run",
    blocking: false,
    summary: "No saved all-engine reviewer run has passed yet.",
    command: "truth-harness engines verify --write --require-all-engines",
    details: ["This is not blocking for daily prototype work, but it should exist before serious public review."]
  });
}

function reviewerBundleVerificationCheck(
  verification: ReleaseAuditReviewerBundleVerificationSummary | undefined
): ReleaseAuditCheck {
  if (!verification) {
    return warnCheck({
      id: "reviewer-bundle-verification",
      title: "Reviewer bundle verification",
      blocking: false,
      summary: "No saved portable reviewer bundle verification was found.",
      command: "truth-harness workspace verify-credibility-bundle . <bundle-ref> --write",
      details: [
        "Write and verify a credibility bundle before external review so copied artifacts, manifest metadata, and source drift have a citeable local check.",
        "A missing reviewer-bundle verification does not change claim trust labels, but public handoff should include one."
      ]
    });
  }

  const command = `truth-harness workspace verify-credibility-bundle . ${verification.bundleRef} --write`;
  const details = [
    `Verification: ${verification.verificationId}.`,
    `Bundle: ${verification.bundleId}.`,
    `Artifact: ${verification.artifactPath}.`,
    `Bundle files checked: ${verification.checkedBundleFiles}.`,
    `Source files checked: ${verification.checkedSourceFiles}.`,
    `Manifest digest: ${verification.manifestDigestStatus}.`
  ];

  if (!verification.passed) {
    return failCheck({
      id: "reviewer-bundle-verification",
      title: "Reviewer bundle verification",
      blocking: true,
      summary: `Latest reviewer bundle verification ${verification.verificationId} failed copied-file integrity.`,
      command,
      details: [
        ...details,
        "The portable reviewer packet cannot be trusted as a faithful local artifact snapshot until copied-file differences are investigated."
      ]
    });
  }

  if (verification.manifestDigestStatus === "mismatch") {
    return failCheck({
      id: "reviewer-bundle-verification",
      title: "Reviewer bundle verification",
      blocking: true,
      summary: `Latest reviewer bundle verification ${verification.verificationId} found a manifest digest mismatch.`,
      command,
      details: [
        ...details,
        "Reviewer-critical metadata changed after export or the bundle is corrupted; regenerate or investigate before release."
      ]
    });
  }

  if (!verification.sourceMatchesWorkspace) {
    return failCheck({
      id: "reviewer-bundle-verification",
      title: "Reviewer bundle verification",
      blocking: true,
      summary: `Latest reviewer bundle ${verification.bundleId} no longer matches the current source workspace.`,
      command,
      details: [
        ...details,
        "A valid exported bundle can outlive later edits, but release handoff should regenerate the bundle after source drift."
      ]
    });
  }

  if (verification.manifestDigestStatus !== "verified") {
    return warnCheck({
      id: "reviewer-bundle-verification",
      title: "Reviewer bundle verification",
      blocking: false,
      summary: `Latest reviewer bundle verification ${verification.verificationId} predates manifest digest checks.`,
      command,
      details: [
        ...details,
        "Copied-file hashes passed, but reviewer commands, limitations, summaries, and provenance metadata have no manifest digest self-check."
      ]
    });
  }

  return passCheck({
    id: "reviewer-bundle-verification",
    title: "Reviewer bundle verification",
    summary: `Latest reviewer bundle verification ${verification.verificationId} passed copied-file, manifest-digest, and source-drift checks.`,
    command,
    details
  });
}

function adversarialBenchmarkCheck(pack: CredibilityPack): ReleaseAuditCheck {
  const status = pack.summary.latestAdversarialBenchmarkStatus;
  const accuracy = pack.summary.latestAdversarialBenchmarkAccuracy;
  const accuracyText = accuracy === undefined ? "unknown accuracy" : `${(accuracy * 100).toFixed(1)}% trust accuracy`;
  const evidenceDetails = adversarialBenchmarkEvidenceDetails(pack);
  if (status === "passed") {
    return passCheck({
      id: "adversarial-ai-benchmark",
      title: "Adversarial AI benchmark",
      summary: `Latest ai-failure-seed run passed with ${accuracyText}.`,
      command: pack.reviewerCommands.runAdversarialBenchmark,
      details: [
        `${pack.summary.savedBenchmarkRuns} saved benchmark run(s) are present.`,
        ...evidenceDetails,
        "The benchmark catches fluent-but-wrong AI math behavior and verifies expected evidence kinds."
      ]
    });
  }

  if (status === "failed") {
    return failCheck({
      id: "adversarial-ai-benchmark",
      title: "Adversarial AI benchmark",
      blocking: true,
      summary: `Latest ai-failure-seed run failed with ${accuracyText}.`,
      command: pack.reviewerCommands.runAdversarialBenchmark,
      details: [
        ...evidenceDetails,
        "Fix or explicitly triage failing adversarial benchmark cases before treating this workspace as professor-ready.",
        ...pack.reviewerActionPlan.actions
          .filter((action) => action.category === "benchmark")
          .slice(0, 3)
          .map((action) => action.detail)
      ]
    });
  }

  return failCheck({
    id: "adversarial-ai-benchmark",
    title: "Adversarial AI benchmark",
    blocking: true,
    summary: "No saved ai-failure-seed benchmark run was found.",
    command: pack.reviewerCommands.runAdversarialBenchmark,
    details: [
      "Run and save the adversarial benchmark before serious review so reviewers can see the system catch AI-style math mistakes.",
      "Benchmark records are evidence about system behavior; they do not prove future claims."
    ]
  });
}

function adversarialBenchmarkEvidenceDetails(pack: CredibilityPack): string[] {
  const run = pack.benchmarkLedger.latestAdversarialRun;
  if (!run) {
    return [];
  }

  const details = [
    `Artifact: ${run.path}.`,
    `Benchmark run id: ${run.artifactId}.`,
    `Replay command: ${run.replayCommand ?? run.command ?? pack.reviewerCommands.runAdversarialBenchmark}.`
  ];

  if (run.receiptReplays && run.receiptReplays.length > 0) {
    details.push(`Receipt replay example: ${run.receiptReplays[0]}.`);
  }
  if (run.failedCaseIds && run.failedCaseIds.length > 0) {
    details.push(`Failing cases: ${run.failedCaseIds.join(", ")}.`);
  }

  return details;
}

function mathCredibilityLadderCheck(pack: CredibilityPack): ReleaseAuditCheck {
  const status = pack.summary.latestMathCredibilityLadderStatus;
  const accuracy = pack.summary.latestMathCredibilityLadderAccuracy;
  const accuracyText = accuracy === undefined ? "unknown accuracy" : `${(accuracy * 100).toFixed(1)}% trust accuracy`;
  const evidenceDetails = mathCredibilityLadderEvidenceDetails(pack);
  if (status === "passed") {
    return passCheck({
      id: "math-credibility-ladder",
      title: "Math credibility ladder",
      summary: `Latest math-credibility-ladder run passed with ${accuracyText}.`,
      command: pack.reviewerCommands.runMathCredibilityLadder,
      details: [
        ...evidenceDetails,
        "The ladder is the native-safe hard-math floor: exact equality, common-denominator lemmas, parity boundaries, dimensional mistakes, interval bounds, and honest theorem-boundary refusals."
      ]
    });
  }

  if (status === "failed") {
    return failCheck({
      id: "math-credibility-ladder",
      title: "Math credibility ladder",
      blocking: true,
      summary: `Latest math-credibility-ladder run failed with ${accuracyText}.`,
      command: pack.reviewerCommands.runMathCredibilityLadder,
      details: [
        ...evidenceDetails,
        "Fix or explicitly triage failing ladder cases before treating the math lane as professor-ready.",
        ...pack.reviewerActionPlan.actions
          .filter((action) => action.category === "benchmark" && action.source.ref.includes("math-credibility-ladder"))
          .slice(0, 3)
          .map((action) => action.detail)
      ]
    });
  }

  return failCheck({
    id: "math-credibility-ladder",
    title: "Math credibility ladder",
    blocking: true,
    summary: "No saved math-credibility-ladder benchmark run was found.",
    command: pack.reviewerCommands.runMathCredibilityLadder,
    details: [
      "Run and save the math credibility ladder before serious review so reviewers can see the native-safe hard-math floor replay locally.",
      "The ladder is not a proof of future claims; it is regression evidence for the verifier routing and trust-label floor."
    ]
  });
}

function mathCredibilityLadderEvidenceDetails(pack: CredibilityPack): string[] {
  const run = pack.benchmarkLedger.latestMathCredibilityLadderRun;
  if (!run) {
    return [];
  }

  const details = [
    `Artifact: ${run.path}.`,
    `Benchmark run id: ${run.artifactId}.`,
    `Replay command: ${run.replayCommand ?? run.command ?? pack.reviewerCommands.runMathCredibilityLadder}.`
  ];

  if (run.receiptReplays && run.receiptReplays.length > 0) {
    details.push(`Receipt replay example: ${run.receiptReplays[0]}.`);
  }
  if (run.failedCaseIds && run.failedCaseIds.length > 0) {
    details.push(`Failing cases: ${run.failedCaseIds.join(", ")}.`);
  }

  return details;
}

function professorMathChallengeCheck(pack: CredibilityPack): ReleaseAuditCheck {
  const status = pack.summary.latestProfessorMathChallengeStatus;
  const accuracy = pack.summary.latestProfessorMathChallengeAccuracy;
  const accuracyText = accuracy === undefined ? "unknown accuracy" : `${(accuracy * 100).toFixed(1)}% trust accuracy`;
  const evidenceDetails = professorMathChallengeEvidenceDetails(pack);
  if (status === "passed") {
    return passCheck({
      id: "professor-math-challenge",
      title: "Professor math challenge",
      summary: "Latest professor-math-challenge run passed with " + accuracyText + ".",
      command: pack.reviewerCommands.runProfessorMathChallenge,
      details: [
        ...evidenceDetails,
        "The professor challenge is a compact native-safe reviewer exam for exact algebra slips, finite integer claims, dimensional checks, interval boundaries, and honest theorem-level refusals."
      ]
    });
  }

  if (status === "failed") {
    return failCheck({
      id: "professor-math-challenge",
      title: "Professor math challenge",
      blocking: true,
      summary: "Latest professor-math-challenge run failed with " + accuracyText + ".",
      command: pack.reviewerCommands.runProfessorMathChallenge,
      details: [
        ...evidenceDetails,
        "Fix or explicitly triage failing professor challenge cases before treating the reviewer exam as professor-ready.",
        ...pack.reviewerActionPlan.actions
          .filter((action) => action.category === "benchmark" && action.source.ref.includes("professor-math-challenge"))
          .slice(0, 3)
          .map((action) => action.detail)
      ]
    });
  }

  return failCheck({
    id: "professor-math-challenge",
    title: "Professor math challenge",
    blocking: true,
    summary: "No saved professor-math-challenge benchmark run was found.",
    command: pack.reviewerCommands.runProfessorMathChallenge,
    details: [
      "Run and save the professor challenge before serious review so reviewers can see the compact native-safe oral exam replay locally.",
      "The challenge is not evidence of frontier discovery; it is regression evidence that the verifier refuses to overclaim across reviewer-style cases."
    ]
  });
}

function professorMathChallengeEvidenceDetails(pack: CredibilityPack): string[] {
  const run = pack.benchmarkLedger.latestProfessorMathChallengeRun;
  if (!run) {
    return [];
  }

  const details = [
    "Artifact: " + run.path + ".",
    "Benchmark run id: " + run.artifactId + ".",
    "Replay command: " + (run.replayCommand ?? run.command ?? pack.reviewerCommands.runProfessorMathChallenge) + "."
  ];

  if (run.receiptReplays && run.receiptReplays.length > 0) {
    details.push("Receipt replay example: " + run.receiptReplays[0] + ".");
  }
  if (run.failedCaseIds && run.failedCaseIds.length > 0) {
    details.push("Failing cases: " + run.failedCaseIds.join(", ") + ".");
  }

  return details;
}

function hardMathClosureCheck(pack: CredibilityPack): ReleaseAuditCheck {
  const statuses = [
    pack.summary.hardMathExactClosureStatus,
    pack.summary.hardMathSymbolicClosureStatus,
    pack.summary.hardMathSmtClosureStatus
  ];
  const details = hardMathClosureEvidenceDetails(pack);
  if (statuses.every((status) => status === "passed")) {
    return passCheck({
      id: "hard-math-closure",
      title: "Hard-math autonomous closure",
      summary: `Docker closure reports are passing for exact, symbolic, and SMT fixtures (${pack.summary.savedHardMathClosureReports} saved report(s)).`,
      command: pack.reviewerCommands.runSmtHardMathClosure,
      details: [
        ...details,
        "Closure reports prove the bounded harness can route a seeded validation blocker to scoped evidence and record a reviewer artifact; they do not prove broader math claims."
      ]
    });
  }

  return failCheck({
    id: "hard-math-closure",
    title: "Hard-math autonomous closure",
    blocking: true,
    summary: `Closure reports are incomplete: ${hardMathClosureSummary(pack)}.`,
    command: firstHardMathClosureCommand(pack),
    details: [
      ...details,
      "Run all three Docker closure smokes before treating autonomous math closure as professor-ready.",
      "Required: exact fraction route evidence, symbolic CAS cross-check evidence, and SMT solver evidence attached through run-next."
    ]
  });
}

function hardMathClosureSummary(pack: CredibilityPack): string {
  return (
    `exact ${pack.summary.hardMathExactClosureStatus}, ` +
    `symbolic ${pack.summary.hardMathSymbolicClosureStatus}, ` +
    `SMT ${pack.summary.hardMathSmtClosureStatus}`
  );
}

function hardMathClosureEvidenceDetails(pack: CredibilityPack): string[] {
  return [
    `Saved closure reports: ${pack.summary.savedHardMathClosureReports}.`,
    `Exact closure: ${formatClosureCheckDetail(pack.hardMathClosureLedger.latestExactClosure)}.`,
    `Symbolic closure: ${formatClosureCheckDetail(pack.hardMathClosureLedger.latestSymbolicClosure)}.`,
    `SMT closure: ${formatClosureCheckDetail(pack.hardMathClosureLedger.latestSmtClosure)}.`
  ];
}

function formatClosureCheckDetail(report: CredibilityPack["hardMathClosureLedger"]["latestExactClosure"]): string {
  if (!report) {
    return "missing";
  }
  const status = report.failedCases === 0 && report.validationErrors === 0 ? "passed" : "failed";
  return `${status} ${report.closureId}, ${report.runtimeKind}, ${report.passedCases}/${report.totalCases}, ${report.trusts.join(", ") || "no trust"}, ${report.path}`;
}

function firstHardMathClosureCommand(pack: CredibilityPack): string {
  if (pack.summary.hardMathExactClosureStatus !== "passed") {
    return pack.reviewerCommands.runExactHardMathClosure;
  }
  if (pack.summary.hardMathSymbolicClosureStatus !== "passed") {
    return pack.reviewerCommands.runSymbolicHardMathClosure;
  }
  return pack.reviewerCommands.runSmtHardMathClosure;
}

function reportDraftsCheck(pack: CredibilityPack): ReleaseAuditCheck {
  const saved = pack.summary.savedReportDrafts;
  const needingAttention = pack.summary.reportDraftsNeedingAttention;
  const affectedDrafts = pack.workspaceReview.topItems
    .filter((item) => item.kind === "report-draft-review" && item.priority !== "low")
    .slice(0, 5);

  if (needingAttention > 0) {
    return failCheck({
      id: "report-drafts",
      title: "Saved report draft integrity",
      blocking: true,
      summary: `${needingAttention}/${saved} saved report draft(s) need integrity review before sharing.`,
      command: "truth-harness workspace reports .",
      details: [
        "Saved Markdown report drafts are human-facing review artifacts and must match the SHA-256 recorded in their JSON sidecars.",
        ...affectedDrafts.map((item) => `${item.priority}: ${item.title} (${item.source.ref})`)
      ]
    });
  }

  return passCheck({
    id: "report-drafts",
    title: "Saved report draft integrity",
    summary: `${saved} saved report draft(s) have no integrity blockers in this audit scope.`,
    command: "truth-harness workspace reports .",
    details: [
      "Report drafts are shareable summaries, not proof. Their trust remains bounded by cited receipts, bundles, and replay commands."
    ]
  });
}

function leanProofSafetyCheck(pack: CredibilityPack): ReleaseAuditCheck {
  const count = pack.summary.leanProofSafetyItems;
  const actions = pack.reviewerActionPlan.actions
    .filter((action) => action.closes.includes("proof-safety-boundary"))
    .slice(0, 5);

  if (count === 0) {
    return passCheck({
      id: "lean-proof-safety",
      title: "Lean proof-safety boundary",
      summary: "No blocking Lean proof-safety markers were found in the inspected workspace review scope.",
      command: "truth-harness proof project . --json",
      details: [
        "This is a source-boundary check only: a clean proof-safety scan does not prove a theorem.",
        "A concrete accepted proof-check record is still required before any claim can earn `proved`."
      ]
    });
  }

  return failCheck({
    id: "lean-proof-safety",
    title: "Lean proof-safety boundary",
    blocking: true,
    summary: `${count} Lean proof-safety blocker(s) remain open.`,
    command: "truth-harness workspace credibility-actions . --priority critical --json",
    details: [
      "`sorry`, `admit`, Lean metavariable holes, local `axiom`, and local `constant` markers block `proved` trust for affected Lean source.",
      "Remove or rewrite each marker, rerun the project scan, then write a scoped accepted proof-check record before relying on the source.",
      ...actions.map((action) => `${action.priority}: ${action.title} (${action.source.ref}) - ${action.command}`)
    ]
  });
}

function researchSessionContinuityCheck(pack: CredibilityPack): ReleaseAuditCheck {
  const sessions = pack.workspaceReview.summary.sessions;
  const continuationItems = pack.workspaceReview.summary.sessionTasks + pack.workspaceReview.summary.sessionNextChecks;
  const sessionItems = pack.workspaceReview.topItems
    .filter((item) => item.kind === "session-task" || item.kind === "session-next-check")
    .slice(0, 5);

  if (sessions === 0) {
    return passCheck({
      id: "research-session-continuity",
      title: "Research session continuity",
      summary: "No active research sessions were found in this audit scope.",
      command: "truth-harness research list .",
      details: [
        "Long-running agent work should create research sessions when a problem needs checkpoints, tasks, or resumable evidence trails."
      ]
    });
  }

  if (continuationItems === 0) {
    return passCheck({
      id: "research-session-continuity",
      title: "Research session continuity",
      summary: `${sessions} research session(s) are present with no open task or checkpoint continuation items.`,
      command: "truth-harness research list .",
      details: [
        "Research sessions are local runbooks. They preserve objectives, budgets, checkpoints, and evidence refs for future agents."
      ]
    });
  }

  if (
    pack.workspaceReview.summary.criticalItems === 0 &&
    pack.workspaceReview.summary.highItems === 0 &&
    pack.workspaceReview.summary.mediumItems === 0
  ) {
    return passCheck({
      id: "research-session-continuity",
      title: "Optional research session continuity",
      summary: `${continuationItems} low-priority research-session reminder item(s) remain visible across ${sessions} session(s).`,
      command: "truth-harness workspace review . --max-routes 0 --max-claims 0 --max-reports 0",
      details: [
        "Research sessions remain resumable, but current continuation items are low-priority reminders behind concrete validation gates and reviewer evidence.",
        ...sessionItems.map((item) => `${item.priority}: ${item.title} (${item.source.ref})`)
      ]
    });
  }

  return warnCheck({
    id: "research-session-continuity",
    title: "Research session continuity",
    blocking: false,
    summary: `${continuationItems} open research-session continuation item(s) across ${sessions} session(s).`,
    command: "truth-harness workspace review . --max-routes 0 --max-claims 0 --max-reports 0",
    details: [
      "Open research-session work is not a release blocker, but it should stay visible so long-running agents can resume from local evidence instead of chat memory.",
      ...sessionItems.map((item) => `${item.priority}: ${item.title} (${item.source.ref})`)
    ]
  });
}

function reviewQueueCheck(pack: CredibilityPack): ReleaseAuditCheck {
  const orderedActions = orderCredibilityActionsForRunNext(pack.reviewerActionPlan.actions);
  if (pack.summary.criticalReviewItems > 0) {
    return failCheck({
      id: "review-queue",
      title: "Open critical review queue",
      blocking: true,
      summary: `${pack.summary.criticalReviewItems} critical reviewer item(s) remain open.`,
      command: "truth-harness workspace credibility-actions .",
      details: orderedActions.slice(0, 6).map((action) => `${action.priority}: ${action.title}`)
    });
  }
  const mediumReviewItems = pack.workspaceReview.summary.mediumItems;
  const lowReviewItems = pack.workspaceReview.summary.lowItems;
  if (pack.summary.highReviewItems > 0 || mediumReviewItems > 0) {
    return warnCheck({
      id: "review-queue",
      title: "Open actionable review queue",
      blocking: false,
      summary: `${pack.summary.highReviewItems + mediumReviewItems} actionable reviewer item(s) remain open.`,
      command: "truth-harness workspace review .",
      details: pack.workspaceReview.topItems
        .filter((item) => item.priority !== "low")
        .slice(0, 5)
        .map((item) => `${item.priority}: ${item.title}`)
    });
  }
  if (lowReviewItems > 0) {
    return passCheck({
      id: "review-queue",
      title: "Optional review queue",
      summary: `${lowReviewItems} low-priority optional reviewer item(s) remain visible but are not release blockers.`,
      command: "truth-harness workspace review .",
      details: pack.workspaceReview.topItems
        .filter((item) => item.priority === "low")
        .slice(0, 5)
        .map((item) => `low: ${item.title}`)
    });
  }
  return passCheck({
    id: "review-queue",
    title: "Actionable review queue",
    summary: "No actionable reviewer queue items are open for the inspected scope.",
    command: "truth-harness workspace review .",
    details: ["No executable route, claim, report, or session blockers were found in this audit scope."]
  });
}

function sandboxCheck(
  status: CodeRunSandboxStatus,
  required: boolean,
  saved: CodeRunSandboxRunSummary | undefined
): ReleaseAuditCheck {
  if (status.available) {
    return passCheck({
      id: "code-run-sandbox",
      title: "Code-run sandbox boundary",
      summary: status.reason,
      command: "truth-harness code sandbox-status --json",
      details: status.notes
    });
  }
  if (saved?.status === "passed" && saved.canAttestNetworkNone) {
    return passCheck({
      id: "code-run-sandbox",
      title: "Code-run sandbox boundary",
      summary: `Saved Docker no-network sandbox measurement ${saved.runId} passed; current host remains unmeasured.`,
      command: "npm run docker:sandbox:write",
      details: [
        `Saved artifact: ${saved.path}.`,
        saved.summary,
        "Native host code-run evidence must still stay at networkAccess unknown unless this same host can measure a sandbox provider.",
        ...status.notes
      ]
    });
  }
  if (required) {
    return failCheck({
      id: "code-run-sandbox",
      title: "Code-run sandbox boundary",
      blocking: true,
      summary: status.reason,
      command: "npm run docker:sandbox:write",
      details: status.notes
    });
  }
  return warnCheck({
    id: "code-run-sandbox",
    title: "Code-run sandbox boundary",
    blocking: false,
    summary: status.reason,
    command: "npm run docker:sandbox:write",
    details: ["Native host code-run evidence must stay at networkAccess unknown.", ...status.notes]
  });
}

async function latestPassingSandboxRun(rootPath: string): Promise<CodeRunSandboxRunSummary | undefined> {
  const runs = await listCodeRunSandboxRuns(rootPath);
  return runs.find((run) => run.status === "passed" && run.canAttestNetworkNone);
}

function manualUiCheck(review: WebUiReviewSummary | undefined): ReleaseAuditCheck {
  if (review?.status === "passed") {
    const sufficiency = webUiReviewSufficiency(review);
    if (!sufficiency.sufficient) {
      return warnCheck({
        id: "web-ui-smoke",
        title: "Web UI launch polish",
        blocking: false,
        summary: `Latest browser UI review ${review.reviewId} passed but is too thin to clear launch polish.`,
        command: "truth-harness workspace ui-review . --pass \"browser screenshot reviewed for clipping, overflow, focus state, scroll behavior, and report readability\"",
        details: [
          `Saved artifact: ${review.path}.`,
          sufficiency.reason,
          `${review.checks.passed} passed, ${review.checks.warnings} warning, ${review.checks.failed} failed UI check(s).`,
          "A launch-clearing UI review must explicitly cover visual failure modes such as clipping, overflow, focus state, scroll behavior, or report readability.",
          "This is browser-review evidence only; it does not prove math or scientific truth."
        ]
      });
    }

    return passCheck({
      id: "web-ui-smoke",
      title: "Web UI launch polish",
      summary: `Latest browser UI review ${review.reviewId} passed at ${review.viewport.width}x${review.viewport.height}.`,
      command: "truth-harness workspace ui-review . --pass \"browser screenshot reviewed for clipping, overflow, focus state, scroll behavior, and report readability\"",
      details: [
        `Saved artifact: ${review.path}.`,
        review.screenshot ? `Screenshot: ${review.screenshot}.` : "No screenshot path was attached to this review.",
        `Target URL: ${review.targetUrl}.`,
        `${review.checks.passed} passed, ${review.checks.warnings} warning, ${review.checks.failed} failed UI check(s).`,
        "This is browser-review evidence only; it does not prove math or scientific truth."
      ]
    });
  }

  if (review) {
    return warnCheck({
      id: "web-ui-smoke",
      title: "Web UI launch polish",
      blocking: false,
      summary: `Latest browser UI review ${review.reviewId} is ${review.status}.`,
      command: "truth-harness workspace ui-review . --pass \"browser screenshot reviewed\"",
      details: [
        `Saved artifact: ${review.path}.`,
        `${review.checks.passed} passed, ${review.checks.warnings} warning, ${review.checks.failed} failed UI check(s).`,
        ...review.warnings.slice(0, 5),
        "Fix or re-review the browser surface before public recording."
      ]
    });
  }

  return warnCheck({
    id: "web-ui-smoke",
    title: "Web UI launch polish",
    blocking: false,
    summary: "Automated web smoke coverage exists, but screenshot-level UI polish still needs browser review.",
    command: "truth-harness workspace ui-review . --pass \"browser screenshot reviewed for clipping, overflow, focus state, scroll behavior, and report readability\"",
    details: [
      "Run the web smoke before public recording to catch contract and local API regressions.",
      "Then run a browser pass and write a web UI review record for overflow, clipping, focus state, scroll behavior, and report readability.",
      "This warning should become an automated browser screenshot regression gate later."
    ]
  });
}

function webUiReviewSufficiency(review: WebUiReviewSummary): { sufficient: boolean; reason: string } {
  const reviewText = `${review.checkTitles.join(" ")} ${review.warnings.join(" ")}`.toLowerCase();
  const hasEnoughDetail = review.checks.passed + review.checks.warnings + review.checks.failed >= 1;
  const coversLaunchFailureModes =
    /clipping|overflow|overlap|focus|scroll|readability|report|navigation|screenshot/u.test(reviewText);

  if (!hasEnoughDetail) {
    return {
      sufficient: false,
      reason: "The saved UI review has no checklist items."
    };
  }
  if (!coversLaunchFailureModes) {
    return {
      sufficient: false,
      reason: "The saved UI review text does not name any launch-polish failure modes."
    };
  }
  return {
    sufficient: true,
    reason: "The saved UI review names launch-polish failure modes."
  };
}

async function latestWebUiReview(rootPath: string): Promise<WebUiReviewSummary | undefined> {
  const reviews = await listWebUiReviews(rootPath);
  return reviews[0];
}

async function latestReviewerBundleVerification(
  rootPath: string
): Promise<ReleaseAuditReviewerBundleVerificationSummary | undefined> {
  const findingsDir = join(rootPath, ".truth-harness", "findings");
  let entries;
  try {
    entries = await readdir(findingsDir, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  const candidates: Array<ReleaseAuditReviewerBundleVerificationSummary & { sortTime: number }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith("-credibility-bundle-verification.json")) {
      continue;
    }

    const jsonPath = join(findingsDir, entry.name);
    try {
      const [raw, info] = await Promise.all([readFile(jsonPath, "utf8"), stat(jsonPath)]);
      const record = JSON.parse(raw) as Partial<CredibilityBundleVerification>;
      if (record.schemaVersion !== "truth-harness.credibility-bundle-verification.v0") {
        continue;
      }
      if (!record.verificationId || !record.bundleId || !record.packId || !record.verifiedAt) {
        continue;
      }

      const artifactPath = toPortableWorkspacePath(rootPath, jsonPath);
      const summary: ReleaseAuditReviewerBundleVerificationSummary & { sortTime: number } = {
        verificationId: record.verificationId,
        bundleId: record.bundleId,
        packId: record.packId,
        verifiedAt: record.verifiedAt,
        artifactPath,
        bundleRef: bundleRefForReleaseAudit(rootPath, record.bundlePath),
        passed: record.passed === true,
        sourceMatchesWorkspace: record.sourceMatchesWorkspace === true,
        checkedBundleFiles: Number.isFinite(record.checkedBundleFiles) ? record.checkedBundleFiles ?? 0 : 0,
        checkedSourceFiles: Number.isFinite(record.checkedSourceFiles) ? record.checkedSourceFiles ?? 0 : 0,
        manifestDigestStatus: record.manifestDigestStatus ?? "not-recorded",
        sortTime: Date.parse(record.verifiedAt) || info.mtimeMs
      };
      candidates.push(summary);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  candidates.sort((left, right) => right.sortTime - left.sortTime);
  const latest = candidates[0];
  if (!latest) {
    return undefined;
  }
  const { sortTime: _sortTime, ...summary } = latest;
  return summary;
}

function bundleRefForReleaseAudit(rootPath: string, bundlePath: string | undefined): string {
  const normalized = (bundlePath ?? "").trim().replace(/\\/gu, "/");
  if (normalized.startsWith("/workspace/")) {
    return normalized.slice("/workspace/".length);
  }
  if (normalized === "/workspace") {
    return ".";
  }
  if (bundlePath && isAbsolute(bundlePath)) {
    return toPortableWorkspacePath(rootPath, bundlePath);
  }
  return normalized || "<bundle-ref>";
}

function toPortableWorkspacePath(rootPath: string, artifactPath: string): string {
  const root = resolve(rootPath);
  const resolved = resolve(artifactPath);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (resolved === root) {
    return ".";
  }
  if (resolved.startsWith(rootWithSep)) {
    return relative(root, resolved).replace(/\\/gu, "/");
  }
  return artifactPath.replace(/\\/gu, "/");
}

function nextActions(checks: ReleaseAuditCheck[], pack: CredibilityPack | undefined): string[] {
  const actionCommands = checks
    .filter((check) => check.status === "fail" && check.command)
    .map((check) => check.command as string);
  const dockerEngineCommands = pack ? engineEvidenceDockerCommands(pack) : [];
  const reviewerCommands = pack
    ? orderCredibilityActionsForRunNext(pack.reviewerActionPlan.actions)
        .filter((action) => action.priority !== "low")
        .slice(0, 5)
        .map((action) => action.command)
    : [];
  return [...new Set([...actionCommands, ...dockerEngineCommands, ...reviewerCommands])].slice(0, 8);
}

function releaseAuditCommands(
  rootPath: string,
  requirements: EngineVerificationRequirements,
  options: { requireSandbox: boolean; requireSavedStrictEngineRun: boolean }
): ReleaseAudit["commands"] {
  const requirementFlags = engineRequirementFlags(requirements);
  const releaseOnlyFlags = [
    options.requireSavedStrictEngineRun ? "--require-saved-strict-engine-run" : undefined,
    options.requireSandbox ? "--require-sandbox" : undefined
  ].filter(Boolean).join(" ");
  const releaseFlags = [requirementFlags.trim(), releaseOnlyFlags].filter(Boolean).join(" ");
  const quotedRoot = quoteCommandArg(rootPath);
  return {
    releaseAudit: `truth-harness workspace release-audit ${quotedRoot}${releaseFlags ? ` ${releaseFlags}` : ""}`,
    rebuildCatalog: `truth-harness catalog rebuild ${quotedRoot}`,
    validateWorkspace: `truth-harness workspace validate ${quotedRoot}`,
    credibilityPack: `truth-harness workspace credibility-pack ${quotedRoot}${requirementFlags}`,
    credibilityActions: `truth-harness workspace credibility-actions ${quotedRoot}${requirementFlags}`,
    adversarialBenchmark: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
    mathCredibilityLadder: "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures",
    professorMathChallenge: "truth-harness bench run packages/benchmarks/suites/professor-math-challenge.json --write --fail-on-failures",
    hardMathExactClosure: "npm run docker:hard-math-closure",
    hardMathSymbolicClosure: "npm run docker:symbolic-closure",
    hardMathSmtClosure: "npm run docker:smt-closure",
    engineVerify: `truth-harness engines verify --write${requirementFlags}`,
    dockerProfessor: "npm run docker:professor",
    dockerProfessorAll: "npm run docker:professor:all",
    dockerEngines: "npm run docker:engines",
    dockerSandbox: "npm run docker:sandbox:write",
    dockerAllEngines: "npm run docker:all-engines",
    dockerLeanRepairGate: "npm run docker:proof-repair",
    dockerProof: "npm run docker:proof",
    dockerVerify: "npm run docker:verify",
    workspaceStress: "truth-harness workspace stress <throwaway-path> --receipts 100 --claims 50 --routes 20 --fail-on-validation",
    browserUrl: "http://127.0.0.1:4180/"
  };
}

function engineRequirementFlags(requirements: EngineVerificationRequirements): string {
  if (requirements.maxima && requirements.z3 && requirements.cvc5 && requirements.lean && requirements.sage) {
    return " --require-all-engines";
  }
  if (requirements.maxima && requirements.z3 && requirements.lean && !requirements.cvc5 && !requirements.sage) {
    return " --require-all-concrete";
  }
  const flags: string[] = [];
  if (requirements.maxima) {
    flags.push("--require-maxima");
  }
  if (requirements.z3) {
    flags.push("--require-z3");
  }
  if (requirements.cvc5) {
    flags.push("--require-cvc5");
  }
  if (requirements.lean) {
    flags.push("--require-lean");
  }
  if (requirements.sage) {
    flags.push("--require-sage");
  }
  return flags.length > 0 ? ` ${flags.join(" ")}` : "";
}

function hasRequiredEngine(requirements: EngineVerificationRequirements): boolean {
  return Object.values(requirements).some(Boolean);
}

function passCheck(input: Omit<ReleaseAuditCheck, "status" | "blocking"> & { blocking?: boolean }): ReleaseAuditCheck {
  return {
    ...input,
    status: "pass",
    blocking: input.blocking ?? false
  };
}

function warnCheck(input: Omit<ReleaseAuditCheck, "status">): ReleaseAuditCheck {
  return {
    ...input,
    status: "warn"
  };
}

function failCheck(input: Omit<ReleaseAuditCheck, "status">): ReleaseAuditCheck {
  return {
    ...input,
    status: "fail"
  };
}

function quoteCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/u.test(value)) {
    return value;
  }
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}
