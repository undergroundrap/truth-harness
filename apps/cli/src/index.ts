#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { parseBenchmarkSuite, runBenchmarkSuite, type BenchmarkRun } from "@truth-harness/benchmarks";
import {
  benchmarkComparisonFailsGate,
  benchmarkRunFailsGate,
  checkClaimFile,
  checkLeanProofArtifact,
  checkSmtLibArtifact,
  archiveLocalWorkspace,
  cleanLocalWorkspace,
  createBenchmarkComparisonRecord,
  createClaimChart,
  createCredibilityPack,
  createClaimLedgerGraph,
  createClaimReviewPacket,
  createDiscoveryPackage,
  createEvidenceAudit,
  createExperimentLogEntry,
  createExternalDisclosureLogEntry,
  createInventionLogEntry,
  createEngineReadinessReport,
  createModelContext,
  createNotebookRun,
  createReceipt,
  createSimulationLogEntry,
  createSourceCitationReceipt,
  createTeachingPacket,
  createReleaseAudit,
  createVerifierRoute,
  createSymbolicCasCheckRecord,
  getCasBackendStatus,
  getCodeRunSandboxStatus,
  engineVerificationCaseEvidenceMeaning,
  engineVerificationCaseEvidenceTier,
  getEngineManifest,
  getLocalWorkspaceStatus,
  getWorkspaceCatalogStatus,
  getProofBackendStatus,
  getSmtBackendStatus,
  ingestLocalCorpus,
  initLocalWorkspace,
  isWorkspaceCleanTarget,
  isExpertReviewKind,
  isExpertReviewOutcome,
  isExpertReviewStatus,
  isExperimentKind,
  isExperimentOutcome,
  isExperimentStage,
  isClaimLedgerDomain,
  isClaimLedgerStatus,
  isExternalDisclosureStatus,
  isInventionValidationStage,
  isLiteratureIdentifierKind,
  isLiteratureRecordKind,
  isLiteratureRecordStatus,
  isModelContextDisclosureStatus,
  isModelContextTarget,
  isNotebookRunKind,
  isNotebookRunStatus,
  isResearchSessionDomain,
  isResearchTaskStatus,
  isSimulationKind,
  isTeachingAudience,
  isSimulationStage,
  isValidationGateKind,
  isValidationPlanDomain,
  inspectLeanProject,
  listBenchmarkArtifacts,
  listSymbolicCasChecks,
  listClaimCharts,
  listClaimRecords,
  listCodeRuns,
  listEngineVerificationRuns,
  listEvidenceAudits,
  listExpertReviews,
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
  listLocalWorkspaceArchives,
  listWorkspaceEvents,
  listWorkspaceRunNextPlans,
  listWorkspaceReviews,
  listWorkspaceSnapshots,
  listVaultEntries,
  openVaultEntry,
  parseReceiptJson,
  parseBenchmarkRunRecordJson,
  readClaimRecord,
  readReportDraft,
  readResearchSession,
  readVisualArtifact,
  readWorkspaceRunNextPlan,
  readWorkspaceReview,
  readVerifierRoute,
  renderReceipt,
  renderGraphvizVisualArtifact,
  renderPlotlyVisualArtifact,
  renderTeachingPacketMarkdown,
  repairLocalWorkspace,
  repairWorkspaceArtifacts,
  rebuildWorkspaceCatalog,
  restoreLocalWorkspaceArchive,
  replayReceipt,
  runWorkspaceStress,
  searchLocalCorpus,
  searchWorkspaceCatalog,
  sealVaultFile,
  satisfyVerifierRouteObligation,
  verifierRouteReadiness,
  solveSmtProblem,
  addResearchSessionCheckpoint,
  createWorkspaceReview,
  createWorkspaceReviewFromCredibilityPack,
  createWorkspaceRunNextPlan,
  createWorkspaceGraph,
  writeVisualArtifact,
  writeReceiptPlotVisualArtifact,
  writeResearchCanvasVisualArtifact,
  writeWorkspaceGraphVisualArtifact,
  updateResearchSessionTask,
  validateWorkspaceArtifacts,
  verifyVaultEntry,
  verifyEngineEvidence,
  verifyCredibilityBundle,
  verifyWorkspaceSnapshot,
  writeBenchmarkComparisonRecord,
  writeBenchmarkRunRecord,
  writeSymbolicCasCheckRecord,
  writeClaimLedgerRecord,
  writeCredibilityBundle,
  writeCredibilityBundleVerification,
  writeCredibilityPack,
  writeCodeRun,
  writeEvidenceAudit,
  writeEvidenceAuditReport,
  writeExpertReview,
  writeLeanProofCheckVisualArtifact,
  writeLeanProofCheckRecord,
  writeSmtCheckRecord,
  writeDiscoveryPackage,
  writeEngineVerificationRun,
  writeLiteratureRecord,
  writeModelContext,
  writeNotebookRun,
  writeResearchHarness,
  writeResearchSession,
  writeValidationPlan,
  writeVerifierRoute,
  writeWorkspaceReview,
  writeWorkspaceRunNextPlan,
  writeWorkspaceSnapshot,
  writeClaimChart,
  createValidationPlan,
  type ClaimFileCheck,
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
  type ClaimReviewPacket,
  type ClaimLedgerStatus,
  type ClaimLedgerWriteResult,
  type CasBackendStatusReport,
  type SymbolicCasBackendId,
  type SymbolicCasCheckRecord,
  type SymbolicCasCheckSummary,
  type SymbolicCasCheckWriteResult,
  type WorkspaceCatalogRebuildResult,
  type WorkspaceCatalogSearchResult,
  type WorkspaceCatalogStatus,
  type WorkspaceEventListResult,
  type CodeRunSummary,
  type EngineManifest,
  type EngineReadinessReport,
  type EngineVerificationReport,
  type EngineVerificationRequirements,
  type EngineVerificationRunSummary,
  type EngineVerificationRunWriteResult,
  type CodeRunPolicyInput,
  type CodeRunWriteResult,
  type CredibilityBundleVerification,
  type CredibilityBundleWriteResult,
  type CredibilityPack,
  type CredibilityPackActionItem,
  type CredibilityPackWriteResult,
  type DiscoveryPackage,
  type DiscoveryPackageWriteResult,
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
  type WorkspaceArchiveResult,
  type WorkspaceArchiveListResult,
  type WorkspaceArchiveRestoreResult,
  type WorkspaceArtifactRepairResult,
  type WorkspaceCleanResult,
  type WorkspaceCleanTarget,
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
  type LeanProjectInspection,
  type ProofBackendStatusReport,
  type Receipt,
  type ReceiptRenderFormat,
  type ResearchEvidenceRef,
  type ResearchSession,
  type ResearchSessionCheckpointWriteResult,
  type ResearchSessionDomain,
  type ResearchSessionTaskUpdateWriteResult,
  type ResearchSessionWriteResult,
  type ResearchTaskStatus,
  type ReleaseAudit,
  type ReportDraftReadResult,
  type ReportDraftSummary,
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
  type TeachingAudience,
  type VerifierRoute,
  type VerifierRouteEvidenceRef,
  type VerifierRouteSummary,
  type SatisfyVerifierRouteObligationResult,
  type VerifierRouteWriteResult,
  type ValidationEvidenceRef,
  type ValidationGateInput,
  type ValidationPlan,
  type ValidationPlanDomain,
  type ValidationPlanWriteResult,
  type VaultEnvelopeSummary,
  type VaultOpenResult,
  type VaultSealResult,
  type VaultVerifyResult,
  type WorkspaceSnapshotSummary,
  type WorkspaceSnapshotVerification,
  type WorkspaceSnapshotWriteResult,
  type TrustLabel,
  type WorkspaceValidation,
  type WorkspaceGraph,
  type WorkspaceRunNextPlan,
  type WorkspaceRunNextSummary,
  type WorkspaceReview,
  type WorkspaceReviewSummary,
  type WorkspaceReviewWriteResult,
  type VisualArtifact,
  type VisualArtifactKind,
  type VisualArtifactPayloadFormat,
  type VisualArtifactRenderer,
  type VisualArtifactSourceKind,
  type VisualArtifactSourceRef,
  type VisualArtifactSummary,
  type VisualArtifactWriteResult,
  type WorkspaceStressResult,
  type SympyOperation
} from "@truth-harness/core";

const program = new Command();

program
  .name("truth-harness")
  .description("Verified math for AI agents: proof receipts, exact computation, refutation, and benchmarks.")
  .version("0.0.0");

program
  .command("ask")
  .description("Create a proof receipt for a math prompt.")
  .allowUnknownOption(true)
  .argument("[tokens...]", "Problem tokens plus optional --json and --out <path> flags")
  .addHelpText(
    "after",
    `

Ask flags:
  --json              Print the full receipt JSON
  --out <path>        Write the full receipt JSON to a file

With npm scripts, pass ask flags after an extra separator:
  npm run cli -- ask "compute 2 + 2" -- --json
`
  )
  .action(async (tokens: string[]) => {
    const options = parseAskArgs(tokens);
    const receipt = createReceipt(options.problem);

    if (options.out) {
      await writeJson(options.out, receipt);
    }

    if (options.json) {
      printJson(receipt);
      return;
    }

    printReceipt(receipt, options.out);
  });

program
  .command("verify")
  .description("Create a manifest-aware verifier route plus receipt for a math prompt.")
  .argument("<problem...>", "Math prompt or claim to route through local verifiers")
  .option("--json", "Print the full verifier route JSON")
  .option("--out <path>", "Write the full verifier route JSON to a file")
  .option("--write", "Write JSON and Markdown into .truth-harness/routes")
  .option("--workspace <path>", "Project root path for writing route artifacts", ".")
  .option("--strict", "Exit non-zero if the final receipt trust is unverified")
  .option("--timeout-ms <ms>", "Backend probe timeout in milliseconds", parsePositiveInteger, 1500)
  .option("--maxima-command <command>", "Override Maxima executable for this route")
  .option("--sage-command <command>", "Override SageMath executable for this route")
  .option("--lean-command <command>", "Override Lean executable for this route")
  .option("--z3-command <command>", "Override Z3 executable for this route")
  .option("--cvc5-command <command>", "Override cvc5 executable for this route")
  .option("--require-independent-smt", "Require separate Z3 and cvc5 solver obligations instead of one generic SMT solver obligation")
  .action(
    async (
      problemTokens: string[],
      options: {
        json?: boolean;
        out?: string;
        write?: boolean;
        workspace: string;
        strict?: boolean;
        timeoutMs: number;
        maximaCommand?: string;
        sageCommand?: string;
        leanCommand?: string;
        z3Command?: string;
        cvc5Command?: string;
        requireIndependentSmt?: boolean;
      }
    ) => {
      const problem = problemTokens.join(" ");
      const workspaceWrite = options.write
        ? await writeVerifierRoute({
            rootPath: options.workspace,
            problem,
            timeoutMs: options.timeoutMs,
            maximaCommand: options.maximaCommand,
            sageCommand: options.sageCommand,
            leanCommand: options.leanCommand,
            z3Command: options.z3Command,
            cvc5Command: options.cvc5Command,
            smtReviewPolicy: options.requireIndependentSmt ? "independent" : "single"
          })
        : undefined;
      const route =
        workspaceWrite?.route ??
        createVerifierRoute(problem, {
          timeoutMs: options.timeoutMs,
          maximaCommand: options.maximaCommand,
          sageCommand: options.sageCommand,
          leanCommand: options.leanCommand,
          z3Command: options.z3Command,
          cvc5Command: options.cvc5Command,
          smtReviewPolicy: options.requireIndependentSmt ? "independent" : "single"
        });

      if (options.out) {
        await writeJson(options.out, route);
      }

      if (options.json) {
        printJson(workspaceWrite ? { route, written: true, result: workspaceWrite } : route);
      } else {
        printVerifierRoute(route, options.out, workspaceWrite);
      }

      if (options.strict && route.finalTrust === "unverified") {
        process.exitCode = 1;
      }
    }
  );

const route = program.command("route").description("Manage persisted verifier routes in the local workspace.");

route
  .command("list")
  .description("List local verifier-route records.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full verifier-route list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const routes = await listVerifierRoutes(path);

    if (options.json) {
      printJson({ total: routes.length, routes });
      return;
    }

    printVerifierRouteList(routes);
  });

route
  .command("show")
  .description("Show a verifier route by route id or workspace-local JSON path.")
  .argument("<route>", "Route id or workspace-local JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--json", "Print the full verifier route JSON")
  .action(async (routeRef: string, options: { workspace: string; json?: boolean }) => {
    const storedRoute = await readVerifierRoute(options.workspace, routeRef);

    if (options.json) {
      printJson(storedRoute);
      return;
    }

    printVerifierRoute(storedRoute);
  });

