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

  it("renders validation evidence attach commands and targets in workspace review slots", async () => {
    const source = await readFile(appSourcePath, "utf8");

    expect(source).toContain("slot.attachCommand");
    expect(source).toContain("Attach command");
    expect(source).toContain("target.validationPlanId");
    expect(source).toContain("target.validationGateId");
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

  it("formats Docker CLI fallback commands so npm preserves verifier flags", async () => {
    const source = await readFile(appSourcePath, "utf8");

    expect(source).toContain("function dockerCliCommand(commandTail)");
    expect(source).toContain("function firstCliOptionIndex(commandTail)");
    expect(source).toContain("return dockerCliCommand(`smt check");
    expect(source).toContain("return dockerCliCommand(`cas check");
    expect(source).toContain("npm run docker:cli -- ${trimmed.slice(0, optionIndex).trimEnd()} -- ${trimmed.slice(optionIndex).trimStart()}");
    expect(source).not.toContain("npm run docker:cli -- smt check ${artifact.sourcePath ?? \"<source.smt2>\"} --write");
  });

  it("surfaces concrete engine evidence gates separately from readiness probes", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="engine-evidence-gate"');
    expect(source).toContain("function renderEngineEvidenceGate(payload = state.safetyStatus)");
    expect(source).toContain("payload.engineReadiness");
    expect(source).toContain("payload.engineVerification");
    expect(source).toContain('fetch("/api/engine-runs"');
    expect(source).toContain("function refreshEngineRuns({ announce = true } = {})");
    expect(source).toContain("async function saveEngineEvidenceRun(button, { requireAllEngines = false } = {})");
    expect(source).toContain('data-testid="save-engine-evidence-run"');
    expect(source).toContain('data-testid="save-all-engines-run"');
    expect(source).toContain('data-testid="copy-all-engines-command"');
    expect(source).toContain('data-require-all-engines="true"');
    expect(source).toContain("requireAllEngines");
    expect(source).toContain("engineRunsSavingMode");
    expect(source).toContain('report.docker?.allEnginesCommand ?? "npm run docker:all-engines"');
    expect(source).toContain("function latestEngineRun({ requireAllEngines = false } = {})");
    expect(source).toContain("function engineEvidenceCaseHtml(entry)");
    expect(source).toContain("function engineEvidenceCaseSummary(entry)");
    expect(source).toContain('data-testid="copy-engine-evidence-command"');
    expect(source).toContain("function engineEvidenceSummary(payload)");
    expect(source).toContain("focusedEngineEvidenceCase(target)");
    expect(source).toContain("Readiness does not mint evidence, truth labels, or proof.");
    expect(styles).toContain(".engine-evidence-gate");
    expect(styles).toContain(".engine-evidence-command-stack");
    expect(styles).toContain(".engine-evidence-saved-grid");
    expect(styles).toContain(".engine-evidence-saved-run");
    expect(styles).toContain(".engine-evidence-case-grid");
    expect(styles).toContain("grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));");
  });

  it("keeps the compact branch map from overlapping wrapped receipt labels", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="branch-map"');
    expect(source).toContain("return 32 + Math.max(rowCount, 1) * 104;");
    expect(source).toContain("return 18 + lane * 14;");
    expect(styles).toContain(".branch-rows-2 {\n  height: 240px;");
    expect(styles).toContain(".git-row-1 {\n  top: 120px;");
    expect(styles).toContain("grid-template-columns: 78px minmax(0, 1fr);");
    expect(styles).toContain("height: 90px;");
    expect(styles).toContain("height: 82px;");
    expect(styles).toContain("-webkit-line-clamp: 2;");
    expect(styles).toContain("text-overflow: ellipsis;");
    expect(styles).toContain("overflow: hidden auto;");
  });

  it("surfaces workspace credibility packs from the Report tab", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="credibility-pack-panel"');
    expect(html).toContain('id="save-report"');
    expect(html).toContain('id="report-save-status"');
    expect(html).toContain('id="report-draft-list"');
    expect(html).toContain('id="refresh-report-drafts"');
    expect(html).toContain('id="show-current-report"');
    expect(source).toContain('fetch("/api/reports"');
    expect(source).toContain('fetch("/api/reports?limit=8"');
    expect(source).toContain('fetch(`/api/reports/${encodeURIComponent(reportId)}`');
    expect(source).toContain("async function saveReportDraftFromUi(button)");
    expect(source).toContain("async function refreshReportDrafts({ announce = true } = {})");
    expect(source).toContain("async function openSavedReportDraft(reportId)");
    expect(source).toContain("function renderSavedReportDraftPreview(payload)");
    expect(source).toContain("function reportDraftIntegritySummary(drafts)");
    expect(source).toContain("function reportDraftIntegritySummaryHtml(drafts)");
    expect(source).toContain("function reportDraftReviewCommand(item)");
    expect(source).toContain("function currentReportDocument(receipt)");
    expect(source).toContain("function reportDraftPayload(receipt)");
    expect(source).toContain("function renderReportSaveStatus(receipt = receiptStore.get(state.receiptKey))");
    expect(source).toContain("copy-report-draft-command");
    expect(source).toContain("copy-report-drafts-command");
    expect(source).toContain("Saved report draft integrity command copied from the Report tab.");
    expect(source).toContain("Truth Harness verifies the Markdown a human reads against the SHA-256");
    expect(source).toContain("Saved report draft");
    expect(source).toContain("Opened saved report draft");
    expect(source).toContain("Report save failed");
    expect(source).toContain('fetch(`/api/credibility-pack?${params.toString()}`');
    expect(source).toContain('fetch("/api/credibility-pack"');
    expect(source).toContain('fetch("/api/credibility-bundle/latest"');
    expect(source).toContain('fetch("/api/credibility-bundle/latest/verify"');
    expect(source).toContain('fetch("/api/credibility-bundle/verifications?limit=8"');
    expect(source).toContain("function renderCredibilityPackPanel()");
    expect(source).toContain("async function refreshCredibilityPack({ announce = true } = {})");
    expect(source).toContain("async function writeCredibilityPackFromUi(button)");
    expect(source).toContain("async function refreshCredibilityBundle({ announce = true } = {})");
    expect(source).toContain("async function verifyCredibilityBundleFromUi(button)");
    expect(source).toContain("async function refreshCredibilityBundleVerificationHistory({ announce = true } = {})");
    expect(source).toContain("async function refreshCredibilityArchive({ announce = true } = {})");
    expect(source).toContain("function credibilityBundleCardHtml()");
    expect(source).toContain("function credibilityBundleVerificationHistoryHtml()");
    expect(source).toContain("function credibilityBundleVerificationHistoryItemHtml(item)");
    expect(source).toContain("function credibilityBundleVerificationReportItems(limit = 5)");
    expect(source).toContain("function credibilityBundleVerificationReportHtml()");
    expect(source).toContain("function credibilityBundleVerificationReportMarkdown()");
    expect(source).toContain("function credibilityReviewerChecklistHtml(pack)");
    expect(source).toContain("function credibilityChecklistItemHtml(item)");
    expect(source).toContain("function gateStringIsComplete(value)");
    expect(source).toContain("function credibilityBundleActivitySummary(payload)");
    expect(source).toContain('data-testid="refresh-credibility-pack"');
    expect(source).toContain('data-testid="write-credibility-pack"');
    expect(source).toContain('data-testid="copy-credibility-pack-command"');
    expect(source).toContain('data-testid="refresh-credibility-bundle"');
    expect(source).toContain('data-testid="verify-credibility-bundle"');
    expect(source).toContain('data-testid="refresh-credibility-bundle-history"');
    expect(source).toContain('data-testid="copy-credibility-bundle-command"');
    expect(source).toContain('data-testid="copy-strict-professor-command"');
    expect(source).toContain('data-testid="copy-strict-engine-command"');
    expect(source).toContain('data-testid="copy-credibility-bundle-path"');
    expect(source).toContain('data-testid="download-credibility-bundle-readme"');
    expect(source).toContain('data-testid="download-credibility-bundle-manifest"');
    expect(source).toContain('data-testid="download-credibility-bundle-pack"');
    expect(source).toContain('data-testid="download-credibility-bundle-archive"');
    expect(source).toContain('data-testid="download-credibility-bundle-sha256"');
    expect(source).toContain('data-testid="download-credibility-verification-json"');
    expect(source).toContain('data-testid="download-credibility-verification-markdown"');
    expect(source).toContain(".download-credibility-verification-file");
    expect(source).toContain("/api/credibility-bundle/latest/archive");
    expect(source).toContain("/api/credibility-bundle/latest/verify");
    expect(source).toContain("/api/credibility-bundle/verifications");
    expect(source).toContain("/api/credibility-bundle/verifications/file");
    expect(source).toContain("/api/credibility-bundle/latest/archive-metadata");
    expect(source).toContain("/api/credibility-bundle/latest/archive.sha256");
    expect(source).toContain("Archive SHA-256");
    expect(source).toContain("Last web verify");
    expect(source).toContain("Verification artifact");
    expect(source).toContain("Strict All-Engine Reviewer Bundle");
    expect(source).toContain("strict all-engine professor packet");
    expect(source).toContain("Strict all-engine bundle exported");
    expect(source).toContain("function credibilityBundleIsStrictAllEngine(manifest)");
    expect(source).toContain("function credibilityStrictProfessorCommand");
    expect(source).toContain("function credibilityStrictEngineCommand");
    expect(source).toContain("Strict all-engine Docker professor command copied from the Report tab.");
    expect(source).toContain("Saved ${payload.verification?.verificationId");
    expect(source).toContain("Verified Reviewer Bundle");
    expect(source).toContain("Bundle Verification History");
    expect(source).toContain("Reviewer Bundle Verifications");
    expect(source).toContain("Saved local reviewer checks cite when the portable bundle was verified");
    expect(source).toContain("Professor Review Checklist");
    expect(source).toContain("Reviewer bundle verification command copied from the Report tab.");
    expect(source).toContain("Downloaded reviewer bundle file");
    expect(source).toContain("function credibilityPackActionItemsHtml(pack)");
    expect(source).toContain("function credibilityPackActionSummary(pack)");
    expect(source).toContain("function credibilityEngineEvidenceLadderHtml(pack)");
    expect(source).toContain("function credibilityEngineEvidenceLadderFromCases(cases)");
    expect(source).toContain("function credibilityEngineEvidenceTierFromCase(entry)");
    expect(source).toContain("function credibilityEngineEvidenceMeaningFromCase(entry)");
    expect(source).toContain("function credibilityEngineLadderStatusClass(entry)");
    expect(source).toContain("function credibilityPackEngineEvidenceSummary(pack)");
    expect(source).toContain("function credibilityPackEngineEvidenceSummaryFromSummary(summary = {})");
    expect(source).toContain("function credibilityPackSavedEngineCoverageLabel(summary = {})");
    expect(source).toContain("saved strict Docker evidence covers these gates");
    expect(source).toContain("saved Docker professor evidence covers these gates");
    expect(source).toContain("pack?.engineEvidenceLadder");
    expect(source).toContain("pack?.engineEvidence?.cases");
    expect(source).toContain("Engine Evidence Ladder");
    expect(source).toContain("function credibilityBenchmarkCardHtml(pack)");
    expect(source).toContain("function credibilityMathLadderCommand(pack)");
    expect(source).toContain('data-testid="copy-credibility-benchmark-command"');
    expect(source).toContain("math-credibility-ladder");
    expect(source).toContain("command copied from the credibility pack.");
    expect(source).toContain("receiptReplays");
    expect(source).toContain("async function refreshCredibilityRunNext({ announce = true } = {})");
    expect(source).toContain("async function saveCredibilityRunNextFromUi(button)");
    expect(source).toContain("function credibilityRunNextHtml()");
    expect(source).toContain("function credibilityRunNextPathRows(paths)");
    expect(source).toContain('fetch(`/api/workspace-run-next?${params.toString()}`');
    expect(source).toContain('fetch("/api/workspace-run-next"');
    expect(source).toContain('source: "credibility-actions"');
    expect(source).toContain('data-testid="plan-credibility-run-next"');
    expect(source).toContain('data-testid="save-credibility-run-next"');
    expect(source).toContain('data-testid="copy-credibility-run-next-command"');
    expect(source).toContain("truth-harness workspace run-next . --source credibility-actions --json --require-all-engines");
    expect(source).toContain(".copy-credibility-action-command");
    expect(source).toContain("truth-harness workspace credibility-pack . --require-all-engines");
    expect(source).toContain("Reviewer credibility-pack command copied from the Report tab.");
    expect(source).toContain("Credibility run-next command copied from the Report tab.");
    expect(source).toContain("Saved credibility reviewer plan");
    expect(source).toContain("Reviewer action command copied from the credibility pack.");
    expect(styles).toContain(".credibility-pack-panel");
    expect(styles).toContain(".report-save-status");
    expect(styles).toContain(".report-drafts-panel");
    expect(styles).toContain(".report-draft-integrity");
    expect(styles).toContain(".report-draft-row");
    expect(styles).toContain(".report-draft-side");
    expect(styles).toContain(".saved-report-integrity");
    expect(styles).toContain(".credibility-pack-summary");
    expect(styles).toContain(".credibility-bundle-card");
    expect(styles).toContain(".credibility-bundle-card.bundle-standard");
    expect(styles).toContain(".credibility-bundle-facts");
    expect(styles).toContain(".credibility-bundle-command");
    expect(styles).toContain(".credibility-verification-history");
    expect(styles).toContain(".credibility-verification-history-item");
    expect(styles).toContain(".credibility-verification-history-actions");
    expect(styles).toContain(".report-verification-citations");
    expect(styles).toContain(".report-verification-citation");
    expect(styles).toContain(".report-verification-head");
    expect(styles).toContain(".credibility-review-checklist");
    expect(styles).toContain(".credibility-checklist-grid");
    expect(styles).toContain(".credibility-checklist-item");
    expect(styles).toContain(".credibility-benchmark-card");
    expect(styles).toContain(".credibility-benchmark-facts");
    expect(styles).toContain(".credibility-run-next-card");
    expect(styles).toContain(".credibility-run-next-paths");
    expect(styles).toContain(".credibility-pack-action-plan");
    expect(styles).toContain(".credibility-pack-action");
    expect(styles).toContain(".credibility-engine-ladder");
    expect(styles).toContain(".credibility-engine-ladder-grid");
    expect(styles).toContain(".credibility-engine-ladder-card");
    expect(styles).toContain("overflow-wrap: anywhere;");
  });

  it("surfaces the strict release audit gate from the Checks tab", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="release-audit-gate"');
    expect(source).toContain('fetch(`/api/release-audit?${params.toString()}`');
    expect(source).toContain("function refreshReleaseAudit({ announce = true } = {})");
    expect(source).toContain("function renderReleaseAuditGate()");
    expect(source).toContain("function releaseAuditBenchmarkCardHtml(audit)");
    expect(source).toContain("function releaseAuditMathLadderCardHtml(audit)");
    expect(source).toContain("function releaseAuditBenchmarkSummary(summary)");
    expect(source).toContain("function releaseAuditMathLadderSummary(summary)");
    expect(source).toContain("function releaseAuditEngineEvidenceSummary(audit)");
    expect(source).toContain("Saved no-network Docker engine evidence");
    expect(source).toContain('["Engines", releaseAuditEngineEvidenceSummary(audit)]');
    expect(source).toContain('data-testid="refresh-release-audit"');
    expect(source).toContain('data-testid="copy-release-audit-command"');
    expect(source).toContain('data-testid="copy-release-benchmark-command"');
    expect(source).toContain('check.id === "engine-evidence" ? 8 : 3');
    expect(source).toContain("requireSavedStrictEngineRun");
    expect(source).toContain("requireSandbox");
    expect(source).toContain("maxReports");
    expect(source).toContain("adversarialBenchmark");
    expect(source).toContain("mathCredibilityLadder");
    expect(source).toContain("latestMathCredibilityLadderStatus");
    expect(source).toContain("reportDraftsNeedingAttention");
    expect(source).toContain("sessionContinuationItems");
    expect(source).toContain("Receipt replay:");
    expect(source).toContain("releaseAuditActivitySummary");
    expect(source).toContain(".copy-release-action-command");
    expect(source).toContain("Strict release-audit command copied from the Checks tab.");
    expect(source).toContain("command copied from the Checks tab.");
    expect(source).toContain("Release-audit next action copied from the Checks tab.");
    expect(styles).toContain(".release-audit-gate");
    expect(styles).toContain(".release-audit-summary");
    expect(styles).toContain(".release-audit-benchmark-card");
    expect(styles).toContain(".release-audit-benchmark-facts");
    expect(styles).toContain(".release-audit-check-grid");
    expect(styles).toContain(".release-audit-action");
    expect(styles).toContain("overflow-wrap: anywhere;");
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

  it("keeps the desktop research workspace roomy enough for long visual and proof work", async () => {
    const [html, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);
    const workSurfaceStyles = [...styles.matchAll(/\.work-surface \{[\s\S]*?\r?\n\}/gu)]
      .map((match) => match[0])
      .find((block) => block.includes("container-type: inline-size;"));
    const plotSurfaceStyles = styles.match(/body\[data-surface="plot"\] \.work-surface,[\s\S]*?body\[data-surface="graph"\] \.work-surface \{[\s\S]*?\r?\n\}/u)?.[0];
    const plotLayoutStyles = styles.match(/\.plot-layout \{[\s\S]*?\r?\n\}/u)?.[0];
    const plotCanvasStyles = styles.match(/\.plot-canvas \{[\s\S]*?\r?\n\}/u)?.[0];
    const plotSvgStyles = styles.match(/\.plot-canvas svg \{[\s\S]*?\r?\n\}/u)?.[0];
    const mindMapSvgStyles = styles.match(/\.plot-canvas\[data-visual-mode="mind-map"\] svg \{[\s\S]*?\r?\n\}/u)?.[0];
    const taskDockStyles = [...styles.matchAll(/\.task-dock \{[\s\S]*?\r?\n\}/gu)]
      .map((match) => match[0])
      .find((block) => block.includes("width: min(1120px, calc(100% - 36px));"));

    expect(html).toContain('class="work-surface"');
    expect(html).toContain('class="plot-layout"');
    expect(html).toContain('id="plot-canvas"');
    expect(html).toContain('class="task-dock"');
    expect(workSurfaceStyles).toBeTruthy();
    expect(workSurfaceStyles).toContain("min-height: clamp(1040px, 124vh, 1520px);");
    expect(workSurfaceStyles).toContain("overflow: visible;");
    expect(plotSurfaceStyles).toBeTruthy();
    expect(plotSurfaceStyles).toContain("min-height: clamp(1120px, 136vh, 1680px);");
    expect(plotLayoutStyles).toBeTruthy();
    expect(plotLayoutStyles).toContain("grid-template-columns: minmax(720px, 1fr) minmax(260px, 300px);");
    expect(plotLayoutStyles).toContain("overflow: hidden;");
    expect(plotCanvasStyles).toBeTruthy();
    expect(plotCanvasStyles).toContain("overflow-x: auto;");
    expect(plotCanvasStyles).toContain("overflow-y: auto;");
    expect(plotCanvasStyles).toContain("overscroll-behavior: contain;");
    expect(plotSvgStyles).toBeTruthy();
    expect(plotSvgStyles).toContain("min-height: clamp(420px, 56vh, 720px);");
    expect(mindMapSvgStyles).toBeTruthy();
    expect(mindMapSvgStyles).toContain("min-height: clamp(560px, 66vh, 880px);");
    expect(taskDockStyles).toBeTruthy();
    expect(taskDockStyles).toContain("width: min(1120px, calc(100% - 36px));");
    expect(taskDockStyles).toContain("flex: 0 0 auto;");
  });

  it("exposes a browser-run layout audit for agents and screenshot regression work", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);
    const claimGateCommandStyles = styles.match(/\.claim-gate-grid code \{[\s\S]*?\r?\n\}/u)?.[0];
    const dockerCommandStyles = styles.match(/\.docker-command-row code \{[\s\S]*?\r?\n\}/u)?.[0];
    const graphEdgeCodeStyles = styles.match(/\.graph-edge-list code \{[\s\S]*?\r?\n\}/u)?.[0];
    const runbookPacketStyles = styles.match(/#runbook-packet \{[\s\S]*?\r?\n\}/u)?.[0];

    expect(html).toContain('src="./src/app.js?v=2026-06-19-layout-audit-timeout"');
    expect(html).toContain('href="./src/styles.css?v=2026-06-19-layout-audit-pass"');
    expect(html).toContain('<pre id="truth-harness-ui-audit-result"');
    expect(html).toContain('aria-hidden="true"');
    expect(source).toContain('const UI_AUDIT_SURFACES = ["trace", "plot", "runbook", "checks", "graph", "protocol", "notes", "replay", "report"];');
    expect(source).toContain('const UI_AUDIT_SCROLL_ALLOWLIST = [');
    expect(source).toContain('".plot-canvas"');
    expect(source).toContain('".git-branch-stage"');
    expect(source).toContain("setTimeout(done, 120);");
    expect(source).toContain("requestAnimationFrame(() => requestAnimationFrame(done));");
    expect(source).toContain("function collectOverflowAudit(panel, findings)");
    expect(source).toContain("function collectNestedScrollAudit(panel, findings)");
    expect(source).toContain("function collectBranchMapOverlapAudit(findings)");
    expect(source).toContain("function visibleSurfaceAudit(surface)");
    expect(source).toContain("async function restoreSurfaceAfterUiAudit(previousSurface, previousScrolls)");
    expect(source).toContain("async function truthHarnessUiAudit(options = {})");
    expect(source).toContain("function writeTruthHarnessUiAuditResult(result)");
    expect(source).toContain("function markTruthHarnessUiAuditRunning(source)");
    expect(source).toContain('document.documentElement.dataset.truthHarnessUiAudit = "ready";');
    expect(source).toContain('resultNode.dataset.status = "running";');
    expect(source).toContain('markTruthHarnessUiAuditRunning("event");');
    expect(source).toContain('markTruthHarnessUiAuditRunning("url");');
    expect(source).toContain('document.addEventListener("truth-harness:run-ui-audit"');
    expect(source).toContain('document.querySelector("#truth-harness-ui-audit-result")');
    expect(source).toContain("function scheduleTruthHarnessUiAuditFromUrl()");
    expect(source).toContain('params.get("uiAudit") !== "1"');
    expect(source).toContain("scheduleTruthHarnessUiAuditFromUrl();");
    expect(source).toContain('schemaVersion: "truth-harness.web-ui-layout-audit.v0"');
    expect(source).toContain('"horizontal-overflow"');
    expect(source).toContain('"vertical-clipping"');
    expect(source).toContain('"nested-scroll-trap"');
    expect(source).toContain('"branch-map-overlap"');
    expect(source).toContain('"audit-runtime-error"');
    expect(source).toContain('"audit-url-runtime-error"');
    expect(source).toContain("window.truthHarnessUiAudit = truthHarnessUiAudit;");
    expect(source).toContain("This browser layout audit checks visible DOM geometry only.");
    expect(source).toContain("A passing result does not replace human review or future pixel-diff screenshot baselines.");
    expect(claimGateCommandStyles).toBeTruthy();
    expect(claimGateCommandStyles).toContain("overflow-wrap: anywhere;");
    expect(claimGateCommandStyles).toContain("white-space: normal;");
    expect(claimGateCommandStyles).not.toContain("text-overflow: ellipsis;");
    expect(dockerCommandStyles).toBeTruthy();
    expect(dockerCommandStyles).toContain("overflow-wrap: anywhere;");
    expect(dockerCommandStyles).toContain("white-space: normal;");
    expect(dockerCommandStyles).not.toContain("text-overflow: ellipsis;");
    expect(graphEdgeCodeStyles).toBeTruthy();
    expect(graphEdgeCodeStyles).toContain("overflow-wrap: anywhere;");
    expect(graphEdgeCodeStyles).toContain("white-space: normal;");
    expect(graphEdgeCodeStyles).not.toContain("text-overflow: ellipsis;");
    expect(runbookPacketStyles).toBeTruthy();
    expect(runbookPacketStyles).toContain("overflow: visible;");
    expect(runbookPacketStyles).toContain("white-space: pre-wrap;");
    expect(runbookPacketStyles).not.toContain("max-height:");
    expect(runbookPacketStyles).not.toContain("overflow: auto;");
  });

  it("shows the browser-safe workspace run-next dry run on the Run tab", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="workspace-run-next-card"');
    expect(html).toContain('id="workspace-run-next-command"');
    expect(html).toContain('id="workspace-run-next-details"');
    expect(html).toContain('id="refresh-run-next"');
    expect(html).toContain('id="copy-run-next-command"');
    expect(source).toContain('fetch("/api/workspace-run-next"');
    expect(source).toContain("function refreshWorkspaceRunNext({ announce = true } = {})");
    expect(source).toContain("function renderWorkspaceRunNext()");
    expect(source).toContain("function workspaceRunNextDetailsRows(plan, command)");
    expect(source).toContain("plan?.rationale");
    expect(source).toContain("evidenceRefFromCommand(command)");
    expect(source).toContain("copyWorkspaceRunNextCommand");
    expect(source).not.toContain("workspace-run-next?executeLocal=true");
    expect(styles).toContain(".workspace-run-next-card");
    expect(styles).toContain(".workspace-run-next-details");
    expect(styles).toContain("overflow-wrap: anywhere;");
  });

  it("surfaces the no-network professor evidence Docker route", async () => {
    const [html, source, styles] = await Promise.all([
      readFile(appHtmlPath, "utf8"),
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);

    expect(html).toContain('id="docker-professor-command"');
    expect(html).toContain('id="docker-all-engines-command"');
    expect(html).toContain('id="docker-professor-all-command"');
    expect(html).toContain('data-command-key="professor"');
    expect(html).toContain('data-command-key="allEngines"');
    expect(html).toContain('data-command-key="professorAll"');
    expect(html).toContain("npm run docker:professor");
    expect(html).toContain("npm run docker:all-engines");
    expect(html).toContain("npm run docker:professor:all");
    expect(source).toContain('const professorCommand = commands.professor ?? "npm run docker:professor";');
    expect(source).toContain('const allEnginesCommand = commands.allEngines ?? "npm run docker:all-engines";');
    expect(source).toContain('const professorAllCommand = commands.professorAll ?? "npm run docker:professor:all";');
    expect(source).toContain('report.docker?.professorCommand ?? "npm run docker:professor"');
    expect(source).toContain('report.docker?.allEnginesCommand ?? "npm run docker:all-engines"');
    expect(source).toContain('data-testid="copy-professor-evidence-command"');
    expect(styles).toContain(".docker-command-row.primary");
    expect(styles).toContain(".engine-evidence-command-row.primary");
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

  it("lets claim ledger blocker text wrap instead of clipping finalization requirements", async () => {
    const [source, styles] = await Promise.all([
      readFile(appSourcePath, "utf8"),
      readFile(appStylesPath, "utf8")
    ]);
    const blockerStyles = styles.match(/\.ledger-record \.ledger-blocker \{[\s\S]*?\r?\n\}/u)?.[0];

    expect(source).toContain('class="ledger-blocker"');
    expect(blockerStyles).toBeTruthy();
    expect(blockerStyles).toContain("overflow: visible;");
    expect(blockerStyles).toContain("overflow-wrap: anywhere;");
    expect(blockerStyles).toContain("white-space: normal;");
    expect(blockerStyles).toContain("word-break: break-word;");
    expect(blockerStyles).not.toContain("white-space: nowrap;");
    expect(blockerStyles).not.toContain("text-overflow: ellipsis;");
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
