import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReceipt } from "@theorem-workbench/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { program } from "./index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("benchmark CLI", () => {
  it("reports CAS backend status without requiring Maxima to be installed", async () => {
    const result = await runCli([
      "cas",
      "backends",
      "--maxima-command",
      "theorem-workbench-missing-maxima-command",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      casBackendsAvailable: number;
      backends: Array<{ backendId: string; status: string; canCheckSymbolic: boolean; statusProbeMintedCheck: boolean }>;
      trustBoundary: { statusProbeIsNotCheck: boolean; crossCheckedRequiresIndependentRun: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.casBackendsAvailable).toBe(0);
    expect(json.backends[0]).toMatchObject({
      backendId: "maxima",
      status: "missing",
      canCheckSymbolic: false,
      statusProbeMintedCheck: false
    });
    expect(json.trustBoundary.statusProbeIsNotCheck).toBe(true);
    expect(json.trustBoundary.crossCheckedRequiresIndependentRun).toBe(true);
  });

  it("checks symbolic CAS results without minting trust when Maxima is unavailable", async () => {
    const result = await runCli([
      "cas",
      "check",
      "--operation",
      "simplify",
      "--expression",
      "sin(x)^2 + cos(x)^2",
      "--result",
      "1",
      "--variable",
      "x",
      "--maxima-command",
      "theorem-workbench-missing-maxima-command",
      "--timeout-ms",
      "50",
      "--json",
      "--fail-on-unverified"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      status: string;
      trust: string;
      proofCheckerBacked: boolean;
      backend: { acceptedProofChecker: boolean };
    };

    expect(result.exitCode).toBe(1);
    expect(json.schemaVersion).toBe("theorem.cas-check.v0");
    expect(json.status).toBe("solver-unavailable");
    expect(json.trust).toBe("unverified");
    expect(json.proofCheckerBacked).toBe(false);
    expect(json.backend.acceptedProofChecker).toBe(false);
  });

  it("writes and lists CAS check workspace records", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "cas",
      "check",
      "--operation",
      "simplify",
      "--expression",
      "sin(x)^2 + cos(x)^2",
      "--result",
      "1",
      "--workspace",
      root,
      "--write",
      "--maxima-command",
      "theorem-workbench-missing-maxima-command",
      "--timeout-ms",
      "50",
      "--json"
    ]);
    const writeJson = JSON.parse(write.stdout) as {
      record: { checkId: string; trust: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const list = JSON.parse((await runCli(["cas", "list", root, "--json"])).stdout) as {
      total: number;
      checks: Array<{ checkId: string; trust: string; path: string }>;
    };

    expect(write.exitCode).toBe(0);
    expect(writeJson.record.trust).toBe("unverified");
    expect(writeJson.result.jsonPath).toContain(".theorem-workbench");
    expect(writeJson.result.markdownPath).toContain(".theorem-workbench");
    expect(list.total).toBe(1);
    expect(list.checks[0]).toMatchObject({
      checkId: writeJson.record.checkId,
      trust: "unverified"
    });
    expect(list.checks[0]?.path).toContain(".theorem-workbench/cas/");
  });

  it("prints an engine manifest for humans and agents", async () => {
    const result = await runCli([
      "engines",
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "theorem-workbench-missing-maxima-command",
      "--lean-command",
      "theorem-workbench-missing-lean-command",
      "--z3-command",
      "theorem-workbench-missing-z3-command"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      nativeCount: number;
      adapterCount: number;
      plannedCount: number;
      capabilities: Array<{ id: string; status: string; canMintTrust: boolean }>;
      trustBoundary: { statusProbeIsNotEvidence: boolean; provedRequiresAcceptedProofCheckerRun: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.schemaVersion).toBe("theorem.engine-manifest.v0");
    expect(json.nativeCount).toBeGreaterThan(0);
    expect(json.adapterCount).toBeGreaterThan(0);
    expect(json.plannedCount).toBeGreaterThan(0);
    expect(json.capabilities).toContainEqual(
      expect.objectContaining({
        id: "lean-proof-checker",
        status: "missing",
        canMintTrust: false
      })
    );
    expect(json.trustBoundary.statusProbeIsNotEvidence).toBe(true);
    expect(json.trustBoundary.provedRequiresAcceptedProofCheckerRun).toBe(true);
  });

  it("prints a verifier route with receipt trust and manifest gaps", async () => {
    const result = await runCli([
      "verify",
      "compute",
      "3 / 4 + 5 / 8",
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "theorem-workbench-missing-maxima-command",
      "--lean-command",
      "theorem-workbench-missing-lean-command",
      "--z3-command",
      "theorem-workbench-missing-z3-command"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      finalTrust: string;
      receipt: { trust: string };
      usedCapabilities: Array<{ capabilityId: string }>;
      gaps: Array<{ capabilityId: string }>;
      proofObligations: Array<{ kind: string; status: string; sourceCapabilityId: string }>;
      trustBoundary: { routeIsNotProof: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.schemaVersion).toBe("theorem.verifier-route.v0");
    expect(json.finalTrust).toBe("exact-computed");
    expect(json.receipt.trust).toBe("exact-computed");
    expect(json.usedCapabilities).toContainEqual(
      expect.objectContaining({
        capabilityId: "local-rational-arithmetic"
      })
    );
    expect(json.gaps).toContainEqual(
      expect.objectContaining({
        capabilityId: "accepted-proof-checker"
      })
    );
    expect(json.proofObligations).toContainEqual(
      expect.objectContaining({
        kind: "formal-proof",
        status: "not-required",
        sourceCapabilityId: "accepted-proof-checker"
      })
    );
    expect(json.trustBoundary.routeIsNotProof).toBe(true);
  });

  it("prints proof obligations in human verifier route output", async () => {
    const result = await runCli([
      "verify",
      "compute",
      "3 / 4 + 5 / 8",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "theorem-workbench-missing-maxima-command",
      "--lean-command",
      "theorem-workbench-missing-lean-command",
      "--z3-command",
      "theorem-workbench-missing-z3-command"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Proof obligations:");
    expect(result.stdout).toContain("not-required: Formal proof-checker obligation");
    expect(result.stdout).toContain("Required before: Before labeling this scoped claim proved.");
  });

  it("writes and inspects persisted verifier routes", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "verify",
      "compute",
      "3 / 4 + 5 / 8",
      "--write",
      "--workspace",
      root,
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "theorem-workbench-missing-maxima-command",
      "--lean-command",
      "theorem-workbench-missing-lean-command",
      "--z3-command",
      "theorem-workbench-missing-z3-command"
    ]);
    const written = JSON.parse(write.stdout) as {
      written: true;
      route: { routeId: string; finalTrust: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const listed = JSON.parse((await runCli(["route", "list", root, "--json"])).stdout) as {
      total: number;
      routes: Array<{
        routeId: string;
        finalTrust: string;
        path: string;
        proofObligations: number;
        openProofObligations: number;
        satisfiedProofObligations: number;
        notRequiredProofObligations: number;
        criticalOpenProofObligations: number;
        readyForNarrowClaim: boolean;
        strongestRouteTrust: string;
        blockingObligations: number;
      }>;
    };
    const shown = JSON.parse(
      (await runCli(["route", "show", written.route.routeId, "--workspace", root, "--json"])).stdout
    ) as { routeId: string; finalTrust: string; replay: string };
    const humanList = await runCli(["route", "list", root]);

    expect(write.exitCode).toBe(0);
    expect(written.written).toBe(true);
    expect(written.route.finalTrust).toBe("exact-computed");
    expect(written.result.jsonPath).toContain(".theorem-workbench");
    expect(written.result.markdownPath).toContain(".theorem-workbench");
    expect(listed.total).toBe(1);
    expect(listed.routes[0]).toMatchObject({
      routeId: written.route.routeId,
      finalTrust: "exact-computed",
      proofObligations: 1,
      openProofObligations: 0,
      satisfiedProofObligations: 0,
      notRequiredProofObligations: 1,
      criticalOpenProofObligations: 0,
      readyForNarrowClaim: true,
      strongestRouteTrust: "exact-computed",
      blockingObligations: 0
    });
    expect(shown.routeId).toBe(written.route.routeId);
    expect(shown.replay).toContain("theorem verify");
    expect(humanList.stdout).toContain("Proof obligations: 1 total / 1 not-required");
    expect(humanList.stdout).toContain("Readiness: ready (exact-computed)");
  });

  it("satisfies verifier route obligations from accepted local evidence", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "verify",
      "prove",
      "the",
      "Riemann",
      "hypothesis",
      "--write",
      "--workspace",
      root,
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "theorem-workbench-missing-maxima-command",
      "--lean-command",
      "theorem-workbench-missing-lean-command",
      "--z3-command",
      "theorem-workbench-missing-z3-command"
    ]);
    const written = JSON.parse(write.stdout) as {
      route: {
        routeId: string;
        proofObligations: Array<{ obligationId: string; kind: string; status: string }>;
      };
    };
    const proofRef = join(".theorem-workbench", "proofs", "manual-proof.json");
    await mkdir(join(root, ".theorem-workbench", "proofs"), { recursive: true });
    await writeFile(
      join(root, proofRef),
      `${JSON.stringify(
        {
          schemaVersion: "theorem.proof-check.v0",
          checkId: "proof_0123456789abcdef",
          createdAt: "2026-06-12T00:00:00.000Z",
          backend: {
            id: "lean",
            displayName: "Lean proof checker",
            adapter: "local-lean-subprocess",
            role: "proof-checker",
            acceptedProofChecker: true,
            command: "lean",
            args: ["manual-proof.lean"],
            exitCode: 0
          },
          source: {
            path: "manual-proof.lean",
            sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            byteLength: 16
          },
          status: "accepted",
          trust: "proved",
          proofCheckerBacked: true,
          localOnly: true,
          networkAccess: "none",
          replay: "theorem proof check manual-proof.lean --write --json",
          limitations: ["Test fixture for CLI route-satisfaction contract only."],
          warnings: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const obligation = written.route.proofObligations.find((candidate) => candidate.kind === "formal-proof");
    const satisfy = await runCli([
      "route",
      "satisfy",
      written.route.routeId,
      obligation?.obligationId ?? "",
      "--workspace",
      root,
      "--evidence",
      `proof:${proofRef}`,
      "--json"
    ]);
    const result = JSON.parse(satisfy.stdout) as {
      route: { proofObligations: Array<{ status: string; severity: string }> };
      obligation: { status: string; satisfiedBy: Array<{ kind: string; ref: string; trust: string }> };
      evidence: { trust: string; schemaVersion: string };
    };
    const shown = JSON.parse(
      (await runCli(["route", "show", written.route.routeId, "--workspace", root, "--json"])).stdout
    ) as { proofObligations: Array<{ obligationId: string; status: string }> };
    const human = await runCli([
      "route",
      "satisfy",
      written.route.routeId,
      obligation?.obligationId ?? "",
      "--workspace",
      root,
      "--evidence",
      `proof:${proofRef}`
    ]);

    expect(satisfy.exitCode).toBe(0);
    expect(result.obligation.status).toBe("satisfied");
    expect(result.obligation.satisfiedBy[0]).toMatchObject({
      kind: "proof",
      ref: proofRef,
      trust: "proved"
    });
    expect(result.evidence).toMatchObject({
      trust: "proved",
      schemaVersion: "theorem.proof-check.v0"
    });
    expect(shown.proofObligations.find((candidate) => candidate.obligationId === obligation?.obligationId)).toMatchObject({
      status: "satisfied"
    });
    const openObligations = result.route.proofObligations.filter((candidate) => candidate.status === "open").length;
    const criticalOpenObligations = result.route.proofObligations.filter(
      (candidate) => candidate.status === "open" && candidate.severity === "critical"
    ).length;
    const satisfiedObligations = result.route.proofObligations.filter(
      (candidate) => candidate.status === "satisfied"
    ).length;
    expect(human.stdout).toContain(
      `Proof obligations: ${result.route.proofObligations.length} total / ${openObligations} open / ${criticalOpenObligations} critical-open / ${satisfiedObligations} satisfied`
    );
    expect(human.stdout).toContain("Readiness: not-ready (proved)");
    expect(human.stdout).toContain("Claim ledger follow-up:");
  });

  it("reports proof backend status without requiring Lean to be installed", async () => {
    const result = await runCli([
      "proof",
      "backends",
      "--lean-command",
      "theorem-workbench-missing-lean-command",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      proofCheckersAvailable: number;
      backends: Array<{ backendId: string; status: string; canCheckProofs: boolean; statusProbeMintedProof: boolean }>;
      trustBoundary: { statusProbeIsNotProof: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.proofCheckersAvailable).toBe(0);
    expect(json.backends[0]).toMatchObject({
      backendId: "lean",
      status: "missing",
      canCheckProofs: false,
      statusProbeMintedProof: false
    });
    expect(json.trustBoundary.statusProbeIsNotProof).toBe(true);
  });

  it("checks Lean proof artifacts without minting proved when Lean is unavailable", async () => {
    const root = await tempRoot();
    const proofPath = join(root, "example.lean");
    await writeFile(proofPath, "example : True := by trivial\n", "utf8");

    const result = await runCli([
      "proof",
      "check",
      proofPath,
      "--lean-command",
      "theorem-workbench-missing-lean-command",
      "--json",
      "--fail-on-unproved"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      status: string;
      trust: string;
      proofCheckerBacked: boolean;
      backend: { acceptedProofChecker: boolean };
      source: { sha256: string };
    };

    expect(result.exitCode).toBe(1);
    expect(json.schemaVersion).toBe("theorem.proof-check.v0");
    expect(json.status).toBe("backend-unavailable");
    expect(json.trust).toBe("unverified");
    expect(json.proofCheckerBacked).toBe(false);
    expect(json.backend.acceptedProofChecker).toBe(true);
    expect(json.source.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("writes and lists proof-check workspace records", async () => {
    const root = await tempRoot();
    const proofPath = join(root, "example.lean");
    await writeFile(proofPath, "example : True := by trivial\n", "utf8");

    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "proof",
      "check",
      proofPath,
      "--workspace",
      root,
      "--write",
      "--lean-command",
      "theorem-workbench-missing-lean-command",
      "--json"
    ]);
    const writeJson = JSON.parse(write.stdout) as {
      record: { checkId: string; trust: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const list = JSON.parse((await runCli(["proof", "list", root, "--json"])).stdout) as {
      total: number;
      checks: Array<{ checkId: string; trust: string; path: string }>;
    };

    expect(write.exitCode).toBe(0);
    expect(writeJson.record.trust).toBe("unverified");
    expect(writeJson.result.jsonPath).toContain(".theorem-workbench");
    expect(writeJson.result.markdownPath).toContain(".theorem-workbench");
    expect(list.total).toBe(1);
    expect(list.checks[0]).toMatchObject({
      checkId: writeJson.record.checkId,
      trust: "unverified"
    });
    expect(list.checks[0]?.path).toContain(".theorem-workbench/proofs/");
  });

  it("reports SMT backend status without requiring Z3 to be installed", async () => {
    const result = await runCli(["smt", "backends", "--z3-command", "theorem-workbench-missing-z3-command", "--json"]);
    const json = JSON.parse(result.stdout) as {
      smtSolversAvailable: number;
      backends: Array<{ backendId: string; status: string; canCheckSmt: boolean; statusProbeMintedCheck: boolean }>;
      trustBoundary: { statusProbeIsNotCheck: boolean; smtCheckedIsNotProofCheckerProof: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.smtSolversAvailable).toBe(0);
    expect(json.backends[0]).toMatchObject({
      backendId: "z3",
      status: "missing",
      canCheckSmt: false,
      statusProbeMintedCheck: false
    });
    expect(json.trustBoundary.statusProbeIsNotCheck).toBe(true);
    expect(json.trustBoundary.smtCheckedIsNotProofCheckerProof).toBe(true);
  });

  it("checks SMT-LIB artifacts without minting smt-checked when Z3 is unavailable", async () => {
    const root = await tempRoot();
    const smtPath = join(root, "constraints.smt2");
    await writeFile(smtPath, "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n", "utf8");

    const result = await runCli([
      "smt",
      "check",
      smtPath,
      "--z3-command",
      "theorem-workbench-missing-z3-command",
      "--json",
      "--fail-on-unverified"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      status: string;
      trust: string;
      proofCheckerBacked: boolean;
      backend: { acceptedProofChecker: boolean };
      source: { sha256: string };
    };

    expect(result.exitCode).toBe(1);
    expect(json.schemaVersion).toBe("theorem.smt-check.v0");
    expect(json.status).toBe("solver-unavailable");
    expect(json.trust).toBe("unverified");
    expect(json.proofCheckerBacked).toBe(false);
    expect(json.backend.acceptedProofChecker).toBe(false);
    expect(json.source.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("writes and lists SMT check workspace records", async () => {
    const root = await tempRoot();
    const smtPath = join(root, "constraints.smt2");
    await writeFile(smtPath, "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n", "utf8");

    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "smt",
      "check",
      smtPath,
      "--workspace",
      root,
      "--write",
      "--z3-command",
      "theorem-workbench-missing-z3-command",
      "--json"
    ]);
    const writeJson = JSON.parse(write.stdout) as {
      record: { checkId: string; trust: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const list = JSON.parse((await runCli(["smt", "list", root, "--json"])).stdout) as {
      total: number;
      checks: Array<{ checkId: string; trust: string; path: string }>;
    };

    expect(write.exitCode).toBe(0);
    expect(writeJson.record.trust).toBe("unverified");
    expect(writeJson.result.jsonPath).toContain(".theorem-workbench");
    expect(writeJson.result.markdownPath).toContain(".theorem-workbench");
    expect(list.total).toBe(1);
    expect(list.checks[0]).toMatchObject({
      checkId: writeJson.record.checkId,
      trust: "unverified"
    });
    expect(list.checks[0]?.path).toContain(".theorem-workbench/smt/");
  });

  it("generates workspace-local SMT-LIB from explicit constraints and checks it", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const result = await runCli([
      "smt",
      "solve",
      "--workspace",
      root,
      "--name",
      "small_positive_integer",
      "--int",
      "x",
      "--constraint",
      "x > 0",
      "--constraint",
      "x < 3",
      "--z3-command",
      "theorem-workbench-missing-z3-command",
      "--json",
      "--fail-on-unverified"
    ]);
    const json = JSON.parse(result.stdout) as {
      problem: { problemId: string; sourceText: string };
      sourceRef: string;
      check: { record: { trust: string; source: { path: string } }; jsonPath: string };
    };
    const list = JSON.parse((await runCli(["smt", "list", root, "--json"])).stdout) as { total: number };

    expect(result.exitCode).toBe(1);
    expect(json.problem.problemId).toMatch(/^smt_problem_[a-f0-9]{16}$/);
    expect(json.problem.sourceText).toContain("(assert (> x 0))");
    expect(json.sourceRef).toContain(".theorem-workbench/smt/sources/");
    expect(json.check.record.source.path).toBe(json.sourceRef);
    expect(json.check.record.trust).toBe("unverified");
    expect(json.check.jsonPath).toContain(".theorem-workbench");
    expect(list.total).toBe(1);
  });

  it("runs a policy-gated local code command and lists the code-run record", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const result = await runCli([
      "code",
      "run",
      "capture a tiny local code execution",
      "--workspace",
      root,
      "--title",
      "CLI code execution",
      "--command",
      process.execPath,
      "--allow-executable",
      process.execPath,
      "--arg",
      "-e",
      "--arg",
      "console.log('cli-code-run')",
      "--code",
      "inline:node-eval",
      "--input",
      "prompt:cli-code-run",
      "--output",
      "stdout",
      "--json",
      "--fail-on-nonzero"
    ]);
    const json = JSON.parse(result.stdout) as {
      record: {
        runId: string;
        execution: { status: string; exitCode: number };
        command: { shell: boolean };
        policy: { mode: string; matchedAllowlist: boolean; detected: { categories: string[] } };
        stdout: { text: string };
      };
      jsonPath: string;
    };
    const list = JSON.parse((await runCli(["code", "list", root, "--json"])).stdout) as {
      total: number;
      records: Array<{ runId: string; status: string }>;
    };

    expect(result.exitCode).toBe(0);
    expect(json.record.runId).toMatch(/^code_run_[a-f0-9]{16}$/);
    expect(json.record.command.shell).toBe(false);
    expect(json.record.policy).toMatchObject({
      mode: "default-local",
      matchedAllowlist: true,
      detected: { categories: [] }
    });
    expect(json.record.execution).toMatchObject({ status: "passed", exitCode: 0 });
    expect(json.record.stdout.text.trim()).toBe("cli-code-run");
    expect(json.jsonPath).toContain(".theorem-workbench");
    expect(list.total).toBe(1);
    expect(list.records[0]).toMatchObject({
      runId: json.record.runId,
      status: "passed"
    });
  });

  it("reports code-run sandbox status from the CLI", async () => {
    const result = await runCli(["code", "sandbox-status", "--json"]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      available: boolean;
      provider: string;
      canAttestNetworkNone: boolean;
    };

    expect(json.schemaVersion).toBe("theorem.code-run-sandbox-status.v0");
    expect(result.exitCode).toBe(json.available ? 0 : 1);
    if (json.available) {
      expect(json.provider).toBe("container");
      expect(json.canAttestNetworkNone).toBe(true);
    } else {
      expect(json.provider).toBe("none");
      expect(json.canAttestNetworkNone).toBe(false);
    }
  });

  it("repairs older workspace manifests from the CLI", async () => {
    const root = await tempRoot();
    const init = JSON.parse((await runCli(["workspace", "init", root, "--json"])).stdout) as {
      manifestPath: string;
      manifest: { directories: Record<string, string> };
    };
    const legacyManifest = {
      ...init.manifest,
      directories: { ...init.manifest.directories }
    };
    delete legacyManifest.directories["code-runs"];
    await rm(join(root, init.manifest.directories["code-runs"]), { recursive: true, force: true });
    await writeFile(init.manifestPath, `${JSON.stringify(legacyManifest, null, 2)}\n`, "utf8");

    const statusResult = await runCli(["workspace", "status", root, "--json"]);
    const status = JSON.parse(statusResult.stdout) as {
      manifestRepair?: { applied: boolean; addedDirectories: string[] };
      missingDirectories: string[];
    };
    const repair = JSON.parse((await runCli(["workspace", "repair", root, "--json"])).stdout) as {
      repaired: boolean;
      manifestRepair?: { applied: boolean; addedDirectories: string[] };
      createdDirectories: string[];
      missingDirectoriesAfter: string[];
    };
    const rawManifest = JSON.parse(await readFile(init.manifestPath, "utf8")) as { directories: Record<string, string> };

    expect(statusResult.exitCode).toBe(1);
    expect(status.manifestRepair).toEqual({ applied: false, addedDirectories: ["code-runs"] });
    expect(status.missingDirectories).toEqual([".theorem-workbench/code-runs"]);
    expect(repair.repaired).toBe(true);
    expect(repair.manifestRepair).toEqual({ applied: true, addedDirectories: ["code-runs"] });
    expect(repair.createdDirectories).toEqual([".theorem-workbench/code-runs"]);
    expect(repair.missingDirectoriesAfter).toEqual([]);
    expect(rawManifest.directories["code-runs"]).toBe(".theorem-workbench/code-runs");
  });

  it("writes, lists, compares, and gates benchmark artifacts", async () => {
    const root = await tempRoot();
    const passingSuite = join(root, "passing-suite.json");
    const failingSuite = join(root, "failing-suite.json");
    await writeSuite(passingSuite, {
      id: "cli-passing",
      title: "CLI Passing",
      description: "Passing benchmark suite for CLI gate coverage.",
      tasks: [
        {
          id: "exact-two-plus-two",
          prompt: "compute 2 + 2",
          expectTrust: "exact-computed",
          expectSummaryIncludes: "4"
        }
      ]
    });
    await writeSuite(failingSuite, {
      id: "cli-passing",
      title: "CLI Passing",
      description: "Failing benchmark suite for CLI gate coverage.",
      tasks: [
        {
          id: "exact-two-plus-two",
          prompt: "compute 2 + 2",
          expectTrust: "refuted"
        }
      ]
    });

    await runCli(["workspace", "init", root, "--json"]);
    const passing = await runCli(["bench", "run", passingSuite, "--workspace", root, "--write", "--json", "--fail-on-failures"]);
    const failing = await runCli(["bench", "run", failingSuite, "--workspace", root, "--write", "--json", "--fail-on-failures"]);
    const passingJson = JSON.parse(passing.stdout) as {
      run: { failed: number };
      result: { jsonPath: string };
    };
    const failingJson = JSON.parse(failing.stdout) as {
      run: { failed: number };
      result: { jsonPath: string };
    };
    const listBeforeCompare = JSON.parse((await runCli(["bench", "list", root, "--json"])).stdout) as { total: number };
    const comparison = await runCli([
      "bench",
      "compare",
      passingJson.result.jsonPath,
      failingJson.result.jsonPath,
      "--workspace",
      root,
      "--write",
      "--json",
      "--fail-on-regression"
    ]);
    const comparisonJson = JSON.parse(comparison.stdout) as {
      comparison: { verdict: string; summary: { regressions: number } };
      result: { jsonPath: string };
    };
    const listAfterCompare = JSON.parse((await runCli(["bench", "list", root, "--json"])).stdout) as { total: number };

    expect(passing.exitCode).toBe(0);
    expect(passingJson.run.failed).toBe(0);
    expect(failing.exitCode).toBe(1);
    expect(failingJson.run.failed).toBe(1);
    expect(listBeforeCompare.total).toBe(2);
    expect(comparison.exitCode).toBe(1);
    expect(comparisonJson.comparison.verdict).toBe("regressed");
    expect(comparisonJson.comparison.summary.regressions).toBe(1);
    expect(comparisonJson.result.jsonPath).toContain(".theorem-workbench");
    expect(listAfterCompare.total).toBe(3);
  });

  it("writes, lists, and shows claim ledger records", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const receiptsDir = join(root, ".theorem-workbench", "receipts");
    await mkdir(receiptsDir, { recursive: true });
    await writeFile(
      join(receiptsDir, "base-fraction.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4"), null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(receiptsDir, "fraction-sum.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4 + 5 / 8"), null, 2)}\n`,
      "utf8"
    );

    const base = await runCli([
      "claim",
      "add",
      "3 / 4 is exactly 3 / 4",
      "--workspace",
      root,
      "--domain",
      "math",
      "--trust",
      "exact-computed",
      "--tag",
      "fractions",
      "--evidence",
      "receipt:.theorem-workbench/receipts/base-fraction.json",
      "--json"
    ]);
    const baseJson = JSON.parse(base.stdout) as { claim: { claimId: string; trust: string } };
    const derived = await runCli([
      "claim",
      "add",
      "3 / 4 + 5 / 8 equals 11 / 8",
      "--workspace",
      root,
      "--domain",
      "math",
      "--trust",
      "exact-computed",
      "--depends-on",
      baseJson.claim.claimId,
      "--evidence",
      `claim:${baseJson.claim.claimId}`,
      "--evidence",
      "receipt:.theorem-workbench/receipts/fraction-sum.json",
      "--json"
    ]);
    const derivedJson = JSON.parse(derived.stdout) as {
      claim: { claimId: string; dependsOn: string[]; finalization: { readyForNarrowClaim: boolean } };
    };
    const list = JSON.parse((await runCli(["claim", "list", root, "--json"])).stdout) as {
      total: number;
      graph: { edges: Array<{ from: string; to: string; kind: string }> };
    };
    const shown = JSON.parse(
      (await runCli(["claim", "show", derivedJson.claim.claimId, "--workspace", root, "--json"])).stdout
    ) as { claimId: string; dependsOn: string[] };
    const review = JSON.parse(
      (await runCli(["claim", "review", derivedJson.claim.claimId, "--workspace", root, "--json"])).stdout
    ) as { claimId: string; reviewStatus: string; nextActions: unknown[]; markdown: string };
    const reviewText = await runCli(["claim", "review", derivedJson.claim.claimId, "--workspace", root]);

    expect(base.exitCode).toBe(0);
    expect(baseJson.claim.trust).toBe("exact-computed");
    expect(derived.exitCode).toBe(0);
    expect(derivedJson.claim.dependsOn).toEqual([baseJson.claim.claimId]);
    expect(derivedJson.claim.finalization.readyForNarrowClaim).toBe(true);
    expect(list.total).toBe(2);
    expect(list.graph.edges).toContainEqual({
      from: baseJson.claim.claimId,
      to: derivedJson.claim.claimId,
      kind: "depends-on"
    });
    expect(shown.claimId).toBe(derivedJson.claim.claimId);
    expect(review.claimId).toBe(derivedJson.claim.claimId);
    expect(review.reviewStatus).toBe("ready");
    expect(review.nextActions).toEqual([]);
    expect(review.markdown).toContain("## Agent Next Actions");
    expect(reviewText.exitCode).toBe(0);
    expect(reviewText.stdout).toContain("Claim review");
    expect(reviewText.stdout).toContain("Status: ready");
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
    await program.parseAsync(["node", "theorem", ...args], { from: "node" });
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

async function writeSuite(path: string, suite: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(suite, null, 2)}\n`, "utf8");
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-cli-"));
  roots.push(root);
  return root;
}
