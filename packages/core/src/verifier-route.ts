import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { getEngineManifest, type EngineCapability, type EngineManifest, type EngineManifestOptions } from "./engine-manifest.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { createReceipt, type CreateReceiptOptions } from "./receipt.js";
import { stableHash } from "./stable-hash.js";
import type { Receipt, ReceiptEvidenceProfile, TrustLabel } from "./types.js";

export type VerifierRouteStatus = "verified" | "refuted" | "unverified";
export type VerifierRouteStepStatus = "used" | "blocked" | "planned";
export type VerifierRouteGapSeverity = "info" | "warning" | "critical";

export interface CreateVerifierRouteOptions extends CreateReceiptOptions, EngineManifestOptions {}

export interface VerifierRouteStep {
  capabilityId: string;
  displayName: string;
  status: VerifierRouteStepStatus;
  capabilityStatus: EngineCapability["status"];
  strongestTrust: EngineCapability["strongestTrust"];
  canMintTrust: boolean;
  reason: string;
  command?: string;
  nextStep?: string;
}

export interface VerifierRouteGap {
  capabilityId: string;
  displayName: string;
  severity: VerifierRouteGapSeverity;
  reason: string;
  command?: string;
  nextStep?: string;
}

export type ProofObligationKind = "formal-proof" | "independent-check" | "solver-encoding" | "reproducibility";
export type ProofObligationStatus = "open" | "satisfied" | "not-required";

export interface ProofObligation {
  obligationId: string;
  kind: ProofObligationKind;
  status: ProofObligationStatus;
  severity: VerifierRouteGapSeverity;
  sourceCapabilityId: string;
  title: string;
  statement: string;
  requiredBefore: string;
  acceptanceCriteria: string[];
  command?: string;
  nextStep?: string;
}

export interface VerifierRoute {
  schemaVersion: "theorem.verifier-route.v0";
  routeId: string;
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  problem: string;
  normalizedProblem: string;
  status: VerifierRouteStatus;
  finalTrust: TrustLabel;
  evidenceKind: ReceiptEvidenceProfile["kind"];
  receipt: Receipt;
  replay: string;
  manifest: {
    schemaVersion: EngineManifest["schemaVersion"];
    status: EngineManifest["status"];
    readyCount: number;
    totalCount: number;
    nativeCount: number;
    adapterCount: number;
    plannedCount: number;
  };
  usedCapabilities: VerifierRouteStep[];
  blockedCapabilities: VerifierRouteStep[];
  plannedCapabilities: VerifierRouteStep[];
  gaps: VerifierRouteGap[];
  proofObligations: ProofObligation[];
  nextActions: string[];
  trustBoundary: EngineManifest["trustBoundary"] & {
    routeIsNotProof: true;
    receiptTrustIsUpperBound: true;
  };
  warnings: string[];
}

export interface WriteVerifierRouteInput extends CreateVerifierRouteOptions {
  rootPath: string;
  problem: string;
}

