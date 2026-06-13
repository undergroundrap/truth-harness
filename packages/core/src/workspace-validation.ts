import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { validateJsonSchema } from "./json-schema-validation.js";
import {
  getLocalWorkspaceStatus,
  type LocalWorkspaceDirectory,
  type LocalWorkspaceStatus
} from "./local-workspace.js";
import { parseReceiptJson, ReceiptValidationError } from "./receipt-validation.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";

export type WorkspaceValidationArtifactKind = LocalWorkspaceDirectory | "manifest";
export type WorkspaceValidationIssueSeverity = "warning" | "error";

export interface WorkspaceValidationIssue {
  severity: WorkspaceValidationIssueSeverity;
  code:
    | "missing-workspace-directory"
    | "invalid-json"
    | "invalid-receipt-schema"
    | "invalid-artifact-schema"
    | "missing-schema-version"
    | "unexpected-schema-version"
    | "missing-artifact-id"
    | "unresolved-evidence-ref"
    | "external-model-context-sent-without-approval"
    | "external-model-context-sent-without-disclosure"
    | "unresolved-disclosure-ref"
    | "sent-disclosure-without-approval"
    | "sent-disclosure-not-user-initiated"
    | "sent-disclosure-without-selected-context"
    | "proved-without-proof-checker"
    | "trusted-receipt-without-backend"
    | "non-local-first-receipt"
    | "external-call-without-disclosure"
    | "non-replayable-receipt";
  path: string;
  message: string;
}

export interface WorkspaceValidationArtifact {
  path: string;
  kind: WorkspaceValidationArtifactKind;
  valid: boolean;
  schemaVersion?: string;
  expectedSchemaVersion?: string;
  artifactId?: string;
  trust?: TrustLabel;
  issueCodes: WorkspaceValidationIssue["code"][];
}

