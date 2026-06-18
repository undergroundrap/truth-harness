import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { listInventionLogEntries, type InventionEvidenceRef, type InventionLogEntry } from "./invention-log.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export type ClaimChartElementStatus = "unsupported" | "evidence-referenced" | "needs-human-review";

export interface ClaimChartElementInput {
  text: string;
  supportRefs?: InventionEvidenceRef[];
  priorArtRefs?: string[];
  notes?: string[];
}

export interface ClaimChartElement {
  elementId: string;
  text: string;
  supportRefs: InventionEvidenceRef[];
  priorArtRefs: string[];
  notes: string[];
  status: ClaimChartElementStatus;
  warnings: string[];
}

export interface ClaimChart {
  schemaVersion: "truth-harness.claim-chart.v0";
  chartId: string;
  projectId: string;
  entryId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  invention: {
    title: string;
    hypothesis: string;
    validationStage: InventionLogEntry["validationStage"];
  };
  elements: ClaimChartElement[];
  noveltyQuestions: string[];
  priorArtNotes: string[];
  reductionToPracticeRefs: string[];
  legal: {
    humanReviewRequired: true;
    legalConclusion: "not-a-legal-opinion";
    patentabilityConclusion: "not-determined";
    provisionalDraftReady: false;
    warnings: string[];
  };
  validation: {
    stage: InventionLogEntry["validationStage"];
    reductionToPracticeClaimed: boolean;
    requiredBeforeDrafting: string[];
  };
  privacy: PrivacyMetadata;
  markdown: string;
}

export interface CreateClaimChartInput {
  rootPath: string;
  entryId?: string;
  title?: string;
  elements: ClaimChartElementInput[];
  evidenceRefs?: InventionEvidenceRef[];
  noveltyQuestions?: string[];
  priorArtNotes?: string[];
  reductionToPracticeRefs?: string[];
  now?: string;
}

export interface ClaimChartWriteResult {
  chart: ClaimChart;
  jsonPath: string;
  markdownPath: string;
}

export async function createClaimChart(input: CreateClaimChartInput): Promise<ClaimChart> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const entry = await findInventionEntry(input.rootPath, input.entryId);
  const sharedEvidence = input.evidenceRefs ?? entry.evidenceRefs;
  const elements = normalizeClaimElements(input.elements, sharedEvidence);
  const title = normalizeOptionalText(input.title) ?? `Claim chart: ${entry.title}`;
  const noveltyQuestions = normalizeStringList(input.noveltyQuestions ?? defaultNoveltyQuestions());
  const priorArtNotes = normalizeStringList([...(entry.priorArtNotes ?? []), ...(input.priorArtNotes ?? [])]);
  const reductionToPracticeRefs = normalizeStringList(input.reductionToPracticeRefs ?? []);
  const validation = {
    stage: entry.validationStage,
    reductionToPracticeClaimed: reductionToPracticeRefs.length > 0,
    requiredBeforeDrafting: requiredBeforeDrafting(entry, reductionToPracticeRefs)
  };
  const legal = {
    humanReviewRequired: true as const,
    legalConclusion: "not-a-legal-opinion" as const,
    patentabilityConclusion: "not-determined" as const,
    provisionalDraftReady: false as const,
    warnings: legalWarnings(validation)
  };
  const chartId = `chart_${stableHash({
    entryId: entry.entryId,
    createdAt,
    title,
    elements,
    noveltyQuestions,
    priorArtNotes,
    reductionToPracticeRefs,
    validation
  }).slice(0, 16)}`;
  const baseChart = {
    schemaVersion: "truth-harness.claim-chart.v0" as const,
    chartId,
    projectId: status.manifest.projectId,
    entryId: entry.entryId,
    createdAt,
    updatedAt: createdAt,
    title,
    invention: {
      title: entry.title,
      hypothesis: entry.hypothesis,
      validationStage: entry.validationStage
    },
    elements,
    noveltyQuestions,
    priorArtNotes,
    reductionToPracticeRefs,
    legal,
    validation,
    privacy: status.manifest.privacy
  };
  const markdown = renderClaimChartMarkdown(baseChart);

  return {
    ...baseChart,
    markdown
  };
}