export interface VerifierRouteWriteResult {
  route: VerifierRoute;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface VerifierRouteSummary {
  path: string;
  routeId: string;
  createdAt: string;
  problem: string;
  finalTrust: TrustLabel;
  status: VerifierRouteStatus;
  evidenceKind: ReceiptEvidenceProfile["kind"];
  receiptRunId: string;
  usedCapabilities: string[];
  gaps: number;
  criticalGaps: number;
  proofObligations: number;
  nextActions: string[];
}

export function createVerifierRoute(problem: string, options: CreateVerifierRouteOptions = {}): VerifierRoute {
  const createdAt = (options.now ?? new Date()).toISOString();
  const manifest = getEngineManifest(options);
  const receipt = createReceipt(problem, options);
  const capabilityById = new Map(manifest.capabilities.map((capability) => [capability.id, capability]));
  const usedCapabilityIds = capabilityIdsForReceipt(receipt);
  const usedCapabilities = usedCapabilityIds.map((capabilityId) =>
    routeStep(capabilityById, capabilityId, "used", usedReason(receipt, capabilityId))
  );
  const blockedCapabilities = blockedCapabilityIdsForReceipt(receipt)
    .filter((capabilityId) => !usedCapabilityIds.includes(capabilityId))
    .map((capabilityId) => routeStep(capabilityById, capabilityId, "blocked", blockedReason(receipt, capabilityId)))
    .filter((step) => step.capabilityStatus !== "available" && step.capabilityStatus !== "ready");
  const plannedCapabilities = manifest.capabilities
    .filter((capability) => capability.kind === "planned-adapter" && plannedCapabilityApplies(receipt, capability))
    .map((capability) => routeStep(capabilityById, capability.id, "planned", "Planned adapter is relevant but cannot support this route yet."));
  const gaps = routeGaps(receipt, [...blockedCapabilities, ...plannedCapabilities]);
  const nextActions = nextRouteActions(receipt, gaps);
  const routeId = `route_${stableHash({
    problem,
    receipt: receipt.runId,
    finalTrust: receipt.trust,
    evidenceKind: receipt.evidenceProfile.kind,
    createdAt
  }).slice(0, 16)}`;

  return {
    schemaVersion: "theorem.verifier-route.v0",
    routeId,
    createdAt,
    localOnly: true,
    networkAccess: "none",
    problem,
    normalizedProblem: receipt.normalizedProblem,
    status: receipt.trust === "refuted" ? "refuted" : receipt.trust === "unverified" ? "unverified" : "verified",
    finalTrust: receipt.trust,
    evidenceKind: receipt.evidenceProfile.kind,
    receipt,
    replay: `theorem verify ${quoteCommandArg(problem)} --json`,
    manifest: {
      schemaVersion: manifest.schemaVersion,
      status: manifest.status,
      readyCount: manifest.readyCount,
      totalCount: manifest.totalCount,
      nativeCount: manifest.nativeCount,
      adapterCount: manifest.adapterCount,
      plannedCount: manifest.plannedCount
    },
    usedCapabilities,
    blockedCapabilities,
    plannedCapabilities,
    gaps,
    proofObligations: proofObligationsForRoute({
      routeId,
      problem,
      receipt,
      gaps
    }),
    nextActions,
    trustBoundary: {
      ...manifest.trustBoundary,
      routeIsNotProof: true,
      receiptTrustIsUpperBound: true
    },
    warnings: [...manifest.warnings, ...receipt.findings.filter((finding) => finding.level !== "info").map((finding) => finding.message)]
  };
}

export async function writeVerifierRoute(input: WriteVerifierRouteInput): Promise<VerifierRouteWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const route = createVerifierRoute(input.problem, {
    timeoutMs: input.timeoutMs,
    maximaCommand: input.maximaCommand,
    leanCommand: input.leanCommand,
    z3Command: input.z3Command,
    now: input.now,
    casRunner: input.casRunner
  });
  const routesDir = resolve(status.root, status.manifest.directories.routes);
  await mkdir(routesDir, { recursive: true });

  const baseName = `${route.createdAt.slice(0, 10)}-${route.routeId}`;
  const jsonPath = join(routesDir, `${baseName}.json`);
  const markdownPath = join(routesDir, `${baseName}.md`);
  const markdown = renderVerifierRouteMarkdown(route);

  await writeFile(jsonPath, `${JSON.stringify(route, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdown, "utf8");

  return {
    route,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listVerifierRoutes(rootPath: string): Promise<VerifierRouteSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const routesDir = resolve(status.root, status.manifest.directories.routes);

  let files: string[];
  try {
    files = await readdir(routesDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const summaries = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const path = join(routesDir, file);
        return summarizeVerifierRoute(status.root, path, await readFile(path, "utf8"));
      })
  );

  return summaries
    .filter((summary): summary is VerifierRouteSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function readVerifierRoute(rootPath: string, routeRef: string): Promise<VerifierRoute> {
  const status = await requireLocalWorkspace(rootPath);
  let path: string;

  if (/^route_[a-f0-9]{16}$/u.test(routeRef)) {
    const route = (await listVerifierRoutes(status.root)).find((summary) => summary.routeId === routeRef);
    if (!route) {
      throw new Error(`No verifier route found for id ${routeRef}.`);
    }
    path = resolve(status.root, route.path);
  } else {
    path = resolveWorkspacePath(status.root, routeRef);
  }

  return parseVerifierRouteJson(await readFile(path, "utf8"), path);
}

export function renderVerifierRouteMarkdown(route: VerifierRoute): string {
  const lines = [
    `# Verifier Route ${route.routeId}`,
    "",
    `Status: \`${route.status}\``,
    `Final trust: \`${route.finalTrust}\``,
    `Evidence kind: \`${route.evidenceKind}\``,
    `Created: ${route.createdAt}`,
    `Privacy: local-only (network: none)`,
    "",
    "## Problem",
    "",
    route.problem,
    "",
    "## Receipt",
    "",
    `- Run: \`${route.receipt.runId}\``,
    `- Trust: \`${route.receipt.trust}\``,
    `- Replay: \`${route.receipt.replay}\``,
    "",
    "## Route Replay",
    "",
    `\`${route.replay}\``,
    "",
    "## Used Capabilities",
    ""
  ];

