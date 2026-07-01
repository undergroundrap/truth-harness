import type { CredibilityPack, CredibilityPackActionItem, CredibilityPackWriteResult } from "./credibility-pack.js";
import type { ReleaseAudit } from "./release-audit.js";

export interface ReleaseAuditCheckSummary {
  id: string;
  title: string;
  status: ReleaseAudit["checks"][number]["status"];
  blocking: boolean;
  summary: string;
  command?: string;
  details: string[];
}

export interface ReleaseAuditCliSummary {
  schemaVersion: "truth-harness.release-audit-summary.v0";
  createdAt: string;
  mode: ReleaseAudit["mode"];
  status: ReleaseAudit["status"];
  professorReady: boolean;
  publicLaunchReady: boolean;
  localOnly: true;
  networkAccess: "none";
  workspacePath: string;
  projectId?: string;
  summary: ReleaseAudit["summary"];
  frontierReadiness: {
    status: ReleaseAudit["frontierReadiness"]["status"];
    frontierDiscoveryReadiness: ReleaseAudit["frontierReadiness"]["frontierDiscoveryReadiness"];
    canClaimWorldHardestProblems: ReleaseAudit["frontierReadiness"]["canClaimWorldHardestProblems"];
    strongestHonestClaim: string;
    nextMilestone: string;
    stages: Array<{
      id: string;
      title: string;
      status: ReleaseAudit["frontierReadiness"]["stages"][number]["status"];
      summary: string;
      blockers: string[];
      nextAction?: string;
    }>;
  };
  checks: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
    blockingFailures: number;
    failedChecks: ReleaseAuditCheckSummary[];
    warningChecks: ReleaseAuditCheckSummary[];
  };
  nextActions: string[];
  commands: Pick<
    ReleaseAudit["commands"],
    | "releaseAudit"
    | "credibilityPack"
    | "credibilityActions"
    | "engineVerify"
    | "dockerProfessor"
    | "dockerProfessorAll"
    | "dockerSandbox"
    | "dockerAllEngines"
    | "browserUrl"
  >;
  limitations: string[];
}

export interface CredibilityActionSummary {
  actionId: string;
  category: CredibilityPackActionItem["category"];
  priority: CredibilityPackActionItem["priority"];
  title: string;
  command: string;
  closes: string[];
  source: CredibilityPackActionItem["source"];
}

export interface CredibilityPackCliSummary {
  schemaVersion: "truth-harness.credibility-pack-summary.v0";
  packId: string;
  title: string;
  createdAt: string;
  status: CredibilityPack["status"];
  professorReady: boolean;
  localOnly: true;
  networkAccess: "none";
  workspacePath: string;
  projectId?: string;
  summary: CredibilityPack["summary"];
  validation: CredibilityPack["validation"];
  engine: {
    status: CredibilityPack["summary"]["engineStatus"];
    hostProbeStatus: CredibilityPack["summary"]["engineStatus"];
    effectiveStatus: CredibilityPack["summary"]["engineStatus"] | "satisfied-by-saved-strict-docker-evidence";
    concreteGates: string;
    requiredGates: string;
    evidenceMinted: number;
    savedRuns: number;
    strongestSavedLevel?: string;
    latestStrictRunStatus?: CredibilityPack["summary"]["latestStrictEngineRunStatus"];
    latestProfessorRunStatus?: CredibilityPack["summary"]["latestProfessorEngineRunStatus"];
  };
  reviewerActions: {
    total: number;
    critical: number;
    high: number;
    next: CredibilityActionSummary[];
  };
  workspaceReview: {
    reviewId: string;
    summary: CredibilityPack["workspaceReview"]["summary"];
    topItems: CredibilityPack["workspaceReview"]["topItems"];
  };
  written: boolean;
  artifacts?: {
    jsonPath: string;
    markdownPath: string;
  };
  commands: {
    validateWorkspace: string;
    verifyEngines: string;
    reproducePack: string;
    dockerProfessor: string;
    dockerProfessorAll: string;
    dockerAllEngines: string;
  };
  warnings: string[];
  limitations: string[];
}

