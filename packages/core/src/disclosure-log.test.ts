import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createExternalDisclosureLogEntry,
  listExternalDisclosureLogEntries
} from "./disclosure-log.js";
import { initLocalWorkspace } from "./local-workspace.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("external disclosure logs", () => {
  it("requires a local workspace before recording external calls", async () => {
    const root = await tempRoot();

    await expect(
      createExternalDisclosureLogEntry({
        rootPath: root,
        service: "OpenAI",
        purpose: "Review a selected derivation.",
        dataClasses: ["selected prompt"],
        contextSummary: "A short math derivation excerpt."
      })
    ).rejects.toThrow("No Truth Harness workspace found");
  });

  it("writes local audit records for hosted model disclosures", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Disclosure Lab",
      now: "2026-06-08T00:00:00.000Z"
    });

    const result = await createExternalDisclosureLogEntry({
      rootPath: root,
      service: "OpenAI",
      model: "frontier-reasoning-model",
      purpose: "Ask a frontier model to critique a proof plan.",
      dataClasses: ["selected formal statement", "selected proof sketch"],
      contextSummary: "Only the formal statement and proof sketch are sent; local corpus files stay local.",
      selectedContextRefs: ["receipt:.truth-harness/receipts/proof-plan.json"],
      approvalRef: "prompt:2026-06-08-user-approved-frontier-critique",
      status: "sent",
      now: "2026-06-08T01:00:00.000Z"
    });
    const entries = await listExternalDisclosureLogEntries(root);

    expect(result.path).toContain(join(".truth-harness", "disclosures"));
    expect(result.entry.schemaVersion).toBe("truth-harness.disclosure.v0");
    expect(result.entry.disclosureId).toMatch(/^dis_[a-f0-9]{16}$/);
    expect(result.entry.privacy.mode).toBe("external-calls");
    expect(result.entry.privacy.externalDisclosures[0]).toEqual({
      service: "OpenAI",
      purpose: "Ask a frontier model to critique a proof plan.",
      dataClasses: ["selected formal statement", "selected proof sketch"],
      userInitiated: true
    });
    expect(result.entry.warnings.join("\n")).toContain("audit metadata");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.disclosureId).toBe(result.entry.disclosureId);
  });

  it("warns when disclosure metadata implies risky external context", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    const result = await createExternalDisclosureLogEntry({
      rootPath: root,
      service: "External Lab API",
      purpose: "Run an external simulation.",
      dataClasses: ["patient health notes", "selected molecular hypothesis"],
      contextSummary: "A health-related hypothesis packet.",
      userInitiated: false,
      status: "sent"
    });

    expect(result.entry.warnings).toContain(
      "This disclosure is not marked user-initiated; do not send context until a human explicitly approves it."
    );
    expect(result.entry.warnings).toContain(
      "Sent/received disclosures should include an approvalRef pointing to the human instruction, issue, or prompt."
    );
    expect(result.entry.warnings).toContain(
      "Data classes mention secrets, credentials, health, or personal data; review minimization and consent before sending."
    );
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-disclosure-"));
  roots.push(root);
  return root;
}
