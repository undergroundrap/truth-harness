import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSourcePath = resolve("apps/web/src/app.js");
const appHtmlPath = resolve("apps/web/index.html");
const appStylesPath = resolve("apps/web/src/styles.css");

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
    expect(source).toContain('data-testid="copy-engine-readiness-command"');
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

  it("keeps stable selectors for browser agents and future UI tests", async () => {
    const source = await readFile(appSourcePath, "utf8");

    expect(source).toContain('data-testid="workspace-open-action"');
    expect(source).toContain('data-testid="workspace-open-route"');
    expect(source).toContain('data-testid="workspace-action-route"');
    expect(source).toContain('data-testid="checks-work-open-route"');
    expect(source).toContain('data-testid="copy-engine-readiness-command"');
  });

  it("keeps the bottom dock as a readable command console instead of a cramped strip", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('class="task-dock-body"');
    expect(html).toContain('id="task-console-list"');
    expect(html).toContain('id="copy-task-console"');
    expect(source).toContain("function taskConsoleItems(receipt, rows = [])");
    expect(source).toContain("function formatTaskConsoleCommands(receipt)");
    expect(source).toContain("copyTaskConsoleButton?.addEventListener");
    expect(styles).toContain("width: min(1120px, calc(100% - 36px));");
    expect(styles).toContain("grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.45fr);");
    expect(styles).toContain("grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));");
    expect(styles).toContain("overflow-wrap: anywhere;");
  });

  it("keeps the activity log inside the parent scroll instead of a nested scroll trap", async () => {
    const styles = await readFile(appStylesPath, "utf8");
    const activityListStyles = styles.match(/\.activity-list \{[\s\S]*?\n\}/u)?.[0];
    const activitySectionStyles = styles.match(/\.activity-section \{[\s\S]*?\n\}/u)?.[0];

    expect(activityListStyles).toBeTruthy();
    expect(activityListStyles).toContain("overflow: visible;");
    expect(activityListStyles).not.toContain("overflow: auto;");
    expect(activityListStyles).not.toContain("max-height:");
    expect(activitySectionStyles).toBeTruthy();
    expect(activitySectionStyles).toContain("max-height: none;");
    expect(activitySectionStyles).not.toContain("overflow: auto;");
  });

  it("keeps ledgers and replay paged instead of nested scrollboxes", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);
    const ledgerListStyles = styles.match(/\.claim-ledger-list,\r?\n\.route-history-list \{[\s\S]*?\r?\n\}/u)?.[0];
    const replayListStyles = styles.match(/\.replay-list \{[\s\S]*?\r?\n\}/u)?.[0];
    const listPagerStyles = styles.match(/\.list-pager \{[\s\S]*?\r?\n\}/u)?.[0];

    expect(html).toContain('id="route-history-more"');
    expect(html).toContain('id="claim-ledger-more"');
    expect(html).toContain('id="replay-show-more"');
    expect(source).toContain("function pagerSummary(shown, total, singular)");
    expect(source).toContain("return `All ${total} ${total === 1 ? singular : plural} shown`;");
    expect(source).toContain("const LEDGER_PAGE_SIZE = 8;");
    expect(source).toContain("const REPLAY_PAGE_SIZE = 8;");
    expect(source).toContain("state.claimLedgerLimit += LEDGER_PAGE_SIZE;");
    expect(source).toContain("state.routeHistoryLimit += LEDGER_PAGE_SIZE;");
    expect(source).toContain("state.replayLimit += REPLAY_PAGE_SIZE;");
    expect(ledgerListStyles).toBeTruthy();
    expect(ledgerListStyles).toContain("overflow: visible;");
    expect(ledgerListStyles).not.toContain("overflow: auto;");
    expect(ledgerListStyles).not.toContain("max-height:");
    expect(replayListStyles).toBeTruthy();
    expect(replayListStyles).toContain("overflow: visible;");
    expect(replayListStyles).not.toContain("overflow: auto;");
    expect(listPagerStyles).toBeTruthy();
    expect(listPagerStyles).toContain("min-height: 36px;");
    expect(listPagerStyles).toContain("padding: 6px 8px;");
  });
});
