import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseBenchmarkSuite, runBenchmarkSuite, type BenchmarkRun } from "@theorem-workbench/benchmarks";
import {
  benchmarkComparisonFailsGate,
  benchmarkRunFailsGate,
  checkLeanProofArtifact,
  checkSmtLibArtifact,
  createClaimLedgerGraph,
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
  getCasBackendStatus,
  isClaimLedgerDomain,
  isClaimLedgerStatus,
  getCodeRunSandboxStatus,
  getEngineManifest,
  getLocalWorkspaceStatus,
  getProofBackendStatus,
  getSmtBackendStatus,
  ingestLocalCorpus,
  initLocalWorkspace,
  addResearchSessionCheckpoint,
  listClaimRecords,
  listBenchmarkArtifacts,
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
  listResearchSessions,
  listSimulationLogEntries,
  listSmtChecks,
  listValidationPlans,
  listVerifierRoutes,
  listWorkspaceSnapshots,
  listVaultEntries,
  parseReceiptJson,
  parseBenchmarkRunRecordJson,
  repairLocalWorkspace,
  readClaimRecord,
  readVerifierRoute,
  renderEvidenceAuditMarkdown,
  sealVaultFile,
  solveSmtProblem,
  validateWorkspaceArtifacts,
  verifyVaultEntry,
  verifyWorkspaceSnapshot,
  renderReceipt,
  replayReceipt,
  searchLocalCorpus,
  writeExpertReview,
  writeClaimChart,
  writeClaimLedgerRecord,
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
  type CodeRunPolicyInput,
  type CodeRunSandboxStatus,
  type CodeRunSummary,
  type CodeRunWriteResult,
  type DiscoveryPackage,
  type DiscoveryPackageWriteResult,
  type EngineManifest,
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
  type ResearchEvidenceRef,
  type ResearchSession,
  type ResearchSessionCheckpointWriteResult,
  type ResearchSessionDomain,
  type ResearchSessionWriteResult,
  type ReplayResult,
  type SimulationKind,
  type SimulationLogEntry,
  type SimulationLogWriteResult,
  type SimulationScalar,
  type SimulationStage,
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
  type VerifierRouteSummary,
  type VerifierRouteWriteResult,
  type WorkspaceSnapshotSummary,
  type WorkspaceSnapshotVerification,
  type WorkspaceSnapshotWriteResult,
  type TrustLabel,
  type WorkspaceValidation
} from "@theorem-workbench/core";

export interface TheoremAskInput {
  problem: string;
  strict?: boolean;
}

export interface TheoremAskOutput {
  error: boolean;
  receipt: Receipt;
  message: string;
}

export interface TheoremVerifyInput {
  problem: string;
  workspacePath?: string;
  write?: boolean;
  strict?: boolean;
  timeoutMs?: number;
  maximaCommand?: string;
  leanCommand?: string;
  z3Command?: string;
}

export interface TheoremVerifyOutput {
  error: boolean;
  written: boolean;
  route: VerifierRoute;
  result?: VerifierRouteWriteResult;
  message: string;
}

export interface TheoremRouteListInput {
  workspacePath?: string;
}

export interface TheoremRouteShowInput {
  workspacePath?: string;
  routeRef: string;
}

export interface TheoremEngineManifestInput {
  timeoutMs?: number;
  maximaCommand?: string;
  leanCommand?: string;
  z3Command?: string;
}

