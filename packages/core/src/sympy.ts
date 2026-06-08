import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type SympyOperation = "simplify" | "factor" | "expand" | "differentiate" | "integrate";

export interface SymbolicPrompt {
  operation: SympyOperation;
  expression: string;
  variable: string;
}

export interface SympySuccess {
  ok: true;
  operation: SympyOperation;
  expression: string;
  variable: string;
  result: string;
  srepr: string;
  latex: string;
  sympyVersion: string;
  pythonCommand: string;
}

export interface SympyFailure {
  ok: false;
  error: string;
  errorType?: string;
  pythonCommand?: string;
  stderr?: string;
}

export type SympyResult = SympySuccess | SympyFailure;

const DEFAULT_TIMEOUT_MS = 5000;

export function parseSymbolicPrompt(problem: string): SymbolicPrompt | undefined {
  const match = /^(?:sympy|symbolic)\s+(simplify|factor|expand|differentiate|diff|integrate)\s+(.+?)(?:\s+(?:with respect to|wrt)\s+([A-Za-z_][A-Za-z0-9_]*))?\.?$/i.exec(problem);
  if (!match) {
    return undefined;
  }

  return {
    operation: normalizeOperation(match[1]),
    expression: match[2].trim(),
    variable: match[3]?.trim() ?? "x"
  };
}

export async function runSympy(prompt: SymbolicPrompt, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SympyResult> {
  const commands = pythonCandidates();
  let lastFailure: SympyFailure | undefined;

  for (const command of commands) {
    const result = await tryRunSympy(command, prompt, timeoutMs);
    if (result.ok) {
      return result;
    }
    lastFailure = chooseFailure(lastFailure, result);
  }

  return (
    lastFailure ?? {
      ok: false,
      error: "No Python command configured or discovered for SymPy.",
      errorType: "PythonNotFound"
    }
  );
}

export function runSympySync(prompt: SymbolicPrompt, timeoutMs = DEFAULT_TIMEOUT_MS): SympyResult {
  const commands = pythonCandidates();
  let lastFailure: SympyFailure | undefined;

  for (const command of commands) {
    const result = tryRunSympySync(command, prompt, timeoutMs);
    if (result.ok) {
      return result;
    }
    lastFailure = chooseFailure(lastFailure, result);
  }

  return (
    lastFailure ?? {
      ok: false,
      error: "No Python command configured or discovered for SymPy.",
      errorType: "PythonNotFound"
    }
  );
}

function tryRunSympy(command: string, prompt: SymbolicPrompt, timeoutMs: number): Promise<SympyResult> {
  return new Promise((resolveResult) => {
    let bridge: string;
    try {
      bridge = bridgePath();
    } catch (error) {
      resolveResult({
        ok: false,
        error: error instanceof Error ? error.message : "Could not locate SymPy bridge.",
        errorType: "BridgeNotFound",
        pythonCommand: command
      });
      return;
    }

    const child = spawn(command, [bridge], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      resolveResult({
        ok: false,
        error: `SymPy adapter timed out after ${timeoutMs}ms`,
        errorType: "Timeout",
        pythonCommand: command,
        stderr
      });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolveResult({
        ok: false,
        error: error.message,
        errorType: error.name,
        pythonCommand: command,
        stderr
      });
    });
    child.on("close", () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolveResult(parseSympyOutput(stdout, stderr, command));
    });

    child.stdin.end(`${JSON.stringify(prompt)}\n`);
  });
}

function tryRunSympySync(command: string, prompt: SymbolicPrompt, timeoutMs: number): SympyResult {
  let bridge: string;
  try {
    bridge = bridgePath();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not locate SymPy bridge.",
      errorType: "BridgeNotFound",
      pythonCommand: command
    };
  }

  const result = spawnSync(command, [bridge], {
    input: `${JSON.stringify(prompt)}\n`,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (result.error) {
    return {
      ok: false,
      error: result.error.message,
      errorType: result.error.name,
      pythonCommand: command,
      stderr
    };
  }

  return parseSympyOutput(stdout, stderr, command);
}

function parseSympyOutput(stdout: string, stderr: string, command: string): SympyResult {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    if (!parsed || typeof parsed !== "object" || !("ok" in parsed)) {
      throw new Error("Missing ok field");
    }

    if ((parsed as { ok: unknown }).ok === true) {
      const success = parsed as Omit<SympySuccess, "pythonCommand">;
      return {
        ...success,
        pythonCommand: command
      };
    }

    const failure = parsed as Omit<SympyFailure, "pythonCommand" | "stderr">;
    return {
      ...failure,
      pythonCommand: command,
      stderr
    };
  } catch {
    return {
      ok: false,
      error: "SymPy adapter returned invalid JSON.",
      errorType: "InvalidJson",
      pythonCommand: command,
      stderr
    };
  }
}

function normalizeOperation(operation: string): SympyOperation {
  const normalized = operation.toLowerCase();
  return normalized === "diff" ? "differentiate" : (normalized as SympyOperation);
}

function chooseFailure(previous: SympyFailure | undefined, next: SympyFailure): SympyFailure {
  if (!previous) {
    return next;
  }

  if (isLaunchFailure(previous) && !isLaunchFailure(next)) {
    return next;
  }

  return previous;
}

function isLaunchFailure(failure: SympyFailure): boolean {
  return /\b(?:ENOENT|EPERM|EACCES|ETIMEDOUT)\b/.test(`${failure.errorType ?? ""} ${failure.error}`);
}

function pythonCandidates(): string[] {
  const configured = process.env.THEOREM_PYTHON?.trim();
  const candidates = configured
    ? [configured]
    : process.platform === "win32"
      ? ["py", "python", "python3"]
      : ["python3", "python", "py"];

  return [...new Set(candidates)];
}

function bridgePath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, "../../../tools/sympy_bridge.py"),
    resolve(currentDir, "../../../../tools/sympy_bridge.py")
  ];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Could not locate SymPy bridge. Checked: ${candidates.join(", ")}`);
  }

  return found;
}
