import { describe, expect, it } from "vitest";
import { summarizeSympyCheckStatus } from "./sympy-check.js";
import type { SympyCheck } from "./sympy.js";

describe("summarizeSympyCheckStatus", () => {
  it("passes only when every symbolic sanity check passes", () => {
    const checks: SympyCheck[] = [
      { id: "symbolic-equivalence", status: "passed", detail: "ok" },
      { id: "numeric-sample-equivalence", status: "passed", detail: "ok" }
    ];

    expect(summarizeSympyCheckStatus(checks)).toBe("passed");
  });

  it("warns when checks are absent or inconclusive", () => {
    expect(summarizeSympyCheckStatus([])).toBe("warning");
    expect(summarizeSympyCheckStatus([{ id: "numeric", status: "warning", detail: "few samples" }])).toBe("warning");
  });

  it("fails closed when any sanity check fails", () => {
    const checks: SympyCheck[] = [
      { id: "symbolic-equivalence", status: "passed", detail: "ok" },
      { id: "numeric-sample-equivalence", status: "failed", detail: "sample mismatch" }
    ];

    expect(summarizeSympyCheckStatus(checks)).toBe("failed");
  });
});
