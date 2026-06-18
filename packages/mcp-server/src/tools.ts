import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseBenchmarkSuite, runBenchmarkSuite, type BenchmarkRun } from "@truth-harness/benchmarks";
import {
  benchmarkComparisonFailsGate,
  benchmarkRunFailsGate,
  checkLeanProofArtifact,
  checkSmtLibArtifact,
  createClaimLedgerGraph,
  createClaimReviewPacket,
  createClaimChart,
  createBenchmarkComparisonRecord,
  createDiscoveryPackage,
  createEvidenceAudit,
  createExperimentLogEntry,
  createExternalDisclosureLogEntry,
  createInventionLogEntry,
  createLiteratureRecord,
  createModelContext,
  createNotebookRun,
  createReceipt,
  createSimulationLogEntry,
  createSourceCitationReceipt,
  createValidationPlan,
  createVerifierRoute,
  createCredibilityPack,
  createWorkspaceReview,
  createWorkspaceReviewFromCredibilityPack,
  createWorkspaceRunNextPlan,
  createWorkspaceGraph,
  createSymbolicCasCheckRecord,
  createEngineReadinessReport,
  getCasBackendStatus,
  isClaimLedgerDomain,
  isClaimLedgerStatus,
  getCodeRunSandboxStatus,
  getEngineManifest,
  getLocalWorkspaceStatus,
  getProofBackendStatus,
  getSmtBackendStatus,
  getWorkspaceCatalogStatus,
  ingestLocalCorpus,
  initLocalWorkspace,
  addResearchSessionCheckpoint,
  listClaimRecords,
  listBenchmarkArtifacts,
  listSymbolicCasChecks,
  listExpertReviews,
  listClaimCharts,
  listCodeRuns,
  listEvidenceAudits,
  listExperimentLogEntries,
  listExternalDisclosureLogEntries,
  listInventionLogEntries,
  listLeanProofChecks,
  listLiteratureRecords,
  listModelContexts,
  listNotebookRuns,
  listReportDrafts,
  listResearchSessions,
  listSimulationLogEntries,
  listSmtChecks,
  listValidationPlans,
  listVerifierRoutes,
  listVisualArtifacts,
  listWorkspaceEvents,
  listWorkspaceRunNextPlans,
  listWorkspaceReviews,
  listWorkspaceSnapshots,
  listVaultEntries,
  parseReceiptJson,
  parseBenchmarkRunRecordJson,
  repairLocalWorkspace,
  rebuildWorkspaceCatalog,
  readClaimRecord,
  readReportDraft,
  readResearchSession,
  readVisualArtifact,
  readWorkspaceRunNextPlan,
  readWorkspaceReview,
  readVerifierRoute,
  renderEvidenceAuditMarkdown,
  renderGraphvizVisualArtifact,
  renderPlotlyVisualArtifact,
  sealVaultFile,
  solveSmtProblem,
  updateResearchSessionTask,
  validateWorkspaceArtifacts,
  verifyVaultEntry,
  verifyCredibilityBundle,
  verifyWorkspaceSnapshot,
  renderReceipt,
  replayReceipt,
  searchLocalCorpus,
  searchWorkspaceCatalog,
  satisfyVerifierRouteObligation,
  writeExpertReview,
  writeClaimChart,
  writeClaimLedgerRecord,
  writeCredibilityBundle,
  writeSymbolicCasCheckRecord,
  writeLeanProofCheckRecord,
  writeSmtCheckRecord,
  writeBenchmarkComparisonRecord,
  writeBenchmarkRunRecord,
  writeCodeRun,
  writeEvidenceAudit,
  writeEvidenceAuditReport,
  writeDiscoveryPackage,
  writeLiteratureRecord,
  writeModelContext,
  writeNotebookRun,
  writeResearchSession,
  writeValidationPlan,
  writeVerifierRoute,
  writeReceiptPlotVisualArtifact,
  writeResearchCanvasVisualArtifact,
  writeWorkspaceGraphVisualArtifact,
  writeWorkspaceReview,
  writeWorkspaceRunNextPlan,
  writeWorkspaceSnapshot,
  type BenchmarkArtifactSummary,
  type BenchmarkComparisonRecord,
  type BenchmarkComparisonWriteResult,
  type BenchmarkRunWriteResult,
  type ClaimChart,
  type ClaimChartElementInput,
  type ClaimChartWriteResult,
  type ClaimLedgerDomain,
  type ClaimLedgerEvidenceRef,
  type ClaimLedgerRecord,
  type ClaimLedgerStatus,
  type ClaimLedgerWriteResult,
  type CasBackendStatusReport,
  type SymbolicCasBackendId,
  type SymbolicCasCheckRecord,
  type SymbolicCasCheckSummary,
  type SymbolicCasCheckWriteResult,
  type CodeRunPolicyInput,
  type CodeRunSandboxStatus,
  type CodeRunSummary,
  type CodeRunWriteResult,
  type CredibilityBundleVerification,
  type CredibilityBundleWriteResult,
  type CredibilityPack,
  type CredibilityPackActionItem,
  type DiscoveryPackage,
  type DiscoveryPackageWriteResult,
  type EngineManifest,
  type EngineReadinessReport,
  type EngineVerificationRequirements,
  type EvidenceAudit,
  type EvidenceAuditReportWriteResult,
  type EvidenceAuditWriteResult,
  type ExpertReviewEvidenceRef,
  type ExpertReviewKind,
  type ExpertReviewOutcome,
  type ExpertReviewRecord,
  type ExpertReviewStatus,
  type ExpertReviewWriteResult,
  type ExperimentKind,
  type ExperimentLogEntry,
  type ExperimentLogWriteResult,
  type ExperimentMeasurement,
  type ExperimentOutcome,
  type ExperimentStage,
  type ExternalDisclosureLogEntry,
  type ExternalDisclosureStatus,
  type ExternalDisclosureWriteResult,
  type InventionEvidenceRef,
  type InventionLogEntry,
  type InventionLogWriteResult,
  type InventionValidationStage,
  type LiteratureIdentifier,
  type LiteratureRecord,
  type LiteratureRecordKind,
  type LiteratureRecordStatus,
  type LiteratureRecordWriteResult,
  type LocalCorpusIngestResult,
  type LocalCorpusSearchResult,
  type LocalWorkspaceInitResult,
  type LocalWorkspaceRepairResult,
  type LocalWorkspaceStatus,
  type ModelContextDisclosureStatus,
  type ModelContextPacket,
  type ModelContextSection,
  type ModelContextTarget,
  type ModelContextWriteResult,
  type NotebookRunKind,
  type NotebookRunRecord,
  type NotebookRunStatus,
  type NotebookRunValue,
  type NotebookRunWriteResult,
  type LeanProofCheckRecord,
  type LeanProofCheckSummary,
  type LeanProofCheckWriteResult,
  type ProofBackendStatusReport,
  type Receipt,
  type ReceiptRenderFormat,
  type ReportDraftReadResult,
  type ReportDraftSummary,
  type ResearchEvidenceRef,
  type ResearchSession,
  type ResearchSessionCheckpointWriteResult,
  type ResearchSessionDomain,
  type ResearchSessionTaskUpdateWriteResult,
  type ResearchSessionWriteResult,
  type ResearchTaskStatus,
  type ReplayResult,
  type SimulationKind,
  type SimulationLogEntry,
  type SimulationLogWriteResult,
  type SimulationScalar,
  type SimulationStage,
  type SmtBackendId,
  type SmtBackendStatusReport,
  type SmtCheckRecord,
  type SmtCheckSummary,
  type SmtCheckWriteResult,
  type SmtProblemSolveResult,
  type ValidationEvidenceRef,
  type ValidationGateInput,
  type ValidationPlan,
  type ValidationPlanDomain,
  type ValidationPlanWriteResult,
  type VaultEnvelopeSummary,
  type VaultSealResult,
  type VaultVerifyResult,
  type VerifierRoute,
  type VerifierRouteEvidenceRef,
  type VerifierRouteSummary,
  type SatisfyVerifierRouteObligationResult,
  type VerifierRouteWriteResult,
  type VisualArtifact,
  type VisualArtifactSummary,
  type VisualArtifactWriteResult,
  type WorkspaceSnapshotSummary,
  type WorkspaceSnapshotVerification,
  type WorkspaceSnapshotWriteResult,
  type WorkspaceCatalogRebuildResult,
  type WorkspaceCatalogSearchResult,
  type WorkspaceCatalogStatus,
  type WorkspaceEventListResult,
  type TrustLabel,
  type WorkspaceValidation,
  type WorkspaceGraph,
  type WorkspaceRunNextPlan,
  type WorkspaceRunNextSummary,
  type WorkspaceRunNextWriteResult,
  type WorkspaceReview,
  type WorkspaceReviewSummary,
  type WorkspaceReviewWriteResult,
  type SympyOperation
} from "@truth-harness/core";

export interface TruthHarnessAskInput {
  problem: string;
  strict?: boolean;
}

export interface TruthHarnessAskOutput {
  error: boolean;
  receipt: Receipt;
  message: string;
}

export interface TruthHarnessVerifyInput {
  problem: string;
  workspacePath?: string;
  write?: boolean;
  strict?: boolean;
  timeoutMs?: number;
  maximaCommand?: string;
  sageCommand?: string;
  leanCommand?: string;
  z3Command?: string;
  cvc5Command?: string;
  requireIndependentSmt?: boolean;
}

export interface TruthHarnessVerifyOutput {
  error: boolean;
  written: boolean;
  route: VerifierRoute;
  result?: VerifierRouteWriteResult;
  message: string;
}

export interface TruthHarnessRouteListInput {
  workspacePath?: string;
}

export interface TruthHarnessRouteShowInput {
  workspacePath?: string;
  routeRef: string;
}

export interface TruthHarnessRouteSatisfyInput {
  workspacePath?: string;
  routeRef: string;
  obligationId: string;
  evidenceRef: VerifierRouteEvidenceRef;
}

export interface TruthHarnessEngineManifestInput {
  timeoutMs?: number;
  maximaCommand?: string;
  sageCommand?: string;
  leanCommand?: string;
  z3Command?: string;
  cvc5Command?: string;
}

