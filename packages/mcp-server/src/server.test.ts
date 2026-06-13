import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createTheoremMcpServer } from "./index.js";

const tempRoots: string[] = [];
const originalWorkspaceRoot = process.env.THEOREM_WORKBENCH_ROOT;
const originalLeanCommand = process.env.THEOREM_LEAN;
const originalCodeRunOptIn = process.env.THEOREM_ALLOW_CODE_RUN;
const originalUnsandboxedCodeRunOptIn = process.env.THEOREM_ALLOW_UNSANDBOXED_CODE_RUN;
const vaultKeyEnv = "THEOREM_WORKBENCH_SERVER_TEST_VAULT_KEY";
const originalVaultKey = process.env[vaultKeyEnv];

afterEach(async () => {
  restoreWorkspaceRoot();
  restoreLeanCommand();
  restoreCodeRunOptIn();
  restoreUnsandboxedCodeRunOptIn();
  restoreVaultKey();
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("Theorem MCP server", () => {
  it("lists and calls theorem tools over MCP", async () => {
    const root = await tempRoot();
    process.env.THEOREM_WORKBENCH_ROOT = root;
    await writeFile(
      join(root, "agent-notes.md"),
      "# Agent Notes\n\nLocal source citations support agent research without claiming proof.",
      "utf8"
    );
    await writeFile(
      join(root, "failing-benchmark.json"),
      `${JSON.stringify(
        {
          id: "server-failing",
          title: "Server Failing",
          description: "Tiny benchmark suite for MCP gate failure.",
          tasks: [
            {
              id: "wrong-trust",
              prompt: "compute 2 + 2",
              expectTrust: "refuted"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(join(root, "private-notes.md"), "private cancer hypothesis note stays local", "utf8");
    await writeFile(join(root, "example.lean"), "example : True := by trivial\n", "utf8");
    await writeFile(
      join(root, "constraints.smt2"),
      "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      "utf8"
    );
    process.env[vaultKeyEnv] = "server vault test passphrase";
    process.env.THEOREM_LEAN = "theorem-workbench-missing-lean-command";
    process.env.THEOREM_ALLOW_CODE_RUN = "1";
    process.env.THEOREM_ALLOW_UNSANDBOXED_CODE_RUN = "1";
    const server = createTheoremMcpServer();
    const client = new Client({ name: "theorem-workbench-test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "theorem_ask",
        "theorem_benchmark_compare",
        "theorem_benchmark_list",
        "theorem_benchmark_run",
        "theorem_cas_backends",
        "theorem_cas_check",
        "theorem_cas_list",
        "theorem_claim_add",
        "theorem_claim_chart",
        "theorem_claim_chart_list",
        "theorem_claim_list",
        "theorem_claim_review",
        "theorem_claim_show",
        "theorem_code_list",
        "theorem_code_run",
        "theorem_code_sandbox_status",
        "theorem_disclosure_list",
        "theorem_disclosure_log",
        "theorem_discovery_package",
        "theorem_engine_manifest",
        "theorem_evidence_audit",
        "theorem_evidence_audit_list",
        "theorem_experiment_list",
        "theorem_experiment_log",
        "theorem_expert_review_list",
        "theorem_expert_review_log",
        "theorem_invention_list",
        "theorem_invention_log",
        "theorem_literature_list",
        "theorem_literature_log",
        "theorem_model_context_list",
        "theorem_model_context_prepare",
        "theorem_notebook_run_list",
        "theorem_notebook_run_log",
        "theorem_proof_backends",
        "theorem_proof_check",
        "theorem_proof_list",
        "theorem_render_receipt",
        "theorem_replay",
        "theorem_research_session_checkpoint",
        "theorem_research_session_list",
        "theorem_research_session_start",
        "theorem_route_list",
        "theorem_route_satisfy",
        "theorem_route_show",
        "theorem_simulation_list",
        "theorem_simulation_log",
        "theorem_smt_backends",
        "theorem_smt_check",
        "theorem_smt_list",
        "theorem_smt_solve",
        "theorem_source_cite",
        "theorem_source_ingest",
        "theorem_source_search",
        "theorem_validation_plan",
        "theorem_validation_plan_list",
        "theorem_vault_list",
        "theorem_vault_seal",
        "theorem_vault_verify",
        "theorem_verify",
        "theorem_workspace_init",
        "theorem_workspace_repair",
        "theorem_workspace_snapshot",
        "theorem_workspace_snapshot_list",
        "theorem_workspace_snapshot_verify",
        "theorem_workspace_status",
        "theorem_workspace_validate"
      ]);

      const result = await client.callTool({
        name: "theorem_ask",
        arguments: {
          problem: "for all integers n, n^2+n+1 is even"
        }
      });

      expect(result.isError).toBe(false);
      const text = firstText(result.content);
      expect(text).toContain("\"trust\": \"refuted\"");

      const verifyResult = await client.callTool({
        name: "theorem_verify",
        arguments: {
          problem: "compute 3 / 4 + 5 / 8",
          maximaCommand: "theorem-workbench-missing-maxima-command",
          leanCommand: "theorem-workbench-missing-lean-command",
          z3Command: "theorem-workbench-missing-z3-command",
          timeoutMs: 50
        }
      });
      expect(verifyResult.isError).toBe(false);
      const verifyText = firstText(verifyResult.content);
      expect(verifyText).toContain("\"schemaVersion\": \"theorem.verifier-route.v0\"");
      expect(verifyText).toContain("\"finalTrust\": \"exact-computed\"");
      expect(verifyText).toContain("\"capabilityId\": \"local-rational-arithmetic\"");

      const casBackends = await client.callTool({
        name: "theorem_cas_backends",
        arguments: {
          maximaCommand: "theorem-workbench-missing-maxima-command",
          timeoutMs: 1000
        }
      });
      const casBackendText = firstText(casBackends.content);
      expect(casBackendText).toContain("\"schemaVersion\": \"theorem.cas-backends.v0\"");
      expect(casBackendText).toContain("\"backendId\": \"maxima\"");
      expect(casBackendText).toContain("\"statusProbeIsNotCheck\": true");

      const casCheck = await client.callTool({
        name: "theorem_cas_check",
        arguments: {
          operation: "simplify",
          expression: "sin(x)^2 + cos(x)^2",
          result: "1",
          variable: "x",
          maximaCommand: "theorem-workbench-missing-maxima-command",
          timeoutMs: 50,
          failOnUnverified: true
        }
      });
      expect(casCheck.isError).toBe(true);
      const casCheckText = firstText(casCheck.content);
      expect(casCheckText).toContain("\"schemaVersion\": \"theorem.cas-check.v0\"");
      expect(casCheckText).toContain("\"trust\": \"unverified\"");
      expect(casCheckText).toContain("\"proofCheckerBacked\": false");

      const engineManifest = await client.callTool({
        name: "theorem_engine_manifest",
        arguments: {
          maximaCommand: "theorem-workbench-missing-maxima-command",
          leanCommand: "theorem-workbench-missing-lean-command",
          z3Command: "theorem-workbench-missing-z3-command",
          timeoutMs: 50
        }
      });
      const engineManifestText = firstText(engineManifest.content);
      expect(engineManifestText).toContain("\"schemaVersion\": \"theorem.engine-manifest.v0\"");
      expect(engineManifestText).toContain("\"id\": \"local-rational-arithmetic\"");
      expect(engineManifestText).toContain("\"statusProbeIsNotEvidence\": true");

      const proofBackends = await client.callTool({
        name: "theorem_proof_backends",
        arguments: {
          timeoutMs: 1000
        }
      });
      const proofBackendText = firstText(proofBackends.content);
      expect(proofBackendText).toContain("\"schemaVersion\": \"theorem.proof-backends.v0\"");
      expect(proofBackendText).toContain("\"backendId\": \"lean\"");
      expect(proofBackendText).toContain("\"statusProbeIsNotProof\": true");

      const proofCheck = await client.callTool({
        name: "theorem_proof_check",
        arguments: {
          sourcePath: "example.lean",
          theoremName: "example_true",
          failOnUnproved: true
        }
      });
      expect(proofCheck.isError).toBe(true);
      const proofCheckText = firstText(proofCheck.content);
      expect(proofCheckText).toContain("\"schemaVersion\": \"theorem.proof-check.v0\"");
      expect(proofCheckText).toContain("\"trust\": \"unverified\"");
      expect(proofCheckText).toContain("\"proofCheckerBacked\": false");

      const benchmarkGate = await client.callTool({
        name: "theorem_benchmark_run",
        arguments: {
          suitePath: "failing-benchmark.json",
          failOnFailures: true
        }
      });
      expect(benchmarkGate.isError).toBe(true);
      expect(firstText(benchmarkGate.content)).toContain("\"failed\": 1");

      const renderResult = await client.callTool({
        name: "theorem_render_receipt",
        arguments: {
          receiptJson: JSON.stringify(JSON.parse(text).receipt),
          format: "markdown"
        }
      });
      const renderedText = firstText(renderResult.content);
      expect(renderedText).toContain("# Theorem Receipt");
      expect(renderedText).toContain("refuted");

      const workspaceResult = await client.callTool({
        name: "theorem_workspace_init",
        arguments: {
          name: "MCP Protocol Lab"
        }
      });
      expect(firstText(workspaceResult.content)).toContain("\"networkAccess\": \"none\"");

      const casCheckWrite = await client.callTool({
        name: "theorem_cas_check",
        arguments: {
          operation: "simplify",
          expression: "sin(x)^2 + cos(x)^2",
          result: "1",
          variable: "x",
          maximaCommand: "theorem-workbench-missing-maxima-command",
          timeoutMs: 50,
          write: true
        }
      });
      const casCheckWriteText = firstText(casCheckWrite.content);
      expect(casCheckWrite.isError).toBe(false);
      expect(casCheckWriteText).toContain("\"written\": true");
      expect(casCheckWriteText).toContain("\"schemaVersion\": \"theorem.cas-check.v0\"");

      const casList = await client.callTool({
        name: "theorem_cas_list",
        arguments: {}
      });
      expect(firstText(casList.content)).toContain("\"total\": 1");

      const routeWrite = await client.callTool({
        name: "theorem_verify",
        arguments: {
          problem: "compute 3 / 4 + 5 / 8",
          write: true,
          maximaCommand: "theorem-workbench-missing-maxima-command",
          leanCommand: "theorem-workbench-missing-lean-command",
          z3Command: "theorem-workbench-missing-z3-command",
          timeoutMs: 50
        }
      });
      expect(routeWrite.isError).toBe(false);
      const routeWriteJson = JSON.parse(firstText(routeWrite.content)) as {
        written: boolean;
        route: { routeId: string };
      };
      expect(routeWriteJson.written).toBe(true);

      const routeList = await client.callTool({
        name: "theorem_route_list",
        arguments: {}
      });
      expect(firstText(routeList.content)).toContain("\"total\": 1");

      const routeShow = await client.callTool({
        name: "theorem_route_show",
        arguments: {
          routeRef: routeWriteJson.route.routeId
        }
      });
      expect(firstText(routeShow.content)).toContain(routeWriteJson.route.routeId);

      const proofCheckWrite = await client.callTool({
        name: "theorem_proof_check",
        arguments: {
          sourcePath: "example.lean",
          theoremName: "example_true",
          write: true
        }
      });
      const proofCheckWriteText = firstText(proofCheckWrite.content);
      expect(proofCheckWrite.isError).toBe(false);
      expect(proofCheckWriteText).toContain("\"written\": true");
      expect(proofCheckWriteText).toContain("\"schemaVersion\": \"theorem.proof-check.v0\"");

      const proofList = await client.callTool({
        name: "theorem_proof_list",
        arguments: {}
      });
      expect(firstText(proofList.content)).toContain("\"total\": 1");

      const smtBackends = await client.callTool({
        name: "theorem_smt_backends",
        arguments: {
          z3Command: "theorem-workbench-missing-z3-command",
          timeoutMs: 1000
        }
      });
      const smtBackendText = firstText(smtBackends.content);
      expect(smtBackendText).toContain("\"schemaVersion\": \"theorem.smt-backends.v0\"");
      expect(smtBackendText).toContain("\"backendId\": \"z3\"");
      expect(smtBackendText).toContain("\"statusProbeIsNotCheck\": true");

      const smtCheckWrite = await client.callTool({
        name: "theorem_smt_check",
        arguments: {
          sourcePath: "constraints.smt2",
          queryName: "positive_integer_model",
          z3Command: "theorem-workbench-missing-z3-command",
          write: true
        }
      });
      const smtCheckWriteText = firstText(smtCheckWrite.content);
      expect(smtCheckWrite.isError).toBe(false);
      expect(smtCheckWriteText).toContain("\"written\": true");
      expect(smtCheckWriteText).toContain("\"schemaVersion\": \"theorem.smt-check.v0\"");
      expect(smtCheckWriteText).toContain("\"trust\": \"unverified\"");

      const smtList = await client.callTool({
        name: "theorem_smt_list",
        arguments: {}
      });
      expect(firstText(smtList.content)).toContain("\"total\": 1");

      const smtSolve = await client.callTool({
        name: "theorem_smt_solve",
        arguments: {
          queryName: "small_positive_integer",
          integerVariables: ["x"],
          constraints: ["x > 0", "x < 3"],
          z3Command: "theorem-workbench-missing-z3-command",
          failOnUnverified: true
        }
      });
      const smtSolveText = firstText(smtSolve.content);
      expect(smtSolve.isError).toBe(true);
      expect(smtSolveText).toContain("\"problemId\": \"smt_problem_");
      expect(smtSolveText).toContain("\"sourceRef\": \".theorem-workbench/smt/sources/");
      expect(smtSolveText).toContain("\"trust\": \"unverified\"");

      const snapshotResult = await client.callTool({
        name: "theorem_workspace_snapshot",
        arguments: {}
      });
      const snapshotText = firstText(snapshotResult.content);
      expect(snapshotText).toContain("\"schemaVersion\": \"theorem.workspace-snapshot.v0\"");
      expect(snapshotText).toContain("\"workspaceDir\": \".theorem-workbench\"");

      const snapshotListResult = await client.callTool({
        name: "theorem_workspace_snapshot_list",
        arguments: {}
      });
      expect(firstText(snapshotListResult.content)).toContain("\"total\": 1");

      const snapshotVerifyResult = await client.callTool({
        name: "theorem_workspace_snapshot_verify",
        arguments: {
          snapshotRef: JSON.parse(snapshotText).snapshot.snapshotId
        }
      });
      const snapshotVerifyText = firstText(snapshotVerifyResult.content);
      expect(snapshotVerifyText).toContain("\"passed\": true");

      const researchStartResult = await client.callTool({
        name: "theorem_research_session_start",
        arguments: {
          title: "Protocol research runbook",
          objective: "Investigate a cancer pathway hypothesis with local evidence and no cure claim.",
          domains: ["biomedical"],
          evidenceRefs: [
            {
              kind: "snapshot",
              ref: JSON.parse(snapshotText).snapshot.snapshotId
            }
          ],
          snapshotRefs: [JSON.parse(snapshotText).snapshot.snapshotId],
          tasks: ["Attach source evidence", "Audit the claim posture"]
        }
      });
      const researchStartText = firstText(researchStartResult.content);
      expect(researchStartText).toContain("\"schemaVersion\": \"theorem.research-session.v0\"");
      expect(researchStartText).toContain("\"hostedModels\": \"optional-with-disclosure\"");
      expect(researchStartText).toContain("Do not describe biomedical hypotheses as cures");

      const researchCheckpointResult = await client.callTool({
        name: "theorem_research_session_checkpoint",
        arguments: {
          sessionRef: JSON.parse(researchStartText).session.sessionId,
          summary: "Protocol checkpoint recorded before attaching stronger evidence.",
          snapshotRefs: [JSON.parse(snapshotText).snapshot.snapshotId],
          decisions: ["Keep this as a computational hypothesis."],
          nextChecks: ["Run evidence audit after simulation and source refs exist."]
        }
      });
      const researchCheckpointText = firstText(researchCheckpointResult.content);
      expect(researchCheckpointText).toContain("\"checkpointId\": \"chk_");

      const researchListResult = await client.callTool({
        name: "theorem_research_session_list",
        arguments: {}
      });
      expect(firstText(researchListResult.content)).toContain("\"total\": 1");

      const expertReviewResult = await client.callTool({
        name: "theorem_expert_review_log",
        arguments: {
          subject: "Protocol cancer pathway simulation review",
          question: "Does the local evidence justify a cure claim?",
          kind: "biomedical",
          status: "requested",
          reviewerRole: "oncology domain expert",
          evidenceRefs: [
            {
              kind: "snapshot",
              ref: JSON.parse(snapshotText).snapshot.snapshotId
            }
          ],
          requiredNextChecks: ["Attach wet-lab validation plan before stronger claims."]
        }
      });
      const expertReviewText = firstText(expertReviewResult.content);
      expect(expertReviewText).toContain("\"schemaVersion\": \"theorem.expert-review.v0\"");
      expect(expertReviewText).toContain("\"notMedicalAdvice\": true");

      const expertReviewList = await client.callTool({
        name: "theorem_expert_review_list",
        arguments: {}
      });
      expect(firstText(expertReviewList.content)).toContain("\"total\": 1");

      const ingestResult = await client.callTool({
        name: "theorem_source_ingest",
        arguments: {
          paths: ["agent-notes.md"]
        }
      });
      expect(firstText(ingestResult.content)).toContain("\"totalDocuments\": 1");

      const searchResult = await client.callTool({
        name: "theorem_source_search",
        arguments: {
          query: "source citations",
          limit: 1
        }
      });
      const searchText = firstText(searchResult.content);
      expect(searchText).toContain("\"trust\": \"source-cited\"");

      const sourceCiteResult = await client.callTool({
        name: "theorem_source_cite",
        arguments: {
          claim: "Local source citations support agent research without claiming proof.",
          query: "source citations agent research",
          strict: true
        }
      });
      const sourceCiteText = firstText(sourceCiteResult.content);
      expect(sourceCiteText).toContain("\"trust\": \"source-cited\"");
      expect(sourceCiteText).toContain("\"kind\": \"source\"");

      const literatureResult = await client.callTool({
        name: "theorem_literature_log",
        arguments: {
          title: "Protocol local source record",
          kind: "note",
          status: "annotated",
          identifiers: [{ kind: "local-path", value: "agent-notes.md" }],
          localRefs: ["agent-notes.md"],
          corpusRefs: [JSON.parse(searchText).hits[0].citation.path],
          keyClaims: ["Local source citations support agent research without claiming proof."],
          methodNotes: ["Protocol test note, not peer-reviewed literature."],
          limitations: ["No external validation."],
          relevance: ["Agent evidence workflow protocol test."],
          write: true
        }
      });
      const literatureText = firstText(literatureResult.content);
      expect(literatureText).toContain("\"schemaVersion\": \"theorem.literature.v0\"");
      expect(literatureText).toContain("\"sourceRetrievalIsNotEntailment\": true");

      const literatureList = await client.callTool({
        name: "theorem_literature_list",
        arguments: {}
      });
      expect(firstText(literatureList.content)).toContain("\"total\": 1");

      const notebookRunResult = await client.callTool({
        name: "theorem_notebook_run_log",
        arguments: {
          title: "Protocol notebook run",
          purpose: "Run a local notebook that computes a toy pathway score with review caveats.",
          kind: "notebook",
          status: "completed",
          runner: "jupyter",
          command: "jupyter nbconvert --execute notebooks/protocol.ipynb",
          notebookRefs: ["notebooks/protocol.ipynb"],
          codeRefs: ["src/protocol.py"],
          inputRefs: ["data/protocol.csv"],
          outputRefs: ["artifacts/protocol-output.json"],
          runtime: "python",
          runtimeVersion: "3.12",
          dependencies: ["sympy==1.14.0"],
          metrics: [{ name: "pathway_score_delta", value: "-0.18" }],
          limitations: ["Protocol test only."],
          write: true
        }
      });
      const notebookRunText = firstText(notebookRunResult.content);
      expect(notebookRunText).toContain("\"schemaVersion\": \"theorem.notebook-run.v0\"");
      expect(notebookRunText).toContain("\"executionNotPerformedByWorkbench\": true");

      const notebookRunList = await client.callTool({
        name: "theorem_notebook_run_list",
        arguments: {}
      });
      expect(firstText(notebookRunList.content)).toContain("\"total\": 1");

      const codeSandboxStatus = await client.callTool({
        name: "theorem_code_sandbox_status",
        arguments: {}
      });
      const codeSandboxStatusText = firstText(codeSandboxStatus.content);
      const codeSandboxStatusJson = JSON.parse(codeSandboxStatusText) as {
        status: { available: boolean; provider: string; canAttestNetworkNone: boolean };
      };
      expect(codeSandboxStatus.isError).toBe(!codeSandboxStatusJson.status.available);
      expect(codeSandboxStatusText).toContain("\"schemaVersion\": \"theorem.code-run-sandbox-status.v0\"");
      if (codeSandboxStatusJson.status.available) {
        expect(codeSandboxStatusJson.status.provider).toBe("container");
        expect(codeSandboxStatusJson.status.canAttestNetworkNone).toBe(true);
      } else {
        expect(codeSandboxStatusJson.status.provider).toBe("none");
        expect(codeSandboxStatusJson.status.canAttestNetworkNone).toBe(false);
      }

      const codeRunResult = await client.callTool({
        name: "theorem_code_run",
        arguments: {
          title: "Protocol code run",
          purpose: "Run a tiny local command and capture direct process evidence.",
          command: process.execPath,
          args: ["-e", "console.log('server-code-run')"],
          codeRefs: ["inline:node-eval"],
          inputRefs: ["prompt:server-code-run"],
          outputRefs: ["stdout"],
          policy: {
            allowedExecutables: [process.execPath]
          },
          failOnNonzero: true
        }
      });
      const codeRunText = firstText(codeRunResult.content);
      expect(codeRunResult.isError).toBe(false);
      expect(codeRunText).toContain("\"schemaVersion\": \"theorem.code-run.v0\"");
      expect(codeRunText).toContain("\"shell\": false");
      expect(codeRunText).toContain("server-code-run");

      const codeRunList = await client.callTool({
        name: "theorem_code_list",
        arguments: {}
      });
      expect(firstText(codeRunList.content)).toContain("\"total\": 1");

      const simulationResult = await client.callTool({
        name: "theorem_simulation_log",
        arguments: {
          title: "Protocol simulation",
          question: "Does a toy agent simulation preserve validation caveats?",
          kind: "agentic",
          stage: "computed",
          engine: "local test harness",
          modelName: "toy agent model",
          metrics: [{ name: "caveat_score", value: "1" }],
          assumptions: ["Protocol test only."],
          uncertainty: ["No real-world calibration."],
          limitations: ["No external validation."],
          nextChecks: ["Review generated evidence."]
        }
      });
      const simulationText = firstText(simulationResult.content);
      expect(simulationText).toContain("\"schemaVersion\": \"theorem.simulation.v0\"");
      expect(simulationText).toContain("\"simulationIsNotReality\": true");

      const simulationList = await client.callTool({
        name: "theorem_simulation_list",
        arguments: {}
      });
      expect(firstText(simulationList.content)).toContain("\"total\": 1");

      const experimentResult = await client.callTool({
        name: "theorem_experiment_log",
        arguments: {
          title: "Protocol experiment",
          question: "Does a toy protocol preserve experiment review caveats?",
          kind: "bench",
          stage: "completed",
          protocolRefs: ["protocols/protocol-test.md"],
          dataRefs: ["data/protocol-test.csv"],
          analysisRefs: ["notebooks/protocol-test.ipynb"],
          observations: ["Observed a protocol-test marker."],
          measurements: [{ name: "marker_delta", value: "-0.1", unit: "a.u." }],
          outcomeSummary: "Protocol test observation only.",
          limitations: ["No external validation."],
          nextChecks: ["Independent replication."]
        }
      });
      const experimentText = firstText(experimentResult.content);
      expect(experimentText).toContain("\"schemaVersion\": \"theorem.experiment.v0\"");
      expect(experimentText).toContain("\"notRegulatoryApproval\": true");

      const experimentList = await client.callTool({
        name: "theorem_experiment_list",
        arguments: {}
      });
      expect(firstText(experimentList.content)).toContain("\"total\": 1");

      const vaultResult = await client.callTool({
        name: "theorem_vault_seal",
        arguments: {
          sourcePath: "private-notes.md",
          label: "Private hypothesis notes",
          keyEnv: vaultKeyEnv
        }
      });
      const vaultText = firstText(vaultResult.content);
      expect(vaultText).toContain("\"schemaVersion\": \"theorem.vault.v0\"");
      expect(vaultText).toContain("\"keyPolicy\": \"environment-only\"");
      expect(vaultText).not.toContain("private cancer hypothesis");
      expect(vaultText).not.toContain("private-notes.md");

      const vaultVerify = await client.callTool({
        name: "theorem_vault_verify",
        arguments: {
          vaultRef: JSON.parse(vaultText).entry.vaultId,
          keyEnv: vaultKeyEnv
        }
      });
      const vaultVerifyText = firstText(vaultVerify.content);
      expect(vaultVerifyText).toContain("\"verified\": true");
      expect(vaultVerifyText).toContain("\"sourceRef\": \"private-notes.md\"");
      expect(vaultVerifyText).not.toContain("private cancer hypothesis");

      const vaultList = await client.callTool({
        name: "theorem_vault_list",
        arguments: {}
      });
      expect(firstText(vaultList.content)).toContain("\"total\": 1");

      const auditResult = await client.callTool({
        name: "theorem_evidence_audit",
        arguments: {
          claim: "This simulated candidate cures cancer safely.",
          evidenceRefs: [
            {
              kind: "simulation",
              ref: JSON.parse(simulationText).entry.simulationId
            },
            {
              kind: "literature",
              ref: JSON.parse(literatureText).result.record.recordId
            },
            {
              kind: "notebook-run",
              ref: JSON.parse(notebookRunText).result.record.runRecordId
            },
            {
              kind: "code-run",
              ref: JSON.parse(codeRunText).result.record.runId
            },
            {
              kind: "vault",
              ref: JSON.parse(vaultText).entry.vaultId
            }
          ],
          writeReport: true
        }
      });
      const auditText = firstText(auditResult.content);
      expect(auditText).toContain("\"schemaVersion\": \"theorem.evidence-audit.v0\"");
      expect(auditText).toContain("\"status\": \"overclaimed\"");
      expect(auditText).toContain("Biomedical claims require expert review");
      expect(auditText).toContain("\"markdownPath\"");
      expect(auditText).toContain("| Verdict | `overclaimed` |");

      const auditList = await client.callTool({
        name: "theorem_evidence_audit_list",
        arguments: {}
      });
      expect(firstText(auditList.content)).toContain("\"total\": 1");

      const validationPlanResult = await client.callTool({
        name: "theorem_validation_plan",
        arguments: {
          claim: "This simulated candidate cures cancer safely.",
          evidenceRefs: [
            {
              kind: "simulation",
              ref: JSON.parse(simulationText).entry.simulationId
            },
            {
              kind: "review",
              ref: JSON.parse(expertReviewText).review.reviewId
            }
          ],
          write: true
        }
      });
      const validationPlanText = firstText(validationPlanResult.content);
      expect(validationPlanText).toContain("\"schemaVersion\": \"theorem.validation-plan.v0\"");
      expect(validationPlanText).toContain("\"status\": \"ready-for-review\"");
      expect(validationPlanText).toContain("\"kind\": \"wet-lab\"");
      expect(validationPlanText).toContain("\"markdownPath\"");

      const validationPlanList = await client.callTool({
        name: "theorem_validation_plan_list",
        arguments: {}
      });
      expect(firstText(validationPlanList.content)).toContain("\"total\": 1");

      const inventionResult = await client.callTool({
        name: "theorem_invention_log",
        arguments: {
          hypothesis: "A source-cited chunk can support an agent hypothesis without proving it.",
          evidenceRefs: [
            {
              kind: "source",
              ref: JSON.parse(searchText).hits[0].citation.path,
              trust: "source-cited"
            },
            {
              kind: "simulation",
              ref: JSON.parse(simulationText).entry.simulationId,
              summary: "Protocol simulation caveat check."
            },
            {
              kind: "experiment",
              ref: JSON.parse(experimentText).entry.experimentId,
              summary: "Protocol experiment caveat check."
            },
            {
              kind: "code-run",
              ref: JSON.parse(codeRunText).result.record.runId,
              summary: "Protocol code execution check."
            }
          ]
        }
      });
      expect(firstText(inventionResult.content)).toContain("\"legalConclusion\": \"not-a-legal-opinion\"");

      const inventionList = await client.callTool({
        name: "theorem_invention_list",
        arguments: {}
      });
      expect(firstText(inventionList.content)).toContain("\"total\": 1");

      const packageResult = await client.callTool({
        name: "theorem_discovery_package",
        arguments: {
          write: false
        }
      });
      const packageText = firstText(packageResult.content);
      expect(packageText).toContain("\"schemaVersion\": \"theorem.discovery-package.v0\"");
      expect(packageText).toContain("not-a-legal-opinion");

      const claimChartResult = await client.callTool({
        name: "theorem_claim_chart",
        arguments: {
          write: true,
          elements: [
            {
              text: "A candidate agent claim element with local source and simulation provenance.",
              priorArtRefs: [JSON.parse(searchText).hits[0].citation.path]
            }
          ],
          priorArtNotes: ["Protocol test prior-art note."],
          reductionToPracticeRefs: [JSON.parse(simulationText).entry.simulationId]
        }
      });
      const claimChartText = firstText(claimChartResult.content);
      expect(claimChartText).toContain("\"schemaVersion\": \"theorem.claim-chart.v0\"");
      expect(claimChartText).toContain("\"legalConclusion\": \"not-a-legal-opinion\"");

      const claimChartList = await client.callTool({
        name: "theorem_claim_chart_list",
        arguments: {}
      });
      expect(firstText(claimChartList.content)).toContain("\"total\": 1");

      const modelContextResult = await client.callTool({
        name: "theorem_model_context_prepare",
        arguments: {
          service: "OpenAI",
          model: "frontier-reasoning-model",
          purpose: "Critique a selected agent hypothesis before local verification.",
          dataClasses: ["selected hypothesis", "selected source citation"],
          selectedContextRefs: [JSON.parse(searchText).hits[0].citation.path],
          sections: [
            {
              title: "Selected hypothesis",
              content: "Critique only this selected hypothesis and citation; do not infer from local files.",
              sourceRefs: [JSON.parse(searchText).hits[0].citation.path]
            }
          ],
          redactions: ["Private notes, vault plaintext, and unrelated workspace history are excluded."],
          approvalRef: "prompt:explicit-user-request",
          write: true
        }
      });
      const modelContextText = firstText(modelContextResult.content);
      expect(modelContextText).toContain("\"schemaVersion\": \"theorem.model-context.v0\"");
      expect(modelContextText).toContain("\"externalCallNotPerformed\": true");
      expect(modelContextText).toContain("\"status\": \"required-not-created\"");

      const modelContextList = await client.callTool({
        name: "theorem_model_context_list",
        arguments: {}
      });
      expect(firstText(modelContextList.content)).toContain("\"total\": 1");

      const disclosureResult = await client.callTool({
        name: "theorem_disclosure_log",
        arguments: {
          service: "OpenAI",
          model: "frontier-reasoning-model",
          purpose: "Critique a selected agent hypothesis before local verification.",
          dataClasses: ["selected hypothesis", "selected source citation"],
          contextSummary: "Only the selected hypothesis and one citation ref are sent; local files stay local.",
          selectedContextRefs: [JSON.parse(searchText).hits[0].citation.path],
          approvalRef: "prompt:explicit-user-request",
          status: "sent"
        }
      });
      const disclosureText = firstText(disclosureResult.content);
      expect(disclosureText).toContain("\"schemaVersion\": \"theorem.disclosure.v0\"");
      expect(disclosureText).toContain("\"mode\": \"external-calls\"");

      const disclosureList = await client.callTool({
        name: "theorem_disclosure_list",
        arguments: {}
      });
      expect(firstText(disclosureList.content)).toContain("\"total\": 1");
    } finally {
      await client.close();
      await server.close();
    }
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-mcp-protocol-"));
  tempRoots.push(root);
  return root;
}

function restoreWorkspaceRoot(): void {
  if (originalWorkspaceRoot === undefined) {
    delete process.env.THEOREM_WORKBENCH_ROOT;
    return;
  }

  process.env.THEOREM_WORKBENCH_ROOT = originalWorkspaceRoot;
}

function restoreLeanCommand(): void {
  if (originalLeanCommand === undefined) {
    delete process.env.THEOREM_LEAN;
    return;
  }

  process.env.THEOREM_LEAN = originalLeanCommand;
}

function restoreCodeRunOptIn(): void {
  if (originalCodeRunOptIn === undefined) {
    delete process.env.THEOREM_ALLOW_CODE_RUN;
    return;
  }

  process.env.THEOREM_ALLOW_CODE_RUN = originalCodeRunOptIn;
}

function restoreUnsandboxedCodeRunOptIn(): void {
  if (originalUnsandboxedCodeRunOptIn === undefined) {
    delete process.env.THEOREM_ALLOW_UNSANDBOXED_CODE_RUN;
    return;
  }

  process.env.THEOREM_ALLOW_UNSANDBOXED_CODE_RUN = originalUnsandboxedCodeRunOptIn;
}

function restoreVaultKey(): void {
  if (originalVaultKey === undefined) {
    delete process.env[vaultKeyEnv];
    return;
  }

  process.env[vaultKeyEnv] = originalVaultKey;
}

function firstText(content: unknown): string {
  const items = Array.isArray(content) ? content : [];
  const first = items[0];
  return first && typeof first === "object" && "type" in first && first.type === "text" && "text" in first
    ? String(first.text)
    : "";
}
