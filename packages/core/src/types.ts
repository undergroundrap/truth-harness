export type TrustLabel =
  | "proved"
  | "exact-computed"
  | "bounded-numeric"
  | "smt-checked"
  | "dimension-checked"
  | "source-cited"
  | "cross-checked"
  | "unverified"
  | "refuted";

export type NodeKind =
  | "problem"
  | "normalized_problem"
  | "claim"
  | "plan"
  | "tool_run"
  | "proof"
  | "computation"
  | "counterexample"
  | "source"
  | "explanation"
  | "lesson"
  | "artifact";

export interface GraphNode<T = unknown> {
  id: string;
  kind: NodeKind;
  createdAt: string;
  payload: T;
  trust: TrustLabel;
  summary: string;
  artifactRefs: string[];
}

export interface EvidenceEdge {
  from: string;
  to: string;
  label: string;
}

export interface Artifact {
  id: string;
  kind: string;
  mimeType: string;
  content: string;
}

export interface EvidenceGraph {
  nodes: GraphNode[];
  edges: EvidenceEdge[];
}

export interface Finding {
  level: "info" | "warning" | "error";
  message: string;
}

export interface Receipt {
  schemaVersion: "theorem.receipt.v0";
  runId: string;
  createdAt: string;
  problem: string;
  normalizedProblem: string;
  trust: TrustLabel;
  summary: string;
  replay: string;
  graph: EvidenceGraph;
  artifacts: Artifact[];
  findings: Finding[];
}