export interface TruthHarnessEngineReadinessInput extends TruthHarnessEngineManifestInput {}

export interface TruthHarnessClaimAddInput {
  workspacePath?: string;
  title?: string;
  statement: string;
  domain?: ClaimLedgerDomain;
  status?: ClaimLedgerStatus;
  trust?: TrustLabel;
  tags?: string[];
  dependsOn?: string[];
  supersedes?: string[];
  derivedBy?: string;
  authors?: string[];
  evidenceRefs?: ClaimLedgerEvidenceRef[];
  nextChecks?: string[];
}

export interface TruthHarnessClaimListInput {
  workspacePath?: string;
  domain?: ClaimLedgerDomain;
  status?: ClaimLedgerStatus;
  trust?: TrustLabel;
  tag?: string;
}

export interface TruthHarnessClaimListOutput {
  total: number;
  claims: ClaimLedgerRecord[];
  graph: ReturnType<typeof createClaimLedgerGraph>;
}

export interface TruthHarnessClaimShowInput {
  workspacePath?: string;
  claimRef: string;
}

export interface TruthHarnessClaimReviewInput {
  workspacePath?: string;
  claimRef: string;
}

export interface TruthHarnessCatalogStatusInput {
  workspacePath?: string;
}

export interface TruthHarnessCatalogRebuildInput {
  workspacePath?: string;
}

export interface TruthHarnessCatalogSearchInput {
  workspacePath?: string;
  query?: string;
  kind?: string;
  trust?: TrustLabel;
  domain?: string;
  tag?: string;
  limit?: number;
}

export interface TruthHarnessBenchmarkRunInput {
  suitePath?: string;
  workspacePath?: string;
  write?: boolean;
  failOnFailures?: boolean;
}

export interface TruthHarnessBenchmarkCompareInput {
  baselinePath: string;
  currentPath: string;
  workspacePath?: string;
  write?: boolean;
  failOnRegression?: boolean;
}

export interface TruthHarnessBenchmarkListInput {
  workspacePath?: string;
}

export interface TruthHarnessCasBackendsInput {
  timeoutMs?: number;
  maximaCommand?: string;
  sageCommand?: string;
}

export interface TruthHarnessCasCheckInput {
  operation: SympyOperation;
  expression: string;
  result: string;
  variable?: string;
  backend?: SymbolicCasBackendId;
  workspacePath?: string;
  maximaCommand?: string;
  sageCommand?: string;
  timeoutMs?: number;
  write?: boolean;
  failOnUnverified?: boolean;
}

export interface TruthHarnessCasCheckOutput {
  error: boolean;
  written: boolean;
  record: SymbolicCasCheckRecord;
  result?: SymbolicCasCheckWriteResult;
  message: string;
}

export interface TruthHarnessCasListInput {
  workspacePath?: string;
}

export interface TruthHarnessProofBackendsInput {
  timeoutMs?: number;
}

export interface TruthHarnessProofCheckInput {
  sourcePath: string;
  workspacePath?: string;
  declarationName?: string;
  routeId?: string;
  obligationId?: string;
  statementHash?: string;
  statement?: string;
  timeoutMs?: number;
  write?: boolean;
  failOnUnproved?: boolean;
}

export interface TruthHarnessProofCheckOutput {
  error: boolean;
  written: boolean;
  record: LeanProofCheckRecord;
  result?: LeanProofCheckWriteResult;
  message: string;
}

export interface TruthHarnessProofListInput {
  workspacePath?: string;
}

export interface TruthHarnessSmtBackendsInput {
  timeoutMs?: number;
  z3Command?: string;
  cvc5Command?: string;
}

export interface TruthHarnessSmtCheckInput {
  sourcePath: string;
  workspacePath?: string;
  queryName?: string;
  backend?: SmtBackendId;
  z3Command?: string;
  cvc5Command?: string;
  timeoutMs?: number;
  write?: boolean;
  failOnUnverified?: boolean;
}

export interface TruthHarnessSmtCheckOutput {
  error: boolean;
  written: boolean;
  record: SmtCheckRecord;
  result?: SmtCheckWriteResult;
  message: string;
}

export interface TruthHarnessSmtListInput {
  workspacePath?: string;
}

export interface TruthHarnessSmtSolveInput {
  workspacePath?: string;
  queryName?: string;
  integerVariables: string[];
  constraints: string[];
  includeModel?: boolean;
  backend?: SmtBackendId;
  z3Command?: string;
  cvc5Command?: string;
  timeoutMs?: number;
  failOnUnverified?: boolean;
}

export interface TruthHarnessSmtSolveOutput {
  error: boolean;
  result: SmtProblemSolveResult;
  message: string;
}

export interface TruthHarnessBenchmarkRunWriteOutput {
  run: BenchmarkRun;
  written: true;
  result: BenchmarkRunWriteResult;
}

export type TruthHarnessBenchmarkRunOutput = BenchmarkRun | TruthHarnessBenchmarkRunWriteOutput;

export interface TruthHarnessBenchmarkCompareWriteOutput {
  comparison: BenchmarkComparisonRecord;
  written: true;
  result: BenchmarkComparisonWriteResult;
}

export type TruthHarnessBenchmarkCompareOutput = BenchmarkComparisonRecord | TruthHarnessBenchmarkCompareWriteOutput;

export function truthHarnessBenchmarkRunOutputFailsGate(output: TruthHarnessBenchmarkRunOutput): boolean {
  return benchmarkRunFailsGate("run" in output ? output.run : output);
}

export function truthHarnessBenchmarkCompareOutputFailsGate(output: TruthHarnessBenchmarkCompareOutput): boolean {
  return benchmarkComparisonFailsGate("comparison" in output ? output.comparison : output);
}

export interface TruthHarnessWorkspaceInput {
  workspacePath?: string;
  name?: string;
}

export interface TruthHarnessWorkspaceSnapshotInput {
  workspacePath?: string;
}

export interface TruthHarnessWorkspaceGraphInput {
  workspacePath?: string;
}

export interface TruthHarnessWorkspaceEventsInput {
  workspacePath?: string;
  limit?: number;
}

export interface TruthHarnessVisualGraphInput {
  workspacePath?: string;
  renderer?: "mermaid" | "graphviz";
  title?: string;
  maxNodes?: number;
}

export interface TruthHarnessVisualPlotInput {
  workspacePath?: string;
  receiptPath?: string;
  problem?: string;
  renderer?: "plotly" | "matplotlib" | "sage";
  title?: string;
}

export interface TruthHarnessVisualCanvasInput {
  workspacePath?: string;
  title?: string;
  maxNodes?: number;
}

export interface TruthHarnessVisualListInput {
  workspacePath?: string;
}

export interface TruthHarnessVisualShowInput {
  workspacePath?: string;
  visualRef: string;
}

export interface TruthHarnessVisualRenderInput {
  workspacePath?: string;
  visualRef: string;
  engine?: "graphviz" | "plotly";
  title?: string;
  timeoutMs?: number;
}

type TruthHarnessVisualRenderEngine = "graphviz" | "plotly";

export type TruthHarnessVisualRenderOutput =
  | {
      error: false;
      renderer: TruthHarnessVisualRenderEngine;
      result: VisualArtifactWriteResult;
      sourceVisual: VisualArtifact;
      sourceVisualRef: string;
      message: string;
    }
  | {
      error: true;
      renderer: TruthHarnessVisualRenderEngine;
      visualRef: string;
      message: string;
    };

export interface TruthHarnessWorkspaceReviewInput {
  workspacePath?: string;
  maxRoutes?: number;
  maxClaims?: number;
  maxSessions?: number;
  maxReports?: number;
  write?: boolean;
}

export interface TruthHarnessWorkspaceRunNextInput {
  workspacePath?: string;
  source?: "workspace-review" | "credibility-actions";
  maxRoutes?: number;
  maxClaims?: number;
  maxSessions?: number;
  maxReports?: number;
  timeoutMs?: number;
  maximaCommand?: string;
  sageCommand?: string;
  leanCommand?: string;
  z3Command?: string;
  cvc5Command?: string;
  smtSourcePath?: string;
  leanSourcePath?: string;
  requireMaxima?: boolean;
  requireZ3?: boolean;
  requireCvc5?: boolean;
  requireLean?: boolean;
  requireSage?: boolean;
  requireDockerCore?: boolean;
  requireAllConcrete?: boolean;
  requireAllEngines?: boolean;
  executeLocal?: boolean;
  write?: boolean;
}

export interface TruthHarnessWorkspaceRunNextListInput {
  workspacePath?: string;
}

export interface TruthHarnessWorkspaceRunNextShowInput {
  workspacePath?: string;
  planRef: string;
}

export interface TruthHarnessWorkspaceReviewListInput {
  workspacePath?: string;
}

export interface TruthHarnessWorkspaceReviewShowInput {
  workspacePath?: string;
  reviewRef: string;
}

export interface TruthHarnessReportListInput {
  workspacePath?: string;
  limit?: number;
}

export interface TruthHarnessReportReadInput {
  workspacePath?: string;
  reportId: string;
}

export interface TruthHarnessWorkspaceReviewWriteOutput {
  review: WorkspaceReview;
  written: true;
  result: WorkspaceReviewWriteResult;
}

export type TruthHarnessWorkspaceReviewOutput = WorkspaceReview | TruthHarnessWorkspaceReviewWriteOutput;

export interface TruthHarnessWorkspaceRunNextWriteOutput {
  plan: WorkspaceRunNextPlan;
  written: true;
  result: WorkspaceRunNextWriteResult;
}

export type TruthHarnessWorkspaceRunNextOutput = WorkspaceRunNextPlan | TruthHarnessWorkspaceRunNextWriteOutput;

export interface TruthHarnessWorkspaceSnapshotVerifyInput {
  workspacePath?: string;
  snapshotRef: string;
}