route
  .command("satisfy")
  .description("Attach accepted local evidence to a verifier-route proof obligation.")
  .argument("<route>", "Route id or workspace-local JSON path")
  .argument("<obligation>", "Proof obligation id such as obl_<hash>")
  .requiredOption("--evidence <ref>", "Local evidence ref, such as proof:.truth-harness/proofs/check.json")
  .option("--workspace <path>", "Project root path", ".")
  .option("--summary <text>", "Human scope note to store beside the evidence ref")
  .option("--json", "Print the full satisfaction result JSON")
  .action(
    async (
      routeRef: string,
      obligationId: string,
      options: { evidence: string; workspace: string; summary?: string; json?: boolean }
    ) => {
      const evidenceRef = parseVerifierRouteEvidenceRef(options.evidence, options.summary);
      const result = await satisfyVerifierRouteObligation({
        rootPath: options.workspace,
        routeRef,
        obligationId,
        evidenceRef
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printVerifierRouteSatisfaction(result);
    }
  );

const visual = program.command("visual").description("Manage replayable visual artifacts in the local workspace.");

visual
  .command("create")
  .description("Write a saved visual artifact from engine output, SVG, graph JSON, or report figure data.")
  .argument("<title...>", "Visual title")
  .option("--workspace <path>", "Project root path", ".")
  .option(
    "--kind <kind>",
    "plot, proof-tree, lineage-graph, mind-map, concept-map, simulation-view, notebook-output, teaching-animation, or report-figure",
    "plot"
  )
  .option(
    "--renderer <renderer>",
    "truth-harness-native, plotly, graphviz, mermaid, tldraw, manim, sage, matplotlib, or external-file",
    "truth-harness-native"
  )
  .option(
    "--source <kind:ref>",
    "Source ref such as receipt:path, route:id, claim:id, proof:path, smt:path, cas:path, or manual:note. Repeatable",
    collectRepeated,
    []
  )
  .option("--tag <tag>", "Search/filter tag. Repeatable", collectRepeated, [])
  .option("--payload-format <format>", "svg, plotly-json, graph-json, canvas-json, html, png-ref, or table-json", "svg")
  .option("--payload-json <json>", "Inline JSON payload content")
  .option("--payload-text <text>", "Inline text payload content")
  .option("--payload-file <path>", "Read payload content from a local file")
  .option("--replay <command>", "Replay command that regenerates the visual")
  .option("--json", "Print the full visual write JSON")
  .action(
    async (
      titleTokens: string[],
      options: {
        workspace: string;
        kind: string;
        renderer: string;
        source: string[];
        tag: string[];
        payloadFormat: string;
        payloadJson?: string;
        payloadText?: string;
        payloadFile?: string;
        replay?: string;
        json?: boolean;
      }
    ) => {
      const result = await writeVisualArtifact({
        rootPath: options.workspace,
        title: titleTokens.join(" "),
        kind: parseVisualArtifactKind(options.kind),
        renderer: {
          engine: parseVisualArtifactRenderer(options.renderer),
          adapter: "truth-harness-cli"
        },
        sourceRefs: options.source.map(parseVisualSourceRef),
        replayCommand: options.replay,
        payload: {
          format: parseVisualPayloadFormat(options.payloadFormat),
          content: await readVisualPayloadContent(options)
        },
        tags: options.tag
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printVisualArtifactWrite(result);
    }
  );

visual
  .command("graph")
  .description("Write a Mermaid or Graphviz visual artifact from the local workspace graph.")
  .option("--workspace <path>", "Project root path", ".")
  .option("--renderer <renderer>", "mermaid or graphviz", "mermaid")
  .option("--title <title>", "Optional visual title")
  .option("--max-nodes <count>", "Maximum graph nodes to include", parsePositiveInteger, 80)
  .option("--json", "Print the full visual write JSON")
  .action(async (options: { workspace: string; renderer: string; title?: string; maxNodes: number; json?: boolean }) => {
    const renderer = parseGraphVisualRenderer(options.renderer);
    const result = await writeWorkspaceGraphVisualArtifact({
      rootPath: options.workspace,
      renderer,
      title: options.title,
      maxNodes: options.maxNodes
    });

    if (options.json) {
      printJson(result);
      return;
    }

    printVisualArtifactWrite(result);
  });

visual
  .command("plot")
  .description("Write a Plotly/Matplotlib/Sage-ready plot artifact from a receipt or a new local prompt.")
  .argument("[receipt]", "Workspace-local receipt JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--problem <text>", "Create a local receipt from this prompt when no receipt path is supplied")
  .option("--renderer <renderer>", "plotly, matplotlib, or sage", "plotly")
  .option("--title <title>", "Optional visual title")
  .option("--json", "Print the full visual write JSON")
  .action(
    async (
      receiptPath: string | undefined,
      options: { workspace: string; problem?: string; renderer: string; title?: string; json?: boolean }
    ) => {
      const result = await writeReceiptPlotVisualArtifact({
        rootPath: options.workspace,
        receiptPath,
        problem: options.problem,
        renderer: parsePlotVisualRenderer(options.renderer),
        title: options.title
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printVisualArtifactWrite(result);
    }
  );

visual
  .command("canvas")
  .description("Write an editable tldraw-style research canvas seed from the local workspace graph.")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Optional visual title")
  .option("--max-nodes <count>", "Maximum source nodes to include", parsePositiveInteger, 36)
  .option("--json", "Print the full visual write JSON")
  .action(async (options: { workspace: string; title?: string; maxNodes: number; json?: boolean }) => {
    const result = await writeResearchCanvasVisualArtifact({
      rootPath: options.workspace,
      title: options.title,
      maxNodes: options.maxNodes
    });

    if (options.json) {
      printJson(result);
      return;
    }

    printVisualArtifactWrite(result);
  });

visual
  .command("render")
  .description("Render a saved renderer source into a new local visual artifact.")
  .argument("<visual>", "Visual id or workspace-local visual JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--engine <engine>", "Renderer engine: graphviz or plotly", "graphviz")
  .option("--dot-command <command>", "Override Graphviz dot executable")
  .option("--timeout-ms <ms>", "Renderer timeout in milliseconds", parsePositiveInteger, 5000)
  .option("--title <title>", "Optional title for the rendered visual artifact")
  .option("--json", "Print the full visual render result JSON")
  .action(
    async (
      visualRef: string,
      options: {
        workspace: string;
        engine: string;
        dotCommand?: string;
        timeoutMs: number;
        title?: string;
        json?: boolean;
      }
    ) => {
      const engine = parseVisualRenderEngine(options.engine);
      const result = engine === "graphviz"
        ? await renderGraphvizVisualArtifact({
            rootPath: options.workspace,
            visualRef,
            dotCommand: options.dotCommand,
            timeoutMs: options.timeoutMs,
            title: options.title
          })
        : await renderPlotlyVisualArtifact({
            rootPath: options.workspace,
            visualRef,
            title: options.title
          });

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(`Rendered ${result.sourceVisual.visualId} with ${result.renderer}`);
      printVisualArtifactWrite(result);
    }
  );

visual
  .command("list")
  .description("List local visual artifacts.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full visual artifact list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const visuals = await listVisualArtifacts(path);

    if (options.json) {
      printJson({ total: visuals.length, visuals });
      return;
    }

    printVisualArtifactList(visuals);
  });

visual
  .command("show")
  .description("Show a visual artifact by visual id or workspace-local JSON path.")
  .argument("<visual>", "Visual id or workspace-local visual JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--json", "Print the full visual artifact JSON")
  .action(async (visualRef: string, options: { workspace: string; json?: boolean }) => {
    const artifact = await readVisualArtifact(options.workspace, visualRef);

    if (options.json) {
      printJson(artifact);
      return;
    }

    printVisualArtifact(artifact);
  });

const claim = program.command("claim").description("Manage git-like local claim ledger records.");

claim
  .command("add")
  .description("Write a local claim record with lineage, evidence-backed trust, and next checks.")
  .argument("<statement...>", "Claim statement")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short claim title")
  .option("--domain <domain>", "Claim lane/domain")
  .option("--status <status>", "active, superseded, or retracted", "active")
  .option("--trust <label>", "Requested trust label; final claim trust is downgraded unless attached evidence supports it", "unverified")
  .option("--tag <tag>", "Search/filter tag. Repeatable", collectRepeated, [])
  .option("--depends-on <claim>", "Upstream claim id. Repeatable", collectRepeated, [])
  .option("--supersedes <claim>", "Claim id this record supersedes. Repeatable", collectRepeated, [])
  .option("--derived-by <note>", "Derivation note explaining how this claim was produced")
  .option("--author <name>", "Human or agent author; repeatable", collectRepeated, [])
  .option(
    "--evidence <ref>",
    "Evidence ref such as claim:id, receipt:path, proof:path, smt:path, source:path, or manual other:ref@trust-label. Repeatable",
    collectRepeated,
    []
  )
  .option("--next-check <text>", "Open validation/proof/review check. Repeatable", collectRepeated, [])
  .option("--json", "Print the full claim write JSON")
  .action(
    async (
      statementTokens: string[],
      options: {
        workspace: string;
        title?: string;
        domain?: string;
        status: string;
        trust: string;
        tag: string[];
        dependsOn: string[];
        supersedes: string[];
        derivedBy?: string;
        author: string[];
        evidence: string[];
        nextCheck: string[];
        json?: boolean;
      }
    ) => {
      const result = await writeClaimLedgerRecord({
        rootPath: options.workspace,
        title: options.title,
        statement: statementTokens.join(" "),
        domain: options.domain ? parseClaimLedgerDomain(options.domain) : undefined,
        status: parseClaimLedgerStatus(options.status),
        trust: parseTrustLabel(options.trust),
        tags: options.tag,
        dependsOn: options.dependsOn,
        supersedes: options.supersedes,
        derivedBy: options.derivedBy,
        authors: options.author,
        evidenceRefs: options.evidence.map(parseClaimLedgerEvidenceRef),
        nextChecks: options.nextCheck
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printClaimLedgerWrite(result);
    }
  );

claim
  .command("list")
  .description("List local claim ledger records, optionally filtered by domain, trust, status, or tag.")
  .argument("[path]", "Project root path", ".")
  .option("--domain <domain>", "Filter by claim domain")
  .option("--status <status>", "Filter by claim status")
  .option("--trust <label>", "Filter by trust label")
  .option("--tag <tag>", "Filter by tag")
  .option("--json", "Print full claim ledger JSON with graph")
  .action(
    async (
      path: string,
      options: { domain?: string; status?: string; trust?: string; tag?: string; json?: boolean }
    ) => {
      const domain = options.domain ? parseClaimLedgerDomain(options.domain) : undefined;
      const status = options.status ? parseClaimLedgerStatus(options.status) : undefined;
      const trust = options.trust ? parseTrustLabel(options.trust) : undefined;
      const tag = options.tag?.replace(/^#/u, "").toLowerCase();
      const claims = (await listClaimRecords(path)).filter((record) => {
        if (domain && record.domain !== domain) return false;
        if (status && record.status !== status) return false;
        if (trust && record.trust !== trust) return false;
        if (tag && !record.tags.includes(tag)) return false;
        return true;
      });
      const graph = createClaimLedgerGraph(claims);

      if (options.json) {
        printJson({ total: claims.length, claims, graph });
        return;
      }

      printClaimLedgerList(claims, graph);
    }
  );

claim
  .command("show")
  .description("Show one claim ledger record by id or workspace-local JSON path.")
  .argument("<claim>", "Claim id or workspace-local claim JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--json", "Print the full claim JSON")
  .action(async (claimRef: string, options: { workspace: string; json?: boolean }) => {
    const record = await readClaimRecord(options.workspace, claimRef);

    if (options.json) {
      printJson(record);
      return;
    }

    printClaimLedgerRecord(record);
  });

claim
  .command("review")
  .description("Create an actionable claim review packet with blockers, next actions, and local commands.")
  .argument("<claim>", "Claim id or workspace-local claim JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--json", "Print the full claim review packet JSON")
  .action(async (claimRef: string, options: { workspace: string; json?: boolean }) => {
    const packet = await createClaimReviewPacket({ rootPath: options.workspace, claimRef });

    if (options.json) {
      printJson(packet);
      return;
    }

    printClaimReviewPacket(packet);
    if (packet.reviewStatus !== "ready") {
      process.exitCode = 1;
    }
  });

const bench = program.command("bench").description("Run and compare verification benchmark suites.");

bench
  .command("run")
  .description("Run a benchmark suite JSON file.")
  .argument("<suite>", "Path to a benchmark suite JSON file")
  .option("--json", "Print the full benchmark run JSON")
  .option("--out <path>", "Write the benchmark run JSON to a file")
  .option("--write", "Write JSON and Markdown into .truth-harness/benchmarks")
  .option("--workspace <path>", "Project root path", ".")
  .option("--fail-on-failures", "Exit non-zero when any benchmark task fails")
  .action(async (suitePath: string, options: { json?: boolean; out?: string; write?: boolean; workspace: string; failOnFailures?: boolean }) => {
    const raw = JSON.parse(await readFile(resolve(suitePath), "utf8")) as unknown;
    const suite = parseBenchmarkSuite(raw);
    const run = runBenchmarkSuite(suite);
    const workspaceWrite = options.write
      ? await writeBenchmarkRunRecord({
          rootPath: options.workspace,
          run,
          suiteDescription: suite.description,
          suitePath,
          runnerName: "truth-harness-cli",
          runnerAdapter: "local-receipt-engine",
          command: benchmarkRunReplayCommand(suitePath, options),
          workingDirectory: process.cwd()
        })
      : undefined;

    if (options.out) {
      await writeJson(options.out, run);
    }

    if (options.json) {
      printJson(workspaceWrite ? { run, written: true, result: workspaceWrite } : run);
      if (options.failOnFailures && benchmarkRunFailsGate(run)) {
        process.exitCode = 1;
      }
      return;
    }

    printBenchmarkRun(run, options.out, workspaceWrite);
    if (options.failOnFailures && benchmarkRunFailsGate(run)) {
      process.exitCode = 1;
    }
  });

bench
  .command("compare")
  .description("Compare two truth-harness.benchmark-run.v0 records and flag regressions.")
  .argument("<baseline>", "Baseline benchmark-run JSON path")
  .argument("<current>", "Current benchmark-run JSON path")
  .option("--json", "Print the full benchmark comparison JSON")
  .option("--out <path>", "Write the benchmark comparison JSON to a file")
  .option("--write", "Write JSON and Markdown into .truth-harness/benchmarks")
  .option("--workspace <path>", "Project root path", ".")
  .option("--fail-on-regression", "Exit non-zero when the comparison is regressed or incomparable")
  .action(
    async (
      baselinePath: string,
      currentPath: string,
      options: { json?: boolean; out?: string; write?: boolean; workspace: string; failOnRegression?: boolean }
    ) => {
      const baseline = parseBenchmarkRunRecordJson(await readFile(resolve(baselinePath), "utf8"), baselinePath);
      const current = parseBenchmarkRunRecordJson(await readFile(resolve(currentPath), "utf8"), currentPath);
      const comparison = createBenchmarkComparisonRecord({
        baseline,
        current,
        baselineRef: baselinePath,
        currentRef: currentPath
      });
      const workspaceWrite = options.write
        ? await writeBenchmarkComparisonRecord({
            rootPath: options.workspace,
            baseline,
            current,
            baselineRef: baselinePath,
            currentRef: currentPath
          })
        : undefined;

      if (options.out) {
        await writeJson(options.out, workspaceWrite ? workspaceWrite.record : comparison);
      }

      if (options.json) {
        printJson(workspaceWrite ? { comparison: workspaceWrite.record, written: true, result: workspaceWrite } : comparison);
        if (options.failOnRegression && benchmarkComparisonFailsGate(workspaceWrite?.record ?? comparison)) {
          process.exitCode = 1;
        }
        return;
      }

      printBenchmarkComparison(workspaceWrite?.record ?? comparison, options.out, workspaceWrite);
      if (options.failOnRegression && benchmarkComparisonFailsGate(workspaceWrite?.record ?? comparison)) {
        process.exitCode = 1;
      }
    }
  );

bench
  .command("list")
  .description("List local benchmark run and comparison records.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full benchmark artifact list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const artifacts = await listBenchmarkArtifacts(path);

    if (options.json) {
      printJson({ total: artifacts.length, artifacts });
      return;
    }

    printBenchmarkArtifactList(artifacts);
  });

program
  .command("replay")
  .description("Replay a saved receipt JSON and compare trust-critical fields.")
  .argument("<receipt>", "Path to a receipt JSON file")
  .option("--json", "Print the full replay result JSON")
  .action(async (receiptPath: string, options: { json?: boolean }) => {
    const receipt = parseReceiptJson(await readFile(resolve(receiptPath), "utf8"), receiptPath);
    const replay = replayReceipt(receipt);

    if (options.json) {
      printJson(replay);
      return;
    }

    printReplayResult(replay);
    if (!replay.passed) {
      process.exitCode = 1;
    }
  });

program
  .command("render")
  .description("Render a saved receipt JSON file as Markdown or HTML.")
  .argument("<receipt>", "Path to a receipt JSON file")
  .argument("[format]", "Optional render format: markdown or html")
  .argument("[out]", "Optional output path")
  .option("--format <format>", "markdown or html")
  .option("--out <path>", "Write rendered output to a file")
  .action(
    async (
      receiptPath: string,
      formatArg: string | undefined,
      outArg: string | undefined,
      options: { format?: string; out?: string }
    ) => {
      const receipt = parseReceiptJson(await readFile(resolve(receiptPath), "utf8"), receiptPath);
      const format = parseRenderFormat(options.format ?? formatArg ?? "markdown");
      const outPath = options.out ?? outArg;
      const rendered = renderReceipt(receipt, format);

      if (outPath) {
        await writeText(outPath, rendered);
        console.log(`Wrote ${format} receipt: ${outPath}`);
        return;
      }

      console.log(rendered);
    }
  );

program
  .command("teach")
  .description("Render a professor-friendly teaching packet from a saved receipt JSON file.")
  .argument("<receipt>", "Path to a receipt JSON file")
  .option("--audience <audience>", "middle, high, college, or expert", "college")
  .option("--json", "Print the teaching packet JSON plus Markdown")
  .option("--out <path>", "Write rendered output to a file")
  .action(async (receiptPath: string, options: { audience: string; json?: boolean; out?: string }) => {
    const receipt = parseReceiptJson(await readFile(resolve(receiptPath), "utf8"), receiptPath);
    const audience = parseTeachingAudience(options.audience);
    const packet = createTeachingPacket(receipt, { audience });
    const markdown = renderTeachingPacketMarkdown(packet);

    if (options.json) {
      const payload = { packet, markdown };
      if (options.out) {
        await writeJson(options.out, payload);
        console.log(`Wrote teaching packet JSON: ${resolve(options.out)}`);
        return;
      }

      printJson(payload);
      return;
    }

    if (options.out) {
      await writeText(options.out, markdown);
      console.log(`Wrote teaching packet: ${resolve(options.out)}`);
      return;
    }

    console.log(markdown);
  });

program
  .command("check")
  .description("Check truth-harness fenced claim blocks in Markdown files.")
  .argument("<files...>", "Markdown files to check")
  .option("--json", "Print the full claim check JSON")
  .action(async (files: string[], options: { json?: boolean }) => {
    const results = await Promise.all(
      files.map(async (file) => checkClaimFile(await readFile(resolve(file), "utf8"), file))
    );

    if (options.json) {
      printJson({
        total: results.reduce((sum, result) => sum + result.total, 0),
        passed: results.reduce((sum, result) => sum + result.passed, 0),
        failed: results.reduce((sum, result) => sum + result.failed, 0),
        results
      });
      return;
    }

    printClaimFileChecks(results);
    if (results.some((result) => result.failed > 0)) {
      process.exitCode = 1;
  }
  });

const source = program
  .command("source")
  .description("Ingest and search local source material without network access.");

source
  .command("ingest")
  .description("Ingest local Markdown/text files into the private workspace corpus index.")
  .argument("<paths...>", "Files or directories under the project root")
  .option("--workspace <path>", "Project root path", ".")
  .option("--json", "Print the full ingest result JSON")
  .action(async (paths: string[], options: { workspace: string; json?: boolean }) => {
    const result = await ingestLocalCorpus({ rootPath: options.workspace, paths });

    if (options.json) {
      printJson(result);
      return;
    }

    printSourceIngest(result);
  });

source
  .command("search")
  .description("Search the private local corpus index.")
  .argument("<query...>", "Search query")
  .option("--workspace <path>", "Project root path", ".")
  .option("--limit <count>", "Maximum search hits", parsePositiveInteger, 5)
  .option("--json", "Print the full search result JSON")
  .action(
    async (
      queryTokens: string[],
      options: {
        workspace: string;
        limit: number;
        json?: boolean;
      }
    ) => {
      const result = await searchLocalCorpus({
        rootPath: options.workspace,
        query: queryTokens.join(" "),
        limit: options.limit
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printSourceSearch(result);
    }
  );

source
  .command("cite")
  .description("Create a source-cited receipt for a claim using the private local corpus index.")
  .argument("<claim...>", "Claim to cite against local sources")
  .option("--workspace <path>", "Project root path", ".")
  .option("--query <query>", "Search query. Defaults to the claim text.")
  .option("--limit <count>", "Maximum source hits", parsePositiveInteger, 5)
  .option("--json", "Print the full source-cited receipt JSON")
  .option("--out <path>", "Write the full source-cited receipt JSON to a file")
  .action(
    async (
      claimTokens: string[],
      options: {
        workspace: string;
        query?: string;
        limit: number;
        json?: boolean;
        out?: string;
      }
    ) => {
      const receipt = await createSourceCitationReceipt({
        rootPath: options.workspace,
        claim: claimTokens.join(" "),
        query: options.query,
        limit: options.limit
      });

      if (options.out) {
        await writeJson(options.out, receipt);
      }

      if (options.json) {
        printJson(receipt);
        return;
      }

      printReceipt(receipt, options.out);
    }
  );

const literature = program
  .command("literature")
  .description("Record local literature, prior-art, dataset, and database-export evidence without network access.");

literature
  .command("log")
  .description("Write a private structured literature evidence record into the local workspace.")
  .argument("<title...>", "Paper, patent, dataset, database export, standard, note, or source title")
  .option("--workspace <path>", "Project root path", ".")
  .option("--kind <kind>", "paper, preprint, patent, dataset, database-export, book, web-page, protocol, standard, note, or other", "paper")
  .option("--status <status>", "unreviewed, triaged, read, annotated, reproduced, replicated, disputed, retracted, or superseded", "unreviewed")
  .option("--author <name>", "Author or organization; repeatable", collectRepeated, [])
  .option("--venue <venue>", "Venue, publisher, database, or source collection")
  .option("--year <year>", "Publication or record year", parsePositiveInteger)
  .option("--identifier <kind:value>", "Identifier such as doi:..., pmid:..., arxiv:..., patent:..., url:..., local-path:...; repeatable", collectRepeated, [])
  .option("--local-ref <ref>", "Workspace-local file or artifact ref; repeatable", collectRepeated, [])
  .option("--corpus-ref <ref>", "Local corpus chunk/search ref; repeatable", collectRepeated, [])
  .option("--evidence <ref>", "Related local evidence ref; repeatable", collectRepeated, [])
  .option("--summary <text>", "Short source summary")
  .option("--claim <text>", "Key claim extracted from the source; repeatable", collectRepeated, [])
  .option("--method <text>", "Method, data, or provenance note; repeatable", collectRepeated, [])
  .option("--limitation <text>", "Source limitation; repeatable", collectRepeated, [])
  .option("--relevance <text>", "Why this source matters to the project; repeatable", collectRepeated, [])
  .option("--quality-flag <text>", "Quality, caveat, retraction, conflict, or bias flag; repeatable", collectRepeated, [])
  .option("--next-check <text>", "Next review, replication, prior-art, or entailment check; repeatable", collectRepeated, [])
  .option("--json", "Print the full literature record JSON")
  .action(
    async (
      titleTokens: string[],
      options: {
        workspace: string;
        kind: string;
        status: string;
        author: string[];
        venue?: string;
        year?: number;
        identifier: string[];
        localRef: string[];
        corpusRef: string[];
        evidence: string[];
        summary?: string;
        claim: string[];
        method: string[];
        limitation: string[];
        relevance: string[];
        qualityFlag: string[];
        nextCheck: string[];
        json?: boolean;
      }
    ) => {
      const result = await writeLiteratureRecord({
        rootPath: options.workspace,
        title: titleTokens.join(" "),
        kind: parseLiteratureRecordKind(options.kind),
        status: parseLiteratureRecordStatus(options.status),
        authors: options.author,
        venue: options.venue,
        year: options.year,
        identifiers: options.identifier.map(parseLiteratureIdentifier),
        localRefs: options.localRef,
        corpusRefs: options.corpusRef,
        evidenceRefs: options.evidence,
        summary: options.summary,
        keyClaims: options.claim,
        methodNotes: options.method,
        limitations: options.limitation,
        relevance: options.relevance,
        qualityFlags: options.qualityFlag,
        nextChecks: options.nextCheck
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printLiteratureRecordWrite(result);
    }
  );

literature
  .command("list")
  .description("List private local literature evidence records from the local workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full literature record list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const records = await listLiteratureRecords(path);

    if (options.json) {
      printJson({ total: records.length, records });
      return;
    }

    printLiteratureRecordList(records);
  });

const notebook = program
  .command("notebook")
  .description("Record local notebook, script, and pipeline run provenance without executing code.");

notebook
  .command("log")
  .description("Write a private notebook/script/pipeline run record into the local workspace.")
  .argument("<purpose...>", "Purpose or question for the local run")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short run title")
  .option("--kind <kind>", "notebook, script, pipeline, test, analysis, simulation, or other", "notebook")
  .option("--status <status>", "planned, completed, failed, reproduced, or superseded", "completed")
  .option("--runner <runner>", "Runner such as jupyter, python, node, pytest, snakemake, or nextflow")
  .option("--runner-version <version>", "Runner version")
  .option("--command <command>", "Replay command or manual execution command")
  .option("--cwd <path>", "Working directory for replay")
  .option("--notebook <ref>", "Notebook ref; repeatable", collectRepeated, [])
  .option("--code <ref>", "Code/script ref; repeatable", collectRepeated, [])
  .option("--input <ref>", "Input data/artifact ref; repeatable", collectRepeated, [])
  .option("--output <ref>", "Output artifact ref; repeatable", collectRepeated, [])
  .option("--runtime <runtime>", "Runtime such as python, node, R, julia, or shell")
  .option("--runtime-version <version>", "Runtime version")
  .option("--os <text>", "Operating system or environment label")
  .option("--dependency <nameVersion>", "Dependency or package lock ref; repeatable", collectRepeated, [])
  .option("--env <nameValue>", "Environment variable metadata as name=value;note=optional. Repeatable", collectRepeated, [])
  .option("--parameter <nameValue>", "Parameter as name=value;unit=optional;note=optional. Repeatable", collectRepeated, [])
  .option("--metric <nameValue>", "Metric as name=value;unit=optional;note=optional. Repeatable", collectRepeated, [])
  .option("--observation <text>", "Observation from the run; repeatable", collectRepeated, [])
  .option("--limitation <text>", "Run limitation; repeatable", collectRepeated, [])
  .option("--next-check <text>", "Next reproducibility check; repeatable", collectRepeated, [])
  .option("--replay-note <text>", "Replay note; repeatable", collectRepeated, [])
  .option("--deterministic", "Mark the run as expected to be deterministic")
  .option("--json", "Print the full notebook run record JSON")
  .action(
    async (
      purposeTokens: string[],
      options: {
        workspace: string;
        title?: string;
        kind: string;
        status: string;
        runner?: string;
        runnerVersion?: string;
        command?: string;
        cwd?: string;
        notebook: string[];
        code: string[];
        input: string[];
        output: string[];
        runtime?: string;
        runtimeVersion?: string;
        os?: string;
        dependency: string[];
        env: string[];
        parameter: string[];
        metric: string[];
        observation: string[];
        limitation: string[];
        nextCheck: string[];
        replayNote: string[];
        deterministic?: boolean;
        json?: boolean;
      }
    ) => {
      const result = await writeNotebookRun({
        rootPath: options.workspace,
        title: options.title,
        purpose: purposeTokens.join(" "),
        kind: parseNotebookRunKind(options.kind),
        status: parseNotebookRunStatus(options.status),
        runner: options.runner,
        runnerVersion: options.runnerVersion,
        command: options.command,
        workingDirectory: options.cwd,
        notebookRefs: options.notebook,
        codeRefs: options.code,
        inputRefs: options.input,
        outputRefs: options.output,
        runtime: options.runtime,
        runtimeVersion: options.runtimeVersion,
        operatingSystem: options.os,
        dependencies: options.dependency,
        environmentVariables: options.env.map(parseNotebookRunValue),
        parameters: options.parameter.map(parseNotebookRunValue),
        metrics: options.metric.map(parseNotebookRunValue),
        observations: options.observation,
        limitations: options.limitation,
        nextChecks: options.nextCheck,
        replayNotes: options.replayNote,
        deterministic: options.deterministic
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printNotebookRunWrite(result);
    }
  );

notebook
  .command("list")
  .description("List private local notebook/script/pipeline run records from the local workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full notebook run record list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const records = await listNotebookRuns(path);

    if (options.json) {
      printJson({ total: records.length, records });
      return;
    }

    printNotebookRunList(records);
  });

const code = program
  .command("code")
  .description("Execute local direct commands under policy and record process evidence.");

code
  .command("sandbox-status")
  .description("Report whether a measured code-run sandbox is available.")
  .option("--json", "Print the full sandbox status JSON")
  .action((options: { json?: boolean }) => {
    const status = getCodeRunSandboxStatus();
    if (options.json) {
      printJson(status);
      if (!status.available) {
        process.exitCode = 1;
      }
      return;
    }

    console.log(`Code-run sandbox: ${status.available ? "available" : "unavailable"}`);
    console.log(`Provider: ${status.provider}`);
    console.log(`Network isolation: ${status.networkIsolation}`);
    console.log(`Filesystem isolation: ${status.filesystemIsolation}`);
    console.log(status.reason);
    if (!status.available) {
      process.exitCode = 1;
    }
  });

code
  .command("run")
  .description("Run a local command without shell interpolation and write a code-execution record.")
  .argument("<purpose...>", "Purpose or question for this code run")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short code run title")
  .requiredOption("--command <executable>", "Executable path or command to launch directly without shell interpolation")
  .option("--arg <value>", "Argument to pass to the executable. Repeat for multiple args.", collectRepeated, [])
  .option("--cwd <path>", "Working directory under the workspace root", ".")
  .option("--code <ref>", "Code/script ref; repeatable", collectRepeated, [])
  .option("--input <ref>", "Input data/artifact ref; repeatable", collectRepeated, [])
  .option("--output <ref>", "Output artifact ref; repeatable", collectRepeated, [])
  .option("--evidence <ref>", "Related evidence ref; repeatable", collectRepeated, [])
  .option("--timeout-ms <ms>", "Command timeout in milliseconds; maximum 120000", parsePositiveInteger, 10000)
  .option("--max-output-bytes <bytes>", "Maximum captured bytes per output stream; maximum 1048576", parsePositiveInteger, 65536)
  .option("--allow-executable <name>", "Required executable name/path allowlist. Repeat for multiple allowed executables.", collectRepeated, [])
  .option("--require-sandbox", "Require a measured code-run sandbox; fail closed if none is available")
  .option("--allow-shell-launcher", "Allow shell launcher executables such as cmd, PowerShell, bash, or sh")
  .option("--allow-network-command", "Allow obvious network-capable commands such as curl, wget, ssh, or scp")
  .option("--allow-destructive-command", "Allow obvious destructive commands such as rm, rmdir, format, or shutdown")
  .option("--allow-package-mutation", "Allow package-manager mutation commands such as npm install or pip install")
  .option("--allow-git-mutation", "Allow git mutation/network commands such as push, pull, reset, clean, or checkout")
  .option("--fail-on-nonzero", "Exit non-zero unless the command exits with code 0")
  .option("--json", "Print the full code run record JSON")
  .action(
    async (
      purposeTokens: string[],
      options: {
        workspace: string;
        title?: string;
        command: string;
        arg: string[];
        cwd: string;
        code: string[];
        input: string[];
        output: string[];
        evidence: string[];
        timeoutMs: number;
        maxOutputBytes: number;
        allowExecutable: string[];
        requireSandbox?: boolean;
        allowShellLauncher?: boolean;
        allowNetworkCommand?: boolean;
        allowDestructiveCommand?: boolean;
        allowPackageMutation?: boolean;
        allowGitMutation?: boolean;
        failOnNonzero?: boolean;
        json?: boolean;
      }
    ) => {
      const policy: CodeRunPolicyInput = {
        allowedExecutables: options.allowExecutable,
        requireSandbox: options.requireSandbox,
        allowShellLauncher: options.allowShellLauncher,
        allowNetworkCommand: options.allowNetworkCommand,
        allowDestructiveCommand: options.allowDestructiveCommand,
        allowPackageMutation: options.allowPackageMutation,
        allowGitMutation: options.allowGitMutation
      };
      const result = await writeCodeRun({
        rootPath: options.workspace,
        title: options.title,
        purpose: purposeTokens.join(" "),
        command: options.command,
        args: options.arg,
        workingDirectory: options.cwd,
        codeRefs: options.code,
        inputRefs: options.input,
        outputRefs: options.output,
        evidenceRefs: options.evidence,
        timeoutMs: options.timeoutMs,
        maxOutputBytes: options.maxOutputBytes,
        policy
      });

      if (options.json) {
        printJson(result);
        if (options.failOnNonzero && result.record.execution.status !== "passed") {
          process.exitCode = 1;
        }
        return;
      }

      printCodeRunWrite(result);
      if (options.failOnNonzero && result.record.execution.status !== "passed") {
        process.exitCode = 1;
      }
    }
  );

code
  .command("list")
  .description("List private local code-execution records from the local workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full code run record list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const records = await listCodeRuns(path);

    if (options.json) {
      printJson({ total: records.length, records });
      return;
    }

    printCodeRunList(records);
  });

const simulation = program
  .command("simulation")
  .description("Record local simulation evidence without treating computation as real-world validation.");

simulation
  .command("log")
  .description("Write a private simulation evidence record into the local workspace.")
  .argument("<question...>", "Simulation question or claim under investigation")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short simulation title")
  .option("--kind <kind>", "numeric, symbolic, physics, molecular, statistical, agentic, or other", "numeric")
  .option("--stage <stage>", "planned, computed, reproduced, benchmarked, or experimentally-compared", "computed")
  .requiredOption("--engine <engine>", "Local simulation engine, script, notebook, solver, or tool")
  .option("--engine-version <version>", "Simulation engine version")
  .requiredOption("--model <name>", "Model name or simulation model identifier")
  .option("--model-version <version>", "Model version")
  .option("--input <ref>", "Input ref; repeatable", collectRepeated, [])
  .option("--output <ref>", "Output ref; repeatable", collectRepeated, [])
  .option("--code <ref>", "Code or notebook ref; repeatable", collectRepeated, [])
  .option("--parameter <nameValue>", "Parameter as name=value;unit=optional;note=optional. Repeatable", collectRepeated, [])
  .option("--metric <nameValue>", "Metric as name=value;unit=optional;note=optional. Repeatable", collectRepeated, [])
  .option("--assumption <note>", "Model assumption; repeatable", collectRepeated, [])
  .option("--uncertainty <note>", "Uncertainty note; repeatable", collectRepeated, [])
  .option("--limitation <note>", "Model or implementation limitation; repeatable", collectRepeated, [])
  .option("--next-check <note>", "Next validation check; repeatable", collectRepeated, [])
  .option("--json", "Print the full simulation log JSON")
  .action(
    async (
      questionTokens: string[],
      options: {
        workspace: string;
        title?: string;
        kind: string;
        stage: string;
        engine: string;
        engineVersion?: string;
        model: string;
        modelVersion?: string;
        input: string[];
        output: string[];
        code: string[];
        parameter: string[];
        metric: string[];
        assumption: string[];
        uncertainty: string[];
        limitation: string[];
        nextCheck: string[];
        json?: boolean;
      }
    ) => {
      const result = await createSimulationLogEntry({
        rootPath: options.workspace,
        title: options.title,
        question: questionTokens.join(" "),
        kind: parseSimulationKind(options.kind),
        stage: parseSimulationStage(options.stage),
        engine: options.engine,
        engineVersion: options.engineVersion,
        modelName: options.model,
        modelVersion: options.modelVersion,
        inputRefs: options.input,
        outputRefs: options.output,
        codeRefs: options.code,
        parameters: options.parameter.map(parseSimulationScalar),
        metrics: options.metric.map(parseSimulationScalar),
        assumptions: options.assumption,
        uncertainty: options.uncertainty,
        limitations: options.limitation,
        nextChecks: options.nextCheck
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printSimulationLogWrite(result);
    }
  );

simulation
  .command("list")
  .description("List private simulation evidence records from the local workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full simulation log list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const entries = await listSimulationLogEntries(path);

    if (options.json) {
      printJson({ total: entries.length, entries });
      return;
    }

    printSimulationLogList(entries);
  });

const experiment = program
  .command("experiment")
  .description("Record local experiment evidence with ethics, safety, replication, and regulatory caveats.");

experiment
  .command("log")
  .description("Write a private experiment evidence record into the local workspace.")
  .argument("<question...>", "Experiment question or observation under review")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short experiment title")
  .option("--kind <kind>", "bench, wet-lab, field, preclinical, clinical, observational, or other", "bench")
  .option("--stage <stage>", "planned, protocol-drafted, running, completed, replicated, failed, or inconclusive", "planned")
  .option("--protocol <ref>", "Protocol ref; repeatable", collectRepeated, [])
  .option("--data <ref>", "Data ref; repeatable", collectRepeated, [])
  .option("--analysis <ref>", "Analysis ref; repeatable", collectRepeated, [])
  .option("--evidence <ref>", "Related evidence ref; repeatable", collectRepeated, [])
  .option("--observation <note>", "Observation note; repeatable", collectRepeated, [])
  .option("--measurement <nameValue>", "Measurement as name=value;unit=optional;note=optional. Repeatable", collectRepeated, [])
  .option("--outcome <status>", "not-run, observed, not-observed, mixed, or inconclusive")
  .option("--summary <summary>", "Outcome summary")
  .option("--limitation <note>", "Experiment limitation; repeatable", collectRepeated, [])
  .option("--next-check <note>", "Next validation check; repeatable", collectRepeated, [])
  .option("--ethics <ref>", "Ethics approval/review ref; repeatable", collectRepeated, [])
  .option("--regulatory <ref>", "Regulatory or safety review ref; repeatable", collectRepeated, [])
  .option("--human-subjects", "Mark as involving human subjects")
  .option("--biological-or-medical", "Mark as biological, medical, or safety-sensitive")
  .option("--json", "Print the full experiment log JSON")
  .action(
    async (
      questionTokens: string[],
      options: {
        workspace: string;
        title?: string;
        kind: string;
        stage: string;
        protocol: string[];
        data: string[];
        analysis: string[];
        evidence: string[];
        observation: string[];
        measurement: string[];
        outcome?: string;
        summary?: string;
        limitation: string[];
        nextCheck: string[];
        ethics: string[];
        regulatory: string[];
        humanSubjects?: boolean;
        biologicalOrMedical?: boolean;
        json?: boolean;
      }
    ) => {
      const result = await createExperimentLogEntry({
        rootPath: options.workspace,
        title: options.title,
        question: questionTokens.join(" "),
        kind: parseExperimentKind(options.kind),
        stage: parseExperimentStage(options.stage),
        protocolRefs: options.protocol,
        dataRefs: options.data,
        analysisRefs: options.analysis,
        evidenceRefs: options.evidence,
        observations: options.observation,
        measurements: options.measurement.map(parseExperimentMeasurement),
        outcomeStatus: options.outcome ? parseExperimentOutcome(options.outcome) : undefined,
        outcomeSummary: options.summary,
        limitations: options.limitation,
        nextChecks: options.nextCheck,
        ethicsApprovalRefs: options.ethics,
        regulatoryReviewRefs: options.regulatory,
        humanSubjects: options.humanSubjects,
        biologicalOrMedical: options.biologicalOrMedical
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printExperimentLogWrite(result);
    }
  );

experiment
  .command("list")
  .description("List private experiment evidence records from the local workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full experiment log list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const entries = await listExperimentLogEntries(path);

    if (options.json) {
      printJson({ total: entries.length, entries });
      return;
    }

    printExperimentLogList(entries);
  });

const vault = program
  .command("vault")
  .description("Seal and verify local private files with workspace-local encryption.");

vault
  .command("seal")
  .description("Encrypt a workspace-local file into the private vault.")
  .argument("<path>", "Workspace-local file path to encrypt")
  .option("--workspace <path>", "Project root path", ".")
  .option("--label <label>", "Safe public label for the vault entry")
  .option("--key-env <name>", "Environment variable containing the vault key", "TRUTH_HARNESS_VAULT_KEY")
  .option("--json", "Print the full vault envelope JSON")
  .action(
    async (
      path: string,
      options: {
        workspace: string;
        label?: string;
        keyEnv: string;
        json?: boolean;
      }
    ) => {
      const result = await sealVaultFile({
        rootPath: options.workspace,
        sourcePath: path,
        label: options.label,
        keyEnv: options.keyEnv
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printVaultSeal(result);
    }
  );

vault
  .command("list")
  .description("List encrypted local vault envelopes from the workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full vault envelope list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const entries = await listVaultEntries(path);

    if (options.json) {
      printJson({ total: entries.length, entries });
      return;
    }

    printVaultList(entries);
  });

vault
  .command("verify")
  .description("Decrypt a vault entry locally and report integrity metadata without printing plaintext.")
  .argument("<vault>", "Vault id or workspace-local vault envelope path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--key-env <name>", "Environment variable containing the vault key", "TRUTH_HARNESS_VAULT_KEY")
  .option("--json", "Print the full verification summary JSON")
  .action(
    async (
      vaultRef: string,
      options: {
        workspace: string;
        keyEnv: string;
        json?: boolean;
      }
    ) => {
      const result = await verifyVaultEntry({
        rootPath: options.workspace,
        vaultRef,
        keyEnv: options.keyEnv
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printVaultVerify(result);
    }
  );

vault
  .command("open")
  .description("Decrypt a vault entry locally and write the plaintext bytes to an output file.")
  .argument("<vault>", "Vault id or workspace-local vault envelope path")
  .requiredOption("--out <path>", "Output file for decrypted plaintext bytes")
  .option("--workspace <path>", "Project root path", ".")
  .option("--key-env <name>", "Environment variable containing the vault key", "TRUTH_HARNESS_VAULT_KEY")
  .option("--json", "Print the open summary JSON")
  .action(
    async (
      vaultRef: string,
      options: {
        out: string;
        workspace: string;
        keyEnv: string;
        json?: boolean;
      }
    ) => {
      const result = await openVaultEntry({
        rootPath: options.workspace,
        vaultRef,
        keyEnv: options.keyEnv
      });
      const outputPath = await writeBytes(options.out, result.bytes);

      if (options.json) {
        printJson({ entry: result.entry, payload: result.payload, outputPath });
        return;
      }

      printVaultOpen(result, outputPath);
    }
  );

const audit = program
  .command("audit")
  .description("Audit claim evidence posture and overclaim risk against local evidence refs.");

audit
  .command("claim")
  .description("Create a local evidence audit for a claim.")
  .argument("<claim...>", "Claim to audit")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short audit title")
  .option("--evidence <ref>", "Evidence ref, optionally prefixed as receipt:path, simulation:id, experiment:id, vault:id, literature:id, or source:path", collectRepeated, [])
  .option("--write", "Write the audit JSON into the local workspace")
  .option("--report", "Write audit JSON and a Markdown report into the local workspace")
  .option("--json", "Print the full evidence audit JSON")
  .action(
    async (
      claimTokens: string[],
      options: {
        workspace: string;
        title?: string;
        evidence: string[];
        write?: boolean;
        report?: boolean;
        json?: boolean;
      }
    ) => {
      const input = {
        rootPath: options.workspace,
        title: options.title,
        claim: claimTokens.join(" "),
        evidenceRefs: options.evidence.map(parseEvidenceRef)
      };
      const result = options.report
        ? await writeEvidenceAuditReport(input)
        : options.write
          ? await writeEvidenceAudit(input)
          : await createEvidenceAudit(input);

      if (options.json) {
        printJson(result);
        return;
      }

      if (options.report) {
        printEvidenceAuditReportWrite(result as EvidenceAuditReportWriteResult);
        return;
      }

      if (options.write) {
        printEvidenceAuditWrite(result as EvidenceAuditWriteResult);
        return;
      }

      printEvidenceAudit(result as EvidenceAudit);
    }
  );

audit
  .command("list")
  .description("List local evidence audits from the workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full evidence audit list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const audits = await listEvidenceAudits(path);

    if (options.json) {
      printJson({ total: audits.length, audits });
      return;
    }

    printEvidenceAuditList(audits);
  });

const validation = program
  .command("validation")
  .description("Create local validation-gate plans before stronger discovery, biomedical, patent, or engineering claims.");

validation
  .command("plan")
  .description("Write a private local validation plan with required evidence gates.")
  .argument("<claim...>", "Claim or hypothesis to validate")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short validation plan title")
  .option("--objective <text>", "Validation objective")
  .option("--domain <domain>", "math, source, literature, simulation, experiment, biomedical, clinical, safety, regulatory, patent, engineering, software, physics, or general. Repeatable", collectRepeated, [])
  .option("--evidence <ref>", "Evidence ref, optionally prefixed as receipt:path, route:id, simulation:id, experiment:id, review:id, audit:id, snapshot:id, claim-chart:id, literature:id, or source:path", collectRepeated, [])
  .option("--gate <gate>", "Manual gate as kind:description or description; repeatable", collectRepeated, [])
  .option("--preview", "Derive the validation plan without writing files")
  .option("--json", "Print the full validation plan JSON")
  .action(
    async (
      claimTokens: string[],
      options: {
        workspace: string;
        title?: string;
        objective?: string;
        domain: string[];
        evidence: string[];
        gate: string[];
        preview?: boolean;
        json?: boolean;
      }
    ) => {
      const input = {
        rootPath: options.workspace,
        title: options.title,
        objective: options.objective,
        claim: claimTokens.join(" "),
        domains: options.domain.map(parseValidationPlanDomain),
        evidenceRefs: options.evidence.map(parseValidationEvidenceRef),
        gates: options.gate.map(parseValidationGateInput)
      };
      const result = options.preview ? await createValidationPlan(input) : await writeValidationPlan(input);

      if (options.json) {
        printJson(result);
        return;
      }

      if (options.preview) {
        printValidationPlan(result as ValidationPlan);
        return;
      }

      printValidationPlanWrite(result as ValidationPlanWriteResult);
    }
  );

validation
  .command("list")
  .description("List private local validation plans.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full validation plan list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const plans = await listValidationPlans(path);

    if (options.json) {
      printJson({ total: plans.length, plans });
      return;
    }

    printValidationPlanList(plans);
  });

const research = program
  .command("research")
  .description("Manage local-first research sessions for long agentic investigations.");

research
  .command("harness")
  .description("Start a hard-problem research harness with conservative verification lanes.")
  .argument("<objective...>", "Hard research objective")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short research session title")
  .option("--domain <domain>", "math, physics, code, biomedical, materials, energy, climate, patent, learning, or general. Repeatable", collectRepeated, [])
  .option("--hypothesis <text>", "Hypothesis to track; repeatable", collectRepeated, [])
  .option("--claim <text>", "Claim to verify; repeatable", collectRepeated, [])
  .option("--evidence <ref>", "Evidence ref, optionally prefixed as receipt:path, simulation:id, audit:id, snapshot:id, literature:id, or source:path", collectRepeated, [])
  .option("--snapshot <ref>", "Workspace snapshot id or path; repeatable", collectRepeated, [])
  .option("--task <text>", "Additional research task; repeatable", collectRepeated, [])
  .option("--no-default-tasks", "Only use tasks supplied with --task")
  .option("--max-depth <count>", "Maximum recursive investigation depth", parsePositiveInteger)
  .option("--max-branches <count>", "Maximum branches per node", parsePositiveInteger)
  .option("--max-tool-calls <count>", "Maximum tool calls before review", parsePositiveInteger)
  .option("--max-wall-minutes <count>", "Maximum wall minutes before review", parsePositiveInteger)
  .option("--json", "Print the full research harness JSON")
  .action(
    async (
      objectiveTokens: string[],
      options: {
        workspace: string;
        title?: string;
        domain: string[];
        hypothesis: string[];
        claim: string[];
        evidence: string[];
        snapshot: string[];
        task: string[];
        defaultTasks?: boolean;
        maxDepth?: number;
        maxBranches?: number;
        maxToolCalls?: number;
        maxWallMinutes?: number;
        json?: boolean;
      }
    ) => {
      const result = await writeResearchHarness({
        rootPath: options.workspace,
        title: options.title,
        objective: objectiveTokens.join(" "),
        domains: options.domain.map(parseResearchSessionDomain),
        hypotheses: options.hypothesis,
        claims: options.claim,
        evidenceRefs: options.evidence.map(parseResearchEvidenceRef),
        snapshotRefs: options.snapshot,
        tasks: options.task,
        includeDefaultTasks: options.defaultTasks !== false,
        maxDepth: options.maxDepth,
        maxBranches: options.maxBranches,
        maxToolCalls: options.maxToolCalls,
        maxWallMinutes: options.maxWallMinutes
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printResearchSessionWrite(result);
    }
  );

research
  .command("start")
  .description("Start a private local research session runbook.")
  .argument("<objective...>", "Research objective")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short research session title")
  .option("--domain <domain>", "math, physics, code, biomedical, materials, energy, climate, patent, learning, or general. Repeatable", collectRepeated, [])
  .option("--hypothesis <text>", "Hypothesis to track; repeatable", collectRepeated, [])
  .option("--claim <text>", "Claim to verify; repeatable", collectRepeated, [])
  .option("--evidence <ref>", "Evidence ref, optionally prefixed as receipt:path, simulation:id, audit:id, snapshot:id, literature:id, or source:path", collectRepeated, [])
  .option("--snapshot <ref>", "Workspace snapshot id or path; repeatable", collectRepeated, [])
  .option("--task <text>", "Initial research task; repeatable", collectRepeated, [])
  .option("--max-depth <count>", "Maximum recursive investigation depth", parsePositiveInteger)
  .option("--max-branches <count>", "Maximum branches per node", parsePositiveInteger)
  .option("--max-tool-calls <count>", "Maximum tool calls before review", parsePositiveInteger)
  .option("--max-wall-minutes <count>", "Maximum wall minutes before review", parsePositiveInteger)
  .option("--json", "Print the full research session JSON")
  .action(
    async (
      objectiveTokens: string[],
      options: {
        workspace: string;
        title?: string;
        domain: string[];
        hypothesis: string[];
        claim: string[];
        evidence: string[];
        snapshot: string[];
        task: string[];
        maxDepth?: number;
        maxBranches?: number;
        maxToolCalls?: number;
        maxWallMinutes?: number;
        json?: boolean;
      }
    ) => {
      const result = await writeResearchSession({
        rootPath: options.workspace,
        title: options.title,
        objective: objectiveTokens.join(" "),
        domains: options.domain.map(parseResearchSessionDomain),
        hypotheses: options.hypothesis,
        claims: options.claim,
        evidenceRefs: options.evidence.map(parseResearchEvidenceRef),
        snapshotRefs: options.snapshot,
        tasks: options.task,
        maxDepth: options.maxDepth,
        maxBranches: options.maxBranches,
        maxToolCalls: options.maxToolCalls,
        maxWallMinutes: options.maxWallMinutes
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printResearchSessionWrite(result);
    }
  );

research
  .command("checkpoint")
  .description("Append a checkpoint to a private local research session.")
  .argument("<session>", "Research session id or workspace-local JSON path")
  .argument("<summary...>", "Checkpoint summary")
  .option("--workspace <path>", "Project root path", ".")
  .option("--evidence <ref>", "Evidence ref, optionally prefixed as receipt:path, simulation:id, audit:id, snapshot:id, literature:id, or source:path", collectRepeated, [])
  .option("--snapshot <ref>", "Workspace snapshot id or path; repeatable", collectRepeated, [])
  .option("--decision <text>", "Decision recorded at this checkpoint; repeatable", collectRepeated, [])
  .option("--next-check <text>", "Next validation check; repeatable", collectRepeated, [])
  .option("--json", "Print the full research checkpoint JSON")
  .action(
    async (
      sessionRef: string,
      summaryTokens: string[],
      options: {
        workspace: string;
        evidence: string[];
        snapshot: string[];
        decision: string[];
        nextCheck: string[];
        json?: boolean;
      }
    ) => {
      const result = await addResearchSessionCheckpoint({
        rootPath: options.workspace,
        sessionRef,
        summary: summaryTokens.join(" "),
        evidenceRefs: options.evidence.map(parseResearchEvidenceRef),
        snapshotRefs: options.snapshot,
        decisions: options.decision,
        nextChecks: options.nextCheck
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printResearchCheckpointWrite(result);
    }
  );

research
  .command("task")
  .description("Update a research-session task status, evidence refs, and next checks.")
  .argument("<session>", "Research session id or workspace-local JSON path")
  .argument("<task>", "Task id or exact task title")
  .option("--workspace <path>", "Project root path", ".")
  .option("--status <status>", "todo, doing, blocked, or done")
  .option("--evidence <ref>", "Evidence ref proving or informing this task update; repeatable", collectRepeated, [])
  .option("--next-check <text>", "Next validation check for this task; repeatable", collectRepeated, [])
  .option("--json", "Print the full task update JSON")
  .action(
    async (
      sessionRef: string,
      taskRef: string,
      options: { workspace: string; status?: string; evidence: string[]; nextCheck: string[]; json?: boolean }
    ) => {
      const result = await updateResearchSessionTask({
        rootPath: options.workspace,
        sessionRef,
        taskRef,
        status: options.status ? parseResearchTaskStatus(options.status) : undefined,
        evidenceRefs: options.evidence.map(parseResearchEvidenceRef),
        nextChecks: options.nextCheck
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printResearchTaskUpdate(result);
    }
  );

research
  .command("show")
  .description("Show a private local research session by id or workspace-local JSON path.")
  .argument("<session>", "Research session id or workspace-local JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--json", "Print the full research session JSON")
  .action(async (sessionRef: string, options: { workspace: string; json?: boolean }) => {
    const session = await readResearchSession(options.workspace, sessionRef);

    if (options.json) {
      printJson(session);
      return;
    }

    printResearchSession(session);
  });

research
  .command("list")
  .description("List private local research sessions.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full research session list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const sessions = await listResearchSessions(path);

    if (options.json) {
      printJson({ total: sessions.length, sessions });
      return;
    }

    printResearchSessionList(sessions);
  });

const review = program
  .command("review")
  .description("Record human expert, safety, regulatory, and legal review artifacts.");

review
  .command("log")
  .description("Write a private local expert-review record.")
  .argument("<subject...>", "Subject under expert review")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short review title")
  .option("--question <question>", "Review question or scope")
  .option("--kind <kind>", "math, physics, engineering, software, biomedical, clinical, safety, ethics, regulatory, patent-legal, domain-expert, or other")
  .option("--status <status>", "needed, requested, in-review, completed, rejected, or superseded", "needed")
  .requiredOption("--reviewer-role <role>", "Reviewer role, such as oncologist, physicist, patent attorney, or software auditor")
  .option("--reviewer <name>", "Reviewer name or organization")
  .option("--credentials <text>", "Reviewer credentials")
  .option("--conflict <text>", "Conflict disclosure")
  .option("--evidence <ref>", "Evidence ref, optionally prefixed as receipt:path, simulation:id, review:id, literature:id, or source:path", collectRepeated, [])
  .option("--finding <text>", "Finding; repeatable", collectRepeated, [])
  .option("--limitation <text>", "Limitation; repeatable", collectRepeated, [])
  .option("--recommendation <text>", "Recommendation; repeatable", collectRepeated, [])
  .option("--next-check <text>", "Required next check; repeatable", collectRepeated, [])
  .option("--outcome <outcome>", "not-reviewed, needs-more-evidence, supported-with-limitations, not-supported, inconclusive, requires-validation, or legal-review-only")
  .option("--summary <summary>", "Outcome summary")
  .option("--json", "Print the full expert-review JSON")
  .action(
    async (
      subjectTokens: string[],
      options: {
        workspace: string;
        title?: string;
        question?: string;
        kind?: string;
        status: string;
        reviewerRole: string;
        reviewer?: string;
        credentials?: string;
        conflict?: string;
        evidence: string[];
        finding: string[];
        limitation: string[];
        recommendation: string[];
        nextCheck: string[];
        outcome?: string;
        summary?: string;
        json?: boolean;
      }
    ) => {
      const result = await writeExpertReview({
        rootPath: options.workspace,
        title: options.title,
        subject: subjectTokens.join(" "),
        question: options.question,
        kind: options.kind ? parseExpertReviewKind(options.kind) : undefined,
        status: parseExpertReviewStatus(options.status),
        reviewerRole: options.reviewerRole,
        reviewerNameOrOrg: options.reviewer,
        reviewerCredentials: options.credentials,
        conflictDisclosure: options.conflict,
        evidenceRefs: options.evidence.map(parseExpertReviewEvidenceRef),
        findings: options.finding,
        limitations: options.limitation,
        recommendations: options.recommendation,
        requiredNextChecks: options.nextCheck,
        outcomeStatus: options.outcome ? parseExpertReviewOutcome(options.outcome) : undefined,
        outcomeSummary: options.summary
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printExpertReviewWrite(result);
    }
  );

review
  .command("list")
  .description("List private local expert-review records.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full expert-review list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const reviews = await listExpertReviews(path);

    if (options.json) {
      printJson({ total: reviews.length, reviews });
      return;
    }

    printExpertReviewList(reviews);
  });

const invention = program
  .command("invention")
  .description("Capture local-first discovery and invention logs without overclaiming validation.");

invention
  .command("log")
  .description("Write a private invention or discovery hypothesis log into the local workspace.")
  .argument("<hypothesis...>", "Hypothesis text")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short invention log title")
  .option("--problem <problem>", "Problem or research question")
  .option("--stage <stage>", "Validation stage", "computational-hypothesis")
  .option("--evidence <ref>", "Evidence ref, optionally prefixed as receipt:path, literature:id, or source:path", collectRepeated, [])
  .option("--novelty <note>", "Novelty note; repeatable", collectRepeated, [])
  .option("--prior-art <note>", "Prior-art note; repeatable", collectRepeated, [])
  .option("--risk <note>", "Risk or limitation note; repeatable", collectRepeated, [])
  .option("--next-check <note>", "Next validation check; repeatable", collectRepeated, [])
  .option("--json", "Print the full invention log JSON")
  .action(
    async (
      hypothesisTokens: string[],
      options: {
        workspace: string;
        title?: string;
        problem?: string;
        stage: string;
        evidence: string[];
        novelty: string[];
        priorArt: string[];
        risk: string[];
        nextCheck: string[];
        json?: boolean;
      }
    ) => {
      const result = await createInventionLogEntry({
        rootPath: options.workspace,
        title: options.title,
        problem: options.problem,
        hypothesis: hypothesisTokens.join(" "),
        validationStage: parseInventionValidationStage(options.stage),
        evidenceRefs: options.evidence.map(parseEvidenceRef),
        noveltyNotes: options.novelty,
        priorArtNotes: options.priorArt,
        risks: options.risk,
        nextChecks: options.nextCheck
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printInventionLogWrite(result.entry, result.path);
    }
  );

invention
  .command("list")
  .description("List private invention logs from the local workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full invention log list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const entries = await listInventionLogEntries(path);

    if (options.json) {
      printJson({ total: entries.length, entries });
      return;
    }

    printInventionLogList(entries);
  });

invention
  .command("package")
  .description("Render a local discovery package report for an invention log.")
  .argument("[entryId]", "Invention log entry id. Defaults to the newest entry.")
  .option("--workspace <path>", "Project root path", ".")
  .option("--write", "Write Markdown into .truth-harness/findings")
  .option("--json", "Print the full discovery package JSON")
  .action(
    async (
      entryId: string | undefined,
      options: {
        workspace: string;
        write?: boolean;
        json?: boolean;
      }
    ) => {
      if (options.write) {
        const result = await writeDiscoveryPackage({ rootPath: options.workspace, entryId });

        if (options.json) {
          printJson(result);
          return;
        }

        printDiscoveryPackageWrite(result);
        return;
      }

      const discoveryPackage = await createDiscoveryPackage({ rootPath: options.workspace, entryId });

      if (options.json) {
        printJson(discoveryPackage);
        return;
      }

      printDiscoveryPackage(discoveryPackage);
    }
  );

invention
  .command("claim-chart")
  .description("Create a local patent claim chart for an invention log without legal conclusions.")
  .argument("[entryId]", "Invention log entry id. Defaults to the newest entry.")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Claim chart title")
  .option("--element <text>", "Claim element text; repeatable", collectRepeated, [])
  .option("--evidence <ref>", "Shared support evidence ref, optionally prefixed as receipt:path, literature:id, or source:path", collectRepeated, [])
  .option("--prior-art <note>", "Prior-art note; repeatable", collectRepeated, [])
  .option("--novelty-question <question>", "Novelty question; repeatable", collectRepeated, [])
  .option("--reduction <ref>", "Reduction-to-practice or constructive example ref; repeatable", collectRepeated, [])
  .option("--write", "Write JSON and Markdown into .truth-harness/patents")
  .option("--json", "Print the full claim chart JSON")
  .action(
    async (
      entryId: string | undefined,
      options: {
        workspace: string;
        title?: string;
        element: string[];
        evidence: string[];
        priorArt: string[];
        noveltyQuestion: string[];
        reduction: string[];
        write?: boolean;
        json?: boolean;
      }
    ) => {
      const input = {
        rootPath: options.workspace,
        entryId,
        title: options.title,
        elements: options.element.map(parseClaimChartElement),
        evidenceRefs: options.evidence.map(parseEvidenceRef),
        priorArtNotes: options.priorArt,
        noveltyQuestions: options.noveltyQuestion,
        reductionToPracticeRefs: options.reduction
      };

      if (options.write) {
        const result = await writeClaimChart(input);

        if (options.json) {
          printJson(result);
          return;
        }

        printClaimChartWrite(result);
        return;
      }

      const chart = await createClaimChart(input);

      if (options.json) {
        printJson(chart);
        return;
      }

      printClaimChart(chart);
    }
  );

invention
  .command("claim-charts")
  .description("List local patent claim charts from the workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full claim chart list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const charts = await listClaimCharts(path);

    if (options.json) {
      printJson({ total: charts.length, charts });
      return;
    }

    printClaimChartList(charts);
  });

const modelContext = program
  .command("model-context")
  .description("Prepare local-only selected context packets for hosted or local model review.");

modelContext
  .command("prepare")
  .description("Write a private local model-context packet without calling any model or service.")
  .argument("<purpose...>", "Purpose for the model review")
  .requiredOption("--service <service>", "Target service or local model label")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Short packet title")
  .option("--target <target>", "hosted-model, local-model, or external-service", "hosted-model")
  .option("--model <model>", "Specific hosted or local model name")
  .option("--endpoint <endpoint>", "Optional endpoint or service surface")
  .option("--data <class>", "Data class included in selected context; repeatable", collectRepeated, [])
  .option("--ref <ref>", "Selected local context ref; repeatable", collectRepeated, [])
  .option("--section <section>", "Prompt section as title=content; repeatable", collectRepeated, [])
  .option("--redaction <note>", "Redaction/minimization note; repeatable", collectRepeated, [])
  .option("--exclude <note>", "Excluded local data note; repeatable", collectRepeated, [])
  .option("--approval <ref>", "Human approval ref permitting selected-context use")
  .option("--approved-by <name>", "Approver name or role")
  .option("--approved-at <iso>", "Approval timestamp")
  .option("--disclosure <ref>", "Existing disclosure log ref")
  .option("--disclosure-status <status>", "not-required, required-not-created, planned, sent, or cancelled")
  .option("--preview", "Derive the model-context packet without writing files")
  .option("--json", "Print the full model-context packet JSON")
  .action(
    async (
      purposeTokens: string[],
      options: {
        service: string;
        workspace: string;
        title?: string;
        target: string;
        model?: string;
        endpoint?: string;
        data: string[];
        ref: string[];
        section: string[];
        redaction: string[];
        exclude: string[];
        approval?: string;
        approvedBy?: string;
        approvedAt?: string;
        disclosure?: string;
        disclosureStatus?: string;
        preview?: boolean;
        json?: boolean;
      }
    ) => {
      const input = {
        rootPath: options.workspace,
        title: options.title,
        purpose: purposeTokens.join(" "),
        service: options.service,
        target: parseModelContextTarget(options.target),
        model: options.model,
        endpoint: options.endpoint,
        dataClasses: options.data,
        selectedContextRefs: options.ref,
        sections: options.section.map(parseModelContextSection),
        redactions: options.redaction,
        exclusions: options.exclude,
        approvalRef: options.approval,
        approvedBy: options.approvedBy,
        approvedAt: options.approvedAt,
        disclosureRef: options.disclosure,
        disclosureStatus: options.disclosureStatus ? parseModelContextDisclosureStatus(options.disclosureStatus) : undefined
      };
      const result = options.preview ? await createModelContext(input) : await writeModelContext(input);

      if (options.json) {
        printJson(result);
        return;
      }

      if (options.preview) {
        printModelContext(result as ModelContextPacket);
        return;
      }

      printModelContextWrite(result as ModelContextWriteResult);
    }
  );

modelContext
  .command("list")
  .description("List private local model-context packets.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full model-context packet list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const packets = await listModelContexts(path);

    if (options.json) {
      printJson({ total: packets.length, packets });
      return;
    }

    printModelContextList(packets);
  });

const disclosure = program
  .command("disclosure")
  .description("Record explicit external model/service disclosures in the private local workspace.");

disclosure
  .command("log")
  .description("Write a local audit record for selected context sent to an external model or service.")
  .argument("<purpose...>", "Purpose of the external call")
  .requiredOption("--service <service>", "External service or provider, such as OpenAI, Anthropic, WolframAlpha, or a lab API")
  .option("--workspace <path>", "Project root path", ".")
  .option("--model <model>", "Specific hosted or local model name")
  .option("--endpoint <endpoint>", "Optional endpoint or service surface")
  .option("--data <class>", "Data class disclosed; repeatable", collectRepeated, [])
  .requiredOption("--context <summary>", "Summary of the exact selected context disclosed")
  .option("--ref <ref>", "Selected local context ref; repeatable", collectRepeated, [])
  .option("--approval <ref>", "Human approval ref, prompt id, issue, or ticket")
  .option("--status <status>", "planned, sent, received, or cancelled", "planned")
  .option("--response <summary>", "Optional response summary")
  .option("--output <ref>", "Local output ref created from the external call; repeatable", collectRepeated, [])
  .option("--no-user-initiated", "Mark the disclosure as not yet explicitly user initiated")
  .option("--json", "Print the full disclosure log JSON")
  .action(
    async (
      purposeTokens: string[],
      options: {
        service: string;
        workspace: string;
        model?: string;
        endpoint?: string;
        data: string[];
        context: string;
        ref: string[];
        approval?: string;
        status: string;
        response?: string;
        output: string[];
        userInitiated?: boolean;
        json?: boolean;
      }
    ) => {
      const result = await createExternalDisclosureLogEntry({
        rootPath: options.workspace,
        service: options.service,
        model: options.model,
        endpoint: options.endpoint,
        purpose: purposeTokens.join(" "),
        dataClasses: options.data,
        contextSummary: options.context,
        selectedContextRefs: options.ref,
        approvalRef: options.approval,
        status: parseExternalDisclosureStatus(options.status),
        responseSummary: options.response,
        outputRefs: options.output,
        userInitiated: options.userInitiated !== false
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printExternalDisclosureWrite(result);
    }
  );

disclosure
  .command("list")
  .description("List external model/service disclosure audit records from the local workspace.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full disclosure log list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const entries = await listExternalDisclosureLogEntries(path);

    if (options.json) {
      printJson({ total: entries.length, entries });
      return;
    }

    printExternalDisclosureList(entries);
  });

const workspace = program
  .command("workspace")
  .description("Manage a local-first private Truth Harness project store.");

const catalog = program
  .command("catalog")
  .description("Manage the rebuildable local SQLite query index for workspace artifacts.");

catalog
  .command("rebuild")
  .description("Rebuild .truth-harness/indexes/catalog.db from canonical local JSON artifacts.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full catalog rebuild JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const result = await rebuildWorkspaceCatalog({ rootPath: path });

    if (options.json) {
      printJson(result);
      if (!result.validation.passed) {
        process.exitCode = 1;
      }
      return;
    }

    printWorkspaceCatalogRebuild(result);
    if (!result.validation.passed) {
      process.exitCode = 1;
    }
  });

catalog
  .command("status")
  .description("Show whether the local workspace catalog exists, is readable, and matches the current schema.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full catalog status JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const status = await getWorkspaceCatalogStatus(path, { checkFiles: true });

    if (options.json) {
      printJson(status);
      if (!status.readable) {
        process.exitCode = 1;
      }
      return;
    }

    printWorkspaceCatalogStatus(status);
    if (!status.readable) {
      process.exitCode = 1;
    }
  });

catalog
  .command("search")
  .description("Search the local workspace catalog by text and artifact filters.")
  .argument("[query]", "Search query; omit to list recent indexed artifacts")
  .option("--workspace <path>", "Project root path", ".")
  .option("--kind <kind>", "Filter by workspace artifact kind, such as claims, routes, receipts, visuals")
  .option("--trust <trust>", "Filter by trust label", parseTrustLabel)
  .option("--domain <domain>", "Filter by domain")
  .option("--tag <tag>", "Filter by tag, with or without #")
  .option("--limit <count>", "Maximum results to return", parsePositiveInteger, 25)
  .option("--json", "Print the full catalog search JSON")
  .action(
    async (
      query: string | undefined,
      options: {
        workspace: string;
        kind?: string;
        trust?: TrustLabel;
        domain?: string;
        tag?: string;
        limit: number;
        json?: boolean;
      }
    ) => {
      const result = await searchWorkspaceCatalog({
        rootPath: options.workspace,
        query,
        kind: options.kind,
        trust: options.trust,
        domain: options.domain,
        tag: options.tag,
        limit: options.limit
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printWorkspaceCatalogSearch(result);
    }
  );

workspace
  .command("init")
  .description("Initialize .truth-harness local project storage.")
  .argument("[path]", "Project root path", ".")
  .option("--name <name>", "Human display name for the local workspace")
  .option("--json", "Print the full workspace init JSON")
  .action(async (path: string, options: { name?: string; json?: boolean }) => {
    const result = await initLocalWorkspace(path, { displayName: options.name });

    if (options.json) {
      printJson(result);
      return;
    }

    printWorkspaceInit(result);
  });

workspace
  .command("status")
  .description("Show local workspace status without creating files.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace status JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const status = await getLocalWorkspaceStatus(path);

    if (options.json) {
      printJson(status);
      if (workspaceStatusHasProblems(status)) {
        process.exitCode = 1;
      }
      return;
    }

    printWorkspaceStatus(status);
    if (workspaceStatusHasProblems(status)) {
      process.exitCode = 1;
    }
  });

workspace
  .command("repair")
  .description("Repair missing private directories and persist newly added manifest defaults.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace repair JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const result = await repairLocalWorkspace(path);

    if (options.json) {
      printJson(result);
      if (result.missingDirectoriesAfter.length > 0) {
        process.exitCode = 1;
      }
      return;
    }

    printWorkspaceRepair(result);
    if (result.missingDirectoriesAfter.length > 0) {
      process.exitCode = 1;
    }
  });

workspace
  .command("repair-artifacts")
  .description("Repair legacy local artifact metadata without changing trust labels.")
  .argument("[path]", "Project root path", ".")
  .option("--dry-run", "Preview artifact repair actions without writing files")
  .option("--preview", "Preview artifact repair actions without writing files")
  .option("--json", "Print the full artifact repair JSON")
  .action(async (path: string, options: { dryRun?: boolean; preview?: boolean; json?: boolean }) => {
    const result = await repairWorkspaceArtifacts({
      rootPath: path,
      dryRun: options.dryRun || options.preview
    });

    if (options.json) {
      printJson(result);
      return;
    }

    printWorkspaceArtifactRepair(result);
  });

workspace
  .command("archive")
  .description("Copy selected .truth-harness data directories into a local archive before cleanup.")
  .argument("[path]", "Project root path", ".")
  .option(
    "--target <target>",
    "Archive target: scratch, generated, evidence, all, or a workspace directory name. Repeat for multiple targets.",
    collectWorkspaceCleanTarget,
    [] as WorkspaceCleanTarget[]
  )
  .option("--reason <reason>", "Human-readable reason recorded in the archive manifest")
  .option("--json", "Print the full workspace archive JSON")
  .action(
    async (
      path: string,
      options: {
        target: WorkspaceCleanTarget[];
        reason?: string;
        json?: boolean;
      }
    ) => {
      const result = await archiveLocalWorkspace({
        rootPath: path,
        targets: options.target,
        reason: options.reason
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printWorkspaceArchive(result);
    }
  );

workspace
  .command("archives")
  .description("List local .truth-harness archives.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace archive list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const result = await listLocalWorkspaceArchives({ rootPath: path });

    if (options.json) {
      printJson(result);
      return;
    }

    printWorkspaceArchiveList(result);
  });

workspace
  .command("restore-archive")
  .description("Preview or restore files from a local .truth-harness archive.")
  .argument("<archive>", "Archive id or workspace-local archive-manifest.json path")
  .argument("[path]", "Project root path", ".")
  .option(
    "--target <target>",
    "Restore target: scratch, generated, evidence, all, or a workspace directory name. Repeat for multiple targets.",
    collectWorkspaceCleanTarget,
    [] as WorkspaceCleanTarget[]
  )
  .option("--confirm-restore", "Actually copy archive files back into live workspace directories")
  .option("--overwrite", "Allow restore to replace changed live files after previewing conflicts")
  .option("--json", "Print the full workspace archive restore JSON")
  .action(
    async (
      archive: string,
      path: string,
      options: {
        target: WorkspaceCleanTarget[];
        confirmRestore?: boolean;
        overwrite?: boolean;
        json?: boolean;
      }
    ) => {
      const result = await restoreLocalWorkspaceArchive({
        rootPath: path,
        archiveRef: archive,
        targets: options.target,
        dryRun: !options.confirmRestore,
        overwrite: options.overwrite
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printWorkspaceArchiveRestore(result);
    }
  );

workspace
  .command("clean")
  .description("Preview or clear selected .truth-harness data directories.")
  .argument("[path]", "Project root path", ".")
  .option(
    "--target <target>",
    "Clean target: scratch, generated, evidence, all, or a workspace directory name. Repeat for multiple targets.",
    collectWorkspaceCleanTarget,
    [] as WorkspaceCleanTarget[]
  )
  .option("--confirm-delete", "Actually delete files. Without this flag the command is a dry run.")
  .option("--json", "Print the full workspace cleanup JSON")
  .action(
    async (
      path: string,
      options: {
        target: WorkspaceCleanTarget[];
        confirmDelete?: boolean;
        json?: boolean;
      }
    ) => {
      const result = await cleanLocalWorkspace({
        rootPath: path,
        targets: options.target,
        dryRun: !options.confirmDelete
      });

      if (options.json) {
        printJson(result);
        return;
      }

      printWorkspaceClean(result);
    }
  );

workspace
  .command("validate")
  .description("Validate local workspace evidence artifacts before agents rely on them.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace validation JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const validation = await validateWorkspaceArtifacts({ rootPath: path });

    if (options.json) {
      printJson(validation);
      if (!validation.passed) {
        process.exitCode = 1;
      }
      return;
    }

    printWorkspaceValidation(validation);
    if (!validation.passed) {
      process.exitCode = 1;
    }
  });

workspace
  .command("reports")
  .description("List saved local report drafts from .truth-harness/findings.")
  .argument("[path]", "Project root path", ".")
  .option("--limit <count>", "Maximum saved report drafts to list", parsePositiveInteger, 8)
  .option("--json", "Print the full report draft list JSON")
  .action(async (path: string, options: { limit: number; json?: boolean }) => {
    const reports = await listReportDrafts({ rootPath: path, limit: options.limit });

    if (options.json) {
      printJson({
        schemaVersion: "truth-harness.report-draft-list.v0",
        localOnly: true,
        externalCalls: [],
        count: reports.length,
        reports
      });
      return;
    }

    printReportDraftList(reports);
  });

workspace
  .command("report")
  .description("Read a saved local report draft by report id.")
  .argument("<reportId>", "Saved report draft id such as report_...")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full report draft JSON and Markdown payload")
  .option("--markdown", "Print only the saved Markdown body")
  .action(async (reportId: string, path: string, options: { json?: boolean; markdown?: boolean }) => {
    const report = await readReportDraft({ rootPath: path, reportId });

    if (options.json) {
      printJson({
        schemaVersion: "truth-harness.report-draft-read.v0",
        localOnly: true,
        externalCalls: [],
        ...report
      });
      return;
    }

    if (options.markdown) {
      console.log(report.markdown.trimEnd());
      return;
    }

    printReportDraft(report);
  });

workspace
  .command("release-audit")
  .description("Run the local release/professor-readiness audit without starting Docker or arbitrary code execution.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full release audit JSON")
  .option("--mode <mode>", "prototype or public-review", "public-review")
  .option("--max-routes <count>", "Maximum route summaries to inspect; use 0 to skip routes", parseNonNegativeInteger)
  .option("--max-claims <count>", "Maximum claim records to inspect; use 0 to skip claims", parseNonNegativeInteger)
  .option("--max-sessions <count>", "Maximum research sessions to inspect; use 0 to skip sessions", parseNonNegativeInteger)
  .option("--max-reports <count>", "Maximum saved report drafts to inspect; use 0 to skip reports", parseNonNegativeInteger)
  .option("--timeout-ms <ms>", "Concrete engine check timeout in milliseconds", parsePositiveInteger, 3000)
  .option("--maxima-command <command>", "Override Maxima executable for the symbolic cross-check")
  .option("--sage-command <command>", "Override SageMath executable for the optional CAS readiness probe")
  .option("--lean-command <command>", "Override Lean executable for the proof fixture")
  .option("--z3-command <command>", "Override Z3 executable for the SMT check")
  .option("--cvc5-command <command>", "Override cvc5 executable for the optional second SMT check")
  .option("--smt-source <path>", "Workspace-local SMT-LIB source for SMT checks", "docs/examples/constraints.smt2")
  .option("--lean-source <path>", "Workspace-local Lean source for the Lean fixture", "docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean")
  .option("--require-maxima", "Mark Maxima as required for release readiness")
  .option("--require-z3", "Mark Z3 as required for release readiness")
  .option("--require-cvc5", "Mark cvc5 as required for release readiness")
  .option("--require-lean", "Mark Lean as required for release readiness")
  .option("--require-sage", "Require SageMath to earn a constrained CAS cross-check")
  .option("--require-docker-core", "Require the Docker-core Maxima and Z3 gates")
  .option("--require-all-concrete", "Require Maxima, Z3, and Lean concrete evidence gates")
  .option("--require-all-engines", "Require Maxima, Z3, cvc5, Lean, and SageMath evidence gates")
  .option("--require-sandbox", "Block release readiness unless a measured code-run sandbox is available")
  .option("--require-saved-strict-engine-run", "Require a saved all-engine reviewer run to have passed")
  .option("--fail-on-blocked", "Exit non-zero if the release audit is blocked")
  .action(
    async (
      path: string,
      options: {
        json?: boolean;
        mode: string;
        maxRoutes?: number;
        maxClaims?: number;
        maxSessions?: number;
        maxReports?: number;
        timeoutMs: number;
        maximaCommand?: string;
        sageCommand?: string;
        leanCommand?: string;
        z3Command?: string;
        cvc5Command?: string;
        smtSource: string;
        leanSource: string;
        requireMaxima?: boolean;
        requireZ3?: boolean;
        requireCvc5?: boolean;
        requireLean?: boolean;
        requireSage?: boolean;
        requireDockerCore?: boolean;
        requireAllConcrete?: boolean;
        requireAllEngines?: boolean;
        requireSandbox?: boolean;
        requireSavedStrictEngineRun?: boolean;
        failOnBlocked?: boolean;
      }
    ) => {
      const audit = await createReleaseAudit({
        rootPath: path,
        mode: parseReleaseAuditMode(options.mode),
        maxRoutes: options.maxRoutes,
        maxClaims: options.maxClaims,
        maxSessions: options.maxSessions,
        maxReports: options.maxReports,
        timeoutMs: options.timeoutMs,
        maximaCommand: options.maximaCommand,
        sageCommand: options.sageCommand,
        leanCommand: options.leanCommand,
        z3Command: options.z3Command,
        cvc5Command: options.cvc5Command,
        smtSourcePath: options.smtSource,
        leanSourcePath: options.leanSource,
        engineRequirements: engineRequirementsFromOptions(options),
        requireSandbox: options.requireSandbox,
        requireSavedStrictEngineRun: options.requireSavedStrictEngineRun
      });

      if (options.json) {
        printJson(audit);
      } else {
        printReleaseAudit(audit);
      }

      if (options.failOnBlocked && audit.status === "blocked") {
        process.exitCode = 1;
      }
    }
  );

workspace
  .command("stress")
  .description("Generate a synthetic local workspace and measure validation, review, and graph health.")
  .argument("<path>", "Project root path to create or reuse for synthetic stress artifacts")
  .option("--receipts <count>", "Number of synthetic receipts to write", parseNonNegativeInteger, 100)
  .option("--claims <count>", "Number of linked synthetic claims to write", parseNonNegativeInteger, 50)
  .option("--routes <count>", "Number of synthetic verifier routes to write", parseNonNegativeInteger, 20)
  .option("--json", "Print the full workspace stress JSON")
  .option("--fail-on-validation", "Exit non-zero if generated workspace validation fails")
  .action(
    async (
      path: string,
      options: {
        receipts: number;
        claims: number;
        routes: number;
        json?: boolean;
        failOnValidation?: boolean;
      }
    ) => {
      const result = await runWorkspaceStress({
        rootPath: path,
        receipts: options.receipts,
        claims: options.claims,
        routes: options.routes
      });

      if (options.json) {
        printJson(result);
        if (options.failOnValidation && !result.validation.passed) {
          process.exitCode = 1;
        }
        return;
      }

      printWorkspaceStress(result);
      if (options.failOnValidation && !result.validation.passed) {
        process.exitCode = 1;
      }
    }
  );

workspace
  .command("review")
  .description("Show the ordered local work queue across saved routes and claims.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace review JSON")
  .option("--write", "Write JSON and Markdown into .truth-harness/findings")
  .option("--max-routes <count>", "Maximum route summaries to inspect; use 0 to skip routes", parseNonNegativeInteger)
  .option("--max-claims <count>", "Maximum claim records to inspect; use 0 to skip claims", parseNonNegativeInteger)
  .option("--max-sessions <count>", "Maximum research sessions to inspect; use 0 to skip sessions", parseNonNegativeInteger)
  .option("--max-reports <count>", "Maximum saved report drafts to inspect; use 0 to skip reports", parseNonNegativeInteger)
  .option("--fail-on-critical", "Exit non-zero when critical review items exist")
  .action(
    async (
      path: string,
      options: {
        json?: boolean;
        write?: boolean;
        maxRoutes?: number;
        maxClaims?: number;
        maxSessions?: number;
        maxReports?: number;
        failOnCritical?: boolean;
      }
    ) => {
      const reviewInput = {
        rootPath: path,
        maxRoutes: options.maxRoutes,
        maxClaims: options.maxClaims,
        maxSessions: options.maxSessions,
        maxReports: options.maxReports
      };
      const writeResult = options.write ? await writeWorkspaceReview(reviewInput) : undefined;
      const review = writeResult?.review ?? (await createWorkspaceReview(reviewInput));

      if (options.json) {
        printJson(writeResult ? { review, written: true, result: writeResult } : review);
        if (options.failOnCritical && review.summary.criticalItems > 0) {
          process.exitCode = 1;
        }
        return;
      }

      printWorkspaceReview(review, writeResult);
      if (options.failOnCritical && review.summary.criticalItems > 0) {
        process.exitCode = 1;
      }
    }
  );

workspace
  .command("credibility-pack")
  .description("Write a professor/reviewer packet with validation, engine gates, artifact hashes, and open obligations.")
  .argument("[path]", "Project root path", ".")
  .option("--dry-run", "Create the pack in memory without writing JSON/Markdown")
  .option("--json", "Print the full credibility pack JSON")
  .option("--max-routes <count>", "Maximum route summaries to inspect; use 0 to skip routes", parseNonNegativeInteger)
  .option("--max-claims <count>", "Maximum claim records to inspect; use 0 to skip claims", parseNonNegativeInteger)
  .option("--max-sessions <count>", "Maximum research sessions to inspect; use 0 to skip sessions", parseNonNegativeInteger)
  .option("--max-reports <count>", "Maximum saved report drafts to inspect; use 0 to skip reports", parseNonNegativeInteger)
  .option("--timeout-ms <ms>", "Concrete engine check timeout in milliseconds", parsePositiveInteger, 3000)
  .option("--maxima-command <command>", "Override Maxima executable for the symbolic cross-check")
  .option("--sage-command <command>", "Override SageMath executable for the optional CAS readiness probe")
  .option("--lean-command <command>", "Override Lean executable for the proof fixture")
  .option("--z3-command <command>", "Override Z3 executable for the SMT check")
  .option("--cvc5-command <command>", "Override cvc5 executable for the optional second SMT check")
  .option("--smt-source <path>", "Workspace-local SMT-LIB source for SMT checks", "docs/examples/constraints.smt2")
  .option("--lean-source <path>", "Workspace-local Lean source for the Lean fixture", "docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean")
  .option("--require-maxima", "Mark Maxima as required for professor readiness")
  .option("--require-z3", "Mark Z3 as required for professor readiness")
  .option("--require-cvc5", "Mark cvc5 as required for professor readiness")
  .option("--require-lean", "Mark Lean as required for professor readiness")
  .option("--require-sage", "Require SageMath to earn a constrained CAS cross-check")
  .option("--require-docker-core", "Require the Docker-core Maxima and Z3 gates")
  .option("--require-all-concrete", "Require Maxima, Z3, and Lean concrete evidence gates")
  .option("--require-all-engines", "Require Maxima, Z3, cvc5, Lean, and SageMath evidence gates")
  .option("--fail-on-blocked", "Exit non-zero if the pack is blocked")
  .action(
    async (
      path: string,
      options: {
        dryRun?: boolean;
        json?: boolean;
        maxRoutes?: number;
        maxClaims?: number;
        maxSessions?: number;
        maxReports?: number;
        timeoutMs: number;
        maximaCommand?: string;
        sageCommand?: string;
        leanCommand?: string;
        z3Command?: string;
        cvc5Command?: string;
        smtSource: string;
        leanSource: string;
        requireMaxima?: boolean;
        requireZ3?: boolean;
        requireCvc5?: boolean;
        requireLean?: boolean;
        requireSage?: boolean;
        requireDockerCore?: boolean;
        requireAllConcrete?: boolean;
        requireAllEngines?: boolean;
        failOnBlocked?: boolean;
      }
    ) => {
      const engineRequirements = engineRequirementsFromOptions(options);
      const input = {
        rootPath: path,
        maxRoutes: options.maxRoutes,
        maxClaims: options.maxClaims,
        maxSessions: options.maxSessions,
        maxReports: options.maxReports,
        timeoutMs: options.timeoutMs,
        maximaCommand: options.maximaCommand,
        sageCommand: options.sageCommand,
        leanCommand: options.leanCommand,
        z3Command: options.z3Command,
        cvc5Command: options.cvc5Command,
        smtSourcePath: options.smtSource,
        leanSourcePath: options.leanSource,
        engineRequirements
      };
      const writeResult = options.dryRun ? undefined : await writeCredibilityPack(input);
      const pack = writeResult?.pack ?? await createCredibilityPack(input);

      if (options.json) {
        printJson(writeResult ? { pack, written: true, result: writeResult } : pack);
      } else {
        printCredibilityPack(pack, writeResult);
      }

      if (options.failOnBlocked && pack.status === "blocked") {
        process.exitCode = 1;
      }
    }
  );

workspace
  .command("credibility-actions")
  .description("List the next reviewer actions from a credibility pack without executing commands.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print machine-readable reviewer actions")
  .option("--max-routes <count>", "Maximum route summaries to inspect; use 0 to skip routes", parseNonNegativeInteger)
  .option("--max-claims <count>", "Maximum claim records to inspect; use 0 to skip claims", parseNonNegativeInteger)
  .option("--max-sessions <count>", "Maximum research sessions to inspect; use 0 to skip sessions", parseNonNegativeInteger)
  .option("--max-reports <count>", "Maximum saved report drafts to inspect; use 0 to skip reports", parseNonNegativeInteger)
  .option("--timeout-ms <ms>", "Concrete engine check timeout in milliseconds", parsePositiveInteger, 3000)
  .option("--maxima-command <command>", "Override Maxima executable for the symbolic cross-check")
  .option("--sage-command <command>", "Override SageMath executable for the optional CAS readiness probe")
  .option("--lean-command <command>", "Override Lean executable for the proof fixture")
  .option("--z3-command <command>", "Override Z3 executable for the SMT check")
  .option("--cvc5-command <command>", "Override cvc5 executable for the optional second SMT check")
  .option("--smt-source <path>", "Workspace-local SMT-LIB source for SMT checks", "docs/examples/constraints.smt2")
  .option("--lean-source <path>", "Workspace-local Lean source for the Lean fixture", "docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean")
  .option("--require-maxima", "Mark Maxima as required for professor readiness")
  .option("--require-z3", "Mark Z3 as required for professor readiness")
  .option("--require-cvc5", "Mark cvc5 as required for professor readiness")
  .option("--require-lean", "Mark Lean as required for professor readiness")
  .option("--require-sage", "Require SageMath to earn a constrained CAS cross-check")
  .option("--require-docker-core", "Require the Docker-core Maxima and Z3 gates")
  .option("--require-all-concrete", "Require Maxima, Z3, and Lean concrete evidence gates")
  .option("--require-all-engines", "Require Maxima, Z3, cvc5, Lean, and SageMath evidence gates")
  .option("--priority <priority>", "Only show one priority: critical, high, medium, or low")
  .option("--category <category>", "Only show one category: validation, engine, or workspace-review")
  .option("--fail-on-actions", "Exit non-zero when reviewer actions are open")
  .action(
    async (
      path: string,
      options: {
        json?: boolean;
        maxRoutes?: number;
        maxClaims?: number;
        maxSessions?: number;
        maxReports?: number;
        timeoutMs: number;
        maximaCommand?: string;
        sageCommand?: string;
        leanCommand?: string;
        z3Command?: string;
        cvc5Command?: string;
        smtSource: string;
        leanSource: string;
        requireMaxima?: boolean;
        requireZ3?: boolean;
        requireCvc5?: boolean;
        requireLean?: boolean;
        requireSage?: boolean;
        requireDockerCore?: boolean;
        requireAllConcrete?: boolean;
        requireAllEngines?: boolean;
        priority?: string;
        category?: string;
        failOnActions?: boolean;
      }
    ) => {
      const engineRequirements = engineRequirementsFromOptions(options);
      const pack = await createCredibilityPack({
        rootPath: path,
        maxRoutes: options.maxRoutes,
        maxClaims: options.maxClaims,
        maxSessions: options.maxSessions,
        maxReports: options.maxReports,
        timeoutMs: options.timeoutMs,
        maximaCommand: options.maximaCommand,
        sageCommand: options.sageCommand,
        leanCommand: options.leanCommand,
        z3Command: options.z3Command,
        cvc5Command: options.cvc5Command,
        smtSourcePath: options.smtSource,
        leanSourcePath: options.leanSource,
        engineRequirements
      });
      const actions = filterCredibilityActions(pack.reviewerActionPlan.actions, {
        priority: options.priority,
        category: options.category
      });

      if (options.json) {
        printJson({
          schemaVersion: "truth-harness.credibility-actions.v0",
          packId: pack.packId,
          status: pack.status,
          professorReady: pack.summary.professorReady,
          totalActions: actions.length,
          criticalActions: actions.filter((action) => action.priority === "critical").length,
          highActions: actions.filter((action) => action.priority === "high").length,
          actions
        });
      } else {
        printCredibilityActions(pack, actions);
      }

      if (options.failOnActions && actions.length > 0) {
        process.exitCode = 1;
      }
    }
  );

workspace
  .command("credibility-bundle")
  .description("Write a portable reviewer bundle directory with copied artifacts, hashes, and a verification manifest.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full bundle manifest JSON")
  .option("--max-routes <count>", "Maximum route summaries to inspect; use 0 to skip routes", parseNonNegativeInteger)
  .option("--max-claims <count>", "Maximum claim records to inspect; use 0 to skip claims", parseNonNegativeInteger)
  .option("--max-sessions <count>", "Maximum research sessions to inspect; use 0 to skip sessions", parseNonNegativeInteger)
  .option("--max-reports <count>", "Maximum saved report drafts to inspect; use 0 to skip reports", parseNonNegativeInteger)
  .option("--timeout-ms <ms>", "Concrete engine check timeout in milliseconds", parsePositiveInteger, 3000)
  .option("--maxima-command <command>", "Override Maxima executable for the symbolic cross-check")
  .option("--sage-command <command>", "Override SageMath executable for the optional CAS readiness probe")
  .option("--lean-command <command>", "Override Lean executable for the proof fixture")
  .option("--z3-command <command>", "Override Z3 executable for the SMT check")
  .option("--cvc5-command <command>", "Override cvc5 executable for the optional second SMT check")
  .option("--smt-source <path>", "Workspace-local SMT-LIB source for SMT checks", "docs/examples/constraints.smt2")
  .option("--lean-source <path>", "Workspace-local Lean source for the Lean fixture", "docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean")
  .option("--require-maxima", "Mark Maxima as required for professor readiness")
  .option("--require-z3", "Mark Z3 as required for professor readiness")
  .option("--require-cvc5", "Mark cvc5 as required for professor readiness")
  .option("--require-lean", "Mark Lean as required for professor readiness")
  .option("--require-sage", "Require SageMath to earn a constrained CAS cross-check")
  .option("--require-docker-core", "Require the Docker-core Maxima and Z3 gates")
  .option("--require-all-concrete", "Require Maxima, Z3, and Lean concrete evidence gates")
  .option("--require-all-engines", "Require Maxima, Z3, cvc5, Lean, and SageMath evidence gates")
  .option("--fail-on-blocked", "Exit non-zero if the underlying credibility pack is blocked")
  .action(
    async (
      path: string,
      options: {
        json?: boolean;
        maxRoutes?: number;
        maxClaims?: number;
        maxSessions?: number;
        maxReports?: number;
        timeoutMs: number;
        maximaCommand?: string;
        sageCommand?: string;
        leanCommand?: string;
        z3Command?: string;
        cvc5Command?: string;
        smtSource: string;
        leanSource: string;
        requireMaxima?: boolean;
        requireZ3?: boolean;
        requireCvc5?: boolean;
        requireLean?: boolean;
        requireSage?: boolean;
        requireDockerCore?: boolean;
        requireAllConcrete?: boolean;
        requireAllEngines?: boolean;
        failOnBlocked?: boolean;
      }
    ) => {
      const engineRequirements = engineRequirementsFromOptions(options);
      const result = await writeCredibilityBundle({
        rootPath: path,
        maxRoutes: options.maxRoutes,
        maxClaims: options.maxClaims,
        maxSessions: options.maxSessions,
        maxReports: options.maxReports,
        timeoutMs: options.timeoutMs,
        maximaCommand: options.maximaCommand,
        sageCommand: options.sageCommand,
        leanCommand: options.leanCommand,
        z3Command: options.z3Command,
        cvc5Command: options.cvc5Command,
        smtSourcePath: options.smtSource,
        leanSourcePath: options.leanSource,
        engineRequirements
      });

      if (options.json) {
        printJson({ manifest: result.manifest, written: true, result });
      } else {
        printCredibilityBundle(result);
      }

      if (options.failOnBlocked && result.manifest.packStatus === "blocked") {
        process.exitCode = 1;
      }
    }
  );

workspace
  .command("verify-credibility-bundle")
  .description("Verify a portable reviewer bundle manifest, copied artifact hashes, and source workspace drift.")
  .argument("[workspaceOrBundle]", "Bundle ref, or project root path when a second bundle argument is provided")
  .argument("[bundle]", "Bundle id, bundle directory, or workspace-local bundle path")
  .option("--workspace <path>", "Project root path when only a bundle ref is passed", ".")
  .option("--json", "Print the full verification JSON")
  .option("--write", "Write the verification JSON/Markdown into .truth-harness/findings")
  .option("--fail-on-bundle-change", "Exit non-zero if bundle files are missing or changed")
  .option("--fail-on-source-drift", "Exit non-zero if the current workspace no longer matches bundled source hashes")
  .action(
    async (
      workspaceOrBundle: string | undefined,
      bundle: string | undefined,
      options: {
        workspace: string;
        json?: boolean;
        write?: boolean;
        failOnBundleChange?: boolean;
        failOnSourceDrift?: boolean;
      }
    ) => {
      if (!workspaceOrBundle) {
        throw new Error("Credibility bundle ref is required.");
      }
      const workspacePath = bundle ? workspaceOrBundle : options.workspace;
      const bundleRef = bundle ?? workspaceOrBundle;
      const written = options.write
        ? await writeCredibilityBundleVerification({
            rootPath: workspacePath,
            bundleRef
          })
        : undefined;
      const verification = written?.verification ?? await verifyCredibilityBundle({
        rootPath: workspacePath,
        bundleRef
      });

      if (options.json) {
        printJson(written ? { verification, paths: { json: written.jsonPath, markdown: written.markdownPath } } : verification);
      } else {
        printCredibilityBundleVerification(verification);
        if (written) {
          console.log(`Saved verification JSON: ${written.jsonPath}`);
          console.log(`Saved verification Markdown: ${written.markdownPath}`);
        }
      }

      if (options.failOnBundleChange && !verification.passed) {
        process.exitCode = 1;
      }
      if (options.failOnSourceDrift && !verification.sourceMatchesWorkspace) {
        process.exitCode = 1;
      }
    }
  );

workspace
  .command("run-next")
  .description("Plan or execute the next local action allowed by the workspace autonomy contract.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full run-next plan JSON")
  .option("--execute-local", "Execute one supported local Truth Harness action; dry-run is the default")
  .option("--write", "Write the run-next plan JSON/Markdown into .truth-harness/findings")
  .option("--source <source>", "Source queue: workspace-review or credibility-actions", "workspace-review")
  .option("--max-routes <count>", "Maximum route summaries to inspect; use 0 to skip routes", parseNonNegativeInteger)
  .option("--max-claims <count>", "Maximum claim records to inspect; use 0 to skip claims", parseNonNegativeInteger)
  .option("--max-sessions <count>", "Maximum research sessions to inspect; use 0 to skip sessions", parseNonNegativeInteger)
  .option("--max-reports <count>", "Maximum saved report drafts to inspect when source is workspace-review; use 0 to skip reports", parseNonNegativeInteger)
  .option("--timeout-ms <ms>", "Concrete engine check timeout in milliseconds for credibility-actions", parsePositiveInteger, 3000)
  .option("--maxima-command <command>", "Override Maxima executable for credibility-actions")
  .option("--sage-command <command>", "Override SageMath executable for credibility-actions")
  .option("--lean-command <command>", "Override Lean executable for credibility-actions")
  .option("--z3-command <command>", "Override Z3 executable for credibility-actions")
  .option("--cvc5-command <command>", "Override cvc5 executable for credibility-actions")
  .option("--smt-source <path>", "Workspace-local SMT-LIB source for credibility-actions", "docs/examples/constraints.smt2")
  .option("--lean-source <path>", "Workspace-local Lean source for credibility-actions", "docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean")
  .option("--require-maxima", "Require Maxima for credibility-actions")
  .option("--require-z3", "Require Z3 for credibility-actions")
  .option("--require-cvc5", "Require cvc5 for credibility-actions")
  .option("--require-lean", "Require Lean for credibility-actions")
  .option("--require-sage", "Require SageMath for credibility-actions")
  .option("--require-docker-core", "Require Docker-core Maxima and Z3 evidence gates for credibility-actions")
  .option("--require-all-concrete", "Require Maxima, Z3, and Lean concrete evidence gates for credibility-actions")
  .option("--require-all-engines", "Require Maxima, Z3, cvc5, Lean, and SageMath evidence gates for credibility-actions")
  .option("--fail-on-blocked", "Exit non-zero if no supported local action can run")
  .action(
    async (
      path: string,
      options: {
        json?: boolean;
        executeLocal?: boolean;
        write?: boolean;
        source: string;
        maxRoutes?: number;
        maxClaims?: number;
        maxSessions?: number;
        maxReports?: number;
        timeoutMs: number;
        maximaCommand?: string;
        sageCommand?: string;
        leanCommand?: string;
        z3Command?: string;
        cvc5Command?: string;
        smtSource: string;
        leanSource: string;
        requireMaxima?: boolean;
        requireZ3?: boolean;
        requireCvc5?: boolean;
        requireLean?: boolean;
        requireSage?: boolean;
        requireDockerCore?: boolean;
        requireAllConcrete?: boolean;
        requireAllEngines?: boolean;
        failOnBlocked?: boolean;
      }
    ) => {
      const review = await createRunNextReviewFromOptions(path, options);
      const plan = await createWorkspaceRunNextPlan({
        rootPath: path,
        review,
        executeLocal: Boolean(options.executeLocal)
      });
      const writeResult = options.write
        ? await writeWorkspaceRunNextPlan({
            rootPath: path,
            plan
          })
        : undefined;

      if (options.json) {
        printJson(writeResult ? { plan, written: true, result: writeResult } : plan);
      } else {
        printWorkspaceRunNextPlan(plan);
        if (writeResult) {
          console.log("");
          console.log("Written:");
          console.log(`  JSON: ${writeResult.jsonPath}`);
          console.log(`  Markdown: ${writeResult.markdownPath}`);
        }
      }

      if (options.failOnBlocked && plan.status === "blocked") {
        process.exitCode = 1;
      }
    }
  );

workspace
  .command("run-nexts")
  .description("List persisted workspace run-next intent packets.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace run-next list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const plans = await listWorkspaceRunNextPlans(path);

    if (options.json) {
      printJson({ total: plans.length, plans });
      return;
    }

    printWorkspaceRunNextList(plans);
  });

workspace
  .command("show-run-next")
  .description("Show a persisted workspace run-next plan by plan id or workspace-local JSON path.")
  .argument("<plan>", "Plan id such as wrn_<hash> or workspace-local JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--json", "Print the full workspace run-next plan JSON")
  .action(async (planRef: string, options: { workspace: string; json?: boolean }) => {
    const plan = await readWorkspaceRunNextPlan(options.workspace, planRef);

    if (options.json) {
      printJson(plan);
      return;
    }

    printWorkspaceRunNextPlan(plan);
  });

workspace
  .command("graph")
  .description("Show the local evidence graph across workspace artifacts and refs.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace graph JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const graph = await createWorkspaceGraph({ rootPath: path });

    if (options.json) {
      printJson(graph);
      return;
    }

    printWorkspaceGraph(graph);
  });

workspace
  .command("events")
  .description("List the local append-only artifact-write event log.")
  .argument("[path]", "Project root path", ".")
  .option("--limit <count>", "Maximum events to return", parsePositiveInteger, 50)
  .option("--json", "Print the full workspace event list JSON")
  .action(async (path: string, options: { limit: number; json?: boolean }) => {
    const events = await listWorkspaceEvents(path, options.limit);

    if (options.json) {
      printJson(events);
      return;
    }

    printWorkspaceEvents(events);
  });

workspace
  .command("reviews")
  .description("List persisted workspace review handoff packets.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace review list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const reviews = await listWorkspaceReviews(path);

    if (options.json) {
      printJson({ total: reviews.length, reviews });
      return;
    }

    printWorkspaceReviewList(reviews);
  });

workspace
  .command("show-review")
  .description("Show a persisted workspace review by review id or workspace-local JSON path.")
  .argument("<review>", "Review id such as wrev_<hash> or workspace-local JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--json", "Print the full workspace review JSON")
  .action(async (reviewRef: string, options: { workspace: string; json?: boolean }) => {
    const review = await readWorkspaceReview(options.workspace, reviewRef);

    if (options.json) {
      printJson(review);
      return;
    }

    printWorkspaceReview(review);
  });

workspace
  .command("snapshot")
  .description("Write a portable provenance snapshot of local workspace artifacts.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace snapshot JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const result = await writeWorkspaceSnapshot({ rootPath: path });

    if (options.json) {
      printJson(result);
      return;
    }

    printWorkspaceSnapshotWrite(result);
  });

workspace
  .command("snapshots")
  .description("List local workspace provenance snapshots.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full workspace snapshot list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const snapshots = await listWorkspaceSnapshots(path);

    if (options.json) {
      printJson({ total: snapshots.length, snapshots });
      return;
    }

    printWorkspaceSnapshotList(snapshots);
  });

workspace
  .command("verify-snapshot")
  .description("Verify a workspace snapshot and fail if local artifacts drifted.")
  .argument("<snapshot>", "Snapshot id or workspace-local snapshot JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--json", "Print the full workspace snapshot verification JSON")
  .action(async (snapshotRef: string, options: { workspace: string; json?: boolean }) => {
    const verification = await verifyWorkspaceSnapshot({
      rootPath: options.workspace,
      snapshotRef
    });

    if (options.json) {
      printJson(verification);
      if (!verification.passed) {
        process.exitCode = 1;
      }
      return;
    }

    printWorkspaceSnapshotVerification(verification);
    if (!verification.passed) {
      process.exitCode = 1;
    }
  });

const cas = program.command("cas").description("Inspect independent local CAS backends and trust boundaries.");

cas
  .command("backends")
  .description("Probe local CAS backends without checking or upgrading a claim.")
  .option("--json", "Print the full CAS backend status JSON")
  .option("--maxima-command <path>", "Maxima executable path or command. Defaults to TRUTH_HARNESS_MAXIMA or maxima.")
  .option("--sage-command <path>", "SageMath executable path or command. Defaults to TRUTH_HARNESS_SAGE or sage.")
  .option("--timeout-ms <ms>", "Backend probe timeout in milliseconds", parsePositiveInteger, 3000)
  .action((options: { json?: boolean; maximaCommand?: string; sageCommand?: string; timeoutMs: number }) => {
    const status = getCasBackendStatus({
      maximaCommand: options.maximaCommand,
      sageCommand: options.sageCommand,
      timeoutMs: options.timeoutMs
    });

    if (options.json) {
      printJson(status);
      return;
    }

    printCasBackendStatus(status);
  });

cas
  .command("check")
  .description("Run an independent local CAS symbolic equality check and produce a CAS check record.")
  .requiredOption("--operation <operation>", "simplify, factor, expand, differentiate, or integrate", parseSympyOperation)
  .requiredOption("--expression <expression>", "Original symbolic expression to check")
  .requiredOption("--result <expression>", "Expected symbolic result to compare against")
  .option("--variable <name>", "Symbolic variable for differentiation/integration", "x")
  .option("--backend <backend>", "CAS backend: maxima or sage", parseSymbolicCasBackend, "maxima")
  .option("--json", "Print the full CAS check JSON")
  .option("--out <path>", "Write the full CAS check JSON to a file")
  .option("--write", "Write JSON and Markdown into .truth-harness/cas")
  .option("--workspace <path>", "Project root path", ".")
  .option("--maxima-command <path>", "Maxima executable path or command. Defaults to TRUTH_HARNESS_MAXIMA or maxima.")
  .option("--sage-command <path>", "SageMath executable path or command. Defaults to TRUTH_HARNESS_SAGE or sage.")
  .option("--timeout-ms <ms>", "Backend probe and check timeout in milliseconds", parsePositiveInteger, 3000)
  .option("--fail-on-unverified", "Exit non-zero unless the independent CAS check passes")
  .action(
    async (options: {
      operation: SympyOperation;
      expression: string;
      result: string;
      variable: string;
      backend: SymbolicCasBackendId;
      json?: boolean;
      out?: string;
      write?: boolean;
      workspace: string;
      maximaCommand?: string;
      sageCommand?: string;
      timeoutMs: number;
      failOnUnverified?: boolean;
    }) => {
      const prompt = {
        operation: options.operation,
        expression: options.expression,
        variable: options.variable
      };
      const workspaceWrite = options.write
        ? await writeSymbolicCasCheckRecord({
            rootPath: options.workspace,
            prompt,
            result: options.result,
            backend: options.backend,
            maximaCommand: options.maximaCommand,
            sageCommand: options.sageCommand,
            timeoutMs: options.timeoutMs
          })
        : undefined;
      const record =
        workspaceWrite?.record ??
        createSymbolicCasCheckRecord({
          prompt,
          result: options.result,
          backend: options.backend,
          maximaCommand: options.maximaCommand,
          sageCommand: options.sageCommand,
          timeoutMs: options.timeoutMs
        });

      if (options.out) {
        await writeJson(options.out, record);
      }

      if (options.json) {
        printJson(workspaceWrite ? { record, written: true, result: workspaceWrite } : record);
        if (options.failOnUnverified && record.trust !== "cross-checked") {
          process.exitCode = 1;
        }
        return;
      }

      printSymbolicCasCheck(record, options.out, workspaceWrite);
      if (options.failOnUnverified && record.trust !== "cross-checked") {
        process.exitCode = 1;
      }
    }
  );

cas
  .command("list")
  .description("List local CAS check records.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full CAS check list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const checks = await listSymbolicCasChecks(path);

    if (options.json) {
      printJson({ total: checks.length, checks });
      return;
    }

    printSymbolicCasCheckList(checks);
  });

const proof = program.command("proof").description("Inspect formal proof-checker backends and trust boundaries.");

proof
  .command("backends")
  .description("Probe local proof-checker backends without network access.")
  .option("--json", "Print the full proof backend status JSON")
  .option("--lean-command <path>", "Lean executable path or command. Defaults to TRUTH_HARNESS_LEAN or lean.")
  .option("--timeout-ms <ms>", "Backend probe timeout in milliseconds", parsePositiveInteger, 3000)
  .action((options: { json?: boolean; leanCommand?: string; timeoutMs: number }) => {
    const status = getProofBackendStatus({
      leanCommand: options.leanCommand,
      timeoutMs: options.timeoutMs
    });

    if (options.json) {
      printJson(status);
      return;
    }

    printProofBackendStatus(status);
  });

proof
  .command("project")
  .description("Inspect a local Lean/Lake project layout without running Lean, Lake, or network commands.")
  .argument("[path]", "Workspace-local Lean project path", ".")
  .option("--workspace <path>", "Workspace root path", ".")
  .option("--max-lean-files <count>", "Maximum .lean file samples to include", parsePositiveInteger, 40)
  .option("--json", "Print the full Lean project inspection JSON")
  .action(async (path: string, options: { workspace: string; maxLeanFiles: number; json?: boolean }) => {
    const inspection = await inspectLeanProject({
      rootPath: options.workspace,
      projectPath: path,
      maxLeanFiles: options.maxLeanFiles
    });

    if (options.json) {
      printJson(inspection);
      return;
    }

    printLeanProjectInspection(inspection);
  });

proof
  .command("check")
  .description("Check a local Lean proof artifact and produce a proof-check record.")
  .argument("<source>", "Lean source file to check")
  .option("--json", "Print the full proof-check JSON")
  .option("--out <path>", "Write the full proof-check JSON to a file")
  .option("--write", "Write JSON and Markdown into .truth-harness/proofs")
  .option("--workspace <path>", "Project root path", ".")
  .option("--declaration <name>", "Optional formal declaration name represented by the source")
  .option("--route <route_id>", "Optional verifier route id this proof-check is intended to support")
  .option("--obligation <obl_id>", "Optional verifier route obligation id this proof-check is intended to support")
  .option("--statement-hash <hash>", "Optional hash of the formal/informal statement boundary this proof-check is intended to support")
  .option("--statement <text>", "Optional statement boundary this proof-check is intended to support")
  .option("--lean-command <path>", "Lean executable path or command. Defaults to TRUTH_HARNESS_LEAN or lean.")
  .option("--timeout-ms <ms>", "Backend probe and proof-check timeout in milliseconds", parsePositiveInteger, 3000)
  .option("--fail-on-unproved", "Exit non-zero unless Lean accepts the proof artifact")
  .action(
    async (
      sourcePath: string,
      options: {
        json?: boolean;
        out?: string;
        write?: boolean;
        workspace: string;
        declaration?: string;
        route?: string;
        obligation?: string;
        statementHash?: string;
        statement?: string;
        leanCommand?: string;
        timeoutMs: number;
        failOnUnproved?: boolean;
      }
    ) => {
      const workspaceWrite = options.write
        ? await writeLeanProofCheckRecord({
            rootPath: options.workspace,
            sourcePath,
            declarationName: options.declaration,
            scope: proofCheckScopeFromOptions(options),
            leanCommand: options.leanCommand,
            timeoutMs: options.timeoutMs
          })
        : undefined;
      const record =
        workspaceWrite?.record ??
        checkLeanProofArtifact({
          sourcePath: resolve(sourcePath),
          sourceRef: sourcePath,
          sourceText: await readFile(resolve(sourcePath), "utf8"),
          declarationName: options.declaration,
          scope: proofCheckScopeFromOptions(options),
          leanCommand: options.leanCommand,
          timeoutMs: options.timeoutMs,
          replayCommand: `truth-harness proof check ${quoteCommandArg(sourcePath)} --json`
        });

      if (options.out) {
        await writeJson(options.out, record);
      }

      if (options.json) {
        printJson(workspaceWrite ? { record, written: true, result: workspaceWrite } : record);
        if (options.failOnUnproved && record.trust !== "proved") {
          process.exitCode = 1;
        }
        return;
      }

      printLeanProofCheck(record, options.out, workspaceWrite);
      if (options.failOnUnproved && record.trust !== "proved") {
        process.exitCode = 1;
      }
    }
  );

proof
  .command("list")
  .description("List local proof-check records.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full proof-check list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const checks = await listLeanProofChecks(path);

    if (options.json) {
      printJson({ total: checks.length, checks });
      return;
    }

    printLeanProofCheckList(checks);
  });

proof
  .command("visual")
  .description("Create a replayable visual artifact from a local Lean proof-check record.")
  .argument("<proof>", "Proof-check id or workspace-local proof-check JSON path")
  .option("--workspace <path>", "Project root path", ".")
  .option("--title <title>", "Optional visual artifact title")
  .option("--json", "Print the full visual artifact write JSON")
  .action(async (proofRef: string, options: { workspace: string; title?: string; json?: boolean }) => {
    const result = await writeLeanProofCheckVisualArtifact({
      rootPath: options.workspace,
      proofRef,
      title: options.title
    });

    if (options.json) {
      printJson(result);
      return;
    }

    printVisualArtifactWrite(result);
  });

const smt = program.command("smt").description("Inspect local SMT solver backends and check SMT-LIB artifacts.");

smt
  .command("backends")
  .description("Probe local SMT solver backends without checking a claim.")
  .option("--json", "Print the full SMT backend status JSON")
  .option("--z3-command <path>", "Z3 executable path or command. Defaults to TRUTH_HARNESS_Z3 or z3.")
  .option("--cvc5-command <path>", "cvc5 executable path or command. Defaults to TRUTH_HARNESS_CVC5 or cvc5.")
  .option("--timeout-ms <ms>", "Backend probe timeout in milliseconds", parsePositiveInteger, 3000)
  .action((options: { json?: boolean; z3Command?: string; cvc5Command?: string; timeoutMs: number }) => {
    const status = getSmtBackendStatus({
      z3Command: options.z3Command,
      cvc5Command: options.cvc5Command,
      timeoutMs: options.timeoutMs
    });

    if (options.json) {
      printJson(status);
      return;
    }

    printSmtBackendStatus(status);
  });

smt
  .command("check")
  .description("Check a local SMT-LIB artifact with Z3 or cvc5 and produce an SMT check record.")
  .argument("<source>", "SMT-LIB source file to check")
  .option("--json", "Print the full SMT check JSON")
  .option("--out <path>", "Write the full SMT check JSON to a file")
  .option("--write", "Write JSON and Markdown into .truth-harness/smt")
  .option("--workspace <path>", "Project root path", ".")
  .option("--query <name>", "Optional query or constraint-set name represented by the source")
  .option("--backend <backend>", "SMT backend to use: z3 or cvc5", parseSmtBackendOption, "z3")
  .option("--z3-command <path>", "Z3 executable path or command. Defaults to TRUTH_HARNESS_Z3 or z3.")
  .option("--cvc5-command <path>", "cvc5 executable path or command. Defaults to TRUTH_HARNESS_CVC5 or cvc5.")
  .option("--timeout-ms <ms>", "Backend probe and SMT check timeout in milliseconds", parsePositiveInteger, 3000)
  .option("--fail-on-unverified", "Exit non-zero unless the solver returns sat or unsat")
  .action(
    async (
      sourcePath: string,
      options: {
        json?: boolean;
        out?: string;
        write?: boolean;
        workspace: string;
        query?: string;
        backend: SmtBackendId;
        z3Command?: string;
        cvc5Command?: string;
        timeoutMs: number;
        failOnUnverified?: boolean;
      }
    ) => {
      const workspaceWrite = options.write
        ? await writeSmtCheckRecord({
            rootPath: options.workspace,
            sourcePath,
            queryName: options.query,
            backend: options.backend,
            z3Command: options.z3Command,
            cvc5Command: options.cvc5Command,
            timeoutMs: options.timeoutMs
          })
        : undefined;
      const record =
        workspaceWrite?.record ??
        checkSmtLibArtifact({
          sourcePath: resolve(sourcePath),
          sourceRef: sourcePath,
          sourceText: await readFile(resolve(sourcePath), "utf8"),
          queryName: options.query,
          backend: options.backend,
          z3Command: options.z3Command,
          cvc5Command: options.cvc5Command,
          timeoutMs: options.timeoutMs,
          replayCommand: `truth-harness smt check ${quoteCommandArg(sourcePath)} --backend ${options.backend} --json`
        });

      if (options.out) {
        await writeJson(options.out, record);
      }

      if (options.json) {
        printJson(workspaceWrite ? { record, written: true, result: workspaceWrite } : record);
        if (options.failOnUnverified && record.trust !== "smt-checked") {
          process.exitCode = 1;
        }
        return;
      }

      printSmtCheck(record, options.out, workspaceWrite);
      if (options.failOnUnverified && record.trust !== "smt-checked") {
        process.exitCode = 1;
      }
    }
  );

smt
  .command("solve")
  .description("Build workspace-local SMT-LIB from explicit integer constraints and check it with Z3 or cvc5.")
  .option("--json", "Print the full generated problem and SMT check JSON")
  .option("--workspace <path>", "Project root path", ".")
  .option("--name <name>", "Optional query or constraint-set name")
  .option("--int <name>", "Declare an integer variable. Repeat for multiple variables.", collectRepeated, [])
  .option("--constraint <expr>", "Add a constraint such as \"x + y >= 3\". Repeat for multiple constraints.", collectRepeated, [])
  .option("--model", "Append get-model after check-sat for satisfiable constraints")
  .option("--backend <backend>", "SMT backend to use: z3 or cvc5", parseSmtBackendOption, "z3")
  .option("--z3-command <path>", "Z3 executable path or command. Defaults to TRUTH_HARNESS_Z3 or z3.")
  .option("--cvc5-command <path>", "cvc5 executable path or command. Defaults to TRUTH_HARNESS_CVC5 or cvc5.")
  .option("--timeout-ms <ms>", "Backend probe and SMT check timeout in milliseconds", parsePositiveInteger, 3000)
  .option("--fail-on-unverified", "Exit non-zero unless the solver returns sat or unsat")
  .action(
    async (options: {
      json?: boolean;
      workspace: string;
      name?: string;
      int: string[];
      constraint: string[];
      model?: boolean;
      backend: SmtBackendId;
      z3Command?: string;
      cvc5Command?: string;
      timeoutMs: number;
      failOnUnverified?: boolean;
    }) => {
      const result = await solveSmtProblem({
        rootPath: options.workspace,
        queryName: options.name,
        variables: options.int,
        constraints: options.constraint,
        includeModel: options.model,
        backend: options.backend,
        z3Command: options.z3Command,
        cvc5Command: options.cvc5Command,
        timeoutMs: options.timeoutMs
      });

      if (options.json) {
        printJson(result);
        if (options.failOnUnverified && result.check.record.trust !== "smt-checked") {
          process.exitCode = 1;
        }
        return;
      }

      printSmtProblemSolve(result);
      if (options.failOnUnverified && result.check.record.trust !== "smt-checked") {
        process.exitCode = 1;
      }
    }
  );

smt
  .command("list")
  .description("List local SMT check records.")
  .argument("[path]", "Project root path", ".")
  .option("--json", "Print the full SMT check list JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const checks = await listSmtChecks(path);

    if (options.json) {
      printJson({ total: checks.length, checks });
      return;
    }

    printSmtCheckList(checks);
  });

const engines = program
  .command("engines")
  .description("Show the local engine capability manifest and trust boundaries.")
  .option("--json", "Print the full engine manifest JSON")
  .option("--timeout-ms <ms>", "Backend probe timeout in milliseconds", parsePositiveInteger, 1500)
  .option("--maxima-command <command>", "Override Maxima executable for this probe")
  .option("--sage-command <command>", "Override SageMath executable for this probe")
  .option("--lean-command <command>", "Override Lean executable for this probe")
  .option("--z3-command <command>", "Override Z3 executable for this probe")
  .option("--cvc5-command <command>", "Override cvc5 executable for this probe")
  .action(
    (options: {
      json?: boolean;
      timeoutMs: number;
      maximaCommand?: string;
      sageCommand?: string;
      leanCommand?: string;
      z3Command?: string;
      cvc5Command?: string;
    }) => {
      const manifest = getEngineManifest({
        timeoutMs: options.timeoutMs,
        maximaCommand: options.maximaCommand,
        sageCommand: options.sageCommand,
        leanCommand: options.leanCommand,
        z3Command: options.z3Command,
        cvc5Command: options.cvc5Command
      });

      if (options.json) {
        printJson(manifest);
        return;
      }

      printEngineManifest(manifest);
    }
  );

engines
  .command("readiness")
  .description("Summarize which trust labels this local installation can responsibly support today.")
  .option("--json", "Print the full engine readiness JSON")
  .option("--timeout-ms <ms>", "Backend probe timeout in milliseconds", parsePositiveInteger, 1500)
  .option("--maxima-command <command>", "Override Maxima executable for this probe")
  .option("--sage-command <command>", "Override SageMath executable for this probe")
  .option("--lean-command <command>", "Override Lean executable for this probe")
  .option("--z3-command <command>", "Override Z3 executable for this probe")
  .option("--cvc5-command <command>", "Override cvc5 executable for this probe")
  .action(
    (options: {
      json?: boolean;
      timeoutMs: number;
      maximaCommand?: string;
      sageCommand?: string;
      leanCommand?: string;
      z3Command?: string;
      cvc5Command?: string;
    }, command: Command) => {
      const parentOptions = engines.opts<{
        json?: boolean;
        timeoutMs?: number;
        maximaCommand?: string;
        sageCommand?: string;
        leanCommand?: string;
        z3Command?: string;
        cvc5Command?: string;
      }>();
      const report = createEngineReadinessReport({
        timeoutMs:
          command.getOptionValueSource("timeoutMs") === "default" &&
          engines.getOptionValueSource("timeoutMs") !== "default" &&
          parentOptions.timeoutMs !== undefined
            ? parentOptions.timeoutMs
            : options.timeoutMs,
        maximaCommand: options.maximaCommand ?? parentCliStringOption("maximaCommand", parentOptions.maximaCommand),
        sageCommand: options.sageCommand ?? parentCliStringOption("sageCommand", parentOptions.sageCommand),
        leanCommand: options.leanCommand ?? parentCliStringOption("leanCommand", parentOptions.leanCommand),
        z3Command: options.z3Command ?? parentCliStringOption("z3Command", parentOptions.z3Command),
        cvc5Command: options.cvc5Command ?? parentCliStringOption("cvc5Command", parentOptions.cvc5Command)
      });
      const json = Boolean(options.json || parentOptions.json);

      if (json) {
        printJson(report);
        return;
      }

      printEngineReadinessReport(report);
    }
  );

engines
  .command("verify")
  .description("Run concrete local engine evidence checks without minting fake trust.")
  .option("--json", "Print the full engine verification JSON")
  .option("--workspace <path>", "Local workspace root for source files and --write output", ".")
  .option("--timeout-ms <ms>", "Concrete check timeout in milliseconds", parsePositiveInteger, 3000)
  .option("--maxima-command <command>", "Override Maxima executable for the symbolic cross-check")
  .option("--sage-command <command>", "Override SageMath executable for the optional CAS readiness probe")
  .option("--lean-command <command>", "Override Lean executable for the proof fixture")
  .option("--z3-command <command>", "Override Z3 executable for the SMT check")
  .option("--cvc5-command <command>", "Override cvc5 executable for the optional second SMT check")
  .option("--smt-source <path>", "Workspace-local SMT-LIB source for the SMT checks", "docs/examples/constraints.smt2")
  .option("--lean-source <path>", "Workspace-local Lean source for the Lean fixture", "docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean")
  .option("--write", "Write the engine evidence run into .truth-harness/engine-runs")
  .option("--require-maxima", "Fail unless Maxima earns a concrete cross-checked result")
  .option("--require-z3", "Fail unless Z3 earns a concrete smt-checked result")
  .option("--require-cvc5", "Fail unless cvc5 earns a concrete smt-checked result")
  .option("--require-lean", "Fail unless Lean accepts the pinned proof fixture")
  .option("--require-sage", "Fail unless SageMath earns a constrained CAS cross-check")
  .option("--require-docker-core", "Require the Docker-core Maxima and Z3 gates")
  .option("--require-all-concrete", "Require Maxima, Z3, and Lean concrete evidence gates")
  .option("--require-all-engines", "Require Maxima, Z3, cvc5, Lean, and SageMath evidence gates")
  .action(
    async (options: {
      json?: boolean;
      workspace: string;
      timeoutMs: number;
      maximaCommand?: string;
      sageCommand?: string;
      leanCommand?: string;
      z3Command?: string;
      cvc5Command?: string;
      smtSource: string;
      leanSource: string;
      write?: boolean;
      requireMaxima?: boolean;
      requireZ3?: boolean;
      requireCvc5?: boolean;
      requireLean?: boolean;
      requireSage?: boolean;
      requireDockerCore?: boolean;
      requireAllConcrete?: boolean;
      requireAllEngines?: boolean;
    }, command: Command) => {
      const parentOptions = engines.opts<{
        json?: boolean;
        timeoutMs?: number;
        maximaCommand?: string;
        sageCommand?: string;
        leanCommand?: string;
        z3Command?: string;
        cvc5Command?: string;
      }>();
      const resolvedOptions = {
        ...options,
        json: Boolean(options.json || parentOptions.json),
        timeoutMs:
          command.getOptionValueSource("timeoutMs") === "default" &&
          engines.getOptionValueSource("timeoutMs") !== "default" &&
          parentOptions.timeoutMs !== undefined
            ? parentOptions.timeoutMs
            : options.timeoutMs,
        maximaCommand: options.maximaCommand ?? parentCliStringOption("maximaCommand", parentOptions.maximaCommand),
        sageCommand: options.sageCommand ?? parentCliStringOption("sageCommand", parentOptions.sageCommand),
        leanCommand: options.leanCommand ?? parentCliStringOption("leanCommand", parentOptions.leanCommand),
        z3Command: options.z3Command ?? parentCliStringOption("z3Command", parentOptions.z3Command),
        cvc5Command: options.cvc5Command ?? parentCliStringOption("cvc5Command", parentOptions.cvc5Command)
      };
      const json = resolvedOptions.json;
      const requirements = engineRequirementsFromOptions(resolvedOptions);
      const replayCommand = engineVerificationReplayCommand(resolvedOptions);
      const writeResult = resolvedOptions.write
        ? await writeEngineVerificationRun({
            rootPath: resolvedOptions.workspace,
            timeoutMs: resolvedOptions.timeoutMs,
            maximaCommand: resolvedOptions.maximaCommand,
            sageCommand: resolvedOptions.sageCommand,
            leanCommand: resolvedOptions.leanCommand,
            z3Command: resolvedOptions.z3Command,
            cvc5Command: resolvedOptions.cvc5Command,
            smtSourcePath: resolvedOptions.smtSource,
            leanSourcePath: resolvedOptions.leanSource,
            requirements,
            replayCommand
          })
        : undefined;
      const report = writeResult?.record.report ?? await verifyEngineEvidence({
        rootPath: resolvedOptions.workspace,
        timeoutMs: resolvedOptions.timeoutMs,
        maximaCommand: resolvedOptions.maximaCommand,
        sageCommand: resolvedOptions.sageCommand,
        leanCommand: resolvedOptions.leanCommand,
        z3Command: resolvedOptions.z3Command,
        cvc5Command: resolvedOptions.cvc5Command,
        smtSourcePath: resolvedOptions.smtSource,
        leanSourcePath: resolvedOptions.leanSource,
        requirements
      });

      if (json) {
        printJson(writeResult ?? report);
      } else {
        printEngineVerificationReport(report, writeResult);
      }

      if (report.requiredTotal > 0 && report.requiredPassed !== report.requiredTotal) {
        process.exitCode = 1;
      }
    }
  );

engines
  .command("runs")
  .description("List saved engine evidence verification runs from the local workspace.")
  .argument("[workspace]", "Local workspace root", ".")
  .option("--json", "Print saved engine runs as JSON")
  .action(async (workspace: string, options: { json?: boolean }) => {
    const runs = await listEngineVerificationRuns(workspace);
    const json = Boolean(options.json || engines.opts<{ json?: boolean }>().json);
    if (json) {
      printJson(runs);
      return;
    }
    printEngineVerificationRuns(runs);
  });

program
  .command("demo")
  .description("Run the self-contained Truth Harness launch gauntlet and write a shareable HTML report.")
  .option("--report <path>", "Write the HTML report to this path", "truth-harness-demo-report.html")
  .option("--maxima-command <command>", "Override Maxima executable for symbolic cross-check receipts")
  .option("--z3-command <command>", "Override Z3 executable for SMT demo checks")
  .option("--require-symbolic-cross-check", "Exit non-zero unless the symbolic demo cases earn cross-checked")
  .option("--no-color", "Disable ANSI colors in terminal output")
  .action(
    async (options: {
      report: string;
      maximaCommand?: string;
      z3Command?: string;
      requireSymbolicCrossCheck?: boolean;
      color?: boolean;
    }) => {
    const result = await runDemoGauntlet({
      reportPath: options.report,
      maximaCommand: options.maximaCommand,
      z3Command: options.z3Command,
      requireSymbolicCrossCheck: Boolean(options.requireSymbolicCrossCheck),
      color: options.color !== false
    });

    if (result.unexpectedLabels.length > 0 || result.recordingGateFailures.length > 0) {
      process.exitCode = 1;
    }
    }
  );

program
  .command("doctor")
  .description("Show local adapter and trust-surface status.")
  .option("--json", "Print the full engine manifest JSON")
  .action((options: { json?: boolean }) => {
    const manifest = getEngineManifest();

    if (options.json) {
      printJson(manifest);
      return;
    }

    console.log("Truth Harness doctor");
    console.log("");
    printEngineManifest(manifest);
  });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await program.parseAsync(process.argv);
}

export { program };

function parseAskArgs(tokens: string[]): { problem: string; json: boolean; out?: string } {
  const problemTokens: string[] = [];
  let json = false;
  let out: string | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "--") {
      continue;
    }

    if (token === "--json") {
      json = true;
      continue;
    }

    if (token === "--out") {
      out = tokens[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith("--out=")) {
      out = token.slice("--out=".length);
      continue;
    }

    problemTokens.push(token);
  }

  const problem = problemTokens.join(" ").trim();
  if (!problem) {
    throw new Error("Missing problem. Example: truth-harness ask \"compute 2 + 2\"");
  }

  return { problem, json, out };
}

function parseRenderFormat(format: string): ReceiptRenderFormat {
  if (format === "markdown" || format === "html") {
    return format;
  }

  throw new Error(`Unsupported receipt render format ${JSON.stringify(format)}. Use markdown or html.`);
}

function parseTeachingAudience(value: string): TeachingAudience {
  if (isTeachingAudience(value)) {
    return value;
  }

  throw new Error(`Unsupported teaching audience ${JSON.stringify(value)}. Use middle, high, college, or expert.`);
}

function parseSympyOperation(value: string): SympyOperation {
  if (
    value === "simplify" ||
    value === "factor" ||
    value === "expand" ||
    value === "differentiate" ||
    value === "integrate"
  ) {
    return value;
  }

  throw new Error(
    `Unsupported symbolic operation ${JSON.stringify(value)}. Use simplify, factor, expand, differentiate, or integrate.`
  );
}

function parseSymbolicCasBackend(value: string): SymbolicCasBackendId {
  if (value === "maxima" || value === "sage") {
    return value;
  }

  throw new Error(`Unsupported CAS backend ${JSON.stringify(value)}. Use maxima or sage.`);
}

type DemoTrustBucket = "verified" | "refuted" | "unverified";

interface DemoCase {
  title: string;
  category: string;
  kind: "receipt" | "smt";
  problem: string;
  chatbotClaim: string;
  lesson: string;
  allowedTrust: TrustLabel[];
  preferredTrust?: TrustLabel;
  smtSourceRef?: string;
  smtQueryName?: string;
}

interface DemoCaseResult {
  index: number;
  demoCase: DemoCase;
  trust: TrustLabel;
  summary: string;
  replay: string;
  artifact: Receipt | SmtCheckRecord;
  bucket: DemoTrustBucket;
  expected: boolean;
  evidenceLines: string[];
}

interface DemoGauntletResult {
  cases: DemoCaseResult[];
  tally: Record<DemoTrustBucket, number>;
  reportPath: string;
  unexpectedLabels: string[];
  recordingGateFailures: string[];
}

interface DemoEvaluation {
  trust: TrustLabel;
  summary: string;
  replay: string;
  artifact: Receipt | SmtCheckRecord;
  evidenceLines: string[];
}

function createDemoCases(): DemoCase[] {
  return [
    {
      title: "False universal parity claim",
      category: "Refutation",
      kind: "receipt",
      problem: "for all integers n, n^2+n+1 is even",
      chatbotClaim: "Sure: n^2+n is even, so adding 1 keeps the pattern simple.",
      lesson: "A single exact counterexample is enough to refute the universal claim.",
      allowedTrust: ["refuted"]
    },
    {
      title: "False oddness claim",
      category: "Refutation",
      kind: "receipt",
      problem: "for all integers n, n^2+n is odd",
      chatbotClaim: "Consecutive products alternate, so the expression is odd.",
      lesson: "The finite counterexample search checks exact integer values before explaining.",
      allowedTrust: ["refuted"]
    },
    {
      title: "False square-plus-one claim",
      category: "Refutation",
      kind: "receipt",
      problem: "for all integers n, n^2+1 is even",
      chatbotClaim: "A square plus one should be even for all integers.",
      lesson: "Truth Harness records the counterexample route instead of smoothing over it.",
      allowedTrust: ["refuted"]
    },
    {
      title: "Popular AI trap: parity handwave",
      category: "Refutation",
      kind: "receipt",
      problem: "for all integers n, n^2+n+2 is odd",
      chatbotClaim: "Since n^2+n is even, adding 2 flips it to odd.",
      lesson: "The model-sounding explanation is subtly wrong; exact arithmetic catches it.",
      allowedTrust: ["refuted"]
    },
    {
      title: "Exact fraction addition",
      category: "Exact Computation",
      kind: "receipt",
      problem: "compute 3 / 4 + 5 / 8",
      chatbotClaim: "The answer is 11/8.",
      lesson: "The answer is not trusted because it sounds right; it has a machine trace.",
      allowedTrust: ["exact-computed"]
    },
    {
      title: "Exact common-denominator trace",
      category: "Exact Computation",
      kind: "receipt",
      problem: "compute 1 / 3 + 1 / 6",
      chatbotClaim: "Just convert thirds and sixths mentally.",
      lesson: "The receipt stores replayable exact rational arithmetic and lesson views.",
      allowedTrust: ["exact-computed"]
    },
    {
      title: "Narrow modular parity check",
      category: "Exact Computation",
      kind: "receipt",
      problem: "for all integers n, n^2+n is even",
      chatbotClaim: "This is obviously true, so call it proved.",
      lesson: "The system says exact-computed, not proved, because Lean did not check it.",
      allowedTrust: ["exact-computed"]
    },
    {
      title: "Symbolic identity cross-check",
      category: "Cross-Check",
      kind: "receipt",
      problem: "symbolic simplify sin(x)^2 + cos(x)^2",
      chatbotClaim: "This simplifies to 1, no need to show work.",
      lesson: "In Docker, SymPy plus Maxima can earn cross-checked; otherwise it stays honest.",
      allowedTrust: ["cross-checked", "exact-computed", "unverified"],
      preferredTrust: "cross-checked"
    },
    {
      title: "Symbolic expansion cross-check",
      category: "Cross-Check",
      kind: "receipt",
      problem: "symbolic expand (x + 1)^2",
      chatbotClaim: "The expanded form is x^2 + 2x + 1.",
      lesson: "Independent CAS agreement is evidence, but still not a formal proof.",
      allowedTrust: ["cross-checked", "exact-computed", "unverified"],
      preferredTrust: "cross-checked"
    },
    {
      title: "Z3 integer constraint check",
      category: "SMT Solver",
      kind: "smt",
      problem: "there exists an integer x with 0 < x < 3",
      chatbotClaim: "The answer is yes; x = 1 or x = 2.",
      lesson: "Z3 checks the concrete SMT-LIB encoding and records the model boundary.",
      allowedTrust: ["smt-checked", "unverified"],
      preferredTrust: "smt-checked",
      smtSourceRef: "docs/examples/constraints.smt2",
      smtQueryName: "demo-bounded-integer-witness"
    },
    {
      title: "Boundary: famous conjecture",
      category: "Honest Uncertainty",
      kind: "receipt",
      problem: "prove the twin prime conjecture",
      chatbotClaim: "Here is a confident proof sketch in a few paragraphs.",
      lesson: "Unsupported high-stakes claims stay unverified until a real checker route exists.",
      allowedTrust: ["unverified"]
    },
    {
      title: "Boundary: unsupported discovery request",
      category: "Honest Uncertainty",
      kind: "receipt",
      problem: "derive a room-temperature superconductor formula from scratch",
      chatbotClaim: "A plausible formula can be proposed directly from theory.",
      lesson: "The harness can organize future evidence, but it refuses fake certainty.",
      allowedTrust: ["unverified"]
    },
    {
      title: "Dimensional sanity pass",
      category: "Dimensional Analysis",
      kind: "receipt",
      problem: "dimension check force = mass * acceleration",
      chatbotClaim: "Newton's equation is dimensionally valid.",
      lesson: "The checker verifies units and records that this is not full physical truth.",
      allowedTrust: ["dimension-checked"]
    },
    {
      title: "Dimensional mistake caught",
      category: "Dimensional Analysis",
      kind: "receipt",
      problem: "dimension check force = mass * velocity",
      chatbotClaim: "Force can be described as mass times velocity.",
      lesson: "The receipt refutes the equation under the local SI dimension table.",
      allowedTrust: ["refuted"]
    },
    {
      title: "Conservative interval bound",
      category: "Bounds",
      kind: "receipt",
      problem: "bound x^2 for x in [-2, 3]",
      chatbotClaim: "The value should sit somewhere between 0 and 9.",
      lesson: "The interval adapter produces a replayable bound with assumptions.",
      allowedTrust: ["bounded-numeric"]
    },
    {
      title: "Reciprocal interval bound",
      category: "Bounds",
      kind: "receipt",
      problem: "bound 1 / x for x in [2, 4]",
      chatbotClaim: "The reciprocal is between one fourth and one half.",
      lesson: "Bounds are evidence for the stated interval, not a broader theorem.",
      allowedTrust: ["bounded-numeric"]
    }
  ];
}

async function runDemoGauntlet(options: {
  reportPath: string;
  maximaCommand?: string;
  z3Command?: string;
  requireSymbolicCrossCheck: boolean;
  color: boolean;
}): Promise<DemoGauntletResult> {
  const color = createDemoColorizer(options.color);
  const resolvedReportPath = resolve(options.reportPath);
  const cases = createDemoCases();
  const tally: Record<DemoTrustBucket, number> = { verified: 0, refuted: 0, unverified: 0 };
  const results: DemoCaseResult[] = [];
  const unexpectedLabels: string[] = [];
  const recordingGateFailures: string[] = [];

  console.log(color.bold("Truth Harness — Verified Math for AI Agents"));
  console.log(color.dim("Local engines catch false claims, verify bounded truths, and admit uncertainty."));
  console.log("");

  let currentCategory = "";
  for (const [index, demoCase] of cases.entries()) {
    if (demoCase.category !== currentCategory) {
      currentCategory = demoCase.category;
      console.log(color.dim(`── ${currentCategory} ─────────────────────────────────────────`));
    }

    const evaluation = await evaluateDemoCase(demoCase, options);
    const bucket = demoTrustBucket(evaluation.trust);
    const expected = demoCase.allowedTrust.includes(evaluation.trust);
    const evidenceLines = evaluation.evidenceLines;
    tally[bucket] += 1;

    if (!expected) {
      unexpectedLabels.push(
        `${index + 1}. ${demoCase.title}: expected ${demoCase.allowedTrust.join(" or ")}, got ${evaluation.trust}`
      );
    }
    if (options.requireSymbolicCrossCheck && demoCase.preferredTrust && evaluation.trust !== demoCase.preferredTrust) {
      recordingGateFailures.push(
        `${index + 1}. ${demoCase.title}: recording gate requires ${demoCase.preferredTrust}, got ${evaluation.trust}`
      );
    }

    results.push({
      index: index + 1,
      demoCase,
      trust: evaluation.trust,
      summary: evaluation.summary,
      replay: evaluation.replay,
      artifact: evaluation.artifact,
      bucket,
      expected,
      evidenceLines
    });

    const trust = colorTrustLabel(evaluation.trust, color);
    const marker = expected ? "" : ` ${color.red("unexpected")}`;
    const preferred =
      demoCase.preferredTrust && demoCase.preferredTrust !== evaluation.trust
        ? color.yellow(` preferred ${demoCase.preferredTrust}`)
        : "";

    console.log(`${color.dim(`[${String(index + 1).padStart(2, "0")}]`)} ${color.bold(demoCase.problem)}`);
    console.log(`     ${color.dimItalic(`AI chatbot says: ${demoCase.chatbotClaim}`)}`);
    console.log(`     ${trust}${marker}${preferred}  ${evidenceLines[0] ?? evaluation.summary}`);
    console.log(`     ${color.dim(`replay: ${evaluation.replay}`)}`);
    console.log("");
  }

  const html = renderDemoReport(results, tally, unexpectedLabels, recordingGateFailures);
  await mkdir(dirname(resolvedReportPath), { recursive: true });
  await writeFile(resolvedReportPath, html, "utf8");

  printDemoScorecard({
    tally,
    total: results.length,
    reportPath: resolvedReportPath,
    color
  });

  if (unexpectedLabels.length > 0) {
    console.log("");
    console.log(color.red("Unexpected trust labels:"));
    for (const label of unexpectedLabels) {
      console.log(`  ${label}`);
    }
  }

  if (recordingGateFailures.length > 0) {
    console.log("");
    console.log(color.yellow("Recording gate failures:"));
    for (const failure of recordingGateFailures) {
      console.log(`  ${failure}`);
    }
    console.log("  Use the Docker engine path before recording: npm run docker:demo");
  }

  return {
    cases: results,
    tally,
    reportPath: resolvedReportPath,
    unexpectedLabels,
    recordingGateFailures
  };
}

async function evaluateDemoCase(
  demoCase: DemoCase,
  options: { maximaCommand?: string; z3Command?: string }
): Promise<DemoEvaluation> {
  if (demoCase.kind === "smt") {
    const sourceRef = demoCase.smtSourceRef ?? "docs/examples/constraints.smt2";
    const sourcePath = resolve(sourceRef);
    const sourceText = await readFile(sourcePath, "utf8");
    const record = checkSmtLibArtifact({
      sourcePath,
      sourceRef,
      sourceText,
      queryName: demoCase.smtQueryName,
      z3Command: options.z3Command,
      replayCommand: `truth-harness smt check ${sourceRef} --json`
    });

    return {
      trust: record.trust,
      summary: smtDemoSummary(record),
      replay: record.replay,
      artifact: record,
      evidenceLines: demoEvidenceLinesForSmt(record)
    };
  }

  const receipt = createReceipt(demoCase.problem, { maximaCommand: options.maximaCommand });
  return {
    trust: receipt.trust,
    summary: receipt.summary,
    replay: receipt.replay,
    artifact: receipt,
    evidenceLines: demoEvidenceLinesForReceipt(receipt)
  };
}

function createDemoColorizer(enabled: boolean): {
  green: (value: string) => string;
  red: (value: string) => string;
  yellow: (value: string) => string;
  cyan: (value: string) => string;
  bold: (value: string) => string;
  dim: (value: string) => string;
  dimItalic: (value: string) => string;
} {
  const wrap = (open: string, value: string) => (enabled ? `${open}${value}\x1b[0m` : value);
  return {
    green: (value) => wrap("\x1b[32m", value),
    red: (value) => wrap("\x1b[31m", value),
    yellow: (value) => wrap("\x1b[33m", value),
    cyan: (value) => wrap("\x1b[36m", value),
    bold: (value) => wrap("\x1b[1m", value),
    dim: (value) => wrap("\x1b[2m", value),
    dimItalic: (value) => wrap("\x1b[2m\x1b[3m", value)
  };
}

function colorTrustLabel(trust: TrustLabel, color: ReturnType<typeof createDemoColorizer>): string {
  if (trust === "refuted") {
    return color.red(`✗ ${trust}`);
  }

  if (trust === "unverified") {
    return color.yellow(`? ${trust}`);
  }

  return color.green(`✓ ${trust}`);
}

function demoTrustBucket(trust: TrustLabel): DemoTrustBucket {
  if (trust === "refuted") {
    return "refuted";
  }

  if (trust === "unverified") {
    return "unverified";
  }

  return "verified";
}

function demoEvidenceLinesForReceipt(receipt: Receipt): string[] {
  const lines: string[] = [receipt.summary];
  const counterexample = receipt.graph.nodes.find((node) => node.kind === "counterexample");
  const certificate = receipt.graph.nodes.find(
    (node) => node.kind === "computation" && node.summary.toLowerCase().includes("for every integer")
  );
  const outputs = receipt.evidenceProfile.outputs.slice(0, 3);
  const backendSummary = receipt.evidenceProfile.backends
    .map((backend) => `${backend.id}${backend.version ? `@${backend.version}` : ""}`)
    .slice(0, 3)
    .join(", ");

  if (counterexample) {
    lines.push(`Counterexample: ${counterexample.summary}`);
  }

  if (certificate) {
    lines.push(`Certificate: ${certificate.summary}`);
  }

  if (outputs.length > 0) {
    lines.push(`Outputs: ${outputs.join("; ")}`);
  }

  if (backendSummary) {
    lines.push(`Backends: ${backendSummary}`);
  }

  if (receipt.evidenceProfile.limitations.length > 0) {
    lines.push(`Boundary: ${receipt.evidenceProfile.limitations[0]}`);
  }

  return dedupeStrings(lines).slice(0, 5);
}

function demoEvidenceLinesForSmt(record: SmtCheckRecord): string[] {
  const lines = [smtDemoSummary(record)];
  const model = record.model?.bindings.map((binding) => `${binding.name}=${binding.value}`).join(", ");

  if (model) {
    lines.push(`Model: ${model}`);
  }

  lines.push(`Backends: ${record.backend.id}${record.backend.version ? `@${record.backend.version}` : ""}`);

  if (record.limitations.length > 0) {
    lines.push(`Boundary: ${record.limitations[0]}`);
  }

  if (record.error) {
    lines.push(`Error: ${record.error}`);
  }

  return dedupeStrings(lines).slice(0, 5);
}

function smtDemoSummary(record: SmtCheckRecord): string {
  if (record.trust === "smt-checked") {
    const model = record.model?.bindings.map((binding) => `${binding.name}=${binding.value}`).join(", ");
    return `Z3 returned ${record.status}${model ? ` with model ${model}` : ""}.`;
  }

  if (record.status === "solver-unavailable") {
    return "Z3 was unavailable, so the SMT claim remains unverified.";
  }

  return `SMT check returned ${record.status}; claim remains ${record.trust}.`;
}

function printDemoScorecard(args: {
  tally: Record<DemoTrustBucket, number>;
  total: number;
  reportPath: string;
  color: ReturnType<typeof createDemoColorizer>;
}): void {
  const lines = [
    "Truth Harness Demo Results",
    `✓ Verified:    ${String(args.tally.verified).padStart(2, " ")}`,
    `✗ Refuted:     ${String(args.tally.refuted).padStart(2, " ")}`,
    `? Unverified:  ${String(args.tally.unverified).padStart(2, " ")}  (honest limits)`,
    `Total:        ${String(args.total).padStart(2, " ")}`,
    "",
    "Every result is replayable.",
    "No result claims more than earned."
  ];
  const width = Math.max(...lines.map((line) => line.length)) + 4;
  const border = "─".repeat(width);

  console.log(args.color.dim(`┌${border}┐`));
  for (const line of lines) {
    const padded = `  ${line}`.padEnd(width, " ");
    console.log(args.color.dim("│") + padded + args.color.dim("│"));
  }
  console.log(args.color.dim(`└${border}┘`));
  console.log(`Report: ${args.reportPath}`);
}

function renderDemoReport(
  results: DemoCaseResult[],
  tally: Record<DemoTrustBucket, number>,
  unexpectedLabels: string[],
  recordingGateFailures: string[]
): string {
  const generatedAt = new Date().toISOString();
  const caseCards = results
    .map((result) => {
      const evidenceList = result.evidenceLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
      const statusClass = `trust-${demoTrustBucket(result.trust)}`;
      const preferred =
        result.demoCase.preferredTrust && result.demoCase.preferredTrust !== result.trust
          ? `<p class="note">Preferred label for a fully provisioned Docker demo: <code>${escapeHtml(result.demoCase.preferredTrust)}</code>.</p>`
          : "";
      return `
        <section class="case-card">
          <div class="case-heading">
            <div>
              <p class="eyebrow">${String(result.index).padStart(2, "0")} / ${results.length} - ${escapeHtml(result.demoCase.category)}</p>
              <h2>${escapeHtml(result.demoCase.title)}</h2>
            </div>
            <span class="trust ${statusClass}">${escapeHtml(result.trust)}</span>
          </div>
          <p><strong>Problem:</strong> <code>${escapeHtml(result.demoCase.problem)}</code></p>
          <p><strong>AI chatbot says:</strong> ${escapeHtml(result.demoCase.chatbotClaim)}</p>
          <p><strong>Truth Harness lesson:</strong> ${escapeHtml(result.demoCase.lesson)}</p>
          ${preferred}
          <h3>Evidence</h3>
          <ul>${evidenceList}</ul>
          <p><strong>Replay:</strong> <code>${escapeHtml(result.replay)}</code></p>
          <details>
            <summary>Evidence JSON</summary>
            <pre>${escapeHtml(JSON.stringify(result.artifact, null, 2))}</pre>
          </details>
        </section>`;
    })
    .join("\n");

  const unexpectedBlock =
    unexpectedLabels.length > 0
      ? `<section class="warning"><h2>Unexpected Labels</h2><ul>${unexpectedLabels
          .map((label) => `<li>${escapeHtml(label)}</li>`)
          .join("")}</ul></section>`
      : "";
  const recordingGateBlock =
    recordingGateFailures.length > 0
      ? `<section class="warning"><h2>Recording Gate Failures</h2><p class="muted">Do not record the launch GIF until the Docker engine path clears these gates.</p><ul>${recordingGateFailures
          .map((label) => `<li>${escapeHtml(label)}</li>`)
          .join("")}</ul></section>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Truth Harness Demo Report — generated locally, zero network access, every result replayable</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #101010;
      --panel: #171717;
      --line: #333230;
      --text: #f4f1ea;
      --muted: #b8b1a7;
      --green: #78d7a6;
      --red: #ff7f7f;
      --yellow: #e7c85f;
      --cyan: #86d9ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 48px 24px 72px;
    }
    header {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, #1c1c1b, #141414);
      border-radius: 8px;
      padding: 28px;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: 34px; line-height: 1.1; margin-bottom: 12px; }
    h2 { font-size: 20px; margin-bottom: 8px; }
    h3 { font-size: 14px; color: var(--muted); margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
    code, pre {
      font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
    }
    code {
      background: #0f0f0f;
      border: 1px solid var(--line);
      border-radius: 5px;
      padding: 2px 5px;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    pre {
      background: #0c0c0c;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      overflow: auto;
      max-height: 520px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .scorecard {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0 0;
    }
    .score {
      background: #111;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    .score strong { display: block; font-size: 28px; }
    .muted, .eyebrow { color: var(--muted); }
    .eyebrow {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
    }
    .case-card, .warning {
      margin-top: 18px;
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
      padding: 22px;
    }
    .case-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .trust {
      border-radius: 999px;
      padding: 5px 10px;
      font-weight: 700;
      white-space: nowrap;
    }
    .trust-verified { color: var(--green); background: rgba(120, 215, 166, 0.12); border: 1px solid rgba(120, 215, 166, 0.42); }
    .trust-refuted { color: var(--red); background: rgba(255, 127, 127, 0.12); border: 1px solid rgba(255, 127, 127, 0.42); }
    .trust-unverified { color: var(--yellow); background: rgba(231, 200, 95, 0.12); border: 1px solid rgba(231, 200, 95, 0.42); }
    .note {
      border-left: 3px solid var(--yellow);
      padding-left: 12px;
      color: var(--muted);
    }
    summary { cursor: pointer; color: var(--cyan); }
    li { margin-bottom: 6px; }
    @media (max-width: 760px) {
      main { padding: 28px 14px 48px; }
      .scorecard { grid-template-columns: 1fr; }
      .case-heading { flex-direction: column; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Generated ${escapeHtml(generatedAt)}</p>
      <h1>Truth Harness Demo Report — generated locally, zero network access, every result replayable.</h1>
      <p class="muted">Generated locally, zero network access, every result replayable. This report shows refutations, exact computation, cross-checks, SMT checks, honest uncertainty, dimensional analysis, interval bounds, replay commands, and evidence JSON.</p>
      <div class="scorecard">
        <div class="score"><span class="muted">Verified/computed</span><strong>${tally.verified}</strong></div>
        <div class="score"><span class="muted">Refuted</span><strong>${tally.refuted}</strong></div>
        <div class="score"><span class="muted">Unverified</span><strong>${tally.unverified}</strong></div>
      </div>
    </header>
    ${unexpectedBlock}
    ${recordingGateBlock}
    ${caseCards}
  </main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function printEngineManifest(manifest: EngineManifest): void {
  console.log("Truth Harness engine manifest");
  console.log(`Status: ${manifest.status}`);
  console.log(`Ready: ${manifest.readyCount}/${manifest.totalCount}`);
  console.log(
    `Native kernels: ${manifest.nativeCount}; adapters: ${manifest.adapterCount}; planned adapters: ${manifest.plannedCount}`
  );
  console.log(
    `Deterministic kernels: ${manifest.deterministicCount}; replay-deterministic adapters: ${manifest.replayDeterministicCount}`
  );
  console.log(`Network: ${manifest.networkAccess}`);

  printEngineCapabilityGroup(
    "Native kernels",
    manifest.capabilities.filter((capability) => capability.kind === "native-kernel")
  );
  printEngineCapabilityGroup(
    "Adapters",
    manifest.capabilities.filter((capability) => capability.kind === "adapter")
  );
  printEngineCapabilityGroup(
    "Workspace and safety services",
    manifest.capabilities.filter((capability) => capability.kind === "workspace-service" || capability.kind === "safety-boundary")
  );
  printEngineCapabilityGroup(
    "Planned adapters",
    manifest.capabilities.filter((capability) => capability.kind === "planned-adapter")
  );

  console.log("");
  console.log("Trust boundary:");
  console.log("  AI output is not evidence.");
  console.log("  Status probes do not mint evidence.");
  console.log("  Claim trust requires resolvable local evidence.");
  console.log("  `proved` requires an accepted proof-checker run.");
  console.log("  `smt-checked` requires a concrete SMT solver run.");
  console.log("  `cross-checked` requires independent agreement.");
  console.log("  Machine contract is JSON-first, structured, stable-id, replay-required, and primitive-composable.");

  if (manifest.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of manifest.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printEngineReadinessReport(report: EngineReadinessReport): void {
  console.log("Truth Harness engine readiness");
  console.log(`Status: ${report.status}`);
  console.log(`Manifest: ${report.manifestStatus}`);
  console.log(`Claim classes: ${report.summary.readyClaimClasses}/${report.summary.totalClaimClasses} ready`);
  console.log(`Capabilities: ${report.summary.readyCapabilities}/${report.summary.totalCapabilities} ready`);
  console.log(
    `Trust labels ready today: ${
      report.summary.readyTrustLabels.length > 0 ? report.summary.readyTrustLabels.join(", ") : "none"
    }`
  );
  console.log(`Network: ${report.networkAccess}`);

  console.log("");
  console.log("Readiness gates:");
  for (const gate of report.gates) {
    const marker = gate.status === "ready" ? "READY" : "BLOCKED";
    console.log(`  [${marker}] ${gate.title}`);
    console.log(`    ${gate.summary}`);
    if (gate.missingClaimClasses.length > 0) {
      console.log(`    Missing: ${gate.missingClaimClasses.join(", ")}`);
    }
  }

  console.log("");
  console.log("Claim support:");
  for (const claimClass of report.claimClasses) {
    const marker = readinessMarker(claimClass.status);
    console.log(`  [${marker}] ${claimClass.displayName}`);
    console.log(`    Lane: ${claimClass.lane}; trust: ${claimClass.targetTrust}; support: ${claimClass.supportKind}`);
    console.log(`    Evidence rule: ${claimClass.evidenceRule}`);
    if (claimClass.readyCapabilityIds.length > 0) {
      console.log(`    Ready capabilities: ${claimClass.readyCapabilityIds.join(", ")}`);
    }
    if (claimClass.missingCapabilityIds.length > 0) {
      console.log(`    Missing capabilities: ${claimClass.missingCapabilityIds.join(", ")}`);
    }
    if (claimClass.recommendedCommand) {
      console.log(`    Command: ${claimClass.recommendedCommand}`);
    }
  }

  console.log("");
  console.log("Trust boundary:");
  console.log("  Readiness does not mint evidence.");
  console.log("  AI output is not evidence.");
  console.log("  `proved` requires an accepted proof-checker run.");
  console.log("  Professor-ready claims require concrete engine runs, not status probes.");
  console.log("  Hard science and engineering claims still require domain validation.");

  if (report.recommendedNextActions.length > 0) {
    console.log("");
    console.log("Recommended next actions:");
    for (const action of report.recommendedNextActions) {
      console.log(`  ${action}`);
    }
  }

  if (report.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of report.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function readinessMarker(status: EngineReadinessReport["claimClasses"][number]["status"]): string {
  switch (status) {
    case "ready":
      return "READY";
    case "degraded":
      return "PARTIAL";
    case "planned":
      return "PLAN";
    case "blocked":
      return "BLOCK";
  }
}

function printEngineCapabilityGroup(
  title: string,
  capabilities: EngineManifest["capabilities"]
): void {
  if (capabilities.length === 0) {
    return;
  }

  console.log("");
  console.log(`${title}:`);
  for (const capability of capabilities) {
    const trust = capability.canMintTrust ? capability.strongestTrust : "no direct trust";
    console.log(`  ${capability.displayName}`);
    console.log(`    Status: ${capability.status}; lane: ${capability.lane}; role: ${capability.role}; strongest: ${trust}`);
    console.log(
      `    Determinism: ${capability.determinism.determinismClass}; primitive: ${capability.determinism.primitiveSemantics}`
    );
    if (capability.command) {
      console.log(`    Route: ${capability.command}`);
    }
    if (capability.version) {
      console.log(`    Version: ${capability.version}`);
    }
    console.log(`    Boundary: ${capability.trustBoundary}`);
    if (capability.nextStep) {
      console.log(`    Next: ${capability.nextStep}`);
    }
  }
}

function printEngineVerificationReport(
  report: EngineVerificationReport,
  writeResult?: EngineVerificationRunWriteResult
): void {
  console.log("Truth Harness engine verification");
  console.log(`Status: ${report.status}`);
  console.log(`Concrete evidence gates: ${report.concretePassed}/${report.concreteTotal}`);
  console.log(`Required gates: ${report.requiredPassed}/${report.requiredTotal}`);
  console.log(`Evidence records earned in-memory: ${report.evidenceMinted}`);
  console.log(`Network: ${report.networkAccess}`);
  if (writeResult) {
    console.log(`Saved run: ${writeResult.record.runId}`);
    console.log(`Workspace JSON: ${writeResult.jsonPath}`);
    console.log(`Workspace Markdown: ${writeResult.markdownPath}`);
  }

  console.log("");
  console.log("Engine gates:");
  for (const item of report.cases) {
    const marker = item.status === "passed" ? "PASS" : item.status === "missing" ? "MISS" : item.status === "not-required" ? "SKIP" : "FAIL";
    const required = item.required ? " required" : "";
    console.log(`  [${marker}] ${item.displayName}${required}`);
    console.log(`    Trust: ${item.trust}; evidence: ${engineVerificationCaseEvidenceTier(item)}`);
    console.log(`    Reviewer meaning: ${engineVerificationCaseEvidenceMeaning(item)}`);
    console.log(`    ${item.summary}`);
    console.log(`    Command: ${item.command}`);
    if (item.evidence?.backendVersion) {
      console.log(`    Backend: ${item.evidence.backendId} (${item.evidence.backendVersion})`);
    } else if (item.evidence?.backendId) {
      console.log(`    Backend: ${item.evidence.backendId}`);
    }
  }

  console.log("");
  console.log("Docker routes:");
  console.log(`  Core no-network: ${report.docker.coreCommand}`);
  console.log(`  Professor evidence: ${report.docker.professorCommand}`);
  console.log(`  Lean fixture: ${report.docker.leanCommand}`);
  console.log(`  Verify image: ${report.docker.verifyImageCommand}`);

  console.log("");
  console.log("Trust boundary:");
  console.log("  Status probes do not mint evidence.");
  console.log("  Concrete Maxima, Z3, and Lean runs can mint only their scoped labels.");
  console.log("  Sage direct CAS checks are constrained; engine readiness keeps Sage optional until a pinned fixture exists.");
  console.log("  Every claim still needs a replayable receipt, proof, SMT, CAS, or source artifact.");

  if (report.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of report.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printEngineVerificationRuns(runs: EngineVerificationRunSummary[]): void {
  console.log("Truth Harness engine evidence runs");
  if (runs.length === 0) {
    console.log("No saved engine evidence runs found.");
    console.log("Run `truth-harness engines verify --write` from an initialized workspace.");
    return;
  }

  for (const run of runs) {
    console.log("");
    console.log(`${run.runId} (${run.status})`);
    console.log(`  Created: ${run.createdAt}`);
    console.log(`  Concrete gates: ${run.concretePassed}/${run.concreteTotal}; required: ${run.requiredPassed}/${run.requiredTotal}`);
    console.log(`  Evidence minted: ${run.evidenceMinted}`);
    console.log(`  Path: ${run.path}`);
    console.log(`  ${run.summary}`);
  }
}

function engineVerificationReplayCommand(options: {
  workspace: string;
  timeoutMs: number;
  maximaCommand?: string;
  sageCommand?: string;
  leanCommand?: string;
  z3Command?: string;
  cvc5Command?: string;
  smtSource: string;
  leanSource: string;
  write?: boolean;
  requireMaxima?: boolean;
  requireZ3?: boolean;
  requireCvc5?: boolean;
  requireLean?: boolean;
  requireSage?: boolean;
  requireDockerCore?: boolean;
  requireAllConcrete?: boolean;
  requireAllEngines?: boolean;
}): string {
  const args = ["truth-harness", "engines", "verify"];
  if (options.write) {
    args.push("--write");
  }
  if (options.workspace !== ".") {
    args.push("--workspace", options.workspace);
  }
  args.push("--timeout-ms", String(options.timeoutMs));
  if (options.maximaCommand) {
    args.push("--maxima-command", options.maximaCommand);
  }
  if (options.sageCommand) {
    args.push("--sage-command", options.sageCommand);
  }
  if (options.leanCommand) {
    args.push("--lean-command", options.leanCommand);
  }
  if (options.z3Command) {
    args.push("--z3-command", options.z3Command);
  }
  if (options.cvc5Command) {
    args.push("--cvc5-command", options.cvc5Command);
  }
  if (options.smtSource !== "docs/examples/constraints.smt2") {
    args.push("--smt-source", options.smtSource);
  }
  if (options.leanSource !== "docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean") {
    args.push("--lean-source", options.leanSource);
  }
  if (options.requireMaxima) {
    args.push("--require-maxima");
  }
  if (options.requireZ3) {
    args.push("--require-z3");
  }
  if (options.requireCvc5) {
    args.push("--require-cvc5");
  }
  if (options.requireLean) {
    args.push("--require-lean");
  }
  if (options.requireSage) {
    args.push("--require-sage");
  }
  if (options.requireDockerCore) {
    args.push("--require-docker-core");
  }
  if (options.requireAllConcrete) {
    args.push("--require-all-concrete");
  }
  if (options.requireAllEngines) {
    args.push("--require-all-engines");
  }
  return args.map(shellQuote).join(" ");
}

function engineRequirementsFromOptions(options: EngineRequirementOptions): EngineVerificationRequirements {
  return {
    maxima: Boolean(
      options.requireMaxima || options.requireDockerCore || options.requireAllConcrete || options.requireAllEngines
    ),
    z3: Boolean(options.requireZ3 || options.requireDockerCore || options.requireAllConcrete || options.requireAllEngines),
    cvc5: Boolean(options.requireCvc5 || options.requireAllEngines),
    lean: Boolean(options.requireLean || options.requireAllConcrete || options.requireAllEngines),
    sage: Boolean(options.requireSage || options.requireAllEngines)
  };
}

function parentCliStringOption(name: string, value: string | undefined): string | undefined {
  const source = engines.getOptionValueSource(name);
  return source !== undefined && source !== "default" ? value : undefined;
}

async function createRunNextReviewFromOptions(path: string, options: RunNextSourceOptions): Promise<WorkspaceReview> {
  if (options.source === "workspace-review") {
    return createWorkspaceReview({
      rootPath: path,
      maxRoutes: options.maxRoutes,
      maxClaims: options.maxClaims,
      maxSessions: options.maxSessions,
      maxReports: options.maxReports
    });
  }

  if (options.source === "credibility-actions") {
    const pack = await createCredibilityPack({
      rootPath: path,
      maxRoutes: options.maxRoutes,
      maxClaims: options.maxClaims,
      maxSessions: options.maxSessions,
      maxReports: options.maxReports,
      timeoutMs: options.timeoutMs,
      maximaCommand: options.maximaCommand,
      sageCommand: options.sageCommand,
      leanCommand: options.leanCommand,
      z3Command: options.z3Command,
      cvc5Command: options.cvc5Command,
      smtSourcePath: options.smtSource,
      leanSourcePath: options.leanSource,
      engineRequirements: engineRequirementsFromOptions(options)
    });
    return createWorkspaceReviewFromCredibilityPack({ rootPath: path, pack });
  }

  throw new Error(`Unsupported run-next source ${JSON.stringify(options.source)}. Use workspace-review or credibility-actions.`);
}

interface EngineRequirementOptions {
  requireMaxima?: boolean;
  requireZ3?: boolean;
  requireCvc5?: boolean;
  requireLean?: boolean;
  requireSage?: boolean;
  requireDockerCore?: boolean;
  requireAllConcrete?: boolean;
  requireAllEngines?: boolean;
}

interface RunNextSourceOptions extends EngineRequirementOptions {
  source: string;
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
  smtSource?: string;
  leanSource?: string;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/u.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function printCasBackendStatus(status: CasBackendStatusReport): void {
  console.log("Truth Harness CAS backends");
  console.log(`Local-only: ${String(status.localOnly)} (network: ${status.networkAccess})`);
  console.log(`Independent CAS backends available: ${status.casBackendsAvailable}`);

  for (const backend of status.backends) {
    console.log("");
    console.log(`${backend.displayName} (${backend.backendId})`);
    console.log(`  Status: ${backend.status}`);
    console.log(`  Adapter: ${backend.adapter}`);
    console.log(`  Command: ${backend.command} ${backend.args.join(" ")}`);
    if (backend.version) {
      console.log(`  Version: ${backend.version}`);
    }
    if (backend.error) {
      console.log(`  Error: ${backend.error}`);
    }
    console.log(`  Can check symbolic equality: ${String(backend.canCheckSymbolic)}`);
    console.log(`  Status probe minted check: ${String(backend.statusProbeMintedCheck)}`);
    for (const limitation of backend.limitations) {
      console.log(`  Limitation: ${limitation}`);
    }
  }

  console.log("");
  console.log("Trust boundary:");
  for (const warning of status.warnings) {
    console.log(`  ${warning}`);
  }
}

function printSymbolicCasCheck(
  record: SymbolicCasCheckRecord,
  outPath?: string,
  workspaceWrite?: SymbolicCasCheckWriteResult
): void {
  console.log(`CAS check ${record.checkId}`);
  console.log(`Status: ${record.status}`);
  console.log(`Trust: ${record.trust}`);
  console.log(`Backend: ${record.backend.displayName}${record.backend.version ? ` (${record.backend.version})` : ""}`);
  console.log(`Operation: ${record.operation}`);
  console.log(`Expression: ${record.expression}`);
  console.log(`Result: ${record.result}`);
  console.log(`Variable: ${record.variable}`);
  console.log(`Proof-checker backed: ${String(record.proofCheckerBacked)}`);
  console.log(`Replay: ${record.replay}`);

  if (record.residual) {
    console.log(`Residual: ${record.residual}`);
  }
  if (record.error) {
    console.log(`Error: ${record.error}`);
  }
  for (const limitation of record.limitations) {
    console.log(`Limitation: ${limitation}`);
  }
  for (const warning of record.warnings) {
    console.log(`Warning: ${warning}`);
  }
  if (outPath) {
    console.log(`Wrote JSON: ${outPath}`);
  }
  if (workspaceWrite) {
    console.log(`Workspace JSON: ${workspaceWrite.jsonPath}`);
    console.log(`Workspace Markdown: ${workspaceWrite.markdownPath}`);
  }
}

function printSymbolicCasCheckList(checks: SymbolicCasCheckSummary[]): void {
  console.log(`Truth Harness CAS checks: ${checks.length}`);

  for (const check of checks) {
    console.log("");
    console.log(`${check.checkId} ${check.createdAt}`);
    console.log(`  ${check.operation} ${check.expression} -> ${check.result}`);
    console.log(`  Status: ${check.status}; trust: ${check.trust}; backend: ${check.backendId}`);
    console.log(`  Path: ${check.path}`);
    if (check.warnings.length > 0) {
      console.log(`  Warnings: ${check.warnings.join("; ")}`);
    }
  }
}

function printProofBackendStatus(status: ProofBackendStatusReport): void {
  console.log("Truth Harness proof backends");
  console.log(`Local-only: ${String(status.localOnly)} (network: ${status.networkAccess})`);
  console.log(`Accepted proof checkers available: ${status.proofCheckersAvailable}`);

  for (const backend of status.backends) {
    console.log("");
    console.log(`${backend.displayName} (${backend.backendId})`);
    console.log(`  Status: ${backend.status}`);
    console.log(`  Adapter: ${backend.adapter}`);
    console.log(`  Command: ${backend.command} ${backend.args.join(" ")}`);
    if (backend.version) {
      console.log(`  Version: ${backend.version}`);
    }
    if (backend.error) {
      console.log(`  Error: ${backend.error}`);
    }
    console.log(`  Can check proofs: ${String(backend.canCheckProofs)}`);
    console.log(`  Status probe minted proof: ${String(backend.statusProbeMintedProof)}`);
    for (const limitation of backend.limitations) {
      console.log(`  Limitation: ${limitation}`);
    }
  }

  console.log("");
  console.log("Trust boundary:");
  for (const warning of status.warnings) {
    console.log(`  ${warning}`);
  }
}

function printLeanProjectInspection(inspection: LeanProjectInspection): void {
  console.log("Truth Harness Lean project inspection");
  console.log(`Path: ${inspection.projectPath}`);
  console.log(`Readiness: ${inspection.readiness}`);
  console.log("Local-only: true (network: none)");

  console.log("");
  console.log("Project files:");
  console.log(`  lean-toolchain: ${inspection.files.leanToolchain?.path ?? "missing"}`);
  console.log(`  lakefile.lean: ${inspection.files.lakefileLean?.path ?? "missing"}`);
  console.log(`  lakefile.toml: ${inspection.files.lakefileToml?.path ?? "missing"}`);
  console.log(`  lake-manifest.json: ${inspection.files.lakeManifest?.path ?? "missing"}`);
  console.log(`  .lean files: ${inspection.files.leanFiles.total}${inspection.files.leanFiles.truncated ? " (sample truncated)" : ""}`);

  if (inspection.toolchain) {
    console.log("");
    console.log("Toolchain:");
    console.log(`  Channel: ${inspection.toolchain.channel}`);
    console.log(`  Pinned: ${String(inspection.toolchain.pinned)}`);
  }

  if (inspection.mathlib.likelyUsesMathlib) {
    console.log("");
    console.log(`Mathlib: likely (${inspection.mathlib.evidence.join(", ")})`);
  }

  if (inspection.files.leanFiles.sample.length > 0) {
    console.log("");
    console.log("Lean file sample:");
    for (const file of inspection.files.leanFiles.sample.slice(0, 8)) {
      console.log(`  ${file.path} (${file.byteLength} bytes)`);
    }
  }

  console.log("");
  console.log("Trust boundary:");
  console.log("  This inspection does not run Lean or prove a claim.");
  console.log("  `proved` still requires a concrete accepted proof-check record.");

  if (inspection.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of inspection.warnings) {
      console.log(`  ${warning}`);
    }
  }

  if (inspection.nextActions.length > 0) {
    console.log("");
    console.log("Next actions:");
    for (const action of inspection.nextActions) {
      console.log(`  ${action}`);
    }
  }
}

function printLeanProofCheck(
  record: LeanProofCheckRecord,
  outPath?: string,
  workspaceWrite?: LeanProofCheckWriteResult
): void {
  console.log(`Lean proof check ${record.checkId}`);
  console.log(`Status: ${record.status}`);
  console.log(`Trust: ${record.trust}`);
  console.log(`Backend: ${record.backend.displayName}${record.backend.version ? ` (${record.backend.version})` : ""}`);
  console.log(`Source: ${record.source.path}`);
  if (record.source.declarationName) {
    console.log(`Declaration: ${record.source.declarationName}`);
  }
  if (record.scope) {
    console.log(`Scope route: ${record.scope.routeId ?? "n/a"}`);
    console.log(`Scope obligation: ${record.scope.obligationId ?? "n/a"}`);
    if (record.scope.statementHash) {
      console.log(`Scope statement hash: ${record.scope.statementHash}`);
    }
  }
  console.log(`Proof-checker backed: ${String(record.proofCheckerBacked)}`);
  console.log(`Replay: ${record.replay}`);

  if (record.error) {
    console.log(`Error: ${record.error}`);
  }

  if (record.stderr) {
    console.log(`Stderr: ${record.stderr}`);
  }

  if (record.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of record.warnings) {
      console.log(`  ${warning}`);
    }
  }

  if (outPath) {
    console.log("");
    console.log(`Wrote proof-check JSON: ${outPath}`);
  }

  if (workspaceWrite) {
    console.log("");
    console.log(`Wrote proof-check JSON: ${workspaceWrite.jsonPath}`);
    console.log(`Wrote proof-check Markdown: ${workspaceWrite.markdownPath}`);
  }
}

function printLeanProofCheckList(checks: LeanProofCheckSummary[]): void {
  console.log(`Truth Harness proof checks: ${checks.length}`);

  for (const check of checks) {
    console.log("");
    console.log(`${check.checkId} ${check.createdAt}`);
    console.log(`  Source: ${check.sourcePath}`);
    if (check.declarationName) {
      console.log(`  Declaration: ${check.declarationName}`);
    }
    console.log(`  Status: ${check.status}`);
    console.log(`  Trust: ${check.trust}`);
    console.log(`  Proof-checker backed: ${String(check.proofCheckerBacked)}`);
    console.log(`  Path: ${check.path}`);
  }
}

function printSmtBackendStatus(status: SmtBackendStatusReport): void {
  console.log("Truth Harness SMT backends");
  console.log(`SMT solvers available: ${status.smtSolversAvailable}`);
  console.log("");

  for (const backend of status.backends) {
    console.log(`${backend.displayName} (${backend.backendId})`);
    console.log(`  Status: ${backend.status}`);
    console.log(`  Adapter: ${backend.adapter}`);
    console.log(`  Command: ${backend.command} ${backend.args.join(" ")}`);
    if (backend.version) {
      console.log(`  Version: ${backend.version}`);
    }
    if (backend.error) {
      console.log(`  Error: ${backend.error}`);
    }
    console.log(`  Can check SMT: ${String(backend.canCheckSmt)}`);
    console.log(`  Status probe minted check: ${String(backend.statusProbeMintedCheck)}`);
    for (const limitation of backend.limitations) {
      console.log(`  Limitation: ${limitation}`);
    }
    console.log("");
  }

  console.log("Trust boundary:");
  for (const warning of status.warnings) {
    console.log(`  ${warning}`);
  }
}

function printSmtCheck(record: SmtCheckRecord, outPath?: string, workspaceWrite?: SmtCheckWriteResult): void {
  console.log(`SMT check ${record.checkId}`);
  console.log(`Status: ${record.status}`);
  console.log(`Trust: ${record.trust}`);
  console.log(`Backend: ${record.backend.displayName}${record.backend.version ? ` (${record.backend.version})` : ""}`);
  console.log(`Source: ${record.source.path}`);
  if (record.source.queryName) {
    console.log(`Query: ${record.source.queryName}`);
  }
  console.log(`Proof-checker backed: ${String(record.proofCheckerBacked)}`);
  console.log(`Replay: ${record.replay}`);

  if (record.error) {
    console.log(`Error: ${record.error}`);
  }

  if (record.stderr) {
    console.log(`Stderr: ${record.stderr}`);
  }

  printSmtModel(record);

  if (record.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of record.warnings) {
      console.log(`  ${warning}`);
    }
  }

  if (outPath) {
    console.log("");
    console.log(`Wrote SMT check JSON: ${outPath}`);
  }

  if (workspaceWrite) {
    console.log("");
    console.log(`Wrote SMT check JSON: ${workspaceWrite.jsonPath}`);
    console.log(`Wrote SMT check Markdown: ${workspaceWrite.markdownPath}`);
  }
}

function printSmtCheckList(checks: SmtCheckSummary[]): void {
  console.log(`Truth Harness SMT checks: ${checks.length}`);

  for (const check of checks) {
    console.log("");
    console.log(`${check.checkId} ${check.createdAt}`);
    console.log(`  Source: ${check.sourcePath}`);
    if (check.queryName) {
      console.log(`  Query: ${check.queryName}`);
    }
    console.log(`  Status: ${check.status}`);
    console.log(`  Trust: ${check.trust}`);
    console.log(`  Proof-checker backed: ${String(check.proofCheckerBacked)}`);
    console.log(`  Path: ${check.path}`);
  }
}

function printSmtProblemSolve(result: SmtProblemSolveResult): void {
  console.log(`SMT problem ${result.problem.problemId}`);
  if (result.problem.queryName) {
    console.log(`Query: ${result.problem.queryName}`);
  }
  console.log(`Logic: ${result.problem.logic}`);
  console.log(`Variables: ${result.problem.variables.map((variable) => `${variable.name}:${variable.sort}`).join(", ")}`);
  console.log(`Constraints: ${result.problem.constraints.length}`);
  console.log(`Source: ${result.sourceRef}`);
  console.log(`SMT check: ${result.check.record.checkId}`);
  console.log(`Status: ${result.check.record.status}`);
  console.log(`Trust: ${result.check.record.trust}`);
  console.log(`Proof-checker backed: ${String(result.check.record.proofCheckerBacked)}`);
  console.log(`Wrote SMT-LIB source: ${result.sourcePath}`);
  console.log(`Wrote SMT check JSON: ${result.check.jsonPath}`);
  console.log(`Wrote SMT check Markdown: ${result.check.markdownPath}`);

  printSmtModel(result.check.record);

  if (result.check.record.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of result.check.record.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printSmtModel(record: SmtCheckRecord): void {
  if (!record.model) {
    return;
  }

  console.log("");
  console.log("Model:");
  for (const binding of record.model.bindings) {
    console.log(`  ${binding.name}: ${binding.sort} = ${binding.value}`);
  }

  for (const warning of record.model.warnings) {
    console.log(`  Warning: ${warning}`);
  }
}

function formatProofBackendStatus(status: ProofBackendStatusReport["backends"][number]["status"]): string {
  if (status === "available") {
    return "ready  ";
  }

  if (status === "missing") {
    return "missing";
  }

  return "error  ";
}

function formatSmtBackendStatus(status: SmtBackendStatusReport["backends"][number]["status"]): string {
  if (status === "available") {
    return "ready  ";
  }

  if (status === "missing") {
    return "missing";
  }

  return "error  ";
}

function printReceipt(receipt: Receipt, outPath?: string): void {
  console.log(`Truth Harness receipt ${receipt.runId}`);
  console.log(`Trust: ${receipt.trust}`);
  console.log(`Privacy: ${receipt.privacy.mode} (network: ${receipt.privacy.networkAccess})`);
  console.log(`Summary: ${receipt.summary}`);
  console.log(`Replay: ${receipt.replay}`);
  console.log("");
  console.log("Evidence graph:");

  for (const node of receipt.graph.nodes) {
    console.log(`  ${node.id} ${node.kind} [${node.trust}] ${node.summary}`);
  }

  if (receipt.findings.length > 0) {
    console.log("");
    console.log("Findings:");
    for (const finding of receipt.findings) {
      console.log(`  ${finding.level}: ${finding.message}`);
    }
  }

  if (outPath) {
    console.log("");
    console.log(`Wrote receipt JSON: ${outPath}`);
  }
}

function printVerifierRoute(route: VerifierRoute, outPath?: string, workspaceWrite?: VerifierRouteWriteResult): void {
  const readiness = verifierRouteReadiness(route);
  console.log(`Truth Harness verifier route ${route.routeId}`);
  console.log(`Status: ${route.status}`);
  console.log(`Final trust: ${route.finalTrust}`);
  console.log(`Readiness: ${readiness.readyForNarrowClaim ? "ready" : "not-ready"} (${readiness.strongestTrust})`);
  console.log(`Readiness summary: ${readiness.summary}`);
  console.log(`Evidence kind: ${route.evidenceKind}`);
  console.log(`Receipt: ${route.receipt.runId}`);
  console.log(`Replay: ${route.replay}`);
  console.log(`Manifest: ${route.manifest.status} (${route.manifest.readyCount}/${route.manifest.totalCount} ready)`);
  console.log("");
  console.log("Used capabilities:");
  if (route.usedCapabilities.length === 0) {
    console.log("  none");
  } else {
    for (const step of route.usedCapabilities) {
      console.log(`  ${step.displayName} (${step.capabilityId}) - ${step.reason}`);
    }
  }

  if (route.gaps.length > 0) {
    console.log("");
    console.log("Verification gaps:");
    for (const gap of route.gaps) {
      console.log(`  ${gap.severity}: ${gap.displayName} - ${gap.reason}`);
      if (gap.nextStep) {
        console.log(`    Next: ${gap.nextStep}`);
      }
      if (gap.command) {
        console.log(`    Command: ${gap.command}`);
      }
    }
  }

  const proofObligations = route.proofObligations ?? [];
  if (proofObligations.length > 0) {
    console.log("");
    console.log("Proof obligations:");
    for (const obligation of proofObligations) {
      console.log(`  ${obligation.status}: ${obligation.title} (${obligation.kind})`);
      console.log(`    Required before: ${obligation.requiredBefore}`);
      if (obligation.nextStep) {
        console.log(`    Next: ${obligation.nextStep}`);
      }
      if (obligation.command) {
        console.log(`    Command: ${obligation.command}`);
      }
    }
  }

  console.log("");
  console.log("Next actions:");
  for (const action of route.nextActions) {
    console.log(`  ${action}`);
  }

  if (route.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of route.warnings.slice(0, 8)) {
      console.log(`  ${warning}`);
    }
  }

  if (outPath) {
    console.log("");
    console.log(`Wrote verifier route JSON: ${outPath}`);
  }

  if (workspaceWrite) {
    console.log("");
    console.log(`Wrote workspace verifier route JSON: ${workspaceWrite.jsonPath}`);
    console.log(`Wrote workspace verifier route Markdown: ${workspaceWrite.markdownPath}`);
  }
}

function printVerifierRouteList(routes: VerifierRouteSummary[]): void {
  console.log(`Truth Harness verifier routes: ${routes.length}`);

  for (const route of routes) {
    console.log("");
    console.log(`${route.routeId} ${route.createdAt}`);
    console.log(`  Trust: ${route.finalTrust}`);
    console.log(`  Status: ${route.status}`);
    console.log(`  Evidence: ${route.evidenceKind}`);
    console.log(`  Receipt: ${route.receiptRunId}`);
    console.log(`  Problem: ${singleLineSnippet(route.problem)}`);
    console.log(`  Used: ${route.usedCapabilities.length > 0 ? route.usedCapabilities.join(", ") : "none"}`);
    console.log(`  Gaps: ${route.gaps} (${route.criticalGaps} critical)`);
    console.log(`  Proof obligations: ${routeObligationSummary(route)}`);
    console.log(`  Readiness: ${route.readyForNarrowClaim ? "ready" : "not-ready"} (${route.strongestRouteTrust})`);
    console.log(`  Path: ${route.path}`);
  }
}

function routeObligationSummary(route: VerifierRouteSummary | VerifierRoute): string {
  let obligationCounts: {
    proofObligations: number;
    openProofObligations: number;
    criticalOpenProofObligations: number;
    satisfiedProofObligations: number;
    notRequiredProofObligations: number;
  };

  if (Array.isArray(route.proofObligations)) {
    obligationCounts = {
      proofObligations: route.proofObligations.length,
      openProofObligations: route.proofObligations.filter((obligation) => obligation.status === "open").length,
      criticalOpenProofObligations: route.proofObligations.filter(
        (obligation) => obligation.status === "open" && obligation.severity === "critical"
      ).length,
      satisfiedProofObligations: route.proofObligations.filter((obligation) => obligation.status === "satisfied").length,
      notRequiredProofObligations: route.proofObligations.filter((obligation) => obligation.status === "not-required").length
    };
  } else {
    const summary = route as VerifierRouteSummary;
    obligationCounts = {
      proofObligations: summary.proofObligations,
      openProofObligations: summary.openProofObligations,
      criticalOpenProofObligations: summary.criticalOpenProofObligations,
      satisfiedProofObligations: summary.satisfiedProofObligations,
      notRequiredProofObligations: summary.notRequiredProofObligations
    };
  }

  if (obligationCounts.proofObligations === 0) {
    return "none";
  }

  const parts = [
    `${obligationCounts.proofObligations} total`,
    obligationCounts.openProofObligations > 0 ? `${obligationCounts.openProofObligations} open` : undefined,
    obligationCounts.criticalOpenProofObligations > 0
      ? `${obligationCounts.criticalOpenProofObligations} critical-open`
      : undefined,
    obligationCounts.satisfiedProofObligations > 0
      ? `${obligationCounts.satisfiedProofObligations} satisfied`
      : undefined,
    obligationCounts.notRequiredProofObligations > 0
      ? `${obligationCounts.notRequiredProofObligations} not-required`
      : undefined
  ].filter(Boolean);

  return parts.join(" / ");
}

function printVerifierRouteSatisfaction(result: SatisfyVerifierRouteObligationResult): void {
  const readiness = verifierRouteReadiness(result.route);
  console.log(result.message);
  console.log(`Route: ${result.route.routeId}`);
  console.log(`Obligation: ${result.obligation.obligationId}`);
  console.log(`Status: ${result.obligation.status}`);
  console.log(`Evidence: ${result.evidence.kind}:${result.evidence.ref}`);
  console.log(`Evidence trust: ${result.evidence.trust ?? "unknown"}`);
  console.log(`Evidence schema: ${result.evidence.schemaVersion ?? "unknown"}`);
  console.log(`Proof obligations: ${routeObligationSummary(result.route)}`);
  console.log(`Readiness: ${readiness.readyForNarrowClaim ? "ready" : "not-ready"} (${readiness.strongestTrust})`);
  console.log("");
  console.log(`Wrote verifier route JSON: ${result.jsonPath}`);
  console.log(`Wrote verifier route Markdown: ${result.markdownPath}`);
  console.log("");
  console.log("Claim ledger follow-up:");
  console.log(
    `  truth-harness claim add ${quoteCommandArg(result.route.problem)} --evidence route:${result.route.routeId} --evidence ${result.evidence.kind}:${result.evidence.ref}`
  );
}

function printBenchmarkRun(run: BenchmarkRun, outPath?: string, workspaceWrite?: BenchmarkRunWriteResult): void {
  console.log(`${run.title} (${run.suiteId})`);
  console.log(`Passed: ${run.passed}/${run.total}`);
  console.log(`Trust accuracy: ${(run.trustAccuracy * 100).toFixed(1)}%`);
  console.log("");

  for (const result of run.results) {
    const status = result.passed ? "PASS" : "FAIL";
    const context = [
      result.task.category,
      result.task.expectEvidenceKind ? `expected ${result.task.expectEvidenceKind}` : undefined,
      `actual ${result.receipt.evidenceProfile.kind}`
    ].filter((part): part is string => Boolean(part));
    console.log(`${status} ${result.task.id}: ${result.receipt.trust} [${context.join("; ")}] - ${result.receipt.summary}`);

    for (const failure of result.failures) {
      console.log(`  ${failure}`);
    }
  }

  if (outPath) {
    console.log("");
    console.log(`Wrote benchmark JSON: ${outPath}`);
  }

  if (workspaceWrite) {
    console.log("");
    console.log(`Wrote workspace benchmark JSON: ${workspaceWrite.jsonPath}`);
    console.log(`Wrote workspace benchmark Markdown: ${workspaceWrite.markdownPath}`);
  }
}

function printBenchmarkComparison(
  comparison: BenchmarkComparisonRecord,
  outPath?: string,
  workspaceWrite?: BenchmarkComparisonWriteResult
): void {
  console.log(`Benchmark comparison ${comparison.comparisonId}`);
  console.log(`Verdict: ${comparison.verdict}`);
  console.log(`Suite: ${comparison.current.suiteId}`);
  console.log(`Passed delta: ${formatSigned(comparison.summary.passedDelta)}`);
  console.log(`Failed delta: ${formatSigned(comparison.summary.failedDelta)}`);
  console.log(`Trust accuracy delta: ${formatSignedPercent(comparison.summary.trustAccuracyDelta)}`);
  console.log(`Regressions: ${comparison.summary.regressions}`);
  console.log(`Improvements: ${comparison.summary.improvements}`);
  console.log(`Changed trust labels: ${comparison.summary.changedTrust}`);
  console.log(`Changed receipt hashes: ${comparison.summary.changedReceipts}`);
  console.log("");

  for (const entry of comparison.cases.filter((candidate) => candidate.status !== "unchanged-pass")) {
    console.log(`${entry.status.toUpperCase()} ${entry.taskId}`);
    if (entry.baseline) {
      console.log(`  baseline: ${entry.baseline.actualTrust}, passed=${String(entry.baseline.passed)}`);
    }
    if (entry.current) {
      console.log(`  current: ${entry.current.actualTrust}, passed=${String(entry.current.passed)}`);
    }
    for (const warning of entry.warnings) {
      console.log(`  ${warning}`);
    }
  }

  if (outPath) {
    console.log("");
    console.log(`Wrote benchmark comparison JSON: ${outPath}`);
  }

  if (workspaceWrite) {
    console.log("");
    console.log(`Wrote workspace benchmark comparison JSON: ${workspaceWrite.jsonPath}`);
    console.log(`Wrote workspace benchmark comparison Markdown: ${workspaceWrite.markdownPath}`);
  }
}

function printBenchmarkArtifactList(artifacts: BenchmarkArtifactSummary[]): void {
  console.log(`Truth Harness benchmark artifacts: ${artifacts.length}`);

  for (const artifact of artifacts) {
    console.log("");
    console.log(`${artifact.kind.toUpperCase()} ${artifact.artifactId} ${artifact.createdAt}`);
    console.log(`  Path: ${artifact.path}`);
    console.log(`  Suite: ${artifact.suiteId}`);
    console.log(`  Title: ${artifact.title}`);

    if (artifact.kind === "run") {
      console.log(`  Passed: ${artifact.passed}/${artifact.total}`);
      console.log(`  Failed: ${artifact.failed}`);
      console.log(`  Trust accuracy: ${((artifact.trustAccuracy ?? 0) * 100).toFixed(1)}%`);
    } else {
      console.log(`  Verdict: ${artifact.verdict}`);
      console.log(`  Baseline/current: ${artifact.baselineRunId} -> ${artifact.currentRunId}`);
    }

    if (artifact.warnings.length > 0) {
      console.log(`  Warnings: ${artifact.warnings.length}`);
    }
  }
}

function printReplayResult(replay: ReplayResult): void {
  const status = replay.passed ? "PASS" : "FAIL";
  console.log(`${status} replay ${replay.expectedRunId}`);
  console.log(`Expected trust: ${replay.expectedTrust}`);
  console.log(`Actual trust: ${replay.actualTrust}`);
  console.log(`Actual run: ${replay.actualRunId}`);

  if (replay.differences.length > 0) {
    console.log("");
    console.log("Differences:");
    for (const difference of replay.differences) {
      console.log(`  ${difference}`);
    }
  }
}

function printClaimFileChecks(results: ClaimFileCheck[]): void {
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const passed = results.reduce((sum, result) => sum + result.passed, 0);
  const failed = results.reduce((sum, result) => sum + result.failed, 0);

  console.log(`Truth Harness claim check: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`Failed: ${failed}`);
  }
  console.log("");

  for (const result of results) {
    console.log(`${result.filePath}: ${result.passed}/${result.total} passed`);

    for (const check of result.checks) {
      const status = check.passed ? "PASS" : "FAIL";
      console.log(
        `  ${status} L${check.block.startLine}: ${check.receipt.trust} - ${check.receipt.summary}`
      );
      console.log(`       ${check.message}`);
    }
  }
}

function printWorkspaceInit(result: LocalWorkspaceInitResult): void {
  const repaired = result.manifestRepair?.applied ? " and repaired manifest defaults" : "";
  console.log(result.created ? "Initialized Truth Harness workspace" : `Truth Harness workspace already exists${repaired}`);
  console.log(`Root: ${result.root}`);
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Privacy: ${result.manifest.privacy.mode} (network: ${result.manifest.privacy.networkAccess})`);
  printManifestRepair(result.manifestRepair);
  console.log("");
  console.log("Local directories:");

  for (const [name, directory] of Object.entries(result.manifest.directories)) {
    console.log(`  ${name.padEnd(10)} ${directory}`);
  }
}

function printWorkspaceStatus(status: LocalWorkspaceStatus): void {
  console.log("Truth Harness workspace status");
  console.log(`Root: ${status.root}`);
  console.log(`Manifest: ${status.manifestPath}`);

  if (!status.exists) {
    console.log("Status: missing");
    console.log("Next: truth-harness workspace init");
    return;
  }

  const manifest = status.manifest;
  if (!manifest) {
    throw new Error("Workspace status was marked ready but no manifest was loaded.");
  }

  console.log("Status: ready");
  console.log(`Project: ${manifest.displayName} (${manifest.projectId})`);
  console.log(`Privacy: ${manifest.privacy.mode} (network: ${manifest.privacy.networkAccess})`);
  printManifestRepair(status.manifestRepair);

  if (status.missingDirectories.length > 0) {
    console.log("");
    console.log("Missing directories:");
    for (const directory of status.missingDirectories) {
      console.log(`  ${directory}`);
    }
  }

  if (status.manifestRepair || status.missingDirectories.length > 0) {
    console.log("");
    console.log("Next: truth-harness workspace repair");
  }
}

function workspaceStatusHasProblems(status: LocalWorkspaceStatus): boolean {
  return status.exists && (status.missingDirectories.length > 0 || Boolean(status.manifestRepair));
}

function printReleaseAudit(audit: ReleaseAudit): void {
  console.log("Truth Harness release audit");
  console.log(`Status: ${audit.status}`);
  console.log(`Mode: ${audit.mode}`);
  console.log(`Professor ready: ${audit.professorReady ? "yes" : "no"}`);
  console.log(`Public launch ready: ${audit.publicLaunchReady ? "yes" : "no"}`);
  console.log(`Workspace: ${audit.workspacePath}`);
  if (audit.projectId) {
    console.log(`Project: ${audit.projectId}`);
  }
  console.log(
    `Checks: ${audit.summary.passedChecks} pass, ${audit.summary.warningChecks} warn, ` +
      `${audit.summary.failedChecks} fail (${audit.summary.blockingFailures} blocking)`
  );
  console.log(
    `Validation/catalog: ${audit.summary.validationPassed ? "passed" : "failed"} / ` +
      `${audit.summary.catalogFresh ? "fresh" : "stale-or-missing"}`
  );
  console.log(
    `Engines: ${audit.summary.concreteEngineGates} concrete, ${audit.summary.requiredEngineGates} required`
  );
  console.log(
    `Review queue: ${audit.summary.reviewItems} item(s), ${audit.summary.criticalReviewItems} critical`
  );
  console.log(
    `Research sessions: ${audit.summary.researchSessions} inspected, ${audit.summary.sessionContinuationItems} continuation item(s)`
  );
  console.log(`Code-run sandbox: ${audit.summary.sandboxAvailable ? "available" : "not measured"}`);

  const failed = audit.checks.filter((check) => check.status === "fail");
  const warnings = audit.checks.filter((check) => check.status === "warn");
  const passed = audit.checks.filter((check) => check.status === "pass");

  if (failed.length > 0) {
    console.log("");
    console.log("Blocking / failed checks:");
    for (const check of failed) {
      console.log(`  FAIL ${check.title}${check.blocking ? " (blocking)" : ""}`);
      console.log(`    ${check.summary}`);
      if (check.command) {
        console.log(`    ${check.command}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const check of warnings) {
      console.log(`  WARN ${check.title}`);
      console.log(`    ${check.summary}`);
      if (check.command) {
        console.log(`    ${check.command}`);
      }
    }
  }

  if (passed.length > 0) {
    console.log("");
    console.log("Passing checks:");
    for (const check of passed) {
      console.log(`  PASS ${check.title}: ${check.summary}`);
    }
  }

  if (audit.nextActions.length > 0) {
    console.log("");
    console.log("Next actions:");
    for (const action of audit.nextActions) {
      console.log(`  ${action}`);
    }
  }

  console.log("");
  console.log("Release commands:");
  console.log(`  ${audit.commands.releaseAudit}`);
  console.log(`  ${audit.commands.rebuildCatalog}`);
  console.log(`  ${audit.commands.credibilityPack}`);
  console.log(`  ${audit.commands.dockerEngines}`);
  console.log(`  ${audit.commands.dockerProof}`);
  console.log(`  ${audit.commands.dockerVerify}`);

  console.log("");
  console.log("Audit boundary:");
  for (const limitation of audit.limitations) {
    console.log(`  ${limitation}`);
  }
}

function printWorkspaceRepair(result: LocalWorkspaceRepairResult): void {
  console.log(result.repaired ? "Repaired Truth Harness workspace" : "Truth Harness workspace already healthy");
  console.log(`Root: ${result.root}`);
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Privacy: ${result.manifest.privacy.mode} (network: ${result.manifest.privacy.networkAccess})`);
  printManifestRepair(result.manifestRepair);

  if (result.createdDirectories.length > 0) {
    console.log("");
    console.log("Created directories:");
    for (const directory of result.createdDirectories) {
      console.log(`  ${directory}`);
    }
  }

  if (result.missingDirectoriesAfter.length > 0) {
    console.log("");
    console.log("Still missing:");
    for (const directory of result.missingDirectoriesAfter) {
      console.log(`  ${directory}`);
    }
  }
}

function printWorkspaceArtifactRepair(result: WorkspaceArtifactRepairResult): void {
  console.log(result.repaired ? "Repaired Truth Harness artifact metadata" : "Truth Harness artifact metadata already healthy");
  console.log(`Root: ${result.root}`);
  console.log(`Mode: ${result.dryRun ? "dry-run" : "write"}`);
  console.log(`Actions: ${result.actions.length}`);

  if (result.actions.length > 0) {
    console.log("");
    console.log("Artifact repairs:");
    for (const action of result.actions) {
      const status = action.applied ? "applied" : "planned";
      console.log(`  ${status.padEnd(7)} ${action.kind.padEnd(17)} ${action.path}`);
      console.log(`           ${action.changes.join(", ")}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Repair boundary:");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceArchive(result: WorkspaceArchiveResult): void {
  console.log("Truth Harness workspace archive complete");
  console.log(`Root: ${result.root}`);
  console.log(`Archive: ${result.archiveDir}`);
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Targets: ${result.targets.join(", ")}`);
  console.log(`Resolved directories: ${result.resolvedDirectories.join(", ")}`);

  if (result.entries.length > 0) {
    console.log("");
    console.log("Archived directories:");
    for (const entry of result.entries) {
      const action = entry.exists ? "copied" : "missing";
      console.log(
        `  ${action.padEnd(7)} ${entry.directory.padEnd(14)} ${entry.files} files, ${formatBytes(entry.bytes)} -> ${entry.archivePath}`
      );
    }
  }

  console.log("");
  console.log(`Archived: ${result.archivedFiles} files, ${formatBytes(result.archivedBytes)}`);

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Archive boundary:");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceArchiveList(result: WorkspaceArchiveListResult): void {
  console.log(`Truth Harness workspace archives: ${result.total}`);
  console.log(`Root: ${result.root}`);

  if (result.archives.length === 0) {
    console.log("No local archives found.");
  } else {
    console.log("");
    for (const archive of result.archives) {
      console.log(`${archive.archiveId} ${archive.createdAt}`);
      console.log(`  Path: ${archive.archiveDir}`);
      console.log(`  Reason: ${archive.reason}`);
      console.log(`  Targets: ${archive.targets.join(", ") || "unspecified"}`);
      console.log(`  Directories: ${archive.resolvedDirectories.join(", ")}`);
      console.log(`  Files: ${archive.totalFiles}, bytes: ${formatBytes(archive.totalBytes)}`);
      console.log(`  Restore preview: truth-harness workspace restore-archive ${archive.archiveId}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Archive boundary:");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceArchiveRestore(result: WorkspaceArchiveRestoreResult): void {
  console.log(result.dryRun ? "Truth Harness workspace archive restore preview" : "Truth Harness workspace archive restore complete");
  console.log(`Archive: ${result.archiveId}`);
  console.log(`Root: ${result.root}`);
  console.log(`Mode: ${result.dryRun ? "dry-run" : "restore confirmed"}`);
  console.log(`Overwrite: ${result.overwrite ? "allowed" : "blocked"}`);
  console.log(`Targets: ${result.targets.join(", ")}`);
  console.log(`Resolved directories: ${result.resolvedDirectories.join(", ")}`);

  if (result.entries.length > 0) {
    console.log("");
    console.log("Restore impact:");
    for (const entry of result.entries) {
      const action = result.dryRun ? "would copy" : entry.restored ? "copied" : entry.exists ? "empty" : "missing";
      console.log(
        `  ${action.padEnd(10)} ${entry.directory.padEnd(14)} ${entry.files} files, ${formatBytes(entry.bytes)}, conflicts ${entry.conflicts} -> ${entry.targetPath}`
      );
    }
  }

  if (result.conflicts.length > 0) {
    console.log("");
    console.log("Restore conflicts:");
    for (const conflict of result.conflicts) {
      console.log(`  ${conflict.reason.padEnd(13)} ${conflict.path}`);
      console.log(`    archive ${formatBytes(conflict.archiveBytes)} ${conflict.archiveSha256 || "no-hash"}`);
      if (conflict.liveBytes !== undefined || conflict.liveSha256) {
        console.log(`    live    ${formatBytes(conflict.liveBytes ?? 0)} ${conflict.liveSha256 ?? "unknown"}`);
      }
    }
  }

  if (!result.dryRun) {
    console.log("");
    console.log(`Restored: ${result.restoredFiles} files, ${formatBytes(result.restoredBytes)}`);
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Restore boundary:");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceClean(result: WorkspaceCleanResult): void {
  console.log(result.dryRun ? "Truth Harness workspace cleanup preview" : "Truth Harness workspace cleanup complete");
  console.log(`Root: ${result.root}`);
  console.log(`Mode: ${result.dryRun ? "dry-run" : "delete confirmed"}`);
  console.log(`Targets: ${result.targets.join(", ")}`);
  console.log(`Resolved directories: ${result.resolvedDirectories.join(", ")}`);

  if (result.entries.length > 0) {
    console.log("");
    console.log("Directory impact:");
    for (const entry of result.entries) {
      const action = result.dryRun ? "would clear" : entry.deleted ? "cleared" : "skipped";
      const preserved = entry.preserved.length > 0 ? `; preserved ${entry.preserved.join(", ")}` : "";
      console.log(
        `  ${action.padEnd(11)} ${entry.directory.padEnd(14)} ${entry.files} files, ${formatBytes(entry.bytes)}${preserved}`
      );
    }
  }

  if (!result.dryRun) {
    console.log("");
    console.log(`Deleted: ${result.deletedFiles} files, ${formatBytes(result.deletedBytes)}`);
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Safety notes:");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printManifestRepair(repair: LocalWorkspaceInitResult["manifestRepair"]): void {
  if (!repair || repair.addedDirectories.length === 0) {
    return;
  }

  console.log("");
  console.log(repair.applied ? "Manifest defaults repaired:" : "Manifest defaults need repair:");
  for (const directory of repair.addedDirectories) {
    console.log(`  ${directory}`);
  }
}

function printWorkspaceValidation(validation: WorkspaceValidation): void {
  console.log("Truth Harness workspace validation");
  console.log(`Status: ${validation.passed ? "passed" : "failed"}`);
  console.log(`Project: ${validation.projectId}`);
  console.log(`Checked: ${validation.summary.checkedFiles}`);
  console.log(`Valid: ${validation.summary.validFiles}`);
  console.log(`Invalid: ${validation.summary.invalidFiles}`);
  console.log(`Errors: ${validation.summary.errors}`);
  console.log(`Warnings: ${validation.summary.warnings}`);
  console.log(`Kinds: ${formatRecordCounts(validation.summary.byKind)}`);
  console.log(`Trust: ${formatRecordCounts(validation.summary.byTrust)}`);

  if (validation.issues.length > 0) {
    console.log("");
    console.log("Validation issues:");
    for (const issue of validation.issues) {
      console.log(`  ${issue.severity.toUpperCase()} ${issue.code} ${issue.path}`);
      console.log(`    ${issue.message}`);
    }
  }

  if (validation.warnings.length > 0) {
    console.log("");
    console.log("Validation boundary:");
    for (const warning of validation.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceCatalogRebuild(result: WorkspaceCatalogRebuildResult): void {
  console.log("Truth Harness catalog rebuild");
  console.log(`Status: ${result.validation.passed ? "indexed with valid workspace" : "indexed with validation issues"}`);
  console.log(`Workspace: ${result.workspacePath}`);
  console.log(`Catalog: ${result.catalogPath}`);
  console.log(`Schema: ${result.catalogSchemaVersion}`);
  console.log(`Artifacts: ${result.artifactCount} (${result.validArtifacts} valid, ${result.invalidArtifacts} invalid)`);
  console.log(`Claims/routes: ${result.claimCount}/${result.routeCount}`);
  console.log(`Tags/refs/FTS rows: ${result.tagCount}/${result.refCount}/${result.ftsRows}`);
  console.log(`Validation: ${result.validation.errors} errors, ${result.validation.warnings} warnings`);

  console.log("");
  console.log("Catalog boundary:");
  for (const warning of result.warnings) {
    console.log(`  ${warning}`);
  }
}

function printWorkspaceCatalogStatus(status: WorkspaceCatalogStatus): void {
  console.log("Truth Harness catalog status");
  console.log(`Workspace: ${status.workspacePath}`);
  console.log(`Catalog: ${status.catalogPath}`);
  console.log(`Exists: ${String(status.exists)}`);
  console.log(`Readable: ${String(status.readable)}`);
  console.log(`Stale: ${String(status.stale)}`);
  if (status.catalogSchemaVersion) {
    console.log(`Schema: ${status.catalogSchemaVersion}`);
  }
  if (status.lastRebuiltAt) {
    console.log(`Last rebuilt: ${status.lastRebuiltAt}`);
  }
  if (status.invalidation) {
    console.log(`Invalidated: ${status.invalidatedAt ?? "(unknown time)"}`);
    console.log(`Invalidation reason: ${status.invalidation.reason}`);
    if (status.invalidation.path) {
      console.log(`Invalidation path: ${status.invalidation.path}`);
    }
  }
  console.log(`Artifacts: ${status.artifactCount}`);
  console.log(`Claims/routes: ${status.claimCount}/${status.routeCount}`);
  console.log(`Freshness checked: ${String(status.freshness.checked)}`);
  if (status.freshness.checked) {
    console.log(
      `Freshness: ${status.freshness.changedArtifacts} changed, ${status.freshness.newArtifacts} new, ${status.freshness.missingArtifacts} missing`
    );
    if (status.freshness.examples.length > 0) {
      console.log(`Examples: ${status.freshness.examples.join(", ")}`);
    }
  }

  if (status.warnings.length > 0) {
    console.log("");
    console.log("Catalog boundary:");
    for (const warning of status.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceCatalogSearch(result: WorkspaceCatalogSearchResult): void {
  console.log("Truth Harness catalog search");
  console.log(`Workspace: ${result.workspacePath}`);
  console.log(`Query: ${result.query?.trim() || "(recent indexed artifacts)"}`);
  console.log(`Filters: ${formatDefinedRecord(result.filters)}`);
  console.log(`Results: ${result.total}`);

  if (result.results.length === 0) {
    console.log("");
    console.log("No catalog rows matched.");
  }

  for (const row of result.results) {
    console.log("");
    console.log(`${row.kind} ${row.artifactId ?? row.path}`);
    console.log(`  ${row.title ?? "(untitled)"}`);
    console.log(`  Path: ${row.path}`);
    console.log(`  Trust/status: ${row.trust ?? "none"}/${row.status ?? "unknown"}`);
    if (row.domain) {
      console.log(`  Domain: ${row.domain}`);
    }
    if (row.tags.length > 0) {
      console.log(`  Tags: ${row.tags.join(" ")}`);
    }
    if (!row.valid || row.issueCount > 0) {
      console.log(`  Validation: ${row.valid ? "valid" : "invalid"} (${row.issueCount} issues)`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Catalog boundary:");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceStress(result: WorkspaceStressResult): void {
  console.log("Truth Harness workspace stress");
  console.log(`Stress: ${result.stressId}`);
  console.log(`Workspace: ${result.workspacePath}`);
  console.log(`Local only: ${String(result.localOnly)} (network: ${result.networkAccess})`);
  console.log(
    `Generated: ${result.written.receipts}/${result.requested.receipts} receipts, ` +
      `${result.written.claims}/${result.requested.claims} claims, ` +
      `${result.written.routes}/${result.requested.routes} routes`
  );
  console.log(
    `Validation: ${result.validation.passed ? "passed" : "failed"} ` +
      `(${result.validation.errors} errors, ${result.validation.warnings} warnings, ${result.validation.checkedFiles} files)`
  );
  console.log(`Review queue: ${result.review.totalItems} items (${result.review.criticalItems} critical)`);
  console.log(`Graph: ${result.graph.nodes} nodes, ${result.graph.edges} edges, ${result.graph.missingRefs} missing refs`);
  console.log(`Claim graph: ${result.claimGraph.nodes} claims, ${result.claimGraph.edges} links`);
  console.log(
    `Timings ms: total ${result.timingsMs.total}, write ${result.timingsMs.writeReceipts + result.timingsMs.writeClaims + result.timingsMs.writeRoutes}, ` +
      `validate ${result.timingsMs.validate}, review ${result.timingsMs.review}, graph ${result.timingsMs.graph}`
  );

  if (result.sampleRefs.receipts.length > 0 || result.sampleRefs.claims.length > 0 || result.sampleRefs.routes.length > 0) {
    console.log("");
    console.log("Sample refs:");
    for (const receipt of result.sampleRefs.receipts) {
      console.log(`  receipt:${receipt}`);
    }
    for (const claim of result.sampleRefs.claims) {
      console.log(`  claim:${claim}`);
    }
    for (const route of result.sampleRefs.routes) {
      console.log(`  route:${route}`);
    }
  }

  console.log("");
  console.log("Next commands:");
  console.log(`  ${result.sampleCommands.validate}`);
  console.log(`  ${result.sampleCommands.review}`);
  console.log(`  ${result.sampleCommands.graph}`);
  console.log(`  ${result.sampleCommands.snapshot}`);

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Stress boundary:");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceReview(review: WorkspaceReview, writeResult?: WorkspaceReviewWriteResult): void {
  console.log("Truth Harness workspace review");
  console.log(`Review: ${review.reviewId}`);
  console.log(`Project: ${review.projectId}`);
  console.log(`Routes: ${review.summary.routes}`);
  console.log(`Claims: ${review.summary.claims}`);
  console.log(`Sessions: ${review.summary.sessions ?? 0}`);
  console.log(`Report drafts: ${review.summary.reportDrafts ?? 0}`);
  console.log(`Queue items: ${review.summary.totalItems}`);
  console.log(`Critical/high/medium/low: ${review.summary.criticalItems}/${review.summary.highItems}/${review.summary.mediumItems}/${review.summary.lowItems}`);
  console.log(`Privacy: ${review.privacy.mode} (network: ${review.networkAccess})`);
  console.log(`Autonomy: ${review.autonomy.mode} (unattended local work: ${review.autonomy.canRunUnattended ? "yes" : "no"})`);
  console.log(`Suggested batch: ${review.autonomy.suggestedBatchSize}`);
  if (review.autonomy.nextCommand) {
    console.log(`Next command: ${review.autonomy.nextCommand}`);
  }

  if (review.items.length === 0) {
    console.log("");
    console.log("No open workspace review items were found.");
  } else {
    console.log("");
    console.log("Ordered work queue:");
    for (const item of review.items) {
      console.log(`  ${item.priority.toUpperCase()} ${item.kind} ${item.itemId}`);
      console.log(`    ${item.title}`);
      console.log(`    ${item.summary}`);
      console.log(`    Source: ${item.source.label} ${item.source.ref}`);
      console.log(`    Command: ${item.command}`);
    }
  }

  console.log("");
  console.log("Autonomy stop conditions:");
  for (const condition of review.autonomy.stopConditions) {
    console.log(`  ${condition}`);
  }

  if (review.warnings.length > 0) {
    console.log("");
    console.log("Review boundary:");
    for (const warning of review.warnings) {
      console.log(`  ${warning}`);
    }
  }

  if (writeResult) {
    console.log("");
    console.log(`JSON: ${writeResult.jsonPath}`);
    console.log(`Markdown: ${writeResult.markdownPath}`);
  }
}

function printCredibilityPack(pack: CredibilityPack, writeResult?: CredibilityPackWriteResult): void {
  console.log("Truth Harness professor credibility pack");
  console.log(`Pack: ${pack.packId}`);
  console.log(`Status: ${pack.status}`);
  console.log(`Professor ready: ${pack.summary.professorReady ? "yes" : "no"}`);
  console.log(`Project: ${pack.projectId}`);
  console.log(`Privacy: ${pack.privacy.mode} (network: ${pack.networkAccess})`);
  console.log(
    `Validation: ${pack.summary.validationPassed ? "passed" : "failed"} ` +
      `(${pack.summary.validationErrors} errors, ${pack.summary.validationWarnings} warnings, ${pack.summary.checkedFiles} files)`
  );
  console.log(
    `Engines: ${pack.summary.engineStatus} ` +
      `(${pack.summary.concreteEngineGates} concrete, ${pack.summary.requiredEngineGates} required, ${pack.summary.engineEvidenceMinted} evidence)`
  );
  console.log(
    `Saved engine runs: ${pack.summary.savedEngineRuns}` +
      (pack.summary.latestStrictEngineRunStatus ? ` (latest strict reviewer: ${pack.summary.latestStrictEngineRunStatus})` : "")
  );
  console.log(
    `Adversarial benchmark: ${pack.summary.latestAdversarialBenchmarkStatus}` +
      (pack.summary.latestAdversarialBenchmarkAccuracy === undefined
        ? ""
        : ` (${(pack.summary.latestAdversarialBenchmarkAccuracy * 100).toFixed(1)}%)`) +
      `, saved runs: ${pack.summary.savedBenchmarkRuns}`
  );
  console.log(`Embedded snapshot: ${pack.embeddedSnapshot.snapshotId} (${pack.summary.snapshotFiles} files)`);
  console.log(`Review queue: ${pack.summary.reviewItems} items (${pack.summary.criticalReviewItems} critical, ${pack.summary.highReviewItems} high)`);
  console.log(
    `Reviewer action plan: ${pack.reviewerActionPlan.totalActions} actions ` +
      `(${pack.reviewerActionPlan.criticalActions} critical, ${pack.reviewerActionPlan.highActions} high)`
  );

  console.log("");
  console.log("Reviewer commands:");
  console.log(`  ${pack.reviewerCommands.validateWorkspace}`);
  console.log(`  ${pack.reviewerCommands.verifyEngines}`);
  console.log(`  ${pack.reviewerCommands.runAdversarialBenchmark}`);
  console.log(`  ${pack.reviewerCommands.reviewWorkspace}`);
  console.log(`  ${pack.reviewerCommands.reproducePack}`);

  if (pack.reviewerActionPlan.actions.length > 0) {
    console.log("");
    console.log("Reviewer action plan:");
    for (const item of pack.reviewerActionPlan.actions.slice(0, 6)) {
      console.log(`  ${item.priority.toUpperCase()} ${item.category}: ${item.title}`);
      console.log(`    closes ${item.closes.join(", ")}`);
      console.log(`    ${item.command}`);
    }
  }

  if (pack.workspaceReview.topItems.length > 0) {
    console.log("");
    console.log("Top open work:");
    for (const item of pack.workspaceReview.topItems.slice(0, 5)) {
      console.log(`  ${item.priority.toUpperCase()} ${item.kind}: ${item.title}`);
      console.log(`    ${item.command}`);
    }
  }

  if (pack.warnings.length > 0) {
    console.log("");
    console.log("Blocking warnings:");
    for (const warning of pack.warnings) {
      console.log(`  ${warning}`);
    }
  }

  if (writeResult) {
    console.log("");
    console.log(`JSON: ${writeResult.jsonPath}`);
    console.log(`Markdown: ${writeResult.markdownPath}`);
  }
}

function filterCredibilityActions(
  actions: CredibilityPackActionItem[],
  filters: { priority?: string; category?: string }
): CredibilityPackActionItem[] {
  return actions.filter((action) => {
    if (filters.priority && action.priority !== filters.priority) {
      return false;
    }
    if (filters.category && action.category !== filters.category) {
      return false;
    }
    return true;
  });
}

function printCredibilityActions(pack: CredibilityPack, actions: CredibilityPackActionItem[]): void {
  console.log("Truth Harness reviewer action queue");
  console.log(`Pack: ${pack.packId}`);
  console.log(`Status: ${pack.status}`);
  console.log(`Professor ready: ${pack.summary.professorReady ? "yes" : "no"}`);
  console.log(`Open actions: ${actions.length}`);

  if (actions.length === 0) {
    console.log("");
    console.log("No open reviewer actions were generated.");
    return;
  }

  console.log("");
  for (const action of actions) {
    console.log(`${action.priority.toUpperCase()} ${action.category} ${action.actionId}`);
    console.log(`  ${action.title}`);
    console.log(`  ${action.detail}`);
    console.log(`  Closes: ${action.closes.join(", ")}`);
    console.log(`  Command: ${action.command}`);
  }
}

function printCredibilityBundle(result: CredibilityBundleWriteResult): void {
  const manifest = result.manifest;
  console.log("Truth Harness portable reviewer bundle");
  console.log(`Bundle: ${manifest.bundleId}`);
  console.log(`Pack: ${manifest.packId}`);
  console.log(`Status: ${manifest.packStatus}`);
  console.log(`Professor ready: ${manifest.packSummary.professorReady ? "yes" : "no"}`);
  console.log(`Project: ${manifest.projectId}`);
  console.log(`Privacy: ${manifest.privacy.mode} (network: ${manifest.networkAccess})`);
  console.log(
    `Files: ${manifest.summary.totalFiles} total ` +
      `(${manifest.summary.artifactFiles} artifacts, ${manifest.summary.generatedFiles} generated, ${manifest.summary.totalBytes} bytes)`
  );
  if (manifest.summary.skippedBundleFiles > 0) {
    console.log(`Skipped prior bundle files: ${manifest.summary.skippedBundleFiles}`);
  }
  if (manifest.summary.reportDrafts > 0) {
    console.log(`Report drafts: ${manifest.summary.reportDrafts} (${manifest.summary.reportDraftFiles} files)`);
    for (const draft of manifest.reportDrafts.slice(0, 3)) {
      console.log(
        `  ${draft.reportId}: ${draft.title} ` +
          `(${draft.markdownVerified ? "Markdown hash verified" : "Markdown needs review"})`
      );
    }
  }

  console.log("");
  console.log("Reviewer commands:");
  console.log(`  ${manifest.reviewerCommands.verifyBundle}`);
  console.log(`  ${manifest.reviewerCommands.validateWorkspace}`);
  console.log(`  ${manifest.reviewerCommands.verifyEngines}`);
  console.log(`  ${manifest.reviewerCommands.runAdversarialBenchmark}`);
  console.log(`  ${manifest.reviewerCommands.reviewWorkspace}`);

  if (manifest.warnings.length > 0) {
    console.log("");
    console.log("Blocking warnings from pack:");
    for (const warning of manifest.warnings) {
      console.log(`  ${warning}`);
    }
  }

  console.log("");
  console.log(`Bundle directory: ${result.bundleDir}`);
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Pack JSON: ${result.packJsonPath}`);
  console.log(`Pack Markdown: ${result.packMarkdownPath}`);
  console.log(`README: ${result.readmePath}`);
}

function printCredibilityBundleVerification(verification: CredibilityBundleVerification): void {
  console.log("Truth Harness credibility bundle verification");
  console.log(`Verification: ${verification.verificationId}`);
  console.log(`Bundle: ${verification.bundleId}`);
  console.log(`Pack: ${verification.packId}`);
  console.log(`Bundle integrity: ${verification.passed ? "passed" : "failed"}`);
  console.log(`Source workspace: ${verification.sourceMatchesWorkspace ? "matches bundle" : "drifted"}`);
  console.log(`Checked bundle files: ${verification.checkedBundleFiles}`);
  console.log(`Checked source files: ${verification.checkedSourceFiles}`);

  if (verification.missingBundleFiles.length > 0 || verification.changedBundleFiles.length > 0) {
    console.log("");
    console.log("Bundle problems:");
    for (const item of verification.missingBundleFiles.slice(0, 8)) {
      console.log(`  missing ${item.path}`);
    }
    for (const item of verification.changedBundleFiles.slice(0, 8)) {
      console.log(`  changed ${item.path}`);
    }
  }

  if (verification.missingSourceFiles.length > 0 || verification.changedSourceFiles.length > 0) {
    console.log("");
    console.log("Source workspace drift:");
    for (const item of verification.missingSourceFiles.slice(0, 8)) {
      console.log(`  missing ${item.path}`);
    }
    for (const item of verification.changedSourceFiles.slice(0, 8)) {
      console.log(`  changed ${item.path}`);
    }
  }

  console.log("");
  console.log(`Bundle path: ${verification.bundlePath}`);
  for (const warning of verification.warnings) {
    console.log(`  ${warning}`);
  }
}

function printReportDraftList(reports: ReportDraftSummary[]): void {
  console.log("Truth Harness saved report drafts");
  console.log(`Reports: ${reports.length}`);
  if (reports.length === 0) {
    console.log("No saved report drafts found in .truth-harness/findings.");
    return;
  }

  for (const item of reports) {
    console.log("");
    console.log(`${item.report.reportId} - ${item.report.title}`);
    console.log(`  Created: ${item.report.createdAt || "not recorded"}`);
    console.log(`  Trust: ${item.report.trust ?? "unlabeled"}`);
    console.log(`  Receipt: ${item.report.receiptRunId ?? "not recorded"}`);
    console.log(`  Markdown: ${item.markdownStatus}${item.markdownSha256 ? ` (${item.markdownSha256})` : ""}`);
    console.log(`  JSON: ${item.paths.relativeJson}`);
    console.log(`  Markdown path: ${item.paths.relativeMarkdown}`);
  }
}

function printReportDraft(result: ReportDraftReadResult): void {
  console.log("Truth Harness saved report draft");
  console.log(`Report: ${result.report.reportId}`);
  console.log(`Title: ${result.report.title}`);
  console.log(`Created: ${result.report.createdAt || "not recorded"}`);
  console.log(`Trust: ${result.report.trust ?? "unlabeled"}`);
  console.log(`Receipt: ${result.report.receiptRunId ?? "not recorded"}`);
  console.log(`Claim: ${result.report.claimId ?? "not recorded"}`);
  console.log(`Markdown SHA-256: ${result.markdownSha256}`);
  console.log(`Markdown verified: ${result.markdownVerified ? "yes" : "no"}`);
  console.log(`JSON: ${result.paths.relativeJson}`);
  console.log(`Markdown: ${result.paths.relativeMarkdown}`);
  if (!result.markdownVerified) {
    console.log("Warning: saved Markdown does not match the report draft JSON sidecar.");
  }
  if (result.report.bundleVerificationIds.length > 0) {
    console.log(`Bundle verifications: ${result.report.bundleVerificationIds.join(", ")}`);
  }
  if (result.report.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of result.report.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceRunNextPlan(plan: WorkspaceRunNextPlan): void {
  console.log("Truth Harness workspace run-next");
  console.log(`Plan: ${plan.planId}`);
  console.log(`Review: ${plan.reviewId}`);
  console.log(`Mode: ${plan.mode}`);
  console.log(`Status: ${plan.status}`);
  console.log(`Dry run: ${String(plan.dryRun)}`);
  console.log(`Network: ${plan.networkAccess}`);

  if (plan.item) {
    console.log("");
    console.log(`Next item: ${plan.item.priority.toUpperCase()} ${plan.item.kind} ${plan.item.itemId}`);
    console.log(`  ${plan.item.title}`);
    if (plan.item.reportId) {
      console.log(`  Report: ${plan.item.reportId}`);
    }
    console.log(`  Command: ${plan.item.command}`);
  }

  console.log("");
  console.log(`Execution: ${plan.execution.status} (${plan.execution.kind})`);
  console.log(`  ${plan.execution.summary}`);
  if (plan.execution.evidenceRef) {
    console.log(`  Evidence: ${plan.execution.evidenceRef}`);
  }
  if (typeof plan.execution.attached === "boolean") {
    console.log(`  Attached: ${String(plan.execution.attached)}`);
  }

  console.log("");
  console.log("Stop conditions:");
  for (const condition of plan.stopConditions) {
    console.log(`  ${condition}`);
  }
}

function printWorkspaceRunNextList(plans: WorkspaceRunNextSummary[]): void {
  console.log(`Truth Harness workspace run-next plans: ${plans.length}`);

  for (const plan of plans) {
    console.log("");
    console.log(`${plan.planId} ${plan.createdAt}`);
    console.log(`  Path: ${plan.path}`);
    console.log(`  Review: ${plan.reviewId}`);
    console.log(`  Status: ${plan.status} (${plan.executionKind})`);
    console.log(`  Dry run: ${String(plan.dryRun)}`);
    console.log(`  Mode: ${plan.mode}`);
    if (plan.itemTitle) {
      console.log(`  Item: ${plan.itemPriority ?? "n/a"} ${plan.itemKind ?? "item"} - ${plan.itemTitle}`);
    }
  }
}

function printWorkspaceGraph(graph: WorkspaceGraph): void {
  console.log("Truth Harness workspace graph");
  console.log(`Project: ${graph.projectId}`);
  console.log(`Nodes: ${graph.summary.nodes}`);
  console.log(`Edges: ${graph.summary.edges}`);
  console.log(`Artifacts: ${graph.summary.artifacts}`);
  console.log(`Missing refs: ${graph.summary.missingRefs}`);
  console.log(`Validation: ${graph.validation.passed ? "passed" : "failed"} (${graph.validation.errors} errors, ${graph.validation.warnings} warnings)`);
  console.log(`Privacy: ${graph.privacy.mode} (network: ${graph.networkAccess})`);

  if (graph.edges.length > 0) {
    console.log("");
    console.log("Edges:");
    for (const edge of graph.edges.slice(0, 20)) {
      const status = edge.resolved ? "ok" : "missing";
      console.log(`  ${status} ${edge.kind} ${edge.refKind ? `${edge.refKind}:` : ""}${edge.ref}`);
      console.log(`    ${edge.sourcePath} ${edge.fieldPath}`);
    }
    if (graph.edges.length > 20) {
      console.log(`  ... ${graph.edges.length - 20} more edges`);
    }
  }

  if (graph.warnings.length > 0) {
    console.log("");
    console.log("Graph boundary:");
    for (const warning of graph.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceReviewList(reviews: WorkspaceReviewSummary[]): void {
  console.log(`Truth Harness workspace reviews: ${reviews.length}`);

  for (const review of reviews) {
    console.log("");
    console.log(`${review.reviewId} ${review.createdAt}`);
    console.log(`  Path: ${review.path}`);
    console.log(`  Queue items: ${review.totalItems}`);
    console.log(`  Critical/high/medium/low: ${review.criticalItems}/${review.highItems}/${review.mediumItems}/${review.lowItems}`);
    console.log(`  Privacy: ${review.privacy.mode} (network: ${review.networkAccess})`);
  }
}

function printVisualArtifactWrite(result: VisualArtifactWriteResult): void {
  console.log(`Wrote visual artifact ${result.visual.visualId}`);
  console.log(`${result.visual.title}`);
  console.log(`Kind/renderer/payload: ${result.visual.kind}/${result.visual.renderer.engine}/${result.visual.payload.format}`);
  console.log(`Sources: ${formatVisualSources(result.visual.sourceRefs)}`);
  console.log(`Tags: ${result.visual.tags.map((tag) => `#${tag}`).join(", ") || "none"}`);
  console.log(`Replay: ${result.visual.replayCommand}`);
  console.log("Trust boundary: visual evidence does not upgrade source trust labels.");
  console.log(`Wrote visual JSON: ${result.jsonPath}`);
  console.log(`Wrote visual Markdown: ${result.markdownPath}`);
}

function printVisualArtifactList(visuals: VisualArtifactSummary[]): void {
  console.log(`Truth Harness visual artifacts: ${visuals.length}`);

  for (const visual of visuals) {
    console.log("");
    console.log(`${visual.visualId} ${visual.createdAt}`);
    console.log(`  ${visual.title}`);
    console.log(`  Kind/renderer: ${visual.kind}/${visual.renderer}; path: ${visual.path}`);
    console.log(`  Sources: ${formatVisualSources(visual.sourceRefs)}`);
    console.log(`  Tags: ${visual.tags.map((tag) => `#${tag}`).join(", ") || "none"}`);
  }
}

function printVisualArtifact(visual: VisualArtifact): void {
  console.log(`${visual.visualId} ${visual.createdAt}`);
  console.log(visual.title);
  console.log(`Kind/renderer/payload: ${visual.kind}/${visual.renderer.engine}/${visual.payload.format}`);
  console.log(`Sources: ${formatVisualSources(visual.sourceRefs)}`);
  console.log(`Replay: ${visual.replayCommand}`);
  if (visual.data) {
    console.log(`Data rows: ${visual.data.rows.length}; columns: ${visual.data.columns.join(", ")}`);
  }

  console.log("");
  console.log("Trust boundary:");
  for (const warning of visual.warnings) {
    console.log(`  - ${warning}`);
  }
}

function formatVisualSources(refs: VisualArtifactSourceRef[]): string {
  return refs.length > 0 ? refs.map((ref) => `${ref.kind}:${ref.ref}`).join(", ") : "none";
}

function printWorkspaceSnapshotWrite(result: WorkspaceSnapshotWriteResult): void {
  console.log(`Wrote workspace snapshot ${result.snapshot.snapshotId}`);
  console.log(`Path: ${result.path}`);
  console.log(`Files: ${result.snapshot.summary.totalFiles}`);
  console.log(`Bytes: ${result.snapshot.summary.totalBytes}`);
  console.log(`Privacy: ${result.snapshot.privacy.mode} (network: ${result.snapshot.privacy.networkAccess})`);
  console.log(`Kinds: ${formatRecordCounts(result.snapshot.summary.byKind)}`);

  if (result.snapshot.warnings.length > 0) {
    console.log("");
    console.log("Snapshot warnings:");
    for (const warning of result.snapshot.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceSnapshotList(snapshots: WorkspaceSnapshotSummary[]): void {
  console.log(`Truth Harness workspace snapshots: ${snapshots.length}`);

  for (const snapshot of snapshots) {
    console.log("");
    console.log(`${snapshot.snapshotId} ${snapshot.createdAt}`);
    console.log(`  Path: ${snapshot.path}`);
    console.log(`  Files: ${snapshot.totalFiles}`);
    console.log(`  Bytes: ${snapshot.totalBytes}`);
    console.log(`  Kinds: ${formatRecordCounts(snapshot.byKind)}`);
  }
}

function printWorkspaceEvents(result: WorkspaceEventListResult): void {
  console.log(`Truth Harness workspace events: ${result.events.length} shown / ${result.total} total`);
  console.log(`Workspace: ${result.rootPath}`);
  console.log("Local-only audit trail; event entries do not upgrade trust labels.");

  for (const event of result.events) {
    const artifact = event.artifact ? ` sha256=${event.artifact.sha256.slice(0, 12)} bytes=${event.artifact.byteLength}` : "";
    console.log("");
    console.log(`${event.createdAt} ${event.eventId}`);
    console.log(`  Action: ${event.action}`);
    console.log(`  Actor: ${event.actor.kind}${event.actor.name ? `/${event.actor.name}` : ""}`);
    console.log(`  Artifact: ${event.kind ?? "unknown"} ${event.artifactId ?? "unknown"} ${event.path ?? "(no path)"}${artifact}`);
    if (event.summary) {
      console.log(`  Summary: ${event.summary}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Event warnings:");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printWorkspaceSnapshotVerification(verification: WorkspaceSnapshotVerification): void {
  console.log(`Workspace snapshot verification ${verification.snapshotId}`);
  console.log(`Status: ${verification.passed ? "passed" : "failed"}`);
  console.log(`Checked: ${verification.checked}`);
  console.log(`Changed: ${verification.changed.length}`);
  console.log(`Missing: ${verification.missing.length}`);
  console.log(`Added since snapshot: ${verification.addedSinceSnapshot.length}`);

  if (verification.changed.length > 0) {
    console.log("");
    console.log("Changed files:");
    for (const entry of verification.changed) {
      console.log(`  ${entry.path}`);
      console.log(`    expected ${entry.expectedSha256}`);
      console.log(`    actual   ${entry.actualSha256}`);
    }
  }

  if (verification.missing.length > 0) {
    console.log("");
    console.log("Missing files:");
    for (const entry of verification.missing) {
      console.log(`  ${entry.path}`);
    }
  }

  if (verification.addedSinceSnapshot.length > 0) {
    console.log("");
    console.log("Added files:");
    for (const entry of verification.addedSinceSnapshot) {
      console.log(`  ${entry.path}`);
    }
  }

  if (verification.warnings.length > 0) {
    console.log("");
    console.log("Verification warnings:");
    for (const warning of verification.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printSourceIngest(result: LocalCorpusIngestResult): void {
  console.log("Ingested local source corpus");
  console.log(`Index: ${result.indexPath}`);
  console.log(`Documents: ${result.totalDocuments}`);
  console.log(`Chunks: ${result.totalChunks}`);

  for (const document of result.ingestedDocuments) {
    console.log(`  ${document.documentId} ${document.path} (${document.chunkIds.length} chunks)`);
  }
}

function printSourceSearch(result: LocalCorpusSearchResult): void {
  console.log(`Local source search: ${result.hits.length}/${result.totalChunks} chunks`);
  console.log(`Query: ${result.query}`);

  for (const hit of result.hits) {
    console.log("");
    console.log(`${hit.chunkId} score=${hit.score.toFixed(3)} ${hit.path}`);
    console.log(`  ${hit.title}`);
    console.log(`  Terms: ${hit.matchedTerms.join(", ")}`);
    console.log(`  Citation: ${hit.citation.path}#${hit.citation.chunkId}`);
    console.log(`  ${singleLineSnippet(hit.text)}`);
  }
}

function printLiteratureRecordWrite(result: LiteratureRecordWriteResult): void {
  console.log(`Wrote literature record ${result.record.recordId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`Kind/status: ${result.record.kind}/${result.record.status}`);
  console.log(`Privacy: ${result.record.privacy.mode} (network: ${result.record.privacy.networkAccess})`);
  console.log(`Entailment review required: ${String(result.record.reviewBoundary.requiresEntailmentReview)}`);
  console.log("");
  console.log(result.record.title);

  if (result.record.identifiers.length > 0) {
    console.log("");
    console.log("Identifiers:");
    for (const identifier of result.record.identifiers) {
      console.log(`  ${identifier.kind}:${identifier.value}`);
    }
  }

  if (result.record.warnings.length > 0) {
    console.log("");
    console.log("Literature warnings:");
    for (const warning of result.record.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printLiteratureRecordList(records: LiteratureRecord[]): void {
  console.log(`Truth Harness literature records: ${records.length}`);

  for (const record of records) {
    console.log("");
    console.log(`${record.recordId} ${record.createdAt}`);
    console.log(`  ${record.title}`);
    console.log(`  Kind/status: ${record.kind}/${record.status}`);
    console.log(`  Identifiers: ${record.identifiers.map((identifier) => `${identifier.kind}:${identifier.value}`).join(", ") || "none"}`);
    console.log(`  Local refs: ${record.localRefs.length}; corpus refs: ${record.corpusRefs.length}`);
  }
}

function printNotebookRunWrite(result: NotebookRunWriteResult): void {
  console.log(`Wrote notebook run record ${result.record.runRecordId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`Kind/status: ${result.record.kind}/${result.record.status}`);
  console.log(`Privacy: ${result.record.privacy.mode} (network: ${result.record.privacy.networkAccess})`);
  console.log(`Workbench executed this run: ${String(!result.record.reproducibilityBoundary.executionNotPerformedByWorkbench)}`);
  console.log("");
  console.log(result.record.title);
  console.log(result.record.purpose);

  if (result.record.command) {
    console.log("");
    console.log(`Replay command: ${result.record.command}`);
  }

  if (result.record.metrics.length > 0) {
    console.log("");
    console.log("Metrics:");
    for (const metric of result.record.metrics) {
      console.log(`  ${formatNotebookRunValue(metric)}`);
    }
  }

  if (result.record.warnings.length > 0) {
    console.log("");
    console.log("Notebook-run warnings:");
    for (const warning of result.record.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printNotebookRunList(records: NotebookRunRecord[]): void {
  console.log(`Truth Harness notebook run records: ${records.length}`);

  for (const record of records) {
    console.log("");
    console.log(`${record.runRecordId} ${record.createdAt}`);
    console.log(`  ${record.title}`);
    console.log(`  Kind/status: ${record.kind}/${record.status}`);
    console.log(`  Notebook/code refs: ${record.notebookRefs.length}/${record.codeRefs.length}`);
    console.log(`  Output refs: ${record.outputRefs.length}`);
  }
}

function printCodeRunWrite(result: CodeRunWriteResult): void {
  console.log(`Wrote code run ${result.record.runId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`Status: ${result.record.execution.status}`);
  console.log(`Exit code: ${String(result.record.execution.exitCode)}`);
  console.log(`Command: ${result.record.replay.command}`);
  console.log(`Working directory: ${result.record.command.workingDirectory}`);
  console.log(`Policy: ${result.record.policy.mode} (${result.record.policy.detected.categories.join(", ") || "no guarded categories"})`);
  console.log(`Duration: ${result.record.execution.durationMs} ms`);

  if (result.record.stdout.text) {
    console.log(`Stdout: ${singleLineSnippet(result.record.stdout.text)}`);
  }

  if (result.record.stderr.text) {
    console.log(`Stderr: ${singleLineSnippet(result.record.stderr.text)}`);
  }

  if (result.record.warnings.length > 0) {
    console.log("");
    console.log("Code-run warnings:");
    for (const warning of result.record.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printCodeRunList(records: CodeRunSummary[]): void {
  console.log(`Truth Harness code runs: ${records.length}`);

  for (const record of records) {
    console.log("");
    console.log(`${record.runId} ${record.createdAt}`);
    console.log(`  ${record.title}`);
    console.log(`  Status: ${record.status}`);
    console.log(`  Exit code: ${String(record.exitCode)}`);
    console.log(`  Command: ${record.command}`);
    console.log(`  Path: ${record.path}`);
  }
}

function printClaimLedgerWrite(result: ClaimLedgerWriteResult): void {
  console.log(`Wrote claim ${result.claim.claimId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`Domain/status/trust: ${result.claim.domain}/${result.claim.status}/${result.claim.trust}`);
  console.log(`Ready for narrow claim: ${String(result.claim.finalization.readyForNarrowClaim)}`);
  console.log("");
  console.log(result.claim.title);
  console.log(result.claim.statement);

  if (result.claim.dependsOn.length > 0 || result.claim.supersedes.length > 0) {
    console.log("");
    console.log(`Depends on: ${result.claim.dependsOn.join(", ") || "none"}`);
    console.log(`Supersedes: ${result.claim.supersedes.join(", ") || "none"}`);
  }

  if (result.claim.finalization.openChecks.length > 0) {
    console.log("");
    console.log("Open checks:");
    for (const check of result.claim.finalization.openChecks) {
      console.log(`  ${check}`);
    }
  }
}

function printClaimLedgerList(
  claims: ClaimLedgerRecord[],
  graph: ReturnType<typeof createClaimLedgerGraph>
): void {
  console.log(`Truth Harness claim ledger: ${claims.length} claims, ${graph.edges.length} links`);

  for (const claim of claims) {
    console.log("");
    console.log(`${claim.claimId} ${claim.updatedAt}`);
    console.log(`  ${claim.title}`);
    console.log(`  Domain/status/trust: ${claim.domain}/${claim.status}/${claim.trust}`);
    console.log(`  Tags: ${claim.tags.map((tag) => `#${tag}`).join(", ") || "none"}`);
    console.log(`  Depends on: ${claim.dependsOn.join(", ") || "none"}`);
    console.log(`  Ready: ${String(claim.finalization.readyForNarrowClaim)}; open checks: ${claim.finalization.openChecks.length}`);
  }

  if (graph.warnings.length > 0) {
    console.log("");
    console.log("Graph warnings:");
    for (const warning of graph.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printClaimLedgerRecord(claim: ClaimLedgerRecord): void {
  console.log(`${claim.claimId} ${claim.updatedAt}`);
  console.log(claim.title);
  console.log("");
  console.log(claim.statement);
  console.log("");
  console.log(`Domain/status/trust: ${claim.domain}/${claim.status}/${claim.trust}`);
  console.log(`Ready for narrow claim: ${String(claim.finalization.readyForNarrowClaim)}`);
  console.log(`Tags: ${claim.tags.map((tag) => `#${tag}`).join(", ") || "none"}`);
  console.log(`Depends on: ${claim.dependsOn.join(", ") || "none"}`);
  console.log(`Supersedes: ${claim.supersedes.join(", ") || "none"}`);

  console.log("");
  console.log("Verification ladder:");
  for (const step of claim.verification) {
    console.log(`  ${step.stage}: ${step.status} - ${step.summary}`);
  }

  if (claim.finalization.openChecks.length > 0) {
    console.log("");
    console.log("Open checks:");
    for (const check of claim.finalization.openChecks) {
      console.log(`  ${check}`);
    }
  }
}

function printClaimReviewPacket(packet: ClaimReviewPacket): void {
  console.log(`Claim review ${packet.claimId}`);
  console.log(`Status: ${packet.reviewStatus}`);
  console.log(`Trust: ${packet.trust}`);
  console.log(`Ready for narrow claim: ${String(packet.readyForNarrowClaim)}`);
  console.log(`Decision: ${packet.decision}`);
  console.log("");
  console.log(packet.title);
  console.log(packet.statement);

  console.log("");
  console.log("Blocking checks:");
  if (packet.blockingChecks.length === 0) {
    console.log("  none");
  } else {
    for (const check of packet.blockingChecks) {
      console.log(`  ${check}`);
    }
  }

  console.log("");
  console.log("Verification ladder:");
  for (const step of packet.verification) {
    console.log(`  ${step.stage}: ${step.status} - ${step.summary}`);
  }

  console.log("");
  console.log("Next actions:");
  if (packet.nextActions.length === 0) {
    console.log("  none");
  } else {
    for (const action of packet.nextActions) {
      console.log(`  ${action.label}: ${action.reason}`);
      if (action.command) {
        console.log(`    Command: ${action.command}`);
      }
      if (action.commandTemplate) {
        console.log(`    Template: ${action.commandTemplate}`);
      }
    }
  }

  console.log("");
  console.log("Commands:");
  console.log(`  Show JSON: ${packet.commands.showJson}`);
  console.log(`  Review JSON: ${packet.commands.reviewJson}`);

  if (packet.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of packet.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printSimulationLogWrite(result: SimulationLogWriteResult): void {
  console.log(`Wrote simulation log ${result.entry.simulationId}`);
  console.log(`Path: ${result.path}`);
  console.log(`Kind: ${result.entry.kind}`);
  console.log(`Stage: ${result.entry.stage}`);
  console.log(`Engine: ${result.entry.engine}`);
  console.log(`Model: ${result.entry.modelName}`);
  console.log(`Privacy: ${result.entry.privacy.mode} (network: ${result.entry.privacy.networkAccess})`);
  console.log(`Simulation is not reality: ${String(result.entry.validationBoundary.simulationIsNotReality)}`);
  console.log("");
  console.log(result.entry.title);
  console.log(result.entry.question);

  if (result.entry.metrics.length > 0) {
    console.log("");
    console.log("Metrics:");
    for (const metric of result.entry.metrics) {
      console.log(`  ${formatSimulationScalar(metric)}`);
    }
  }

  if (result.entry.warnings.length > 0) {
    console.log("");
    console.log("Simulation warnings:");
    for (const warning of result.entry.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printSimulationLogList(entries: SimulationLogEntry[]): void {
  console.log(`Truth Harness simulation logs: ${entries.length}`);

  for (const entry of entries) {
    console.log("");
    console.log(`${entry.simulationId} ${entry.createdAt}`);
    console.log(`  ${entry.title}`);
    console.log(`  Kind/stage: ${entry.kind}/${entry.stage}`);
    console.log(`  Engine/model: ${entry.engine} / ${entry.modelName}`);
    console.log(`  Metrics: ${entry.metrics.length}`);
  }
}

function printExperimentLogWrite(result: ExperimentLogWriteResult): void {
  console.log(`Wrote experiment log ${result.entry.experimentId}`);
  console.log(`Path: ${result.path}`);
  console.log(`Kind: ${result.entry.kind}`);
  console.log(`Stage: ${result.entry.stage}`);
  console.log(`Outcome: ${result.entry.outcome.status}`);
  console.log(`Privacy: ${result.entry.privacy.mode} (network: ${result.entry.privacy.networkAccess})`);
  console.log(`Expert review required: ${String(result.entry.review.humanExpertReviewRequired)}`);
  console.log(`Regulatory approval claimed: ${String(!result.entry.validationBoundary.notRegulatoryApproval)}`);
  console.log("");
  console.log(result.entry.title);
  console.log(result.entry.question);

  if (result.entry.measurements.length > 0) {
    console.log("");
    console.log("Measurements:");
    for (const measurement of result.entry.measurements) {
      console.log(`  ${formatExperimentMeasurement(measurement)}`);
    }
  }

  if (result.entry.warnings.length > 0) {
    console.log("");
    console.log("Experiment warnings:");
    for (const warning of result.entry.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printExperimentLogList(entries: ExperimentLogEntry[]): void {
  console.log(`Truth Harness experiment logs: ${entries.length}`);

  for (const entry of entries) {
    console.log("");
    console.log(`${entry.experimentId} ${entry.createdAt}`);
    console.log(`  ${entry.title}`);
    console.log(`  Kind/stage/outcome: ${entry.kind}/${entry.stage}/${entry.outcome.status}`);
    console.log(`  Protocol refs: ${entry.protocolRefs.length}`);
    console.log(`  Data refs: ${entry.dataRefs.length}`);
  }
}

function printVaultSeal(result: VaultSealResult): void {
  console.log(`Wrote vault entry ${result.entry.vaultId}`);
  console.log(`Path: ${result.path}`);
  console.log(`Label: ${result.entry.label}`);
  console.log(`Privacy: ${result.entry.privacy.mode} (network: ${result.entry.privacy.networkAccess})`);
  console.log(`Encryption: ${result.entry.encryption.algorithm} with ${result.entry.encryption.kdf}`);
  console.log(`Key policy: ${result.entry.encryption.keyPolicy} (${result.entry.encryption.keyRef})`);
  console.log(`Ciphertext bytes: ${result.entry.ciphertextBytes}`);

  if (result.entry.warnings.length > 0) {
    console.log("");
    console.log("Vault warnings:");
    for (const warning of result.entry.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printVaultList(entries: VaultEnvelopeSummary[]): void {
  console.log(`Truth Harness vault entries: ${entries.length}`);

  for (const entry of entries) {
    console.log("");
    console.log(`${entry.vaultId} ${entry.createdAt}`);
    console.log(`  ${entry.label}`);
    console.log(`  Encryption: ${entry.encryption.algorithm}/${entry.encryption.kdf}`);
    console.log(`  Ciphertext bytes: ${entry.ciphertextBytes}`);
    console.log(`  Key policy: ${entry.encryption.keyPolicy}`);
  }
}

function printVaultVerify(result: VaultVerifyResult): void {
  console.log(`Verified vault entry ${result.entry.vaultId}`);
  console.log(`Label: ${result.entry.label}`);
  console.log(`Source: ${result.payload.sourceRef}`);
  console.log(`Plaintext bytes: ${result.payload.plaintextBytes}`);
  console.log(`Plaintext sha256: ${result.payload.plaintextSha256}`);
  console.log("Plaintext: not printed");
}

function printVaultOpen(result: VaultOpenResult, outputPath: string): void {
  console.log(`Opened vault entry ${result.entry.vaultId}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Source: ${result.payload.sourceRef}`);
  console.log(`Plaintext bytes: ${result.payload.plaintextBytes}`);
  console.log(`Plaintext sha256: ${result.payload.plaintextSha256}`);
}

function printEvidenceAudit(audit: EvidenceAudit): void {
  console.log(`Evidence audit ${audit.auditId}`);
  console.log(`Verdict: ${audit.verdict.status}`);
  console.log(`Privacy: ${audit.privacy.mode} (network: ${audit.privacy.networkAccess})`);
  console.log(`Claim types: ${audit.claimTypes.join(", ")}`);
  console.log(`Evidence: ${audit.evidenceSummary.resolved} resolved, ${audit.evidenceSummary.referenced} referenced, ${audit.evidenceSummary.missing} missing`);
  console.log("");
  console.log(audit.claim);
  console.log("");
  console.log(audit.verdict.summary);

  if (audit.reviews.length > 0) {
    console.log("");
    console.log("Evidence review:");
    for (const review of audit.reviews) {
      const trust = review.trust ? `/${review.trust}` : "";
      console.log(`  ${review.status} ${review.kind}:${review.ref} ${review.strength}${trust}`);
      console.log(`    ${review.summary}`);
    }
  }

  if (audit.overclaimWarnings.length > 0) {
    console.log("");
    console.log("Overclaim warnings:");
    for (const warning of audit.overclaimWarnings) {
      console.log(`  ${warning}`);
    }
  }

  if (audit.requiredNextChecks.length > 0) {
    console.log("");
    console.log("Required next checks:");
    for (const check of audit.requiredNextChecks) {
      console.log(`  ${check}`);
    }
  }
}

function printEvidenceAuditWrite(result: EvidenceAuditWriteResult): void {
  console.log(`Wrote evidence audit ${result.audit.auditId}`);
  console.log(`Path: ${result.path}`);
  printEvidenceAudit(result.audit);
}

function printEvidenceAuditReportWrite(result: EvidenceAuditReportWriteResult): void {
  console.log(`Wrote evidence audit report ${result.audit.auditId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  printEvidenceAudit(result.audit);
}

function printEvidenceAuditList(audits: EvidenceAudit[]): void {
  console.log(`Truth Harness evidence audits: ${audits.length}`);

  for (const audit of audits) {
    console.log("");
    console.log(`${audit.auditId} ${audit.createdAt}`);
    console.log(`  Verdict: ${audit.verdict.status}`);
    console.log(`  Claim types: ${audit.claimTypes.join(", ")}`);
    console.log(`  ${audit.title}`);
  }
}

function printValidationPlan(plan: ValidationPlan): void {
  console.log(`Validation plan ${plan.planId}`);
  console.log(`Readiness: ${plan.readiness.status}`);
  console.log(`Audit verdict: ${plan.audit.verdict.status}`);
  console.log(`Privacy: ${plan.privacy.mode} (network: ${plan.privacy.networkAccess})`);
  console.log(`Domains: ${plan.domains.join(", ")}`);
  console.log(`Gates: ${plan.readiness.satisfiedGateCount} satisfied, ${plan.readiness.inProgressGateCount} in progress, ${plan.readiness.missingGateCount} missing`);
  console.log("");
  console.log(plan.claim);
  console.log("");
  console.log(plan.recommendedClaimLanguage);

  const blocking = plan.gates.filter((gate) => gate.blocking && gate.status !== "satisfied" && gate.status !== "not-applicable");
  if (blocking.length > 0) {
    console.log("");
    console.log("Open blocking gates:");
    for (const gate of blocking) {
      console.log(`  ${gate.status} ${gate.kind}: ${gate.description}`);
      for (const check of gate.nextChecks.slice(0, 2)) {
        console.log(`    ${check}`);
      }
    }
  }

  if (plan.warnings.length > 0) {
    console.log("");
    console.log("Validation warnings:");
    for (const warning of plan.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printValidationPlanWrite(result: ValidationPlanWriteResult): void {
  console.log(`Wrote validation plan ${result.plan.planId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  printValidationPlan(result.plan);
}

function printValidationPlanList(plans: ValidationPlan[]): void {
  console.log(`Truth Harness validation plans: ${plans.length}`);

  for (const plan of plans) {
    console.log("");
    console.log(`${plan.planId} ${plan.createdAt}`);
    console.log(`  Readiness: ${plan.readiness.status}`);
    console.log(`  Audit verdict: ${plan.audit.verdict.status}`);
    console.log(`  ${plan.title}`);
  }
}

function printResearchSessionWrite(result: ResearchSessionWriteResult): void {
  console.log(`Wrote research session ${result.session.sessionId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`Domains: ${result.session.domains.join(", ")}`);
  console.log(`Privacy: ${result.session.privacy.mode} (network: ${result.session.privacy.networkAccess})`);
  console.log(`Hosted models: ${result.session.modelPolicy.hostedModels}`);
  console.log(`Evidence refs: ${result.session.evidenceRefs.length}`);
  console.log(`Tasks: ${result.session.tasks.length}`);
  console.log("");
  console.log(result.session.title);
  console.log(result.session.objective);

  if (result.session.reviewBoundary.reasons.length > 0) {
    console.log("");
    console.log("Review boundary:");
    for (const reason of result.session.reviewBoundary.reasons) {
      console.log(`  ${reason}`);
    }
  }

  if (result.session.warnings.length > 0) {
    console.log("");
    console.log("Session warnings:");
    for (const warning of result.session.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printResearchCheckpointWrite(result: ResearchSessionCheckpointWriteResult): void {
  console.log(`Wrote research checkpoint ${result.checkpoint.checkpointId}`);
  console.log(`Session: ${result.session.sessionId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`Evidence refs added: ${result.checkpoint.evidenceRefs.length}`);
  console.log(`Snapshot refs added: ${result.checkpoint.snapshotRefs.length}`);
  console.log("");
  console.log(result.checkpoint.summary);

  if (result.checkpoint.nextChecks.length > 0) {
    console.log("");
    console.log("Next checks:");
    for (const check of result.checkpoint.nextChecks) {
      console.log(`  ${check}`);
    }
  }
}

function printResearchTaskUpdate(result: ResearchSessionTaskUpdateWriteResult): void {
  console.log(`Updated research task ${result.task.taskId}`);
  console.log(`Session: ${result.session.sessionId}`);
  console.log(`Status: ${result.task.status}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log("");
  console.log(result.task.title);

  if (result.task.evidenceRefs.length > 0) {
    console.log("");
    console.log("Evidence refs:");
    for (const ref of result.task.evidenceRefs) {
      console.log(`  ${ref.kind}:${ref.ref}${ref.trust ? ` (${ref.trust})` : ""}`);
    }
  }

  if (result.task.nextChecks.length > 0) {
    console.log("");
    console.log("Next checks:");
    for (const check of result.task.nextChecks) {
      console.log(`  ${check}`);
    }
  }
}

function printResearchSession(session: ResearchSession): void {
  console.log(`Truth Harness research session ${session.sessionId}`);
  console.log(`Updated: ${session.updatedAt}`);
  console.log(`Domains: ${session.domains.join(", ")}`);
  console.log(`Privacy: ${session.privacy.mode} (network: ${session.privacy.networkAccess})`);
  console.log(`Hosted models: ${session.modelPolicy.hostedModels}`);
  console.log(`Evidence refs: ${session.evidenceRefs.length}`);
  console.log(`Snapshot refs: ${session.snapshotRefs.length}`);
  console.log(`Tasks: ${session.tasks.length}`);
  console.log(`Checkpoints: ${session.checkpoints.length}`);
  console.log("");
  console.log(session.title);
  console.log(session.objective);

  if (session.tasks.length > 0) {
    console.log("");
    console.log("Tasks:");
    for (const task of session.tasks.slice(0, 8)) {
      console.log(`  ${task.status} ${task.taskId}: ${task.title}`);
    }
  }

  if (session.checkpoints.length > 0) {
    console.log("");
    console.log("Recent checkpoints:");
    for (const checkpoint of session.checkpoints.slice(-5)) {
      console.log(`  ${checkpoint.checkpointId} ${checkpoint.createdAt}`);
      console.log(`    ${checkpoint.summary}`);
    }
  }

  if (session.warnings.length > 0) {
    console.log("");
    console.log("Session warnings:");
    for (const warning of session.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printResearchSessionList(sessions: ResearchSession[]): void {
  console.log(`Truth Harness research sessions: ${sessions.length}`);

  for (const session of sessions) {
    console.log("");
    console.log(`${session.sessionId} ${session.updatedAt}`);
    console.log(`  ${session.title}`);
    console.log(`  Domains: ${session.domains.join(", ")}`);
    console.log(`  Evidence refs: ${session.evidenceRefs.length}`);
    console.log(`  Checkpoints: ${session.checkpoints.length}`);
  }
}

function printExpertReviewWrite(result: ExpertReviewWriteResult): void {
  console.log(`Wrote expert review ${result.review.reviewId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`Kind/status: ${result.review.kind}/${result.review.status}`);
  console.log(`Outcome: ${result.review.outcome.status}`);
  console.log(`Reviewer role: ${result.review.reviewer.role}`);
  console.log(`Privacy: ${result.review.privacy.mode} (network: ${result.review.privacy.networkAccess})`);
  console.log("");
  console.log(result.review.title);
  console.log(result.review.subject);
  console.log(result.review.outcome.summary);

  if (result.review.warnings.length > 0) {
    console.log("");
    console.log("Review warnings:");
    for (const warning of result.review.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printExpertReviewList(reviews: ExpertReviewRecord[]): void {
  console.log(`Truth Harness expert reviews: ${reviews.length}`);

  for (const review of reviews) {
    console.log("");
    console.log(`${review.reviewId} ${review.updatedAt}`);
    console.log(`  ${review.title}`);
    console.log(`  Kind/status/outcome: ${review.kind}/${review.status}/${review.outcome.status}`);
    console.log(`  Reviewer role: ${review.reviewer.role}`);
    console.log(`  Evidence refs: ${review.evidenceRefs.length}`);
  }
}

function printInventionLogWrite(entry: InventionLogEntry, path: string): void {
  console.log(`Wrote invention log ${entry.entryId}`);
  console.log(`Path: ${path}`);
  console.log(`Stage: ${entry.validationStage}`);
  console.log(`Privacy: ${entry.privacy.mode} (network: ${entry.privacy.networkAccess})`);
  console.log(`Patent: human review required; ${entry.patent.legalConclusion}`);
  console.log("");
  console.log(entry.title);
  console.log(entry.hypothesis);

  if (entry.safety.overclaimWarnings.length > 0) {
    console.log("");
    console.log("Overclaim warnings:");
    for (const warning of entry.safety.overclaimWarnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printInventionLogList(entries: InventionLogEntry[]): void {
  console.log(`Truth Harness invention logs: ${entries.length}`);

  for (const entry of entries) {
    console.log("");
    console.log(`${entry.entryId} ${entry.createdAt}`);
    console.log(`  ${entry.title}`);
    console.log(`  Stage: ${entry.validationStage}`);
    console.log(`  Evidence refs: ${entry.evidenceRefs.length}`);
  }
}

function printDiscoveryPackage(discoveryPackage: DiscoveryPackage): void {
  console.log(discoveryPackage.markdown);
}

function printDiscoveryPackageWrite(result: DiscoveryPackageWriteResult): void {
  console.log(`Wrote discovery package ${result.package.packageId}`);
  console.log(`Path: ${result.path}`);
  console.log(`Entry: ${result.package.entry.entryId}`);
  console.log(`Stage: ${result.package.validation.stage}`);
  console.log(
    `Evidence: ${result.package.validation.resolvedReceiptCount}/${result.package.validation.evidenceCount} resolved receipt refs`
  );
}

function printClaimChart(chart: ClaimChart): void {
  console.log(chart.markdown);
}

function printClaimChartWrite(result: ClaimChartWriteResult): void {
  console.log(`Wrote claim chart ${result.chart.chartId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`Entry: ${result.chart.entryId}`);
  console.log(`Elements: ${result.chart.elements.length}`);
  console.log(`Legal: ${result.chart.legal.legalConclusion}; ${result.chart.legal.patentabilityConclusion}`);
  console.log(`Provisional draft ready: ${String(result.chart.legal.provisionalDraftReady)}`);
}

function printClaimChartList(charts: ClaimChart[]): void {
  console.log(`Truth Harness claim charts: ${charts.length}`);

  for (const chart of charts) {
    console.log("");
    console.log(`${chart.chartId} ${chart.createdAt}`);
    console.log(`  ${chart.title}`);
    console.log(`  Entry: ${chart.entryId}`);
    console.log(`  Elements: ${chart.elements.length}`);
    console.log(`  Legal: ${chart.legal.legalConclusion}`);
  }
}

function printModelContext(packet: ModelContextPacket): void {
  console.log(`Model context packet ${packet.packetId}`);
  console.log(`Target: ${packet.target.kind} / ${packet.target.service}${packet.target.model ? ` / ${packet.target.model}` : ""}`);
  console.log(`Approval: ${packet.approval.status}`);
  console.log(`Disclosure: ${packet.disclosure.status}`);
  console.log(`Privacy: ${packet.privacy.mode} (network: ${packet.privacy.networkAccess})`);
  console.log(`Data classes: ${packet.dataClasses.join(", ") || "none"}`);
  console.log(`Selected refs: ${packet.selectedContextRefs.length}`);
  console.log(`Sections: ${packet.sections.length}`);
  console.log("");
  console.log(packet.purpose);

  if (packet.warnings.length > 0) {
    console.log("");
    console.log("Model-context warnings:");
    for (const warning of packet.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printModelContextWrite(result: ModelContextWriteResult): void {
  console.log(`Wrote model context packet ${result.packet.packetId}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  printModelContext(result.packet);
}

function printModelContextList(packets: ModelContextPacket[]): void {
  console.log(`Truth Harness model-context packets: ${packets.length}`);

  for (const packet of packets) {
    console.log("");
    console.log(`${packet.packetId} ${packet.createdAt}`);
    console.log(`  ${packet.title}`);
    console.log(`  Target: ${packet.target.kind} / ${packet.target.service}${packet.target.model ? ` / ${packet.target.model}` : ""}`);
    console.log(`  Approval/disclosure: ${packet.approval.status}/${packet.disclosure.status}`);
  }
}

function printExternalDisclosureWrite(result: ExternalDisclosureWriteResult): void {
  console.log(`Wrote external disclosure ${result.entry.disclosureId}`);
  console.log(`Path: ${result.path}`);
  console.log(`Service: ${result.entry.service}`);
  if (result.entry.model) {
    console.log(`Model: ${result.entry.model}`);
  }
  console.log(`Status: ${result.entry.status}`);
  console.log(`User initiated: ${String(result.entry.userInitiated)}`);
  console.log(`Privacy: ${result.entry.privacy.mode} (network: ${result.entry.privacy.networkAccess})`);
  console.log(`Data classes: ${result.entry.dataClasses.join(", ")}`);
  console.log("");
  console.log(result.entry.purpose);
  console.log(result.entry.contextSummary);

  if (result.entry.warnings.length > 0) {
    console.log("");
    console.log("Disclosure warnings:");
    for (const warning of result.entry.warnings) {
      console.log(`  ${warning}`);
    }
  }
}

function printExternalDisclosureList(entries: ExternalDisclosureLogEntry[]): void {
  console.log(`Truth Harness external disclosures: ${entries.length}`);

  for (const entry of entries) {
    console.log("");
    console.log(`${entry.disclosureId} ${entry.createdAt}`);
    console.log(`  ${entry.service}${entry.model ? ` / ${entry.model}` : ""}`);
    console.log(`  Status: ${entry.status}`);
    console.log(`  Data classes: ${entry.dataClasses.join(", ")}`);
    console.log(`  Purpose: ${entry.purpose}`);
  }
}

function parseExternalDisclosureStatus(value: string): ExternalDisclosureStatus {
  if (isExternalDisclosureStatus(value)) {
    return value;
  }

  throw new Error(`Unsupported external disclosure status ${JSON.stringify(value)}.`);
}

function parseModelContextTarget(value: string): ModelContextTarget {
  if (isModelContextTarget(value)) {
    return value;
  }

  throw new Error(`Unsupported model context target ${JSON.stringify(value)}.`);
}

function parseModelContextDisclosureStatus(value: string): ModelContextDisclosureStatus {
  if (isModelContextDisclosureStatus(value)) {
    return value;
  }

  throw new Error(`Unsupported model context disclosure status ${JSON.stringify(value)}.`);
}

function parseModelContextSection(value: string): ModelContextSection {
  const separator = value.indexOf("=");
  if (separator <= 0) {
    throw new Error(`Model context section must use title=content: ${JSON.stringify(value)}.`);
  }

  return {
    title: value.slice(0, separator).trim(),
    content: value.slice(separator + 1).trim(),
    sourceRefs: []
  };
}

function parseLiteratureRecordKind(value: string): LiteratureRecordKind {
  if (isLiteratureRecordKind(value)) {
    return value;
  }

  throw new Error(`Unsupported literature record kind ${JSON.stringify(value)}.`);
}

function parseLiteratureRecordStatus(value: string): LiteratureRecordStatus {
  if (isLiteratureRecordStatus(value)) {
    return value;
  }

  throw new Error(`Unsupported literature record status ${JSON.stringify(value)}.`);
}

function parseLiteratureIdentifier(value: string): LiteratureIdentifier {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    return { kind: "other", value };
  }

  const maybeKind = value.slice(0, separator);
  const identifierValue = value.slice(separator + 1);
  if (isLiteratureIdentifierKind(maybeKind)) {
    return { kind: maybeKind, value: identifierValue };
  }

  throw new Error(`Unsupported literature identifier kind ${JSON.stringify(maybeKind)}.`);
}

function parseNotebookRunKind(value: string): NotebookRunKind {
  if (isNotebookRunKind(value)) {
    return value;
  }

  throw new Error(`Unsupported notebook run kind ${JSON.stringify(value)}.`);
}

function parseNotebookRunStatus(value: string): NotebookRunStatus {
  if (isNotebookRunStatus(value)) {
    return value;
  }

  throw new Error(`Unsupported notebook run status ${JSON.stringify(value)}.`);
}

function parseNotebookRunValue(value: string): NotebookRunValue {
  return parseNamedValue(value, "Notebook run value");
}

function formatNotebookRunValue(value: NotebookRunValue): string {
  const unit = value.unit ? ` ${value.unit}` : "";
  const note = value.note ? ` (${value.note})` : "";
  return `${value.name}=${value.value}${unit}${note}`;
}

function parseSimulationKind(value: string): SimulationKind {
  if (isSimulationKind(value)) {
    return value;
  }

  throw new Error(`Unsupported simulation kind ${JSON.stringify(value)}.`);
}

function parseSimulationStage(value: string): SimulationStage {
  if (isSimulationStage(value)) {
    return value;
  }

  throw new Error(`Unsupported simulation stage ${JSON.stringify(value)}.`);
}

function parseSimulationScalar(value: string): SimulationScalar {
  return parseNamedValue(value, "Simulation scalar");
}

function formatSimulationScalar(value: SimulationScalar): string {
  const unit = value.unit ? ` ${value.unit}` : "";
  const note = value.note ? ` (${value.note})` : "";
  return `${value.name}=${value.value}${unit}${note}`;
}

function parseExperimentKind(value: string): ExperimentKind {
  if (isExperimentKind(value)) {
    return value;
  }

  throw new Error(`Unsupported experiment kind ${JSON.stringify(value)}.`);
}

function parseExperimentStage(value: string): ExperimentStage {
  if (isExperimentStage(value)) {
    return value;
  }

  throw new Error(`Unsupported experiment stage ${JSON.stringify(value)}.`);
}

function parseExperimentOutcome(value: string): ExperimentOutcome {
  if (isExperimentOutcome(value)) {
    return value;
  }

  throw new Error(`Unsupported experiment outcome ${JSON.stringify(value)}.`);
}

function parseExperimentMeasurement(value: string): ExperimentMeasurement {
  return parseNamedValue(value, "Experiment measurement");
}

function formatExperimentMeasurement(value: ExperimentMeasurement): string {
  const unit = value.unit ? ` ${value.unit}` : "";
  const note = value.note ? ` (${value.note})` : "";
  return `${value.name}=${value.value}${unit}${note}`;
}

function parseNamedValue(value: string, label: string): { name: string; value: string; unit?: string; note?: string } {
  const parts = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const [first, ...rest] = parts;
  if (!first) {
    throw new Error(`${label} must use name=value.`);
  }

  const firstSeparator = first.indexOf("=");
  if (firstSeparator <= 0) {
    throw new Error(`${label} must use name=value: ${JSON.stringify(value)}.`);
  }

  const parsed: { name: string; value: string; unit?: string; note?: string } = {
    name: first.slice(0, firstSeparator).trim(),
    value: first.slice(firstSeparator + 1).trim()
  };

  for (const part of rest) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      throw new Error(`${label} metadata must use key=value: ${JSON.stringify(part)}.`);
    }

    const key = part.slice(0, separator).trim();
    const metadataValue = part.slice(separator + 1).trim();
    if (key === "unit") {
      parsed.unit = metadataValue;
      continue;
    }

    if (key === "note") {
      parsed.note = metadataValue;
      continue;
    }

    throw new Error(`Unsupported ${label.toLowerCase()} metadata key ${JSON.stringify(key)}.`);
  }

  return parsed;
}

function parseInventionValidationStage(value: string): InventionValidationStage {
  if (isInventionValidationStage(value)) {
    return value;
  }

  throw new Error(`Unsupported invention validation stage ${JSON.stringify(value)}.`);
}

function parseResearchSessionDomain(value: string): ResearchSessionDomain {
  if (isResearchSessionDomain(value)) {
    return value;
  }

  throw new Error(`Unsupported research session domain ${JSON.stringify(value)}.`);
}

function parseResearchTaskStatus(value: string): ResearchTaskStatus {
  if (isResearchTaskStatus(value)) {
    return value;
  }

  throw new Error(`Unsupported research task status ${JSON.stringify(value)}.`);
}

function parseExpertReviewKind(value: string): ExpertReviewKind {
  if (isExpertReviewKind(value)) {
    return value;
  }

  throw new Error(`Unsupported expert review kind ${JSON.stringify(value)}.`);
}

function parseExpertReviewStatus(value: string): ExpertReviewStatus {
  if (isExpertReviewStatus(value)) {
    return value;
  }

  throw new Error(`Unsupported expert review status ${JSON.stringify(value)}.`);
}

function parseExpertReviewOutcome(value: string): ExpertReviewOutcome {
  if (isExpertReviewOutcome(value)) {
    return value;
  }

  throw new Error(`Unsupported expert review outcome ${JSON.stringify(value)}.`);
}

function parseValidationPlanDomain(value: string): ValidationPlanDomain {
  if (isValidationPlanDomain(value)) {
    return value;
  }

  throw new Error(`Unsupported validation plan domain ${JSON.stringify(value)}.`);
}

function parseValidationGateInput(value: string): ValidationGateInput {
  const separator = value.indexOf(":");
  if (separator > 0) {
    const maybeKind = value.slice(0, separator);
    const description = value.slice(separator + 1);
    if (isValidationGateKind(maybeKind)) {
      return { kind: maybeKind, description };
    }
  }

  return { description: value };
}

function parseClaimChartElement(value: string): ClaimChartElementInput {
  return { text: value };
}

function parseClaimLedgerDomain(value: string): ClaimLedgerDomain {
  if (isClaimLedgerDomain(value)) {
    return value;
  }

  throw new Error(`Unsupported claim ledger domain ${JSON.stringify(value)}.`);
}

function parseClaimLedgerStatus(value: string): ClaimLedgerStatus {
  if (isClaimLedgerStatus(value)) {
    return value;
  }

  throw new Error(`Unsupported claim ledger status ${JSON.stringify(value)}.`);
}

function parseTrustLabel(value: string): TrustLabel {
  const label = maybeTrustLabel(value);
  if (label) {
    return label;
  }

  throw new Error(`Unsupported trust label ${JSON.stringify(value)}.`);
}

function parseReleaseAuditMode(value: string): "prototype" | "public-review" {
  if (value === "prototype" || value === "public-review") {
    return value;
  }

  throw new Error(`Unsupported release audit mode ${JSON.stringify(value)}. Use prototype or public-review.`);
}

function parseSmtBackendOption(value: string): SmtBackendId {
  if (value === "z3" || value === "cvc5") {
    return value;
  }

  throw new Error(`Unsupported SMT backend ${JSON.stringify(value)}. Expected "z3" or "cvc5".`);
}

function maybeTrustLabel(value: string): TrustLabel | undefined {
  if (
    value === "proved" ||
    value === "exact-computed" ||
    value === "bounded-numeric" ||
    value === "smt-checked" ||
    value === "dimension-checked" ||
    value === "source-cited" ||
    value === "cross-checked" ||
    value === "unverified" ||
    value === "refuted"
  ) {
    return value;
  }

  return undefined;
}

function parseClaimLedgerEvidenceRef(value: string): ClaimLedgerEvidenceRef {
  const trustSeparator = value.lastIndexOf("@");
  const maybeTrust = trustSeparator > 0 ? maybeTrustLabel(value.slice(trustSeparator + 1)) : undefined;
  const rawRef = maybeTrust ? value.slice(0, trustSeparator) : value;
  const separator = rawRef.indexOf(":");
  if (separator <= 0) {
    return { kind: "other", ref: rawRef, trust: maybeTrust };
  }

  const maybeKind = rawRef.slice(0, separator);
  const ref = rawRef.slice(separator + 1);
  if (
    maybeKind === "receipt" ||
    maybeKind === "artifact" ||
    maybeKind === "source" ||
    maybeKind === "literature" ||
    maybeKind === "notebook" ||
    maybeKind === "notebook-run" ||
    maybeKind === "code-run" ||
    maybeKind === "benchmark" ||
    maybeKind === "disclosure" ||
    maybeKind === "simulation" ||
    maybeKind === "experiment" ||
    maybeKind === "vault" ||
    maybeKind === "audit" ||
    maybeKind === "snapshot" ||
    maybeKind === "review" ||
    maybeKind === "validation" ||
    maybeKind === "model-context" ||
    maybeKind === "cas" ||
    maybeKind === "proof" ||
    maybeKind === "smt" ||
    maybeKind === "route" ||
    maybeKind === "invention" ||
    maybeKind === "claim-chart" ||
    maybeKind === "discovery-package" ||
    maybeKind === "other"
  ) {
    return { kind: maybeKind, ref, trust: maybeTrust };
  }

  return { kind: "other", ref: rawRef, trust: maybeTrust };
}

function parseVerifierRouteEvidenceRef(value: string, summary?: string): VerifierRouteEvidenceRef {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    throw new Error("Route obligation evidence must be prefixed as cas:, proof:, smt:, receipt:, or route:.");
  }

  const maybeKind = value.slice(0, separator);
  const ref = value.slice(separator + 1);
  if (maybeKind === "cas" || maybeKind === "proof" || maybeKind === "smt" || maybeKind === "receipt" || maybeKind === "route") {
    return {
      kind: maybeKind,
      ref,
      ...(summary ? { summary } : {})
    };
  }

  throw new Error(`Unsupported route obligation evidence kind ${JSON.stringify(maybeKind)}.`);
}

function parseEvidenceRef(value: string): InventionEvidenceRef {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    return { kind: "other", ref: value };
  }

  const maybeKind = value.slice(0, separator);
  const ref = value.slice(separator + 1);
  if (
    maybeKind === "receipt" ||
    maybeKind === "artifact" ||
    maybeKind === "source" ||
    maybeKind === "literature" ||
    maybeKind === "notebook" ||
    maybeKind === "notebook-run" ||
    maybeKind === "code-run" ||
    maybeKind === "benchmark" ||
    maybeKind === "cas" ||
    maybeKind === "disclosure" ||
    maybeKind === "simulation" ||
    maybeKind === "experiment" ||
    maybeKind === "vault" ||
    maybeKind === "review" ||
    maybeKind === "validation" ||
    maybeKind === "route" ||
    maybeKind === "other"
  ) {
    return { kind: maybeKind, ref };
  }

  return { kind: "other", ref: value };
}

function parseResearchEvidenceRef(value: string): ResearchEvidenceRef {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    return { kind: "other", ref: value };
  }

  const maybeKind = value.slice(0, separator);
  const ref = value.slice(separator + 1);
  if (
    maybeKind === "claim" ||
    maybeKind === "receipt" ||
    maybeKind === "artifact" ||
    maybeKind === "source" ||
    maybeKind === "literature" ||
    maybeKind === "notebook" ||
    maybeKind === "notebook-run" ||
    maybeKind === "code-run" ||
    maybeKind === "benchmark" ||
    maybeKind === "cas" ||
    maybeKind === "disclosure" ||
    maybeKind === "simulation" ||
    maybeKind === "experiment" ||
    maybeKind === "vault" ||
    maybeKind === "audit" ||
    maybeKind === "snapshot" ||
    maybeKind === "workspace-review" ||
    maybeKind === "review" ||
    maybeKind === "validation" ||
    maybeKind === "model-context" ||
    maybeKind === "route" ||
    maybeKind === "invention" ||
    maybeKind === "claim-chart" ||
    maybeKind === "discovery-package" ||
    maybeKind === "other"
  ) {
    return { kind: maybeKind, ref };
  }

  return { kind: "other", ref: value };
}

function parseExpertReviewEvidenceRef(value: string): ExpertReviewEvidenceRef {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    return { kind: "other", ref: value };
  }

  const maybeKind = value.slice(0, separator);
  const ref = value.slice(separator + 1);
  if (
    maybeKind === "receipt" ||
    maybeKind === "artifact" ||
    maybeKind === "source" ||
    maybeKind === "literature" ||
    maybeKind === "notebook" ||
    maybeKind === "notebook-run" ||
    maybeKind === "code-run" ||
    maybeKind === "benchmark" ||
    maybeKind === "cas" ||
    maybeKind === "disclosure" ||
    maybeKind === "simulation" ||
    maybeKind === "experiment" ||
    maybeKind === "vault" ||
    maybeKind === "audit" ||
    maybeKind === "snapshot" ||
    maybeKind === "review" ||
    maybeKind === "validation" ||
    maybeKind === "model-context" ||
    maybeKind === "session" ||
    maybeKind === "route" ||
    maybeKind === "invention" ||
    maybeKind === "claim-chart" ||
    maybeKind === "discovery-package" ||
    maybeKind === "other"
  ) {
    return { kind: maybeKind, ref };
  }

  return { kind: "other", ref: value };
}

function parseValidationEvidenceRef(value: string): ValidationEvidenceRef {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    return { kind: "other", ref: value };
  }

  const maybeKind = value.slice(0, separator);
  const ref = value.slice(separator + 1);
  if (
    maybeKind === "receipt" ||
    maybeKind === "artifact" ||
    maybeKind === "source" ||
    maybeKind === "literature" ||
    maybeKind === "notebook" ||
    maybeKind === "notebook-run" ||
    maybeKind === "code-run" ||
    maybeKind === "benchmark" ||
    maybeKind === "cas" ||
    maybeKind === "disclosure" ||
    maybeKind === "simulation" ||
    maybeKind === "experiment" ||
    maybeKind === "vault" ||
    maybeKind === "audit" ||
    maybeKind === "snapshot" ||
    maybeKind === "session" ||
    maybeKind === "review" ||
    maybeKind === "validation" ||
    maybeKind === "model-context" ||
    maybeKind === "route" ||
    maybeKind === "invention" ||
    maybeKind === "claim-chart" ||
    maybeKind === "discovery-package" ||
    maybeKind === "other"
  ) {
    return { kind: maybeKind, ref };
  }

  return { kind: "other", ref: value };
}

function collectRepeated(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function collectWorkspaceCleanTarget(value: string, previous: WorkspaceCleanTarget[]): WorkspaceCleanTarget[] {
  const targets = value
    .split(",")
    .map((target) => target.trim())
    .filter((target) => target.length > 0);

  for (const target of targets) {
    if (!isWorkspaceCleanTarget(target)) {
      throw new Error(`Unsupported workspace clean target ${JSON.stringify(target)}.`);
    }
  }

  return [...previous, ...(targets as WorkspaceCleanTarget[])];
}

const VISUAL_ARTIFACT_KINDS: VisualArtifactKind[] = [
  "plot",
  "proof-tree",
  "lineage-graph",
  "mind-map",
  "concept-map",
  "simulation-view",
  "notebook-output",
  "teaching-animation",
  "report-figure"
];

const VISUAL_ARTIFACT_RENDERERS: VisualArtifactRenderer[] = [
  "truth-harness-native",
  "plotly",
  "graphviz",
  "mermaid",
  "tldraw",
  "manim",
  "sage",
  "matplotlib",
  "external-file"
];

const VISUAL_PAYLOAD_FORMATS: VisualArtifactPayloadFormat[] = [
  "svg",
  "plotly-json",
  "graph-json",
  "canvas-json",
  "html",
  "png-ref",
  "table-json"
];

const VISUAL_SOURCE_KINDS: VisualArtifactSourceKind[] = [
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
];

function parseVisualArtifactKind(value: string): VisualArtifactKind {
  if ((VISUAL_ARTIFACT_KINDS as string[]).includes(value)) {
    return value as VisualArtifactKind;
  }

  throw new Error(`Unsupported visual artifact kind ${JSON.stringify(value)}.`);
}

function parseVisualArtifactRenderer(value: string): VisualArtifactRenderer {
  if ((VISUAL_ARTIFACT_RENDERERS as string[]).includes(value)) {
    return value as VisualArtifactRenderer;
  }

  throw new Error(`Unsupported visual renderer ${JSON.stringify(value)}.`);
}

function parseGraphVisualRenderer(value: string): "mermaid" | "graphviz" {
  if (value === "mermaid" || value === "graphviz") {
    return value;
  }

  throw new Error(`Unsupported graph visual renderer ${JSON.stringify(value)}. Expected "mermaid" or "graphviz".`);
}

function parsePlotVisualRenderer(value: string): "plotly" | "matplotlib" | "sage" {
  if (value === "plotly" || value === "matplotlib" || value === "sage") {
    return value;
  }

  throw new Error(`Unsupported plot visual renderer ${JSON.stringify(value)}. Expected "plotly", "matplotlib", or "sage".`);
}

function parseVisualRenderEngine(value: string): "graphviz" | "plotly" {
  if (value === "graphviz" || value === "plotly") {
    return value;
  }

  throw new Error(`Unsupported visual render engine ${JSON.stringify(value)}. Expected "graphviz" or "plotly".`);
}

function parseVisualPayloadFormat(value: string): VisualArtifactPayloadFormat {
  if ((VISUAL_PAYLOAD_FORMATS as string[]).includes(value)) {
    return value as VisualArtifactPayloadFormat;
  }

  throw new Error(`Unsupported visual payload format ${JSON.stringify(value)}.`);
}

function parseVisualSourceKind(value: string): VisualArtifactSourceKind {
  if ((VISUAL_SOURCE_KINDS as string[]).includes(value)) {
    return value as VisualArtifactSourceKind;
  }

  throw new Error(`Unsupported visual source kind ${JSON.stringify(value)}.`);
}

function parseVisualSourceRef(value: string): VisualArtifactSourceRef {
  const match = /^([a-z][a-z0-9-]*):(.+)$/iu.exec(value);
  if (!match) {
    return {
      kind: "manual",
      ref: value
    };
  }

  return {
    kind: parseVisualSourceKind(match[1] ?? ""),
    ref: match[2] ?? ""
  };
}

async function readVisualPayloadContent(options: {
  payloadFormat: string;
  payloadJson?: string;
  payloadText?: string;
  payloadFile?: string;
}): Promise<unknown> {
  const provided = [options.payloadJson, options.payloadText, options.payloadFile].filter((value) => value !== undefined);
  if (provided.length !== 1) {
    throw new Error("Provide exactly one of --payload-json, --payload-text, or --payload-file.");
  }

  if (options.payloadJson !== undefined) {
    return JSON.parse(options.payloadJson) as unknown;
  }

  const text = options.payloadFile
    ? await readFile(resolve(options.payloadFile), "utf8")
    : options.payloadText ?? "";
  return visualPayloadFormatIsJson(parseVisualPayloadFormat(options.payloadFormat)) ? JSON.parse(text) as unknown : text;
}

function visualPayloadFormatIsJson(format: VisualArtifactPayloadFormat): boolean {
  return format === "plotly-json" || format === "graph-json" || format === "canvas-json" || format === "table-json";
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${JSON.stringify(value)}.`);
  }

  return parsed;
}

function parseNonNegativeInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer, received ${JSON.stringify(value)}.`);
  }

  return parsed;
}

function singleLineSnippet(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
}

function formatRecordCounts(value: Record<string, number>): string {
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return entries.length > 0 ? entries.map(([key, count]) => `${key}=${count}`).join(", ") : "none";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDefinedRecord(value: Record<string, unknown>): string {
  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined && entry !== "")
    .sort(([left], [right]) => left.localeCompare(right));
  return entries.length > 0 ? entries.map(([key, entry]) => `${key}=${String(entry)}`).join(", ") : "none";
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function benchmarkRunReplayCommand(
  suitePath: string,
  options: { write?: boolean; failOnFailures?: boolean; workspace?: string }
): string {
  const flags = [
    options.write ? "--write" : undefined,
    options.workspace && options.workspace !== "." ? `--workspace ${quoteCommandArg(options.workspace)}` : undefined,
    options.failOnFailures ? "--fail-on-failures" : undefined
  ].filter(Boolean);
  return `truth-harness bench run ${quoteCommandArg(suitePath)}${flags.length > 0 ? ` ${flags.join(" ")}` : ""}`;
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/.test(value) ? value : JSON.stringify(value);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function proofCheckScopeFromOptions(options: {
  route?: string;
  obligation?: string;
  statementHash?: string;
  statement?: string;
}): { routeId?: string; obligationId?: string; statementHash?: string; statement?: string } | undefined {
  const scope = {
    routeId: normalizeOptionalString(options.route),
    obligationId: normalizeOptionalString(options.obligation),
    statementHash: normalizeOptionalString(options.statementHash),
    statement: normalizeOptionalString(options.statement)
  };

  return Object.values(scope).some((value) => value !== undefined) ? scope : undefined;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(path: string, value: string): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value);
}

async function writeBytes(path: string, value: Uint8Array): Promise<string> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value);
  return target;
}