  pushRouteSteps(lines, route.usedCapabilities);

  lines.push("", "## Proof Obligations", "");
  const proofObligations = route.proofObligations ?? [];
  if (proofObligations.length === 0) {
    lines.push("- none");
  } else {
    for (const obligation of proofObligations) {
      lines.push(`- ${obligation.status}: ${obligation.title} (${obligation.obligationId})`);
      lines.push(`  - Statement: ${obligation.statement}`);
      lines.push(`  - Required before: ${obligation.requiredBefore}`);
      if (obligation.nextStep) {
        lines.push(`  - Next: ${obligation.nextStep}`);
      }
      if (obligation.command) {
        lines.push(`  - Command: \`${obligation.command}\``);
      }
      for (const criterion of obligation.acceptanceCriteria) {
        lines.push(`  - Accept: ${criterion}`);
      }
    }
  }

  lines.push("", "## Verification Gaps", "");
  if (route.gaps.length === 0) {
    lines.push("- none");
  } else {
    for (const gap of route.gaps) {
      lines.push(`- ${gap.severity}: ${gap.displayName} - ${gap.reason}`);
      if (gap.nextStep) {
        lines.push(`  - Next: ${gap.nextStep}`);
      }
      if (gap.command) {
        lines.push(`  - Command: \`${gap.command}\``);
      }
    }
  }

  lines.push("", "## Next Actions", "");
  pushStringList(lines, route.nextActions);

  if (route.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    pushStringList(lines, route.warnings);
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "- A verifier route explains which engines were used or missing. It is not a proof by itself.",
    "- The receipt trust label is an upper bound; stronger scientific, medical, safety, regulatory, or patent claims need the matching human and domain validation gates."
  );

  return `${lines.join("\n")}\n`;
}

function capabilityIdsForReceipt(receipt: Receipt): string[] {
  const mapped = receipt.evidenceProfile.backends
    .map((backend) => backendToCapabilityId(backend.id))
    .filter((capabilityId): capabilityId is string => Boolean(capabilityId));

  if (receipt.evidenceProfile.kind === "universal-parity" && receipt.trust !== "refuted") {
    mapped.push("finite-counterexample-search");
  }

  return unique(mapped);
}

function blockedCapabilityIdsForReceipt(receipt: Receipt): string[] {
  switch (receipt.evidenceProfile.kind) {
    case "symbolic-cas":
      return receipt.trust === "cross-checked"
        ? ["lean-proof-checker"]
        : ["maxima-cas", "lean-proof-checker"];
    case "universal-parity":
      return receipt.trust === "refuted" ? [] : ["lean-proof-checker", "z3-smt-solver"];
    case "unsupported":
      return ["lean-proof-checker", "z3-smt-solver", "maxima-cas"];
    case "interval-bound":
      return ["lean-proof-checker"];
    case "dimension-analysis":
      return [];
    case "exact-arithmetic":
      return [];
    case "source-citation":
      return ["local-vector-rag"];
  }
}