export interface TruthHarnessWorkspaceCredibilityBundleInput {
  workspacePath?: string;
  maxRoutes?: number;
  maxClaims?: number;
  maxSessions?: number;
  maxReports?: number;
  timeoutMs?: number;
  maximaCommand?: string;
  sageCommand?: string;
  leanCommand?: string;
  z3Command?: string;
  cvc5Command?: string;
  smtSourcePath?: string;
  leanSourcePath?: string;
  requireMaxima?: boolean;
  requireZ3?: boolean;
  requireCvc5?: boolean;
  requireLean?: boolean;
  requireSage?: boolean;
  requireDockerCore?: boolean;
  requireAllConcrete?: boolean;
  requireAllEngines?: boolean;
}

export interface TruthHarnessWorkspaceCredibilityActionsInput extends TruthHarnessWorkspaceCredibilityBundleInput {
  priority?: CredibilityPackActionItem["priority"];
  category?: CredibilityPackActionItem["category"];
}

export interface TruthHarnessWorkspaceCredibilityActionsOutput {
  schemaVersion: "truth-harness.credibility-actions.v0";
  packId: string;
  status: CredibilityPack["status"];
  professorReady: boolean;
  totalActions: number;
  criticalActions: number;
  highActions: number;
  actions: CredibilityPackActionItem[];
  reviewerCommands: CredibilityPack["reviewerCommands"];
  localOnly: true;
  networkAccess: "none";
}

export interface TruthHarnessWorkspaceCredibilityBundleVerifyInput {
  workspacePath?: string;
  bundleRef: string;
}

export interface TruthHarnessSourceIngestInput {
  paths: string[];
  workspacePath?: string;
}

export interface TruthHarnessSourceSearchInput {
  query: string;
  workspacePath?: string;
  limit?: number;
}

export interface TruthHarnessSourceCiteInput {
  claim: string;
  query?: string;
  workspacePath?: string;
  limit?: number;
  strict?: boolean;
}

export interface TruthHarnessSourceCiteOutput {
  error: boolean;
  receipt: Receipt;
  message: string;
}

export interface TruthHarnessLiteratureLogInput {
  workspacePath?: string;
  title: string;
  kind?: LiteratureRecordKind;
  status?: LiteratureRecordStatus;
  authors?: string[];
  venue?: string;
  year?: number;
  identifiers?: LiteratureIdentifier[];
  localRefs?: string[];
  corpusRefs?: string[];
  evidenceRefs?: string[];
  summary?: string;
  keyClaims?: string[];
  methodNotes?: string[];
  limitations?: string[];
  relevance?: string[];
  qualityFlags?: string[];
  nextChecks?: string[];
  write?: boolean;
}

export type TruthHarnessLiteratureLogOutput =
  | {
      written: false;
      record: LiteratureRecord;
    }
  | {
      written: true;
      result: LiteratureRecordWriteResult;
    };

export interface TruthHarnessLiteratureListInput {
  workspacePath?: string;
}

export interface TruthHarnessNotebookRunLogInput {
  workspacePath?: string;
  title?: string;
  purpose: string;
  kind?: NotebookRunKind;
  status?: NotebookRunStatus;
  runner?: string;
  runnerVersion?: string;
  command?: string;
  workingDirectory?: string;
  notebookRefs?: string[];
  codeRefs?: string[];
  inputRefs?: string[];
  outputRefs?: string[];
  runtime?: string;
  runtimeVersion?: string;
  operatingSystem?: string;
  dependencies?: string[];
  environmentVariables?: NotebookRunValue[];
  parameters?: NotebookRunValue[];
  metrics?: NotebookRunValue[];
  observations?: string[];
  limitations?: string[];
  nextChecks?: string[];
  deterministic?: boolean;
  replayNotes?: string[];
  write?: boolean;
}

export type TruthHarnessNotebookRunLogOutput =
  | {
      written: false;
      record: NotebookRunRecord;
    }
  | {
      written: true;
      result: NotebookRunWriteResult;
    };

export interface TruthHarnessNotebookRunListInput {
  workspacePath?: string;
}

export interface TruthHarnessCodeRunInput {
  workspacePath?: string;
  title?: string;
  purpose: string;
  command: string;
  args?: string[];
  workingDirectory?: string;
  codeRefs?: string[];
  inputRefs?: string[];
  outputRefs?: string[];
  evidenceRefs?: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  policy?: CodeRunPolicyInput;
  failOnNonzero?: boolean;
}

export interface TruthHarnessCodeRunOutput {
  error: boolean;
  result: CodeRunWriteResult;
  message: string;
}

export interface TruthHarnessCodeSandboxStatusOutput {
  error: boolean;
  status: CodeRunSandboxStatus;
  message: string;
}

export interface TruthHarnessCodeRunListInput {
  workspacePath?: string;
}

export interface TruthHarnessSimulationLogInput {
  workspacePath?: string;
  title?: string;
  question: string;
  kind?: SimulationKind;
  stage?: SimulationStage;
  engine: string;
  engineVersion?: string;
  modelName: string;
  modelVersion?: string;
  inputRefs?: string[];
  outputRefs?: string[];
  codeRefs?: string[];
  parameters?: SimulationScalar[];
  metrics?: SimulationScalar[];
  assumptions?: string[];
  uncertainty?: string[];
  limitations?: string[];
  nextChecks?: string[];
}

export interface TruthHarnessSimulationListInput {
  workspacePath?: string;
}

export interface TruthHarnessExperimentLogInput {
  workspacePath?: string;
  title?: string;
  question: string;
  kind?: ExperimentKind;
  stage?: ExperimentStage;
  protocolRefs?: string[];
  dataRefs?: string[];
  analysisRefs?: string[];
  evidenceRefs?: string[];
  observations?: string[];
  measurements?: ExperimentMeasurement[];
  outcomeStatus?: ExperimentOutcome;
  outcomeSummary?: string;
  limitations?: string[];
  nextChecks?: string[];
  humanSubjects?: boolean;
  biologicalOrMedical?: boolean;
  ethicsApprovalRefs?: string[];
  regulatoryReviewRefs?: string[];
}

export interface TruthHarnessExperimentListInput {
  workspacePath?: string;
}

export interface TruthHarnessVaultSealInput {
  workspacePath?: string;
  sourcePath: string;
  label?: string;
  keyEnv?: string;
}

export interface TruthHarnessVaultListInput {
  workspacePath?: string;
}

export interface TruthHarnessVaultVerifyInput {
  workspacePath?: string;
  vaultRef: string;
  keyEnv?: string;
}

export interface TruthHarnessEvidenceAuditInput {
  workspacePath?: string;
  claim: string;
  title?: string;
  evidenceRefs?: InventionEvidenceRef[];
  write?: boolean;
  writeReport?: boolean;
  includeMarkdown?: boolean;
}

export type TruthHarnessEvidenceAuditOutput =
  | {
      written: false;
      audit: EvidenceAudit;
      markdown?: string;
    }
  | {
      written: true;
      report: false;
      result: EvidenceAuditWriteResult;
    }
  | {
      written: true;
      report: true;
      result: EvidenceAuditReportWriteResult;
    };

export interface TruthHarnessEvidenceAuditListInput {
  workspacePath?: string;
}

export interface TruthHarnessValidationPlanInput {
  workspacePath?: string;
  title?: string;
  objective?: string;
  claim: string;
  domains?: ValidationPlanDomain[];
  evidenceRefs?: ValidationEvidenceRef[];
  gates?: ValidationGateInput[];
  write?: boolean;
}

export type TruthHarnessValidationPlanOutput =
  | {
      written: false;
      plan: ValidationPlan;
    }
  | {
      written: true;
      result: ValidationPlanWriteResult;
    };

export interface TruthHarnessValidationPlanListInput {
  workspacePath?: string;
}

export interface TruthHarnessResearchSessionStartInput {
  workspacePath?: string;
  title?: string;
  objective: string;
  domains?: ResearchSessionDomain[];
  hypotheses?: string[];
  claims?: string[];
  evidenceRefs?: ResearchEvidenceRef[];
  snapshotRefs?: string[];
  tasks?: string[];
  maxDepth?: number;
  maxBranches?: number;
  maxToolCalls?: number;
  maxWallMinutes?: number;
}

export interface TruthHarnessResearchSessionCheckpointInput {
  workspacePath?: string;
  sessionRef: string;
  summary: string;
  evidenceRefs?: ResearchEvidenceRef[];
  snapshotRefs?: string[];
  decisions?: string[];
  nextChecks?: string[];
}

export interface TruthHarnessResearchSessionTaskUpdateInput {
  workspacePath?: string;
  sessionRef: string;
  taskRef: string;
  status?: ResearchTaskStatus;
  evidenceRefs?: ResearchEvidenceRef[];
  nextChecks?: string[];
}

export interface TruthHarnessResearchSessionListInput {
  workspacePath?: string;
}

export interface TruthHarnessResearchSessionShowInput {
  workspacePath?: string;
  sessionRef: string;
}

export interface TruthHarnessExpertReviewLogInput {
  workspacePath?: string;
  title?: string;
  subject: string;
  question?: string;
  kind?: ExpertReviewKind;
  status?: ExpertReviewStatus;
  reviewerRole: string;
  reviewerNameOrOrg?: string;
  reviewerCredentials?: string;
  conflictDisclosure?: string;
  evidenceRefs?: ExpertReviewEvidenceRef[];
  findings?: string[];
  limitations?: string[];
  recommendations?: string[];
  requiredNextChecks?: string[];
  outcomeStatus?: ExpertReviewOutcome;
  outcomeSummary?: string;
}

export interface TruthHarnessExpertReviewListInput {
  workspacePath?: string;
}

export interface TruthHarnessInventionLogInput {
  hypothesis: string;
  workspacePath?: string;
  title?: string;
  problem?: string;
  validationStage?: InventionValidationStage;
  evidenceRefs?: InventionEvidenceRef[];
  noveltyNotes?: string[];
  priorArtNotes?: string[];
  risks?: string[];
  nextChecks?: string[];
}

export interface TruthHarnessInventionListInput {
  workspacePath?: string;
}

export interface TruthHarnessDiscoveryPackageInput {
  workspacePath?: string;
  entryId?: string;
  write?: boolean;
}

export type TruthHarnessDiscoveryPackageOutput =
  | {
      written: false;
      package: DiscoveryPackage;
    }
  | {
      written: true;
      result: DiscoveryPackageWriteResult;
    };

