import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import {
  addResearchSessionCheckpoint,
  listValidationPlans,
  runWorkspacePilotLoop,
  solveSmtProblem,
  validateWorkspaceArtifacts,
  writeHardMathClosureReport,
  writeHardMathSeedWorkspace,
  writeWorkspacePilotLoopRecord
} from "../packages/core/dist/index.js";

const DEFAULT_CASE_ID = "exact-fraction-lemma";
const DEFAULT_NOW = "2026-06-20T12:00:00.000Z";

const args = new Set(process.argv.slice(2));
const keep = args.has("--keep");
const writeReport = !args.has("--no-report");
const caseId = readOption("--case") ?? readPositionalCaseId() ?? DEFAULT_CASE_ID;
const requiredTrust = readOption("--require-trust");
const reportWorkspace = readOption("--report-workspace") ?? process.cwd();
const maximaCommand = readOption("--maxima-command") ?? process.env.TRUTH_HARNESS_MAXIMA ?? "truth-harness-missing-maxima-command";
const leanCommand = readOption("--lean-command") ?? process.env.TRUTH_HARNESS_LEAN ?? "truth-harness-missing-lean-command";
const z3Command = readOption("--z3-command") ?? process.env.TRUTH_HARNESS_Z3 ?? "truth-harness-missing-z3-command";
const cvc5Command = readOption("--cvc5-command") ?? process.env.TRUTH_HARNESS_CVC5;
const startedAt = new Date().toISOString();
const root = await mkdtemp(join(tmpdir(), "truth-harness-hard-math-closure-"));