export async function writeClaimChart(input: CreateClaimChartInput): Promise<ClaimChartWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const chart = await createClaimChart(input);
  const patentsDir = resolve(status.root, status.manifest.directories.patents);
  await mkdir(patentsDir, { recursive: true });
  const baseName = `${chart.createdAt.slice(0, 10)}-${chart.entryId}-${chart.chartId}`;
  const jsonPath = join(patentsDir, `${baseName}.json`);
  const markdownPath = join(patentsDir, `${baseName}.md`);
  await assertJsonSchemaBeforeWrite({
    value: chart,
    schemaFile: "claim-chart.schema.json",
    artifactName: "Claim chart"
  });
  await writeJsonFileAtomic(jsonPath, chart);
  await writeFileAtomic(markdownPath, chart.markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "patents",
    now: chart.createdAt,
    staleReason: "claim chart written"
  });

  return {
    chart,
    jsonPath,
    markdownPath
  };
}

export async function listClaimCharts(rootPath: string): Promise<ClaimChart[]> {
  const status = await requireLocalWorkspace(rootPath);
  const patentsDir = resolve(status.root, status.manifest.directories.patents);

  let files: string[];
  try {
    files = await readdir(patentsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const charts = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(patentsDir, file), "utf8")) as ClaimChart)
  );

  return charts
    .filter((chart) => chart.schemaVersion === "truth-harness.claim-chart.v0")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function renderClaimChartMarkdown(chart: Omit<ClaimChart, "markdown">): string {
  const lines: string[] = [
    `# ${escapeMarkdownText(chart.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Chart | \`${chart.chartId}\` |`,
    `| Invention | \`${chart.entryId}\` |`,
    `| Created | ${escapeMarkdownTable(chart.createdAt)} |`,
    `| Validation stage | \`${chart.validation.stage}\` |`,
    `| Legal conclusion | \`${chart.legal.legalConclusion}\` |`,
    `| Patentability | \`${chart.legal.patentabilityConclusion}\` |`,
    "",
    "## Invention Hypothesis",
    "",
    escapeMarkdownText(chart.invention.hypothesis),
    "",
    "## Claim Elements",
    "",
    "| Status | Element | Support refs | Prior-art refs | Notes |",
    "| --- | --- | --- | --- | --- |"
  ];

  for (const element of chart.elements) {
    lines.push(
      [
        `\`${element.status}\``,
        escapeMarkdownTable(element.text),
        escapeMarkdownTable(formatEvidenceRefs(element.supportRefs)),
        escapeMarkdownTable(element.priorArtRefs.join("; ")),
        escapeMarkdownTable(element.notes.join("; "))
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |")
    );
  }

  lines.push("", "## Novelty Questions", "");
  for (const question of chart.noveltyQuestions) {
    lines.push(`- ${escapeMarkdownText(question)}`);
  }

  lines.push("", "## Prior-Art Notes", "");
  if (chart.priorArtNotes.length === 0) {
    lines.push("- No prior-art notes recorded yet.");
  } else {
    for (const note of chart.priorArtNotes) {
      lines.push(`- ${escapeMarkdownText(note)}`);
    }
  }

  lines.push("", "## Reduction To Practice", "");
  if (chart.reductionToPracticeRefs.length === 0) {
    lines.push("- No reduction-to-practice refs recorded.");
  } else {
    for (const ref of chart.reductionToPracticeRefs) {
      lines.push(`- ${escapeMarkdownText(ref)}`);
    }
  }

  lines.push("", "## Required Before Drafting", "");
  for (const item of chart.validation.requiredBeforeDrafting) {
    lines.push(`- ${escapeMarkdownText(item)}`);
  }

  const elementWarnings = chart.elements.flatMap((element) => element.warnings);
  lines.push("", "## Warnings", "");
  for (const warning of [...chart.legal.warnings, ...elementWarnings]) {
    lines.push(`- ${escapeMarkdownText(warning)}`);
  }

  return `${lines.join("\n")}\n`;
}

async function findInventionEntry(rootPath: string, entryId: string | undefined): Promise<InventionLogEntry> {
  const entries = await listInventionLogEntries(rootPath);
  if (entries.length === 0) {
    throw new Error("No invention logs found. Run `truth-harness invention log` before creating claim charts.");
  }

  if (!entryId) {
    return entries[0];
  }

  const entry = entries.find((candidate) => candidate.entryId === entryId);
  if (!entry) {
    throw new Error(`No invention log found for entry id ${JSON.stringify(entryId)}.`);
  }

  return entry;
}

function normalizeClaimElements(
  elements: ClaimChartElementInput[],
  sharedEvidence: InventionEvidenceRef[]
): ClaimChartElement[] {
  if (elements.length === 0) {
    throw new Error("At least one claim element is required for a claim chart.");
  }

  return elements.map((element, index) => {
    const text = requireText(element.text, "Claim element text is required.");
    const supportRefs = element.supportRefs ?? sharedEvidence;
    const priorArtRefs = normalizeStringList(element.priorArtRefs ?? []);
    const notes = normalizeStringList(element.notes ?? []);
    const status = statusForElement(supportRefs);

    return {
      elementId: `elt_${stableHash({ index, text, supportRefs, priorArtRefs, notes }).slice(0, 16)}`,
      text,
      supportRefs,
      priorArtRefs,
      notes,
      status,
      warnings: warningsForElement({ text, supportRefs, priorArtRefs, status })
    };
  });
}

function statusForElement(supportRefs: InventionEvidenceRef[]): ClaimChartElementStatus {
  if (supportRefs.length === 0) {
    return "unsupported";
  }

  if (
    supportRefs.some(
      (ref) =>
        ref.kind === "simulation" ||
        ref.kind === "experiment" ||
        ref.kind === "disclosure" ||
        ref.kind === "vault" ||
        ref.kind === "review" ||
        ref.kind === "validation" ||
        ref.trust === "unverified"
    )
  ) {
    return "needs-human-review";
  }

  return "evidence-referenced";
}

function warningsForElement(input: {
  text: string;
  supportRefs: InventionEvidenceRef[];
  priorArtRefs: string[];
  status: ClaimChartElementStatus;
}): string[] {
  const warnings: string[] = [];

  if (input.supportRefs.length === 0) {
    warnings.push(`Claim element has no support refs: ${input.text}`);
  }

  if (input.priorArtRefs.length === 0) {
    warnings.push(`Claim element has no prior-art refs yet: ${input.text}`);
  }

  if (input.status === "needs-human-review") {
    warnings.push(`Claim element relies on scoped, private, or computational provenance and needs human legal review: ${input.text}`);
  }

  return warnings;
}

function requiredBeforeDrafting(entry: InventionLogEntry, reductionToPracticeRefs: string[]): string[] {
  const required = [
    "human patent attorney review",
    "prior-art search with source refs",
    "claim support review against evidence refs",
    "novelty and non-obviousness analysis by a qualified human"
  ];

  if (reductionToPracticeRefs.length === 0) {
    required.push("reduction-to-practice evidence or clear constructive example refs");
  }

  if (
    entry.validationStage === "idea" ||
    entry.validationStage === "computational-hypothesis" ||
    entry.validationStage === "simulated"
  ) {
    required.push("stronger validation before treating this as ready for filing");
  }

  return required;
}

function legalWarnings(validation: ClaimChart["validation"]): string[] {
  const warnings = [
    "This claim chart is a local drafting aid, not legal advice.",
    "Truth Harness does not determine patentability, novelty, non-obviousness, inventorship, freedom to operate, enablement, or written description sufficiency.",
    "Do not file or publicly disclose based only on this artifact; get human legal review."
  ];

  if (!validation.reductionToPracticeClaimed) {
    warnings.push("No reduction-to-practice refs were recorded; provisional draft readiness is false.");
  }

  if (validation.stage !== "experimentally-observed" && validation.stage !== "bench-tested") {
    warnings.push(`Current invention validation stage is ${validation.stage}; stronger evidence may be needed before patent drafting.`);
  }

  return warnings;
}

function defaultNoveltyQuestions(): string[] {
  return [
    "What exact claim elements are new over the closest prior art?",
    "Which evidence refs support each element?",
    "What assumptions or limitations could narrow the claim?",
    "What public disclosures, publications, or product releases could affect rights?"
  ];
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before creating claim charts.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function formatEvidenceRefs(refs: InventionEvidenceRef[]): string {
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

function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value)))];
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
