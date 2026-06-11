import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createEvidenceAudit, type EvidenceAudit, type EvidenceAuditClaimType } from "./evidence-audit.js";
import type { InventionEvidenceRef } from "./invention-log.js";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";

export const VALIDATION_PLAN_DOMAINS = [
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
] as const;

export const VALIDATION_GATE_KINDS = [
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
] as const;

export const VALIDATION_GATE_STATUSES = ["missing", "planned", "in-progress", "satisfied", "blocked", "not-applicable"] as const;
export const VALIDATION_READINESS = ["blocked-refuted", "not-ready", "ready-for-review", "ready-for-narrow-claim"] as const;

export type ValidationPlanDomain = (typeof VALIDATION_PLAN_DOMAINS)[number];
export type ValidationGateKind = (typeof VALIDATION_GATE_KINDS)[number];
export type ValidationGateStatus = (typeof VALIDATION_GATE_STATUSES)[number];
export type ValidationReadiness = (typeof VALIDATION_READINESS)[number];

export interface ValidationEvidenceRef {
  kind:
    | "receipt"
    | "artifact"
    | "source"
    | "literature"
    | "notebook"
    | "notebook-run"
    | "code-run"
    | "benchmark"
    | "disclosure"
    | "simulation"
    | "experiment"
    | "vault"
    | "audit"
    | "snapshot"
    | "session"
    | "review"
    | "validation"
    | "model-context"
    | "invention"
    | "claim-chart"
    | "discovery-package"
    | "other";
  ref: string;
  trust?: TrustLabel;
  summary?: string;
}

export interface ValidationGateInput {
  kind?: ValidationGateKind;
  description: string;
  status?: ValidationGateStatus;
  evidenceRefs?: ValidationEvidenceRef[];
  rationale?: string;
  blocking?: boolean;
}

export interface ValidationGate {
  gateId: string;
  kind: ValidationGateKind;
  description: string;
  status: ValidationGateStatus;
  blocking: boolean;
  evidenceRefs: ValidationEvidenceRef[];
  rationale: string;
  nextChecks: string[];
}

export interface ValidationPlan {
  schemaVersion: "theorem.validation-plan.v0";
  planId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  claim: string;
  objective: string;
  domains: ValidationPlanDomain[];
  evidenceRefs: ValidationEvidenceRef[];
  audit: {
    auditId: string;
    verdict: EvidenceAudit["verdict"];
    claimTypes: EvidenceAuditClaimType[];
    requiredNextChecks: string[];
    overclaimWarnings: string[];
  };
  gates: ValidationGate[];
  readiness: {
    status: ValidationReadiness;
    summary: string;
    blockingGateCount: number;
    missingGateCount: number;
    inProgressGateCount: number;
    satisfiedGateCount: number;
  };
  recommendedClaimLanguage: string;
  boundary: {
    notProof: true;
    notMedicalAdvice: true;
    notRegulatoryApproval: true;
    notLegalAdvice: true;
    simulationIsNotReality: true;
    aiOutputIsNotTruth: true;
    requiresIndependentVerification: true;
  };
  warnings: string[];
  privacy: PrivacyMetadata;
  markdown: string;
}

export interface CreateValidationPlanInput {
  rootPath: string;
  claim: string;
  title?: string;
  objective?: string;
  domains?: ValidationPlanDomain[];
  evidenceRefs?: ValidationEvidenceRef[];
  gates?: ValidationGateInput[];
  now?: string;
}

