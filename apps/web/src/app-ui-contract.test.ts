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

  it("keeps catalog search local, rebuildable, and visible in the sidebar", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="catalog-search-panel"');
    expect(html).toContain('id="catalog-rebuild"');
    expect(html).toContain('id="catalog-result-list"');
    expect(source).toContain('fetch("/api/catalog/status"');
    expect(source).toContain('fetch("/api/catalog/rebuild"');
    expect(source).toContain('fetch(`/api/catalog/search?${params.toString()}`');
    expect(source).toContain("function renderCatalogSearchPanel()");
    expect(source).toContain("function openCatalogResult(button)");
    expect(source).toContain("scheduleCatalogSearch();");
    expect(source).toContain("catalogResultList.hidden = true;");
    expect(styles).toContain(".catalog-search-panel");
    expect(styles).toContain(".catalog-result-row");
    expect(styles).toContain("overflow-wrap: anywhere;");
  });

  it("keeps workspace maintenance visible and routed through local preview-first APIs", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="maintenance-status"');
    expect(html).toContain('id="maintenance-repair-preview"');
    expect(html).toContain('id="maintenance-clean-preview"');
    expect(html).toContain('id="maintenance-archive-scratch"');
    expect(html).toContain('id="maintenance-clean-scratch"');
    expect(source).toContain('fetch("/api/workspace-maintenance"');
    expect(source).toContain('fetch("/api/workspace-maintenance/repair-artifacts"');
    expect(source).toContain('fetch("/api/workspace-maintenance/clean"');
    expect(source).toContain('fetch("/api/workspace-maintenance/archive"');
    expect(source).toContain("function maintenanceArchiveSummary");
    expect(source).toContain("maintenance.archives?.total");
    expect(source).toContain("function renderMaintenancePanel()");
    expect(source).toContain("window.confirm(");
    expect(source).toContain('targets: ["scratch"]');
    expect(styles).toContain(".maintenance-panel");
    expect(styles).toContain(".danger-button");
  });

  it("keeps the sidebar shortcuts wired to real workspace surfaces", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('data-sidebar-action="new-session"');
    expect(html).toContain('data-sidebar-action="lineage"');
    expect(html).toContain('data-sidebar-action="agent-tools"');
    expect(html).toContain('data-sidebar-action="benchmarks"');
    expect(html).toContain('id="session-list"');
    expect(html).toContain('data-project-lane="finance"');
    expect(html).toContain('data-project-lane="physics"');
    expect(source).toContain("function openSidebarAction(action)");
    expect(source).toContain('state.surface = "graph";');
    expect(source).toContain('state.surface = "runbook";');
    expect(source).toContain('state.surface = "checks";');
    expect(source).toContain("function openSidebarProject(row)");
    expect(source).toContain("function refreshResearchSessions");
    expect(source).toContain("function renderResearchSessions()");
    expect(source).toContain("function openSidebarSession(sessionId)");
    expect(source).toContain('fetch("/api/sessions"');
    expect(source).toContain("function renderSidebarProjects()");
    expect(source).toContain("function sidebarRecentEntries(query)");
    expect(source).toContain("function sidebarClaimEntry(claim, index)");
    expect(source).toContain("function receiptKeyForClaimRecord(claim)");
    expect(source).toContain("function sidebarEntrySignature(entry)");
    expect(source).toContain("function openSidebarClaim(claimId)");
    expect(source).toContain('data-sidebar-entry-kind="${escapeHtml(entry.kind)}"');
    expect(source).toContain("let total = sidebarRecentEntries(\"\").length;");
    expect(source).toContain("sidebarActionButtons.forEach");
    expect(source).toContain("projectRows.forEach");
    expect(styles).toContain("grid-template-rows: auto auto auto auto auto auto auto minmax(0, 1fr) auto;");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styles).toContain(".session-row");
    expect(styles).toContain("max-height: min(15vh, 142px);");
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

  it("shows the browser-safe workspace run-next dry run on the Run tab", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="workspace-run-next-card"');
    expect(html).toContain('id="workspace-run-next-command"');
    expect(html).toContain('id="refresh-run-next"');
    expect(html).toContain('id="copy-run-next-command"');
    expect(source).toContain('fetch("/api/workspace-run-next"');
    expect(source).toContain("function refreshWorkspaceRunNext({ announce = true } = {})");
    expect(source).toContain("function renderWorkspaceRunNext()");
    expect(source).toContain("copyWorkspaceRunNextCommand");
    expect(source).not.toContain("workspace-run-next?executeLocal=true");
    expect(styles).toContain(".workspace-run-next-card");
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

  it("hydrates the activity log from durable local workspace events", async () => {
    const source = await readFile(appSourcePath, "utf8");

    expect(source).toContain('fetch(`/api/events?limit=${encodeURIComponent(String(limit))}`');
    expect(source).toContain("function refreshWorkspaceEvents({ announce = true, limit = 100 } = {})");
    expect(source).toContain("function mergeWorkspaceEventLog(eventLog)");
    expect(source).toContain("function activityEventFromWorkspaceEvent(record)");
    expect(source).toContain("workspaceEventId: record.eventId");
    expect(source).toContain("event.workspaceEventId ?? \"\"");
    expect(source).toContain("void refreshWorkspaceEvents({ announce: false });");
    expect(source).toContain("await refreshWorkspaceEvents({ announce: false });");
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

  it("renders saved adapter visual artifacts as a distinct viewer state", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="visual-artifact-banner"');
    expect(html).toContain('id="visual-mode-bar"');
    expect(html).toContain('id="visual-renderer-source"');
    expect(html).toContain('id="save-plot-source"');
    expect(html).toContain("Make figure");
    expect(source).toContain("function renderSavedVisualArtifactSvg(artifact)");
    expect(source).toContain('payload.format === "plotly-json"');
    expect(source).toContain('payload.format === "graph-json"');
    expect(source).toContain('payload.format === "canvas-json"');
    expect(source).toContain("async function saveCurrentPlotFigureArtifact()");
    expect(source).toContain('fetch("/api/visuals/plot"');
    expect(source).toContain('fetch("/api/visuals/render"');
    expect(source).toContain('"Making plot figure"');
    expect(source).toContain("function savedPlotlyVisualArtifactSvg(artifact)");
    expect(source).toContain("function savedGraphVisualArtifactSvg(artifact)");
    expect(source).toContain("function savedCanvasVisualArtifactSvg(artifact)");
    expect(source).toContain("selectedVisualArtifactRecord?.visualId === state.selectedVisualArtifactId");
    expect(source).toContain("safeSvgColor(row.color");
    expect(source).toContain("savedVisualArtifactBannerHtml(selectedVisualArtifact)");
    expect(source).toContain("function savedVisualArtifactRendererSource(artifact)");
    expect(source).toContain("function renderVisualRendererSource(rendererSource)");
    expect(source).toContain("copyCurrentVisualRendererSource");
    expect(source).toContain("[data-visual-source-copy]");
    expect(source).toContain("function renderedVisualSummaryForSourceArtifact(artifact)");
    expect(source).toContain("function sourceVisualSummaryForRenderedArtifact(artifact)");
    expect(source).toContain("function selectedVisualRenderEngine(artifact)");
    expect(source).toContain('renderEngine === "plotly" ? "Render plot SVG" : "Render SVG"');
    expect(source).toContain("function reportFigureArtifactForReceipt(receipt)");
    expect(source).toContain("function reportFigureCitationHtml(figure)");
    expect(source).toContain("function reportFigureCitationMarkdown(figure)");
    expect(source).toContain("Saved Figure Artifact");
    expect(source).toContain("data-open-rendered-visual-id");
    expect(source).toContain("data-open-source-visual-id");
    expect(source).toContain("preferRendered !== false");
    expect(source).toContain("visualArtifactSummaryTypeLabel(artifact)");
    expect(source).toContain('return `${selectedVisualArtifactRecord?.kind ?? "visual"} artifact`;');
    expect(source).toContain("visualModeBar.hidden = Boolean(selectedVisualArtifact);");
    expect(source).toContain("const activeMode = selectedVisualArtifact ? undefined : selectedMapSnapshot?.visualMode ?? state.visualMode;");
    expect(source).toContain("button.disabled = Boolean(selectedVisualArtifact);");
    expect(source).toContain("layoutArtifactGraphNodes(nodes, edges)");
    expect(styles).toContain(".visual-artifact-banner");
    expect(styles).toContain(".visual-artifact-link");
    expect(styles).toContain(".visual-mode-bar[hidden]");
    expect(styles).toContain(".visual-renderer-source");
    expect(styles).toContain(".report-figure-citation");
  });
});