export interface TruthHarnessClaimChartInput {
  workspacePath?: string;
  entryId?: string;
  title?: string;
  elements: ClaimChartElementInput[];
  evidenceRefs?: InventionEvidenceRef[];
  noveltyQuestions?: string[];
  priorArtNotes?: string[];
  reductionToPracticeRefs?: string[];
  write?: boolean;
}

export type TruthHarnessClaimChartOutput =
  | {
      written: false;
      chart: ClaimChart;
    }
  | {
      written: true;
      result: ClaimChartWriteResult;
    };

export interface TruthHarnessClaimChartListInput {
  workspacePath?: string;
}

export interface TruthHarnessModelContextPrepareInput {
  workspacePath?: string;
  title?: string;
  purpose: string;
  service: string;
  target?: ModelContextTarget;
  model?: string;
  endpoint?: string;
  dataClasses?: string[];
  selectedContextRefs?: string[];
  sections?: ModelContextSection[];
  redactions?: string[];
  exclusions?: string[];
  approvalRef?: string;
  approvedBy?: string;
  approvedAt?: string;
  disclosureRef?: string;
  disclosureStatus?: ModelContextDisclosureStatus;
  write?: boolean;
}

export type TruthHarnessModelContextPrepareOutput =
  | {
      written: false;
      packet: ModelContextPacket;
    }
  | {
      written: true;
      result: ModelContextWriteResult;
    };

export interface TruthHarnessModelContextListInput {
  workspacePath?: string;
}

export interface TruthHarnessExternalDisclosureLogInput {
  workspacePath?: string;
  service: string;
  model?: string;
  endpoint?: string;
  purpose: string;
  dataClasses: string[];
  contextSummary: string;
  selectedContextRefs?: string[];
  userInitiated?: boolean;
  approvalRef?: string;
  status?: ExternalDisclosureStatus;
  responseSummary?: string;
  outputRefs?: string[];
}

export interface TruthHarnessExternalDisclosureListInput {
  workspacePath?: string;
}

export interface TruthHarnessReplayInput {
  receiptJson?: string;
  receiptPath?: string;
}

export interface TruthHarnessRenderReceiptInput {
  receiptJson?: string;
  receiptPath?: string;
  format?: ReceiptRenderFormat;
}

export interface TruthHarnessRenderReceiptOutput {
  runId: string;
  trust: Receipt["trust"];
  format: ReceiptRenderFormat;
  rendered: string;
}

export function handleTruthHarnessAsk(input: TruthHarnessAskInput): TruthHarnessAskOutput {
  const receipt = createReceipt(input.problem);
  const strictFailure = input.strict === true && receipt.trust === "unverified";

  return {
    error: strictFailure,
    receipt,
    message: strictFailure
      ? "Strict mode failed because the receipt is unverified."
      : `Receipt ${receipt.runId} completed with trust ${receipt.trust}.`
  };
}

export async function handleTruthHarnessVerify(input: TruthHarnessVerifyInput): Promise<TruthHarnessVerifyOutput> {
  const write = input.write === true
    ? await writeVerifierRoute({
        rootPath: resolveWorkspaceRoot(input.workspacePath),
        problem: input.problem,
        timeoutMs: input.timeoutMs,
        maximaCommand: input.maximaCommand,
        sageCommand: input.sageCommand,
        leanCommand: input.leanCommand,
        z3Command: input.z3Command,
        cvc5Command: input.cvc5Command,
        smtReviewPolicy: input.requireIndependentSmt ? "independent" : "single"
      })
    : undefined;
  const route =
    write?.route ??
    createVerifierRoute(input.problem, {
      timeoutMs: input.timeoutMs,
      maximaCommand: input.maximaCommand,
      sageCommand: input.sageCommand,
      leanCommand: input.leanCommand,
      z3Command: input.z3Command,
      cvc5Command: input.cvc5Command,
      smtReviewPolicy: input.requireIndependentSmt ? "independent" : "single"
    });
  const strictFailure = input.strict === true && route.finalTrust === "unverified";

  return {
    error: strictFailure,
    written: write !== undefined,
    route,
    result: write,
    message: strictFailure
      ? "Strict mode failed because the verifier route ended unverified."
      : `Verifier route ${route.routeId} completed with final trust ${route.finalTrust}${write ? " and was written to the local route ledger" : ""}.`
  };
}

export async function handleTruthHarnessRouteList(input: TruthHarnessRouteListInput): Promise<{
  total: number;
  routes: VerifierRouteSummary[];
}> {
  const routes = await listVerifierRoutes(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: routes.length,
    routes
  };
}

export async function handleTruthHarnessRouteShow(input: TruthHarnessRouteShowInput): Promise<VerifierRoute> {
  return readVerifierRoute(resolveWorkspaceRoot(input.workspacePath), input.routeRef);
}

export async function handleTruthHarnessRouteSatisfy(
  input: TruthHarnessRouteSatisfyInput
): Promise<SatisfyVerifierRouteObligationResult> {
  return satisfyVerifierRouteObligation({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    routeRef: input.routeRef,
    obligationId: input.obligationId,
    evidenceRef: input.evidenceRef
  });
}

export function handleTruthHarnessEngineManifest(input: TruthHarnessEngineManifestInput = {}): EngineManifest {
  return getEngineManifest({
    timeoutMs: input.timeoutMs,
    maximaCommand: input.maximaCommand,
    sageCommand: input.sageCommand,
    leanCommand: input.leanCommand,
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command
  });
}

export function handleTruthHarnessEngineReadiness(input: TruthHarnessEngineReadinessInput = {}): EngineReadinessReport {
  return createEngineReadinessReport({
    timeoutMs: input.timeoutMs,
    maximaCommand: input.maximaCommand,
    sageCommand: input.sageCommand,
    leanCommand: input.leanCommand,
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command
  });
}

export async function handleTruthHarnessClaimAdd(input: TruthHarnessClaimAddInput): Promise<ClaimLedgerWriteResult> {
  return writeClaimLedgerRecord({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    statement: input.statement,
    domain: input.domain,
    status: input.status,
    trust: input.trust,
    tags: input.tags,
    dependsOn: input.dependsOn,
    supersedes: input.supersedes,
    derivedBy: input.derivedBy,
    authors: input.authors,
    evidenceRefs: input.evidenceRefs,
    nextChecks: input.nextChecks
  });
}

