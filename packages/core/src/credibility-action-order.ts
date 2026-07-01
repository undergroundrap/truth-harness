import type { CredibilityPack } from "./credibility-pack.js";

type CredibilityAction = CredibilityPack["reviewerActionPlan"]["actions"][number];

export function orderCredibilityActionsForRunNext(
  actions: CredibilityPack["reviewerActionPlan"]["actions"]
): CredibilityPack["reviewerActionPlan"]["actions"] {
  return actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const priorityDelta =
        credibilityActionPriorityRank(left.action.priority) - credibilityActionPriorityRank(right.action.priority);
      if (priorityDelta !== 0) return priorityDelta;

      const actionabilityDelta =
        credibilityActionLocalFirstRank(left.action.command) - credibilityActionLocalFirstRank(right.action.command);
      if (actionabilityDelta !== 0) return actionabilityDelta;

      return left.index - right.index;
    })
    .map((entry) => entry.action);
}

function credibilityActionPriorityRank(priority: CredibilityAction["priority"]): number {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
  }
}

function credibilityActionLocalFirstRank(command: string): number {
  const normalized = command.trim();
  if (/^truth-harness\s+verify\b/u.test(normalized)) return 0;
  if (/^truth-harness\s+bench\s+(?:run|compare)\b/u.test(normalized)) return 1;
  if (/^truth-harness\s+validation\s+attach\b/u.test(normalized)) return 2;
  if (/^truth-harness\s+claim\s+(?:add|review)\b/u.test(normalized)) return 3;
  if (/^truth-harness\s+review\s+log\b/u.test(normalized)) return 4;
  if (/^truth-harness\s+(?:smt|cas|proof)\s+check\b/u.test(normalized)) return 5;
  if (/^truth-harness\s+engines\s+verify\b/u.test(normalized)) return 6;
  if (/^(?:npm\s+run\s+docker:[\w:-]+|docker\s+compose\s+run)\b/u.test(normalized)) return 8;
  return 9;
}
