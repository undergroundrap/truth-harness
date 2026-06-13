#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  handleTruthHarnessAsk,
  handleTruthHarnessBenchmarkCompare,
  handleTruthHarnessBenchmarkList,
  handleTruthHarnessBenchmarkRun,
  handleTruthHarnessCasBackends,
  handleTruthHarnessCasCheck,
  handleTruthHarnessCasList,
  truthHarnessBenchmarkCompareOutputFailsGate,
  truthHarnessBenchmarkRunOutputFailsGate,
  handleTruthHarnessClaimAdd,
  handleTruthHarnessClaimChart,
  handleTruthHarnessClaimChartList,
  handleTruthHarnessClaimList,
  handleTruthHarnessClaimReview,
  handleTruthHarnessClaimShow,
  handleTruthHarnessCodeRun,
  handleTruthHarnessCodeRunList,
  handleTruthHarnessCodeSandboxStatus,
  handleTruthHarnessDiscoveryPackage,
  handleTruthHarnessEngineManifest,
  handleTruthHarnessEvidenceAudit,
  handleTruthHarnessEvidenceAuditList,
  handleTruthHarnessExpertReviewList,
  handleTruthHarnessExpertReviewLog,
  handleTruthHarnessExperimentList,
  handleTruthHarnessExperimentLog,
  handleTruthHarnessExternalDisclosureList,
  handleTruthHarnessExternalDisclosureLog,
  handleTruthHarnessInventionList,
  handleTruthHarnessInventionLog,
  handleTruthHarnessLiteratureList,
  handleTruthHarnessLiteratureLog,
  handleTruthHarnessModelContextList,
  handleTruthHarnessModelContextPrepare,
  handleTruthHarnessNotebookRunList,
  handleTruthHarnessNotebookRunLog,
  handleTruthHarnessProofBackends,
  handleTruthHarnessProofCheck,
  handleTruthHarnessProofList,
  handleTruthHarnessRenderReceipt,
  handleTruthHarnessReplay,
  handleTruthHarnessResearchSessionCheckpoint,
  handleTruthHarnessResearchSessionList,
  handleTruthHarnessResearchSessionStart,
  handleTruthHarnessRouteList,
  handleTruthHarnessRouteShow,
  handleTruthHarnessRouteSatisfy,
  handleTruthHarnessSimulationList,
  handleTruthHarnessSimulationLog,
  handleTruthHarnessSmtBackends,
  handleTruthHarnessSmtCheck,
  handleTruthHarnessSmtList,
  handleTruthHarnessSmtSolve,
  handleTruthHarnessSourceCite,
  handleTruthHarnessSourceIngest,
  handleTruthHarnessSourceSearch,
  handleTruthHarnessValidationPlan,
  handleTruthHarnessValidationPlanList,
  handleTruthHarnessVaultList,
  handleTruthHarnessVaultSeal,
  handleTruthHarnessVaultVerify,
  handleTruthHarnessVerify,
  handleTruthHarnessWorkspaceInit,
  handleTruthHarnessWorkspaceRepair,
  handleTruthHarnessWorkspaceReview,
  handleTruthHarnessWorkspaceReviewList,
  handleTruthHarnessWorkspaceReviewShow,
  handleTruthHarnessWorkspaceSnapshot,
  handleTruthHarnessWorkspaceSnapshotList,
  handleTruthHarnessWorkspaceSnapshotVerify,
  handleTruthHarnessWorkspaceStatus,
  handleTruthHarnessWorkspaceValidate,
  toolJson
} from "./tools.js";

