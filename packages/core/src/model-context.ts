import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";

export const MODEL_CONTEXT_TARGETS = ["hosted-model", "local-model", "external-service"] as const;
export const MODEL_CONTEXT_APPROVAL_STATUSES = ["not-approved", "approved"] as const;
export const MODEL_CONTEXT_DISCLOSURE_STATUSES = ["not-required", "required-not-created", "planned", "sent", "cancelled"] as const;

export type ModelContextTarget = (typeof MODEL_CONTEXT_TARGETS)[number];
export type ModelContextApprovalStatus = (typeof MODEL_CONTEXT_APPROVAL_STATUSES)[number];
export type ModelContextDisclosureStatus = (typeof MODEL_CONTEXT_DISCLOSURE_STATUSES)[number];

export interface ModelContextSection {
  title: string;
  content: string;
  sourceRefs: string[];
}

export interface ModelContextPacket {
  schemaVersion: "truth-harness.model-context.v0";
  packetId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  purpose: string;
  target: {
    kind: ModelContextTarget;
    service: string;
    model?: string;
    endpoint?: string;
  };
  dataClasses: string[];
  selectedContextRefs: string[];
  sections: ModelContextSection[];
  redactions: string[];
  exclusions: string[];
  approval: {
    status: ModelContextApprovalStatus;
    approvalRef?: string;
    approvedBy?: string;
    approvedAt?: string;
  };
  disclosure: {
    required: boolean;
    status: ModelContextDisclosureStatus;
    disclosureRef?: string;
  };
  boundary: {
    localPacketOnly: true;
    externalCallNotPerformed: true;
    selectedContextOnly: true;
    secretsMustNotBeIncluded: true;
    requiresDisclosureBeforeSending: boolean;
  };
  privacy: PrivacyMetadata;
  warnings: string[];
  markdown: string;
}

export interface CreateModelContextInput {
  rootPath: string;
  purpose: string;
  service: string;
  title?: string;
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
  now?: string;
}

export interface ModelContextWriteResult {
  packet: ModelContextPacket;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export function isModelContextTarget(value: string): value is ModelContextTarget {
  return (MODEL_CONTEXT_TARGETS as readonly string[]).includes(value);
}

export function isModelContextDisclosureStatus(value: string): value is ModelContextDisclosureStatus {
  return (MODEL_CONTEXT_DISCLOSURE_STATUSES as readonly string[]).includes(value);
}

export async function createModelContext(input: CreateModelContextInput): Promise<ModelContextPacket> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const purpose = requireText(input.purpose, "Model context purpose is required.");
  const service = requireText(input.service, "Model context service is required.");
  const targetKind = input.target ?? "hosted-model";
  const dataClasses = normalizeStringList(input.dataClasses ?? []);
  const selectedContextRefs = normalizeStringList(input.selectedContextRefs ?? []);
  const sections = normalizeSections(input.sections ?? []);
  const redactions = normalizeStringList(input.redactions ?? []);
  const exclusions = normalizeStringList(input.exclusions ?? defaultExclusions());
  const approvalRef = normalizeOptionalText(input.approvalRef);
  const disclosureRequired = targetKind !== "local-model";
  const disclosureStatus = input.disclosureStatus ?? (disclosureRequired ? "required-not-created" : "not-required");
  const approval = {
    status: approvalRef ? "approved" as const : "not-approved" as const,
    approvalRef,
    approvedBy: normalizeOptionalText(input.approvedBy),
    approvedAt: normalizeOptionalText(input.approvedAt)
  };
  const disclosure = {
    required: disclosureRequired,
    status: disclosureStatus,
    disclosureRef: normalizeOptionalText(input.disclosureRef)
  };
  const packetWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    updatedAt: createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromPurpose(purpose),
    purpose,
    target: {
      kind: targetKind,
      service,
      model: normalizeOptionalText(input.model),
      endpoint: normalizeOptionalText(input.endpoint)
    },
    dataClasses,
    selectedContextRefs,
    sections,
    redactions,
    exclusions,
    approval,
    disclosure,
    boundary: {
      localPacketOnly: true as const,
      externalCallNotPerformed: true as const,
      selectedContextOnly: true as const,
      secretsMustNotBeIncluded: true as const,
      requiresDisclosureBeforeSending: disclosureRequired
    },
    privacy: manifest.privacy,
    warnings: warningsFor({
      target: targetKind,
      dataClasses,
      selectedContextRefs,
      sections,
      approval,
      disclosure,
      redactions,
      exclusions
    })
  };
  const packetId = `ctx_${stableHash(packetWithoutId).slice(0, 16)}`;
  const packetWithoutMarkdown = {
    schemaVersion: "truth-harness.model-context.v0" as const,
    packetId,
    ...packetWithoutId
  };

  return {
    ...packetWithoutMarkdown,
    markdown: renderModelContextMarkdown(packetWithoutMarkdown)
  };
}

export async function writeModelContext(input: CreateModelContextInput): Promise<ModelContextWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const packet = await createModelContext(input);
  const contextsDir = resolve(status.root, status.manifest.directories["model-contexts"]);
  await mkdir(contextsDir, { recursive: true });
  const baseName = `${packet.createdAt.slice(0, 10)}-${packet.packetId}`;
  const jsonPath = join(contextsDir, `${baseName}.json`);
  const markdownPath = join(contextsDir, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, packet.markdown, "utf8");

  return {
    packet,
    jsonPath,
    markdownPath,
    markdown: packet.markdown
  };
}

