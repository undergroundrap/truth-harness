import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReceipt } from "@truth-harness/core";
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
      "truth-harness-missing-maxima-command",
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
      "truth-harness-missing-maxima-command",
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
    expect(json.schemaVersion).toBe("truth-harness.cas-check.v0");
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
      "truth-harness-missing-maxima-command",
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
    expect(writeJson.result.jsonPath).toContain(".truth-harness");
    expect(writeJson.result.markdownPath).toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.checks[0]).toMatchObject({
      checkId: writeJson.record.checkId,
      trust: "unverified"
    });
    expect(list.checks[0]?.path).toContain(".truth-harness/cas/");
  });

  it("prints an engine manifest for humans and agents", async () => {
    const result = await runCli([
      "engines",
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
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
    expect(json.schemaVersion).toBe("truth-harness.engine-manifest.v0");
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

  it("renders teaching packets from saved receipts", async () => {
    const root = await tempRoot();
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    const receiptPath = join(root, "fraction-receipt.json");
    const outPath = join(root, "fraction-teaching.md");
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    const human = await runCli(["teach", receiptPath, "--audience", "college"]);
    const write = await runCli(["teach", receiptPath, "--audience", "high", "--out", outPath]);
    const json = JSON.parse((await runCli(["teach", receiptPath, "--json"])).stdout) as {
      packet: { schemaVersion: string; receiptRunId: string; audience: string; trust: string };
      markdown: string;
    };
    const writtenMarkdown = await readFile(outPath, "utf8");

    expect(human.exitCode).toBe(0);
    expect(human.stdout).toContain("# Teaching Packet:");
    expect(human.stdout).toContain("| Audience | `college` |");
    expect(human.stdout).toContain("| Trust | `exact-computed` |");
    expect(human.stdout).toContain("## Teaching Boundary");
    expect(write.exitCode).toBe(0);
    expect(write.stdout).toContain("Wrote teaching packet:");
    expect(writtenMarkdown).toContain("| Audience | `high` |");
    expect(json.packet).toMatchObject({
      schemaVersion: "truth-harness.teaching-packet.v0",
      receiptRunId: receipt.runId,
      audience: "college",
      trust: "exact-computed"
    });
    expect(json.markdown).toContain("## Assessment Rubric");
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
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
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
    expect(json.schemaVersion).toBe("truth-harness.verifier-route.v0");
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
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
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
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
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
    expect(written.result.jsonPath).toContain(".truth-harness");
    expect(written.result.markdownPath).toContain(".truth-harness");
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
    expect(shown.replay).toContain("truth-harness verify");
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
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
    ]);
    const written = JSON.parse(write.stdout) as {
      route: {
        routeId: string;
        proofObligations: Array<{ obligationId: string; kind: string; status: string }>;
      };
    };
    const proofRef = join(".truth-harness", "proofs", "manual-proof.json");
    await mkdir(join(root, ".truth-harness", "proofs"), { recursive: true });
    await writeFile(
      join(root, proofRef),
      `${JSON.stringify(
        {
          schemaVersion: "truth-harness.proof-check.v0",
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
          replay: "truth-harness proof check manual-proof.lean --write --json",
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
      schemaVersion: "truth-harness.proof-check.v0"
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
      "truth-harness-missing-lean-command",
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
      "truth-harness-missing-lean-command",
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
    expect(json.schemaVersion).toBe("truth-harness.proof-check.v0");
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
      "truth-harness-missing-lean-command",
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
    expect(writeJson.result.jsonPath).toContain(".truth-harness");
    expect(writeJson.result.markdownPath).toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.checks[0]).toMatchObject({
      checkId: writeJson.record.checkId,
      trust: "unverified"
    });
    expect(list.checks[0]?.path).toContain(".truth-harness/proofs/");
  });

  it("reports SMT backend status without requiring Z3 to be installed", async () => {
    const result = await runCli(["smt", "backends", "--z3-command", "truth-harness-missing-z3-command", "--json"]);
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
      "truth-harness-missing-z3-command",
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
    expect(json.schemaVersion).toBe("truth-harness.smt-check.v0");
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
      "truth-harness-missing-z3-command",
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
    expect(writeJson.result.jsonPath).toContain(".truth-harness");
    expect(writeJson.result.markdownPath).toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.checks[0]).toMatchObject({
      checkId: writeJson.record.checkId,
      trust: "unverified"
    });
    expect(list.checks[0]?.path).toContain(".truth-harness/smt/");
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
      "truth-harness-missing-z3-command",
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
    expect(json.sourceRef).toContain(".truth-harness/smt/sources/");
    expect(json.check.record.source.path).toBe(json.sourceRef);
    expect(json.check.record.trust).toBe("unverified");
    expect(json.check.jsonPath).toContain(".truth-harness");
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
    expect(json.jsonPath).toContain(".truth-harness");
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

    expect(json.schemaVersion).toBe("truth-harness.code-run-sandbox-status.v0");
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
    expect(status.missingDirectories).toEqual([".truth-harness/code-runs"]);
    expect(repair.repaired).toBe(true);
    expect(repair.manifestRepair).toEqual({ applied: true, addedDirectories: ["code-runs"] });
    expect(repair.createdDirectories).toEqual([".truth-harness/code-runs"]);
    expect(repair.missingDirectoriesAfter).toEqual([]);
    expect(rawManifest.directories["code-runs"]).toBe(".truth-harness/code-runs");
  });

  it("prints bounded workspace review packets from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    await runCli([
      "verify",
      "compute 3 / 4 + 5 / 8",
      "--workspace",
      root,
      "--write",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--timeout-ms",
      "50",
      "--json"
    ]);
    await runCli([
      "claim",
      "add",
      "A blocked finance claim needs evidence.",
      "--workspace",
      root,
      "--domain",
      "finance",
      "--next-check",
      "Attach audited source data before using this claim.",
      "--json"
    ]);

    const reviewResult = await runCli(["workspace", "review", root, "--max-routes", "1", "--max-claims", "0", "--json"]);
    const review = JSON.parse(reviewResult.stdout) as {
      schemaVersion: string;
      reviewId: string;
      localOnly: boolean;
      networkAccess: string;
      summary: { routes: number; claims: number };
      markdown: string;
    };
    const writeResult = await runCli(["workspace", "review", root, "--max-routes", "1", "--max-claims", "0", "--write", "--json"]);
    const written = JSON.parse(writeResult.stdout) as {
      written: true;
      review: { reviewId: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const reviewList = JSON.parse((await runCli(["workspace", "reviews", root, "--json"])).stdout) as {
      total: number;
      reviews: Array<{ reviewId: string; path: string; totalItems: number }>;
    };
    const reviewShow = JSON.parse(
      (await runCli(["workspace", "show-review", written.review.reviewId, "--workspace", root, "--json"])).stdout
    ) as { reviewId: string; summary: { routes: number } };
    const graph = JSON.parse((await runCli(["workspace", "graph", root, "--json"])).stdout) as {
      schemaVersion: string;
      localOnly: boolean;
      networkAccess: string;
      summary: { nodes: number; artifacts: number };
    };
    const reviewListText = await runCli(["workspace", "reviews", root]);
    const reviewText = await runCli(["workspace", "review", root, "--max-routes", "1", "--max-claims", "0", "--write"]);
    const graphText = await runCli(["workspace", "graph", root]);

    expect(reviewResult.exitCode).toBe(0);
    expect(review.schemaVersion).toBe("truth-harness.workspace-review.v0");
    expect(review.reviewId).toMatch(/^wrev_[a-f0-9]{16}$/u);
    expect(review.localOnly).toBe(true);
    expect(review.networkAccess).toBe("none");
    expect(review.summary.routes).toBe(1);
    expect(review.summary.claims).toBe(0);
    expect(review.markdown).toContain("## Ordered Work Queue");
    expect(writeResult.exitCode).toBe(0);
    expect(written.written).toBe(true);
    expect(written.review.reviewId).toMatch(/^wrev_[a-f0-9]{16}$/u);
    expect(written.result.jsonPath.replace(/\\/g, "/")).toContain(".truth-harness/findings/");
    expect(written.result.markdownPath.replace(/\\/g, "/")).toContain(".truth-harness/findings/");
    expect(await readFile(written.result.markdownPath, "utf8")).toContain("## Ordered Work Queue");
    expect(reviewList.total).toBe(1);
    expect(reviewList.reviews[0]).toMatchObject({
      reviewId: written.review.reviewId,
      path: expect.stringContaining(`${written.review.reviewId}-workspace-review.json`)
    });
    expect(reviewShow.reviewId).toBe(written.review.reviewId);
    expect(reviewShow.summary.routes).toBe(1);
    expect(graph.schemaVersion).toBe("truth-harness.workspace-graph.v0");
    expect(graph.localOnly).toBe(true);
    expect(graph.networkAccess).toBe("none");
    expect(graph.summary.nodes).toBeGreaterThan(0);
    expect(graph.summary.artifacts).toBeGreaterThan(0);
    expect(reviewListText.stdout).toContain("Truth Harness workspace reviews: 1");
    expect(reviewListText.stdout).toContain(written.review.reviewId);
    expect(reviewText.stdout).toContain("Truth Harness workspace review");
    expect(reviewText.stdout).toContain("Queue items:");
    expect(reviewText.stdout).toContain("Markdown:");
    expect(graphText.stdout).toContain("Truth Harness workspace graph");
    expect(graphText.stdout).toContain("Nodes:");
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
    expect(comparisonJson.result.jsonPath).toContain(".truth-harness");
    expect(listAfterCompare.total).toBe(3);
  });

  it("writes, lists, and shows claim ledger records", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const receiptsDir = join(root, ".truth-harness", "receipts");
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
      "receipt:.truth-harness/receipts/base-fraction.json",
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
      "receipt:.truth-harness/receipts/fraction-sum.json",
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

  it("starts, checkpoints, lists, and shows research sessions", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const start = await runCli([
      "research",
      "start",
      "Investigate a reusable exact arithmetic proof route.",
      "--workspace",
      root,
      "--domain",
      "math",
      "--task",
      "Create a verifier route",
      "--json"
    ]);
    const started = JSON.parse(start.stdout) as {
      session: { sessionId: string; schemaVersion: string; tasks: Array<{ taskId: string; status: string }> };
    };
    const checkpoint = await runCli([
      "research",
      "checkpoint",
      started.session.sessionId,
      "Recorded the next verification step for the session.",
      "--workspace",
      root,
      "--next-check",
      "Attach a workspace review handoff before delegating.",
      "--json"
    ]);
    const taskUpdate = JSON.parse(
      (
        await runCli([
          "research",
          "task",
          started.session.sessionId,
          started.session.tasks[0]?.taskId ?? "",
          "--workspace",
          root,
          "--status",
          "blocked",
          "--next-check",
          "Attach a workspace review handoff before delegating.",
          "--json"
        ])
      ).stdout
    ) as { task: { taskId: string; status: string; nextChecks: string[] } };
    const shown = JSON.parse(
      (await runCli(["research", "show", started.session.sessionId, "--workspace", root, "--json"])).stdout
    ) as { sessionId: string; checkpoints: unknown[] };
    const list = JSON.parse((await runCli(["research", "list", root, "--json"])).stdout) as { total: number };
    const humanShow = await runCli(["research", "show", started.session.sessionId, "--workspace", root]);
    const handoff = JSON.parse(
      (
        await runCli([
          "workspace",
          "review",
          root,
          "--max-routes",
          "0",
          "--max-claims",
          "0",
          "--max-sessions",
          "1",
          "--json"
        ])
      ).stdout
    ) as {
      summary: { sessions: number; sessionTasks: number; sessionNextChecks: number };
      items: Array<{ kind: string; sessionId?: string; command: string }>;
    };

    expect(start.exitCode).toBe(0);
    expect(started.session.schemaVersion).toBe("truth-harness.research-session.v0");
    expect(started.session.sessionId).toMatch(/^session_[a-f0-9]{16}$/u);
    expect(started.session.tasks).toHaveLength(1);
    expect(checkpoint.exitCode).toBe(0);
    expect(taskUpdate.task.status).toBe("blocked");
    expect(taskUpdate.task.nextChecks).toContain("Attach a workspace review handoff before delegating.");
    expect(shown.sessionId).toBe(started.session.sessionId);
    expect(shown.checkpoints).toHaveLength(1);
    expect(list.total).toBe(1);
    expect(humanShow.stdout).toContain(`Truth Harness research session ${started.session.sessionId}`);
    expect(humanShow.stdout).toContain("Recent checkpoints:");
    expect(handoff.summary.sessions).toBe(1);
    expect(handoff.summary.sessionTasks).toBe(1);
    expect(handoff.summary.sessionNextChecks).toBe(1);
    expect(handoff.items).toContainEqual(
      expect.objectContaining({
        kind: "session-task",
        sessionId: started.session.sessionId,
        command: expect.stringContaining("truth-harness research show")
      })
    );
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

async function writeSuite(path: string, suite: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(suite, null, 2)}\n`, "utf8");
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-cli-"));
  roots.push(root);
  return root;
}
