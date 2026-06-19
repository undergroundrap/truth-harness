import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  detectCodeRunSandboxStatus,
  listCodeRunSandboxRuns,
  parseCodeRunSandboxRunJson,
  writeCodeRunSandboxRun,
  type CodeRunSandboxProbe
} from "./sandbox.js";

describe("code-run sandbox detection", () => {
  it("does not trust the Truth Harness container marker by itself", () => {
    const status = detectCodeRunSandboxStatus(
      probe({
        env: { TRUTH_HARNESS_CONTAINER: "1" },
        exists: {},
        files: {
          "/proc/1/cgroup": "0::/\n"
        },
        dirs: {
          "/sys/class/net": ["lo"]
        }
      })
    );

    expect(status.available).toBe(false);
    expect(status.provider).toBe("none");
    expect(status.canAttestNetworkNone).toBe(false);
    expect(status.reason).toContain("No Docker/container runtime marker");
  });

  it("does not accept a container with a non-loopback network interface", () => {
    const status = detectCodeRunSandboxStatus(
      probe({
        env: { TRUTH_HARNESS_CONTAINER: "1" },
        exists: { "/.dockerenv": true },
        files: {
          "/proc/net/route": "Iface\tDestination\tGateway\tFlags\neth0\t00000000\t010011AC\t0003\n"
        },
        dirs: {
          "/sys/class/net": ["eth0", "lo"]
        }
      })
    );

    expect(status.available).toBe(false);
    expect(status.networkIsolation).toBe("not-enforced");
    expect(status.notes.join(" ")).toContain("eth0");
    expect(status.notes.join(" ")).toContain("IPv4=true");
  });

  it("accepts a Truth Harness container with loopback-only networking and no default route", () => {
    const status = detectCodeRunSandboxStatus(
      probe({
        env: { TRUTH_HARNESS_CONTAINER: "1" },
        exists: { "/.dockerenv": true },
        files: {
          "/proc/net/route": "Iface\tDestination\tGateway\tFlags\n",
          "/proc/net/ipv6_route":
            "00000000000000000000000000000000 00 00000000000000000000000000000000 00 00000000000000000000000000000000 ffffffff 00000001 00000000 00200200 lo\n"
        },
        dirs: {
          "/sys/class/net": ["lo"]
        }
      })
    );

    expect(status).toMatchObject({
      available: true,
      provider: "container",
      processSandbox: "enforced",
      networkIsolation: "enforced",
      filesystemIsolation: "working-directory-only",
      canAttestNetworkNone: true
    });
    expect(status.reason).toContain("loopback-only");
  });

  it("writes, parses, and lists durable sandbox measurement findings", async () => {
    const root = await mkdtemp(join(tmpdir(), "truth-harness-sandbox-run-"));
    await initLocalWorkspace(root, { now: "2026-06-19T00:00:00.000Z" });
    const status = detectCodeRunSandboxStatus(
      probe({
        env: { TRUTH_HARNESS_CONTAINER: "1" },
        exists: { "/.dockerenv": true },
        files: {
          "/proc/net/route": "Iface\tDestination\tGateway\tFlags\n",
          "/proc/net/ipv6_route": ""
        },
        dirs: {
          "/sys/class/net": ["lo"]
        }
      })
    );

    const result = await writeCodeRunSandboxRun({
      rootPath: root,
      now: new Date("2026-06-19T00:00:00.000Z"),
      status,
      replayCommand: "npm run docker:sandbox:write"
    });
    const parsed = parseCodeRunSandboxRunJson(await readFile(result.jsonPath, "utf8"), result.jsonPath);
    const runs = await listCodeRunSandboxRuns(root);

    expect(parsed.schemaVersion).toBe("truth-harness.sandbox-run.v0");
    expect(parsed.runId).toBe(result.record.runId);
    expect(parsed.status).toBe("passed");
    expect(parsed.measurement.provider).toBe("container");
    expect(parsed.measurement.canAttestNetworkNone).toBe(true);
    expect(parsed.replay).toBe("npm run docker:sandbox:write");
    expect(parsed.artifacts.json).toContain(".truth-harness/findings/");
    expect(result.markdown).toContain("Can attest networkAccess none: `true`");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      runId: parsed.runId,
      status: "passed",
      provider: "container",
      canAttestNetworkNone: true
    });
  });
});

function probe(input: {
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  exists?: Record<string, boolean>;
  files?: Record<string, string>;
  dirs?: Record<string, string[]>;
}): CodeRunSandboxProbe {
  return {
    platform: input.platform ?? "linux",
    env: input.env ?? {},
    fileExists: (path) => input.exists?.[path] === true,
    readFile: (path) => input.files?.[path],
    readDir: (path) => input.dirs?.[path]
  };
}
