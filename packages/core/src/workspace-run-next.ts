import { relative, resolve } from "node:path";
import { createClaimReviewPacket } from "./claim-ledger.js";
import { writeSymbolicCasCheckRecord } from "./cas-backend.js";
import { writeLeanProofCheckRecord } from "./proof-backend.js";
import { readResearchSession } from "./research-session.js";
import { writeSmtCheckRecord } from "./smt-backend.js";
import type { SympyOperation } from "./sympy.js";
import {
  readVerifierRoute,
  satisfyVerifierRouteObligation,
  type SatisfyVerifierRouteObligationResult,
  type VerifierRouteEvidenceRef
} from "./verifier-route.js";
import type { WorkspaceReview, WorkspaceReviewItem } from "./workspace-review.js";

export type WorkspaceRunNextStatus = "planned" | "executed" | "blocked";

export interface WorkspaceRunNextPlan {
  schemaVersion: "truth-harness.workspace-run-next.v0";
  createdAt: string;
  workspacePath: string;
  localOnly: true;
  networkAccess: "none";
  dryRun: boolean;
  status: WorkspaceRunNextStatus;
  mode: WorkspaceReview["autonomy"]["mode"];
  reviewId: string;
  item?: Pick<
    WorkspaceReviewItem,
    | "itemId"
    | "kind"
    | "priority"
    | "title"
    | "summary"
    | "command"
    | "routeId"
    | "obligationId"
    | "obligationKind"
    | "claimId"
    | "sessionId"
  >;
  execution: {
    status: WorkspaceRunNextStatus;
    kind: string;
    summary: string;
    command?: string;
    evidenceRef?: string;
    attached?: boolean;
    result?: unknown;
  };
  stopConditions: string[];
  warnings: string[];
}

export async function createWorkspaceRunNextPlan(input: {
  rootPath: string;
  review: WorkspaceReview;
  executeLocal: boolean;
  now?: string;
}): Promise<WorkspaceRunNextPlan> {
  const createdAt = input.now ?? new Date().toISOString();
  const nextItem = input.review.items.find((item) => item.itemId === input.review.autonomy.nextItemId) ?? input.review.items[0];
  const basePlan: WorkspaceRunNextPlan = {
    schemaVersion: "truth-harness.workspace-run-next.v0",
    createdAt,
    workspacePath: input.rootPath,
    localOnly: true,
    networkAccess: "none",
    dryRun: !input.executeLocal,
    status: "planned",
    mode: input.review.autonomy.mode,
    reviewId: input.review.reviewId,
    item: nextItem ? workspaceRunNextItemSummary(nextItem) : undefined,
    execution: {
      status: "planned",
      kind: "dry-run",
      summary: nextItem
        ? "Dry-run only. Re-run with --execute-local to run one supported local Truth Harness action."
        : "No open workspace review item is available."
    },
    stopConditions: input.review.autonomy.stopConditions,
    warnings: [
      "Run-next never executes shell strings. Only supported local Truth Harness actions can run.",
      "Execution can create evidence artifacts, but trust labels change only when matching obligations accept those artifacts."
    ]
  };

  if (!nextItem) {
    return {
      ...basePlan,
      status: "blocked",
      execution: {
        status: "blocked",
        kind: "no-open-item",
        summary: "No open local work item is available."
      }
    };
  }

  if (!input.executeLocal) {
    return basePlan;
  }

  if (!input.review.autonomy.canRunUnattended) {
    return {
      ...basePlan,
      status: "blocked",
      execution: {
        status: "blocked",
        kind: "autonomy-contract",
        command: nextItem.command,
        summary: "The autonomy contract does not allow unattended local work."
      }
    };
  }

  const execution = await executeWorkspaceRunNextItem(input.rootPath, nextItem);
  return {
    ...basePlan,
    status: execution.status,
    execution
  };
}

function workspaceRunNextItemSummary(item: WorkspaceReviewItem): WorkspaceRunNextPlan["item"] {
  return {
    itemId: item.itemId,
    kind: item.kind,
    priority: item.priority,
    title: item.title,
    summary: item.summary,
    command: item.command,
    routeId: item.routeId,
    obligationId: item.obligationId,
    obligationKind: item.obligationKind,
    claimId: item.claimId,
    sessionId: item.sessionId
  };
}