export async function handleTruthHarnessClaimList(input: TruthHarnessClaimListInput): Promise<TruthHarnessClaimListOutput> {
  const tag = input.tag?.replace(/^#/u, "").toLowerCase();
  const claims = (await listClaimRecords(resolveWorkspaceRoot(input.workspacePath))).filter((claim) => {
    if (input.domain && claim.domain !== input.domain) return false;
    if (input.status && claim.status !== input.status) return false;
    if (input.trust && claim.trust !== input.trust) return false;
    if (tag && !claim.tags.includes(tag)) return false;
    return true;
  });

  return {
    total: claims.length,
    claims,
    graph: createClaimLedgerGraph(claims)
  };
}

export async function handleTruthHarnessClaimShow(input: TruthHarnessClaimShowInput): Promise<ClaimLedgerRecord> {
  return readClaimRecord(resolveWorkspaceRoot(input.workspacePath), input.claimRef);
}

export async function handleTruthHarnessClaimReview(input: TruthHarnessClaimReviewInput) {
  return createClaimReviewPacket({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    claimRef: input.claimRef
  });
}

export async function handleTruthHarnessCatalogStatus(
  input: TruthHarnessCatalogStatusInput
): Promise<WorkspaceCatalogStatus> {
  return getWorkspaceCatalogStatus(resolveWorkspaceRoot(input.workspacePath), { checkFiles: true });
}

export async function handleTruthHarnessCatalogRebuild(
  input: TruthHarnessCatalogRebuildInput
): Promise<WorkspaceCatalogRebuildResult> {
  return rebuildWorkspaceCatalog({
    rootPath: resolveWorkspaceRoot(input.workspacePath)
  });
}

export async function handleTruthHarnessCatalogSearch(
  input: TruthHarnessCatalogSearchInput
): Promise<WorkspaceCatalogSearchResult> {
  return searchWorkspaceCatalog({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    query: input.query,
    kind: input.kind,
    trust: input.trust,
    domain: input.domain,
    tag: input.tag,
    limit: input.limit
  });
}

export async function handleTruthHarnessBenchmarkRun(
  input: TruthHarnessBenchmarkRunInput & { write: true }
): Promise<TruthHarnessBenchmarkRunWriteOutput>;
export async function handleTruthHarnessBenchmarkRun(
  input: TruthHarnessBenchmarkRunInput & { write?: false | undefined }
): Promise<BenchmarkRun>;
export async function handleTruthHarnessBenchmarkRun(input: TruthHarnessBenchmarkRunInput): Promise<TruthHarnessBenchmarkRunOutput>;
export async function handleTruthHarnessBenchmarkRun(input: TruthHarnessBenchmarkRunInput): Promise<TruthHarnessBenchmarkRunOutput> {
  const suitePath = input.suitePath ?? "packages/benchmarks/suites/foundations-seed.json";
  const resolvedSuitePath = resolveWorkspacePath(suitePath);
  const suite = parseBenchmarkSuite(JSON.parse(await readFile(resolvedSuitePath, "utf8")) as unknown);
  const run = runBenchmarkSuite(suite);

  if (input.write !== true) {
    return run;
  }

  return {
    run,
    written: true,
    result: await writeBenchmarkRunRecord({
      rootPath: resolveWorkspaceRoot(input.workspacePath),
      run,
      suiteDescription: suite.description,
      suitePath,
      runnerName: "truth-harness-mcp",
      runnerAdapter: "local-receipt-engine",
      command: `truth-harness bench run ${quoteCommandArg(suitePath)}`,
      workingDirectory: getWorkspaceRoot()
    })
  };
}

export async function handleTruthHarnessBenchmarkCompare(
  input: TruthHarnessBenchmarkCompareInput & { write: true }
): Promise<TruthHarnessBenchmarkCompareWriteOutput>;
export async function handleTruthHarnessBenchmarkCompare(
  input: TruthHarnessBenchmarkCompareInput & { write?: false | undefined }
): Promise<BenchmarkComparisonRecord>;
export async function handleTruthHarnessBenchmarkCompare(input: TruthHarnessBenchmarkCompareInput): Promise<TruthHarnessBenchmarkCompareOutput>;
export async function handleTruthHarnessBenchmarkCompare(input: TruthHarnessBenchmarkCompareInput): Promise<TruthHarnessBenchmarkCompareOutput> {
  const baseline = parseBenchmarkRunRecordJson(
    await readFile(resolveWorkspacePath(input.baselinePath), "utf8"),
    input.baselinePath
  );
  const current = parseBenchmarkRunRecordJson(await readFile(resolveWorkspacePath(input.currentPath), "utf8"), input.currentPath);
  const comparison = createBenchmarkComparisonRecord({
    baseline,
    current,
    baselineRef: input.baselinePath,
    currentRef: input.currentPath
  });

  if (input.write !== true) {
    return comparison;
  }

  return {
    comparison,
    written: true,
    result: await writeBenchmarkComparisonRecord({
      rootPath: resolveWorkspaceRoot(input.workspacePath),
      baseline,
      current,
      baselineRef: input.baselinePath,
      currentRef: input.currentPath
    })
  };
}

export async function handleTruthHarnessBenchmarkList(input: TruthHarnessBenchmarkListInput): Promise<{
  total: number;
  artifacts: BenchmarkArtifactSummary[];
}> {
  const artifacts = await listBenchmarkArtifacts(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: artifacts.length,
    artifacts
  };
}

export function handleTruthHarnessCasBackends(input: TruthHarnessCasBackendsInput): CasBackendStatusReport {
  return getCasBackendStatus({
    maximaCommand: input.maximaCommand,
    sageCommand: input.sageCommand,
    timeoutMs: input.timeoutMs
  });
}

export async function handleTruthHarnessCasCheck(input: TruthHarnessCasCheckInput): Promise<TruthHarnessCasCheckOutput> {
  const prompt = {
    operation: input.operation,
    expression: input.expression,
    variable: input.variable ?? "x"
  };
  const write = input.write === true
    ? await writeSymbolicCasCheckRecord({
        rootPath: resolveWorkspaceRoot(input.workspacePath),
        prompt,
        result: input.result,
        backend: input.backend,
        maximaCommand: input.maximaCommand,
        sageCommand: input.sageCommand,
        timeoutMs: input.timeoutMs
      })
    : undefined;
  const record =
    write?.record ??
    createSymbolicCasCheckRecord({
      prompt,
      result: input.result,
      backend: input.backend,
      maximaCommand: input.maximaCommand,
      sageCommand: input.sageCommand,
      timeoutMs: input.timeoutMs
    });
  const error = input.failOnUnverified === true && record.trust !== "cross-checked";

  return {
    error,
    written: write !== undefined,
    record,
    result: write,
    message: error
      ? "CAS gate failed because the independent symbolic check did not pass."
      : `CAS check ${record.checkId} completed with trust ${record.trust}.`
  };
}

export async function handleTruthHarnessCasList(input: TruthHarnessCasListInput): Promise<{
  total: number;
  checks: SymbolicCasCheckSummary[];
}> {
  const checks = await listSymbolicCasChecks(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: checks.length,
    checks
  };
}

export function handleTruthHarnessProofBackends(input: TruthHarnessProofBackendsInput): ProofBackendStatusReport {
  return getProofBackendStatus({
    timeoutMs: input.timeoutMs
  });
}

export async function handleTruthHarnessProofCheck(input: TruthHarnessProofCheckInput): Promise<TruthHarnessProofCheckOutput> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspacePath);
  const write = input.write === true
    ? await writeLeanProofCheckRecord({
        rootPath: workspaceRoot,
        sourcePath: input.sourcePath,
        declarationName: input.declarationName,
        scope: proofCheckScopeFromInput(input),
        timeoutMs: input.timeoutMs
      })
    : undefined;
  const resolvedSourcePath = resolvePathUnderRoot(workspaceRoot, input.sourcePath);
  const record =
    write?.record ??
    checkLeanProofArtifact({
      sourcePath: resolvedSourcePath,
      sourceRef: input.sourcePath,
      sourceText: await readFile(resolvedSourcePath, "utf8"),
      declarationName: input.declarationName,
      scope: proofCheckScopeFromInput(input),
      timeoutMs: input.timeoutMs,
      replayCommand: `truth-harness proof check ${quoteCommandArg(input.sourcePath)} --json`
    });
  const error = input.failOnUnproved === true && record.trust !== "proved";

  return {
    error,
    written: write !== undefined,
    record,
    result: write,
    message: error
      ? "Proof gate failed because Lean did not accept the proof artifact."
      : `Proof check ${record.checkId} completed with trust ${record.trust}.`
  };
}

export async function handleTruthHarnessProofList(input: TruthHarnessProofListInput): Promise<{
  total: number;
  checks: LeanProofCheckSummary[];
}> {
  const checks = await listLeanProofChecks(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: checks.length,
    checks
  };
}

export function handleTruthHarnessSmtBackends(input: TruthHarnessSmtBackendsInput): SmtBackendStatusReport {
  return getSmtBackendStatus({
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command,
    timeoutMs: input.timeoutMs
  });
}

export async function handleTruthHarnessSmtCheck(input: TruthHarnessSmtCheckInput): Promise<TruthHarnessSmtCheckOutput> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspacePath);
  const write = input.write === true
    ? await writeSmtCheckRecord({
        rootPath: workspaceRoot,
        sourcePath: input.sourcePath,
        queryName: input.queryName,
        backend: input.backend,
        z3Command: input.z3Command,
        cvc5Command: input.cvc5Command,
        timeoutMs: input.timeoutMs
      })
    : undefined;
  const resolvedSourcePath = resolvePathUnderRoot(workspaceRoot, input.sourcePath);
  const record =
    write?.record ??
    checkSmtLibArtifact({
      sourcePath: resolvedSourcePath,
      sourceRef: input.sourcePath,
      sourceText: await readFile(resolvedSourcePath, "utf8"),
      queryName: input.queryName,
      backend: input.backend,
      z3Command: input.z3Command,
      cvc5Command: input.cvc5Command,
      timeoutMs: input.timeoutMs,
      replayCommand: `truth-harness smt check ${quoteCommandArg(input.sourcePath)} --backend ${input.backend ?? "z3"} --json`
    });
  const error = input.failOnUnverified === true && record.trust !== "smt-checked";

  return {
    error,
    written: write !== undefined,
    record,
    result: write,
    message: error
      ? "SMT gate failed because the solver did not return sat or unsat for the artifact."
      : `SMT check ${record.checkId} completed with trust ${record.trust}.`
  };
}

export async function handleTruthHarnessSmtList(input: TruthHarnessSmtListInput): Promise<{
  total: number;
  checks: SmtCheckSummary[];
}> {
  const checks = await listSmtChecks(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: checks.length,
    checks
  };
}

export async function handleTruthHarnessSmtSolve(input: TruthHarnessSmtSolveInput): Promise<TruthHarnessSmtSolveOutput> {
  const result = await solveSmtProblem({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    queryName: input.queryName,
    variables: input.integerVariables,
    constraints: input.constraints,
    includeModel: input.includeModel,
    backend: input.backend,
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command,
    timeoutMs: input.timeoutMs
  });
  const error = input.failOnUnverified === true && result.check.record.trust !== "smt-checked";

  return {
    error,
    result,
    message: error
      ? "SMT solve gate failed because the generated artifact did not receive sat or unsat from the solver."
      : `SMT problem ${result.problem.problemId} generated ${result.check.record.checkId} with trust ${result.check.record.trust}.`
  };
}

export async function handleTruthHarnessWorkspaceInit(input: TruthHarnessWorkspaceInput): Promise<LocalWorkspaceInitResult> {
  return initLocalWorkspace(resolveWorkspaceRoot(input.workspacePath), { displayName: input.name });
}

export async function handleTruthHarnessWorkspaceStatus(input: TruthHarnessWorkspaceInput): Promise<LocalWorkspaceStatus> {
  return getLocalWorkspaceStatus(resolveWorkspaceRoot(input.workspacePath));
}

export async function handleTruthHarnessWorkspaceRepair(input: TruthHarnessWorkspaceInput): Promise<LocalWorkspaceRepairResult> {
  return repairLocalWorkspace(resolveWorkspaceRoot(input.workspacePath));
}

export async function handleTruthHarnessWorkspaceValidate(input: TruthHarnessWorkspaceSnapshotInput): Promise<WorkspaceValidation> {
  return validateWorkspaceArtifacts({
    rootPath: resolveWorkspaceRoot(input.workspacePath)
  });
}

export async function handleTruthHarnessWorkspaceGraph(input: TruthHarnessWorkspaceGraphInput): Promise<WorkspaceGraph> {
  return createWorkspaceGraph({
    rootPath: resolveWorkspaceRoot(input.workspacePath)
  });
}

export async function handleTruthHarnessWorkspaceEvents(input: TruthHarnessWorkspaceEventsInput): Promise<WorkspaceEventListResult> {
  return listWorkspaceEvents(resolveWorkspaceRoot(input.workspacePath), input.limit ?? 50);
}

export async function handleTruthHarnessVisualGraph(input: TruthHarnessVisualGraphInput): Promise<VisualArtifactWriteResult> {
  return writeWorkspaceGraphVisualArtifact({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    renderer: input.renderer ?? "graphviz",
    title: input.title,
    maxNodes: input.maxNodes
  });
}

export async function handleTruthHarnessVisualPlot(input: TruthHarnessVisualPlotInput): Promise<VisualArtifactWriteResult> {
  return writeReceiptPlotVisualArtifact({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    receiptPath: input.receiptPath,
    problem: input.problem,
    renderer: input.renderer ?? "plotly",
    title: input.title
  });
}

