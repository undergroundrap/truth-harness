import { searchLocalCorpus, type LocalCorpusSearchHit } from "./local-corpus.js";
import { stableHash } from "./stable-hash.js";
import type {
  Artifact,
  EvidenceEdge,
  Finding,
  GraphNode,
  PrivacyMetadata,
  Receipt,
  ReceiptEvidenceProfile,
  TrustLabel
} from "./types.js";

export interface SourceCitationReceiptInput {
  rootPath: string;
  claim: string;
  query?: string;
  limit?: number;
  now?: string;
}

export async function createSourceCitationReceipt(input: SourceCitationReceiptInput): Promise<Receipt> {
  const claim = normalizeText(input.claim);
  if (!claim) {
    throw new Error("Source-cited receipt claim is required.");
  }

  const query = normalizeText(input.query) || claim;
  const createdAt = input.now ?? new Date().toISOString();
  const problem = `source cite: ${claim}`;
  const normalizedProblem = normalizeText(problem);
  const search = await searchLocalCorpus({
    rootPath: input.rootPath,
    query,
    limit: input.limit
  });
  const nodes: GraphNode[] = [];
  const edges: EvidenceEdge[] = [];
  const artifacts: Artifact[] = [];
  const findings: Finding[] = [];
  const trust: TrustLabel = search.hits.length > 0 ? "source-cited" : "unverified";

  const searchArtifact = addArtifact(artifacts, {
    kind: "local-corpus-search-result",
    mimeType: "application/json",
    content: JSON.stringify(search, null, 2)
  });

  const problemNode = addNode(nodes, createdAt, {
    kind: "problem",
    payload: { problem },
    trust: "unverified",
    summary: "Original source-citation request.",
    artifactRefs: []
  });

  const normalizedNode = addNode(nodes, createdAt, {
    kind: "normalized_problem",
    payload: { normalizedProblem, query },
    trust: "unverified",
    summary: "Normalized source-citation claim and search query.",
    artifactRefs: []
  });
  edges.push({ from: problemNode.id, to: normalizedNode.id, label: "normalized-as" });

  const claimNode = addNode(nodes, createdAt, {
    kind: "claim",
    payload: { claim },
    trust,
    summary:
      trust === "source-cited"
        ? "Claim has local source retrieval hits for human or agent review."
        : "Claim has no local source retrieval hits.",
    artifactRefs: [searchArtifact.id]
  });
  edges.push({ from: normalizedNode.id, to: claimNode.id, label: "claims" });

  const toolNode = addNode(nodes, createdAt, {
    kind: "tool_run",
    payload: {
      adapter: "local-corpus-lexical-search",
      query: search.query,
      totalChunks: search.totalChunks,
      hits: search.hits.length,
      indexPath: search.indexPath
    },
    trust,
    summary: `Searched the private local corpus and found ${search.hits.length} matching chunk(s).`,
    artifactRefs: [searchArtifact.id]
  });
  edges.push({ from: claimNode.id, to: toolNode.id, label: "searched-by" });

  for (const hit of search.hits) {
    const sourceNode = addNode(nodes, createdAt, {
      kind: "source",
      payload: sourcePayload(hit),
      trust: "source-cited",
      summary: `${hit.path}#${hit.chunkId} matched ${hit.matchedTerms.join(", ")}.`,
      artifactRefs: [searchArtifact.id]
    });
    edges.push({ from: toolNode.id, to: sourceNode.id, label: "returned" });
    edges.push({ from: sourceNode.id, to: claimNode.id, label: "cites" });
  }

  if (search.hits.length === 0) {
    findings.push({
      level: "warning",
      message: "No matching local source chunks were found. The claim remains unverified."
    });
  } else {
    findings.push({
      level: "info",
      message:
        "Source-cited means local retrieval found relevant chunks. It does not prove entailment, experimental validity, clinical validity, or legal novelty."
    });
  }

  return buildSourceReceipt({
    problem,
    normalizedProblem,
    createdAt,
    trust,
    summary:
      trust === "source-cited"
        ? `Source-cited: found ${search.hits.length} local corpus chunk(s) for query ${JSON.stringify(query)}.`
        : `Unverified: no local corpus chunks matched query ${JSON.stringify(query)}.`,
    evidenceProfile: {
      kind: "source-citation",
      backends: [
        {
          id: "local-corpus-lexical-search",
          role: "retrieval",
          version: "0",
          acceptedProofChecker: false
        }
      ],
      inputs: [claim, `query=${query}`],
      outputs: search.hits.map((hit) => `${hit.path}#${hit.chunkId}`),
      replayable: true,
      proofCheckerBacked: false,
      limitations: [
        "Source-cited means local retrieval found matching chunks.",
        "Retrieval is not proof of entailment, experimental validity, clinical validity, or legal novelty."
      ]
    },
    query,
    nodes,
    edges,
    artifacts,
    findings
  });
}

function sourcePayload(hit: LocalCorpusSearchHit): unknown {
  return {
    documentId: hit.documentId,
    chunkId: hit.chunkId,
    title: hit.title,
    path: hit.path,
    ordinal: hit.ordinal,
    score: hit.score,
    matchedTerms: hit.matchedTerms,
    citation: hit.citation,
    text: hit.text
  };
}

function buildSourceReceipt(args: {
  problem: string;
  normalizedProblem: string;
  createdAt: string;
  trust: TrustLabel;
  summary: string;
  evidenceProfile: ReceiptEvidenceProfile;
  query: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
}): Receipt {
  const privacy = createLocalOnlyPrivacyMetadata();
  const runHash = stableHash({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    query: args.query,
    privacy,
    evidenceProfile: args.evidenceProfile,
    nodes: args.nodes.map(({ createdAt: _createdAt, ...node }) => node),
    edges: args.edges,
    artifacts: args.artifacts
  }).slice(0, 16);

  return {
    schemaVersion: "theorem.receipt.v0",
    runId: `run_${runHash}`,
    createdAt: args.createdAt,
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    trust: args.trust,
    summary: args.summary,
    replay: `theorem source cite ${JSON.stringify(args.problem.replace(/^source cite:\s*/, ""))} --query ${JSON.stringify(args.query)} --json`,
    privacy,
    evidenceProfile: args.evidenceProfile,
    graph: {
      nodes: args.nodes,
      edges: args.edges
    },
    artifacts: args.artifacts,
    findings: args.findings
  };
}

function createLocalOnlyPrivacyMetadata(): PrivacyMetadata {
  return {
    mode: "local-only",
    localFirst: true,
    networkAccess: "none",
    dataResidency: "local-workspace",
    externalDisclosures: []
  };
}

function addNode(
  nodes: GraphNode[],
  createdAt: string,
  input: Omit<GraphNode, "id" | "createdAt">
): GraphNode {
  const id = `node_${stableHash(input).slice(0, 16)}`;
  const node: GraphNode = {
    id,
    createdAt,
    ...input
  };
  nodes.push(node);
  return node;
}

function addArtifact(artifacts: Artifact[], input: Omit<Artifact, "id">): Artifact {
  const artifact: Artifact = {
    id: `artifact_${stableHash(input).slice(0, 16)}`,
    ...input
  };
  artifacts.push(artifact);
  return artifact;
}

function normalizeText(text: string | undefined): string {
  return text?.trim().replace(/\s+/g, " ") ?? "";
}