export interface WorkspaceValidation {
  schemaVersion: "truth-harness.workspace-validation.v0";
  projectId: string;
  checkedAt: string;
  passed: boolean;
  artifacts: WorkspaceValidationArtifact[];
  issues: WorkspaceValidationIssue[];
  summary: {
    checkedFiles: number;
    validFiles: number;
    invalidFiles: number;
    byKind: Record<string, number>;
    byTrust: Partial<Record<TrustLabel, number>>;
    errors: number;
    warnings: number;
  };
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface ValidateWorkspaceArtifactsInput {
  rootPath: string;
  now?: string;
}

interface DirectoryValidationRule {
  kind: WorkspaceValidationArtifactKind;
  schemaVersion?: string;
  schemaFile?: string;
  idKey?: string;
  required?: boolean;
  variants?: DirectoryValidationVariant[];
}

interface DirectoryValidationVariant {
  schemaVersion: string;
  schemaFile: string;
  idKey: string;
}

interface WorkspaceReference {
  sourcePath: string;
  fieldPath: string;
  kind?: string;
  ref: string;
}

const DIRECTORY_RULES: Partial<Record<LocalWorkspaceDirectory, DirectoryValidationRule>> = {
  receipts: {
    kind: "receipts",
    schemaVersion: "truth-harness.receipt.v0",
    schemaFile: "receipt.schema.json",
    idKey: "runId",
    required: true
  },
  claims: {
    kind: "claims",
    schemaVersion: "truth-harness.claim.v0",
    schemaFile: "claim-ledger.schema.json",
    idKey: "claimId",
    required: true
  },
  indexes: {
    kind: "indexes",
    schemaVersion: "truth-harness.corpus.v0",
    schemaFile: "local-corpus.schema.json",
    idKey: "projectId"
  },
  inventions: {
    kind: "inventions",
    schemaVersion: "truth-harness.invention.v0",
    schemaFile: "invention-log.schema.json",
    idKey: "entryId",
    required: true
  },
  cas: {
    kind: "cas",
    schemaVersion: "truth-harness.cas-check.v0",
    schemaFile: "cas-check.schema.json",
    idKey: "checkId",
    required: true
  },
  proofs: {
    kind: "proofs",
    schemaVersion: "truth-harness.proof-check.v0",
    schemaFile: "proof-check.schema.json",
    idKey: "checkId",
    required: true
  },
  smt: {
    kind: "smt",
    schemaVersion: "truth-harness.smt-check.v0",
    schemaFile: "smt-check.schema.json",
    idKey: "checkId",
    required: true
  },
  benchmarks: {
    kind: "benchmarks",
    variants: [
      {
        schemaVersion: "truth-harness.benchmark-run.v0",
        schemaFile: "benchmark-run.schema.json",
        idKey: "benchmarkRunId"
      },
      {
        schemaVersion: "truth-harness.benchmark-comparison.v0",
        schemaFile: "benchmark-comparison.schema.json",
        idKey: "comparisonId"
      }
    ],
    required: true
  },
  disclosures: {
    kind: "disclosures",
    schemaVersion: "truth-harness.disclosure.v0",
    schemaFile: "disclosure-log.schema.json",
    idKey: "disclosureId",
    required: true
  },
  simulations: {
    kind: "simulations",
    schemaVersion: "truth-harness.simulation.v0",
    schemaFile: "simulation-log.schema.json",
    idKey: "simulationId",
    required: true
  },
  patents: {
    kind: "patents",
    schemaVersion: "truth-harness.claim-chart.v0",
    schemaFile: "claim-chart.schema.json",
    idKey: "chartId",
    required: true
  },
  experiments: {
    kind: "experiments",
    schemaVersion: "truth-harness.experiment.v0",
    schemaFile: "experiment-log.schema.json",
    idKey: "experimentId",
    required: true
  },
  vault: {
    kind: "vault",
    schemaVersion: "truth-harness.vault.v0",
    schemaFile: "vault.schema.json",
    idKey: "vaultId",
    required: true
  },
  audits: {
    kind: "audits",
    schemaVersion: "truth-harness.evidence-audit.v0",
    schemaFile: "evidence-audit.schema.json",
    idKey: "auditId",
    required: true
  },
  snapshots: {
    kind: "snapshots",
    schemaVersion: "truth-harness.workspace-snapshot.v0",
    schemaFile: "workspace-snapshot.schema.json",
    idKey: "snapshotId"
  },
  sessions: {
    kind: "sessions",
    schemaVersion: "truth-harness.research-session.v0",
    schemaFile: "research-session.schema.json",
    idKey: "sessionId",
    required: true
  },
  reviews: {
    kind: "reviews",
    schemaVersion: "truth-harness.expert-review.v0",
    schemaFile: "expert-review.schema.json",
    idKey: "reviewId",
    required: true
  },
  validation: {
    kind: "validation",
    schemaVersion: "truth-harness.validation-plan.v0",
    schemaFile: "validation-plan.schema.json",
    idKey: "planId",
    required: true
  },
  literature: {
    kind: "literature",
    schemaVersion: "truth-harness.literature.v0",
    schemaFile: "literature-record.schema.json",
    idKey: "recordId",
    required: true
  },
  "notebook-runs": {
    kind: "notebook-runs",
    schemaVersion: "truth-harness.notebook-run.v0",
    schemaFile: "notebook-run.schema.json",
    idKey: "runRecordId",
    required: true
  },
  "code-runs": {
    kind: "code-runs",
    schemaVersion: "truth-harness.code-run.v0",
    schemaFile: "code-run.schema.json",
    idKey: "runId",
    required: true
  },
  "model-contexts": {
    kind: "model-contexts",
    schemaVersion: "truth-harness.model-context.v0",
    schemaFile: "model-context.schema.json",
    idKey: "packetId",
    required: true
  },
  routes: {
    kind: "routes",
    schemaVersion: "truth-harness.verifier-route.v0",
    schemaFile: "verifier-route.schema.json",
    idKey: "routeId",
    required: true
  },
  artifacts: {
    kind: "artifacts"
  },
  findings: {
    kind: "findings"
  }
};

const SCHEMAS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");
const WORKSPACE_MANIFEST_SCHEMA_FILE = "workspace-manifest.schema.json";
const schemaCache = new Map<string, Promise<unknown>>();

export async function validateWorkspaceArtifacts(input: ValidateWorkspaceArtifactsInput): Promise<WorkspaceValidation> {
  const status = await requireLocalWorkspace(input.rootPath);
  const checkedAt = input.now ?? new Date().toISOString();
  const issues: WorkspaceValidationIssue[] = [];

  for (const directory of status.missingDirectories) {
    issues.push({
      severity: "error",
      code: "missing-workspace-directory",
      path: directory,
      message: `Required workspace directory is missing: ${directory}`
    });
  }

  const artifacts = [
    await validateWorkspaceManifestFile(status, issues),
    ...(await validateWorkspaceDirectories(status, issues))
  ];
  await validateWorkspaceReferences(status.root, artifacts, issues);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;

  return {
    schemaVersion: "truth-harness.workspace-validation.v0",
    projectId: status.manifest.projectId,
    checkedAt,
    passed: errors === 0,
    artifacts,
    issues,
    summary: {
      checkedFiles: artifacts.length,
      validFiles: artifacts.filter((artifact) => artifact.valid).length,
      invalidFiles: artifacts.filter((artifact) => !artifact.valid).length,
      byKind: summarizeKinds(artifacts),
      byTrust: summarizeTrust(artifacts),
      errors,
      warnings
    },
    privacy: status.manifest.privacy,
    warnings: [
      ...workspaceRepairWarnings(status),
      "Workspace validation checks artifact shape and local trust-boundary metadata; it does not prove scientific, mathematical, medical, regulatory, or legal truth.",
      "Receipt validation is deep and backend-aware. Other known workspace JSON records are checked against their JSON Schema contracts plus local evidence-reference and trust-boundary policies."
    ]
  };
}

function workspaceRepairWarnings(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }
): string[] {
  const repair = status.manifestRepair;
  if (!repair || repair.addedDirectories.length === 0) {
    return [];
  }

  return [
    `Workspace manifest is missing newer default directories (${repair.addedDirectories.join(", ")}). Run \`truth-harness workspace repair\` to persist the manifest update before relying on validation.`
  ];
}