function routeStep(
  capabilityById: Map<string, EngineCapability>,
  capabilityId: string,
  status: VerifierRouteStepStatus,
  reason: string
): VerifierRouteStep {
  const capability = capabilityById.get(capabilityId) ?? missingCapability(capabilityId);
  return {
    capabilityId,
    displayName: capability.displayName,
    status,
    capabilityStatus: capability.status,
    strongestTrust: capability.strongestTrust,
    canMintTrust: capability.canMintTrust,
    reason,
    command: capability.command,
    nextStep: capability.nextStep
  };
}

function routeGaps(receipt: Receipt, steps: VerifierRouteStep[]): VerifierRouteGap[] {
  const gaps = steps.map((step): VerifierRouteGap => ({
    capabilityId: step.capabilityId,
    displayName: step.displayName,
    severity: gapSeverity(receipt, step),
    reason: step.reason,
    command: step.command,
    nextStep: step.nextStep
  }));

  if (receipt.trust !== "unverified" && !receipt.evidenceProfile.proofCheckerBacked && receipt.trust !== "refuted") {
    gaps.push({
      capabilityId: "accepted-proof-checker",
      displayName: "Accepted proof checker",
      severity: receipt.evidenceProfile.kind === "exact-arithmetic" ? "info" : "warning",
      reason: "The current receipt is replayable evidence, but not accepted proof-checker output.",
      command: "theorem proof check <workspace-local.lean> --write",
      nextStep: "Use Lean or another accepted proof checker before saying `proved`."
    });
  }

  return gaps;
}

function proofObligationsForRoute(input: {
  routeId: string;
  problem: string;
  receipt: Receipt;
  gaps: VerifierRouteGap[];
}): ProofObligation[] {
  return input.gaps.map((gap) => {
    const kind = obligationKind(gap);
    const requiredTrust = requiredTrustForGap(gap);
    const title = obligationTitle(gap, requiredTrust);
    const statement = obligationStatement(input.problem, input.receipt, gap, requiredTrust);
    const requiredBefore = requiredTrust
      ? `Before labeling this scoped claim ${requiredTrust}.`
      : "Before making a stronger claim than the current receipt supports.";

    return {
      obligationId: `obl_${stableHash({
        routeId: input.routeId,
        runId: input.receipt.runId,
        capabilityId: gap.capabilityId,
        statement,
        severity: gap.severity
      }).slice(0, 16)}`,
      kind,
      status: gap.severity === "info" ? "not-required" : "open",
      severity: gap.severity,
      sourceCapabilityId: gap.capabilityId,
      title,
      statement,
      requiredBefore,
      acceptanceCriteria: obligationAcceptanceCriteria(gap, requiredTrust),
      command: gap.command,
      nextStep: gap.nextStep
    };
  });
}

function obligationKind(gap: VerifierRouteGap): ProofObligationKind {
  if (gap.capabilityId.includes("proof") || gap.capabilityId === "accepted-proof-checker") {
    return "formal-proof";
  }

  if (gap.capabilityId.includes("smt") || gap.capabilityId.includes("z3")) {
    return "solver-encoding";
  }

  if (gap.capabilityId.includes("cas") || gap.capabilityId.includes("maxima")) {
    return "independent-check";
  }

  return "reproducibility";
}

function requiredTrustForGap(gap: VerifierRouteGap): TrustLabel | undefined {
  if (gap.capabilityId.includes("proof") || gap.capabilityId === "accepted-proof-checker") {
    return "proved";
  }

  if (gap.capabilityId.includes("smt") || gap.capabilityId.includes("z3")) {
    return "smt-checked";
  }

  if (gap.capabilityId.includes("cas") || gap.capabilityId.includes("maxima")) {
    return "cross-checked";
  }

  return undefined;
}

function obligationTitle(gap: VerifierRouteGap, requiredTrust: TrustLabel | undefined): string {
  if (requiredTrust === "proved") {
    return "Formal proof-checker obligation";
  }

  if (requiredTrust === "smt-checked") {
    return "SMT encoding obligation";
  }

  if (requiredTrust === "cross-checked") {
    return "Independent CAS cross-check obligation";
  }

  return `${gap.displayName} obligation`;
}

