#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { parseBenchmarkSuite, runBenchmarkSuite, type BenchmarkRun } from "@theorem-workbench/benchmarks";
import {
  benchmarkComparisonFailsGate,
  benchmarkRunFailsGate,
  checkClaimFile,
  checkLeanProofArtifact,
  checkSmtLibArtifact,
  createBenchmarkComparisonRecord,
  createClaimChart,
  createDiscoveryPackage,
  createEvidenceAudit,
  createExperimentLogEntry,
  createExternalDisclosureLogEntry,
  createInventionLogEntry,
  createModelContext,
  createNotebookRun,
  createReceipt,
  createSimulationLogEntry,
  createSourceCitationReceipt,
  getLocalWorkspaceStatus,
  getProofBackendStatus,
  getSmtBackendStatus,
  ingestLocalCorpus,
  initLocalWorkspace,
  isExpertReviewKind,
  isExpertReviewOutcome,
  isExpertReviewStatus,
  isExperimentKind,
  isExperimentOutcome,
  isExperimentStage,
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
  isSimulationKind,
  isSimulationStage,
  isValidationGateKind,
  isValidationPlanDomain,
  listBenchmarkArtifacts,
  listClaimCharts,
  listCodeRuns,
  listEvidenceAudits,
  listExpertReviews,
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
  listWorkspaceSnapshots,
  listVaultEntries,
  openVaultEntry,
  parseReceiptJson,
  parseBenchmarkRunRecordJson,
  renderReceipt,
  repairLocalWorkspace,
  replayReceipt,
  searchLocalCorpus,
  sealVaultFile,
  solveSmtProblem,
  addResearchSessionCheckpoint,
  validateWorkspaceArtifacts,
  verifyVaultEntry,
  verifyWorkspaceSnapshot,
  writeBenchmarkComparisonRecord,
  writeBenchmarkRunRecord,
  writeCodeRun,
  writeEvidenceAudit,
  writeEvidenceAuditReport,
  writeExpertReview,
  writeLeanProofCheckRecord,
  writeSmtCheckRecord,
  writeDiscoveryPackage,
  writeLiteratureRecord,
  writeModelContext,
  writeNotebookRun,
  writeResearchSession,
  writeValidationPlan,
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
  type CodeRunSummary,
  type CodeRunPolicyInput,
  type CodeRunWriteResult,
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
  type VaultOpenResult,
  type VaultSealResult,
  type VaultVerifyResult,
  type WorkspaceSnapshotSummary,
  type WorkspaceSnapshotVerification,
  type WorkspaceSnapshotWriteResult,
  type WorkspaceValidation
} from "@theorem-workbench/core";

const program = new Command();

program
  .name("theorem")
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

const bench = program.command("bench").description("Run and compare verification benchmark suites.");

bench
  .command("run")
  .description("Run a benchmark suite JSON file.")
  .argument("<suite>", "Path to a benchmark suite JSON file")
  .option("--json", "Print the full benchmark run JSON")
  .option("--out <path>", "Write the benchmark run JSON to a file")
  .option("--write", "Write JSON and Markdown into .theorem-workbench/benchmarks")
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
          runnerName: "theorem-cli",
          runnerAdapter: "local-receipt-engine",
          command: `theorem bench run ${quoteCommandArg(suitePath)}`,
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
  .description("Compare two theorem.benchmark-run.v0 records and flag regressions.")
  .argument("<baseline>", "Baseline benchmark-run JSON path")
  .argument("<current>", "Current benchmark-run JSON path")
  .option("--json", "Print the full benchmark comparison JSON")
  .option("--out <path>", "Write the benchmark comparison JSON to a file")
  .option("--write", "Write JSON and Markdown into .theorem-workbench/benchmarks")
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
  .command("check")
  .description("Check theorem-workbench fenced claim blocks in Markdown files.")
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
  .option("--timeout-ms <ms>", "Command timeout in milliseconds", parsePositiveInteger, 10000)
  .option("--max-output-bytes <bytes>", "Maximum captured bytes per output stream", parsePositiveInteger, 65536)
  .option("--allow-executable <name>", "Required executable name/path allowlist. Repeat for multiple allowed executables.", collectRepeated, [])
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
  .option("--key-env <name>", "Environment variable containing the vault key", "THEOREM_WORKBENCH_VAULT_KEY")
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
  .option("--key-env <name>", "Environment variable containing the vault key", "THEOREM_WORKBENCH_VAULT_KEY")
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
  .option("--key-env <name>", "Environment variable containing the vault key", "THEOREM_WORKBENCH_VAULT_KEY")
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
  .option("--evidence <ref>", "Evidence ref, optionally prefixed as receipt:path, simulation:id, experiment:id, review:id, audit:id, snapshot:id, claim-chart:id, literature:id, or source:path", collectRepeated, [])
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
  .option("--write", "Write Markdown into .theorem-workbench/findings")
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
  .option("--write", "Write JSON and Markdown into .theorem-workbench/patents")
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
  .description("Manage a local-first private Theorem Workbench project store.");

