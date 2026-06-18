import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  addResearchSessionCheckpoint,
  createResearchHarnessTasks,
  createResearchSession,
  listResearchSessions,
  readResearchSession,
  updateResearchSessionTask,
  writeResearchHarness,
  writeResearchSession
} from "./research-session.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { writeWorkspaceReview } from "./workspace-review.js";
import { writeWorkspaceSnapshot } from "./workspace-snapshot.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("research sessions", () => {
  it("creates a local-first research runbook with safety and patent boundaries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const snapshot = await writeWorkspaceSnapshot({
      rootPath: root,
      now: "2026-06-08T00:10:00.000Z"
    });

    const session = await createResearchSession({
      rootPath: root,
      title: "Cancer pathway hypothesis",
      objective: "Investigate whether a simulated cancer pathway perturbation is worth expert review and prior-art search.",
      domains: ["biomedical", "patent"],
      hypotheses: ["A simulated perturbation may lower a toy pathway score."],
      claims: ["The toy simulation produced computational evidence only."],
      evidenceRefs: [{ kind: "snapshot", ref: snapshot.snapshot.snapshotId, summary: "Initial private workspace state." }],
      snapshotRefs: [snapshot.snapshot.snapshotId],
      tasks: ["Create a local evidence audit", "Search prior art before drafting any claim language"],
      maxDepth: 3,
      maxToolCalls: 25,
      now: "2026-06-08T00:20:00.000Z"
    });

    expect(session.schemaVersion).toBe("truth-harness.research-session.v0");
    expect(session.sessionId).toMatch(/^session_[a-f0-9]{16}$/);
    expect(session.privacy.mode).toBe("local-only");
    expect(session.modelPolicy.hostedModels).toBe("optional-with-disclosure");
    expect(session.reviewBoundary.wetLabValidationRequired).toBe(true);
    expect(session.reviewBoundary.patentAttorneyReviewRequired).toBe(true);
    expect(session.budgets.maxUnverifiedFinalClaims).toBe(0);
    expect(session.tasks).toHaveLength(2);
    expect(session.markdown).toContain("# Research Session: Cancer pathway hypothesis");
    expect(session.markdown).toContain("Do not describe biomedical hypotheses as cures");
  });

  it("starts a hard-problem harness with default verification lanes and no overclaim path", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });

    const result = await writeResearchHarness({
      rootPath: root,
      objective:
        "Investigate a deterministic math and physics validation layer for AI-generated robotics simulation code.",
      domains: ["math", "physics", "code"],
      tasks: ["Identify the first reusable lemma or benchmark that would change the design."],
      now: "2026-06-18T00:10:00.000Z"
    });
    const taskTitles = result.session.tasks.map((task) => task.title);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(result.session.schemaVersion).toBe("truth-harness.research-session.v0");
    expect(result.validationPlan?.plan.schemaVersion).toBe("truth-harness.validation-plan.v0");
    expect(result.validationPlan?.plan.claim).toBe(
      "Investigate a deterministic math and physics validation layer for AI-generated robotics simulation code."
    );
    expect(result.validationPlan?.plan.objective).toContain(result.session.sessionId);
    expect(result.validationPlan?.plan.domains).toEqual(expect.arrayContaining(["math", "physics", "software"]));
    expect(result.validationPlan?.plan.domains).toHaveLength(3);
    expect(result.validationPlan?.plan.evidenceRefs).toContainEqual(
      expect.objectContaining({ kind: "session", ref: result.session.sessionId })
    );
    expect(result.session.budgets.maxUnverifiedFinalClaims).toBe(0);
    expect(result.session.modelPolicy.selectedContextOnly).toBe(true);
    expect(result.session.reviewBoundary.expertReviewRequired).toBe(true);
    expect(taskTitles).toContain("Create validation plans for candidate claims before trying to strengthen them.");
    expect(taskTitles).toContain(
      "Run `truth-harness engines readiness` and record which trust labels this machine can responsibly support."
    );
    expect(taskTitles).toContain(
      "Never label a result `proved` unless an accepted proof checker verifies the concrete proof artifact."
    );
    expect(taskTitles).toContain(
      "Record units, dimensional checks, governing equations, numerical assumptions, and simulation boundaries before interpreting any physics result."
    );
    expect(taskTitles).toContain(
      "Turn generated code into tests, benchmarks, fuzz cases, static checks, and replayable build records before trusting it."
    );
    expect(taskTitles).toContain("Identify the first reusable lemma or benchmark that would change the design.");
    expect(result.markdown).toContain("truth-harness engines readiness");
    expect(validation.passed).toBe(true);
  });

  it("can generate a compact custom harness task list without default lanes", () => {
    const tasks = createResearchHarnessTasks({
      objective: "Investigate a cancer literature hypothesis with prior-art implications.",
      domains: ["biomedical", "patent"],
      includeDefaultTasks: false,
      tasks: ["Write the exact review question.", "Write the exact review question."]
    });

    expect(tasks).toEqual(["Write the exact review question."]);
  });

  it("writes, lists, and checkpoints sessions with merged evidence refs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const write = await writeResearchSession({
      rootPath: root,
      objective: "Build a proof plan for a parity truth-harness.",
      domains: ["math"],
      evidenceRefs: [{ kind: "receipt", ref: "receipts/seed.json", trust: "unverified" }],
      tasks: ["Formalize the claim", "Run the local parity checker"],
      now: "2026-06-08T00:10:00.000Z"
    });

    const checkpoint = await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: write.session.sessionId,
      summary: "The local parity checker produced an exact modular certificate for the normalized polynomial claim.",
      evidenceRefs: [{ kind: "receipt", ref: "receipts/parity-check.json", trust: "exact-computed" }],
      snapshotRefs: ["snap_0123456789abcdef"],
      decisions: ["Use the exact-check receipt as narrow local evidence while reserving `proved` for Lean."],
      nextChecks: ["Render the receipt into the final report."],
      now: "2026-06-08T00:20:00.000Z"
    });
    const list = await listResearchSessions(root);
    const shownById = await readResearchSession(root, write.session.sessionId);
    const shownByPath = await readResearchSession(root, write.jsonPath);

    expect(write.jsonPath).toContain(".truth-harness");
    expect(write.markdownPath).toContain(".truth-harness");
    expect(JSON.parse(await readFile(write.jsonPath, "utf8")).sessionId).toBe(write.session.sessionId);
    expect(checkpoint.checkpoint.checkpointId).toMatch(/^chk_[a-f0-9]{16}$/);
    expect(checkpoint.session.evidenceRefs.map((ref) => `${ref.kind}:${ref.ref}`)).toEqual([
      "receipt:receipts/seed.json",
      "receipt:receipts/parity-check.json"
    ]);
    expect(checkpoint.session.snapshotRefs).toEqual(["snap_0123456789abcdef"]);
    expect(checkpoint.markdown).toContain("exact modular certificate");
    expect(list).toHaveLength(1);
    expect(list[0]?.checkpoints).toHaveLength(1);
    expect(shownById.sessionId).toBe(write.session.sessionId);
    expect(shownByPath.sessionId).toBe(write.session.sessionId);
  });

  it("rejects malformed research sessions before writing artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });

    await expect(
      writeResearchSession({
        rootPath: root,
        objective: "Track a malformed research session write boundary.",
        now: "not-a-date"
      })
    ).rejects.toThrow("Research session failed JSON Schema validation before write");

    await expect(listResearchSessions(root)).resolves.toEqual([]);
  });

  it("rejects malformed checkpoint updates before rewriting session history", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const write = await writeResearchSession({
      rootPath: root,
      objective: "Keep malformed agent checkpoints out of durable session history.",
      domains: ["math"],
      now: "2026-06-08T00:10:00.000Z"
    });

    await expect(
      addResearchSessionCheckpoint({
        rootPath: root,
        sessionRef: write.session.sessionId,
        summary: "This checkpoint has malformed metadata.",
        now: "not-a-date"
      })
    ).rejects.toThrow("Research session failed JSON Schema validation before write");

    const shown = await readResearchSession(root, write.session.sessionId);
    expect(shown.updatedAt).toBe("2026-06-08T00:10:00.000Z");
    expect(shown.checkpoints).toEqual([]);
  });

  it("updates research-session tasks with evidence-gated statuses", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-13T00:00:00.000Z" });
    const write = await writeResearchSession({
      rootPath: root,
      objective: "Build a reusable proof route for exact fraction arithmetic.",
      domains: ["math"],
      tasks: ["Attach a proof artifact", "Run a second checker"],
      now: "2026-06-13T00:10:00.000Z"
    });
    const review = await writeWorkspaceReview({
      rootPath: root,
      now: "2026-06-13T00:10:30.000Z"
    });
    const task = write.session.tasks[0];

    await expect(
      updateResearchSessionTask({
        rootPath: root,
        sessionRef: write.session.sessionId,
        taskRef: task.taskId,
        status: "done",
        now: "2026-06-13T00:11:00.000Z"
      })
    ).rejects.toThrow("at least one evidence ref");

    const blocked = await updateResearchSessionTask({
      rootPath: root,
      sessionRef: write.session.sessionId,
      taskRef: "Run a second checker",
      status: "blocked",
      nextChecks: ["Install or attach an independent CAS/SMT artifact."],
      now: "2026-06-13T00:12:00.000Z"
    });
    const done = await updateResearchSessionTask({
      rootPath: root,
      sessionRef: write.session.sessionId,
      taskRef: task.taskId,
      status: "done",
      evidenceRefs: [{ kind: "workspace-review", ref: review.review.reviewId, summary: "Handoff packet used for the proof task." }],
      now: "2026-06-13T00:13:00.000Z"
    });
    const shown = await readResearchSession(root, write.session.sessionId);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(blocked.task.status).toBe("blocked");
    expect(blocked.task.nextChecks).toEqual(["Install or attach an independent CAS/SMT artifact."]);
    expect(done.task.status).toBe("done");
    expect(done.task.evidenceRefs).toContainEqual(
      expect.objectContaining({ kind: "workspace-review", ref: review.review.reviewId })
    );
    expect(done.session.evidenceRefs).toContainEqual(
      expect.objectContaining({ kind: "workspace-review", ref: review.review.reviewId })
    );
    expect(done.markdown).toContain(`workspace-review:${review.review.reviewId}`);
    expect(shown.tasks.map((entry) => entry.status)).toEqual(["done", "blocked"]);
    expect(validation.passed).toBe(true);
  });

  it("cites persisted workspace review handoffs from long-running sessions", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-13T00:00:00.000Z" });
    const review = await writeWorkspaceReview({
      rootPath: root,
      now: "2026-06-13T00:05:00.000Z"
    });
    const write = await writeResearchSession({
      rootPath: root,
      objective: "Continue from a persisted agent handoff queue without relying on chat memory.",
      domains: ["math"],
      evidenceRefs: [
        {
          kind: "workspace-review",
          ref: review.review.reviewId,
          summary: "Initial local handoff queue."
        }
      ],
      now: "2026-06-13T00:10:00.000Z"
    });

    const checkpoint = await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: write.session.sessionId,
      summary: "Agent resumed from the persisted workspace review queue.",
      evidenceRefs: [
        {
          kind: "workspace-review",
          ref: review.review.reviewId,
          summary: "Queue used for this continuation."
        }
      ],
      now: "2026-06-13T00:20:00.000Z"
    });
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(checkpoint.session.evidenceRefs).toContainEqual(
      expect.objectContaining({
        kind: "workspace-review",
        ref: review.review.reviewId
      })
    );
    expect(checkpoint.markdown).toContain("workspace-review");
    expect(validation.passed).toBe(true);
  });

  it("serializes concurrent checkpoints so parallel agents do not lose session history", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const write = await writeResearchSession({
      rootPath: root,
      objective: "Coordinate two local agents updating the same research session.",
      domains: ["math"],
      now: "2026-06-14T00:10:00.000Z"
    });

    await Promise.all([
      addResearchSessionCheckpoint({
        rootPath: root,
        sessionRef: write.session.sessionId,
        summary: "Agent A attached the algebra branch.",
        now: "2026-06-14T00:20:00.000Z"
      }),
      addResearchSessionCheckpoint({
        rootPath: root,
        sessionRef: write.session.sessionId,
        summary: "Agent B attached the proof branch.",
        now: "2026-06-14T00:21:00.000Z"
      })
    ]);
    const shown = await readResearchSession(root, write.session.sessionId);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(shown.checkpoints.map((checkpoint) => checkpoint.summary).sort()).toEqual([
      "Agent A attached the algebra branch.",
      "Agent B attached the proof branch."
    ]);
    expect(validation.passed).toBe(true);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-research-session-"));
  roots.push(root);
  return root;
}
