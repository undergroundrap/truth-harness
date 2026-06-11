import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";

export const EXTERNAL_DISCLOSURE_STATUSES = ["planned", "sent", "received", "cancelled"] as const;

export type ExternalDisclosureStatus = (typeof EXTERNAL_DISCLOSURE_STATUSES)[number];

export interface ExternalDisclosureLogEntry {
  schemaVersion: "theorem.disclosure.v0";
  disclosureId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  service: string;
  model?: string;
  endpoint?: string;
  purpose: string;
  dataClasses: string[];
  contextSummary: string;
  selectedContextRefs: string[];
  userInitiated: boolean;
  approvalRef?: string;
  status: ExternalDisclosureStatus;
  responseSummary?: string;
  outputRefs: string[];
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface CreateExternalDisclosureInput {
  rootPath: string;
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
  now?: string;
}

export interface ExternalDisclosureWriteResult {
  entry: ExternalDisclosureLogEntry;
  path: string;
}

export function isExternalDisclosureStatus(value: string): value is ExternalDisclosureStatus {
  return (EXTERNAL_DISCLOSURE_STATUSES as readonly string[]).includes(value);
}

export async function createExternalDisclosureLogEntry(
  input: CreateExternalDisclosureInput
): Promise<ExternalDisclosureWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const service = requireText(input.service, "External service is required.");
  const purpose = requireText(input.purpose, "External disclosure purpose is required.");
  const contextSummary = requireText(input.contextSummary, "External disclosure context summary is required.");
  const dataClasses = normalizeStringList(input.dataClasses);
  if (dataClasses.length === 0) {
    throw new Error("At least one data class is required for an external disclosure.");
  }

  const userInitiated = input.userInitiated ?? true;
  const disclosureStatus = input.status ?? "planned";
  const entryWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    service,
    model: normalizeOptionalText(input.model),
    endpoint: normalizeOptionalText(input.endpoint),
    purpose,
    dataClasses,
    contextSummary,
    selectedContextRefs: normalizeStringList(input.selectedContextRefs ?? []),
    userInitiated,
    approvalRef: normalizeOptionalText(input.approvalRef),
    status: disclosureStatus,
    responseSummary: normalizeOptionalText(input.responseSummary),
    outputRefs: normalizeStringList(input.outputRefs ?? [])
  };
  const disclosureId = `dis_${stableHash(entryWithoutId).slice(0, 16)}`;
  const entry: ExternalDisclosureLogEntry = {
    schemaVersion: "theorem.disclosure.v0",
    disclosureId,
    ...entryWithoutId,
    updatedAt: createdAt,
    privacy: {
      mode: "external-calls",
      localFirst: true,
      networkAccess: "optional",
      dataResidency: "local-workspace",
      externalDisclosures: [
        {
          service,
          purpose,
          dataClasses,
          userInitiated
        }
      ]
    },
    warnings: warningsFor({
      dataClasses,
      userInitiated,
      approvalRef: entryWithoutId.approvalRef,
      status: disclosureStatus
    })
  };

  const disclosuresDir = resolve(status.root, manifest.directories.disclosures);
  await mkdir(disclosuresDir, { recursive: true });
  const path = join(disclosuresDir, `${entry.createdAt.slice(0, 10)}-${entry.disclosureId}.json`);
  await writeFile(path, `${JSON.stringify(entry, null, 2)}\n`, "utf8");

  return { entry, path };
}

export async function listExternalDisclosureLogEntries(rootPath: string): Promise<ExternalDisclosureLogEntry[]> {
  const status = await requireLocalWorkspace(rootPath);
  const disclosuresDir = resolve(status.root, status.manifest.directories.disclosures);

  let files: string[];
  try {
    files = await readdir(disclosuresDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const entries = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(disclosuresDir, file), "utf8")) as ExternalDisclosureLogEntry)
  );

  return entries
    .filter((entry) => entry.schemaVersion === "theorem.disclosure.v0")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Theorem workspace found. Run `theorem workspace init` before writing disclosure logs.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function warningsFor(input: {
  dataClasses: string[];
  userInitiated: boolean;
  approvalRef?: string;
  status: ExternalDisclosureStatus;
}): string[] {
  const warnings: string[] = [
    "External disclosure records are audit metadata, not consent automation or legal compliance by themselves.",
    "Send only the selected context needed for the stated purpose; keep source documents and project history local by default."
  ];

  if (!input.userInitiated) {
    warnings.push("This disclosure is not marked user-initiated; do not send context until a human explicitly approves it.");
  }

  if ((input.status === "sent" || input.status === "received") && !input.approvalRef) {
    warnings.push("Sent/received disclosures should include an approvalRef pointing to the human instruction, issue, or prompt.");
  }

  if (input.dataClasses.some(isSensitiveDataClass)) {
    warnings.push("Data classes mention secrets, credentials, health, or personal data; review minimization and consent before sending.");
  }

  return warnings;
}

function isSensitiveDataClass(value: string): boolean {
  return /secret|credential|password|token|api[-_ ]?key|personal|patient|health|medical|phi|pii/i.test(value);
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
