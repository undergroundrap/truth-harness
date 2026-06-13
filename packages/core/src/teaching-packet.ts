import type { GraphNode, Receipt } from "./types.js";
import { assertReceipt } from "./receipt-validation.js";

export type TeachingAudience = "middle" | "high" | "college" | "expert";

export interface TeachingPacketRubricRow {
  criterion: string;
  evidenceOfUnderstanding: string;
}

export interface TeachingPacket {
  schemaVersion: "truth-harness.teaching-packet.v0";
  receiptRunId: string;
  receiptCreatedAt: string;
  title: string;
  audience: TeachingAudience;
  claim: string;
  trust: Receipt["trust"];
  evidenceKind: Receipt["evidenceProfile"]["kind"];
  proofCheckerBacked: boolean;
  replay: string;
  backendIds: string[];
  learningGoals: string[];
  prerequisites: string[];
  stepPrompts: string[];
  misconceptionChecks: string[];
  classroomActivity: string[];
  assessmentRubric: TeachingPacketRubricRow[];
  limitations: string[];
  boundary: string[];
}

export interface CreateTeachingPacketOptions {
  audience?: TeachingAudience;
}

export function isTeachingAudience(value: string): value is TeachingAudience {
  return value === "middle" || value === "high" || value === "college" || value === "expert";
}

export function createTeachingPacket(receipt: Receipt, options: CreateTeachingPacketOptions = {}): TeachingPacket {
  assertReceipt(receipt);
  const audience = options.audience ?? "college";
  const backendIds = receipt.evidenceProfile.backends.map((backend) => backend.id);
  const fractionLike = isFractionLike(receipt);
  const graphSteps = receipt.graph.nodes.slice(0, 8).map((node, index) => graphNodePrompt(node, index));

  return {
    schemaVersion: "truth-harness.teaching-packet.v0",
    receiptRunId: receipt.runId,
    receiptCreatedAt: receipt.createdAt,
    title: `Teaching Packet: ${receipt.problem}`,
    audience,
    claim: receipt.summary,
    trust: receipt.trust,
    evidenceKind: receipt.evidenceProfile.kind,
    proofCheckerBacked: receipt.evidenceProfile.proofCheckerBacked,
    replay: receipt.replay,
    backendIds: backendIds.length > 0 ? backendIds : ["unrecorded-backend"],
    learningGoals: learningGoals(receipt, audience, fractionLike),
    prerequisites: prerequisites(audience, fractionLike),
    stepPrompts:
      graphSteps.length > 0
        ? graphSteps
        : ["Restate the claim, identify the verifier, then list what evidence would be needed before making a stronger claim."],
    misconceptionChecks: misconceptionChecks(receipt, fractionLike),
    classroomActivity: classroomActivity(receipt, audience),
    assessmentRubric: assessmentRubric(audience),
    limitations: receipt.evidenceProfile.limitations,
    boundary: [
      "This packet teaches from a local evidence receipt. It is not a substitute for instructor judgment.",
      "AI explanations, visualizations, and report text do not upgrade trust labels.",
      "Students should cite the receipt run id, replay command, trust label, and limitations when using the result."
    ]
  };
}

export function renderTeachingPacketMarkdown(packet: TeachingPacket): string {
  const lines = [
    `# ${escapeMarkdownText(packet.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Receipt | \`${escapeMarkdownTable(packet.receiptRunId)}\` |`,
    `| Audience | \`${escapeMarkdownTable(packet.audience)}\` |`,
    `| Trust | \`${escapeMarkdownTable(packet.trust)}\` |`,
    `| Evidence kind | \`${escapeMarkdownTable(packet.evidenceKind)}\` |`,
    `| Proof checker backed | \`${String(packet.proofCheckerBacked)}\` |`,
    `| Backends | ${escapeMarkdownTable(packet.backendIds.join(", "))} |`,
    `| Replay | \`${escapeMarkdownTable(packet.replay)}\` |`,
    "",
    "## Claim",
    "",
    escapeMarkdownText(packet.claim),
    "",
    "## Learning Goals",
    "",
    ...packet.learningGoals.map((item) => `- ${escapeMarkdownText(item)}`),
    "",
    "## Prerequisites",
    "",
    ...packet.prerequisites.map((item) => `- ${escapeMarkdownText(item)}`),
    "",
    "## Step Prompts",
    "",
    ...packet.stepPrompts.map((item, index) => `${index + 1}. ${escapeMarkdownText(item)}`),
    "",
    "## Misconception Checks",
    "",
    ...packet.misconceptionChecks.map((item) => `- ${escapeMarkdownText(item)}`),
    "",
    "## Classroom Activity",
    "",
    ...packet.classroomActivity.map((item, index) => `${index + 1}. ${escapeMarkdownText(item)}`),
    "",
    "## Assessment Rubric",
    "",
    "| Criterion | Evidence of understanding |",
    "| --- | --- |",
    ...packet.assessmentRubric.map((row) =>
      `| ${escapeMarkdownTable(row.criterion)} | ${escapeMarkdownTable(row.evidenceOfUnderstanding)} |`
    ),
    "",
    "## Limitations",
    "",
    ...packet.limitations.map((item) => `- ${escapeMarkdownText(item)}`),
    "",
    "## Teaching Boundary",
    "",
    ...packet.boundary.map((item) => `- ${escapeMarkdownText(item)}`)
  ];

  return `${lines.join("\n")}\n`;
}