async function validateWorkspaceManifestFile(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  issues: WorkspaceValidationIssue[]
): Promise<WorkspaceValidationArtifact> {
  const path = toPortablePath(relative(status.root, status.manifestPath));
  const artifactIssues: WorkspaceValidationIssue[] = [];

  try {
    const parsed = parseJsonWithOptionalBom(await readFile(status.manifestPath, "utf8"));
    for (const schemaIssue of await validateArtifactSchema(parsed, WORKSPACE_MANIFEST_SCHEMA_FILE)) {
      artifactIssues.push({
        severity: "error",
        code: "invalid-artifact-schema",
        path,
        message: `${schemaIssue.path} ${schemaIssue.message}.`
      });
    }
  } catch (error) {
    const nodeError = error as Error;
    artifactIssues.push({
      severity: "error",
      code: "invalid-json",
      path,
      message: nodeError.message
    });
  }

  issues.push(...artifactIssues);
  return {
    path,
    kind: "manifest",
    valid: !artifactIssues.some((issue) => issue.severity === "error"),
    schemaVersion: status.manifest.schemaVersion,
    expectedSchemaVersion: "truth-harness.workspace.v0",
    artifactId: status.manifest.projectId,
    issueCodes: artifactIssues.map((issue) => issue.code)
  };
}

async function validateWorkspaceDirectories(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  issues: WorkspaceValidationIssue[]
): Promise<WorkspaceValidationArtifact[]> {
  const artifacts: WorkspaceValidationArtifact[] = [];

  for (const [directory, path] of Object.entries(status.manifest.directories) as Array<[LocalWorkspaceDirectory, string]>) {
    const rule = DIRECTORY_RULES[directory] ?? { kind: directory };
    const files = await listJsonFiles(resolve(status.root, path));
    if (directory === "receipts") {
      artifacts.push(...(await validateReceiptFiles(status.root, files, rule, issues)));
      continue;
    }

    artifacts.push(...(await validateGenericJsonFiles(status.root, files, rule, issues)));
  }

  return artifacts.sort((left, right) => left.path.localeCompare(right.path));
}