export interface TheoremClaimAddInput {
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

export interface TheoremClaimListInput {
  workspacePath?: string;
  domain?: ClaimLedgerDomain;
  status?: ClaimLedgerStatus;
  trust?: TrustLabel;
  tag?: string;
}

export interface TheoremClaimListOutput {
  total: number;
  claims: ClaimLedgerRecord[];
  graph: ReturnType<typeof createClaimLedgerGraph>;
}

export interface TheoremClaimShowInput {
  workspacePath?: string;
  claimRef: string;
}

export interface TheoremBenchmarkRunInput {
  suitePath?: string;
  workspacePath?: string;
  write?: boolean;
  failOnFailures?: boolean;
}

export interface TheoremBenchmarkCompareInput {
  baselinePath: string;
  currentPath: string;
  workspacePath?: string;
  write?: boolean;
  failOnRegression?: boolean;
}

export interface TheoremBenchmarkListInput {
  workspacePath?: string;
}

export interface TheoremCasBackendsInput {
  timeoutMs?: number;
  maximaCommand?: string;
}

export interface TheoremProofBackendsInput {
  timeoutMs?: number;
}

export interface TheoremProofCheckInput {
  sourcePath: string;
  workspacePath?: string;
  theoremName?: string;
  timeoutMs?: number;
  write?: boolean;
  failOnUnproved?: boolean;
}

export interface TheoremProofCheckOutput {
  error: boolean;
  written: boolean;
  record: LeanProofCheckRecord;
  result?: LeanProofCheckWriteResult;
  message: string;
}

export interface TheoremProofListInput {
  workspacePath?: string;
}

export interface TheoremSmtBackendsInput {
  timeoutMs?: number;
  z3Command?: string;
}

export interface TheoremSmtCheckInput {
  sourcePath: string;
  workspacePath?: string;
  queryName?: string;
  z3Command?: string;
  timeoutMs?: number;
  write?: boolean;
  failOnUnverified?: boolean;
}

export interface TheoremSmtCheckOutput {
  error: boolean;
  written: boolean;
  record: SmtCheckRecord;
  result?: SmtCheckWriteResult;
  message: string;
}

export interface TheoremSmtListInput {
  workspacePath?: string;
}

export interface TheoremSmtSolveInput {
  workspacePath?: string;
  queryName?: string;
  integerVariables: string[];
  constraints: string[];
  includeModel?: boolean;
  z3Command?: string;
  timeoutMs?: number;
  failOnUnverified?: boolean;
}

export interface TheoremSmtSolveOutput {
  error: boolean;
  result: SmtProblemSolveResult;
  message: string;
}

export interface TheoremBenchmarkRunWriteOutput {
  run: BenchmarkRun;
  written: true;
  result: BenchmarkRunWriteResult;
}

export type TheoremBenchmarkRunOutput = BenchmarkRun | TheoremBenchmarkRunWriteOutput;

export interface TheoremBenchmarkCompareWriteOutput {
  comparison: BenchmarkComparisonRecord;
  written: true;
  result: BenchmarkComparisonWriteResult;
}

export type TheoremBenchmarkCompareOutput = BenchmarkComparisonRecord | TheoremBenchmarkCompareWriteOutput;

export function theoremBenchmarkRunOutputFailsGate(output: TheoremBenchmarkRunOutput): boolean {
  return benchmarkRunFailsGate("run" in output ? output.run : output);
}

export function theoremBenchmarkCompareOutputFailsGate(output: TheoremBenchmarkCompareOutput): boolean {
  return benchmarkComparisonFailsGate("comparison" in output ? output.comparison : output);
}

export interface TheoremWorkspaceInput {
  workspacePath?: string;
  name?: string;
}

export interface TheoremWorkspaceSnapshotInput {
  workspacePath?: string;
}

export interface TheoremWorkspaceSnapshotVerifyInput {
  workspacePath?: string;
  snapshotRef: string;
}

export interface TheoremSourceIngestInput {
  paths: string[];
  workspacePath?: string;
}

export interface TheoremSourceSearchInput {
  query: string;
  workspacePath?: string;
  limit?: number;
}

export interface TheoremSourceCiteInput {
  claim: string;
  query?: string;
  workspacePath?: string;
  limit?: number;
  strict?: boolean;
}

export interface TheoremSourceCiteOutput {
  error: boolean;
  receipt: Receipt;
  message: string;
}

export interface TheoremLiteratureLogInput {
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

export type TheoremLiteratureLogOutput =
  | {
      written: false;
      record: LiteratureRecord;
    }
  | {
      written: true;
      result: LiteratureRecordWriteResult;
    };

export interface TheoremLiteratureListInput {
  workspacePath?: string;
}

export interface TheoremNotebookRunLogInput {
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

export type TheoremNotebookRunLogOutput =
  | {
      written: false;
      record: NotebookRunRecord;
    }
  | {
      written: true;
      result: NotebookRunWriteResult;
    };

export interface TheoremNotebookRunListInput {
  workspacePath?: string;
}

export interface TheoremCodeRunInput {
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

export interface TheoremCodeRunOutput {
  error: boolean;
  result: CodeRunWriteResult;
  message: string;
}

export interface TheoremCodeSandboxStatusOutput {
  error: boolean;
  status: CodeRunSandboxStatus;
  message: string;
}

export interface TheoremCodeRunListInput {
  workspacePath?: string;
}

export interface TheoremSimulationLogInput {
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

export interface TheoremSimulationListInput {
  workspacePath?: string;
}

export interface TheoremExperimentLogInput {
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

export interface TheoremExperimentListInput {
  workspacePath?: string;
}

export interface TheoremVaultSealInput {
  workspacePath?: string;
  sourcePath: string;
  label?: string;
  keyEnv?: string;
}

export interface TheoremVaultListInput {
  workspacePath?: string;
}

export interface TheoremVaultVerifyInput {
  workspacePath?: string;
  vaultRef: string;
  keyEnv?: string;
}

export interface TheoremEvidenceAuditInput {
  workspacePath?: string;
  claim: string;
  title?: string;
  evidenceRefs?: InventionEvidenceRef[];
  write?: boolean;
  writeReport?: boolean;
  includeMarkdown?: boolean;
}

export type TheoremEvidenceAuditOutput =
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

export interface TheoremEvidenceAuditListInput {
  workspacePath?: string;
}

export interface TheoremValidationPlanInput {
  workspacePath?: string;
  title?: string;
  objective?: string;
  claim: string;
  domains?: ValidationPlanDomain[];
  evidenceRefs?: ValidationEvidenceRef[];
  gates?: ValidationGateInput[];
  write?: boolean;
}

export type TheoremValidationPlanOutput =
  | {
      written: false;
      plan: ValidationPlan;
    }
  | {
      written: true;
      result: ValidationPlanWriteResult;
    };

export interface TheoremValidationPlanListInput {
  workspacePath?: string;
}

export interface TheoremResearchSessionStartInput {
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

export interface TheoremResearchSessionCheckpointInput {
  workspacePath?: string;
  sessionRef: string;
  summary: string;
  evidenceRefs?: ResearchEvidenceRef[];
  snapshotRefs?: string[];
  decisions?: string[];
  nextChecks?: string[];
}

export interface TheoremResearchSessionListInput {
  workspacePath?: string;
}

export interface TheoremExpertReviewLogInput {
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

export interface TheoremExpertReviewListInput {
  workspacePath?: string;
}

export interface TheoremInventionLogInput {
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

export interface TheoremInventionListInput {
  workspacePath?: string;
}

export interface TheoremDiscoveryPackageInput {
  workspacePath?: string;
  entryId?: string;
  write?: boolean;
}

export type TheoremDiscoveryPackageOutput =
  | {
      written: false;
      package: DiscoveryPackage;
    }
  | {
      written: true;
      result: DiscoveryPackageWriteResult;
    };

export interface TheoremClaimChartInput {
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

export type TheoremClaimChartOutput =
  | {
      written: false;
      chart: ClaimChart;
    }
  | {
      written: true;
      result: ClaimChartWriteResult;
    };

export interface TheoremClaimChartListInput {
  workspacePath?: string;
}

export interface TheoremModelContextPrepareInput {
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

export type TheoremModelContextPrepareOutput =
  | {
      written: false;
      packet: ModelContextPacket;
    }
  | {
      written: true;
      result: ModelContextWriteResult;
    };

export interface TheoremModelContextListInput {
  workspacePath?: string;
}

export interface TheoremExternalDisclosureLogInput {
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

export interface TheoremExternalDisclosureListInput {
  workspacePath?: string;
}

export interface TheoremReplayInput {
  receiptJson?: string;
  receiptPath?: string;
}

export interface TheoremRenderReceiptInput {
  receiptJson?: string;
  receiptPath?: string;
  format?: ReceiptRenderFormat;
}

export interface TheoremRenderReceiptOutput {
  runId: string;
  trust: Receipt["trust"];
  format: ReceiptRenderFormat;
  rendered: string;
}

export function handleTheoremAsk(input: TheoremAskInput): TheoremAskOutput {
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

export async function handleTheoremVerify(input: TheoremVerifyInput): Promise<TheoremVerifyOutput> {
  const write = input.write === true
    ? await writeVerifierRoute({
        rootPath: resolveWorkspaceRoot(input.workspacePath),
        problem: input.problem,
        timeoutMs: input.timeoutMs,
        maximaCommand: input.maximaCommand,
        leanCommand: input.leanCommand,
        z3Command: input.z3Command
      })
    : undefined;
  const route =
    write?.route ??
    createVerifierRoute(input.problem, {
      timeoutMs: input.timeoutMs,
      maximaCommand: input.maximaCommand,
      leanCommand: input.leanCommand,
      z3Command: input.z3Command
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

export async function handleTheoremRouteList(input: TheoremRouteListInput): Promise<{
  total: number;
  routes: VerifierRouteSummary[];
}> {
  const routes = await listVerifierRoutes(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: routes.length,
    routes
  };
}

export async function handleTheoremRouteShow(input: TheoremRouteShowInput): Promise<VerifierRoute> {
  return readVerifierRoute(resolveWorkspaceRoot(input.workspacePath), input.routeRef);
}

export function handleTheoremEngineManifest(input: TheoremEngineManifestInput = {}): EngineManifest {
  return getEngineManifest({
    timeoutMs: input.timeoutMs,
    maximaCommand: input.maximaCommand,
    leanCommand: input.leanCommand,
    z3Command: input.z3Command
  });
}

export async function handleTheoremClaimAdd(input: TheoremClaimAddInput): Promise<ClaimLedgerWriteResult> {
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

export async function handleTheoremClaimList(input: TheoremClaimListInput): Promise<TheoremClaimListOutput> {
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

export async function handleTheoremClaimShow(input: TheoremClaimShowInput): Promise<ClaimLedgerRecord> {
  return readClaimRecord(resolveWorkspaceRoot(input.workspacePath), input.claimRef);
}

export async function handleTheoremBenchmarkRun(
  input: TheoremBenchmarkRunInput & { write: true }
): Promise<TheoremBenchmarkRunWriteOutput>;
export async function handleTheoremBenchmarkRun(
  input: TheoremBenchmarkRunInput & { write?: false | undefined }
): Promise<BenchmarkRun>;
export async function handleTheoremBenchmarkRun(input: TheoremBenchmarkRunInput): Promise<TheoremBenchmarkRunOutput>;
export async function handleTheoremBenchmarkRun(input: TheoremBenchmarkRunInput): Promise<TheoremBenchmarkRunOutput> {
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
      runnerName: "theorem-mcp",
      runnerAdapter: "local-receipt-engine",
      command: `theorem bench run ${quoteCommandArg(suitePath)}`,
      workingDirectory: getWorkspaceRoot()
    })
  };
}

export async function handleTheoremBenchmarkCompare(
  input: TheoremBenchmarkCompareInput & { write: true }
): Promise<TheoremBenchmarkCompareWriteOutput>;
export async function handleTheoremBenchmarkCompare(
  input: TheoremBenchmarkCompareInput & { write?: false | undefined }
): Promise<BenchmarkComparisonRecord>;
export async function handleTheoremBenchmarkCompare(input: TheoremBenchmarkCompareInput): Promise<TheoremBenchmarkCompareOutput>;
export async function handleTheoremBenchmarkCompare(input: TheoremBenchmarkCompareInput): Promise<TheoremBenchmarkCompareOutput> {
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

export async function handleTheoremBenchmarkList(input: TheoremBenchmarkListInput): Promise<{
  total: number;
  artifacts: BenchmarkArtifactSummary[];
}> {
  const artifacts = await listBenchmarkArtifacts(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: artifacts.length,
    artifacts
  };
}

export function handleTheoremCasBackends(input: TheoremCasBackendsInput): CasBackendStatusReport {
  return getCasBackendStatus({
    maximaCommand: input.maximaCommand,
    timeoutMs: input.timeoutMs
  });
}

export function handleTheoremProofBackends(input: TheoremProofBackendsInput): ProofBackendStatusReport {
  return getProofBackendStatus({
    timeoutMs: input.timeoutMs
  });
}

export async function handleTheoremProofCheck(input: TheoremProofCheckInput): Promise<TheoremProofCheckOutput> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspacePath);
  const write = input.write === true
    ? await writeLeanProofCheckRecord({
        rootPath: workspaceRoot,
        sourcePath: input.sourcePath,
        theoremName: input.theoremName,
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
      theoremName: input.theoremName,
      timeoutMs: input.timeoutMs,
      replayCommand: `theorem proof check ${quoteCommandArg(input.sourcePath)} --json`
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

export async function handleTheoremProofList(input: TheoremProofListInput): Promise<{
  total: number;
  checks: LeanProofCheckSummary[];
}> {
  const checks = await listLeanProofChecks(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: checks.length,
    checks
  };
}

export function handleTheoremSmtBackends(input: TheoremSmtBackendsInput): SmtBackendStatusReport {
  return getSmtBackendStatus({
    z3Command: input.z3Command,
    timeoutMs: input.timeoutMs
  });
}

export async function handleTheoremSmtCheck(input: TheoremSmtCheckInput): Promise<TheoremSmtCheckOutput> {
  const workspaceRoot = resolveWorkspaceRoot(input.workspacePath);
  const write = input.write === true
    ? await writeSmtCheckRecord({
        rootPath: workspaceRoot,
        sourcePath: input.sourcePath,
        queryName: input.queryName,
        z3Command: input.z3Command,
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
      z3Command: input.z3Command,
      timeoutMs: input.timeoutMs,
      replayCommand: `theorem smt check ${quoteCommandArg(input.sourcePath)} --json`
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

export async function handleTheoremSmtList(input: TheoremSmtListInput): Promise<{
  total: number;
  checks: SmtCheckSummary[];
}> {
  const checks = await listSmtChecks(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: checks.length,
    checks
  };
}

export async function handleTheoremSmtSolve(input: TheoremSmtSolveInput): Promise<TheoremSmtSolveOutput> {
  const result = await solveSmtProblem({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    queryName: input.queryName,
    variables: input.integerVariables,
    constraints: input.constraints,
    includeModel: input.includeModel,
    z3Command: input.z3Command,
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

export async function handleTheoremWorkspaceInit(input: TheoremWorkspaceInput): Promise<LocalWorkspaceInitResult> {
  return initLocalWorkspace(resolveWorkspaceRoot(input.workspacePath), { displayName: input.name });
}

export async function handleTheoremWorkspaceStatus(input: TheoremWorkspaceInput): Promise<LocalWorkspaceStatus> {
  return getLocalWorkspaceStatus(resolveWorkspaceRoot(input.workspacePath));
}

export async function handleTheoremWorkspaceRepair(input: TheoremWorkspaceInput): Promise<LocalWorkspaceRepairResult> {
  return repairLocalWorkspace(resolveWorkspaceRoot(input.workspacePath));
}

export async function handleTheoremWorkspaceValidate(input: TheoremWorkspaceSnapshotInput): Promise<WorkspaceValidation> {
  return validateWorkspaceArtifacts({
    rootPath: resolveWorkspaceRoot(input.workspacePath)
  });
}

export async function handleTheoremWorkspaceSnapshot(
  input: TheoremWorkspaceSnapshotInput
): Promise<WorkspaceSnapshotWriteResult> {
  return writeWorkspaceSnapshot({
    rootPath: resolveWorkspaceRoot(input.workspacePath)
  });
}

export async function handleTheoremWorkspaceSnapshotList(input: TheoremWorkspaceSnapshotInput): Promise<{
  total: number;
  snapshots: WorkspaceSnapshotSummary[];
}> {
  const snapshots = await listWorkspaceSnapshots(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: snapshots.length,
    snapshots
  };
}

export async function handleTheoremWorkspaceSnapshotVerify(
  input: TheoremWorkspaceSnapshotVerifyInput
): Promise<WorkspaceSnapshotVerification> {
  return verifyWorkspaceSnapshot({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    snapshotRef: input.snapshotRef
  });
}

export async function handleTheoremSourceIngest(input: TheoremSourceIngestInput): Promise<LocalCorpusIngestResult> {
  return ingestLocalCorpus({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    paths: input.paths
  });
}

export async function handleTheoremSourceSearch(input: TheoremSourceSearchInput): Promise<LocalCorpusSearchResult> {
  return searchLocalCorpus({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    query: input.query,
    limit: input.limit
  });
}

export async function handleTheoremSourceCite(input: TheoremSourceCiteInput): Promise<TheoremSourceCiteOutput> {
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

export async function handleTheoremLiteratureLog(input: TheoremLiteratureLogInput): Promise<TheoremLiteratureLogOutput> {
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

export async function handleTheoremLiteratureList(input: TheoremLiteratureListInput): Promise<{
  total: number;
  records: LiteratureRecord[];
}> {
  const records = await listLiteratureRecords(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: records.length,
    records
  };
}

export async function handleTheoremNotebookRunLog(input: TheoremNotebookRunLogInput): Promise<TheoremNotebookRunLogOutput> {
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

export async function handleTheoremNotebookRunList(input: TheoremNotebookRunListInput): Promise<{
  total: number;
  records: NotebookRunRecord[];
}> {
  const records = await listNotebookRuns(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: records.length,
    records
  };
}

export async function handleTheoremCodeRun(input: TheoremCodeRunInput): Promise<TheoremCodeRunOutput> {
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

export function handleTheoremCodeSandboxStatus(): TheoremCodeSandboxStatusOutput {
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
  if (!isTruthyEnv(process.env.THEOREM_ALLOW_CODE_RUN)) {
    throw new Error("MCP code execution is disabled. Set THEOREM_ALLOW_CODE_RUN=1 and provide an explicit policy.allowedExecutables list to enable theorem_code_run.");
  }

  if (policy?.requireSandbox === true || isTruthyEnv(process.env.THEOREM_ALLOW_UNSANDBOXED_CODE_RUN)) {
    return;
  }

  throw new Error(
    "MCP unsandboxed code execution is disabled. Set policy.requireSandbox=true to require a measured sandbox, or set THEOREM_ALLOW_UNSANDBOXED_CODE_RUN=1 to permit direct local execution with networkAccess unknown."
  );
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

export async function handleTheoremCodeRunList(input: TheoremCodeRunListInput): Promise<{
  total: number;
  records: CodeRunSummary[];
}> {
  const records = await listCodeRuns(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: records.length,
    records
  };
}

export async function handleTheoremSimulationLog(input: TheoremSimulationLogInput): Promise<SimulationLogWriteResult> {
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

export async function handleTheoremSimulationList(input: TheoremSimulationListInput): Promise<{
  total: number;
  entries: SimulationLogEntry[];
}> {
  const entries = await listSimulationLogEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTheoremExperimentLog(input: TheoremExperimentLogInput): Promise<ExperimentLogWriteResult> {
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

export async function handleTheoremExperimentList(input: TheoremExperimentListInput): Promise<{
  total: number;
  entries: ExperimentLogEntry[];
}> {
  const entries = await listExperimentLogEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTheoremVaultSeal(input: TheoremVaultSealInput): Promise<VaultSealResult> {
  return sealVaultFile({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    sourcePath: input.sourcePath,
    label: input.label,
    keyEnv: input.keyEnv
  });
}

export async function handleTheoremVaultList(input: TheoremVaultListInput): Promise<{
  total: number;
  entries: VaultEnvelopeSummary[];
}> {
  const entries = await listVaultEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTheoremVaultVerify(input: TheoremVaultVerifyInput): Promise<VaultVerifyResult> {
  return verifyVaultEntry({
    rootPath: resolveWorkspaceRoot(input.workspacePath),
    vaultRef: input.vaultRef,
    keyEnv: input.keyEnv
  });
}

export async function handleTheoremEvidenceAudit(input: TheoremEvidenceAuditInput): Promise<TheoremEvidenceAuditOutput> {
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

export async function handleTheoremEvidenceAuditList(input: TheoremEvidenceAuditListInput): Promise<{
  total: number;
  audits: EvidenceAudit[];
}> {
  const audits = await listEvidenceAudits(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: audits.length,
    audits
  };
}

export async function handleTheoremValidationPlan(input: TheoremValidationPlanInput): Promise<TheoremValidationPlanOutput> {
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

export async function handleTheoremValidationPlanList(input: TheoremValidationPlanListInput): Promise<{
  total: number;
  plans: ValidationPlan[];
}> {
  const plans = await listValidationPlans(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: plans.length,
    plans
  };
}

export async function handleTheoremResearchSessionStart(
  input: TheoremResearchSessionStartInput
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

export async function handleTheoremResearchSessionCheckpoint(
  input: TheoremResearchSessionCheckpointInput
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

export async function handleTheoremResearchSessionList(input: TheoremResearchSessionListInput): Promise<{
  total: number;
  sessions: ResearchSession[];
}> {
  const sessions = await listResearchSessions(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: sessions.length,
    sessions
  };
}

export async function handleTheoremExpertReviewLog(input: TheoremExpertReviewLogInput): Promise<ExpertReviewWriteResult> {
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

export async function handleTheoremExpertReviewList(input: TheoremExpertReviewListInput): Promise<{
  total: number;
  reviews: ExpertReviewRecord[];
}> {
  const reviews = await listExpertReviews(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: reviews.length,
    reviews
  };
}

export async function handleTheoremInventionLog(input: TheoremInventionLogInput): Promise<InventionLogWriteResult> {
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

export async function handleTheoremInventionList(input: TheoremInventionListInput): Promise<{
  total: number;
  entries: InventionLogEntry[];
}> {
  const entries = await listInventionLogEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTheoremDiscoveryPackage(
  input: TheoremDiscoveryPackageInput
): Promise<TheoremDiscoveryPackageOutput> {
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

export async function handleTheoremClaimChart(input: TheoremClaimChartInput): Promise<TheoremClaimChartOutput> {
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

export async function handleTheoremClaimChartList(input: TheoremClaimChartListInput): Promise<{
  total: number;
  charts: ClaimChart[];
}> {
  const charts = await listClaimCharts(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: charts.length,
    charts
  };
}

export async function handleTheoremModelContextPrepare(
  input: TheoremModelContextPrepareInput
): Promise<TheoremModelContextPrepareOutput> {
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

export async function handleTheoremModelContextList(input: TheoremModelContextListInput): Promise<{
  total: number;
  packets: ModelContextPacket[];
}> {
  const packets = await listModelContexts(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: packets.length,
    packets
  };
}

export async function handleTheoremExternalDisclosureLog(
  input: TheoremExternalDisclosureLogInput
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

export async function handleTheoremExternalDisclosureList(input: TheoremExternalDisclosureListInput): Promise<{
  total: number;
  entries: ExternalDisclosureLogEntry[];
}> {
  const entries = await listExternalDisclosureLogEntries(resolveWorkspaceRoot(input.workspacePath));
  return {
    total: entries.length,
    entries
  };
}

export async function handleTheoremReplay(input: TheoremReplayInput): Promise<ReplayResult> {
  return replayReceipt(await readReceiptInput(input));
}

export async function handleTheoremRenderReceipt(input: TheoremRenderReceiptInput): Promise<TheoremRenderReceiptOutput> {
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

async function readReceiptInput(input: TheoremReplayInput): Promise<Receipt> {
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

function getWorkspaceRoot(): string {
  return resolve(process.env.THEOREM_WORKBENCH_ROOT ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
}
