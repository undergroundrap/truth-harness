import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import {
  validateWorkspaceArtifacts,
  type WorkspaceValidation,
  type WorkspaceValidationArtifact,
  type WorkspaceValidationArtifactKind,
  type WorkspaceValidationIssue
} from "./workspace-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";

export type WorkspaceGraphNodeKind = WorkspaceValidationArtifactKind | "missing-ref";
export type WorkspaceGraphEdgeKind =
  | "evidence-ref"
  | "task-evidence-ref"
  | "checkpoint-evidence-ref"
  | "source-ref"
  | "depends-on"
  | "supersedes"
  | "snapshot-ref"
  | "selected-context-ref";

export interface WorkspaceGraphNode {
  nodeId: string;
  kind: WorkspaceGraphNodeKind;
  label: string;
  path?: string;
  artifactId?: string;
  schemaVersion?: string;
  trust?: TrustLabel;
  valid: boolean;
  missing?: boolean;
  issueCodes: string[];
}

export interface WorkspaceGraphEdge {
  edgeId: string;
  from: string;
  to: string;
  kind: WorkspaceGraphEdgeKind;
  sourcePath: string;
  fieldPath: string;
  refKind?: string;
  ref: string;
  resolved: boolean;
}

export interface WorkspaceGraph {
  schemaVersion: "truth-harness.workspace-graph.v0";
  projectId: string;
  createdAt: string;
  workspacePath: string;
  localOnly: true;
  networkAccess: "none";
  privacy: PrivacyMetadata;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  summary: {
    artifacts: number;
    validArtifacts: number;
    invalidArtifacts: number;
    nodes: number;
    edges: number;
    missingRefs: number;
    byKind: Record<string, number>;
  };
  validation: {
    passed: boolean;
    errors: number;
    warnings: number;
    issues: WorkspaceValidationIssue[];
  };
  warnings: string[];
}

export interface CreateWorkspaceGraphInput {
  rootPath: string;
  now?: string;
}

interface WorkspaceReference {
  sourcePath: string;
  fieldPath: string;
  edgeKind: WorkspaceGraphEdgeKind;
  kind?: string;
  ref: string;
}

export async function createWorkspaceGraph(input: CreateWorkspaceGraphInput): Promise<WorkspaceGraph> {
  const status = await requireLocalWorkspace(input.rootPath);
  const validation = await validateWorkspaceArtifacts({
    rootPath: status.root,
    now: input.now
  });
  const artifactLabels = await loadArtifactLabels(status.root, validation.artifacts);
  const artifactNodes = validation.artifacts.map((artifact) => artifactNode(artifact, artifactLabels.get(artifact.path)));
  const nodeByPath = new Map(artifactNodes.flatMap((node) => (node.path ? [[node.path, node] as const] : [])));
  const nodeByKindAndId = indexNodesByKindAndId(artifactNodes);
  const missingNodes = new Map<string, WorkspaceGraphNode>();
  const edges: WorkspaceGraphEdge[] = [];

  for (const artifact of validation.artifacts) {
    const source = artifact.path ? nodeByPath.get(artifact.path) : undefined;
    if (!source || !artifact.path.endsWith(".json")) {
      continue;
    }

    const parsed = await tryReadJson(resolveUnderRoot(status.root, artifact.path));
    if (parsed === undefined) {
      continue;
    }

    for (const ref of collectWorkspaceReferences(parsed, artifact.path)) {
      const target = resolveReference(ref, nodeByPath, nodeByKindAndId, missingNodes);
      edges.push({
        edgeId: edgeIdFor(source.nodeId, target.nodeId, ref),
        from: source.nodeId,
        to: target.nodeId,
        kind: ref.edgeKind,
        sourcePath: ref.sourcePath,
        fieldPath: ref.fieldPath,
        refKind: ref.kind,
        ref: ref.ref,
        resolved: !target.missing
      });
    }
  }

  const nodes = [...artifactNodes, ...missingNodes.values()].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const sortedEdges = edges.sort((left, right) => left.edgeId.localeCompare(right.edgeId));

  return {
    schemaVersion: "truth-harness.workspace-graph.v0",
    projectId: status.manifest.projectId,
    createdAt: input.now ?? new Date().toISOString(),
    workspacePath: status.root,
    localOnly: true,
    networkAccess: "none",
    privacy: status.manifest.privacy,
    nodes,
    edges: sortedEdges,
    summary: summarizeGraph(validation, nodes, sortedEdges),
    validation: {
      passed: validation.passed,
      errors: validation.summary.errors,
      warnings: validation.summary.warnings,
      issues: validation.issues
    },
    warnings: [
      "Workspace graph is a local provenance map. It does not upgrade trust or prove claims by itself.",
      "Missing-reference nodes are shown explicitly so humans and agents can repair broken evidence links before relying on a result."
    ]
  };
}