async function executeWorkspaceRunNextItem(
  rootPath: string,
  item: WorkspaceReviewItem
): Promise<WorkspaceRunNextPlan["execution"]> {
  const parsed = parseLocalTruthHarnessCommand(item.command);
  if (!parsed.ok) {
    return {
      status: "blocked",
      kind: "unsupported-command",
      command: item.command,
      summary: parsed.reason
    };
  }

  const [group, action, ...rest] = parsed.args;
  const options = commandOptionMap(parsed.args);
  const workspace = rootPath;
  const timeoutMs = parseOptionalPositiveIntegerOption(options["timeout-ms"], 3000);

  try {
    if (group === "claim" && action === "review") {
      const claimRef = rest[0];
      if (!claimRef) {
        throw new Error("Missing claim ref for claim review.");
      }
      const packet = await createClaimReviewPacket({ rootPath: workspace, claimRef });
      return {
        status: "executed",
        kind: "claim-review",
        command: item.command,
        summary: `Created claim review packet for ${packet.claimId}.`,
        result: packet
      };
    }

    if (group === "route" && action === "show") {
      const routeRef = rest[0];
      if (!routeRef) {
        throw new Error("Missing route ref for route show.");
      }
      const route = await readVerifierRoute(workspace, routeRef);
      return {
        status: "executed",
        kind: "route-show",
        command: item.command,
        summary: `Read verifier route ${route.routeId}.`,
        result: route
      };
    }

    if (group === "research" && action === "show") {
      const sessionRef = rest[0];
      if (!sessionRef) {
        throw new Error("Missing session ref for research show.");
      }
      const session = await readResearchSession(workspace, sessionRef);
      return {
        status: "executed",
        kind: "research-show",
        command: item.command,
        summary: `Read research session ${session.sessionId}.`,
        result: session
      };
    }

    if (group === "proof" && action === "check") {
      const sourcePath = rest[0];
      if (!sourcePath || sourcePath.includes("<") || sourcePath.includes(">")) {
        return blockedPlaceholderCommand(item.command, "proof-check");
      }
      const result = await writeLeanProofCheckRecord({
        rootPath: workspace,
        sourcePath,
        declarationName: typeof options.declaration === "string" ? options.declaration : undefined,
        leanCommand: typeof options["lean-command"] === "string" ? options["lean-command"] : undefined,
        timeoutMs
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const attachment = await maybeAttachRouteEvidence(workspace, item, {
        kind: "proof",
        ref: evidenceRef,
        trust: result.record.trust,
        summary: result.record.status
      });
      return {
        status: "executed",
        kind: "proof-check",
        command: item.command,
        evidenceRef: `proof:${evidenceRef}`,
        attached: attachment.attached,
        summary: attachment.summary,
        result: { proof: result.record, attachment: attachment.result }
      };
    }

    if (group === "smt" && action === "check") {
      const sourcePath = rest[0];
      if (!sourcePath || sourcePath.includes("<") || sourcePath.includes(">")) {
        return blockedPlaceholderCommand(item.command, "smt-check");
      }
      const result = await writeSmtCheckRecord({
        rootPath: workspace,
        sourcePath,
        queryName: typeof options.query === "string" ? options.query : undefined,
        z3Command: typeof options["z3-command"] === "string" ? options["z3-command"] : undefined,
        timeoutMs
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const attachment = await maybeAttachRouteEvidence(workspace, item, {
        kind: "smt",
        ref: evidenceRef,
        trust: result.record.trust,
        summary: result.record.status
      });
      return {
        status: "executed",
        kind: "smt-check",
        command: item.command,
        evidenceRef: `smt:${evidenceRef}`,
        attached: attachment.attached,
        summary: attachment.summary,
        result: { smt: result.record, attachment: attachment.result }
      };
    }

    if (group === "cas" && action === "check") {
      const operation = options.operation;
      const expression = options.expression;
      const resultText = options.result;
      if (typeof operation !== "string" || typeof expression !== "string" || typeof resultText !== "string") {
        return {
          status: "blocked",
          kind: "cas-check",
          command: item.command,
          summary: "CAS check execution requires --operation, --expression, and --result."
        };
      }
      const result = await writeSymbolicCasCheckRecord({
        rootPath: workspace,
        prompt: {
          operation: parseSympyOperation(operation),
          expression,
          variable: typeof options.variable === "string" ? options.variable : "x"
        },
        result: resultText,
        maximaCommand: typeof options["maxima-command"] === "string" ? options["maxima-command"] : undefined,
        timeoutMs
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const attachment = await maybeAttachRouteEvidence(workspace, item, {
        kind: "cas",
        ref: evidenceRef,
        trust: result.record.trust,
        summary: result.record.status
      });
      return {
        status: "executed",
        kind: "cas-check",
        command: item.command,
        evidenceRef: `cas:${evidenceRef}`,
        attached: attachment.attached,
        summary: attachment.summary,
        result: { cas: result.record, attachment: attachment.result }
      };
    }
  } catch (error) {
    return {
      status: "blocked",
      kind: `${group ?? "unknown"}-${action ?? "unknown"}`,
      command: item.command,
      summary: error instanceof Error ? error.message : "Local action failed."
    };
  }

  return {
    status: "blocked",
    kind: `${group ?? "unknown"}-${action ?? "unknown"}`,
    command: item.command,
    summary: "This Truth Harness command is not yet supported by workspace run-next execution."
  };
}

function blockedPlaceholderCommand(command: string, kind: string): WorkspaceRunNextPlan["execution"] {
  return {
    status: "blocked",
    kind,
    command,
    summary: "The next command contains a placeholder path. Prepare a concrete workspace-local artifact before executing it."
  };
}

async function maybeAttachRouteEvidence(
  workspace: string,
  item: WorkspaceReviewItem,
  evidenceRef: VerifierRouteEvidenceRef
): Promise<{ attached: boolean; summary: string; result?: SatisfyVerifierRouteObligationResult }> {
  if (!item.routeId || !item.obligationId) {
    return {
      attached: false,
      summary: `Wrote ${evidenceRef.kind}:${evidenceRef.ref}. No route obligation target was present, so nothing was attached.`
    };
  }

  try {
    const result = await satisfyVerifierRouteObligation({
      rootPath: workspace,
      routeRef: item.routeId,
      obligationId: item.obligationId,
      evidenceRef
    });
    return {
      attached: true,
      summary: result.message,
      result
    };
  } catch (error) {
    return {
      attached: false,
      summary: `Wrote ${evidenceRef.kind}:${evidenceRef.ref}, but did not close ${item.obligationId}: ${
        error instanceof Error ? error.message : "attachment failed"
      }`
    };
  }
}

function parseLocalTruthHarnessCommand(command: string): { ok: true; args: string[] } | { ok: false; reason: string } {
  try {
    const tokens = splitLocalCommand(command);
    if (tokens[0] !== "truth-harness") {
      return { ok: false, reason: "Only truth-harness commands can be executed by workspace run-next." };
    }

    return { ok: true, args: tokens.slice(1) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Could not parse local command."
    };
  }
}

function splitLocalCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "\"" | undefined;
  let escaping = false;

  for (const character of command) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (quote) {
      if (character === "\\") {
        escaping = true;
        continue;
      }
      if (character === quote) {
        quote = undefined;
      } else {
        current += character;
      }
      continue;
    }

    if (character === "\"") {
      quote = character;
      continue;
    }

    if (/[;&|<>`$]/u.test(character)) {
      throw new Error(`Unsupported shell metacharacter ${JSON.stringify(character)} in local command.`);
    }

    if (/\s/u.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (escaping) {
    throw new Error("Command ended with an incomplete escape.");
  }
  if (quote) {
    throw new Error("Command ended with an unterminated quote.");
  }
  if (current) {
    tokens.push(current);
  }
  if (tokens.length === 0) {
    throw new Error("Empty local command.");
  }

  return tokens;
}

function commandOptionMap(args: string[]): Record<string, string | true> {
  const options: Record<string, string | true> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const name = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[name] = true;
      continue;
    }

    options[name] = next;
    index += 1;
  }

  return options;
}

function parseOptionalPositiveIntegerOption(value: string | true | undefined, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${JSON.stringify(value)}.`);
  }

  return parsed;
}

function parseSympyOperation(value: string): SympyOperation {
  if (
    value === "simplify" ||
    value === "factor" ||
    value === "expand" ||
    value === "differentiate" ||
    value === "integrate"
  ) {
    return value;
  }

  throw new Error(
    `Unsupported symbolic operation ${JSON.stringify(value)}. Use simplify, factor, expand, differentiate, or integrate.`
  );
}

function workspaceLocalRef(rootPath: string, path: string): string {
  return relative(resolve(rootPath), resolve(path)).replace(/\\/gu, "/");
}