export interface ValidationPlanWriteResult {
  plan: ValidationPlan;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export function isValidationPlanDomain(value: string): value is ValidationPlanDomain {
  return (VALIDATION_PLAN_DOMAINS as readonly string[]).includes(value);
}

export function isValidationGateKind(value: string): value is ValidationGateKind {
  return (VALIDATION_GATE_KINDS as readonly string[]).includes(value);
}

export function isValidationGateStatus(value: string): value is ValidationGateStatus {
  return (VALIDATION_GATE_STATUSES as readonly string[]).includes(value);
}

export async function createValidationPlan(input: CreateValidationPlanInput): Promise<ValidationPlan> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const claim = requireText(input.claim, "Validation plan claim is required.");
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs ?? []);
  const audit = await createEvidenceAudit({
    rootPath: status.root,
    claim,
    title: input.title,
    evidenceRefs: toAuditEvidenceRefs(evidenceRefs),
    now: createdAt
  });
  const domains = normalizeDomains(input.domains ?? inferDomains(claim, audit.claimTypes));
  const automaticGates = gatesFor({ claim, domains, evidenceRefs, audit });
  const manualGates = normalizeManualGates(input.gates ?? []);
  const gates = mergeGates([...automaticGates, ...manualGates]);
  const readiness = readinessFor(audit, gates);
  const planWithoutId = {
    projectId: status.manifest.projectId,
    createdAt,
    updatedAt: createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromClaim(claim),
    claim,
    objective: normalizeOptionalText(input.objective) ?? "Define the validation gates required before making a stronger claim.",
    domains,
    evidenceRefs,
    audit: {
      auditId: audit.auditId,
      verdict: audit.verdict,
      claimTypes: audit.claimTypes,
      requiredNextChecks: audit.requiredNextChecks,
      overclaimWarnings: audit.overclaimWarnings
    },
    gates,
    readiness,
    recommendedClaimLanguage: recommendedClaimLanguageFor({ claim, domains, audit, readiness }),
    boundary: validationBoundary(),
    warnings: warningsFor({ domains, audit, gates, readiness }),
    privacy: status.manifest.privacy
  };
  const planId = `plan_${stableHash(planWithoutId).slice(0, 16)}`;
  const planWithoutMarkdown = {
    schemaVersion: "theorem.validation-plan.v0" as const,
    planId,
    ...planWithoutId
  };

  return {
    ...planWithoutMarkdown,
    markdown: renderValidationPlanMarkdown(planWithoutMarkdown)
  };
}

export async function writeValidationPlan(input: CreateValidationPlanInput): Promise<ValidationPlanWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const plan = await createValidationPlan(input);
  const validationDir = resolve(status.root, status.manifest.directories.validation);
  await mkdir(validationDir, { recursive: true });
  const baseName = `${plan.createdAt.slice(0, 10)}-${plan.planId}`;
  const jsonPath = join(validationDir, `${baseName}.json`);
  const markdownPath = join(validationDir, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, plan.markdown, "utf8");

  return {
    plan,
    jsonPath,
    markdownPath,
    markdown: plan.markdown
  };
}

export async function listValidationPlans(rootPath: string): Promise<ValidationPlan[]> {
  const status = await requireLocalWorkspace(rootPath);
  const validationDir = resolve(status.root, status.manifest.directories.validation);

  let files: string[];
  try {
    files = await readdir(validationDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const plans = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(validationDir, file), "utf8")) as ValidationPlan)
  );

  return plans
    .filter((plan) => plan.schemaVersion === "theorem.validation-plan.v0")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function renderValidationPlanMarkdown(plan: Omit<ValidationPlan, "markdown">): string {
  const lines: string[] = [
    `# Validation Plan: ${escapeMarkdownText(plan.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Plan | \`${plan.planId}\` |`,
    `| Created | ${escapeMarkdownTable(plan.createdAt)} |`,
    `| Readiness | \`${plan.readiness.status}\` |`,
    `| Audit verdict | \`${plan.audit.verdict.status}\` |`,
    `| Domains | ${plan.domains.map((domain) => `\`${domain}\``).join(", ")} |`,
    `| Privacy | \`${plan.privacy.mode}\` / network \`${plan.privacy.networkAccess}\` |`,
    "",
    "## Claim",
    "",
    escapeMarkdownText(plan.claim),
    "",
    "## Objective",
    "",
    escapeMarkdownText(plan.objective),
    "",
    "## Recommended Claim Language",
    "",
    escapeMarkdownText(plan.recommendedClaimLanguage),
    "",
    "## Gates",
    "",
    "| Status | Kind | Blocking | Gate | Evidence refs | Next checks |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  for (const gate of plan.gates) {
    lines.push(
      [
        `\`${gate.status}\``,
        `\`${gate.kind}\``,
        `\`${String(gate.blocking)}\``,
        escapeMarkdownTable(gate.description),
        escapeMarkdownTable(formatEvidenceRefs(gate.evidenceRefs)),
        escapeMarkdownTable(gate.nextChecks.join("; "))
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |")
    );
  }

  lines.push("", "## Evidence Audit Next Checks", "");
  if (plan.audit.requiredNextChecks.length === 0) {
    lines.push("- No audit next checks were generated.");
  } else {
    for (const check of plan.audit.requiredNextChecks) {
      lines.push(`- ${escapeMarkdownText(check)}`);
    }
  }

  lines.push("", "## Warnings", "");
  for (const warning of plan.warnings) {
    lines.push(`- ${escapeMarkdownText(warning)}`);
  }

  lines.push("", "## Boundary", "");
  lines.push("- This validation plan is a local checklist for evidence work.");
  lines.push("- It is not proof, medical advice, regulatory approval, legal advice, or experimental validation by itself.");

  return `${lines.join("\n")}\n`;
}

