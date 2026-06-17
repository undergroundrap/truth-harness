import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_LOCK_RETRY_MS = 25;
const DEFAULT_STALE_LOCK_MS = 120_000;
const WORKSPACE_LOCK_DIR = ".truth-harness/indexes/locks";

export interface WorkspaceLockOptions {
  timeoutMs?: number;
  retryMs?: number;
  staleMs?: number;
  now?: string;
}

export async function writeFileAtomic(path: string, data: string | Uint8Array, encoding: BufferEncoding = "utf8"): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
  let wroteTemp = false;

  try {
    const handle = await open(tempPath, "wx");
    try {
      if (typeof data === "string") {
        await handle.writeFile(data, { encoding });
      } else {
        await handle.writeFile(data);
      }
      await handle.sync();
      wroteTemp = true;
    } finally {
      await handle.close();
    }

    await rename(tempPath, path);
  } catch (error) {
    if (wroteTemp || (await pathExists(tempPath))) {
      await rm(tempPath, { force: true });
    }
    throw error;
  }
}

export async function writeJsonFileAtomic(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function withWorkspaceLock<T>(
  rootPath: string,
  lockName: string,
  action: () => Promise<T>,
  options: WorkspaceLockOptions = {}
): Promise<T> {
  const lockPath = join(rootPath, WORKSPACE_LOCK_DIR, `${sanitizeLockName(lockName)}.lock`);
  const lockId = randomUUID();
  await acquireLock(lockPath, lockId, options);

  try {
    return await action();
  } finally {
    await releaseLock(lockPath, lockId);
  }
}

async function acquireLock(lockPath: string, lockId: string, options: WorkspaceLockOptions): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const retryMs = options.retryMs ?? DEFAULT_LOCK_RETRY_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_LOCK_MS;
  const deadline = Date.now() + timeoutMs;
  const createdAt = options.now ?? new Date().toISOString();
  await mkdir(dirname(lockPath), { recursive: true });

  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      try {
        await handle.writeFile(
          `${JSON.stringify(
            {
              schemaVersion: "truth-harness.workspace-lock.v0",
              lockId,
              pid: process.pid,
              createdAt
            },
            null,
            2
          )}\n`,
          "utf8"
        );
        await handle.sync();
      } finally {
        await handle.close();
      }
      return;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (!(await isLockContention(lockPath, nodeError))) {
        throw error;
      }

      if (await isStaleLock(lockPath, staleMs)) {
        await rm(lockPath, { force: true });
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for Truth Harness workspace lock: ${lockPath}`);
      }

      await delay(retryMs);
    }
  }
}

async function isLockContention(lockPath: string, error: NodeJS.ErrnoException): Promise<boolean> {
  if (error.code === "EEXIST") {
    return true;
  }

  if (error.code === "EPERM" || error.code === "EACCES") {
    if (await pathExists(lockPath)) {
      return true;
    }

    // Windows can report EPERM while another worker is between create/remove
    // visibility states for the same lock path. Treat that as contention so
    // concurrent writers retry instead of failing a valid workspace operation.
    return process.platform === "win32";
  }

  return false;
}

async function releaseLock(lockPath: string, lockId: string): Promise<void> {
  try {
    const raw = await readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as { lockId?: unknown };
    if (parsed.lockId === lockId) {
      await rm(lockPath, { force: true });
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }
}

async function isStaleLock(lockPath: string, staleMs: number): Promise<boolean> {
  try {
    const stats = await stat(lockPath);
    return Date.now() - stats.mtimeMs > staleMs;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function sanitizeLockName(lockName: string): string {
  const cleaned = lockName.trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
  if (!cleaned) {
    throw new Error("Workspace lock name must contain at least one safe character.");
  }
  return cleaned;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