export function createTruthHarnessMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "truth-harness",
      version: "0.0.0"
    },
    {
      instructions:
        "Use Truth Harness to create replayable proof receipts, search local sources, and maintain local discovery logs. Do not treat unverified outputs, retrieved chunks, or computational hypotheses as proved."
    }
  );

  server.registerTool(
    "truth_harness_ask",
    {
      title: "Create Truth Harness Receipt",
      description:
        "Create a proof receipt for a math prompt with trust labels, evidence graph nodes, artifacts, and replay command.",
      inputSchema: {
        problem: z.string().min(1).describe("Math prompt or claim to check."),
        strict: z
          .boolean()
          .optional()
          .describe("When true, return an MCP tool error if the final trust label is unverified.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ problem, strict }) => {
      const result = handleTruthHarnessAsk({ problem, strict });
      return toolJson(result, { isError: result.error });
    }
  );

  server.registerTool(
    "truth_harness_verify",
    {
      title: "Route and Verify Math Claim",
      description:
        "Create a manifest-aware verifier route plus receipt for a math prompt. Returns used capabilities, missing verifier gaps, next actions, and the final conservative trust label.",
      inputSchema: {
        problem: z.string().min(1).describe("Math prompt or claim to route through local verifiers."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root for writing route artifacts. Defaults to the MCP workspace root."),
        write: z
          .boolean()
          .optional()
          .describe("When true, write JSON and Markdown into .truth-harness/routes."),
        strict: z
          .boolean()
          .optional()
          .describe("When true, return an MCP tool error if the verifier route ends unverified."),
        maximaCommand: z
          .string()
          .optional()
          .describe("Maxima executable path or command for this route."),
        leanCommand: z
          .string()
          .optional()
          .describe("Lean executable path or command for this route."),
        z3Command: z
          .string()
          .optional()
          .describe("Z3 executable path or command for this route."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(10000)
          .optional()
          .describe("Local backend version-probe timeout in milliseconds. Defaults to 1500.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => {
      const result = await handleTruthHarnessVerify(input);
      return toolJson(result, { isError: result.error });
    }
  );

  server.registerTool(
    "truth_harness_route_list",
    {
      title: "List Verifier Routes",
      description:
        "List local truth-harness.verifier-route.v0 artifacts with route ids, trust labels, receipt ids, gaps, and paths agents can cite later.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root containing .truth-harness. Defaults to the MCP workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessRouteList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_route_show",
    {
      title: "Show Verifier Route",
      description:
        "Read a persisted verifier route by route id or workspace-local JSON path so agents can inspect the exact route, receipt, gaps, and replay command.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root containing .truth-harness. Defaults to the MCP workspace root."),
        routeRef: z.string().min(1).describe("Route id such as route_<hash> or workspace-local JSON path.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath, routeRef }) => toolJson(await handleTruthHarnessRouteShow({ workspacePath, routeRef }))
  );

  server.registerTool(
    "truth_harness_route_satisfy",
    {
      title: "Satisfy Verifier Route Obligation",
      description:
        "Attach accepted local evidence to a persisted verifier-route proof obligation. The route is updated only when the evidence trust is strong enough for the obligation.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root containing .truth-harness. Defaults to the MCP workspace root."),
        routeRef: z.string().min(1).describe("Route id such as route_<hash> or workspace-local JSON path."),
        obligationId: z.string().regex(/^obl_[a-f0-9]{16}$/u).describe("Proof obligation id to satisfy."),
        evidenceRef: z
          .object({
            kind: z.enum(["cas", "proof", "smt", "receipt", "route"]),
            ref: z.string().min(1),
            summary: z.string().optional()
          })
          .describe("Local evidence artifact ref, such as { kind: 'proof', ref: '.truth-harness/proofs/check.json' }.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ workspacePath, routeRef, obligationId, evidenceRef }) =>
      toolJson(await handleTruthHarnessRouteSatisfy({ workspacePath, routeRef, obligationId, evidenceRef }))
  );

  const claimTrustSchema = z.enum([
    "proved",
    "exact-computed",
    "bounded-numeric",
    "smt-checked",
    "dimension-checked",
    "source-cited",
    "cross-checked",
    "unverified",
    "refuted"
  ]);
  const claimDomainSchema = z.enum([
    "math",
    "sources",
    "code",
    "data",
    "writing",
    "physics",
    "biology",
    "chemistry",
    "finance",
    "hardware",
    "quantum",
    "security",
    "patent",
    "general"
  ]);
  const claimStatusSchema = z.enum(["active", "superseded", "retracted"]);
  const claimEvidenceRefSchema = z.object({
    kind: z.enum([
      "claim",
      "receipt",
      "artifact",
      "source",
      "literature",
      "notebook",
      "notebook-run",
      "code-run",
      "benchmark",
      "disclosure",
      "simulation",
      "experiment",
      "vault",
      "audit",
      "snapshot",
      "review",
      "validation",
      "model-context",
      "cas",
      "proof",
      "smt",
      "route",
      "invention",
      "claim-chart",
      "discovery-package",
      "other"
    ]),
    ref: z.string().min(1),
    trust: claimTrustSchema.optional(),
    summary: z.string().optional()
  });

  server.registerTool(
    "truth_harness_claim_add",
    {
      title: "Add Claim Ledger Record",
      description:
        "Write a git-like local claim record with claim id, dependencies, supersession links, tags, evidence refs, evidence-backed trust, and finalization gates.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short claim title."),
        statement: z.string().min(1).describe("Exact claim statement to record."),
        domain: claimDomainSchema.optional().describe("Research lane/domain for filtering and review policy."),
        status: claimStatusSchema.optional().describe("Claim lifecycle status. Defaults to active."),
        trust: claimTrustSchema
          .optional()
          .describe("Requested trust label. The recorded claim trust is downgraded unless attached evidence supports it."),
        tags: z.array(z.string().min(1)).optional().describe("Filter tags without # prefix."),
        dependsOn: z.array(z.string().min(1)).optional().describe("Upstream claim ids this claim depends on."),
        supersedes: z.array(z.string().min(1)).optional().describe("Older claim ids this claim replaces or corrects."),
        derivedBy: z.string().optional().describe("Short derivation note explaining how this claim was produced."),
        authors: z.array(z.string().min(1)).optional().describe("Human or agent authors attached to the record."),
        evidenceRefs: z.array(claimEvidenceRefSchema).optional().describe("Local evidence refs supporting or contextualizing the claim."),
        nextChecks: z.array(z.string().min(1)).optional().describe("Open proof, citation, validation, or review checks.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessClaimAdd(input))
  );

  server.registerTool(
    "truth_harness_claim_list",
    {
      title: "List Claim Ledger",
      description:
        "List local claim ledger records and return the dependency/supersession graph for agent follow-up.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        domain: claimDomainSchema.optional().describe("Filter by claim domain."),
        status: claimStatusSchema.optional().describe("Filter by claim lifecycle status."),
        trust: claimTrustSchema.optional().describe("Filter by trust label."),
        tag: z.string().optional().describe("Filter by tag, with or without # prefix.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessClaimList(input))
  );

  server.registerTool(
    "truth_harness_claim_show",
    {
      title: "Show Claim Ledger Record",
      description:
        "Read one local claim ledger record by claim id or workspace-local JSON path, including verification ladder and finalization boundary.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        claimRef: z.string().min(1).describe("Claim id or workspace-local claim JSON path.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessClaimShow(input))
  );

  server.registerTool(
    "truth_harness_claim_review",
    {
      title: "Review Claim Readiness",
      description:
        "Return an actionable read-only claim review packet with readiness, blockers, evidence refs, next actions, and local commands for agents.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        claimRef: z.string().min(1).describe("Claim id or workspace-local claim JSON path.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessClaimReview(input))
  );

  server.registerTool(
    "truth_harness_benchmark_run",
    {
      title: "Run Truth Harness Benchmark",
      description:
        "Run a benchmark suite JSON file and return trust accuracy plus per-task receipt summaries.",
      inputSchema: {
        suitePath: z
          .string()
          .optional()
          .describe("Path under the current workspace. Defaults to packages/benchmarks/suites/foundations-seed.json."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root for writing benchmark records. Defaults to the MCP workspace root."),
        write: z
          .boolean()
          .optional()
          .describe("When true, write JSON and Markdown into .truth-harness/benchmarks. Defaults to false."),
        failOnFailures: z
          .boolean()
          .optional()
          .describe("When true, mark the tool call as an error if any benchmark task fails.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ suitePath, workspacePath, write, failOnFailures }) => {
      const result = await handleTruthHarnessBenchmarkRun({ suitePath, workspacePath, write, failOnFailures });
      return toolJson(result, {
        isError: failOnFailures === true && truthHarnessBenchmarkRunOutputFailsGate(result)
      });
    }
  );

  server.registerTool(
    "truth_harness_benchmark_compare",
    {
      title: "Compare Truth Harness Benchmarks",
      description:
        "Compare two truth-harness.benchmark-run.v0 records and return regressions, improvements, trust-label changes, and suite drift.",
      inputSchema: {
        baselinePath: z.string().describe("Baseline benchmark-run JSON path under the current workspace."),
        currentPath: z.string().describe("Current benchmark-run JSON path under the current workspace."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root for writing comparison records. Defaults to the MCP workspace root."),
        write: z
          .boolean()
          .optional()
          .describe("When true, write JSON and Markdown into .truth-harness/benchmarks. Defaults to false."),
        failOnRegression: z
          .boolean()
          .optional()
          .describe("When true, mark the tool call as an error if the comparison is regressed or incomparable.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ baselinePath, currentPath, workspacePath, write, failOnRegression }) => {
      const result = await handleTruthHarnessBenchmarkCompare({
        baselinePath,
        currentPath,
        workspacePath,
        write,
        failOnRegression
      });
      return toolJson(result, {
        isError: failOnRegression === true && truthHarnessBenchmarkCompareOutputFailsGate(result)
      });
    }
  );

  server.registerTool(
    "truth_harness_benchmark_list",
    {
      title: "List Truth Harness Benchmarks",
      description:
        "List local benchmark run and comparison artifacts with paths agents can reuse for comparisons and evidence refs.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root containing .truth-harness. Defaults to the MCP workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessBenchmarkList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_cas_backends",
    {
      title: "Probe CAS Backends",
      description:
        "Probe independent local CAS backends without network access. A status probe is not a symbolic check; `cross-checked` requires a concrete independent CAS agreement run.",
      inputSchema: {
        maximaCommand: z
          .string()
          .optional()
          .describe("Maxima executable path or command. Defaults to TRUTH_HARNESS_MAXIMA or maxima."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(10000)
          .optional()
          .describe("Local backend version-probe timeout in milliseconds. Defaults to 3000.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ maximaCommand, timeoutMs }) => toolJson(handleTruthHarnessCasBackends({ maximaCommand, timeoutMs }))
  );

  server.registerTool(
    "truth_harness_cas_check",
    {
      title: "Check Symbolic CAS Result",
      description:
        "Run a local Maxima symbolic equality check for a concrete expression/result pair and optionally write a truth-harness.cas-check.v0 record. A passing CAS check can support `cross-checked`, never `proved`.",
      inputSchema: {
        operation: z
          .enum(["simplify", "factor", "expand", "differentiate", "integrate"])
          .describe("Symbolic operation being checked."),
        expression: z.string().min(1).describe("Original symbolic expression to check."),
        result: z.string().min(1).describe("Expected symbolic result to compare against."),
        variable: z.string().min(1).optional().describe("Symbolic variable. Defaults to x."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root for writing CAS check records. Defaults to the MCP workspace root."),
        maximaCommand: z
          .string()
          .optional()
          .describe("Maxima executable path or command. Defaults to TRUTH_HARNESS_MAXIMA or maxima."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(30000)
          .optional()
          .describe("Local backend probe and CAS check timeout in milliseconds. Defaults to 3000."),
        write: z
          .boolean()
          .optional()
          .describe("When true, write JSON and Markdown into .truth-harness/cas. Defaults to false."),
        failOnUnverified: z
          .boolean()
          .optional()
          .describe("When true, mark the tool call as an error unless Maxima independently agrees.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => {
      const result = await handleTruthHarnessCasCheck(input);
      return toolJson(result, { isError: result.error });
    }
  );

  server.registerTool(
    "truth_harness_cas_list",
    {
      title: "List CAS Checks",
      description:
        "List local truth-harness.cas-check.v0 artifacts with paths agents can reuse for route obligations, claim ledger evidence refs, audits, and validation plans.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root containing .truth-harness. Defaults to the MCP workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessCasList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_engine_manifest",
    {
      title: "Engine Capability Manifest",
      description:
        "Return the local Truth Harness engine manifest: native kernels, external adapters, safety boundaries, planned engines, and which trust labels each can mint after concrete evidence runs.",
      inputSchema: {
        maximaCommand: z
          .string()
          .optional()
          .describe("Maxima executable path or command for this manifest probe."),
        leanCommand: z
          .string()
          .optional()
          .describe("Lean executable path or command for this manifest probe."),
        z3Command: z
          .string()
          .optional()
          .describe("Z3 executable path or command for this manifest probe."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(10000)
          .optional()
          .describe("Local backend version-probe timeout in milliseconds. Defaults to 1500.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async (input) => toolJson(handleTruthHarnessEngineManifest(input))
  );

  server.registerTool(
    "truth_harness_proof_backends",
    {
      title: "Probe Proof Backends",
      description:
        "Probe local accepted proof-checker backends without network access. A status probe is not proof; `proved` requires a successful proof-checking run.",
      inputSchema: {
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(10000)
          .optional()
          .describe("Local backend version-probe timeout in milliseconds. Defaults to 3000.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ timeoutMs }) => toolJson(handleTruthHarnessProofBackends({ timeoutMs }))
  );

  server.registerTool(
    "truth_harness_proof_check",
    {
      title: "Check Lean Proof Artifact",
      description:
        "Run a local Lean proof-check over a workspace-local source file. Only an accepted Lean run can return `proved`; rejected or unavailable checks remain unverified.",
      inputSchema: {
        sourcePath: z.string().min(1).describe("Workspace-local Lean source file to check."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root for writing proof-check records. Defaults to the MCP workspace root."),
        declarationName: z.string().optional().describe("Optional formal declaration name represented by the source file."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(30000)
          .optional()
          .describe("Local backend probe and proof-check timeout in milliseconds. Defaults to 3000."),
        write: z
          .boolean()
          .optional()
          .describe("When true, write JSON and Markdown into .truth-harness/proofs. Defaults to false."),
        failOnUnproved: z
          .boolean()
          .optional()
          .describe("When true, mark the tool call as an error unless Lean accepts the proof artifact.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ sourcePath, workspacePath, declarationName, timeoutMs, write, failOnUnproved }) => {
      const result = await handleTruthHarnessProofCheck({
        sourcePath,
        workspacePath,
        declarationName,
        timeoutMs,
        write,
        failOnUnproved
      });
      return toolJson(result, { isError: result.error });
    }
  );

  server.registerTool(
    "truth_harness_proof_list",
    {
      title: "List Lean Proof Checks",
      description:
        "List local truth-harness.proof-check.v0 artifacts with paths agents can reuse for evidence refs, audits, and validation plans.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root containing .truth-harness. Defaults to the MCP workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessProofList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_smt_backends",
    {
      title: "Probe SMT Solver Backends",
      description:
        "Probe local SMT solver availability without checking a claim; a status probe never proves or refutes anything.",
      inputSchema: {
        z3Command: z
          .string()
          .optional()
          .describe("Z3 executable path or command. Defaults to TRUTH_HARNESS_Z3 or z3."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(30000)
          .optional()
          .describe("Local backend probe timeout in milliseconds. Defaults to 3000.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ z3Command, timeoutMs }) => toolJson(handleTruthHarnessSmtBackends({ z3Command, timeoutMs }))
  );

  server.registerTool(
    "truth_harness_smt_check",
    {
      title: "Check SMT-LIB Artifact",
      description:
        "Run Z3 on a workspace-local SMT-LIB artifact and optionally write a local truth-harness.smt-check.v0 record.",
      inputSchema: {
        sourcePath: z.string().min(1).describe("Workspace-local SMT-LIB source file to check."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root for reading and writing SMT check records. Defaults to the MCP workspace root."),
        queryName: z.string().optional().describe("Optional query or constraint-set name represented by the source file."),
        z3Command: z
          .string()
          .optional()
          .describe("Z3 executable path or command. Defaults to TRUTH_HARNESS_Z3 or z3."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(30000)
          .optional()
          .describe("Local backend probe and SMT check timeout in milliseconds. Defaults to 3000."),
        write: z
          .boolean()
          .optional()
          .describe("When true, write JSON and Markdown into .truth-harness/smt. Defaults to false."),
        failOnUnverified: z
          .boolean()
          .optional()
          .describe("When true, mark the tool call as an error unless the solver returns sat or unsat.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ sourcePath, workspacePath, queryName, z3Command, timeoutMs, write, failOnUnverified }) => {
      const result = await handleTruthHarnessSmtCheck({
        sourcePath,
        workspacePath,
        queryName,
        z3Command,
        timeoutMs,
        write,
        failOnUnverified
      });
      return toolJson(result, { isError: result.error });
    }
  );

  server.registerTool(
    "truth_harness_smt_list",
    {
      title: "List SMT Checks",
      description:
        "List local truth-harness.smt-check.v0 artifacts with paths agents can reuse for evidence refs, audits, and validation plans.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root containing .truth-harness. Defaults to the MCP workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessSmtList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_smt_solve",
    {
      title: "Generate And Check SMT Problem",
      description:
        "Build workspace-local SMT-LIB from explicit integer variables and constraints, then run the local Z3 SMT check workflow.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace root for writing generated SMT-LIB and check records. Defaults to the MCP workspace root."),
        queryName: z.string().optional().describe("Optional query or constraint-set name."),
        integerVariables: z
          .array(z.string().min(1))
          .min(1)
          .describe("Integer variable names to declare, such as ['x', 'y']."),
        constraints: z
          .array(z.string().min(1))
          .min(1)
          .describe("Explicit constraints such as 'x > 0' or 'x + y <= 3'."),
        includeModel: z.boolean().optional().describe("When true, append get-model after check-sat."),
        z3Command: z
          .string()
          .optional()
          .describe("Z3 executable path or command. Defaults to TRUTH_HARNESS_Z3 or z3."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(30000)
          .optional()
          .describe("Local backend probe and SMT check timeout in milliseconds. Defaults to 3000."),
        failOnUnverified: z
          .boolean()
          .optional()
          .describe("When true, mark the tool call as an error unless the solver returns sat or unsat.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ workspacePath, queryName, integerVariables, constraints, includeModel, z3Command, timeoutMs, failOnUnverified }) => {
      const result = await handleTruthHarnessSmtSolve({
        workspacePath,
        queryName,
        integerVariables,
        constraints,
        includeModel,
        z3Command,
        timeoutMs,
        failOnUnverified
      });
      return toolJson(result, { isError: result.error });
    }
  );

  server.registerTool(
    "truth_harness_workspace_init",
    {
      title: "Initialize Local Workspace",
      description:
        "Initialize a private .truth-harness project store under the current workspace or a workspace-local subdirectory.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        name: z.string().optional().describe("Human display name for the local workspace.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ workspacePath, name }) => toolJson(await handleTruthHarnessWorkspaceInit({ workspacePath, name }))
  );

  server.registerTool(
    "truth_harness_workspace_status",
    {
      title: "Check Local Workspace",
      description:
        "Check whether a private Truth Harness local project store exists and whether required directories are present.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessWorkspaceStatus({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_workspace_repair",
    {
      title: "Repair Local Workspace",
      description:
        "Repair missing private workspace directories and persist newly added manifest defaults without leaving the local project.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessWorkspaceRepair({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_workspace_validate",
    {
      title: "Validate Workspace Evidence",
      description:
        "Validate local workspace evidence artifacts before agents rely on them. Checks receipts deeply plus JSON Schema, reference, and trust-boundary policies for known workspace records.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessWorkspaceValidate({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_workspace_review",
    {
      title: "Review Workspace Work Queue",
      description:
        "Return the ordered local work queue across saved verifier routes and claim-ledger records, including blockers, next commands, privacy boundary, and Markdown handoff for agents.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        maxRoutes: z
          .number()
          .int()
          .min(0)
          .max(500)
          .optional()
          .describe("Maximum route summaries to inspect. Defaults to 100; use 0 to skip routes."),
        maxClaims: z
          .number()
          .int()
          .min(0)
          .max(1000)
          .optional()
          .describe("Maximum claim records to inspect. Defaults to 200; use 0 to skip claims."),
        write: z
          .boolean()
          .optional()
          .describe("When true, write JSON and Markdown handoff packets into .truth-harness/findings.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ workspacePath, maxRoutes, maxClaims, write }) =>
      toolJson(await handleTruthHarnessWorkspaceReview({ workspacePath, maxRoutes, maxClaims, write }))
  );

  server.registerTool(
    "truth_harness_workspace_review_list",
    {
      title: "List Workspace Review Handoffs",
      description:
        "List persisted truth-harness.workspace-review.v0 handoff packets from .truth-harness/findings so agents can resume exact local work queues.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessWorkspaceReviewList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_workspace_review_show",
    {
      title: "Show Workspace Review Handoff",
      description:
        "Read a persisted workspace review handoff by review id or workspace-local JSON path, including queue items, commands, warnings, and Markdown.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        reviewRef: z.string().min(1).describe("Review id such as wrev_<hash> or workspace-local JSON path.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath, reviewRef }) => toolJson(await handleTruthHarnessWorkspaceReviewShow({ workspacePath, reviewRef }))
  );

  server.registerTool(
    "truth_harness_workspace_snapshot",
    {
      title: "Write Workspace Snapshot",
      description:
        "Write a portable local provenance snapshot of .truth-harness artifacts with SHA-256 hashes for drift detection.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessWorkspaceSnapshot({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_workspace_snapshot_list",
    {
      title: "List Workspace Snapshots",
      description:
        "List local workspace provenance snapshots without reading or decrypting private vault payloads.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessWorkspaceSnapshotList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_workspace_snapshot_verify",
    {
      title: "Verify Workspace Snapshot",
      description:
        "Verify a local workspace provenance snapshot and report changed, missing, or added artifacts.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        snapshotRef: z.string().min(1).describe("Snapshot id or workspace-local snapshot JSON path.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath, snapshotRef }) =>
      toolJson(await handleTruthHarnessWorkspaceSnapshotVerify({ workspacePath, snapshotRef }))
  );

  server.registerTool(
    "truth_harness_source_ingest",
    {
      title: "Ingest Local Sources",
      description:
        "Ingest workspace-local Markdown/text files or directories into the private local corpus index for source-cited retrieval.",
      inputSchema: {
        paths: z.array(z.string().min(1)).min(1).describe("Files or directories under the local workspace root."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ paths, workspacePath }) => toolJson(await handleTruthHarnessSourceIngest({ paths, workspacePath }))
  );

  server.registerTool(
    "truth_harness_source_search",
    {
      title: "Search Local Sources",
      description:
        "Search the private local corpus index and return source-cited chunk hits. Retrieval is evidence, not proof.",
      inputSchema: {
        query: z.string().min(1).describe("Search query."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        limit: z.number().int().positive().optional().describe("Maximum number of hits. Defaults to 5.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ query, workspacePath, limit }) =>
      toolJson(await handleTruthHarnessSourceSearch({ query, workspacePath, limit }))
  );

  server.registerTool(
    "truth_harness_source_cite",
    {
      title: "Create Source-Cited Receipt",
      description:
        "Create a receipt for a claim using private local corpus search hits. Source-cited retrieval is evidence, not proof.",
      inputSchema: {
        claim: z.string().min(1).describe("Claim to cite against local source material."),
        query: z.string().optional().describe("Search query. Defaults to the claim."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        limit: z.number().int().positive().optional().describe("Maximum number of source hits. Defaults to 5."),
        strict: z
          .boolean()
          .optional()
          .describe("When true, return an MCP tool error if no source-cited local evidence is found.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ claim, query, workspacePath, limit, strict }) => {
      const result = await handleTruthHarnessSourceCite({ claim, query, workspacePath, limit, strict });
      return toolJson(result, { isError: result.error });
    }
  );

  const literatureIdentifierSchema = z.object({
    kind: z.enum(["doi", "pmid", "pmcid", "arxiv", "isbn", "patent", "url", "local-path", "other"]),
    value: z.string().min(1)
  });

  server.registerTool(
    "truth_harness_literature_log",
    {
      title: "Log Literature Record",
      description:
        "Create or write a private local literature, prior-art, dataset, or database-export evidence record. This does not call PubMed, arXiv, patent databases, or any network service.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().min(1).describe("Paper, patent, dataset, database export, standard, note, or source title."),
        kind: z
          .enum(["paper", "preprint", "patent", "dataset", "database-export", "book", "web-page", "protocol", "standard", "note", "other"])
          .optional()
          .describe("Literature/source kind. Defaults to paper."),
        status: z
          .enum(["unreviewed", "triaged", "read", "annotated", "reproduced", "replicated", "disputed", "retracted", "superseded"])
          .optional()
          .describe("Review status. Defaults to unreviewed."),
        authors: z.array(z.string().min(1)).optional().describe("Authors or organizations."),
        venue: z.string().optional().describe("Venue, publisher, database, or source collection."),
        year: z.number().int().optional().describe("Publication or record year."),
        identifiers: z.array(literatureIdentifierSchema).optional().describe("DOI, PMID, arXiv, patent, URL, local-path, or other identifiers."),
        localRefs: z.array(z.string().min(1)).optional().describe("Workspace-local source files or artifacts."),
        corpusRefs: z.array(z.string().min(1)).optional().describe("Local corpus chunk/search refs."),
        evidenceRefs: z.array(z.string().min(1)).optional().describe("Related local evidence refs."),
        summary: z.string().optional().describe("Short source summary."),
        keyClaims: z.array(z.string().min(1)).optional().describe("Key claims extracted from the source."),
        methodNotes: z.array(z.string().min(1)).optional().describe("Method, data, or provenance notes."),
        limitations: z.array(z.string().min(1)).optional().describe("Source limitations."),
        relevance: z.array(z.string().min(1)).optional().describe("Why this source matters to the project."),
        qualityFlags: z.array(z.string().min(1)).optional().describe("Retraction, conflict, caveat, bias, or quality flags."),
        nextChecks: z.array(z.string().min(1)).optional().describe("Next review, replication, prior-art, or entailment checks."),
        write: z.boolean().optional().describe("When true, write JSON plus Markdown into the local workspace.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessLiteratureLog(input))
  );

  server.registerTool(
    "truth_harness_literature_list",
    {
      title: "List Literature Records",
      description: "List private local literature, prior-art, dataset, and database-export evidence records from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessLiteratureList({ workspacePath }))
  );

  const notebookRunValueSchema = z.object({
    name: z.string().min(1),
    value: z.string().min(1),
    unit: z.string().optional(),
    note: z.string().optional()
  });

  server.registerTool(
    "truth_harness_notebook_run_log",
    {
      title: "Log Notebook Run",
      description:
        "Create or write a private local notebook, script, or pipeline run provenance record. This records replay metadata and does not execute code.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short run title."),
        purpose: z.string().min(1).describe("Purpose, question, or claim context for the local run."),
        kind: z.enum(["notebook", "script", "pipeline", "test", "analysis", "simulation", "other"]).optional(),
        status: z.enum(["planned", "completed", "failed", "reproduced", "superseded"]).optional(),
        runner: z.string().optional().describe("Runner such as jupyter, python, node, pytest, snakemake, or nextflow."),
        runnerVersion: z.string().optional().describe("Runner version."),
        command: z.string().optional().describe("Replay command or manual execution command."),
        workingDirectory: z.string().optional().describe("Working directory for replay."),
        notebookRefs: z.array(z.string().min(1)).optional().describe("Notebook refs."),
        codeRefs: z.array(z.string().min(1)).optional().describe("Code or script refs."),
        inputRefs: z.array(z.string().min(1)).optional().describe("Input data/artifact refs."),
        outputRefs: z.array(z.string().min(1)).optional().describe("Output artifact refs."),
        runtime: z.string().optional().describe("Runtime such as python, node, R, julia, or shell."),
        runtimeVersion: z.string().optional().describe("Runtime version."),
        operatingSystem: z.string().optional().describe("Operating system or environment label."),
        dependencies: z.array(z.string().min(1)).optional().describe("Dependencies or lockfile refs."),
        environmentVariables: z.array(notebookRunValueSchema).optional().describe("Environment variable metadata, not secrets."),
        parameters: z.array(notebookRunValueSchema).optional().describe("Run parameters."),
        metrics: z.array(notebookRunValueSchema).optional().describe("Run metrics."),
        observations: z.array(z.string().min(1)).optional().describe("Observations from the run."),
        limitations: z.array(z.string().min(1)).optional().describe("Run limitations."),
        nextChecks: z.array(z.string().min(1)).optional().describe("Next reproducibility checks."),
        deterministic: z.boolean().optional().describe("Whether the run is expected to be deterministic."),
        replayNotes: z.array(z.string().min(1)).optional().describe("Replay notes."),
        write: z.boolean().optional().describe("When true, write JSON plus Markdown into the local workspace.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessNotebookRunLog(input))
  );

  server.registerTool(
    "truth_harness_notebook_run_list",
    {
      title: "List Notebook Runs",
      description: "List private local notebook, script, and pipeline run records from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessNotebookRunList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_code_sandbox_status",
    {
      title: "Check Code Sandbox",
      description:
        "Report whether Truth Harness has a measured code-run sandbox available. A missing sandbox means code-run records must use networkAccess unknown.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async () => {
      const result = handleTruthHarnessCodeSandboxStatus();
      return toolJson(result, { isError: result.error });
    }
  );

  server.registerTool(
    "truth_harness_code_run",
    {
      title: "Run Local Code",
      description:
        "Execute a local command directly without shell interpolation under the default local execution policy, capture stdout/stderr/exit status, and write a private truth-harness.code-run.v0 evidence record. Disabled unless the MCP server process has TRUTH_HARNESS_ALLOW_CODE_RUN=1. Unsandboxed direct execution is also disabled unless policy.requireSandbox=true or the process has TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN=1.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short code run title."),
        purpose: z.string().min(1).describe("Purpose, question, or claim context for this code execution."),
        command: z.string().min(1).describe("Executable path or command to launch directly without shell interpolation."),
        args: z.array(z.string()).optional().describe("Arguments passed to the executable without shell interpolation."),
        workingDirectory: z.string().optional().describe("Working directory under the workspace root. Defaults to the root."),
        codeRefs: z.array(z.string().min(1)).optional().describe("Code/script refs related to the run."),
        inputRefs: z.array(z.string().min(1)).optional().describe("Input data/artifact refs."),
        outputRefs: z.array(z.string().min(1)).optional().describe("Output artifact refs."),
        evidenceRefs: z.array(z.string().min(1)).optional().describe("Related local evidence refs."),
        timeoutMs: z.number().int().positive().max(120000).optional().describe("Command timeout in milliseconds. Defaults to 10000; maximum 120000."),
        maxOutputBytes: z
          .number()
          .int()
          .positive()
          .max(1048576)
          .optional()
          .describe("Maximum captured bytes per output stream. Defaults to 65536."),
        policy: z
          .object({
            allowedExecutables: z
              .array(z.string().min(1))
              .min(1)
              .optional()
              .describe("Required executable allowlist for execution. Entries are normalized by basename without .exe/.cmd/.bat/.com."),
            requireSandbox: z
              .boolean()
              .optional()
              .describe("Require a measured sandbox provider for this run; fail closed if no provider is available. Agent-facing MCP calls should prefer this setting."),
            allowShellLauncher: z
              .boolean()
              .optional()
              .describe("Allow shell launcher executables such as cmd, PowerShell, bash, or sh."),
            allowNetworkCommand: z
              .boolean()
              .optional()
              .describe("Allow obvious network-capable commands such as curl, wget, ssh, or scp."),
            allowDestructiveCommand: z
              .boolean()
              .optional()
              .describe("Allow obvious destructive commands such as rm, rmdir, format, or shutdown."),
            allowPackageMutation: z
              .boolean()
              .optional()
              .describe("Allow package-manager mutation commands such as npm install or pip install."),
            allowGitMutation: z
              .boolean()
              .optional()
              .describe("Allow git mutation/network commands such as push, pull, reset, clean, or checkout.")
          })
          .optional()
          .describe("Default-local execution policy controls. Risky categories are blocked unless explicitly allowed. Unsandboxed MCP execution also requires TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN=1."),
        failOnNonzero: z.boolean().optional().describe("When true, mark the tool call as an error unless the command exits 0.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => {
      const result = await handleTruthHarnessCodeRun(input);
      return toolJson(result, { isError: result.error });
    }
  );

  server.registerTool(
    "truth_harness_code_list",
    {
      title: "List Code Runs",
      description: "List private local direct code execution records from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessCodeRunList({ workspacePath }))
  );

  const simulationScalarSchema = z.object({
    name: z.string().min(1),
    value: z.string().min(1),
    unit: z.string().optional(),
    note: z.string().optional()
  });

  server.registerTool(
    "truth_harness_simulation_log",
    {
      title: "Write Simulation Log",
      description:
        "Write a private local simulation evidence record with assumptions, parameters, metrics, uncertainty, limitations, validation boundaries, and overclaim warnings.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short simulation title."),
        question: z.string().min(1).describe("Simulation question or computational claim under investigation."),
        kind: z
          .enum(["numeric", "symbolic", "physics", "molecular", "statistical", "agentic", "other"])
          .optional()
          .describe("Simulation kind. Defaults to numeric."),
        stage: z
          .enum(["planned", "computed", "reproduced", "benchmarked", "experimentally-compared"])
          .optional()
          .describe("Simulation evidence stage. Defaults to computed."),
        engine: z.string().min(1).describe("Local simulation engine, script, notebook, solver, or tool."),
        engineVersion: z.string().optional().describe("Simulation engine version."),
        modelName: z.string().min(1).describe("Model name or simulation model identifier."),
        modelVersion: z.string().optional().describe("Model version."),
        inputRefs: z.array(z.string().min(1)).optional().describe("Local input refs."),
        outputRefs: z.array(z.string().min(1)).optional().describe("Local output refs."),
        codeRefs: z.array(z.string().min(1)).optional().describe("Local code or notebook refs."),
        parameters: z.array(simulationScalarSchema).optional().describe("Simulation parameters."),
        metrics: z.array(simulationScalarSchema).optional().describe("Simulation output metrics."),
        assumptions: z.array(z.string().min(1)).optional().describe("Model assumptions."),
        uncertainty: z.array(z.string().min(1)).optional().describe("Uncertainty notes."),
        limitations: z.array(z.string().min(1)).optional().describe("Model or implementation limitations."),
        nextChecks: z.array(z.string().min(1)).optional().describe("Next validation checks.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessSimulationLog(input))
  );

  server.registerTool(
    "truth_harness_simulation_list",
    {
      title: "List Simulation Logs",
      description: "List private local simulation evidence records from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessSimulationList({ workspacePath }))
  );

  const experimentMeasurementSchema = z.object({
    name: z.string().min(1),
    value: z.string().min(1),
    unit: z.string().optional(),
    note: z.string().optional()
  });

  server.registerTool(
    "truth_harness_experiment_log",
    {
      title: "Write Experiment Log",
      description:
        "Write a private local experiment evidence record with protocol/data/analysis refs, observations, measurements, ethics/safety/regulatory review fields, and overclaim warnings.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short experiment title."),
        question: z.string().min(1).describe("Experiment question or observation under review."),
        kind: z
          .enum(["bench", "wet-lab", "field", "preclinical", "clinical", "observational", "other"])
          .optional()
          .describe("Experiment kind. Defaults to bench."),
        stage: z
          .enum(["planned", "protocol-drafted", "running", "completed", "replicated", "failed", "inconclusive"])
          .optional()
          .describe("Experiment stage. Defaults to planned."),
        protocolRefs: z.array(z.string().min(1)).optional().describe("Local protocol refs."),
        dataRefs: z.array(z.string().min(1)).optional().describe("Local data refs."),
        analysisRefs: z.array(z.string().min(1)).optional().describe("Local analysis refs."),
        evidenceRefs: z.array(z.string().min(1)).optional().describe("Related local evidence refs."),
        observations: z.array(z.string().min(1)).optional().describe("Observed facts under the recorded protocol."),
        measurements: z.array(experimentMeasurementSchema).optional().describe("Experiment measurements."),
        outcomeStatus: z
          .enum(["not-run", "observed", "not-observed", "mixed", "inconclusive"])
          .optional()
          .describe("Outcome status."),
        outcomeSummary: z.string().optional().describe("Outcome summary."),
        limitations: z.array(z.string().min(1)).optional().describe("Experiment limitations."),
        nextChecks: z.array(z.string().min(1)).optional().describe("Next validation checks."),
        humanSubjects: z.boolean().optional().describe("Whether human subjects are involved."),
        biologicalOrMedical: z.boolean().optional().describe("Whether the experiment is biological, medical, or safety-sensitive."),
        ethicsApprovalRefs: z.array(z.string().min(1)).optional().describe("Ethics approval or review refs."),
        regulatoryReviewRefs: z.array(z.string().min(1)).optional().describe("Regulatory or safety review refs.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessExperimentLog(input))
  );

  server.registerTool(
    "truth_harness_experiment_list",
    {
      title: "List Experiment Logs",
      description: "List private local experiment evidence records from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessExperimentList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_vault_seal",
    {
      title: "Seal Vault File",
      description:
        "Encrypt a workspace-local file into the private local vault using an environment-provided key. The tool returns encrypted envelope metadata, not plaintext.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        sourcePath: z.string().min(1).describe("Workspace-local file path to encrypt."),
        label: z.string().optional().describe("Safe public label for the vault entry."),
        keyEnv: z
          .string()
          .regex(/^[A-Z_][A-Z0-9_]*$/)
          .optional()
          .describe("Environment variable containing the vault key. Defaults to TRUTH_HARNESS_VAULT_KEY.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessVaultSeal(input))
  );

  server.registerTool(
    "truth_harness_vault_list",
    {
      title: "List Vault Entries",
      description: "List encrypted local vault envelopes from the workspace without decrypting plaintext.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessVaultList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_vault_verify",
    {
      title: "Verify Vault Entry",
      description:
        "Decrypt a vault entry locally and return integrity metadata only. This tool intentionally does not return plaintext bytes.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        vaultRef: z.string().min(1).describe("Vault id or workspace-local vault envelope path."),
        keyEnv: z
          .string()
          .regex(/^[A-Z_][A-Z0-9_]*$/)
          .optional()
          .describe("Environment variable containing the vault key. Defaults to the entry keyRef or TRUTH_HARNESS_VAULT_KEY.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessVaultVerify(input))
  );

  const evidenceRefSchema = z.object({
    kind: z.enum([
      "receipt",
      "artifact",
      "source",
      "literature",
      "notebook",
      "notebook-run",
      "code-run",
      "benchmark",
      "cas",
      "disclosure",
      "simulation",
      "experiment",
      "vault",
      "review",
      "validation",
      "route",
      "other"
    ]),
    ref: z.string().min(1),
    trust: z
      .enum([
        "proved",
        "exact-computed",
        "bounded-numeric",
        "smt-checked",
        "dimension-checked",
        "source-cited",
        "cross-checked",
        "unverified",
        "refuted"
      ])
      .optional(),
    summary: z.string().optional()
  });

  server.registerTool(
    "truth_harness_evidence_audit",
    {
      title: "Audit Claim Evidence",
      description:
        "Audit a claim against local evidence refs, classify overclaim risk, and return required next checks before an agent presents the claim as true.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        claim: z.string().min(1).describe("Claim to audit."),
        title: z.string().optional().describe("Short audit title."),
        evidenceRefs: z.array(evidenceRefSchema).optional().describe("Local evidence refs supporting or contextualizing the claim."),
        write: z.boolean().optional().describe("When true, write the audit JSON into the local workspace."),
        writeReport: z.boolean().optional().describe("When true, write both audit JSON and a Markdown report into the local workspace."),
        includeMarkdown: z.boolean().optional().describe("When true and not writing, include a rendered Markdown report in the tool response.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessEvidenceAudit(input))
  );

  server.registerTool(
    "truth_harness_evidence_audit_list",
    {
      title: "List Evidence Audits",
      description: "List local evidence audit records from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessEvidenceAuditList({ workspacePath }))
  );

  const validationEvidenceRefSchema = z.object({
    kind: z.enum([
      "receipt",
      "artifact",
      "source",
      "literature",
      "notebook",
      "notebook-run",
      "code-run",
      "benchmark",
      "cas",
      "disclosure",
      "simulation",
      "experiment",
      "vault",
      "audit",
      "snapshot",
      "session",
      "review",
      "validation",
      "model-context",
      "route",
      "invention",
      "claim-chart",
      "discovery-package",
      "other"
    ]),
    ref: z.string().min(1),
    trust: z
      .enum([
        "proved",
        "exact-computed",
        "bounded-numeric",
        "smt-checked",
        "dimension-checked",
        "source-cited",
        "cross-checked",
        "unverified",
        "refuted"
      ])
      .optional(),
    summary: z.string().optional()
  });

  const validationGateSchema = z.object({
    kind: z
      .enum([
        "evidence-audit",
        "proof",
        "source-citation",
        "literature-record",
        "notebook-run",
        "code-run",
        "simulation-log",
        "simulation-review",
        "experiment-record",
        "experiment-replication",
        "wet-lab",
        "preclinical",
        "clinical",
        "safety",
        "ethics",
        "regulatory",
        "expert-review",
        "patent-legal",
        "prior-art",
        "claim-chart",
        "reduction-to-practice",
        "workspace-snapshot",
        "replay",
        "benchmark",
        "other"
      ])
      .optional(),
    description: z.string().min(1),
    status: z.enum(["missing", "planned", "in-progress", "satisfied", "blocked", "not-applicable"]).optional(),
    evidenceRefs: z.array(validationEvidenceRefSchema).optional(),
    rationale: z.string().optional(),
    blocking: z.boolean().optional()
  });

  server.registerTool(
    "truth_harness_validation_plan",
    {
      title: "Create Validation Plan",
      description:
        "Create or write a private local validation-gate plan before stronger discovery, biomedical, patent, simulation, or engineering claims. This derives required gates from a conservative evidence audit.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short validation plan title."),
        objective: z.string().optional().describe("Validation objective."),
        claim: z.string().min(1).describe("Claim or hypothesis to validate."),
        domains: z
          .array(
            z.enum([
              "math",
              "source",
              "literature",
              "simulation",
              "experiment",
              "biomedical",
              "clinical",
              "safety",
              "regulatory",
              "patent",
              "engineering",
              "software",
              "physics",
              "general"
            ])
          )
          .optional()
          .describe("Validation domains. If omitted, domains are inferred from the claim and evidence audit."),
        evidenceRefs: z.array(validationEvidenceRefSchema).optional().describe("Local evidence refs to evaluate against validation gates."),
        gates: z.array(validationGateSchema).optional().describe("Additional user-supplied validation gates."),
        write: z.boolean().optional().describe("When true, write JSON plus Markdown into the local workspace.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessValidationPlan(input))
  );

  server.registerTool(
    "truth_harness_validation_plan_list",
    {
      title: "List Validation Plans",
      description: "List private local validation plans from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessValidationPlanList({ workspacePath }))
  );

  const researchEvidenceRefSchema = z.object({
    kind: z.enum([
      "receipt",
      "artifact",
      "source",
      "literature",
      "notebook",
      "notebook-run",
      "code-run",
      "benchmark",
      "cas",
      "disclosure",
      "simulation",
      "experiment",
      "vault",
      "audit",
      "snapshot",
      "review",
      "validation",
      "model-context",
      "route",
      "invention",
      "claim-chart",
      "discovery-package",
      "other"
    ]),
    ref: z.string().min(1),
    trust: z
      .enum([
        "proved",
        "exact-computed",
        "bounded-numeric",
        "smt-checked",
        "dimension-checked",
        "source-cited",
        "cross-checked",
        "unverified",
        "refuted"
      ])
      .optional(),
    summary: z.string().optional()
  });

  server.registerTool(
    "truth_harness_research_session_start",
    {
      title: "Start Research Session",
      description:
        "Start a private local research runbook for long agentic investigations with budgets, evidence refs, snapshot refs, model disclosure policy, and review boundaries.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short research session title."),
        objective: z.string().min(1).describe("Research objective or moonshot question."),
        domains: z
          .array(z.enum(["math", "physics", "code", "biomedical", "materials", "energy", "climate", "patent", "learning", "general"]))
          .optional()
          .describe("Research domains. If omitted, domains are inferred from the objective."),
        hypotheses: z.array(z.string().min(1)).optional().describe("Hypotheses to track."),
        claims: z.array(z.string().min(1)).optional().describe("Claims that must be verified, refuted, sourced, or labeled."),
        evidenceRefs: z.array(researchEvidenceRefSchema).optional().describe("Initial local evidence refs."),
        snapshotRefs: z.array(z.string().min(1)).optional().describe("Workspace snapshot ids or paths."),
        tasks: z.array(z.string().min(1)).optional().describe("Initial concrete research tasks."),
        maxDepth: z.number().int().positive().optional(),
        maxBranches: z.number().int().positive().optional(),
        maxToolCalls: z.number().int().positive().optional(),
        maxWallMinutes: z.number().int().positive().optional()
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessResearchSessionStart(input))
  );

  server.registerTool(
    "truth_harness_research_session_checkpoint",
    {
      title: "Checkpoint Research Session",
      description:
        "Append a local checkpoint to a research session with evidence refs, snapshot refs, decisions, and next validation checks.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        sessionRef: z.string().min(1).describe("Research session id or workspace-local session JSON path."),
        summary: z.string().min(1).describe("Checkpoint summary."),
        evidenceRefs: z.array(researchEvidenceRefSchema).optional().describe("Evidence refs added at this checkpoint."),
        snapshotRefs: z.array(z.string().min(1)).optional().describe("Workspace snapshot ids or paths added at this checkpoint."),
        decisions: z.array(z.string().min(1)).optional().describe("Decisions recorded at this checkpoint."),
        nextChecks: z.array(z.string().min(1)).optional().describe("Next validation checks.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessResearchSessionCheckpoint(input))
  );

  server.registerTool(
    "truth_harness_research_session_list",
    {
      title: "List Research Sessions",
      description: "List private local research sessions and checkpoints from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessResearchSessionList({ workspacePath }))
  );

  const expertReviewEvidenceRefSchema = z.object({
    kind: z.enum([
      "receipt",
      "artifact",
      "source",
      "literature",
      "notebook",
      "notebook-run",
      "code-run",
      "benchmark",
      "cas",
      "disclosure",
      "simulation",
      "experiment",
      "vault",
      "audit",
      "snapshot",
      "session",
      "review",
      "validation",
      "model-context",
      "route",
      "invention",
      "claim-chart",
      "discovery-package",
      "other"
    ]),
    ref: z.string().min(1),
    trust: z
      .enum([
        "proved",
        "exact-computed",
        "bounded-numeric",
        "smt-checked",
        "dimension-checked",
        "source-cited",
        "cross-checked",
        "unverified",
        "refuted"
      ])
      .optional(),
    summary: z.string().optional()
  });

  server.registerTool(
    "truth_harness_expert_review_log",
    {
      title: "Log Expert Review",
      description:
        "Write a private local expert-review record with scope, reviewer role, evidence refs, findings, limitations, recommendations, and required next checks. This records human review context; it is not proof, medical advice, regulatory approval, or legal advice.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short review title."),
        subject: z.string().min(1).describe("Subject under expert review."),
        question: z.string().optional().describe("Review question or scope."),
        kind: z
          .enum([
            "math",
            "physics",
            "engineering",
            "software",
            "biomedical",
            "clinical",
            "safety",
            "ethics",
            "regulatory",
            "patent-legal",
            "domain-expert",
            "other"
          ])
          .optional()
          .describe("Review kind. If omitted, inferred from subject and question."),
        status: z
          .enum(["needed", "requested", "in-review", "completed", "rejected", "superseded"])
          .optional()
          .describe("Review workflow status. Defaults to needed."),
        reviewerRole: z.string().min(1).describe("Reviewer role, such as oncologist, physicist, patent attorney, or software auditor."),
        reviewerNameOrOrg: z.string().optional(),
        reviewerCredentials: z.string().optional(),
        conflictDisclosure: z.string().optional(),
        evidenceRefs: z.array(expertReviewEvidenceRefSchema).optional().describe("Local evidence refs reviewed or queued for review."),
        findings: z.array(z.string().min(1)).optional(),
        limitations: z.array(z.string().min(1)).optional(),
        recommendations: z.array(z.string().min(1)).optional(),
        requiredNextChecks: z.array(z.string().min(1)).optional(),
        outcomeStatus: z
          .enum([
            "not-reviewed",
            "needs-more-evidence",
            "supported-with-limitations",
            "not-supported",
            "inconclusive",
            "requires-validation",
            "legal-review-only"
          ])
          .optional(),
        outcomeSummary: z.string().optional()
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessExpertReviewLog(input))
  );

  server.registerTool(
    "truth_harness_expert_review_list",
    {
      title: "List Expert Reviews",
      description: "List private local expert-review records from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessExpertReviewList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_invention_log",
    {
      title: "Write Invention Log",
      description:
        "Write a private local discovery/invention hypothesis log with evidence refs, validation stage, and overclaim warnings.",
      inputSchema: {
        hypothesis: z.string().min(1).describe("Discovery or invention hypothesis."),
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short title."),
        problem: z.string().optional().describe("Problem or research question."),
        validationStage: z
          .enum([
            "idea",
            "computational-hypothesis",
            "simulated",
            "bench-tested",
            "experimentally-observed",
            "preclinical",
            "clinical",
            "regulatory-reviewed"
          ])
          .optional()
          .describe("Current validation stage. Defaults to computational-hypothesis."),
        evidenceRefs: z
          .array(
            z.object({
              kind: z.enum([
                "receipt",
                "artifact",
                "source",
                "literature",
                "notebook",
                "notebook-run",
                "code-run",
                "benchmark",
                "cas",
                "disclosure",
                "simulation",
                "experiment",
                "vault",
                "review",
                "validation",
                "route",
                "other"
              ]),
              ref: z.string().min(1),
              trust: z
                .enum([
                  "proved",
                  "exact-computed",
                  "bounded-numeric",
                  "smt-checked",
                  "dimension-checked",
                  "source-cited",
                  "cross-checked",
                  "unverified",
                  "refuted"
                ])
                .optional(),
              summary: z.string().optional()
            })
          )
          .optional()
          .describe("Local evidence references supporting or contextualizing the hypothesis."),
        noveltyNotes: z.array(z.string()).optional(),
        priorArtNotes: z.array(z.string()).optional(),
        risks: z.array(z.string()).optional(),
        nextChecks: z.array(z.string()).optional()
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessInventionLog(input))
  );

  server.registerTool(
    "truth_harness_invention_list",
    {
      title: "List Invention Logs",
      description: "List private local invention/discovery hypothesis logs from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessInventionList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_discovery_package",
    {
      title: "Create Discovery Package",
      description:
        "Render or write a local Markdown discovery package for an invention log, including evidence review, validation requirements, and patent/safety caveats.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        entryId: z.string().optional().describe("Invention log entry id. Defaults to the newest entry."),
        write: z
          .boolean()
          .optional()
          .describe("When true, write Markdown into .truth-harness/findings. Defaults to false.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async ({ workspacePath, entryId, write }) =>
      toolJson(await handleTruthHarnessDiscoveryPackage({ workspacePath, entryId, write }))
  );

  const claimChartEvidenceRefSchema = z.object({
    kind: z.enum(["receipt", "artifact", "source", "literature", "notebook", "notebook-run", "code-run", "benchmark", "cas", "disclosure", "simulation", "experiment", "vault", "review", "validation", "route", "other"]),
    ref: z.string().min(1),
    trust: z
      .enum([
        "proved",
        "exact-computed",
        "bounded-numeric",
        "smt-checked",
        "dimension-checked",
        "source-cited",
        "cross-checked",
        "unverified",
        "refuted"
      ])
      .optional(),
    summary: z.string().optional()
  });

  server.registerTool(
    "truth_harness_claim_chart",
    {
      title: "Create Claim Chart",
      description:
        "Render or write a local patent claim chart for an invention log with evidence refs, prior-art notes, reduction-to-practice refs, and legal-review caveats. This is not legal advice.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        entryId: z.string().optional().describe("Invention log entry id. Defaults to the newest entry."),
        title: z.string().optional().describe("Claim chart title."),
        elements: z
          .array(
            z.object({
              text: z.string().min(1),
              supportRefs: z.array(claimChartEvidenceRefSchema).optional(),
              priorArtRefs: z.array(z.string().min(1)).optional(),
              notes: z.array(z.string().min(1)).optional()
            })
          )
          .min(1)
          .describe("Explicit candidate claim elements. The tool will not invent elements."),
        evidenceRefs: z
          .array(claimChartEvidenceRefSchema)
          .optional()
          .describe("Shared support evidence refs applied to elements without explicit supportRefs."),
        noveltyQuestions: z.array(z.string().min(1)).optional().describe("Open novelty questions for legal review."),
        priorArtNotes: z.array(z.string().min(1)).optional().describe("Prior-art notes for human review."),
        reductionToPracticeRefs: z
          .array(z.string().min(1))
          .optional()
          .describe("Reduction-to-practice or constructive example refs."),
        write: z
          .boolean()
          .optional()
          .describe("When true, write JSON and Markdown into .truth-harness/patents. Defaults to false.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessClaimChart(input))
  );

  server.registerTool(
    "truth_harness_claim_chart_list",
    {
      title: "List Claim Charts",
      description: "List private local patent claim charts from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessClaimChartList({ workspacePath }))
  );

  const modelContextSectionSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    sourceRefs: z.array(z.string().min(1)).default([])
  });

  server.registerTool(
    "truth_harness_model_context_prepare",
    {
      title: "Prepare Model Context",
      description:
        "Create or write a private local selected-context packet for hosted frontier models, local models, or external services. This does not call any model or network endpoint.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        title: z.string().optional().describe("Short packet title."),
        purpose: z.string().min(1).describe("Why the selected context is being prepared for model review."),
        service: z.string().min(1).describe("Target service/provider or local model label."),
        target: z.enum(["hosted-model", "local-model", "external-service"]).optional().describe("Target type. Defaults to hosted-model."),
        model: z.string().optional().describe("Specific hosted or local model name."),
        endpoint: z.string().optional().describe("Optional endpoint or service surface."),
        dataClasses: z.array(z.string().min(1)).optional().describe("Classes of selected data included in the packet."),
        selectedContextRefs: z.array(z.string().min(1)).optional().describe("Local refs selected for review."),
        sections: z.array(modelContextSectionSchema).optional().describe("Prompt sections with exact selected content."),
        redactions: z.array(z.string().min(1)).optional().describe("Redaction/minimization notes."),
        exclusions: z.array(z.string().min(1)).optional().describe("Local data intentionally excluded from this packet."),
        approvalRef: z.string().optional().describe("Human approval prompt, issue, ticket, or other audit reference."),
        approvedBy: z.string().optional().describe("Approver name or role."),
        approvedAt: z.string().optional().describe("Approval timestamp."),
        disclosureRef: z.string().optional().describe("Existing disclosure log id or path, if one was already created."),
        disclosureStatus: z.enum(["not-required", "required-not-created", "planned", "sent", "cancelled"]).optional(),
        write: z.boolean().optional().describe("When true, write JSON plus Markdown into the local workspace.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessModelContextPrepare(input))
  );

  server.registerTool(
    "truth_harness_model_context_list",
    {
      title: "List Model Context Packets",
      description: "List private local model-context packets from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessModelContextList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_disclosure_log",
    {
      title: "Log External Disclosure",
      description:
        "Write a private local audit record for selected context sent to a hosted model, external CAS, scientific API, lab service, or other non-local system.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root."),
        service: z.string().min(1).describe("External service or provider, such as OpenAI, Anthropic, WolframAlpha, or a lab API."),
        model: z.string().optional().describe("Specific model name, if applicable."),
        endpoint: z.string().optional().describe("Optional endpoint or external service surface."),
        purpose: z.string().min(1).describe("Why selected context is being sent externally."),
        dataClasses: z
          .array(z.string().min(1))
          .min(1)
          .describe("Classes of data disclosed, such as selected proof sketch or selected source excerpt."),
        contextSummary: z.string().min(1).describe("Human-readable summary of the exact selected context disclosed."),
        selectedContextRefs: z
          .array(z.string().min(1))
          .optional()
          .describe("Local receipt, source, notebook, benchmark, or artifact refs for the selected context."),
        userInitiated: z.boolean().optional().describe("Whether the disclosure was explicitly initiated by the user."),
        approvalRef: z.string().optional().describe("Human approval prompt, issue, ticket, or other audit reference."),
        status: z.enum(["planned", "sent", "received", "cancelled"]).optional().describe("External call status."),
        responseSummary: z.string().optional().describe("Optional summary of the external response."),
        outputRefs: z.array(z.string().min(1)).optional().describe("Local output refs produced from the external call.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      }
    },
    async (input) => toolJson(await handleTruthHarnessExternalDisclosureLog(input))
  );

  server.registerTool(
    "truth_harness_disclosure_list",
    {
      title: "List External Disclosures",
      description: "List private local external model/service disclosure audit records from the workspace.",
      inputSchema: {
        workspacePath: z
          .string()
          .optional()
          .describe("Workspace-local project root. Defaults to the MCP server workspace root.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ workspacePath }) => toolJson(await handleTruthHarnessExternalDisclosureList({ workspacePath }))
  );

  server.registerTool(
    "truth_harness_replay",
    {
      title: "Replay Truth Harness Receipt",
      description:
        "Replay a saved receipt by JSON string or workspace-local path and report trust-critical differences.",
      inputSchema: {
        receiptJson: z.string().optional().describe("Receipt JSON content to replay."),
        receiptPath: z.string().optional().describe("Receipt JSON path under the current workspace to replay.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ receiptJson, receiptPath }) => toolJson(await handleTruthHarnessReplay({ receiptJson, receiptPath }))
  );

  server.registerTool(
    "truth_harness_render_receipt",
    {
      title: "Render Truth Harness Receipt",
      description:
        "Render a saved receipt JSON string or workspace-local receipt path as Markdown or HTML for reports, issues, docs, and review.",
      inputSchema: {
        receiptJson: z.string().optional().describe("Receipt JSON content to render."),
        receiptPath: z.string().optional().describe("Receipt JSON path under the current workspace to render."),
        format: z.enum(["markdown", "html"]).optional().describe("Output format. Defaults to markdown.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ receiptJson, receiptPath, format }) =>
      toolJson(await handleTruthHarnessRenderReceipt({ receiptJson, receiptPath, format }))
  );

  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = createTruthHarnessMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  await startStdioServer();
}
