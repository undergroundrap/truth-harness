import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveContainedPath } from "./path-containment.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe("canonical path containment", () => {
  it("allows existing and new paths inside the root, including internal ancestor links", () => {
    const { root } = fixture();
    mkdirSync(join(root, "inside"));
    writeFileSync(join(root, "inside", "file.txt"), "inside");
    directoryLink(join(root, "inside"), join(root, "alias"));
    expect(resolveContainedPath(root, "alias/file.txt")).toBe(join(realpathSync(root), "inside", "file.txt"));
    expect(resolveContainedPath(root, "alias/new/deep/file.txt")).toBe(join(realpathSync(root), "inside", "new", "deep", "file.txt"));
    expect(resolveContainedPath(root, "new/deep/file.txt")).toBe(join(realpathSync(root), "new", "deep", "file.txt"));
  });

  it("rejects sibling-prefix paths and escaping ancestors for existing and new targets", () => {
    const { root, outside } = fixture();
    writeFileSync(join(outside, "file.txt"), "outside");
    directoryLink(outside, join(root, "escape"));
    expect(() => resolveContainedPath(root, "../workspace-other/file.txt")).toThrow("Path escapes workspace root");
    expect(() => resolveContainedPath(root, "escape/file.txt")).toThrow("Path escapes workspace root");
    expect(() => resolveContainedPath(root, "escape/new/deep/file.txt")).toThrow("Path escapes workspace root");
  });

  it("accepts a trusted linked root but rejects dangling links", () => {
    const { root, outside } = fixture();
    const alias = join(outside, "root-alias");
    directoryLink(root, alias);
    const contained = resolveContainedPath(alias, "new/file.txt");
    expect(contained).toBe(join(realpathSync(root), "new", "file.txt"));
    expect(resolveContainedPath(alias, contained)).toBe(contained);
    directoryLink(join(outside, "missing"), join(root, "dangling"));
    expect(() => resolveContainedPath(root, "dangling/file.txt")).toThrow();
  });
});

function fixture() {
  const temp = mkdtempSync(join(tmpdir(), "truth-harness-containment-"));
  roots.push(temp);
  const root = join(temp, "workspace");
  const outside = join(temp, "workspace-other");
  mkdirSync(root);
  mkdirSync(outside);
  return { root, outside };
}

function directoryLink(target: string, path: string) {
  symlinkSync(target, path, process.platform === "win32" ? "junction" : "dir");
}