export async function listModelContexts(rootPath: string): Promise<ModelContextPacket[]> {
  const status = await requireLocalWorkspace(rootPath);
  const contextsDir = resolve(status.root, status.manifest.directories["model-contexts"]);

  let files: string[];
  try {
    files = await readdir(contextsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const packets = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(contextsDir, file), "utf8")) as ModelContextPacket)
  );

  return packets
    .filter((packet) => packet.schemaVersion === "truth-harness.model-context.v0")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function renderModelContextMarkdown(packet: Omit<ModelContextPacket, "markdown">): string {
  const lines: string[] = [
    `# Model Context Packet: ${escapeMarkdownText(packet.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Packet | \`${packet.packetId}\` |`,
    `| Created | ${escapeMarkdownTable(packet.createdAt)} |`,
    `| Target | \`${packet.target.kind}\` / ${escapeMarkdownTable(packet.target.service)}${packet.target.model ? ` / ${escapeMarkdownTable(packet.target.model)}` : ""} |`,
    `| Approval | \`${packet.approval.status}\` |`,
    `| Disclosure | \`${packet.disclosure.status}\` |`,
    `| Privacy | \`${packet.privacy.mode}\` / network \`${packet.privacy.networkAccess}\` |`,
    "",
    "## Purpose",
    "",
    escapeMarkdownText(packet.purpose),
    "",
    "## Data Classes",
    ""
  ];

  if (packet.dataClasses.length === 0) {
    lines.push("- No data classes recorded.");
  } else {
    for (const dataClass of packet.dataClasses) {
      lines.push(`- ${escapeMarkdownText(dataClass)}`);
    }
  }

  lines.push("", "## Selected Context Refs", "");
  if (packet.selectedContextRefs.length === 0) {
    lines.push("- No selected local context refs recorded.");
  } else {
    for (const ref of packet.selectedContextRefs) {
      lines.push(`- ${escapeMarkdownText(ref)}`);
    }
  }

  lines.push("", "## Prompt Sections", "");
  if (packet.sections.length === 0) {
    lines.push("- No prompt sections recorded.");
  } else {
    for (const section of packet.sections) {
      lines.push(`### ${escapeMarkdownText(section.title)}`, "", escapeMarkdownText(section.content), "");
      if (section.sourceRefs.length > 0) {
        lines.push("Source refs:");
        for (const ref of section.sourceRefs) {
          lines.push(`- ${escapeMarkdownText(ref)}`);
        }
        lines.push("");
      }
    }
  }

  appendList(lines, "Redactions", packet.redactions);
  appendList(lines, "Exclusions", packet.exclusions);
  appendList(lines, "Warnings", packet.warnings);

  lines.push("", "## Boundary", "");
  lines.push("- This packet is local-only preparation metadata and selected prompt context.");
  lines.push("- It did not call a hosted model, external service, or network endpoint.");
  lines.push("- Create or link a disclosure log before sending selected context outside the workspace.");

  return `${lines.join("\n")}\n`;
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing model context packets.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function warningsFor(input: {
  target: ModelContextTarget;
  dataClasses: string[];
  selectedContextRefs: string[];
  sections: ModelContextSection[];
  approval: ModelContextPacket["approval"];
  disclosure: ModelContextPacket["disclosure"];
  redactions: string[];
  exclusions: string[];
}): string[] {
  const warnings = [
    "Model context packets are local preparation artifacts; they do not call the target model or service.",
    "Send only selected context needed for the stated purpose; keep source documents, secrets, and project history local by default."
  ];

  if (input.target !== "local-model" && input.approval.status !== "approved") {
    warnings.push("This packet is not approved for external sending; get explicit human approval before using a hosted model or external service.");
  }

  if (input.target !== "local-model" && input.disclosure.status === "required-not-created") {
    warnings.push("A disclosure log is required before selected context is sent outside the local workspace.");
  }

  if (input.dataClasses.length === 0) {
    warnings.push("No data classes were recorded; classify the selected context before sending or reviewing.");
  }

  if (input.selectedContextRefs.length === 0 && input.sections.length === 0) {
    warnings.push("No selected context refs or prompt sections were recorded.");
  }

  if (input.dataClasses.some(isSensitiveText) || input.sections.some((section) => isSensitiveText(section.content))) {
    warnings.push("Selected context appears to mention secrets, credentials, health, personal, or patient data; review minimization and consent before sending.");
  }

  if (input.redactions.length === 0) {
    warnings.push("No redactions were recorded; explicitly state whether secrets, identifiers, or private notes were removed.");
  }

  if (input.exclusions.length === 0) {
    warnings.push("No exclusions were recorded; note what local data was deliberately kept out of the packet.");
  }

  return [...new Set(warnings)];
}

function isSensitiveText(value: string): boolean {
  return /secret|credential|password|token|api[-_ ]?key|personal|patient|health|medical|phi|pii/i.test(value);
}

function normalizeSections(sections: ModelContextSection[]): ModelContextSection[] {
  return sections.map((section) => ({
    title: requireText(section.title, "Model context section title is required."),
    content: requireText(section.content, "Model context section content is required."),
    sourceRefs: normalizeStringList(section.sourceRefs ?? [])
  }));
}

function defaultExclusions(): string[] {
  return [
    "Full local workspace history is excluded.",
    "Vault plaintext and secrets are excluded unless explicitly added by the user.",
    "Only the selected context refs and sections in this packet are intended for review."
  ];
}

function titleFromPurpose(purpose: string): string {
  const trimmed = purpose.length > 72 ? `${purpose.slice(0, 69)}...` : purpose;
  return `Model context: ${trimmed}`;
}

function appendList(lines: string[], title: string, values: string[]): void {
  lines.push("", `## ${title}`, "");
  if (values.length === 0) {
    lines.push(`- No ${title.toLowerCase()} recorded.`);
    return;
  }

  for (const value of values) {
    lines.push(`- ${escapeMarkdownText(value)}`);
  }
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