function obligationStatement(
  problem: string,
  receipt: Receipt,
  gap: VerifierRouteGap,
  requiredTrust: TrustLabel | undefined
): string {
  const scopedClaim = receipt.trust === "refuted"
    ? `The claim '${problem}' is refuted by the recorded counterexample.`
    : `The scoped claim '${problem}' currently has trust '${receipt.trust}'.`;

  if (requiredTrust === "proved") {
    return `${scopedClaim} To call it proved, attach an accepted proof-checker artifact for the exact formal statement.`;
  }

  if (requiredTrust === "smt-checked") {
    return `${scopedClaim} To call it SMT-checked, attach a concrete solver run for the exact encoded constraints and assumptions.`;
  }

  if (requiredTrust === "cross-checked") {
    return `${scopedClaim} To call it cross-checked, attach an independent CAS agreement run for the exact expression and assumptions.`;
  }

  return `${scopedClaim} Resolve ${gap.displayName}: ${gap.reason}`;
}

function obligationAcceptanceCriteria(gap: VerifierRouteGap, requiredTrust: TrustLabel | undefined): string[] {
  const criteria = [
    "The artifact is stored locally in the workspace and can be replayed.",
    "The artifact records backend, version, input, output, command, and limitations.",
    "The reviewed claim does not exceed the exact statement checked by the artifact."
  ];

  if (requiredTrust === "proved") {
    criteria.unshift("An accepted proof checker returns success for a concrete proof artifact.");
  } else if (requiredTrust === "smt-checked") {
    criteria.unshift("A concrete SMT solver run returns sat or unsat for the recorded SMT-LIB problem.");
  } else if (requiredTrust === "cross-checked") {
    criteria.unshift("An independent CAS agrees with the recorded result on the same scoped expression.");
  } else if (gap.command) {
    criteria.unshift(`The recorded command succeeds: ${gap.command}`);
  }

  return criteria;
}

function nextRouteActions(receipt: Receipt, gaps: VerifierRouteGap[]): string[] {
  if (receipt.trust === "refuted") {
    return [
      "Record the counterexample as the final narrow claim.",
      "Use the claim ledger if a downstream result depended on the refuted statement."
    ];
  }

  const actions = gaps
    .filter((gap) => gap.severity !== "info")
    .map((gap) => gap.nextStep ?? gap.command ?? `Resolve ${gap.displayName}.`);

  if (actions.length > 0) {
    return unique(actions).slice(0, 5);
  }

  if (receipt.trust === "unverified") {
    return [
      "Keep the claim unverified.",
      "Narrow the prompt or add a concrete proof, SMT, CAS, source, or simulation artifact."
    ];
  }

  return [
    "Record this as a narrow evidence-backed claim.",
    "Do not generalize beyond the receipt inputs, outputs, and limitations."
  ];
}

function usedReason(receipt: Receipt, capabilityId: string): string {
  if (capabilityId === "finite-counterexample-search" && receipt.trust === "refuted") {
    return "Found a concrete exact counterexample.";
  }

  if (capabilityId === "maxima-cas" && receipt.trust === "cross-checked") {
    return "Independent Maxima run agreed with the local symbolic result.";
  }

  return `Supported the ${receipt.evidenceProfile.kind} receipt with trust ${receipt.trust}.`;
}

function blockedReason(receipt: Receipt, capabilityId: string): string {
  if (capabilityId === "maxima-cas") {
    return "Independent CAS agreement is required before symbolic results become cross-checked.";
  }

  if (capabilityId === "lean-proof-checker") {
    return receipt.trust === "unverified"
      ? "A formal proof checker is the next credible route for this unresolved claim."
      : "The current result is not an accepted proof-checker run, so it must not be labeled proved.";
  }

  if (capabilityId === "z3-smt-solver") {
    return "A concrete SMT-LIB run could support bounded logic or satisfiability claims, but no solver-backed record exists yet.";
  }

  if (capabilityId === "local-vector-rag") {
    return "Lexical source search exists, but vector/PDF citation and contradiction checks are not implemented yet.";
  }

  return `Capability ${capabilityId} was not available for this route.`;
}

function gapSeverity(receipt: Receipt, step: VerifierRouteStep): VerifierRouteGapSeverity {
  if (receipt.trust === "unverified") {
    return "critical";
  }

  if (step.status === "planned") {
    return "info";
  }

  return "warning";
}