export async function handleTruthHarnessVisualCanvas(input: TruthHarnessVisualCanvasInput): Promise<VisualArtifactWriteResult> {
  return writeResearchCanvasVisualArtifact({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    maxNodes: input.maxNodes
  });
}

export async function handleTruthHarnessVisualList(input: TruthHarnessVisualListInput): Promise<{
  total: number;
  visuals: VisualArtifactSummary[];
}> {
  const visuals = await listVisualArtifacts(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: visuals.length,
    visuals
  };
}

export async function handleTruthHarnessVisualShow(input: TruthHarnessVisualShowInput): Promise<VisualArtifact> {
  return readVisualArtifact(resolveWorkspaceRoot(input.workspacePath), input.visualRef);
}

export async function handleTruthHarnessVisualRender(
  input: TruthHarnessVisualRenderInput
): Promise<TruthHarnessVisualRenderOutput> {
  const engine = input.engine ?? "graphviz";
  if (engine !== "graphviz" && engine !== "plotly") {
    return {
      error: true,
      renderer: "graphviz",
      visualRef: input.visualRef,
      message: `Unsupported visual render engine ${JSON.stringify(input.engine)}. Expected "graphviz" or "plotly".`
    };
  }

  try {
    const rootPath = resolveWorkspaceRoot(input.workspacePath);
    const rendered = engine === "graphviz"
      ? await renderGraphvizVisualArtifact({
          rootPath,
          visualRef: input.visualRef,
          title: input.title,
          timeoutMs: input.timeoutMs
        })
      : await renderPlotlyVisualArtifact({
          rootPath,
          visualRef: input.visualRef,
          title: input.title
        });
    return {
      error: false,
      renderer: engine,
      result: {
        visual: rendered.visual,
        jsonPath: rendered.jsonPath,
        markdownPath: rendered.markdownPath
      },
      sourceVisual: rendered.sourceVisual,
      sourceVisualRef: rendered.sourceVisualRef,
      message: `Rendered ${rendered.sourceVisual.visualId} into ${rendered.visual.visualId} with local ${engine}.`
    };
  } catch (error) {
    return {
      error: true,
      renderer: engine,
      visualRef: input.visualRef,
      message: error instanceof Error ? error.message : `${engine} visual render failed.`
    };
  }
}

export async function handleTruthHarnessWorkspaceReview(
  input: TruthHarnessWorkspaceReviewInput
): Promise<TruthHarnessWorkspaceReviewOutput> {
  const reviewInput = {
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    maxRoutes: input.maxRoutes,
    maxClaims: input.maxClaims,
    maxSessions: input.maxSessions,
    maxReports: input.maxReports
  };

  if (input.write) {
    const result = await writeWorkspaceReview(reviewInput);
    return {
      review: result.review,
      written: true,
      result
    };
  }

  return createWorkspaceReview(reviewInput);
}

export async function handleTruthHarnessWorkspaceRunNext(
  input: TruthHarnessWorkspaceRunNextInput
): Promise<TruthHarnessWorkspaceRunNextOutput> {
  const rootPath = resolveWorkspaceRoot(input.workspacePath);
  const review = await createRunNextReviewFromInput(rootPath, input);

  const plan = await createWorkspaceRunNextPlan({
    rootPath,
    review,
    executeLocal: input.executeLocal === true
  });

  if (input.write) {
    return {
      plan,
      written: true,
      result: await writeWorkspaceRunNextPlan({ rootPath, plan })
    };
  }

  return plan;
}

async function createRunNextReviewFromInput(
  rootPath: string,
  input: TruthHarnessWorkspaceRunNextInput
): Promise<WorkspaceReview> {
  const source = input.source ?? "workspace-review";
  if (source === "workspace-review") {
    return createWorkspaceReview({
      rootPath,
      maxRoutes: input.maxRoutes,
      maxClaims: input.maxClaims,
      maxSessions: input.maxSessions,
      maxReports: input.maxReports
    });
  }

  if (source === "credibility-actions") {
    const pack = await createCredibilityPack({
      rootPath,
      maxRoutes: input.maxRoutes,
      maxClaims: input.maxClaims,
      maxSessions: input.maxSessions,
      maxReports: input.maxReports,
      timeoutMs: input.timeoutMs,
      maximaCommand: input.maximaCommand,
      sageCommand: input.sageCommand,
      leanCommand: input.leanCommand,
      z3Command: input.z3Command,
      cvc5Command: input.cvc5Command,
      smtSourcePath: input.smtSourcePath,
      leanSourcePath: input.leanSourcePath,
      engineRequirements: credibilityEngineRequirementsFromInput(input)
    });
    return createWorkspaceReviewFromCredibilityPack({ rootPath, pack });
  }

  throw new Error(`Unsupported run-next source: ${source}`);
}

export async function handleTruthHarnessWorkspaceRunNextList(input: TruthHarnessWorkspaceRunNextListInput): Promise<{
  total: number;
  plans: WorkspaceRunNextSummary[];
}> {
  const plans = await listWorkspaceRunNextPlans(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: plans.length,
    plans
  };
}

export async function handleTruthHarnessWorkspaceRunNextShow(
  input: TruthHarnessWorkspaceRunNextShowInput
): Promise<WorkspaceRunNextPlan> {
  return readWorkspaceRunNextPlan(resolveWorkspaceRoot(input.workspacePath), input.planRef);
}

export async function handleTruthHarnessWorkspaceReviewList(input: TruthHarnessWorkspaceReviewListInput): Promise<{
  total: number;
  reviews: WorkspaceReviewSummary[];
}> {
  const reviews = await listWorkspaceReviews(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: reviews.length,
    reviews
  };
}

export async function handleTruthHarnessWorkspaceReviewShow(
  input: TruthHarnessWorkspaceReviewShowInput
): Promise<WorkspaceReview> {
  return readWorkspaceReview(resolveWorkspaceRoot(input.workspacePath), input.reviewRef);
}

export async function handleTruthHarnessReportList(input: TruthHarnessReportListInput): Promise<{
  total: number;
  reports: ReportDraftSummary[];
}> {
  const reports = await listReportDrafts({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    limit: input.limit
  });

  return {
    total: reports.length,
    reports
  };
}

export async function handleTruthHarnessReportRead(input: TruthHarnessReportReadInput): Promise<ReportDraftReadResult> {
  return readReportDraft({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    reportId: input.reportId
  });
}

export async function handleTruthHarnessWorkspaceSnapshot(
  input: TruthHarnessWorkspaceSnapshotInput
): Promise<WorkspaceSnapshotWriteResult> {
  return writeWorkspaceSnapshot({
    rootPath: resolveWorkspaceRoot(input.workspacePath)
  });
}

export async function handleTruthHarnessWorkspaceSnapshotList(input: TruthHarnessWorkspaceSnapshotInput): Promise<{
  total: number;
  snapshots: WorkspaceSnapshotSummary[];
}> {
  const snapshots = await listWorkspaceSnapshots(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: snapshots.length,
    snapshots
  };
}

export async function handleTruthHarnessWorkspaceSnapshotVerify(
  input: TruthHarnessWorkspaceSnapshotVerifyInput
): Promise<WorkspaceSnapshotVerification> {
  return verifyWorkspaceSnapshot({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    snapshotRef: input.snapshotRef
  });
}

export async function handleTruthHarnessWorkspaceCredibilityBundle(
  input: TruthHarnessWorkspaceCredibilityBundleInput
): Promise<CredibilityBundleWriteResult> {
  return writeCredibilityBundle({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    maxRoutes: input.maxRoutes,
    maxClaims: input.maxClaims,
    maxSessions: input.maxSessions,
    maxReports: input.maxReports,
    timeoutMs: input.timeoutMs,
    maximaCommand: input.maximaCommand,
    sageCommand: input.sageCommand,
    leanCommand: input.leanCommand,
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command,
    smtSourcePath: input.smtSourcePath,
    leanSourcePath: input.leanSourcePath,
    engineRequirements: credibilityEngineRequirementsFromInput(input)
  });
}

export async function handleTruthHarnessWorkspaceCredibilityActions(
  input: TruthHarnessWorkspaceCredibilityActionsInput
): Promise<TruthHarnessWorkspaceCredibilityActionsOutput> {
  const pack = await createCredibilityPack({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    maxRoutes: input.maxRoutes,
    maxClaims: input.maxClaims,
    maxSessions: input.maxSessions,
    maxReports: input.maxReports,
    timeoutMs: input.timeoutMs,
    maximaCommand: input.maximaCommand,
    sageCommand: input.sageCommand,
    leanCommand: input.leanCommand,
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command,
    smtSourcePath: input.smtSourcePath,
    leanSourcePath: input.leanSourcePath,
    engineRequirements: credibilityEngineRequirementsFromInput(input)
  });
  const actions = pack.reviewerActionPlan.actions.filter((action) => {
    if (input.priority && action.priority !== input.priority) {
      return false;
    }
    if (input.category && action.category !== input.category) {
      return false;
    }
    return true;
  });

  return {
    schemaVersion: "truth-harness.credibility-actions.v0",
    packId: pack.packId,
    status: pack.status,
    professorReady: pack.summary.professorReady,
    totalActions: actions.length,
    criticalActions: actions.filter((action) => action.priority === "critical").length,
    highActions: actions.filter((action) => action.priority === "high").length,
    actions,
    reviewerCommands: pack.reviewerCommands,
    localOnly: true,
    networkAccess: "none"
  };
}

export async function handleTruthHarnessWorkspaceCredibilityBundleVerify(
  input: TruthHarnessWorkspaceCredibilityBundleVerifyInput
): Promise<CredibilityBundleVerification> {
  return verifyCredibilityBundle({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    bundleRef: input.bundleRef
  });
}

export async function handleTruthHarnessSourceIngest(input: TruthHarnessSourceIngestInput): Promise<LocalCorpusIngestResult> {
  return ingestLocalCorpus({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    paths: input.paths
  });
}

export async function handleTruthHarnessSourceSearch(input: TruthHarnessSourceSearchInput): Promise<LocalCorpusSearchResult> {
  return searchLocalCorpus({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    query: input.query,
    limit: input.limit
  });
}

