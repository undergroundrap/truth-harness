import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

/** Validate existing targets and the nearest existing parent of new paths. */
export function resolveContainedPath(root: string, path: string): string {
  const absoluteRoot = resolve(root);
  const target = resolve(absoluteRoot, path);
  const canonicalRoot = canonicalPath(absoluteRoot);
  if (!isAbsolute(path) || !isContained(canonicalRoot, target)) {
    assertContained(absoluteRoot, target);
  }
  const canonicalTarget = canonicalPath(target);
  assertContained(canonicalRoot, canonicalTarget);
  return canonicalTarget;
}

function assertContained(root: string, target: string): void {
  if (!isContained(root, target)) {
    throw new Error(`Path escapes workspace root: ${target}`);
  }
}

function isContained(root: string, target: string): boolean {
  const offset = relative(root, target);
  return offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset);
}

function canonicalPath(path: string): string {
  let parent = path;
  while (true) {
    try {
      // lstat distinguishes a missing path from a dangling link: fail closed on links.
      lstatSync(parent);
      return resolve(realpathSync(parent), relative(parent, path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      try {
        lstatSync(parent);
        throw new Error(`Cannot resolve linked path: ${parent}`);
      } catch (linkError) {
        if ((linkError as NodeJS.ErrnoException).code !== "ENOENT") throw linkError;
      }
      const next = dirname(parent);
      if (next === parent) throw error;
      parent = next;
    }
  }
}