async function validateReceiptFiles(
  root: string,
  files: string[],
  rule: DirectoryValidationRule,
  issues: WorkspaceValidationIssue[]
): Promise<WorkspaceValidationArtifact[]> {
  const artifacts: WorkspaceValidationArtifact[] = [];

  for (const file of files) {
    const path = toPortablePath(relative(root, file));
    const artifactIssues: WorkspaceValidationIssue[] = [];

    try {
      const receipt = parseReceiptJson(await readFile(file, "utf8"), path);
      if (receipt.trust === "proved") {
        const hasAcceptedProofChecker = receipt.evidenceProfile.backends.some((backend) => backend.acceptedProofChecker);
        if (!receipt.evidenceProfile.proofCheckerBacked || !hasAcceptedProofChecker) {
          artifactIssues.push({
            severity: "error",
            code: "proved-without-proof-checker",
            path,
            message: "Receipt is labeled `proved` without an accepted proof-checking backend."
          });
        }
      }

      if (receipt.trust !== "unverified" && receipt.evidenceProfile.backends.length === 0) {
        artifactIssues.push({
          severity: "error",
          code: "trusted-receipt-without-backend",
          path,
          message: "Trusted receipt has no backend metadata."
        });
      }

      if (!receipt.privacy.localFirst) {
        artifactIssues.push({
          severity: "error",
          code: "non-local-first-receipt",
          path,
          message: "Receipt privacy metadata is not local-first."
        });
      }

      if (receipt.privacy.mode === "external-calls" && receipt.privacy.externalDisclosures.length === 0) {
        artifactIssues.push({
          severity: "error",
          code: "external-call-without-disclosure",
          path,
          message: "Receipt records external calls but has no disclosure metadata."
        });
      }

      if (!receipt.evidenceProfile.replayable) {
        artifactIssues.push({
          severity: "warning",
          code: "non-replayable-receipt",
          path,
          message: "Receipt evidence profile is not replayable; downstream agents need extra caution."
        });
      }

      issues.push(...artifactIssues);
      artifacts.push({
        path,
        kind: "receipts",
        valid: !artifactIssues.some((issue) => issue.severity === "error"),
        schemaVersion: receipt.schemaVersion,
        expectedSchemaVersion: rule.schemaVersion,
        artifactId: receipt.runId,
        trust: receipt.trust,
        issueCodes: artifactIssues.map((issue) => issue.code)
      });
    } catch (error) {
      const issue = issueForReceiptParseFailure(path, error);
      issues.push(issue);
      artifacts.push({
        path,
        kind: "receipts",
        valid: false,
        expectedSchemaVersion: rule.schemaVersion,
        issueCodes: [issue.code]
      });
    }
  }

  return artifacts;
}

