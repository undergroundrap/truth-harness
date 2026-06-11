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

export interface ExternalDisclosure {
  service: string;
  purpose: string;
  dataClasses: string[];
  userInitiated: boolean;
}

export interface PrivacyMetadata {
  mode: "local-only" | "external-calls";
  localFirst: boolean;
  networkAccess: "none" | "optional" | "required";
  dataResidency: "local-workspace";
  externalDisclosures: ExternalDisclosure[];
}

export interface ReceiptBackend {
  id: string;
  role:
    | "arithmetic"
    | "counterexample-search"
    | "checker"
    | "cas"
    | "retrieval"
    | "interval"
    | "proof-checker"
    | "planned";
  version?: string;
  environment?: Record<string, string>;
  acceptedProofChecker: boolean;
}

export interface ReceiptEvidenceProfile {
  kind:
    | "exact-arithmetic"
    | "universal-parity"
    | "dimension-analysis"
    | "symbolic-cas"
    | "interval-bound"
    | "source-citation"
    | "unsupported";
  backends: ReceiptBackend[];
  inputs: string[];
  outputs: string[];
  replayable: boolean;
  proofCheckerBacked: boolean;
  limitations: string[];
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
  privacy: PrivacyMetadata;
  evidenceProfile: ReceiptEvidenceProfile;
  graph: EvidenceGraph;
  artifacts: Artifact[];
  findings: Finding[];
}
