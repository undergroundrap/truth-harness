import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDiscoveryPackage, writeDiscoveryPackage } from "./discovery-package.js";
import { createInventionLogEntry } from "./invention-log.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { createReceipt } from "./receipt.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("discovery packages", () => {
  it("renders a local invention package with resolved receipt evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    const receipt = createReceipt("for all integers n, n^2+n is even");
    await writeFile(join(root, ".truth-harness", "receipts", "parity-check.json"), JSON.stringify(receipt, null, 2));
    const invention = await createInventionLogEntry({
      rootPath: root,
      title: "Parity check packaging",
      problem: "Package a verified math result without overclaiming discovery.",
      hypothesis: "A local exact-check receipt can support a narrow mathematical claim.",
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/parity-check.json" }],
      nextChecks: ["Have a human review the formal statement."],
      now: "2026-06-08T01:00:00.000Z"
    });

    const pkg = await createDiscoveryPackage({
      rootPath: root,
      entryId: invention.entry.entryId,
      now: "2026-06-08T02:00:00.000Z"
    });

    expect(pkg.schemaVersion).toBe("truth-harness.discovery-package.v0");
    expect(pkg.evidenceReviews[0]?.status).toBe("resolved");
    expect(pkg.evidenceReviews[0]?.trust).toBe("exact-computed");
    expect(pkg.validation.resolvedReceiptCount).toBe(1);
    expect(pkg.markdown).toContain("# Discovery Package: Parity check packaging");
    expect(pkg.markdown).toContain("not-a-legal-opinion");
  });

  it("warns for source-cited receipt evidence because retrieval is not proof", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    const receipt = {
      ...createReceipt("compute 2 + 2"),
      trust: "source-cited" as const,
      summary: "Source-cited: local note mentions the claim."
    };
    await writeFile(join(root, ".truth-harness", "receipts", "source.json"), JSON.stringify(receipt, null, 2));
    const invention = await createInventionLogEntry({
      rootPath: root,
      hypothesis: "A source-cited receipt should be treated as evidence, not proof.",
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/source.json" }],
      now: "2026-06-08T01:00:00.000Z"
    });

    const pkg = await createDiscoveryPackage({ rootPath: root, entryId: invention.entry.entryId });

    expect(pkg.evidenceReviews[0]?.warnings[0]).toContain("not proof of entailment");
    expect(pkg.markdown).toContain("Evidence Warnings");
  });

  it("marks missing receipt evidence instead of hiding it", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const invention = await createInventionLogEntry({
      rootPath: root,
      hypothesis: "Missing evidence should be visible.",
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/missing.json" }],
      now: "2026-06-08T01:00:00.000Z"
    });

    const pkg = await createDiscoveryPackage({ rootPath: root, entryId: invention.entry.entryId });

    expect(pkg.evidenceReviews[0]?.status).toBe("missing");
    expect(pkg.validation.unresolvedEvidenceCount).toBe(1);
    expect(pkg.markdown).toContain("Missing receipt evidence");
  });

  it("marks invalid receipt evidence as unresolved instead of trusting stale JSON", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    const legacyReceipt = { ...createReceipt("for all integers n, n^2+n is even") } as Record<string, unknown>;
    delete legacyReceipt.evidenceProfile;
    await writeFile(join(root, ".truth-harness", "receipts", "legacy.json"), JSON.stringify(legacyReceipt, null, 2));
    const invention = await createInventionLogEntry({
      rootPath: root,
      hypothesis: "Invalid receipt evidence should not count as a resolved discovery input.",
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/legacy.json" }],
      now: "2026-06-08T01:00:00.000Z"
    });

    const pkg = await createDiscoveryPackage({ rootPath: root, entryId: invention.entry.entryId });
    const review = pkg.evidenceReviews[0];

    expect(review?.status).toBe("missing");
    expect(review?.summary).toContain("failed receipt schema validation");
    expect(review?.warnings.join(" ")).toContain("Invalid receipt evidence");
    expect(review?.warnings.join(" ")).toContain("$.evidenceProfile");
    expect(pkg.validation.resolvedReceiptCount).toBe(0);
    expect(pkg.validation.unresolvedEvidenceCount).toBe(1);
    expect(pkg.markdown).toContain("Invalid receipt evidence");
  });

  it("keeps external disclosure refs as provenance instead of proof", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const invention = await createInventionLogEntry({
      rootPath: root,
      hypothesis: "A frontier model critique can guide checks without proving the hypothesis.",
      evidenceRefs: [
        {
          kind: "disclosure",
          ref: ".truth-harness/disclosures/2026-06-08-dis_abc123.json",
          summary: "Frontier model critique request."
        }
      ],
      now: "2026-06-08T01:00:00.000Z"
    });

    const pkg = await createDiscoveryPackage({ rootPath: root, entryId: invention.entry.entryId });

    expect(pkg.evidenceReviews[0]?.kind).toBe("disclosure");
    expect(pkg.evidenceReviews[0]?.status).toBe("referenced");
    expect(pkg.evidenceReviews[0]?.warnings[0]).toContain("do not prove the external model or service output is true");
  });

  it("keeps simulation refs as computational evidence instead of real-world validation", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const invention = await createInventionLogEntry({
      rootPath: root,
      hypothesis: "A simulation record can motivate a next experiment without validating a discovery.",
      evidenceRefs: [
        {
          kind: "simulation",
          ref: ".truth-harness/simulations/2026-06-08-sim_abc123.json",
          summary: "Toy simulation output."
        }
      ],
      now: "2026-06-08T01:00:00.000Z"
    });

    const pkg = await createDiscoveryPackage({ rootPath: root, entryId: invention.entry.entryId });

    expect(pkg.evidenceReviews[0]?.kind).toBe("simulation");
    expect(pkg.evidenceReviews[0]?.status).toBe("referenced");
    expect(pkg.evidenceReviews[0]?.warnings[0]).toContain("do not establish experimental validity");
  });

  it("keeps experiment refs scoped to protocol-specific provenance", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const invention = await createInventionLogEntry({
      rootPath: root,
      hypothesis: "An experiment record can support review without proving broad clinical or safety claims.",
      evidenceRefs: [
        {
          kind: "experiment",
          ref: ".truth-harness/experiments/2026-06-08-exp_abc123.json",
          summary: "Toy bench observation."
        }
      ],
      now: "2026-06-08T01:00:00.000Z"
    });

    const pkg = await createDiscoveryPackage({ rootPath: root, entryId: invention.entry.entryId });

    expect(pkg.evidenceReviews[0]?.kind).toBe("experiment");
    expect(pkg.evidenceReviews[0]?.status).toBe("referenced");
    expect(pkg.evidenceReviews[0]?.warnings[0]).toContain("specific protocol and dataset");
  });

  it("writes discovery packages into local findings", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await createInventionLogEntry({
      rootPath: root,
      title: "Local report",
      hypothesis: "A local report can be generated.",
      now: "2026-06-08T01:00:00.000Z"
    });

    const result = await writeDiscoveryPackage({ rootPath: root, now: "2026-06-08T02:00:00.000Z" });

    expect(result.path.replace(/\\/g, "/")).toContain(".truth-harness/findings/");
    expect(await readFile(result.path, "utf8")).toContain("# Discovery Package: Local report");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-discovery-package-"));
  roots.push(root);
  return root;
}