async function validateGenericJsonFiles(
  root: string,
  files: string[],
  rule: DirectoryValidationRule,
  issues: WorkspaceValidationIssue[]
): Promise<WorkspaceValidationArtifact[]> {
  const artifacts: WorkspaceValidationArtifact[] = [];

  for (const file of files) {
    const path = toPortablePath(relative(root, file));
    const artifactIssues: WorkspaceValidationIssue[] = [];

    try {
      const parsed = parseJsonWithOptionalBom(await readFile(file, "utf8"));
      const record = isRecord(parsed) ? parsed : undefined;
      const schemaVersion = typeof record?.schemaVersion === "string" ? record.schemaVersion : undefined;
      const variant = resolveRuleVariant(rule, schemaVersion);
      const effectiveSchemaVersion = variant?.schemaVersion ?? rule.schemaVersion;
      const effectiveSchemaFile = variant?.schemaFile ?? rule.schemaFile;
      const effectiveIdKey = variant?.idKey ?? rule.idKey;
      const artifactIdValue = effectiveIdKey && record ? record[effectiveIdKey] : undefined;
      const artifactId = typeof artifactIdValue === "string" ? artifactIdValue : inferLooseArtifactId(rule.kind, record);

      if (!record) {
        artifactIssues.push({
          severity: "error",
          code: "invalid-json",
          path,
          message: "JSON artifact must be an object."
        });
      }

      if (rule.variants && !variant) {
        artifactIssues.push({
          severity: "error",
          code: schemaVersion ? "unexpected-schema-version" : "missing-schema-version",
          path,
          message: schemaVersion
            ? `Expected schemaVersion ${formatExpectedSchemaVersions(rule)}, received ${JSON.stringify(schemaVersion)}.`
            : `Missing schemaVersion ${formatExpectedSchemaVersions(rule)}.`
        });
      } else if (rule.schemaVersion && schemaVersion !== rule.schemaVersion) {
        artifactIssues.push({
          severity: "error",
          code: schemaVersion ? "unexpected-schema-version" : "missing-schema-version",
          path,
          message: schemaVersion
            ? `Expected schemaVersion ${JSON.stringify(rule.schemaVersion)}, received ${JSON.stringify(schemaVersion)}.`
            : `Missing schemaVersion ${JSON.stringify(rule.schemaVersion)}.`
        });
      } else if (!rule.schemaVersion && !schemaVersion) {
        artifactIssues.push({
          severity: "warning",
          code: "missing-schema-version",
          path,
          message: "JSON artifact has no schemaVersion; portability and agent validation are weaker."
        });
      }

      if (effectiveIdKey && !artifactId) {
        artifactIssues.push({
          severity: "error",
          code: "missing-artifact-id",
          path,
          message: `Missing artifact id field ${JSON.stringify(effectiveIdKey)}.`
        });
      }

      if (record && effectiveSchemaFile && (!effectiveSchemaVersion || schemaVersion === effectiveSchemaVersion)) {
        for (const schemaIssue of await validateArtifactSchema(parsed, effectiveSchemaFile)) {
          artifactIssues.push({
            severity: "error",
            code: "invalid-artifact-schema",
            path,
            message: `${schemaIssue.path} ${schemaIssue.message}.`
          });
        }
      }

      issues.push(...artifactIssues);
      artifacts.push({
        path,
        kind: rule.kind,
        valid: !artifactIssues.some((issue) => issue.severity === "error"),
        schemaVersion,
        expectedSchemaVersion: effectiveSchemaVersion,
        artifactId,
        issueCodes: artifactIssues.map((issue) => issue.code)
      });
    } catch (error) {
      const nodeError = error as Error;
      const issue: WorkspaceValidationIssue = {
        severity: "error",
        code: "invalid-json",
        path,
        message: nodeError.message
      };
      issues.push(issue);
      artifacts.push({
        path,
        kind: rule.kind,
        valid: false,
        expectedSchemaVersion: formatExpectedSchemaVersions(rule),
        issueCodes: [issue.code]
      });
    }
  }

  return artifacts;
}

async function validateArtifactSchema(value: unknown, schemaFile: string) {
  const schema = await loadJsonSchema(schemaFile);
  return validateJsonSchema(value, schema);
}

function resolveRuleVariant(
  rule: DirectoryValidationRule,
  schemaVersion: string | undefined
): DirectoryValidationVariant | undefined {
  return rule.variants?.find((variant) => variant.schemaVersion === schemaVersion);
}

function formatExpectedSchemaVersions(rule: DirectoryValidationRule): string | undefined {
  if (!rule.variants) {
    return rule.schemaVersion;
  }

  return rule.variants.map((variant) => JSON.stringify(variant.schemaVersion)).join(" or ");
}

async function loadJsonSchema(schemaFile: string): Promise<unknown> {
  const cached = schemaCache.get(schemaFile);
  if (cached) {
    return cached;
  }

  const loaded = readFile(resolve(SCHEMAS_DIR, schemaFile), "utf8").then((raw) => parseJsonWithOptionalBom(raw));
  schemaCache.set(schemaFile, loaded);
  return loaded;
}

async function validateWorkspaceReferences(
  root: string,
  artifacts: WorkspaceValidationArtifact[],
  issues: WorkspaceValidationIssue[]
): Promise<void> {
  const index = createArtifactIndex(artifacts);

  for (const artifact of artifacts) {
    if (!artifact.valid || artifact.kind === "receipts") {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = parseJsonWithOptionalBom(await readFile(resolve(root, artifact.path), "utf8"));
    } catch {
      continue;
    }

    for (const ref of collectWorkspaceReferences(parsed, artifact.path)) {
      if (isResolvedReference(ref, index)) {
        continue;
      }

      pushArtifactIssue(artifact, issues, {
        severity: "error",
        code: "unresolved-evidence-ref",
        path: artifact.path,
        message: `${ref.fieldPath} references missing local evidence ${formatReference(ref)}.`
      });
    }

    validateExternalDisclosurePolicy(parsed, artifact, index, issues);
  }
}

