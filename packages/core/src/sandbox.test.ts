import { describe, expect, it } from "vitest";
import { detectCodeRunSandboxStatus, type CodeRunSandboxProbe } from "./sandbox.js";

describe("code-run sandbox detection", () => {
  it("does not trust the Theorem container marker by itself", () => {
    const status = detectCodeRunSandboxStatus(
      probe({
        env: { THEOREM_WORKBENCH_CONTAINER: "1" },
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
        env: { THEOREM_WORKBENCH_CONTAINER: "1" },
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

  it("accepts a Theorem container with loopback-only networking and no default route", () => {
    const status = detectCodeRunSandboxStatus(
      probe({
        env: { THEOREM_WORKBENCH_CONTAINER: "1" },
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