function learningGoals(receipt: Receipt, audience: TeachingAudience, fractionLike: boolean): string[] {
  const goals = [
    `Explain why the receipt currently supports the claim with trust label '${receipt.trust}'.`,
    `Identify the verifier backend(s): ${receipt.evidenceProfile.backends.map((backend) => backend.id).join(", ") || "none recorded"}.`,
    `Use the replay command to connect the classroom explanation back to the local evidence artifact.`,
    "State what the receipt does not prove before making a broader mathematical, scientific, or real-world claim."
  ];

  if (fractionLike) {
    goals.push("Reason about the expression with exact fractions before using decimals or mental shortcuts.");
  }

  if (audience === "expert") {
    goals.push("Audit backend assumptions, proof-checker status, and reproducibility boundaries as part of the lesson.");
  } else if (audience === "middle") {
    goals.push("Translate each evidence step into plain language a peer could repeat.");
  }

  return goals;
}

function prerequisites(audience: TeachingAudience, fractionLike: boolean): string[] {
  const base =
    audience === "expert"
      ? ["Comfort reading machine-generated evidence records.", "Familiarity with proof, computation, and replay boundaries."]
      : ["Reading a precise claim.", "Following a short step-by-step verification record."];

  if (fractionLike) {
    return [...base, "Fraction notation, equivalent fractions, and numerator/denominator roles."];
  }

  return [...base, "Difference between a calculation, a proof, a simulation, and a source citation."];
}

function misconceptionChecks(receipt: Receipt, fractionLike: boolean): string[] {
  const checks = [
    "A trustworthy-looking explanation is not evidence unless it points back to the receipt and replay command.",
    "A computation, CAS simplification, simulation, or source citation is not a formal proof unless the accepted checker backs that trust label.",
    receipt.evidenceProfile.proofCheckerBacked
      ? "Even proof-checker-backed work should cite the accepted backend and exact artifact."
      : "This receipt is not proof-checker-backed, so students should not present it as a formal theorem."
  ];

  if (fractionLike) {
    checks.push("For fraction work, ask students to justify denominator alignment instead of adding denominators directly.");
  }

  return checks;
}

function classroomActivity(receipt: Receipt, audience: TeachingAudience): string[] {
  const activity = [
    "Students first solve or restate the claim without seeing the receipt.",
    "Reveal the receipt metadata and ask students to name the trust label, backend, replay command, and limitations.",
    "Walk the evidence graph and classify each node as problem, computation, proof, source, explanation, or artifact.",
    "Have students write one follow-up subclaim that would make the result more reusable in a larger problem."
  ];

  if (audience === "expert") {
    activity.push("Ask students to propose the next independent checker or proof obligation that would strengthen the trust boundary.");
  } else {
    activity.push(`Ask students to rewrite the result in ${audienceLabel(audience)} language without changing the supported claim.`);
  }

  return activity;
}

function assessmentRubric(audience: TeachingAudience): TeachingPacketRubricRow[] {
  return [
    {
      criterion: "Receipt fidelity",
      evidenceOfUnderstanding: "Student explanation follows the recorded claim, trust label, replay command, and limitations."
    },
    {
      criterion: "Evidence reasoning",
      evidenceOfUnderstanding: "Student can separate computed, proved, refuted, sourced, simulated, and unsupported claims."
    },
    {
      criterion: "Reusable work",
      evidenceOfUnderstanding: "Student identifies a subclaim or next check that could be saved for a larger project."
    },
    {
      criterion: audience === "expert" ? "Backend audit" : "Plain-language transfer",
      evidenceOfUnderstanding:
        audience === "expert"
          ? "Student can audit backend status, proof-checker acceptance, and reproducibility boundaries."
          : "Student can explain the same receipt accurately to another learner."
    }
  ];
}

function graphNodePrompt(node: GraphNode, index: number): string {
  return `Evidence node ${index + 1} (${node.kind}, trust ${node.trust}): ${node.summary}. Ask students what this node contributes and what it still cannot prove.`;
}

function isFractionLike(receipt: Receipt): boolean {
  const text = [
    receipt.problem,
    receipt.normalizedProblem,
    receipt.summary,
    ...receipt.evidenceProfile.inputs,
    ...receipt.evidenceProfile.outputs
  ]
    .join(" ")
    .toLowerCase();
  return text.includes("fraction") || /\d+\s*\/\s*\d+/u.test(text);
}

function audienceLabel(audience: TeachingAudience): string {
  switch (audience) {
    case "middle":
      return "middle-school";
    case "high":
      return "high-school";
    case "college":
      return "college";
    case "expert":
      return "expert";
  }
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}