workspace
  .command("init")
  .description("Initialize .theorem-workbench local project storage.")
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

const proof = program.command("proof").description("Inspect formal proof-checker backends and trust boundaries.");

proof
  .command("backends")
  .description("Probe local proof-checker backends without network access.")
  .option("--json", "Print the full proof backend status JSON")
  .option("--lean-command <path>", "Lean executable path or command. Defaults to THEOREM_LEAN or lean.")
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
  .command("check")
  .description("Check a local Lean proof artifact and produce a proof-check record.")
  .argument("<source>", "Lean source file to check")
  .option("--json", "Print the full proof-check JSON")
  .option("--out <path>", "Write the full proof-check JSON to a file")
  .option("--write", "Write JSON and Markdown into .theorem-workbench/proofs")
  .option("--workspace <path>", "Project root path", ".")
  .option("--theorem <name>", "Optional theorem or declaration name represented by the source")
  .option("--lean-command <path>", "Lean executable path or command. Defaults to THEOREM_LEAN or lean.")
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
        theorem?: string;
        leanCommand?: string;
        timeoutMs: number;
        failOnUnproved?: boolean;
      }
    ) => {
      const workspaceWrite = options.write
        ? await writeLeanProofCheckRecord({
            rootPath: options.workspace,
            sourcePath,
            theoremName: options.theorem,
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
          theoremName: options.theorem,
          leanCommand: options.leanCommand,
          timeoutMs: options.timeoutMs,
          replayCommand: `theorem proof check ${quoteCommandArg(sourcePath)} --json`
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

const smt = program.command("smt").description("Inspect local SMT solver backends and check SMT-LIB artifacts.");

smt
  .command("backends")
  .description("Probe local SMT solver backends without checking a claim.")
  .option("--json", "Print the full SMT backend status JSON")
  .option("--z3-command <path>", "Z3 executable path or command. Defaults to THEOREM_Z3 or z3.")
  .option("--timeout-ms <ms>", "Backend probe timeout in milliseconds", parsePositiveInteger, 3000)
  .action((options: { json?: boolean; z3Command?: string; timeoutMs: number }) => {
    const status = getSmtBackendStatus({
      z3Command: options.z3Command,
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
  .description("Check a local SMT-LIB artifact with Z3 and produce an SMT check record.")
  .argument("<source>", "SMT-LIB source file to check")
  .option("--json", "Print the full SMT check JSON")
  .option("--out <path>", "Write the full SMT check JSON to a file")
  .option("--write", "Write JSON and Markdown into .theorem-workbench/smt")
  .option("--workspace <path>", "Project root path", ".")
  .option("--query <name>", "Optional query or constraint-set name represented by the source")
  .option("--z3-command <path>", "Z3 executable path or command. Defaults to THEOREM_Z3 or z3.")
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
        z3Command?: string;
        timeoutMs: number;
        failOnUnverified?: boolean;
      }
    ) => {
      const workspaceWrite = options.write
        ? await writeSmtCheckRecord({
            rootPath: options.workspace,
            sourcePath,
            queryName: options.query,
            z3Command: options.z3Command,
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
          z3Command: options.z3Command,
          timeoutMs: options.timeoutMs,
          replayCommand: `theorem smt check ${quoteCommandArg(sourcePath)} --json`
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
  .description("Build workspace-local SMT-LIB from explicit integer constraints and check it with Z3.")
  .option("--json", "Print the full generated problem and SMT check JSON")
  .option("--workspace <path>", "Project root path", ".")
  .option("--name <name>", "Optional query or constraint-set name")
  .option("--int <name>", "Declare an integer variable. Repeat for multiple variables.", collectRepeated, [])
  .option("--constraint <expr>", "Add a constraint such as \"x + y >= 3\". Repeat for multiple constraints.", collectRepeated, [])
  .option("--model", "Append get-model after check-sat for satisfiable constraints")
  .option("--z3-command <path>", "Z3 executable path or command. Defaults to THEOREM_Z3 or z3.")
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
      z3Command?: string;
      timeoutMs: number;
      failOnUnverified?: boolean;
    }) => {
      const result = await solveSmtProblem({
        rootPath: options.workspace,
        queryName: options.name,
        variables: options.int,
        constraints: options.constraint,
        includeModel: options.model,
        z3Command: options.z3Command,
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

program
  .command("doctor")
  .description("Show local adapter and trust-surface status.")
  .action(() => {
    const proofStatus = getProofBackendStatus();
    const smtStatus = getSmtBackendStatus();
    console.log("Theorem Workbench doctor");
    console.log("");
    console.log("Available local adapters:");
    console.log("  exact arithmetic      ready   local Rational evaluator");
    console.log("  counterexample search ready   finite integer search over exact arithmetic");
    console.log("  parity checker        ready   local Z/2Z exact check for integer polynomial parity");
    console.log("  interval arithmetic   ready   conservative rational bounds over input ranges");
    console.log("  dimensional analysis  ready   local SI base-dimension evaluator");
    console.log("  SymPy CAS             ready   local Python subprocess when sympy is installed");
    console.log("  local corpus search   ready   private Markdown/text lexical index");
    for (const backend of proofStatus.backends) {
      console.log(
        `  ${backend.displayName.padEnd(22)} ${formatProofBackendStatus(backend.status)} ${backend.version ?? backend.error ?? "not detected"}`
      );
    }
    for (const backend of smtStatus.backends) {
      console.log(
        `  ${backend.displayName.padEnd(22)} ${formatSmtBackendStatus(backend.status)} ${backend.version ?? backend.error ?? "not detected"}`
      );
    }
    console.log("  Sage CAS              planned adapter");
    console.log("  cvc5 SMT              planned adapter");
    console.log("  vector/PDF RAG        planned adapter");
    console.log("");
    console.log("Privacy posture:");
    console.log("  receipts              ready   local-only metadata, no network access by default");
    console.log("  source-cited receipts ready   local corpus hits converted into evidence receipts");
    console.log("  literature records    ready   local paper, patent, dataset, and database-export evidence records");
    console.log("  notebook runs         ready   local notebook/script/pipeline provenance records");
    console.log("  invention logs        ready   local hypothesis/provenance records with overclaim warnings");
    console.log("  discovery packages    ready   local Markdown review bundles for invention logs");
    console.log("  simulation logs       ready   local computational evidence records with validation boundaries");
    console.log("  experiment logs       ready   local protocol/data/observation records with review boundaries");
    console.log("  claim charts          ready   local patent-review aids with human legal review required");
    console.log("  encrypted vault       ready   local AES-GCM sealing for sensitive project files");
    console.log("  evidence audits       ready   local claim posture and overclaim review");
    console.log("  validation plans      ready   local gate checklists before stronger discovery claims");
    console.log("  workspace snapshots   ready   portable hashes for provenance and drift checks");
    console.log("  research sessions     ready   local runbooks and checkpoints for agentic investigations");
    console.log("  expert reviews        ready   local human-review records with scope and limitations");
    console.log("  model contexts        ready   local selected-context packets before hosted model use");
    console.log("  hosted model calls    ready   explicit opt-in disclosure records");
    console.log("  local project store   ready   portable private workspace");
    console.log("");
    console.log("Formal proof boundary:");
    for (const warning of proofStatus.warnings) {
      console.log(`  ${warning}`);
    }
    for (const warning of smtStatus.warnings) {
      console.log(`  ${warning}`);
    }
    console.log("  A status probe is not a proof; `proved` requires a successful accepted proof-checking run.");
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
    throw new Error("Missing problem. Example: theorem ask \"compute 2 + 2\"");
  }

  return { problem, json, out };
}

function parseRenderFormat(format: string): ReceiptRenderFormat {
  if (format === "markdown" || format === "html") {
    return format;
  }

  throw new Error(`Unsupported receipt render format ${JSON.stringify(format)}. Use markdown or html.`);
}

function printProofBackendStatus(status: ProofBackendStatusReport): void {
  console.log("Theorem proof backends");
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
  if (record.source.theoremName) {
    console.log(`Theorem: ${record.source.theoremName}`);
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
  console.log(`Theorem proof checks: ${checks.length}`);

  for (const check of checks) {
    console.log("");
    console.log(`${check.checkId} ${check.createdAt}`);
    console.log(`  Source: ${check.sourcePath}`);
    if (check.theoremName) {
      console.log(`  Theorem: ${check.theoremName}`);
    }
    console.log(`  Status: ${check.status}`);
    console.log(`  Trust: ${check.trust}`);
    console.log(`  Proof-checker backed: ${String(check.proofCheckerBacked)}`);
    console.log(`  Path: ${check.path}`);
  }
}

function printSmtBackendStatus(status: SmtBackendStatusReport): void {
  console.log("Theorem SMT backends");
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
  console.log(`Theorem SMT checks: ${checks.length}`);

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
  console.log(`Theorem receipt ${receipt.runId}`);
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

function printBenchmarkRun(run: BenchmarkRun, outPath?: string, workspaceWrite?: BenchmarkRunWriteResult): void {
  console.log(`${run.title} (${run.suiteId})`);
  console.log(`Passed: ${run.passed}/${run.total}`);
  console.log(`Trust accuracy: ${(run.trustAccuracy * 100).toFixed(1)}%`);
  console.log("");

  for (const result of run.results) {
    const status = result.passed ? "PASS" : "FAIL";
    console.log(`${status} ${result.task.id}: ${result.receipt.trust} - ${result.receipt.summary}`);

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
  console.log(`Theorem benchmark artifacts: ${artifacts.length}`);

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

  console.log(`Theorem claim check: ${passed}/${total} passed`);
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
  console.log(result.created ? "Initialized Theorem workspace" : `Theorem workspace already exists${repaired}`);
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
  console.log("Theorem workspace status");
  console.log(`Root: ${status.root}`);
  console.log(`Manifest: ${status.manifestPath}`);

  if (!status.exists) {
    console.log("Status: missing");
    console.log("Next: theorem workspace init");
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
    console.log("Next: theorem workspace repair");
  }
}

function workspaceStatusHasProblems(status: LocalWorkspaceStatus): boolean {
  return status.exists && (status.missingDirectories.length > 0 || Boolean(status.manifestRepair));
}

function printWorkspaceRepair(result: LocalWorkspaceRepairResult): void {
  console.log(result.repaired ? "Repaired Theorem workspace" : "Theorem workspace already healthy");
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
  console.log("Theorem workspace validation");
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
  console.log(`Theorem workspace snapshots: ${snapshots.length}`);

  for (const snapshot of snapshots) {
    console.log("");
    console.log(`${snapshot.snapshotId} ${snapshot.createdAt}`);
    console.log(`  Path: ${snapshot.path}`);
    console.log(`  Files: ${snapshot.totalFiles}`);
    console.log(`  Bytes: ${snapshot.totalBytes}`);
    console.log(`  Kinds: ${formatRecordCounts(snapshot.byKind)}`);
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
  console.log(`Theorem literature records: ${records.length}`);

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
  console.log(`Theorem notebook run records: ${records.length}`);

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
  console.log(`Theorem code runs: ${records.length}`);

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
  console.log(`Theorem simulation logs: ${entries.length}`);

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
  console.log(`Theorem experiment logs: ${entries.length}`);

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
  console.log(`Theorem vault entries: ${entries.length}`);

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
  console.log(`Theorem evidence audits: ${audits.length}`);

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
  console.log(`Theorem validation plans: ${plans.length}`);

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

function printResearchSessionList(sessions: ResearchSession[]): void {
  console.log(`Theorem research sessions: ${sessions.length}`);

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
  console.log(`Theorem expert reviews: ${reviews.length}`);

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
  console.log(`Theorem invention logs: ${entries.length}`);

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
  console.log(`Theorem claim charts: ${charts.length}`);

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
  console.log(`Theorem model-context packets: ${packets.length}`);

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
  console.log(`Theorem external disclosures: ${entries.length}`);

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
    maybeKind === "disclosure" ||
    maybeKind === "simulation" ||
    maybeKind === "experiment" ||
    maybeKind === "vault" ||
    maybeKind === "review" ||
    maybeKind === "validation" ||
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
  previous.push(value);
  return previous;
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${JSON.stringify(value)}.`);
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

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/.test(value) ? value : JSON.stringify(value);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
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