export async function handleTruthHarnessSourceCite(input: TruthHarnessSourceCiteInput): Promise<TruthHarnessSourceCiteOutput> {
  const receipt = await createSourceCitationReceipt({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    claim: input.claim,
    query: input.query,
    limit: input.limit
  });
  const strictFailure = input.strict === true && receipt.trust === "unverified";

  return {
    error: strictFailure,
    receipt,
    message: strictFailure
      ? "Strict mode failed because no local source-cited evidence was found."
      : `Source-cited receipt ${receipt.runId} completed with trust ${receipt.trust}.`
  };
}

export async function handleTruthHarnessLiteratureLog(input: TruthHarnessLiteratureLogInput): Promise<TruthHarnessLiteratureLogOutput> {
  const literatureInput = {
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    kind: input.kind,
    status: input.status,
    authors: input.authors,
    venue: input.venue,
    year: input.year,
    identifiers: input.identifiers,
    localRefs: input.localRefs,
    corpusRefs: input.corpusRefs,
    evidenceRefs: input.evidenceRefs,
    summary: input.summary,
    keyClaims: input.keyClaims,
    methodNotes: input.methodNotes,
    limitations: input.limitations,
    relevance: input.relevance,
    qualityFlags: input.qualityFlags,
    nextChecks: input.nextChecks
  };

  if (input.write) {
    return {
      written: true,
      result: await writeLiteratureRecord(literatureInput)
    };
  }

  return {
    written: false,
    record: await createLiteratureRecord(literatureInput)
  };
}

export async function handleTruthHarnessLiteratureList(input: TruthHarnessLiteratureListInput): Promise<{
  total: number;
  records: LiteratureRecord[];
}> {
  const records = await listLiteratureRecords(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: records.length,
    records
  };
}

export async function handleTruthHarnessNotebookRunLog(input: TruthHarnessNotebookRunLogInput): Promise<TruthHarnessNotebookRunLogOutput> {
  const notebookRunInput = {
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    purpose: input.purpose,
    kind: input.kind,
    status: input.status,
    runner: input.runner,
    runnerVersion: input.runnerVersion,
    command: input.command,
    workingDirectory: input.workingDirectory,
    notebookRefs: input.notebookRefs,
    codeRefs: input.codeRefs,
    inputRefs: input.inputRefs,
    outputRefs: input.outputRefs,
    runtime: input.runtime,
    runtimeVersion: input.runtimeVersion,
    operatingSystem: input.operatingSystem,
    dependencies: input.dependencies,
    environmentVariables: input.environmentVariables,
    parameters: input.parameters,
    metrics: input.metrics,
    observations: input.observations,
    limitations: input.limitations,
    nextChecks: input.nextChecks,
    deterministic: input.deterministic,
    replayNotes: input.replayNotes
  };

  if (input.write) {
    return {
      written: true,
      result: await writeNotebookRun(notebookRunInput)
    };
  }

  return {
    written: false,
    record: await createNotebookRun(notebookRunInput)
  };
}

export async function handleTruthHarnessNotebookRunList(input: TruthHarnessNotebookRunListInput): Promise<{
  total: number;
  records: NotebookRunRecord[];
}> {
  const records = await listNotebookRuns(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: records.length,
    records
  };
}

export async function handleTruthHarnessCodeRun(input: TruthHarnessCodeRunInput): Promise<TruthHarnessCodeRunOutput> {
  assertMcpCodeRunAllowed(input.policy);
  const result = await writeCodeRun({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    purpose: input.purpose,
    command: input.command,
    args: input.args,
    workingDirectory: input.workingDirectory,
    codeRefs: input.codeRefs,
    inputRefs: input.inputRefs,
    outputRefs: input.outputRefs,
    evidenceRefs: input.evidenceRefs,
    timeoutMs: input.timeoutMs,
    maxOutputBytes: input.maxOutputBytes,
    policy: input.policy
  });
  const error = input.failOnNonzero === true && result.record.execution.status !== "passed";

  return {
    error,
    result,
    message: error
      ? `Code run ${result.record.runId} did not pass: ${result.record.execution.status}.`
      : `Code run ${result.record.runId} completed with status ${result.record.execution.status}.`
  };
}

export function handleTruthHarnessCodeSandboxStatus(): TruthHarnessCodeSandboxStatusOutput {
  const status = getCodeRunSandboxStatus();
  return {
    error: !status.available,
    status,
    message: status.available
      ? `Code-run sandbox ${status.provider} is available.`
      : `Code-run sandbox is unavailable: ${status.reason}`
  };
}