function validateExternalDisclosurePolicy(
  value: unknown,
  artifact: WorkspaceValidationArtifact,
  index: {
    idsByKind: Map<WorkspaceValidationArtifactKind, Set<string>>;
    paths: Set<string>;
  },
  issues: WorkspaceValidationIssue[]
): void {
  if (!isRecord(value)) {
    return;
  }

  if (artifact.kind === "model-contexts") {
    validateModelContextPolicy(value, artifact, index, issues);
    return;
  }

  if (artifact.kind === "disclosures") {
    validateDisclosurePolicy(value, artifact, issues);
  }
}

function validateModelContextPolicy(
  record: Record<string, unknown>,
  artifact: WorkspaceValidationArtifact,
  index: {
    idsByKind: Map<WorkspaceValidationArtifactKind, Set<string>>;
    paths: Set<string>;
  },
  issues: WorkspaceValidationIssue[]
): void {
  const target = isRecord(record.target) ? record.target : undefined;
  const approval = isRecord(record.approval) ? record.approval : undefined;
  const disclosure = isRecord(record.disclosure) ? record.disclosure : undefined;
  const targetKind = typeof target?.kind === "string" ? target.kind : undefined;
  const disclosureStatus = typeof disclosure?.status === "string" ? disclosure.status : undefined;
  const disclosureRef = typeof disclosure?.disclosureRef === "string" ? disclosure.disclosureRef : undefined;

  if (targetKind === "local-model") {
    return;
  }

  if (disclosureStatus === "planned" && disclosureRef && !isResolvedArtifactRef("disclosures", disclosureRef, index)) {
    pushArtifactIssue(artifact, issues, {
      severity: "error",
      code: "unresolved-disclosure-ref",
      path: artifact.path,
      message: `$.disclosure.disclosureRef references missing local disclosure ${disclosureRef}.`
    });
  }

  if (disclosureStatus !== "sent") {
    return;
  }

  const approvalStatus = typeof approval?.status === "string" ? approval.status : undefined;
  const approvalRef = typeof approval?.approvalRef === "string" ? approval.approvalRef : undefined;
  if (approvalStatus !== "approved" || !approvalRef) {
    pushArtifactIssue(artifact, issues, {
      severity: "error",
      code: "external-model-context-sent-without-approval",
      path: artifact.path,
      message: "$.disclosure.status is `sent`, but the packet does not record approved human authorization."
    });
  }

  if (!disclosureRef) {
    pushArtifactIssue(artifact, issues, {
      severity: "error",
      code: "external-model-context-sent-without-disclosure",
      path: artifact.path,
      message: "$.disclosure.status is `sent`, but no disclosureRef links to the local disclosure log."
    });
    return;
  }

  if (!isResolvedArtifactRef("disclosures", disclosureRef, index)) {
    pushArtifactIssue(artifact, issues, {
      severity: "error",
      code: "unresolved-disclosure-ref",
      path: artifact.path,
      message: `$.disclosure.disclosureRef references missing local disclosure ${disclosureRef}.`
    });
  }
}

function validateDisclosurePolicy(
  record: Record<string, unknown>,
  artifact: WorkspaceValidationArtifact,
  issues: WorkspaceValidationIssue[]
): void {
  const status = typeof record.status === "string" ? record.status : undefined;
  if (status !== "sent" && status !== "received") {
    return;
  }

  if (typeof record.approvalRef !== "string" || record.approvalRef.trim().length === 0) {
    pushArtifactIssue(artifact, issues, {
      severity: "error",
      code: "sent-disclosure-without-approval",
      path: artifact.path,
      message: "$.status is sent/received, but approvalRef is missing."
    });
  }

  if (record.userInitiated !== true) {
    pushArtifactIssue(artifact, issues, {
      severity: "error",
      code: "sent-disclosure-not-user-initiated",
      path: artifact.path,
      message: "$.status is sent/received, but userInitiated is not true."
    });
  }

  if (!Array.isArray(record.selectedContextRefs) || record.selectedContextRefs.length === 0) {
    pushArtifactIssue(artifact, issues, {
      severity: "error",
      code: "sent-disclosure-without-selected-context",
      path: artifact.path,
      message: "$.status is sent/received, but selectedContextRefs is empty."
    });
  }
}

