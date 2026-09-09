import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { scanRequest, scanSource } from "./prefix-scan.mjs";

const request = JSON.parse(readFileSync(new URL("../docs/examples/prefix-scan.json", import.meta.url), "utf8"));
it("computes bounded candidate prefixes with exact signed integers", () => {
  expect(scanRequest(request).results).toEqual({ prefixes: ["5", "7", "16"], count: "3",
    scan_additions: "5", scan_cons_cells: "3" });
  expect(scanRequest({ ...request, offset: "-999999", tree: { value: "-999999" } }).results.prefixes).toEqual(["-1999998"]);
  expect(scanRequest({ ...request, offset: "0", tree: { value: "0" } }).results).toEqual({ prefixes: ["0"], count: "1",
    scan_additions: "1", scan_cons_cells: "1" });
});
it("rejects unknown fields, versions, expressions and invalid integer encodings", () => {
  for (const bad of [null, [], {}, { ...request, extra: 1 }, { ...request, schema_version: "future" },
    { ...request, tree: { value: "1", total: "1" } }, { ...request, tree: null }]) {
    expect(() => scanRequest(bad)).toThrow();
  }
  for (const offset of [1, "01", "-0", "+1", "1\n", " 1", "1000000", "1 := by decide", "1.0"]) {
    expect(() => scanRequest({ ...request, offset })).toThrow();
    expect(() => scanRequest({ ...request, tree: { value: offset } })).toThrow();
  }
});
it("retains tree size and depth limits and emits fixed Lean declarations", () => {
  const balanced = h => h === 0 ? { value: "1" } : { left: balanced(h - 1), right: balanced(h - 1) };
  const skew = h => h === 0 ? { value: "1" } : { left: { value: "1" }, right: skew(h - 1) };
  expect(scanRequest({ ...request, tree: balanced(6) }).results.count).toBe("64");
  expect(() => scanRequest({ ...request, tree: balanced(7) })).toThrow();
  expect(scanRequest({ ...request, tree: skew(8) }).results.count).toBe("9");
  expect(() => scanRequest({ ...request, tree: skew(9) })).toThrow();
  const source = scanSource(request, "import Std\n");
  expect(source).toContain("theorem concrete_prefix_scan");
  expect(source).toContain("exact cached_prefix_evaluation_correct");
  expect(source).toContain("submittedScan.output = [(5 : Int), (7 : Int), (16 : Int)]");
  expect(source).not.toMatch(/\b(sorry|admit|native_decide)\b/);
});