function assertMcpCodeRunAllowed(policy: CodeRunPolicyInput | undefined): void {
  if (!isTruthyEnv(process.env.TRUTH_HARNESS_ALLOW_CODE_RUN)) {
    throw new Error("MCP code execution is disabled. Set TRUTH_HARNESS_ALLOW_CODE_RUN=1 and provide an explicit policy.allowedExecutables list to enable truth_harness_code_run.");
  }

  if (policy?.requireSandbox === true || isTruthyEnv(process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN)) {
    return;
  }

  throw new Error(
    "MCP unsandboxed code execution is disabled. Set policy.requireSandbox=true to require a measured sandbox, or set TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN=1 to permit direct local execution with networkAccess unknown."
  );
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

export async function handleTruthHarnessCodeRunList(input: TruthHarnessCodeRunListInput): Promise<{
  total: number;
  records: CodeRunSummary[];
}> {
  const records = await listCodeRuns(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: records.length,
    records
  };
}

export async function handleTruthHarnessSimulationLog(input: TruthHarnessSimulationLogInput): Promise<SimulationLogWriteResult> {
  return createSimulationLogEntry({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    question: input.question,
    kind: input.kind,
    stage: input.stage,
    engine: input.engine,
    engineVersion: input.engineVersion,
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    inputRefs: input.inputRefs,
    outputRefs: input.outputRefs,
    codeRefs: input.codeRefs,
    parameters: input.parameters,
    metrics: input.metrics,
    assumptions: input.assumptions,
    uncertainty: input.uncertainty,
    limitations: input.limitations,
    nextChecks: input.nextChecks
  });
}

export async function handleTruthHarnessSimulationList(input: TruthHarnessSimulationListInput): Promise<{
  total: number;
  entries: SimulationLogEntry[];
}> {
  const entries = await listSimulationLogEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTruthHarnessExperimentLog(input: TruthHarnessExperimentLogInput): Promise<ExperimentLogWriteResult> {
  return createExperimentLogEntry({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    question: input.question,
    kind: input.kind,
    stage: input.stage,
    protocolRefs: input.protocolRefs,
    dataRefs: input.dataRefs,
    analysisRefs: input.analysisRefs,
    evidenceRefs: input.evidenceRefs,
    observations: input.observations,
    measurements: input.measurements,
    outcomeStatus: input.outcomeStatus,
    outcomeSummary: input.outcomeSummary,
    limitations: input.limitations,
    nextChecks: input.nextChecks,
    humanSubjects: input.humanSubjects,
    biologicalOrMedical: input.biologicalOrMedical,
    ethicsApprovalRefs: input.ethicsApprovalRefs,
    regulatoryReviewRefs: input.regulatoryReviewRefs
  });
}

export async function handleTruthHarnessExperimentList(input: TruthHarnessExperimentListInput): Promise<{
  total: number;
  entries: ExperimentLogEntry[];
}> {
  const entries = await listExperimentLogEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTruthHarnessVaultSeal(input: TruthHarnessVaultSealInput): Promise<VaultSealResult> {
  return sealVaultFile({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    sourcePath: input.sourcePath,
    label: input.label,
    keyEnv: input.keyEnv
  });
}

export async function handleTruthHarnessVaultList(input: TruthHarnessVaultListInput): Promise<{
  total: number;
  entries: VaultEnvelopeSummary[];
}> {
  const entries = await listVaultEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTruthHarnessVaultVerify(input: TruthHarnessVaultVerifyInput): Promise<VaultVerifyResult> {
  return verifyVaultEntry({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    vaultRef: input.vaultRef,
    keyEnv: input.keyEnv
  });
}

export async function handleTruthHarnessEvidenceAudit(input: TruthHarnessEvidenceAuditInput): Promise<TruthHarnessEvidenceAuditOutput> {
  const rootPath = resolveWorkspaceRoot(input.workspacePath);
  const auditInput = {
    rootPath,
    claim: input.claim,
    title: input.title,
    evidenceRefs: input.evidenceRefs
  };

  if (input.writeReport) {
    return {
      written: true,
      report: true,
      result: await writeEvidenceAuditReport(auditInput)
    };
  }

  if (input.write) {
    return {
      written: true,
      report: false,
      result: await writeEvidenceAudit(auditInput)
    };
  }

  const audit = await createEvidenceAudit(auditInput);
  return {
    written: false,
    audit,
    markdown: input.includeMarkdown ? renderEvidenceAuditMarkdown(audit) : undefined
  };
}

export async function handleTruthHarnessEvidenceAuditList(input: TruthHarnessEvidenceAuditListInput): Promise<{
  total: number;
  audits: EvidenceAudit[];
}> {
  const audits = await listEvidenceAudits(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: audits.length,
    audits
  };
}

export async function handleTruthHarnessValidationPlan(input: TruthHarnessValidationPlanInput): Promise<TruthHarnessValidationPlanOutput> {
  const planInput = {
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    objective: input.objective,
    claim: input.claim,
    domains: input.domains,
    evidenceRefs: input.evidenceRefs,
    gates: input.gates
  };

  if (input.write) {
    return {
      written: true,
      result: await writeValidationPlan(planInput)
    };
  }

  return {
    written: false,
    plan: await createValidationPlan(planInput)
  };
}

export async function handleTruthHarnessValidationPlanList(input: TruthHarnessValidationPlanListInput): Promise<{
  total: number;
  plans: ValidationPlan[];
}> {
  const plans = await listValidationPlans(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: plans.length,
    plans
  };
}

export async function handleTruthHarnessResearchSessionStart(
  input: TruthHarnessResearchSessionStartInput
): Promise<ResearchSessionWriteResult> {
  return writeResearchSession({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    objective: input.objective,
    domains: input.domains,
    hypotheses: input.hypotheses,
    claims: input.claims,
    evidenceRefs: input.evidenceRefs,
    snapshotRefs: input.snapshotRefs,
    tasks: input.tasks,
    maxDepth: input.maxDepth,
    maxBranches: input.maxBranches,
    maxToolCalls: input.maxToolCalls,
    maxWallMinutes: input.maxWallMinutes
  });
}

export async function handleTruthHarnessResearchSessionCheckpoint(
  input: TruthHarnessResearchSessionCheckpointInput
): Promise<ResearchSessionCheckpointWriteResult> {
  return addResearchSessionCheckpoint({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    sessionRef: input.sessionRef,
    summary: input.summary,
    evidenceRefs: input.evidenceRefs,
    snapshotRefs: input.snapshotRefs,
    decisions: input.decisions,
    nextChecks: input.nextChecks
  });
}

export async function handleTruthHarnessResearchSessionTaskUpdate(
  input: TruthHarnessResearchSessionTaskUpdateInput
): Promise<ResearchSessionTaskUpdateWriteResult> {
  return updateResearchSessionTask({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    sessionRef: input.sessionRef,
    taskRef: input.taskRef,
    status: input.status,
    evidenceRefs: input.evidenceRefs,
    nextChecks: input.nextChecks
  });
}

export async function handleTruthHarnessResearchSessionList(input: TruthHarnessResearchSessionListInput): Promise<{
  total: number;
  sessions: ResearchSession[];
}> {
  const sessions = await listResearchSessions(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: sessions.length,
    sessions
  };
}

export async function handleTruthHarnessResearchSessionShow(
  input: TruthHarnessResearchSessionShowInput
): Promise<ResearchSession> {
  return readResearchSession(resolveWorkspaceRoot(input.workspacePath), input.sessionRef);
}

export async function handleTruthHarnessExpertReviewLog(input: TruthHarnessExpertReviewLogInput): Promise<ExpertReviewWriteResult> {
  return writeExpertReview({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    subject: input.subject,
    question: input.question,
    kind: input.kind,
    status: input.status,
    reviewerRole: input.reviewerRole,
    reviewerNameOrOrg: input.reviewerNameOrOrg,
    reviewerCredentials: input.reviewerCredentials,
    conflictDisclosure: input.conflictDisclosure,
    evidenceRefs: input.evidenceRefs,
    findings: input.findings,
    limitations: input.limitations,
    recommendations: input.recommendations,
    requiredNextChecks: input.requiredNextChecks,
    outcomeStatus: input.outcomeStatus,
    outcomeSummary: input.outcomeSummary
  });
}

export async function handleTruthHarnessExpertReviewList(input: TruthHarnessExpertReviewListInput): Promise<{
  total: number;
  reviews: ExpertReviewRecord[];
}> {
  const reviews = await listExpertReviews(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: reviews.length,
    reviews
  };
}

export async function handleTruthHarnessInventionLog(input: TruthHarnessInventionLogInput): Promise<InventionLogWriteResult> {
  return createInventionLogEntry({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    problem: input.problem,
    hypothesis: input.hypothesis,
    validationStage: input.validationStage,
    evidenceRefs: input.evidenceRefs,
    noveltyNotes: input.noveltyNotes,
    priorArtNotes: input.priorArtNotes,
    risks: input.risks,
    nextChecks: input.nextChecks
  });
}

export async function handleTruthHarnessInventionList(input: TruthHarnessInventionListInput): Promise<{
  total: number;
  entries: InventionLogEntry[];
}> {
  const entries = await listInventionLogEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTruthHarnessDiscoveryPackage(
  input: TruthHarnessDiscoveryPackageInput
): Promise<TruthHarnessDiscoveryPackageOutput> {
  const rootPath = resolveWorkspaceRoot(input.workspacePath);
  if (input.write) {
    return {
      written: true,
      result: await writeDiscoveryPackage({ rootPath, entryId: input.entryId })
    };
  }

  return {
    written: false,
    package: await createDiscoveryPackage({ rootPath, entryId: input.entryId })
  };
}

export async function handleTruthHarnessClaimChart(input: TruthHarnessClaimChartInput): Promise<TruthHarnessClaimChartOutput> {
  const rootPath = resolveWorkspaceRoot(input.workspacePath);
  const chartInput = {
    rootPath,
    entryId: input.entryId,
    title: input.title,
    elements: input.elements,
    evidenceRefs: input.evidenceRefs,
    noveltyQuestions: input.noveltyQuestions,
    priorArtNotes: input.priorArtNotes,
    reductionToPracticeRefs: input.reductionToPracticeRefs
  };

  if (input.write) {
    return {
      written: true,
      result: await writeClaimChart(chartInput)
    };
  }

  return {
    written: false,
    chart: await createClaimChart(chartInput)
  };
}

export async function handleTruthHarnessClaimChartList(input: TruthHarnessClaimChartListInput): Promise<{
  total: number;
  charts: ClaimChart[];
}> {
  const charts = await listClaimCharts(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: charts.length,
    charts
  };
}

export async function handleTruthHarnessModelContextPrepare(
  input: TruthHarnessModelContextPrepareInput
): Promise<TruthHarnessModelContextPrepareOutput> {
  const modelContextInput = {
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    title: input.title,
    purpose: input.purpose,
    service: input.service,
    target: input.target,
    model: input.model,
    endpoint: input.endpoint,
    dataClasses: input.dataClasses,
    selectedContextRefs: input.selectedContextRefs,
    sections: input.sections,
    redactions: input.redactions,
    exclusions: input.exclusions,
    approvalRef: input.approvalRef,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    disclosureRef: input.disclosureRef,
    disclosureStatus: input.disclosureStatus
  };

  if (input.write) {
    return {
      written: true,
      result: await writeModelContext(modelContextInput)
    };
  }

  return {
    written: false,
    packet: await createModelContext(modelContextInput)
  };
}

export async function handleTruthHarnessModelContextList(input: TruthHarnessModelContextListInput): Promise<{
  total: number;
  packets: ModelContextPacket[];
}> {
  const packets = await listModelContexts(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: packets.length,
    packets
  };
}

export async function handleTruthHarnessExternalDisclosureLog(
  input: TruthHarnessExternalDisclosureLogInput
): Promise<ExternalDisclosureWriteResult> {
  return createExternalDisclosureLogEntry({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    service: input.service,
    model: input.model,
    endpoint: input.endpoint,
    purpose: input.purpose,
    dataClasses: input.dataClasses,
    contextSummary: input.contextSummary,
    selectedContextRefs: input.selectedContextRefs,
    userInitiated: input.userInitiated,
    approvalRef: input.approvalRef,
    status: input.status,
    responseSummary: input.responseSummary,
    outputRefs: input.outputRefs
  });
}

export async function handleTruthHarnessExternalDisclosureList(input: TruthHarnessExternalDisclosureListInput): Promise<{
  total: number;
  entries: ExternalDisclosureLogEntry[];
}> {
  const entries = await listExternalDisclosureLogEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTruthHarnessReplay(input: TruthHarnessReplayInput): Promise<ReplayResult> {
  return replayReceipt(await readReceiptInput(input));
}

export async function handleTruthHarnessRenderReceipt(input: TruthHarnessRenderReceiptInput): Promise<TruthHarnessRenderReceiptOutput> {
  const format = input.format ?? "markdown";
  const receipt = await readReceiptInput(input);

  return {
    runId: receipt.runId,
    trust: receipt.trust,
    format,
    rendered: renderReceipt(receipt, format)
  };
}

export function toolJson(value: unknown, options: { isError?: boolean } = {}) {
  return {
    isError: options.isError,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

async function readReceiptInput(input: TruthHarnessReplayInput): Promise<Receipt> {
  if (input.receiptJson && input.receiptPath) {
    throw new Error("Provide receiptJson or receiptPath, not both.");
  }

  const raw = input.receiptJson ?? (input.receiptPath ? await readFile(resolveWorkspacePath(input.receiptPath), "utf8") : undefined);
  if (!raw) {
    throw new Error("Provide receiptJson or receiptPath.");
  }

  return parseReceiptJson(raw, input.receiptPath ?? "receiptJson");
}

function resolveWorkspaceRoot(path?: string): string {
  if (!path) {
    return getWorkspaceRoot();
  }

  return resolveWorkspacePath(path);
}

function resolveWorkspacePath(path: string): string {
  const workspaceRoot = getWorkspaceRoot();
  return resolvePathUnderRoot(workspaceRoot, path);
}

function credibilityEngineRequirementsFromInput(input: TruthHarnessWorkspaceCredibilityBundleInput): EngineVerificationRequirements {
  return {
    maxima: Boolean(input.requireMaxima || input.requireDockerCore || input.requireAllConcrete || input.requireAllEngines),
    z3: Boolean(input.requireZ3 || input.requireDockerCore || input.requireAllConcrete || input.requireAllEngines),
    cvc5: Boolean(input.requireCvc5 || input.requireAllEngines),
    lean: Boolean(input.requireLean || input.requireAllConcrete || input.requireAllEngines),
    sage: Boolean(input.requireSage || input.requireAllEngines)
  };
}

function resolvePathUnderRoot(root: string, path: string): string {
  const workspaceRoot = resolve(root);
  const target = resolve(workspaceRoot, path);
  const rootWithSep = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`;

  if (target !== workspaceRoot && !target.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace root: ${pathToFileURL(target).href}`);
  }

  return target;
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/.test(value) ? value : JSON.stringify(value);
}

function proofCheckScopeFromInput(input: {
  routeId?: string;
  obligationId?: string;
  statementHash?: string;
  statement?: string;
}): { routeId?: string; obligationId?: string; statementHash?: string; statement?: string } | undefined {
  const scope = {
    routeId: normalizeOptionalString(input.routeId),
    obligationId: normalizeOptionalString(input.obligationId),
    statementHash: normalizeOptionalString(input.statementHash),
    statement: normalizeOptionalString(input.statement)
  };

  return Object.values(scope).some((value) => value !== undefined) ? scope : undefined;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function getWorkspaceRoot(): string {
  return resolve(process.env.TRUTH_HARNESS_ROOT ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
}