function pushArtifactIssue(
  artifact: WorkspaceValidationArtifact,
  issues: WorkspaceValidationIssue[],
  issue: WorkspaceValidationIssue
): void {
  issues.push(issue);
  artifact.valid = false;
  artifact.issueCodes.push(issue.code);
}

function createArtifactIndex(artifacts: WorkspaceValidationArtifact[]): {
  idsByKind: Map<WorkspaceValidationArtifactKind, Set<string>>;
  paths: Set<string>;
} {
  const idsByKind = new Map<WorkspaceValidationArtifactKind, Set<string>>();
  const paths = new Set<string>();

  for (const artifact of artifacts) {
    if (!artifact.valid) {
      continue;
    }

    paths.add(artifact.path);
    if (artifact.artifactId) {
      const ids = idsByKind.get(artifact.kind) ?? new Set<string>();
      ids.add(artifact.artifactId);
      idsByKind.set(artifact.kind, ids);
    }
  }

  return { idsByKind, paths };
}

function collectWorkspaceReferences(value: unknown, sourcePath: string): WorkspaceReference[] {
  const refs: WorkspaceReference[] = [];

  function walk(current: unknown, path: string): void {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }

    if (!isRecord(current)) {
      return;
    }

    for (const [key, entry] of Object.entries(current)) {
      const entryPath = `${path}.${key}`;
      if (key === "evidenceRefs" && Array.isArray(entry)) {
        collectEvidenceRefArray(entry, sourcePath, entryPath, refs);
        continue;
      }

      if (key === "snapshotRefs" && Array.isArray(entry)) {
        collectStringRefs(entry, sourcePath, entryPath, "snapshot", refs);
        continue;
      }

      if ((key === "dependsOn" || key === "supersedes") && Array.isArray(entry)) {
        collectStringRefs(entry, sourcePath, entryPath, "claim", refs);
        continue;
      }

      if (key === "selectedContextRefs" && Array.isArray(entry)) {
        collectStringRefs(entry, sourcePath, entryPath, undefined, refs);
        continue;
      }

      walk(entry, entryPath);
    }
  }

  walk(value, "$");
  return refs.filter((ref) => shouldResolveReference(ref));
}

function collectEvidenceRefArray(
  values: unknown[],
  sourcePath: string,
  fieldPath: string,
  refs: WorkspaceReference[]
): void {
  values.forEach((entry, index) => {
    const entryPath = `${fieldPath}[${index}]`;
    if (isRecord(entry) && typeof entry.ref === "string") {
      refs.push({
        sourcePath,
        fieldPath: entryPath,
        kind: typeof entry.kind === "string" ? entry.kind : undefined,
        ref: entry.ref
      });
      return;
    }

    if (typeof entry === "string") {
      refs.push(parseStringReference(entry, sourcePath, entryPath));
    }
  });
}

function collectStringRefs(
  values: unknown[],
  sourcePath: string,
  fieldPath: string,
  defaultKind: string | undefined,
  refs: WorkspaceReference[]
): void {
  values.forEach((entry, index) => {
    if (typeof entry !== "string") {
      return;
    }

    const parsed = parseStringReference(entry, sourcePath, `${fieldPath}[${index}]`);
    refs.push(defaultKind && !parsed.kind ? { ...parsed, kind: defaultKind } : parsed);
  });
}

function parseStringReference(value: string, sourcePath: string, fieldPath: string): WorkspaceReference {
  const match = /^([a-z][a-z0-9-]*):(.+)$/i.exec(value);
  if (!match) {
    return { sourcePath, fieldPath, ref: value };
  }

  return {
    sourcePath,
    fieldPath,
    kind: match[1],
    ref: match[2]
  };
}

function shouldResolveReference(ref: WorkspaceReference): boolean {
  return Boolean(kindToArtifactKind(ref.kind));
}

function isResolvedReference(
  ref: WorkspaceReference,
  index: {
    idsByKind: Map<WorkspaceValidationArtifactKind, Set<string>>;
    paths: Set<string>;
  }
): boolean {
  const artifactKind = kindToArtifactKind(ref.kind);
  if (!artifactKind) {
    return true;
  }

  const pathRef = normalizeReferencePath(ref.ref);
  if (looksLikePathReference(ref.ref)) {
    return index.paths.has(pathRef);
  }

  return index.idsByKind.get(artifactKind)?.has(ref.ref) ?? false;
}

