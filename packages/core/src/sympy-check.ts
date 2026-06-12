import type { SympyCheck } from "./sympy.js";

export type SympyCheckAggregateStatus = "passed" | "warning" | "failed";

export function summarizeSympyCheckStatus(checks: readonly SympyCheck[]): SympyCheckAggregateStatus {
  if (checks.some((check) => check.status === "failed")) {
    return "failed";
  }

  if (checks.length === 0 || checks.some((check) => check.status === "warning")) {
    return "warning";
  }

  return "passed";
}
