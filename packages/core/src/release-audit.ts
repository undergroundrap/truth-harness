import { resolve } from "node:path";
import { createCredibilityPack, type CredibilityPack, type CreateCredibilityPackInput } from "./credibility-pack.js";
import type { EngineVerificationCommandRunner, EngineVerificationRequirements } from "./engine-verification.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { getCodeRunSandboxStatus, type CodeRunSandboxStatus } from "./sandbox.js";
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
    reviewItems: number;
    criticalReviewItems: number;
    sandboxAvailable: boolean;
  };
  workspace: LocalWorkspaceStatus;
  catalog?: WorkspaceCatalogStatus;
  sandbox: CodeRunSandboxStatus;
  credibilityPack?: CredibilityPack;
  checks: ReleaseAuditCheck[];
  commands: {
    releaseAudit: string;
    rebuildCatalog: string;
    validateWorkspace: string;
    credibilityPack: string;
    credibilityActions: string;
    engineVerify: string;
    dockerEngines: string;
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
      sandboxCheck(sandbox, input.requireSandbox === true)
    ];
    return buildAudit({
      createdAt,
      mode,
      rootPath,
      workspace,
      sandbox,
      commands,
      checks,
      validationPassed: false,
      catalogFresh: false,
      requiredEngineGates: "0/0",
      concreteEngineGates: "0/0",
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
    savedStrictEngineRunCheck(credibilityPack, input.requireSavedStrictEngineRun === true),
    reviewQueueCheck(credibilityPack),
    sandboxCheck(sandbox, input.requireSandbox === true),
    manualUiCheck()
  ];

  return buildAudit({
    createdAt,
    mode,
    rootPath,
    workspace,
    catalog,
    sandbox,
    credibilityPack,
    commands,
    checks,
    validationPassed: credibilityPack.summary.validationPassed,
    catalogFresh: catalog.readable && !catalog.stale,
    requiredEngineGates: credibilityPack.summary.requiredEngineGates,
    concreteEngineGates: credibilityPack.summary.concreteEngineGates,
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
  credibilityPack?: CredibilityPack;
  commands: ReleaseAudit["commands"];
  checks: ReleaseAuditCheck[];
  validationPassed: boolean;
  catalogFresh: boolean;
  requiredEngineGates: string;
  concreteEngineGates: string;
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
      reviewItems: input.reviewItems,
      criticalReviewItems: input.criticalReviewItems,
      sandboxAvailable: input.sandbox.available
    },
    workspace: input.workspace,
    catalog: input.catalog,
    sandbox: input.sandbox,
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
    `Evidence minted: ${pack.summary.engineEvidenceMinted}.`
  ];

  if (required && pack.summary.engineStatus !== "passed") {
    return failCheck({
      id: "engine-evidence",
      title: "Required engine evidence",
      blocking: true,
      summary: "One or more required proof/CAS/SMT engine gates did not earn concrete evidence.",
      command: pack.reviewerCommands.verifyEngines,
      details: [...detail, ...pack.engineEvidence.warnings.slice(0, 8)]
    });
  }
  if (!required && pack.summary.engineStatus !== "passed") {
    return warnCheck({
      id: "engine-evidence",
      title: "Engine evidence",
      blocking: false,
      summary: "Concrete optional engine checks are not all passing on this host.",
      command: pack.reviewerCommands.verifyEngines,
      details: [...detail, "Use Docker engine gates before a public or professor-facing demo."]
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
  if (pack.summary.highReviewItems > 0 || pack.summary.reviewItems > 0) {
    return warnCheck({
      id: "review-queue",
      title: "Open review queue",
      blocking: false,
      summary: `${pack.summary.reviewItems} reviewer item(s) remain open.`,
      command: "truth-harness workspace review .",
      details: pack.workspaceReview.topItems.slice(0, 5).map((item) => `${item.priority}: ${item.title}`)
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

function sandboxCheck(status: CodeRunSandboxStatus, required: boolean): ReleaseAuditCheck {
  if (status.available) {
    return passCheck({
      id: "code-run-sandbox",
      title: "Code-run sandbox boundary",
      summary: status.reason,
      command: "truth-harness code sandbox-status --json",
      details: status.notes
    });
  }
  if (required) {
    return failCheck({
      id: "code-run-sandbox",
      title: "Code-run sandbox boundary",
      blocking: true,
      summary: status.reason,
      command: "docker compose run --rm truth-harness npm run cli -- code sandbox-status --json",
      details: status.notes
    });
  }
  return warnCheck({
    id: "code-run-sandbox",
    title: "Code-run sandbox boundary",
    blocking: false,
    summary: status.reason,
    command: "docker compose run --rm truth-harness npm run cli -- code sandbox-status --json",
    details: ["Native host code-run evidence must stay at networkAccess unknown.", ...status.notes]
  });
}

function manualUiCheck(): ReleaseAuditCheck {
  return warnCheck({
    id: "web-ui-smoke",
    title: "Web UI launch polish",
    blocking: false,
    summary: "CLI release audit cannot yet prove screenshot-level UI polish.",
    command: "npm run web:restart",
    details: [
      "Before public recording, run a browser pass for overflow, clipping, focus state, scroll behavior, and report readability.",
      "This warning should become an automated browser screenshot regression gate later."
    ]
  });
}

function nextActions(checks: ReleaseAuditCheck[], pack: CredibilityPack | undefined): string[] {
  const actionCommands = checks
    .filter((check) => check.status === "fail" && check.command)
    .map((check) => check.command as string);
  const reviewerCommands = pack?.reviewerActionPlan.actions.slice(0, 5).map((action) => action.command) ?? [];
  return [...new Set([...actionCommands, ...reviewerCommands])].slice(0, 8);
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
    engineVerify: `truth-harness engines verify --write${requirementFlags}`,
    dockerEngines: "npm run docker:engines",
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
