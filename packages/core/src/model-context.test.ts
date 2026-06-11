import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { createModelContext, listModelContexts, renderModelContextMarkdown, writeModelContext } from "./model-context.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("model context packets", () => {
  it("requires a local workspace before preparing hosted model context", async () => {
    const root = await tempRoot();

    await expect(
      createModelContext({
        rootPath: root,
        service: "OpenAI",
        purpose: "Ask a frontier model to critique a selected proof plan."
      })
    ).rejects.toThrow("No Theorem workspace found");
  });

  it("writes local-only preflight packets without performing external calls", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    const result = await writeModelContext({
      rootPath: root,
      service: "OpenAI",
      model: "frontier-reasoning-model",
      purpose: "Ask a frontier model to critique a selected proof plan.",
      dataClasses: ["selected theorem statement", "selected proof sketch"],
      selectedContextRefs: ["receipt:.theorem-workbench/receipts/proof-plan.json"],
      sections: [
        {
          title: "Selected proof plan",
          content: "The claim is n^2+n is even for all integers n. Please critique only this proof sketch.",
          sourceRefs: ["receipt:.theorem-workbench/receipts/proof-plan.json"]
        }
      ],
      redactions: ["Workspace notes, vault plaintext, and unrelated receipts are excluded."],
      approvalRef: "prompt:2026-06-08-user-approved-frontier-critique",
      approvedBy: "user",
      approvedAt: "2026-06-08T01:00:00.000Z",
      now: "2026-06-08T01:00:00.000Z"
    });
    const packets = await listModelContexts(root);

    expect(result.jsonPath).toContain(join(".theorem-workbench", "model-contexts"));
    expect(result.packet.schemaVersion).toBe("theorem.model-context.v0");
    expect(result.packet.packetId).toMatch(/^ctx_[a-f0-9]{16}$/);
    expect(result.packet.privacy.mode).toBe("local-only");
    expect(result.packet.boundary.externalCallNotPerformed).toBe(true);
    expect(result.packet.approval.status).toBe("approved");
    expect(result.packet.disclosure.status).toBe("required-not-created");
    expect(result.packet.warnings.join("\n")).toContain("disclosure log is required");
    expect(result.markdown).toContain("It did not call a hosted model");
    expect(packets).toHaveLength(1);
    expect(packets[0]?.packetId).toBe(result.packet.packetId);
  });

  it("warns on unapproved sensitive hosted context and keeps local model packets disclosure-free", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    const hosted = await createModelContext({
      rootPath: root,
      service: "External Lab API",
      target: "external-service",
      purpose: "Review a sensitive biomedical hypothesis.",
      dataClasses: ["patient health notes", "selected molecular hypothesis"],
      sections: [
        {
          title: "Sensitive hypothesis",
          content: "Patient health detail and personal identifier should not be sent without consent.",
          sourceRefs: []
        }
      ]
    });
    const local = await createModelContext({
      rootPath: root,
      service: "local-llama",
      target: "local-model",
      purpose: "Summarize local-only notes.",
      dataClasses: ["selected local notes"],
      sections: [{ title: "Local note", content: "Summarize this local note.", sourceRefs: [] }],
      redactions: ["No external service is used."],
      disclosureStatus: "not-required"
    });

    expect(hosted.approval.status).toBe("not-approved");
    expect(hosted.warnings).toContain(
      "This packet is not approved for external sending; get explicit human approval before using a hosted model or external service."
    );
    expect(hosted.warnings).toContain(
      "Selected context appears to mention secrets, credentials, health, personal, or patient data; review minimization and consent before sending."
    );
    expect(local.target.kind).toBe("local-model");
    expect(local.disclosure.required).toBe(false);
    expect(local.disclosure.status).toBe("not-required");
    expect(renderModelContextMarkdown(local)).toContain("| Target | `local-model` / local-llama |");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-model-context-"));
  roots.push(root);
  return root;
}
