import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { validateJsonSchema } from "./json-schema-validation.js";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  executeCodeRun,
  listCodeRuns,
  writeCodeRun,
  type CodeRunCommandRunner
} from "./code-run.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const schemasDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("code run records", () => {
  it("executes a policy-gated local command and writes a validated record", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Code Run Lab" });

    const write = await writeCodeRun({
      rootPath: root,
      title: "Compute forty two",
      purpose: "Run a tiny local deterministic code check for evidence capture.",
      command: process.execPath,
      args: ["-e", "console.log(6 * 7)"],
      codeRefs: ["inline:node-eval"],
      inputRefs: ["prompt:6*7"],
      outputRefs: ["stdout"],
      policy: {
        allowedExecutables: [process.execPath]
      },
      now: "2026-06-11T00:00:00.000Z"
    });
    const schema = JSON.parse(await readFile(resolve(schemasDir, "code-run.schema.json"), "utf8")) as unknown;
    const list = await listCodeRuns(root);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(write.record.schemaVersion).toBe("theorem.code-run.v0");
    expect(write.record.runId).toMatch(/^code_run_[a-f0-9]{16}$/);
    expect(write.record.command.shell).toBe(false);
    expect(write.record.policy).toMatchObject({
      mode: "default-local",
      decision: "allowed",
      matchedAllowlist: true,
      sandbox: {
        required: false,
        measurement: {
          available: false,
          provider: "none",
          canAttestNetworkNone: false
        }
      },
      detected: {
        executableName: quoteForExpectation(process.execPath).replace(/^"|"$/g, "").split(/[\\/]/).pop()?.replace(/\.(exe|cmd|bat|com)$/i, "").toLowerCase(),
        categories: []
      }
    });
    expect(write.record.execution.status).toBe("passed");
    expect(write.record.execution.exitCode).toBe(0);
    expect(write.record.stdout.text.trim()).toBe("42");
    expect(write.record.replay.command).toContain(quoteForExpectation(process.execPath));
    expect(write.record.replay.localOnly).toBe(false);
    expect(write.record.privacy).toMatchObject({
      mode: "unsandboxed-local-execution",
      networkAccess: "unknown",
      measurement: {
        available: false,
        provider: "none",
        processSandbox: "none",
        networkIsolation: "not-enforced",
        canAttestNetworkNone: false
      }
    });
    expect(write.record.reproducibilityBoundary.commandExecutionIsNotProof).toBe(true);
    expect(write.markdown).toContain("Compute forty two");
    expect(write.markdown).toContain("42");
    expect(validateJsonSchema(write.record, schema)).toEqual([]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      runId: write.record.runId,
      status: "passed",
      exitCode: 0
    });
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind["code-runs"]).toBe(1);
  });

  it("records non-zero exits without pretending they are positive evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const runner: CodeRunCommandRunner = () => ({
      exitCode: 2,
      stdout: "",
      stderr: "boom\n",
      durationMs: 12
    });

    const record = await executeCodeRun({
      rootPath: root,
      purpose: "Run a failing local test command.",
      command: "test-runner",
      args: ["--fail"],
      policy: {
        allowedExecutables: ["test-runner"]
      },
      runner,
      now: "2026-06-11T00:00:00.000Z"
    });

    expect(record.execution.status).toBe("failed");
    expect(record.stderr.text).toBe("boom\n");
    expect(record.reproducibilityBoundary.requiresCleanReplay).toBe(true);
    expect(record.warnings.join(" ")).toContain("did not pass");
  });

  it("marks timeouts and truncates long captured output", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const runner: CodeRunCommandRunner = () => ({
      exitCode: null,
      signal: "SIGTERM",
      stdout: "abcdef",
      stderr: "timed out",
      durationMs: 100,
      error: {
        name: "Error",
        code: "ETIMEDOUT",
        message: "spawn timed out"
      }
    });

    const record = await executeCodeRun({
      rootPath: root,
      purpose: "Run a timeout fixture.",
      command: "slow-command",
      timeoutMs: 100,
      maxOutputBytes: 3,
      policy: {
        allowedExecutables: ["slow-command"]
      },
      runner
    });

    expect(record.execution.status).toBe("timed-out");
    expect(record.execution.timedOut).toBe(true);
    expect(record.stdout.text).toBe("abc");
    expect(record.stdout.byteLength).toBe(6);
    expect(record.stdout.truncated).toBe(true);
    expect(record.warnings.join(" ")).toContain("timed out");
  });

  it("does not block the event loop while a child process is running", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const started = Date.now();

    const run = executeCodeRun({
      rootPath: root,
      purpose: "Run a slow child process without blocking other agent work.",
      command: process.execPath,
      args: ["-e", "setTimeout(() => console.log('async-code-run'), 250)"],
      policy: {
        allowedExecutables: [process.execPath]
      },
      timeoutMs: 1000
    });
    await delay(25);

    expect(Date.now() - started).toBeLessThan(200);
    const record = await run;
    expect(record.execution.status).toBe("passed");
    expect(record.stdout.text.trim()).toBe("async-code-run");
  });

  it("limits concurrent code runs per workspace", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    let active = 0;
    let maxActive = 0;
    const releases: Array<() => void> = [];
    const runner: CodeRunCommandRunner = async ({ command }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolveRun) => releases.push(resolveRun));
      active -= 1;
      return {
        exitCode: 0,
        stdout: `${command}\n`,
        stderr: "",
        durationMs: 1
      };
    };

    const runs = ["tool-one", "tool-two", "tool-three"].map((command) =>
      executeCodeRun({
        rootPath: root,
        purpose: `Run queued fixture ${command}.`,
        command,
        policy: {
          allowedExecutables: [command]
        },
        runner
      })
    );
    await waitFor(() => releases.length === 2);

    expect(active).toBe(2);
    expect(maxActive).toBe(2);
    releases.shift()?.();
    await waitFor(() => releases.length === 2);
    expect(maxActive).toBe(2);
    releases.shift()?.();
    releases.shift()?.();

    const records = await Promise.all(runs);
    expect(records.map((record) => record.stdout.text.trim()).sort()).toEqual(["tool-one", "tool-three", "tool-two"]);
    expect(maxActive).toBe(2);
  });

  it("blocks shell launchers before running the command by default", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    let runnerCalled = false;
    const runner: CodeRunCommandRunner = () => {
      runnerCalled = true;
      return {
        exitCode: 0,
        stdout: "",
        stderr: "",
        durationMs: 1
      };
    };

    await expect(
      executeCodeRun({
        rootPath: root,
        purpose: "Attempt to launch a shell.",
        command: "powershell",
        args: ["-Command", "Write-Output blocked"],
        runner
      })
    ).rejects.toThrow("blocked by local execution policy");
    expect(runnerCalled).toBe(false);
  });

  it("requires an explicit executable allowlist before running any command", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    let runnerCalled = false;
    const runner: CodeRunCommandRunner = () => {
      runnerCalled = true;
      return {
        exitCode: 0,
        stdout: "should-not-run\n",
        stderr: "",
        durationMs: 1
      };
    };

    await expect(
      executeCodeRun({
        rootPath: root,
        purpose: "Attempt to run without an allowlist.",
        command: "node",
        runner
      })
    ).rejects.toThrow("non-empty explicit executable allowlist");
    expect(runnerCalled).toBe(false);
  });

  it("blocks sandbox-required runs when no OS sandbox provider is available", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    let runnerCalled = false;
    const runner: CodeRunCommandRunner = () => {
      runnerCalled = true;
      return {
        exitCode: 0,
        stdout: "should-not-run\n",
        stderr: "",
        durationMs: 1
      };
    };

    await expect(
      executeCodeRun({
        rootPath: root,
        purpose: "Attempt to run only when an OS sandbox is available.",
        command: process.execPath,
        policy: {
          allowedExecutables: [process.execPath],
          requireSandbox: true
        },
        runner
      })
    ).rejects.toThrow("requires an OS-enforced sandbox");
    expect(runnerCalled).toBe(false);
  });

  it("records explicit policy overrides for package mutation commands", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const runner: CodeRunCommandRunner = () => ({
      exitCode: 0,
      stdout: "dry-run package mutation\n",
      stderr: "",
      durationMs: 5
    });

    await expect(
      executeCodeRun({
        rootPath: root,
        purpose: "Attempt a package mutation without an override.",
        command: "npm",
        args: ["install"],
        policy: {
          allowedExecutables: ["npm"]
        },
        runner
      })
    ).rejects.toThrow("Package mutation command");

    const record = await executeCodeRun({
      rootPath: root,
      purpose: "Record an explicitly approved package mutation fixture.",
      command: "npm",
      args: ["install"],
      runner,
      policy: {
        allowedExecutables: ["npm"],
        allowPackageMutation: true
      }
    });

    expect(record.execution.status).toBe("passed");
    expect(record.policy.detected).toMatchObject({
      executableName: "npm",
      categories: ["package-mutation"],
      packageMutation: "install"
    });
    expect(record.policy.overrides.packageMutation).toBe(true);
    expect(record.warnings.join(" ")).toContain("explicitly overridden");
  });

  it("enforces executable allowlists", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const runner: CodeRunCommandRunner = () => ({
      exitCode: 0,
      stdout: "ok\n",
      stderr: "",
      durationMs: 1
    });

    await expect(
      executeCodeRun({
        rootPath: root,
        purpose: "Run a command outside the allowlist.",
        command: "node",
        runner,
        policy: {
          allowedExecutables: ["python"]
        }
      })
    ).rejects.toThrow("not in the explicit allowlist");
  });

  it("rejects working directories that escape the workspace", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    await expect(
      executeCodeRun({
        rootPath: root,
        purpose: "Attempt to escape workspace.",
        command: "node",
        workingDirectory: ".."
      })
    ).rejects.toThrow("Path escapes workspace root");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-code-run-"));
  roots.push(root);
  return root;
}

function quoteForExpectation(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/.test(value) ? value : JSON.stringify(value);
}

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for test predicate.");
    }

    await delay(5);
  }
}