try {
  const seed = await writeHardMathSeedWorkspace({
    rootPath: root,
    now: DEFAULT_NOW,
    caseIds: [caseId],
    writeRunNextPlan: true
  });
  const seededCase = seed.cases[0];

  if (caseId === "smt-bounded-closure-fixture" && seededCase) {
    await prepareSmtFixtureEvidence(root, seededCase.sessionId);
  }

  const loop = await runWorkspacePilotLoop({
    rootPath: root,
    executeLocal: true,
    writeRunNextPlans: true,
    maxSteps: 3,
    now: "2026-06-20T12:05:00.000Z",
    maximaCommand,
    leanCommand,
    z3Command,
    cvc5Command
  });
  const writtenLoop = await writeWorkspacePilotLoopRecord({
    rootPath: root,
    loop: loop.loop
  });

  const plans = await listValidationPlans(root);
  const plan = plans.find((candidate) => candidate.planId === seededCase?.validationPlanId);
  const proofGate = plan?.gates.find((gate) => gate.kind === "proof");
  const validation = await validateWorkspaceArtifacts({ rootPath: root });
  const attachedEvidenceRef = loop.loop.summary.evidenceRefs.find((ref) => /^(route|smt|cas|proof):/u.test(ref));
  const gateTrusts = proofGate?.evidenceRefs.map((ref) => ref.trust).filter(Boolean) ?? [];
  const proofGateClosed =
    proofGate?.status === "satisfied" &&
    proofGate.evidenceRefs.some((ref) => evidenceRefSatisfiesClosure(ref)) &&
    (!requiredTrust || gateTrusts.includes(requiredTrust));
  const passed =
    validation.passed &&
    loop.loop.summary.executedSteps >= 1 &&
    Boolean(attachedEvidenceRef) &&
    proofGateClosed;
  const caseReport = {
    passed,
    caseId,
    ...(requiredTrust ? { requiredTrust } : {}),
    transientWorkspacePath: root,
    transientWorkspaceCleaned: !keep,
    validationPlanId: plan?.planId,
    proofGateStatus: proofGate?.status,
    gateEvidence: summarizeGateEvidence(proofGate?.evidenceRefs ?? []),
    executedSteps: loop.loop.summary.executedSteps,
    attachedEvidenceSteps: loop.loop.summary.attachedEvidenceSteps,
    loopStatus: loop.loop.status,
    loopStopReason: loop.loop.stopReason,
    validationPassed: validation.passed,
    validationErrors: validation.summary.errors,
    validationWarnings: validation.summary.warnings,
    evidenceSummary: attachedEvidenceRef
      ? `Attached ${attachedEvidenceRef} in transient closure workspace.`
      : "No evidence was attached.",
    warnings: loop.loop.warnings
  };
  const runtime = {
    kind: process.env.TRUTH_HARNESS_CONTAINER === "1" ? "docker" : "native",
    command: process.argv.join(" "),
    containerized: process.env.TRUTH_HARNESS_CONTAINER === "1"
  };
  const reportWarnings = nativeHostWarnings(caseReport, runtime);
  const report = writeReport
    ? await writeHardMathClosureReport({
        rootPath: reportWorkspace,
        createdAt: startedAt,
        completedAt: new Date().toISOString(),
        runtime,
        cases: [caseReport],
        warnings: reportWarnings
      })
    : undefined;

  printSummary({
    ...caseReport,
    root,
    keep,
    evidenceRef: attachedEvidenceRef,
    loopRecord: writtenLoop.jsonPath,
    validationIssues: validation.summary,
    reportPath: report?.jsonPath
  });

  if (!passed) {
    process.exitCode = 1;
  }
} finally {
  if (!keep) {
    await rm(root, { recursive: true, force: true });
  }
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function prepareSmtFixtureEvidence(workspaceRoot, sessionId) {
  const smt = await solveSmtProblem({
    rootPath: workspaceRoot,
    queryName: "bounded_integer_sat",
    variables: ["x"],
    constraints: ["x > 0", "x < 3"],
    includeModel: true
  });
  const evidenceRef = workspaceLocalRef(workspaceRoot, smt.check.jsonPath);
  await addResearchSessionCheckpoint({
    rootPath: workspaceRoot,
    sessionRef: sessionId,
    summary: "Prepared solver-backed SMT evidence for bounded_integer_sat.",
    evidenceRefs: [
      {
        kind: "smt",
        ref: evidenceRef,
        trust: smt.check.record.trust,
        summary: `SMT ${smt.check.record.backend.id} returned ${smt.check.record.status} for bounded_integer_sat.`
      }
    ],
    decisions: [
      "Attach this SMT artifact only to the matching SMT query validation gate; it is evidence for the encoded constraints, not a proof of broader prose."
    ],
    nextChecks: [
      "Run workspace pilot-loop so run-next attaches the scoped SMT evidence to the linked validation gate."
    ]
  });
}

function workspaceLocalRef(workspaceRoot, absolutePath) {
  return relative(workspaceRoot, absolutePath).split(sep).join("/");
}

function evidenceRefSatisfiesClosure(ref) {
  return (
    (ref.kind === "route" && (ref.trust === "exact-computed" || ref.trust === "cross-checked" || ref.trust === "smt-checked" || ref.trust === "proved")) ||
    (ref.kind === "smt" && ref.trust === "smt-checked") ||
    (ref.kind === "cas" && ref.trust === "cross-checked") ||
    (ref.kind === "proof" && ref.trust === "proved")
  );
}

function summarizeGateEvidence(evidenceRefs) {
  return evidenceRefs.map((ref) => ({
    kind: ref.kind,
    ...(ref.trust ? { trust: ref.trust } : {}),
    ...(ref.summary ? { status: ref.summary } : {})
  }));
}

function nativeHostWarnings(caseReport, runtime) {
  if (runtime.kind !== "native") {
    return [];
  }
  if (caseReport.caseId === "symbolic-cas-closure-fixture") {
    return [
      "This symbolic closure ran on the native host. Use `npm run docker:symbolic-closure` for Docker-provisioned Maxima evidence before recording reviewer-grade closure."
    ];
  }
  if (caseReport.caseId === "smt-bounded-closure-fixture") {
    return [
      "This SMT closure ran on the native host. Use `npm run docker:smt-closure` for Docker-provisioned Z3 evidence before recording reviewer-grade closure."
    ];
  }
  return [];
}

function readPositionalCaseId() {
  return process.argv
    .slice(2)
    .find((arg) => !arg.startsWith("-"));
}

function printSummary(summary) {
  const status = summary.passed ? "PASS" : "FAIL";
  console.log(`Truth Harness hard-math closure smoke: ${status}`);
  console.log(`case: ${summary.caseId}`);
  console.log(`workspace: ${summary.keep ? summary.root : `${summary.root} (cleaned)`}`);
  console.log(`validation plan: ${summary.validationPlanId ?? "missing"}`);
  console.log(`proof gate: ${summary.proofGateStatus ?? "missing"}`);
  console.log(`gate evidence: ${formatGateEvidence(summary.gateEvidence)}`);
  console.log(`executed steps: ${summary.executedSteps}`);
  console.log(`evidence: ${summary.evidenceRef ?? "missing"}`);
  console.log(`pilot-loop record: ${summary.keep ? summary.loopRecord : "written and cleaned with temp workspace"}`);
  console.log(`report: ${summary.reportPath ?? "disabled"}`);
  console.log(
    `workspace validation issues: errors=${summary.validationIssues.errors}, warnings=${summary.validationIssues.warnings}`
  );
}

function formatGateEvidence(evidenceRefs) {
  if (!evidenceRefs || evidenceRefs.length === 0) {
    return "none";
  }
  return evidenceRefs.map((ref) => `${ref.kind}:${ref.trust ?? "untrusted"}`).join(", ");
}
