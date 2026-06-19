import { resolve } from "node:path";
import { createCredibilityPack, type CredibilityPack, type CreateCredibilityPackInput } from "./credibility-pack.js";
import type { EngineVerificationCommandRunner, EngineVerificationRequirements } from "./engine-verification.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import {
  getCodeRunSandboxStatus,
  listCodeRunSandboxRuns,
  type CodeRunSandboxRunSummary,
  type CodeRunSandboxStatus
} from "./sandbox.js";
import { getWorkspaceCatalogStatus, type WorkspaceCatalogStatus } from "./workspace-catalog.js";

export type ReleaseAuditStatus = "ready" | "blocked";
export type ReleaseAuditMode = "prototype" | "public-review";
export type ReleaseAuditCheckStatus = "pass" | "warn" | "fail";

export interface ReleaseAuditCheck {
  id: string;
  title: string;
  status: ReleaseAuditCheckStatus;
  blocking: boolean;
  summary: string;
  command?: string;
  details: string[];
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
    adversarialBenchmark: string;
    reportDrafts: number;
    reportDraftsNeedingAttention: number;
    researchSessions: number;
    sessionContinuationItems: number;
    reviewItems: number;
    criticalReviewItems: number;
    sandboxAvailable: boolean;
  };
  workspace: LocalWorkspaceStatus;
  catalog?: WorkspaceCatalogStatus;
  sandbox: CodeRunSandboxStatus;
  sandboxEvidence?: CodeRunSandboxRunSummary;
  credibilityPack?: CredibilityPack;
  checks: ReleaseAuditCheck[];
  commands: {
    releaseAudit: string;
    rebuildCatalog: string;
    validateWorkspace: string;
    credibilityPack: string;
    credibilityActions: string;
    adversarialBenchmark: string;
    engineVerify: string;
    dockerProfessor: string;
    dockerEngines: string;
    dockerSandbox: string;
    dockerAllEngines: string;
    dockerProof: string;
    dockerVerify: string;
    workspaceStress: string;
    browserUrl: string;
  };
  nextActions: string[];
  limitations: string[];
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
      commands,
      checks,
      validationPassed: false,
      catalogFresh: false,
      requiredEngineGates: "0/0",
      concreteEngineGates: "0/0",
      adversarialBenchmark: "missing",
      reportDrafts: 0,
      reportDraftsNeedingAttention: 0,
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
    reportDraftsCheck(credibilityPack),
    researchSessionContinuityCheck(credibilityPack),
    savedStrictEngineRunCheck(credibilityPack, input.requireSavedStrictEngineRun === true),
    reviewQueueCheck(credibilityPack),
    sandboxCheck(sandbox, input.requireSandbox === true, sandboxEvidence),
    manualUiCheck()
  ];

  return buildAudit({
    createdAt,
    mode,
    rootPath,
    workspace,
    catalog,
    sandbox,
    sandboxEvidence,
    credibilityPack,
    commands,
    checks,
    validationPassed: credibilityPack.summary.validationPassed,
    catalogFresh: catalog.readable && !catalog.stale,
    requiredEngineGates: credibilityPack.summary.requiredEngineGates,
    concreteEngineGates: credibilityPack.summary.concreteEngineGates,
    adversarialBenchmark: credibilityPack.summary.latestAdversarialBenchmarkStatus,
    reportDrafts: credibilityPack.summary.savedReportDrafts,
    reportDraftsNeedingAttention: credibilityPack.summary.reportDraftsNeedingAttention,
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
    `- Required engine gates: ${audit.summary.requiredEngineGates}`,
    `- Concrete engine gates: ${audit.summary.concreteEngineGates}`,
    `- Adversarial benchmark: ${audit.summary.adversarialBenchmark}`,
    `- Report drafts: ${audit.summary.reportDrafts} saved, ${audit.summary.reportDraftsNeedingAttention} needing attention`,
    `- Research sessions: ${audit.summary.researchSessions} inspected, ${audit.summary.sessionContinuationItems} continuation item(s)`,
    `- Review queue: ${audit.summary.reviewItems} item(s), ${audit.summary.criticalReviewItems} critical`,
    `- Code-run sandbox: ${audit.summary.sandboxAvailable ? "available" : "not measured"}`,
    "",
    "## Checks",
    ""
  ];

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

function buildAudit(input: {
  createdAt: string;
  mode: ReleaseAuditMode;
  rootPath: string;
  workspace: LocalWorkspaceStatus;
  catalog?: WorkspaceCatalogStatus;
  sandbox: CodeRunSandboxStatus;
  sandboxEvidence?: CodeRunSandboxRunSummary;
  credibilityPack?: CredibilityPack;
  commands: ReleaseAudit["commands"];
  checks: ReleaseAuditCheck[];
  validationPassed: boolean;
  catalogFresh: boolean;
  requiredEngineGates: string;
  concreteEngineGates: string;
  adversarialBenchmark: string;
  reportDrafts: number;
  reportDraftsNeedingAttention: number;
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

  return {
    schemaVersion: "truth-harness.release-audit.v0",
    createdAt: input.createdAt,
    mode: input.mode,
    status,
    professorReady,
    publicLaunchReady: status === "ready" && professorReady && warningChecks === 0,
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
      adversarialBenchmark: input.adversarialBenchmark,
      reportDrafts: input.reportDrafts,
      reportDraftsNeedingAttention: input.reportDraftsNeedingAttention,
      researchSessions: input.researchSessions,
      sessionContinuationItems: input.sessionContinuationItems,
      reviewItems: input.reviewItems,
      criticalReviewItems: input.criticalReviewItems,
      sandboxAvailable: input.sandbox.available || input.sandboxEvidence?.status === "passed"
    },
    workspace: input.workspace,
    catalog: input.catalog,
    sandbox: input.sandbox,
    sandboxEvidence: input.sandboxEvidence,
    credibilityPack: input.credibilityPack,
    checks: input.checks,
    commands: input.commands,
    nextActions: nextActions(input.checks, input.credibilityPack),
    limitations: [
      "Release audit composes existing local evidence checks; it does not prove mathematical, scientific, medical, regulatory, or legal truth.",
      "Engine evidence is scoped to concrete smoke checks. Future claims still need their own receipts, proof checks, SMT/CAS artifacts, sources, simulations, or expert review.",
      "The UI/manual launch-readiness check is currently a documented warning, not a full browser screenshot regression suite.",
      "Docker commands are recommended for strict reviewer gates, but this audit does not start Docker by itself."
    ]
  };
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
    details.push(`Saved professor Docker run ${professor.runId} passed with ${professor.requiredPassed}/${professor.requiredTotal} required gates.`);
  }
  if (strict?.status === "passed" && strict.runId !== professor?.runId) {
    details.push(`Saved strict all-engine run ${strict.runId} passed with ${strict.requiredPassed}/${strict.requiredTotal} required gates.`);
  }
  return details.length > 0 ? details : ["A saved passing engine run covers the missing host capability."];
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
      summary: `Latest strict reviewer run ${latest.runId} passed.`,
      command: "truth-harness engines verify --write --require-all-engines",
      details: [`Saved engine runs: ${pack.engineRunLedger.savedRuns}.`]
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
  if (pack.summary.criticalReviewItems > 0) {
    return failCheck({
      id: "review-queue",
      title: "Open critical review queue",
      blocking: true,
      summary: `${pack.summary.criticalReviewItems} critical reviewer item(s) remain open.`,
      command: "truth-harness workspace credibility-actions .",
      details: pack.reviewerActionPlan.actions.slice(0, 6).map((action) => `${action.priority}: ${action.title}`)
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
    title: "Open review queue",
    summary: "No reviewer queue items are open for the inspected scope.",
    command: "truth-harness workspace review .",
    details: ["No critical route, claim, or session blockers were found in this audit scope."]
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

function manualUiCheck(): ReleaseAuditCheck {
  return warnCheck({
    id: "web-ui-smoke",
    title: "Web UI launch polish",
    blocking: false,
    summary: "Automated web smoke coverage exists, but screenshot-level UI polish still needs browser review.",
    command: "npm run web:smoke",
    details: [
      "Run the web smoke before public recording to catch contract and local API regressions.",
      "Then run a browser pass for overflow, clipping, focus state, scroll behavior, and report readability.",
      "This warning should become an automated browser screenshot regression gate later."
    ]
  });
}

function nextActions(checks: ReleaseAuditCheck[], pack: CredibilityPack | undefined): string[] {
  const actionCommands = checks
    .filter((check) => check.status === "fail" && check.command)
    .map((check) => check.command as string);
  const dockerEngineCommands = pack ? engineEvidenceDockerCommands(pack) : [];
  const reviewerCommands = pack?.reviewerActionPlan.actions
    .filter((action) => action.priority !== "low")
    .slice(0, 5)
    .map((action) => action.command) ?? [];
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
    engineVerify: `truth-harness engines verify --write${requirementFlags}`,
    dockerProfessor: "npm run docker:professor",
    dockerEngines: "npm run docker:engines",
    dockerSandbox: "npm run docker:sandbox:write",
    dockerAllEngines: "npm run docker:all-engines",
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