function gatesFor(input: {
  claim: string;
  domains: ValidationPlanDomain[];
  evidenceRefs: ValidationEvidenceRef[];
  audit: EvidenceAudit;
}): ValidationGate[] {
  const gates: ValidationGate[] = [
    gate({
      kind: "evidence-audit",
      description: "Audit the claim against local evidence and overclaim rules.",
      status: "satisfied",
      blocking: true,
      evidenceRefs: [{ kind: "audit", ref: input.audit.auditId, summary: input.audit.verdict.summary }],
      rationale: "Every validation plan embeds a local evidence audit.",
      nextChecks: input.audit.requiredNextChecks
    })
  ];

  if (hasAnyDomain(input.domains, ["math"])) {
    gates.push(
      gate({
        kind: "proof",
        description: "Create replayable proof, exact computation, SMT, CAS, or counterexample evidence for the mathematical claim.",
        status: statusForProof(input.audit),
        blocking: true,
        evidenceRefs: refsByKind(input.evidenceRefs, ["receipt"]),
        rationale: "Mathematical claims need proof or exact/replayable computation before they should be stated as true.",
        nextChecks: ["Attach a trusted receipt with `proved`, `exact-computed`, `smt-checked`, or `refuted` trust."]
      })
    );
  }

  if (hasAnyDomain(input.domains, ["source", "literature", "biomedical", "patent", "safety", "regulatory"])) {
    const sourceEvidenceRefs = refsByKind(input.evidenceRefs, ["source", "literature"]);
    gates.push(
      gate({
        kind: "source-citation",
        description: "Attach local source-cited evidence and check entailment against the exact claim wording.",
        status: statusWhenAny(sourceEvidenceRefs, "satisfied"),
        blocking: true,
        evidenceRefs: sourceEvidenceRefs,
        rationale: "Retrieved sources provide context, not proof; serious claims need cited sources and entailment review.",
        nextChecks: ["Ingest local literature, papers, prior art, or notes and cite the exact passages that support the claim."]
      }),
      gate({
        kind: "literature-record",
        description: "Record structured local literature, prior-art, dataset, or database-export metadata with limitations and review caveats.",
        status: statusWhenAny(refsByKind(input.evidenceRefs, ["literature"]), "in-progress"),
        blocking: hasAnyDomain(input.domains, ["biomedical", "patent", "safety", "regulatory"]),
        evidenceRefs: refsByKind(input.evidenceRefs, ["literature"]),
        rationale: "Discovery work needs more than chunks; reviewers need source identity, provenance, limitations, and quality flags.",
        nextChecks: ["Create literature records for key papers, patents, datasets, database exports, or standards before stronger claims."]
      })
    );
  }

  if (hasAnyDomain(input.domains, ["simulation", "physics", "engineering", "biomedical"])) {
    gates.push(
      gate({
        kind: "simulation-log",
        description: "Record local simulation assumptions, parameters, metrics, uncertainty, outputs, and limitations.",
        status: statusWhenAny(refsByKind(input.evidenceRefs, ["simulation", "notebook-run"]), "satisfied"),
        blocking: input.domains.includes("simulation") || input.domains.includes("biomedical"),
        evidenceRefs: refsByKind(input.evidenceRefs, ["simulation", "notebook-run"]),
        rationale: "Simulation output is computational evidence and must be replayable before it can guide follow-up work.",
        nextChecks: ["Attach a simulation log and run sensitivity or independent implementation checks."]
      }),
      gate({
        kind: "notebook-run",
        description: "Attach a local notebook/script/pipeline run record with inputs, outputs, environment, replay command, and limitations.",
        status: statusWhenAny(refsByKind(input.evidenceRefs, ["notebook-run"]), "in-progress"),
        blocking: input.domains.includes("biomedical") || input.domains.includes("engineering") || input.domains.includes("physics"),
        evidenceRefs: refsByKind(input.evidenceRefs, ["notebook-run"]),
        rationale: "Discovery workflows need reproducible run provenance, not just final claims or screenshots.",
        nextChecks: ["Record notebook-run provenance and create a workspace snapshot after outputs are attached."]
      }),
      gate({
        kind: "code-run",
        description: "Attach shell-free local code-run evidence for scripts, tests, parsers, or utilities that were actually executed.",
        status: statusWhenAny(refsByKind(input.evidenceRefs, ["code-run"]), "in-progress"),
        blocking: input.domains.includes("engineering") || input.domains.includes("physics"),
        evidenceRefs: refsByKind(input.evidenceRefs, ["code-run"]),
        rationale: "Agents should cite observed local process execution when they claim code was run.",
        nextChecks: ["Record code-run refs with code/input/output refs, then snapshot the workspace after important executions."]
      }),
      gate({
        kind: "simulation-review",
        description: "Review whether the simulation model, assumptions, implementation, and uncertainty are appropriate.",
        status: statusForReview(input.audit),
        blocking: input.domains.includes("biomedical") || input.domains.includes("safety"),
        evidenceRefs: refsByKind(input.evidenceRefs, ["review"]),
        rationale: "Model review is needed before simulation evidence influences scientific or safety-sensitive conclusions.",
        nextChecks: ["Record domain expert review for model assumptions, code, uncertainty, and failure modes."]
      })
    );
  }

  if (hasAnyDomain(input.domains, ["experiment", "biomedical", "clinical", "safety"])) {
    const experimentRefs = refsByKind(input.evidenceRefs, ["experiment"]);
    gates.push(
      gate({
        kind: "experiment-record",
        description: "Record protocol-scoped experiment evidence with data, analysis refs, observations, and limitations.",
        status: statusWhenAny(experimentRefs, "satisfied"),
        blocking: input.domains.includes("experiment") || input.domains.includes("biomedical"),
        evidenceRefs: experimentRefs,
        rationale: "Protocol records are required before treating observations as evidence.",
        nextChecks: ["Attach experiment logs with protocol, data, analysis, outcome, and limitation refs."]
      }),
      gate({
        kind: "experiment-replication",
        description: "Replicate the observation independently before broadening the claim.",
        status: experimentRefs.length > 1 ? "satisfied" : experimentRefs.length === 1 ? "in-progress" : "missing",
        blocking: input.domains.includes("biomedical") || input.domains.includes("clinical"),
        evidenceRefs: experimentRefs,
        rationale: "Single protocol observations are not enough for broad real-world or biomedical conclusions.",
        nextChecks: ["Record independent replication with separate protocol/data/analysis refs."]
      })
    );
  }

  if (hasAnyDomain(input.domains, ["biomedical", "clinical", "safety", "regulatory"])) {
    const experimentRefs = refsByKind(input.evidenceRefs, ["experiment"]);
    gates.push(
      gate({
        kind: "expert-review",
        description: "Record scoped expert review before making biomedical, safety, or clinical claims.",
        status: statusForReview(input.audit),
        blocking: true,
        evidenceRefs: refsByKind(input.evidenceRefs, ["review"]),
        rationale: "Expert review can identify invalid assumptions and missing validation, but it is still not proof by itself.",
        nextChecks: ["Request and record expert review with findings, limitations, recommendations, and required next checks."]
      }),
      gate({
        kind: "wet-lab",
        description: "Run wet-lab or validated external assay work before efficacy, cure, mechanism, or safety claims.",
        status: experimentRefs.length > 0 ? "in-progress" : "missing",
        blocking: true,
        evidenceRefs: experimentRefs,
        rationale: "Biomedical hypotheses need real-world biological validation before stronger claims.",
        nextChecks: ["Attach wet-lab protocol, data, analysis, safety notes, and independent replication plan."]
      }),
      gate({
        kind: "preclinical",
        description: "Complete appropriate preclinical validation before clinical or therapeutic claims.",
        status: "missing",
        blocking: input.domains.includes("clinical"),
        evidenceRefs: [],
        rationale: "Preclinical evidence is outside the scope of computational and literature-only work.",
        nextChecks: ["Define preclinical requirements with qualified experts before claiming therapeutic readiness."]
      }),
      gate({
        kind: "clinical",
        description: "Do not make patient, treatment, cure, safety, or efficacy claims without clinical validation.",
        status: "missing",
        blocking: true,
        evidenceRefs: [],
        rationale: "Clinical validity requires human clinical evidence and appropriate review.",
        nextChecks: ["Record clinical trial or qualified clinical evidence refs before any clinical claim."]
      }),
      gate({
        kind: "safety",
        description: "Record safety review, contraindications, toxicity, and risk analysis before safety claims.",
        status: statusForReview(input.audit),
        blocking: true,
        evidenceRefs: refsByKind(input.evidenceRefs, ["review"]),
        rationale: "Safety-sensitive claims require independent safety review and domain-specific validation.",
        nextChecks: ["Attach safety review, toxicity/risk evidence, and limitations."]
      }),
      gate({
        kind: "ethics",
        description: "Record ethics/IRB/consent requirements before human or sensitive biological work.",
        status: "missing",
        blocking: false,
        evidenceRefs: [],
        rationale: "Ethics review is required for many real-world biomedical workflows.",
        nextChecks: ["Document whether ethics/IRB/consent review is required before any real-world study."]
      }),
      gate({
        kind: "regulatory",
        description: "Record regulatory review before approval, compliance, diagnostic, treatment, or product claims.",
        status: "missing",
        blocking: input.domains.includes("regulatory") || input.domains.includes("clinical"),
        evidenceRefs: [],
        rationale: "The workbench cannot provide regulatory approval.",
        nextChecks: ["Attach qualified regulatory review before any approval or compliance claim."]
      })
    );
  }

  if (hasAnyDomain(input.domains, ["patent"])) {
    gates.push(
      gate({
        kind: "prior-art",
        description: "Attach prior-art search notes and local source refs before novelty language.",
        status: statusWhenAny(refsByKind(input.evidenceRefs, ["source", "literature"]), "in-progress"),
        blocking: true,
        evidenceRefs: refsByKind(input.evidenceRefs, ["source", "literature"]),
        rationale: "Patent novelty and non-obviousness cannot be inferred from agent output.",
        nextChecks: ["Record closest prior art, search query history, literature records, and source refs."]
      }),
      gate({
        kind: "claim-chart",
        description: "Create a claim chart mapping candidate claim elements to evidence refs.",
        status: statusWhenAny(refsByKind(input.evidenceRefs, ["claim-chart"]), "satisfied"),
        blocking: true,
        evidenceRefs: refsByKind(input.evidenceRefs, ["claim-chart"]),
        rationale: "Claim charts help human legal review inspect support element by element.",
        nextChecks: ["Create a claim chart for each candidate independent claim."]
      }),
      gate({
        kind: "reduction-to-practice",
        description: "Attach reduction-to-practice evidence or a clear constructive example.",
        status: statusWhenAny(refsByKind(input.evidenceRefs, ["experiment", "receipt", "notebook", "notebook-run", "code-run"]), "in-progress"),
        blocking: true,
        evidenceRefs: refsByKind(input.evidenceRefs, ["experiment", "receipt", "notebook", "notebook-run", "code-run"]),
        rationale: "Patent drafting needs support beyond a loose idea.",
        nextChecks: ["Attach experiment, working prototype, proof, notebook, code-run, or constructive implementation refs."]
      }),
      gate({
        kind: "patent-legal",
        description: "Record human patent-attorney review before filing, public disclosure, or patentability conclusions.",
        status: statusForReview(input.audit),
        blocking: true,
        evidenceRefs: refsByKind(input.evidenceRefs, ["review"]),
        rationale: "Theorem Workbench is not a patent attorney and does not determine patentability.",
        nextChecks: ["Record legal review scope, limitations, and filing decisions with a qualified patent attorney."]
      })
    );
  }

  if (hasAnyDomain(input.domains, ["engineering", "software", "physics"])) {
    gates.push(
      gate({
        kind: "benchmark",
        description: "Run benchmarks, regression tests, or independent checks before engineering performance claims.",
        status: statusWhenAny(refsByKind(input.evidenceRefs, ["benchmark", "notebook-run", "code-run"]), "satisfied"),
        blocking: false,
        evidenceRefs: refsByKind(input.evidenceRefs, ["benchmark", "notebook-run", "code-run"]),
        rationale: "Engineering claims need reproducible tests, not just plausible analysis.",
        nextChecks: ["Attach benchmark, notebook-run, code-run, or regression-test refs with environment and version metadata."]
      })
    );
  }

  if (refsByKind(input.evidenceRefs, ["receipt"]).length > 0) {
    gates.push(
      gate({
        kind: "replay",
        description: "Replay local receipts before using them in a discovery package.",
        status: "satisfied",
        blocking: true,
        evidenceRefs: refsByKind(input.evidenceRefs, ["receipt"]),
        rationale: "Receipts are only useful if replay remains stable.",
        nextChecks: ["Replay receipts and record any drift in a workspace snapshot."]
      })
    );
  }

  gates.push(
    gate({
      kind: "workspace-snapshot",
      description: "Capture or verify a workspace snapshot before relying on this evidence bundle.",
      status: statusWhenAny(refsByKind(input.evidenceRefs, ["snapshot"]), "satisfied"),
      blocking: false,
      evidenceRefs: refsByKind(input.evidenceRefs, ["snapshot"]),
      rationale: "Snapshots prove artifact identity and drift, not truth.",
      nextChecks: ["Create a workspace snapshot after attaching all evidence refs."]
    })
  );

  return gates;
}