function plannedCapabilityApplies(receipt: Receipt, capability: EngineCapability): boolean {
  if (receipt.evidenceProfile.kind === "unsupported") {
    return ["math", "sources", "physics/bio/engineering"].includes(capability.lane);
  }

  if (receipt.evidenceProfile.kind === "symbolic-cas" || receipt.evidenceProfile.kind === "universal-parity") {
    return capability.lane === "math";
  }

  if (receipt.evidenceProfile.kind === "source-citation") {
    return capability.lane === "sources";
  }

  return capability.id === "rigorous-numerics" && receipt.evidenceProfile.kind === "interval-bound";
}

function backendToCapabilityId(backendId: string): string | undefined {
  const mapped = new Map<string, string>([
    ["finite-counterexample-search", "finite-counterexample-search"],
    ["local-rational-arithmetic", "local-rational-arithmetic"],
    ["local-modular-parity-checker", "local-mod2-parity-kernel"],
    ["local-dimensional-analysis", "local-dimensional-analysis"],
    ["local-rational-interval-arithmetic", "rational-interval-bounds"],
    ["local-sympy-subprocess", "sympy-symbolic-adapter"],
    ["local-maxima-symbolic-subprocess", "maxima-cas"]
  ]);

  return mapped.get(backendId);
}

function missingCapability(capabilityId: string): EngineCapability {
  return {
    id: capabilityId,
    displayName: capabilityId,
    kind: "planned-adapter",
    lane: "unknown",
    status: "missing",
    role: "unknown",
    localOnly: true,
    networkAccess: "unknown",
    strongestTrust: "none",
    canMintTrust: false,
    statusProbeMintedEvidence: false,
    trustBoundary: "Capability was referenced by a route but is not present in the manifest.",
    limitations: ["Missing from engine manifest."]
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function pushRouteSteps(lines: string[], steps: VerifierRouteStep[]): void {
  if (steps.length === 0) {
    lines.push("- none");
    return;
  }

  for (const step of steps) {
    lines.push(`- ${step.displayName} (${step.capabilityId}) - ${step.reason}`);
    if (step.command) {
      lines.push(`  - Command: \`${step.command}\``);
    }
  }
}

function pushStringList(lines: string[], values: string[]): void {
  if (values.length === 0) {
    lines.push("- none");
    return;
  }

  for (const value of values) {
    lines.push(`- ${value}`);
  }
}

function summarizeVerifierRoute(root: string, path: string, raw: string): VerifierRouteSummary | undefined {
  let route: VerifierRoute;
  try {
    route = parseVerifierRouteJson(raw, path);
  } catch {
    return undefined;
  }

  return {
    path: toPortablePath(relative(root, path)),
    routeId: route.routeId,
    createdAt: route.createdAt,
    problem: route.problem,
    finalTrust: route.finalTrust,
    status: route.status,
    evidenceKind: route.evidenceKind,
    receiptRunId: route.receipt.runId,
    usedCapabilities: route.usedCapabilities.map((step) => step.capabilityId),
    gaps: route.gaps.length,
    criticalGaps: route.gaps.filter((gap) => gap.severity === "critical").length,
    proofObligations: route.proofObligations?.length ?? 0,
    nextActions: route.nextActions
  };
}

function parseVerifierRouteJson(raw: string, sourcePath: string): VerifierRoute {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`Verifier route JSON must be an object: ${sourcePath}.`);
  }

  if (parsed.schemaVersion !== "theorem.verifier-route.v0") {
    throw new Error(`Unsupported verifier route schema in ${sourcePath}: ${JSON.stringify(parsed.schemaVersion)}.`);
  }

  if (typeof parsed.routeId !== "string") {
    throw new Error(`Verifier route is missing routeId: ${sourcePath}.`);
  }

  return parsed as unknown as VerifierRoute;
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/.test(value) ? value : JSON.stringify(value);
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Theorem workspace found. Run `theorem workspace init` before writing verifier route records.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function resolveWorkspacePath(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace root: ${path}`);
  }

  return target;
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