function artifactNode(artifact: WorkspaceValidationArtifact, label: string | undefined): WorkspaceGraphNode {
  return {
    nodeId: nodeIdForArtifact(artifact),
    kind: artifact.kind,
    label: label ?? artifact.artifactId ?? artifact.path,
    path: artifact.path,
    artifactId: artifact.artifactId,
    schemaVersion: artifact.schemaVersion,
    trust: artifact.trust,
    valid: artifact.valid,
    issueCodes: artifact.issueCodes
  };
}

async function loadArtifactLabels(root: string, artifacts: WorkspaceValidationArtifact[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  await Promise.all(
    artifacts
      .filter((artifact) => artifact.path.endsWith(".json"))
      .map(async (artifact) => {
        const parsed = await tryReadJson(resolveUnderRoot(root, artifact.path));
        if (parsed && isRecord(parsed)) {
          labels.set(artifact.path, labelForRecord(parsed, artifact.artifactId ?? artifact.path));
        }
      })
  );

  return labels;
}

function labelForRecord(record: Record<string, unknown>, fallback: string): string {
  for (const key of ["title", "statement", "objective", "problem", "summary", "displayName", "name"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/\s+/gu, " ").slice(0, 140);
    }
  }

  return fallback;
}

function indexNodesByKindAndId(nodes: WorkspaceGraphNode[]): Map<string, WorkspaceGraphNode> {
  const index = new Map<string, WorkspaceGraphNode>();
  for (const node of nodes) {
    if (!node.artifactId) {
      continue;
    }

    index.set(`${node.kind}:${node.artifactId}`, node);
  }

  return index;
}

function resolveReference(
  ref: WorkspaceReference,
  nodeByPath: Map<string, WorkspaceGraphNode>,
  nodeByKindAndId: Map<string, WorkspaceGraphNode>,
  missingNodes: Map<string, WorkspaceGraphNode>
): WorkspaceGraphNode {
  const artifactKind = referenceKindToArtifactKind(ref.kind);
  if (artifactKind) {
    const byId = nodeByKindAndId.get(`${artifactKind}:${ref.ref}`);
    if (byId) {
      return byId;
    }
  }

  const portablePath = normalizePortablePath(ref.ref);
  const byPath = nodeByPath.get(portablePath);
  if (byPath) {
    return byPath;
  }

  const nodeId = `missing_${stableHash({ kind: ref.kind, ref: ref.ref }).slice(0, 16)}`;
  const existing = missingNodes.get(nodeId);
  if (existing) {
    return existing;
  }

  const missing: WorkspaceGraphNode = {
    nodeId,
    kind: "missing-ref",
    label: ref.kind ? `${ref.kind}:${ref.ref}` : ref.ref,
    artifactId: ref.ref,
    valid: false,
    missing: true,
    issueCodes: ["unresolved-evidence-ref"]
  };
  missingNodes.set(nodeId, missing);
  return missing;
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
        collectEvidenceRefs(entry, sourcePath, entryPath, edgeKindForEvidencePath(path), refs);
        continue;
      }

      if (key === "sourceRefs" && Array.isArray(entry)) {
        collectSourceRefs(entry, sourcePath, entryPath, refs);
        continue;
      }

      if (key === "snapshotRefs" && Array.isArray(entry)) {
        collectStringRefs(entry, sourcePath, entryPath, "snapshot-ref", "snapshot", refs);
        continue;
      }

      if (key === "dependsOn" && Array.isArray(entry)) {
        collectStringRefs(entry, sourcePath, entryPath, "depends-on", "claim", refs);
        continue;
      }

      if (key === "supersedes" && Array.isArray(entry)) {
        collectStringRefs(entry, sourcePath, entryPath, "supersedes", "claim", refs);
        continue;
      }

      if (key === "selectedContextRefs" && Array.isArray(entry)) {
        collectStringRefs(entry, sourcePath, entryPath, "selected-context-ref", undefined, refs);
        continue;
      }

      walk(entry, entryPath);
    }
  }

  walk(value, "$");
  return refs.filter((ref) => ref.ref.trim().length > 0);
}

function collectSourceRefs(
  values: unknown[],
  sourcePath: string,
  fieldPath: string,
  refs: WorkspaceReference[]
): void {
  values.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.ref !== "string") {
      return;
    }

    const kind = typeof entry.kind === "string" ? entry.kind : undefined;
    const ref = entry.ref;
    if (!referenceKindToArtifactKind(kind)) {
      return;
    }

    refs.push({
      sourcePath,
      fieldPath: `${fieldPath}[${index}]`,
      edgeKind: "source-ref",
      kind,
      ref
    });
  });
}

