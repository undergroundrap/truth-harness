import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSourcePath = resolve("apps/web/src/app.js");

describe("web UI action contracts", () => {
  it("opens project queue actions directly into the focused checks work order", async () => {
    const source = await readFile(appSourcePath, "utf8");
    const handler = source.match(/workspaceReviewList\.querySelectorAll\("\.open-workspace-action"\)[\s\S]*?workspaceReviewList\.querySelectorAll\("\.open-workspace-route"\)/u)?.[0];

    expect(handler).toBeTruthy();
    expect(handler).toContain("state.selectedWorkspaceReviewItemId = item.itemId;");
    expect(handler).toContain("state.selectedWorkspaceObligationId = item.obligationId;");
    expect(handler).toContain('state.surface = "checks";');
    expect(handler).toContain("render();");
    expect(handler).not.toContain("renderWorkspaceReview();");
  });

  it("keeps focused engine readiness commands copyable from the checks work order", async () => {
    const source = await readFile(appSourcePath, "utf8");

    expect(source).toContain("copy-engine-readiness-command");
    expect(source).toContain('data-command="${escapeHtml(engineReadiness.command)}"');
    expect(source).toContain('filename: `truth-harness-engine-command-${safeFilenameTimestamp()}.txt`');
    expect(source).toContain('copiedTitle: "Copied engine command"');
    expect(source).toContain('fallbackTitle: "Downloaded engine command"');
  });

  it("clears focused queue state when closing the selected workspace action", async () => {
    const source = await readFile(appSourcePath, "utf8");
    const handler = source.match(/workspaceReviewAction\.querySelector\("\.close-workspace-action"\)[\s\S]*?workspaceReviewAction\.querySelector\("\.open-workspace-action-route"\)/u)?.[0];

    expect(handler).toBeTruthy();
    expect(handler).toContain("state.selectedWorkspaceReviewItemId = undefined;");
    expect(handler).toContain("state.selectedWorkspaceObligationId = undefined;");
    expect(handler).toContain("render();");
    expect(handler).not.toContain("renderWorkspaceReview();");
  });

  it("does not reload a verifier route when the selected queue action is already loaded", async () => {
    const source = await readFile(appSourcePath, "utf8");
    const actionRenderer = source.match(/function renderWorkspaceReviewAction\(items\) \{[\s\S]*?function workspaceReviewCountText/u)?.[0];

    expect(actionRenderer).toBeTruthy();
    expect(actionRenderer).toContain('const routeActionLabel = routeLoaded ? "Show work order" : "Open route + checks";');
    expect(actionRenderer).toContain("receiptStore.get(state.receiptKey)?.verifierRoute?.routeId === routeId");
    expect(actionRenderer).toContain('state.surface = "checks";');
    expect(actionRenderer).toContain("return;");
    expect(actionRenderer).toContain("await openSavedRoute(routeId);");
  });
});
