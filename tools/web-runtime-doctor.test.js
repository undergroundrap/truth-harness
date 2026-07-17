import { describe, expect, it } from "vitest";
import {
  buildRuntimeAssessment,
  parseIndexScriptSrc,
  parseTasklistCsv,
  parseWindowsNetstat
} from "./web-runtime-doctor.mjs";

describe("web runtime doctor", () => {
  it("parses Windows port owners from netstat and tasklist output", () => {
    const netstat = `
  Proto  Local Address          Foreign Address        State           PID
  TCP    127.0.0.1:4173         0.0.0.0:0              LISTENING       1111
  TCP    127.0.0.1:4180         0.0.0.0:0              LISTENING       42380
  TCP    [::1]:4180             [::]:0                 LISTENING       42380
`;

    expect(parseWindowsNetstat(netstat, 4180)).toEqual([
      {
        pid: "42380",
        processName: "unknown",
        command: "netstat",
        source: "netstat"
      },
      {
        pid: "42380",
        processName: "unknown",
        command: "netstat",
        source: "netstat"
      }
    ]);
    expect(parseTasklistCsv('"com.docker.backend.exe","42380","Console","1","140,000 K"')).toEqual({
      processName: "com.docker.backend.exe",
      pid: "42380"
    });
  });

  it("extracts the app module cache key from served HTML", () => {
    expect(
      parseIndexScriptSrc('<script src="./src/app.js?v=2026-06-19-runtime-identity" type="module"></script>')
    ).toBe("./src/app.js?v=2026-06-19-runtime-identity");
  });

  it("flags a legacy Docker-owned API as stale and recommends Docker refresh without killing ports", () => {
    const assessment = buildRuntimeAssessment({
      statusPayload: {
        localOnly: true,
        capabilities: ["safety-center"],
        safety: {
          codeRunSandbox: {
            platform: "linux"
          },
          webServer: {
            bindHost: "0.0.0.0"
          }
        }
      },
      localScriptSrc: "./src/app.js?v=current",
      remoteScriptSrc: "./src/app.js?v=current",
      portOwners: [
        {
          processName: "com.docker.backend.exe",
          pid: "42380",
          source: "netstat"
        }
      ]
    });

    expect(assessment).toMatchObject({
      severity: "warning",
      status: "legacy-docker-api",
      runtimeKind: "probable-docker-container",
      ownerKind: "docker",
      apiCurrent: false,
      staticCurrent: true
    });
    expect(assessment.recommendations.map((recommendation) => recommendation.command)).toEqual([
      "docker compose up --build web",
      "docker compose stop web && npm run web:restart"
    ]);
  });

  it("recognizes a current host runtime and recommends only a browser reload", () => {
    const assessment = buildRuntimeAssessment({
      statusPayload: {
        localOnly: true,
        capabilities: ["web-runtime-identity"],
        runtime: {
          schemaVersion: "truth-harness.web-runtime.v0",
          runtimeKind: "windows-host",
          projectRoot: "C:/work/truth-harness"
        },
        safety: {
          codeRunSandbox: {
            platform: "win32"
          },
          webServer: {
            bindHost: "127.0.0.1"
          }
        }
      },
      localScriptSrc: "./src/app.js?v=current",
      remoteScriptSrc: "./src/app.js?v=current",
      portOwners: [
        {
          processName: "node.exe",
          pid: "1000",
          source: "netstat"
        }
      ]
    });

    expect(assessment).toMatchObject({
      severity: "ok",
      status: "host-web-current",
      runtimeKind: "windows-host",
      ownerKind: "node",
      apiCurrent: true,
      staticCurrent: true
    });
    expect(assessment.recommendations[0]).toMatchObject({
      command: "browser reload http://127.0.0.1:4180/"
    });
  });
});