function collectEvidenceRefs(
  values: unknown[],
  sourcePath: string,
  fieldPath: string,
  edgeKind: WorkspaceGraphEdgeKind,
  refs: WorkspaceReference[]
): void {
  values.forEach((entry, index) => {
    const entryPath = `${fieldPath}[${index}]`;
    if (isRecord(entry) && typeof entry.ref === "string") {
      refs.push({
        sourcePath,
        fieldPath: entryPath,
        edgeKind,
        kind: typeof entry.kind === "string" ? entry.kind : undefined,
        ref: entry.ref
      });
      return;
    }

    if (typeof entry === "string") {
      refs.push(parseStringReference(entry, sourcePath, entryPath, edgeKind));
    }
  });
}

function collectStringRefs(
  values: unknown[],
  sourcePath: string,
  fieldPath: string,
  edgeKind: WorkspaceGraphEdgeKind,
  kind: string | undefined,
  refs: WorkspaceReference[]
): void {
  values.forEach((entry, index) => {
    if (typeof entry === "string") {
      refs.push({
        sourcePath,
        fieldPath: `${fieldPath}[${index}]`,
        edgeKind,
        kind,
        ref: entry
      });
    }
  });
}

function parseStringReference(
  value: string,
  sourcePath: string,
  fieldPath: string,
  edgeKind: WorkspaceGraphEdgeKind
): WorkspaceReference {
  const separator = value.indexOf(":");
  if (separator > 0) {
    return {
      sourcePath,
      fieldPath,
      edgeKind,
      kind: value.slice(0, separator),
      ref: value.slice(separator + 1)
    };
  }

  return { sourcePath, fieldPath, edgeKind, ref: value };
}

function edgeKindForEvidencePath(path: string): WorkspaceGraphEdgeKind {
  if (/\.tasks\[\d+\]$/u.test(path)) {
    return "task-evidence-ref";
  }
  if (/\.checkpoints\[\d+\]$/u.test(path)) {
    return "checkpoint-evidence-ref";
  }

  return "evidence-ref";
}

function referenceKindToArtifactKind(kind: string | undefined): WorkspaceValidationArtifactKind | undefined {
  switch (kind) {
    case "receipt":
      return "receipts";
    case "claim":
      return "claims";
    case "route":
    case "verifier-route":
      return "routes";
    case "snapshot":
      return "snapshots";
    case "workspace-review":
      return "findings";
    case "review":
      return "reviews";
    case "validation":
      return "validation";
    case "literature":
      return "literature";
    case "notebook-run":
    case "notebook":
      return "notebook-runs";
    case "code-run":
      return "code-runs";
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
    case "audit":
      return "audits";
    case "vault":
      return "vault";
    case "model-context":
      return "model-contexts";
    case "claim-chart":
      return "patents";
    case "benchmark":
      return "benchmarks";
    case "disclosure":
      return "disclosures";
    case "invention":
      return "inventions";
    case "visual":
    case "visual-artifact":
      return "visuals";
    default:
      return undefined;
  }
}

function summarizeGraph(
  validation: WorkspaceValidation,
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[]
): WorkspaceGraph["summary"] {
  const byKind: Record<string, number> = {};
  for (const node of nodes) {
    byKind[node.kind] = (byKind[node.kind] ?? 0) + 1;
  }

  return {
    artifacts: validation.artifacts.length,
    validArtifacts: validation.summary.validFiles,
    invalidArtifacts: validation.summary.invalidFiles,
    nodes: nodes.length,
    edges: edges.length,
    missingRefs: nodes.filter((node) => node.missing).length,
    byKind
  };
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before graphing workspace evidence.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

async function tryReadJson(path: string): Promise<unknown | undefined> {
  try {
    return parseJsonWithOptionalBom(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

function nodeIdForArtifact(artifact: WorkspaceValidationArtifact): string {
  if (artifact.artifactId) {
    return `artifact_${stableHash({ kind: artifact.kind, id: artifact.artifactId }).slice(0, 16)}`;
  }

  return `artifact_${stableHash({ kind: artifact.kind, path: artifact.path }).slice(0, 16)}`;
}

function edgeIdFor(sourceId: string, targetId: string, ref: WorkspaceReference): string {
  return `edge_${stableHash({ sourceId, targetId, ref }).slice(0, 16)}`;
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Workspace graph path escapes workspace root: ${JSON.stringify(path)}`);
  }

  return target;
}

function normalizePortablePath(value: string): string {
  return relative("", value).split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