function isResolvedArtifactRef(
  artifactKind: WorkspaceValidationArtifactKind,
  ref: string,
  index: {
    idsByKind: Map<WorkspaceValidationArtifactKind, Set<string>>;
    paths: Set<string>;
  }
): boolean {
  const parsed = parseStringReference(ref, "", "$");
  const normalizedRef = parsed.kind === "disclosure" ? parsed.ref : ref;
  if (looksLikePathReference(normalizedRef)) {
    return index.paths.has(normalizeReferencePath(normalizedRef));
  }

  return index.idsByKind.get(artifactKind)?.has(normalizedRef) ?? false;
}

function kindToArtifactKind(kind: string | undefined): WorkspaceValidationArtifactKind | undefined {
  switch (kind) {
    case "receipt":
      return "receipts";
    case "claim":
      return "claims";
    case "cas":
    case "cas-check":
      return "cas";
    case "proof":
    case "proof-check":
      return "proofs";
    case "smt":
    case "smt-check":
      return "smt";
    case "simulation":
      return "simulations";
    case "experiment":
      return "experiments";
    case "vault":
      return "vault";
    case "review":
      return "reviews";
    case "validation":
      return "validation";
    case "literature":
      return "literature";
    case "notebook-run":
      return "notebook-runs";
    case "code-run":
      return "code-runs";
    case "benchmark":
      return "benchmarks";
    case "disclosure":
      return "disclosures";
    case "audit":
      return "audits";
    case "snapshot":
      return "snapshots";
    case "workspace-review":
      return "findings";
    case "claim-chart":
      return "patents";
    case "model-context":
      return "model-contexts";
    case "route":
    case "verifier-route":
      return "routes";
    default:
      return undefined;
  }
}

function inferLooseArtifactId(
  kind: WorkspaceValidationArtifactKind,
  record: Record<string, unknown> | undefined
): string | undefined {
  if (kind !== "findings" || record?.schemaVersion !== "truth-harness.workspace-review.v0") {
    return undefined;
  }

  return typeof record.reviewId === "string" ? record.reviewId : undefined;
}

function looksLikePathReference(ref: string): boolean {
  const withoutFragment = ref.split("#", 1)[0] ?? ref;
  return withoutFragment.endsWith(".json") || withoutFragment.includes("/") || withoutFragment.includes("\\");
}

function normalizeReferencePath(ref: string): string {
  const withoutFragment = (ref.split("#", 1)[0] ?? ref).replace(/\\/g, "/");
  return withoutFragment.startsWith("./") ? withoutFragment.slice(2) : withoutFragment;
}

function formatReference(ref: WorkspaceReference): string {
  return ref.kind ? `${ref.kind}:${ref.ref}` : ref.ref;
}

async function listJsonFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(path);
      }
    }
  }

  await walk(root);
  return files.sort();
}

function issueForReceiptParseFailure(path: string, error: unknown): WorkspaceValidationIssue {
  if (error instanceof ReceiptValidationError) {
    return {
      severity: "error",
      code: error.issues.some((issue) => issue.path === "$" && issue.message.startsWith("is not valid JSON"))
        ? "invalid-json"
        : "invalid-receipt-schema",
      path,
      message: error.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")
    };
  }

  throw error;
}

function summarizeKinds(artifacts: WorkspaceValidationArtifact[]): Record<string, number> {
  const byKind: Record<string, number> = {};

  for (const artifact of artifacts) {
    byKind[artifact.kind] = (byKind[artifact.kind] ?? 0) + 1;
  }

  return byKind;
}

function summarizeTrust(artifacts: WorkspaceValidationArtifact[]): Partial<Record<TrustLabel, number>> {
  const byTrust: Partial<Record<TrustLabel, number>> = {};

  for (const artifact of artifacts) {
    if (artifact.trust) {
      byTrust[artifact.trust] = (byTrust[artifact.trust] ?? 0) + 1;
    }
  }

  return byTrust;
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before validating workspace artifacts.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