function gate(input: Omit<ValidationGate, "gateId">): ValidationGate {
  return {
    gateId: `gate_${stableHash({
      kind: input.kind,
      description: input.description,
      evidenceRefs: input.evidenceRefs
    }).slice(0, 16)}`,
    ...input
  };
}

function normalizeManualGates(inputs: ValidationGateInput[]): ValidationGate[] {
  return inputs.map((input) =>
    gate({
      kind: input.kind ?? "other",
      description: requireText(input.description, "Validation gate description is required."),
      status: input.status ?? "missing",
      blocking: input.blocking ?? true,
      evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs ?? []),
      rationale: normalizeOptionalText(input.rationale) ?? "User-supplied validation gate.",
      nextChecks: input.status === "satisfied" ? [] : ["Attach local evidence or mark why this gate is not applicable."]
    })
  );
}

function mergeGates(gates: ValidationGate[]): ValidationGate[] {
  const seen = new Set<string>();
  const merged: ValidationGate[] = [];

  for (const gate of gates) {
    const key = `${gate.kind}:${gate.description.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(gate);
  }

  return merged;
}

function readinessFor(audit: EvidenceAudit, gates: ValidationGate[]): ValidationPlan["readiness"] {
  const blockingGateCount = gates.filter((gate) => gate.blocking && gate.status !== "satisfied" && gate.status !== "not-applicable").length;
  const missingGateCount = gates.filter((gate) => gate.status === "missing").length;
  const inProgressGateCount = gates.filter((gate) => gate.status === "planned" || gate.status === "in-progress").length;
  const satisfiedGateCount = gates.filter((gate) => gate.status === "satisfied").length;

  if (audit.verdict.status === "refuted" || gates.some((gate) => gate.status === "blocked")) {
    return {
      status: "blocked-refuted",
      summary: "At least one local evidence item refutes or blocks the claim; do not advance it as a discovery claim.",
      blockingGateCount,
      missingGateCount,
      inProgressGateCount,
      satisfiedGateCount
    };
  }

  if (blockingGateCount === 0) {
    return {
      status: "ready-for-narrow-claim",
      summary: "All blocking gates are satisfied or marked not applicable; only make a narrow claim matching the evidence scope.",
      blockingGateCount,
      missingGateCount,
      inProgressGateCount,
      satisfiedGateCount
    };
  }

  if (inProgressGateCount > 0) {
    return {
      status: "ready-for-review",
      summary: "Some evidence exists, but blocking validation gates remain open; keep the claim in review language.",
      blockingGateCount,
      missingGateCount,
      inProgressGateCount,
      satisfiedGateCount
    };
  }

  return {
    status: "not-ready",
    summary: "Required validation gates are missing; keep this as an unverified hypothesis.",
    blockingGateCount,
    missingGateCount,
    inProgressGateCount,
    satisfiedGateCount
  };
}

function statusForProof(audit: EvidenceAudit): ValidationGateStatus {
  if (audit.verdict.status === "refuted") {
    return "blocked";
  }

  return audit.reviews.some((review) => review.strength === "strong" || review.trust === "proved" || review.trust === "exact-computed")
    ? "satisfied"
    : "missing";
}

function statusForReview(audit: EvidenceAudit): ValidationGateStatus {
  if (audit.reviews.some((review) => review.kind === "review" && (review.strength === "protocol" || review.strength === "strong"))) {
    return "satisfied";
  }

  return audit.reviews.some((review) => review.kind === "review") ? "in-progress" : "missing";
}

function statusWhenAny(refs: ValidationEvidenceRef[], presentStatus: ValidationGateStatus): ValidationGateStatus {
  return refs.length > 0 ? presentStatus : "missing";
}

function inferDomains(claim: string, claimTypes: EvidenceAuditClaimType[]): ValidationPlanDomain[] {
  const domains = new Set<ValidationPlanDomain>();
  const normalized = claim.toLowerCase();

  if (claimTypes.includes("math")) domains.add("math");
  if (claimTypes.includes("source-grounded")) {
    domains.add("source");
    domains.add("literature");
  }
  if (claimTypes.includes("simulation")) domains.add("simulation");
  if (claimTypes.includes("experiment")) domains.add("experiment");
  if (claimTypes.includes("biomedical")) domains.add("biomedical");
  if (claimTypes.includes("patent")) domains.add("patent");
  if (claimTypes.includes("engineering")) domains.add("engineering");
  if (/\b(clinical|patient|trial|therapy|treatment|cure)\b/i.test(normalized)) domains.add("clinical");
  if (/\b(safe|safety|toxicity|risk|harm)\b/i.test(normalized)) domains.add("safety");
  if (/\b(fda|regulatory|approval|compliance|diagnostic)\b/i.test(normalized)) domains.add("regulatory");
  if (/\b(code|software|program|api|system)\b/i.test(normalized)) domains.add("software");
  if (/\b(physics|energy|force|mass|quantum|climate|materials?)\b/i.test(normalized)) domains.add("physics");

  if (domains.size === 0) {
    domains.add("general");
  }

  return [...domains];
}

function normalizeDomains(domains: ValidationPlanDomain[]): ValidationPlanDomain[] {
  const normalized = [...new Set(domains)];
  return normalized.length > 0 ? normalized : ["general"];
}

function hasAnyDomain(domains: ValidationPlanDomain[], candidates: ValidationPlanDomain[]): boolean {
  return candidates.some((candidate) => domains.includes(candidate));
}

function refsByKind(refs: ValidationEvidenceRef[], kinds: ValidationEvidenceRef["kind"][]): ValidationEvidenceRef[] {
  return refs.filter((ref) => kinds.includes(ref.kind));
}

function toAuditEvidenceRefs(refs: ValidationEvidenceRef[]): InventionEvidenceRef[] {
  return refs
    .filter((ref): ref is ValidationEvidenceRef & { kind: InventionEvidenceRef["kind"] } =>
      [
        "receipt",
        "artifact",
        "source",
        "literature",
        "notebook",
        "notebook-run",
        "benchmark",
        "disclosure",
        "simulation",
        "experiment",
        "vault",
        "review",
        "validation",
        "other"
      ].includes(ref.kind)
    )
    .map((ref) => ({
      kind: ref.kind,
      ref: ref.ref,
      trust: ref.trust,
      summary: ref.summary
    }));
}

function recommendedClaimLanguageFor(input: {
  claim: string;
  domains: ValidationPlanDomain[];
  audit: EvidenceAudit;
  readiness: ValidationPlan["readiness"];
}): string {
  if (input.readiness.status === "blocked-refuted") {
    return "Do not present this claim as supported; local evidence refutes or blocks it.";
  }

  if (input.domains.includes("biomedical") || input.domains.includes("clinical")) {
    return "Frame this as an unvalidated biomedical hypothesis and state exactly which local evidence exists; do not claim cure, safety, efficacy, clinical validity, or regulatory approval.";
  }

  if (input.domains.includes("simulation")) {
    return "Frame this as computational evidence from a specified model with assumptions and limitations, not as real-world validation.";
  }

  if (input.audit.verdict.status === "verified-narrow") {
    return "State only the narrow verified result and keep assumptions, tool receipts, and replay scope attached.";
  }

  if (input.audit.verdict.status === "source-grounded") {
    return "State that local sources or literature records discuss or support the scoped claim only after checking entailment; source retrieval is not proof.";
  }

  return "Keep this as a hypothesis until the blocking validation gates are satisfied with local evidence refs.";
}

function warningsFor(input: {
  domains: ValidationPlanDomain[];
  audit: EvidenceAudit;
  gates: ValidationGate[];
  readiness: ValidationPlan["readiness"];
}): string[] {
  const warnings = [
    "Validation plans are local checklists for evidence work; they do not prove the claim by themselves.",
    "Do not treat AI output, simulation output, notebook output, source retrieval, literature metadata, or a review note as truth without the appropriate verification gate."
  ];

  if (input.audit.verdict.status === "overclaimed") {
    warnings.push("The current claim wording overclaims the evidence and should be narrowed before sharing.");
  }

  if (input.domains.includes("biomedical") || input.domains.includes("clinical")) {
    warnings.push("Biomedical and clinical claims require expert, real-world, safety, ethics, and regulatory validation before cure, efficacy, or safety language.");
  }

  if (input.domains.includes("patent")) {
    warnings.push("Patent conclusions require prior-art search, claim support review, reduction-to-practice evidence, and human patent-attorney review.");
  }

  if (input.readiness.blockingGateCount > 0) {
    warnings.push(`${input.readiness.blockingGateCount} blocking validation gate(s) remain open.`);
  }

  if (input.gates.some((gate) => gate.status === "missing")) {
    warnings.push("One or more required validation gates have no local evidence refs yet.");
  }

  return [...new Set(warnings)];
}

function validationBoundary(): ValidationPlan["boundary"] {
  return {
    notProof: true,
    notMedicalAdvice: true,
    notRegulatoryApproval: true,
    notLegalAdvice: true,
    simulationIsNotReality: true,
    aiOutputIsNotTruth: true,
    requiresIndependentVerification: true
  };
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Theorem workspace found. Run `theorem workspace init` before writing validation plans.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function titleFromClaim(claim: string): string {
  const trimmed = claim.length > 72 ? `${claim.slice(0, 69)}...` : claim;
  return `Validation plan: ${trimmed}`;
}

function normalizeEvidenceRefs(refs: ValidationEvidenceRef[]): ValidationEvidenceRef[] {
  const seen = new Set<string>();
  const normalized: ValidationEvidenceRef[] = [];

  for (const ref of refs) {
    const next = {
      kind: ref.kind,
      ref: requireText(ref.ref, "Validation evidence ref is required."),
      trust: ref.trust,
      summary: normalizeOptionalText(ref.summary)
    };
    const key = `${next.kind}:${next.ref}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(next);
  }

  return normalized;
}

function formatEvidenceRefs(refs: ValidationEvidenceRef[]): string {
  return refs.map((ref) => `${ref.kind}:${ref.ref}`).join("; ");
}

function requireText(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