export function createReleaseAuditCliSummary(audit: ReleaseAudit): ReleaseAuditCliSummary {
  const failedChecks = audit.checks.filter((check) => check.status === "fail");
  const warningChecks = audit.checks.filter((check) => check.status === "warn");
  return {
    schemaVersion: "truth-harness.release-audit-summary.v0",
    createdAt: audit.createdAt,
    mode: audit.mode,
    status: audit.status,
    professorReady: audit.professorReady,
    publicLaunchReady: audit.publicLaunchReady,
    localOnly: audit.localOnly,
    networkAccess: audit.networkAccess,
    workspacePath: audit.workspacePath,
    projectId: audit.projectId,
    summary: audit.summary,
    frontierReadiness: {
      status: audit.frontierReadiness.status,
      frontierDiscoveryReadiness: audit.frontierReadiness.frontierDiscoveryReadiness,
      canClaimWorldHardestProblems: audit.frontierReadiness.canClaimWorldHardestProblems,
      strongestHonestClaim: audit.frontierReadiness.strongestHonestClaim,
      nextMilestone: audit.frontierReadiness.nextMilestone,
      stages: audit.frontierReadiness.stages.map((stage) => ({
        id: stage.id,
        title: stage.title,
        status: stage.status,
        summary: stage.summary,
        blockers: stage.blockers,
        nextAction: stage.nextAction
      }))
    },
    checks: {
      total: audit.summary.totalChecks,
      passed: audit.summary.passedChecks,
      warnings: audit.summary.warningChecks,
      failed: audit.summary.failedChecks,
      blockingFailures: audit.summary.blockingFailures,
      failedChecks: failedChecks.map(toReleaseAuditCheckCliSummary),
      warningChecks: warningChecks.map(toReleaseAuditCheckCliSummary)
    },
    nextActions: audit.nextActions,
    commands: {
      releaseAudit: audit.commands.releaseAudit,
      credibilityPack: audit.commands.credibilityPack,
      credibilityActions: audit.commands.credibilityActions,
      engineVerify: audit.commands.engineVerify,
      dockerProfessor: audit.commands.dockerProfessor,
      dockerProfessorAll: audit.commands.dockerProfessorAll,
      dockerSandbox: audit.commands.dockerSandbox,
      dockerAllEngines: audit.commands.dockerAllEngines,
      browserUrl: audit.commands.browserUrl
    },
    limitations: audit.limitations
  };
}

export function createCredibilityPackCliSummary(
  pack: CredibilityPack,
  writeResult?: CredibilityPackWriteResult
): CredibilityPackCliSummary {
  const effectiveEngineStatus = pack.summary.latestStrictEngineRunStatus === "passed"
    && pack.summary.savedEngineLadderLevel === "engine-level-5-strict-all-engines"
    ? "satisfied-by-saved-strict-docker-evidence"
    : pack.summary.engineStatus;

  return {
    schemaVersion: "truth-harness.credibility-pack-summary.v0",
    packId: pack.packId,
    title: pack.title,
    createdAt: pack.createdAt,
    status: pack.status,
    professorReady: pack.summary.professorReady,
    localOnly: pack.localOnly,
    networkAccess: pack.networkAccess,
    workspacePath: pack.workspacePath,
    projectId: pack.projectId,
    summary: pack.summary,
    validation: pack.validation,
    engine: {
      status: pack.summary.engineStatus,
      hostProbeStatus: pack.summary.engineStatus,
      effectiveStatus: effectiveEngineStatus,
      concreteGates: pack.summary.concreteEngineGates,
      requiredGates: pack.summary.requiredEngineGates,
      evidenceMinted: pack.summary.engineEvidenceMinted,
      savedRuns: pack.summary.savedEngineRuns,
      strongestSavedLevel: pack.summary.savedEngineLadderLevel,
      latestStrictRunStatus: pack.summary.latestStrictEngineRunStatus,
      latestProfessorRunStatus: pack.summary.latestProfessorEngineRunStatus
    },
    reviewerActions: {
      total: pack.reviewerActionPlan.totalActions,
      critical: pack.reviewerActionPlan.criticalActions,
      high: pack.reviewerActionPlan.highActions,
      next: pack.reviewerActionPlan.actions.slice(0, 8).map(toCredibilityActionCliSummary)
    },
    workspaceReview: {
      reviewId: pack.workspaceReview.reviewId,
      summary: pack.workspaceReview.summary,
      topItems: pack.workspaceReview.topItems
    },
    written: Boolean(writeResult),
    artifacts: writeResult ? {
      jsonPath: writeResult.jsonPath,
      markdownPath: writeResult.markdownPath
    } : undefined,
    commands: {
      validateWorkspace: pack.reviewerCommands.validateWorkspace,
      verifyEngines: pack.reviewerCommands.verifyEngines,
      reproducePack: pack.reviewerCommands.reproducePack,
      dockerProfessor: pack.reviewerCommands.dockerProfessorEvidence,
      dockerProfessorAll: pack.reviewerCommands.dockerStrictProfessorEvidence,
      dockerAllEngines: pack.reviewerCommands.dockerAllEngines
    },
    warnings: pack.warnings,
    limitations: pack.limitations
  };
}

function toReleaseAuditCheckCliSummary(check: ReleaseAudit["checks"][number]): ReleaseAuditCheckSummary {
  return {
    id: check.id,
    title: check.title,
    status: check.status,
    blocking: check.blocking,
    summary: check.summary,
    command: check.command,
    details: check.details.slice(0, 6)
  };
}

function toCredibilityActionCliSummary(action: CredibilityPackActionItem): CredibilityActionSummary {
  return {
    actionId: action.actionId,
    category: action.category,
    priority: action.priority,
    title: action.title,
    command: action.command,
    closes: action.closes,
    source: action.source
  };
}