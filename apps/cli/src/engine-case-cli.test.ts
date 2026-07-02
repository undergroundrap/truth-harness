import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { program } from "./index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("engine case CLI", () => {
  it("validates an external engine math case bundle and prints JSON", async () => {
    const root = await tempRoot();
    const bundlePath = join(root, "engine-cases.json");
    await writeFile(bundlePath, `${JSON.stringify({
      schemaVersion: "truth-harness.engine-case-bundle.v0",
      producer: { name: "vire-engine", version: "0.0.1" },
      cases: [
        {
          caseId: "point-in-triangle-works",
          primitive: "point2-triangle2-membership",
          inputs: {
            point: { x: "1", y: "1" },
            triangle: {
              a: { x: "0", y: "0" },
              b: { x: "4", y: "0" },
              c: { x: "0", y: "4" }
            }
          },
          observed: { inside: true }
        }
      ]
    }, null, 2)}\n`, "utf8");

    const result = await runCli(["engines", "validate", bundlePath, "--json"]);
    const json = JSON.parse(result.stdout) as { status: string; accepted: number; cases: Array<{ trust: string; backendId: string }> };

    expect(result.exitCode).toBe(0);
    expect(json.status).toBe("passed");
    expect(json.accepted).toBe(1);
    expect(json.cases[0]).toMatchObject({ trust: "exact-computed", backendId: "local-point-in-triangle2" });
  });

  it("exits nonzero when the exported engine output is refuted", async () => {
    const root = await tempRoot();
    const bundlePath = join(root, "engine-cases-bad.json");
    await writeFile(bundlePath, `${JSON.stringify({
      schemaVersion: "truth-harness.engine-case-bundle.v0",
      cases: [
        {
          caseId: "aabb-bug",
          primitive: "aabb2-overlap",
          inputs: {
            a: { minX: "0", minY: "0", maxX: "1", maxY: "1" },
            b: { minX: "3", minY: "0", maxX: "4", maxY: "1" }
          },
          observed: { overlap: true }
        }
      ]
    }, null, 2)}\n`, "utf8");

    const result = await runCli(["engines", "validate", bundlePath, "--json"]);
    const json = JSON.parse(result.stdout) as { status: string; refuted: number; cases: Array<{ expected: string; observed: string }> };

    expect(result.exitCode).toBe(1);
    expect(json.status).toBe("failed");
    expect(json.refuted).toBe(1);
    expect(json.cases[0]).toMatchObject({ expected: "false", observed: "true" });
  });
});

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const previousExitCode = process.exitCode;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...values) => {
    stdout.push(values.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...values) => {
    stderr.push(values.join(" "));
  });

  try {
    process.exitCode = undefined;
    await program.parseAsync(["node", "truth-harness", ...args], { from: "node" });
    return {
      exitCode: Number(process.exitCode ?? 0),
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n")
    };
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-engine-case-cli-"));
  roots.push(root);
  return root;
}