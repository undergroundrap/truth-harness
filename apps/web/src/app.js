const seedReceipts = {
  rational: {
    trust: "exact-computed",
    title: "3 / 4 + 5 / 8",
    subtitle: "exact arithmetic trace",
    runId: "run_7e1b03d529609565",
    engine: "local-rational-arithmetic",
    replay: 'truth-harness ask "compute 3 / 4 + 5 / 8" --json',
    output: "11/8",
    tags: ["math", "fractions", "exact-arithmetic", "linked-work"],
    dependsOn: ["denominator"],
    derivedBy: "Uses the verified common-denominator subclaim, then adds 6/8 and 5/8.",
    math: {
      input: "\\frac{3}{4}+\\frac{5}{8}",
      output: "\\frac{11}{8}"
    },
    details: {
      "Evidence kind": "exact-arithmetic",
      Backend: "local-rational-arithmetic",
      Output: "11/8",
      "Trace steps": "7",
      Network: "none",
      "Proof checker": "false"
    },
    graph: [
      ["problem", "Original prompt"],
      ["normalized_problem", "Whitespace-normalized input"],
      ["computation", "Exact rational result"],
      ["lesson", "Audience-level trace views"]
    ],
    traces: {
      middle: [
        "step_3: dividing 3 by 4 gives 3/4.",
        "step_6: dividing 5 by 8 gives 5/8.",
        "step_7: adding 3/4 and 5/8 gives 11/8."
      ],
      high: [
        "step_3: evaluate 3 / 4 using exact rational division.",
        "step_6: evaluate 5 / 8 using exact rational division.",
        "step_7: add 3/4 and 5/8 by converting to a common denominator."
      ],
      college: [
        "step_3: divide(3, 4) -> 3/4 in Q.",
        "step_6: divide(5, 8) -> 5/8 in Q.",
        "step_7: add(3/4, 5/8) -> 11/8 in Q."
      ],
      expert: [
        "step_1: op=literal; expr=3; result=3",
        "step_2: op=literal; expr=4; result=4",
        "step_3: op=divide; inputs=[step_1, step_2]; values=[3, 4]; result=3/4",
        "step_4: op=literal; expr=5; result=5",
        "step_5: op=literal; expr=8; result=8",
        "step_6: op=divide; inputs=[step_4, step_5]; values=[5, 8]; result=5/8",
        "step_7: op=add; inputs=[step_3, step_6]; values=[3/4, 5/8]; result=11/8"
      ]
    },
    limitations: [
      "Exact arithmetic covers the parsed expression.",
      "Explanation text defers to the machine trace.",
      "This is not a broader financial or scientific claim."
    ]
  },
  denominator: {
    trust: "exact-computed",
    title: "common denominator for 3 / 4 and 5 / 8",
    subtitle: "linked arithmetic lemma",
    runId: "run_common_denominator_sample",
    engine: "local-rational-arithmetic",
    replay: 'truth-harness ask "common denominator for 3 / 4 and 5 / 8" --json',
    output: "lcm(4,8)=8; 3/4=6/8",
    tags: ["math", "fractions", "subclaim", "reusable-lemma"],
    dependsOn: [],
    derivedBy: "Exact integer lcm plus rational equivalence rewrite.",
    math: {
      input: "\\operatorname{lcm}(4,8)",
      output: "8,\\ \\frac{3}{4}=\\frac{6}{8}"
    },
    details: {
      "Evidence kind": "exact-arithmetic",
      Backend: "local-rational-arithmetic",
      Output: "lcm(4,8)=8; 3/4=6/8",
      "Trace steps": "4",
      Network: "none",
      "Proof checker": "false"
    },
    graph: [
      ["problem", "Prepare fraction addition subclaim"],
      ["integer_lcm", "lcm(4,8)=8"],
      ["rewrite", "3/4 rewrites to 6/8"],
      ["module", "Reusable input for final addition"]
    ],
    traces: {
      middle: [
        "The denominators are 4 and 8.",
        "The least common denominator is 8.",
        "Rewrite 3/4 as 6/8 so both fractions share denominator 8."
      ],
      high: [
        "Compute lcm(4, 8) exactly.",
        "Because 8 is a multiple of 4, multiply numerator and denominator of 3/4 by 2.",
        "The equivalent fraction is 6/8."
      ],
      college: [
        "lcm(4,8)=8 in Z.",
        "3/4 = (3*2)/(4*2) = 6/8.",
        "This subclaim can be referenced by a later rational-addition receipt."
      ],
      expert: [
        "op=lcm; inputs=[4,8]; result=8",
        "op=rewrite_fraction; input=3/4; denominator=8; result=6/8",
        "module=common-denominator; reusable=true"
      ]
    },
    limitations: [
      "This receipt only proves the denominator rewrite for these two fractions.",
      "It does not by itself compute the final sum."
    ]
  },
  parity: {
    trust: "refuted",
    title: "for all integers n, n^2+n+1 is even",
    subtitle: "counterexample found",
    runId: "run_df379de5f447a5c6",
    engine: "finite-counterexample-search",
    replay: 'truth-harness ask "for all integers n, n^2+n+1 is even" --json',
    output: "n=-20, value=381",
    tags: ["math", "number-theory", "counterexample", "universal-claim"],
    dependsOn: [],
    derivedBy: "Finite exact search over recorded integer bounds.",
    math: {
      input: "n^2+n+1 \\text{ even}",
      output: "n=-20,\\ n^2+n+1=381"
    },
    details: {
      "Evidence kind": "universal-parity",
      Backend: "finite-counterexample-search",
      Output: "n=-20, value=381",
      "Search range": "-20..20",
      Network: "none",
      "Proof checker": "false"
    },
    graph: [
      ["problem", "Universal parity claim"],
      ["claim", "Claim checked"],
      ["tool_run", "Finite exact search"],
      ["counterexample", "n=-20 refutes claim"]
    ],
    traces: {
      middle: ["Try n=-20.", "Compute (-20)^2 + (-20) + 1.", "The result is 381, which is odd, so the claim is false."],
      high: ["A universal claim is false if one counterexample exists.", "At n=-20, n^2+n+1 = 400-20+1 = 381.", "381 is not even."],
      college: ["Counterexample search evaluated the polynomial over integer samples.", "The assignment n=-20 violates the predicate is even.", "One exact counterexample refutes the universal statement."],
      expert: ["adapter=finite-counterexample-search", "range=-20..20", "counterexample={n:-20,value:381,predicate:even,false}"]
    },
    limitations: ["A single exact counterexample refutes the universal parity claim."]
  },
  dimension: {
    trust: "dimension-checked",
    title: "dimension check force = mass * acceleration",
    subtitle: "dimension checked",
    runId: "run_dimension_sample",
    engine: "local-dimensional-analysis",
    replay: 'truth-harness ask "dimension check force = mass * acceleration" --json',
    output: "M L T^-2",
    tags: ["physics", "units", "dimension-analysis", "model-check"],
    dependsOn: [],
    derivedBy: "Maps both sides into SI base dimensions and compares them.",
    math: {
      input: "F=m a",
      output: "M L T^{-2}"
    },
    details: {
      "Evidence kind": "dimension-analysis",
      Backend: "local-dimensional-analysis",
      Output: "M L T^-2",
      Matched: "true",
      Network: "none",
      "Proof checker": "false"
    },
    graph: [
      ["problem", "Physics equation"],
      ["claim", "Dimensional consistency"],
      ["tool_run", "SI base-dimension table"],
      ["computation", "Both sides match"]
    ],
    traces: {
      middle: ["Force has units of mass times acceleration.", "Mass is M.", "Acceleration is L T^-2.", "Together they match force: M L T^-2."],
      high: ["Left side force maps to M L T^-2.", "Right side mass * acceleration maps to M * L T^-2.", "Both sides are dimensionally consistent."],
      college: ["Evaluate dimensions in the local SI basis.", "lhs(force)=M L T^-2.", "rhs(mass*acceleration)=M L T^-2.", "Dimensional equality holds."],
      expert: ["adapter=local-dimensional-analysis", "lhs=M L T^-2", "rhs=M L T^-2", "trust=dimension-checked; not physical proof"]
    },
    limitations: ["Dimensional consistency checks units, not whether the equation or model is physically true."]
  }
};

const receiptStore = new Map(Object.entries(seedReceipts));
const claimLedgerStore = new Map();
const claimReviewPacketStore = new Map();
const claimReviewPacketLoading = new Set();
const claimReviewPacketErrors = new Map();
const routeLedgerStore = new Map();
const casCheckStore = new Map();
const smtCheckStore = new Map();
let researchSessions = [];
let workspaceReview = {
  schemaVersion: "truth-harness.workspace-review.v0",
  autonomy: emptyAutonomyContract(),
  summary: {
    totalItems: 0,
    criticalItems: 0,
    highItems: 0,
    mediumItems: 0,
    lowItems: 0
  },
  items: []
};
let workspaceRunNextPlan;
let workspaceRunNextError;
let professorChallengeSeed;
let workspaceRunNextSummaries = [];
let workspaceRunNextSummariesError;
let workspaceRunNextSummariesVerified = false;
let workspaceRunNextSummariesLoading = false;
let workspaceRunNextSummariesLoadedAt = 0;
let workspaceRunNextOpenedInspection;
let workspaceRunNextOpenedError;
let workspaceRunNextSaving = false;
let workspacePilotLoop;
let workspacePilotLoopError;
let claimLedgerGraph = {
  schemaVersion: "truth-harness.claim-graph.v0",
  nodes: [],
  edges: [],
  warnings: []
};
let workspaceGraph = {
  schemaVersion: "truth-harness.workspace-graph.v0",
  nodes: [],
  edges: [],
  summary: {
    nodes: 0,
    edges: 0,
    missingRefs: 0
  },
  validation: {
    passed: true,
    errors: 0,
    warnings: 0,
    issues: []
  },
  warnings: []
};
let researchMap = {
  schemaVersion: "truth-harness.research-map.v0",
  mapId: "research_map_local",
  localOnly: true,
  networkAccess: "none",
  snapshotCount: 0,
  snapshots: [],
  warnings: []
};
let visualArtifacts = [];
let selectedVisualArtifactRecord;
const recentReceiptKeys = ["rational", "denominator", "parity", "dimension"];
const ACTIVITY_PAGE_SIZE = 12;
const LEDGER_PAGE_SIZE = 8;
const REPLAY_PAGE_SIZE = 8;
const NOTES_STORAGE_KEY = "truth-harness.session-notes.v0";
const RESEARCHER_NAME_STORAGE_KEY = "truth-harness.researcher-name.v0";
const SIDEBAR_WIDTH_STORAGE_KEY = "truth-harness.sidebar-width.v0";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "truth-harness.sidebar-collapsed.v0";
const SIDEBAR_DEFAULT_WIDTH = 300;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const VISUAL_ZOOM_MIN = 0.45;
const VISUAL_ZOOM_MAX = 2.25;
const VISUAL_ZOOM_STEP = 0.15;
const VISUAL_WHEEL_ZOOM_SENSITIVITY = 0.0005;
const VISUAL_WHEEL_DELTA_MAX = 240;
const activityEvents = [];
let activityEventCounter = 0;
let visualPanDrag;
let suppressVisualClick = false;
let pendingVisualWheelZoom;
let pendingVisualWheelFrame;
const state = {
  receiptKey: "rational",
  level: "middle",
  surface: "trace",
  visualMode: "number-line",
  lane: "math",
  replayIndex: 0,
  selectedGraphIndex: 0,
  replayPlaying: false,
  sidebarQuery: "",
  claimLedgerQuery: "",
  routeHistoryQuery: "",
  selectedResearchMapSnapshotId: undefined,
  selectedResearchMapNodeId: undefined,
  selectedVisualArtifactId: undefined,
  visualDetailCollapsed: true,
  visualFocus: false,
  visualZoom: 1,
  visualFitPending: true,
  sidebarCollapsed: false,
  activityQuery: "",
  activityLimit: ACTIVITY_PAGE_SIZE,
  claimLedgerLimit: LEDGER_PAGE_SIZE,
  routeHistoryLimit: LEDGER_PAGE_SIZE,
  replayLimit: REPLAY_PAGE_SIZE,
  safetyStatus: undefined,
  engineRuns: [],
  engineRunsError: undefined,
  engineRunsSaving: false,
  engineRunsSavingMode: undefined,
  credibilityPack: undefined,
  credibilityPackPaths: undefined,
  credibilityPackLoading: false,
  credibilityPackSaving: false,
  credibilityPackError: undefined,
  credibilityBundle: undefined,
  credibilityBundleLoading: false,
  credibilityBundleError: undefined,
  credibilityBundleVerifying: false,
  credibilityBundleVerifyError: undefined,
  credibilityBundleVerifiedAt: undefined,
  credibilityArchive: undefined,
  credibilityArchiveLoading: false,
  credibilityArchiveError: undefined,
  credibilityBundleVerifications: [],
  credibilityBundleVerificationsLoading: false,
  credibilityBundleVerificationsError: undefined,
  reportSaving: false,
  savedReportDraft: undefined,
  reportSaveError: undefined,
  reportDrafts: [],
  reportDraftsLoaded: false,
  reportDraftsLoading: false,
  reportDraftsError: undefined,
  openedReportDraft: undefined,
  credibilityRunNextPlan: undefined,
  credibilityRunNextLoading: false,
  credibilityRunNextSaving: false,
  credibilityRunNextError: undefined,
  credibilityRunNextPaths: undefined,
  releaseAudit: undefined,
  releaseAuditLoading: false,
  releaseAuditError: undefined,
  selectedReleaseAuditCheckId: undefined,
  releaseAuditArtifactPreviewPath: undefined,
  releaseAuditArtifactPreview: undefined,
  releaseAuditArtifactPreviewLoading: false,
  releaseAuditArtifactPreviewError: undefined,
  workspaceArtifactPreviewSurface: undefined,
  workspaceArtifactPreviewPath: undefined,
  workspaceArtifactPreview: undefined,
  workspaceArtifactPreviewLoading: false,
  workspaceArtifactPreviewError: undefined,
  workspaceReadiness: undefined,
  catalogStatus: undefined,
  catalogSearch: undefined,
  catalogRefFilter: undefined,
  catalogSearchLoading: false,
  catalogError: undefined,
  catalogRebuildLoading: false,
  maintenance: undefined,
  maintenanceLoading: false,
  maintenanceError: undefined,
  selectedWorkspaceReviewItemId: undefined,
  selectedWorkspaceObligationId: undefined,
  selectedResearchSessionId: undefined
};

const appShell = document.querySelector("#app-shell");
const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebarRestore = document.querySelector("#sidebar-restore");
const sidebarResizer = document.querySelector("#sidebar-resizer");
const researcherNameInput = document.querySelector("#researcher-name-input");
const researcherNameSummary = document.querySelector("#researcher-name-summary");
const claimList = document.querySelector("#claim-list");
const sidebarSearch = document.querySelector("#sidebar-search");
const sidebarSearchCount = document.querySelector("#sidebar-search-count");
const catalogSearchStatus = document.querySelector("#catalog-search-status");
const catalogRebuildButton = document.querySelector("#catalog-rebuild");
const catalogResultList = document.querySelector("#catalog-result-list");
const catalogArtifactPreview = document.querySelector("#catalog-artifact-preview");
const maintenanceStatus = document.querySelector("#maintenance-status");
const maintenanceMetrics = document.querySelector("#maintenance-metrics");
const maintenanceDetail = document.querySelector("#maintenance-detail");
const maintenanceRefreshButton = document.querySelector("#maintenance-refresh");
const maintenanceRepairPreviewButton = document.querySelector("#maintenance-repair-preview");
const maintenanceRepairApplyButton = document.querySelector("#maintenance-repair-apply");
const maintenanceCleanPreviewButton = document.querySelector("#maintenance-clean-preview");
const maintenanceArchiveScratchButton = document.querySelector("#maintenance-archive-scratch");
const maintenanceCleanScratchButton = document.querySelector("#maintenance-clean-scratch");
const sessionList = document.querySelector("#session-list");
const sidebarActionButtons = document.querySelectorAll("[data-sidebar-action]");
const projectRows = document.querySelectorAll(".project-row");
const laneButtons = document.querySelectorAll(".lane-row");
const laneStatus = document.querySelector("#lane-status");
const projectStartLane = document.querySelector("#project-start-lane");
const projectStartClaims = document.querySelector("#project-start-claims");
const projectStartFocus = document.querySelector("#project-start-focus");
const projectStartChecks = document.querySelector("#project-start-checks");
const projectStartReport = document.querySelector("#project-start-report");
const traceList = document.querySelector("#trace-list");
const receiptDetails = document.querySelector("#receipt-details");
const graphList = document.querySelector("#graph-list");
const claimLedgerList = document.querySelector("#claim-ledger-list");
const claimLedgerCount = document.querySelector("#claim-ledger-count");
const claimLedgerSearch = document.querySelector("#claim-ledger-search");
const claimLedgerPage = document.querySelector("#claim-ledger-page");
const claimLedgerMore = document.querySelector("#claim-ledger-more");
const routeHistoryList = document.querySelector("#route-history-list");
const routeHistoryCount = document.querySelector("#route-history-count");
const routeHistorySearch = document.querySelector("#route-history-search");
const routeHistoryPage = document.querySelector("#route-history-page");
const routeHistoryMore = document.querySelector("#route-history-more");
const workspaceReviewList = document.querySelector("#workspace-review-list");
const workspaceReviewCount = document.querySelector("#workspace-review-count");
const workspaceReviewAutonomy = document.querySelector("#workspace-review-autonomy");
const workspaceReviewAction = document.querySelector("#workspace-review-action");
const mainGraphList = document.querySelector("#main-graph-list");
const graphDetail = document.querySelector("#graph-detail");
const branchMap = document.querySelector("#branch-map");
const branchMapStatus = document.querySelector("#branch-map-status");
const matrixSummary = document.querySelector("#matrix-summary");
const matrixCurrentClaim = document.querySelector("#matrix-current-claim");
const matrixNextCommand = document.querySelector("#matrix-next-command");
const checksWorkOrder = document.querySelector("#checks-work-order");
const verificationMatrix = document.querySelector("#verification-matrix");
const engineEvidenceGate = document.querySelector("#engine-evidence-gate");
const reviewerReadinessConsole = document.querySelector("#reviewer-readiness-console");
const releaseAuditGate = document.querySelector("#release-audit-gate");
const claimReviewGate = document.querySelector("#claim-review-gate");
const claimReviewStatus = document.querySelector("#claim-review-status");
const claimReviewDecision = document.querySelector("#claim-review-decision");
const claimReviewFacts = document.querySelector("#claim-review-facts");
const claimReviewBlockers = document.querySelector("#claim-review-blockers");
const claimReviewCommand = document.querySelector("#claim-review-command");
const dockerVerifierPill = document.querySelector("#docker-verifier-pill");
const dockerVerifierSummary = document.querySelector("#docker-verifier-summary");
const dockerVerifierNotes = document.querySelector("#docker-verifier-notes");
const dockerProfessorCommand = document.querySelector("#docker-professor-command");
const dockerProofCommand = document.querySelector("#docker-proof-command");
const dockerAllEnginesCommand = document.querySelector("#docker-all-engines-command");
const dockerProfessorAllCommand = document.querySelector("#docker-professor-all-command");
const dockerVerifyCommand = document.querySelector("#docker-verify-command");
const dockerCopyCommands = document.querySelectorAll(".docker-copy-command");
const casArtifactList = document.querySelector("#cas-artifact-list");
const casArtifactCount = document.querySelector("#cas-artifact-count");
const capabilityLedger = document.querySelector("#capability-ledger");
const protocolLane = document.querySelector("#protocol-lane");
const protocolSummary = document.querySelector("#protocol-summary");
const protocolEvidence = document.querySelector("#protocol-evidence");
const protocolGates = document.querySelector("#protocol-gates");
const protocolReview = document.querySelector("#protocol-review");
const protocolDeliverables = document.querySelector("#protocol-deliverables");
const reviewStandardLane = document.querySelector("#review-standard-lane");
const reviewStandard = document.querySelector("#review-standard");
const safetyStatusPill = document.querySelector("#safety-status-pill");
const safetyDetails = document.querySelector("#safety-details");
const safetyNotes = document.querySelector("#safety-notes");
const engineReadinessPill = document.querySelector("#engine-readiness-pill");
const engineReadinessDetails = document.querySelector("#engine-readiness-details");
const engineReadinessNotes = document.querySelector("#engine-readiness-notes");
const workspaceReadinessPill = document.querySelector("#workspace-readiness-pill");
const workspaceReadinessDetails = document.querySelector("#workspace-readiness-details");
const workspaceReadinessNotes = document.querySelector("#workspace-readiness-notes");
const activityLog = document.querySelector("#activity-log");
const activitySearch = document.querySelector("#activity-search");
const activityCount = document.querySelector("#activity-count");
const activityShowMore = document.querySelector("#activity-show-more");
const copyActivityButton = document.querySelector("#copy-activity");
const downloadActivityButton = document.querySelector("#download-activity");
const surfaceTabs = document.querySelectorAll(".surface-tab");
const surfacePanels = document.querySelectorAll("[data-surface-panel]");
const surfaceStatus = document.querySelector("#surface-status");
const runbookObjective = document.querySelector("#runbook-objective");
const runbookMode = document.querySelector("#runbook-mode");
const runbookStandard = document.querySelector("#runbook-standard");
const runbookClaim = document.querySelector("#runbook-claim");
const runbookTrust = document.querySelector("#runbook-trust");
const runbookStopRule = document.querySelector("#runbook-stop-rule");
const runbookNextCommand = document.querySelector("#runbook-next-command");
const runbookLoop = document.querySelector("#runbook-loop");
const runbookLedger = document.querySelector("#runbook-ledger");
const runbookStopRules = document.querySelector("#runbook-stop-rules");
const runbookPacket = document.querySelector("#runbook-packet");
const copyRunbookButton = document.querySelector("#copy-runbook");
const downloadRunbookButton = document.querySelector("#download-runbook");
const workspaceRunNextStatus = document.querySelector("#workspace-run-next-status");
const workspaceRunNextTitle = document.querySelector("#workspace-run-next-title");
const workspaceRunNextSummary = document.querySelector("#workspace-run-next-summary");
const workspaceRunNextCommand = document.querySelector("#workspace-run-next-command");
const workspaceRunNextDetails = document.querySelector("#workspace-run-next-details");
const workspaceProfessorChallenge = document.querySelector("#workspace-professor-challenge");
const workspaceRunNextEngine = document.querySelector("#workspace-run-next-engine");
const workspaceRunNextSafety = document.querySelector("#workspace-run-next-safety");
const workspaceRunNextArtifactPreview = document.querySelector("#workspace-run-next-artifact-preview");
const workspaceRunNextIdleActions = document.querySelector("#workspace-run-next-idle-actions");
const startResearchHarnessButton = document.querySelector("#start-research-harness");
const seedProfessorChallengeButton = document.querySelector("#seed-professor-challenge");
const seedHardMathButton = document.querySelector("#seed-hard-math");
const saveRunNextHandoffButton = document.querySelector("#save-run-next-handoff");
const refreshRunNextButton = document.querySelector("#refresh-run-next");
const copyRunNextCommandButton = document.querySelector("#copy-run-next-command");
const workspacePilotLoopStatus = document.querySelector("#workspace-pilot-loop-status");
const workspacePilotLoopTitle = document.querySelector("#workspace-pilot-loop-title");
const workspacePilotLoopSummary = document.querySelector("#workspace-pilot-loop-summary");
const workspacePilotLoopCommand = document.querySelector("#workspace-pilot-loop-command");
const workspacePilotLoopDetails = document.querySelector("#workspace-pilot-loop-details");
const workspacePilotLoopSteps = document.querySelector("#workspace-pilot-loop-steps");
const refreshPilotLoopButton = document.querySelector("#refresh-pilot-loop");
const copyPilotLoopCommandButton = document.querySelector("#copy-pilot-loop-command");
const workspaceRunNextHistoryTitle = document.querySelector("#workspace-run-next-history-title");
const workspaceRunNextList = document.querySelector("#workspace-run-next-list");
const workspaceRunNextHistoryArtifactPreview = document.querySelector("#workspace-run-next-history-artifact-preview");
const workspaceRunNextInspection = document.querySelector("#workspace-run-next-inspection");
const refreshRunNextsButton = document.querySelector("#refresh-run-nexts");
const verifyRunNextsButton = document.querySelector("#verify-run-nexts");
const researchNotes = document.querySelector("#research-notes");
const notesStatus = document.querySelector("#notes-status");
const credibilityPackPanel = document.querySelector("#credibility-pack-panel");
const reportPreview = document.querySelector("#report-preview");
const saveReportButton = document.querySelector("#save-report");
const reportSaveStatus = document.querySelector("#report-save-status");
const reportDraftList = document.querySelector("#report-draft-list");
const reportDraftsStatus = document.querySelector("#report-drafts-status");
const refreshReportDraftsButton = document.querySelector("#refresh-report-drafts");
const showCurrentReportButton = document.querySelector("#show-current-report");
const copyReportButton = document.querySelector("#copy-report");
const downloadReportButton = document.querySelector("#download-report");
const copyTeachingPacketButton = document.querySelector("#copy-teaching-packet");
const downloadTeachingPacketButton = document.querySelector("#download-teaching-packet");
const printReportButton = document.querySelector("#print-report");
const routeLane = document.querySelector("#route-lane");
const routeProtocol = document.querySelector("#route-protocol");
const routeReceipt = document.querySelector("#route-receipt");
const routeReplay = document.querySelector("#route-replay");
const routeReport = document.querySelector("#route-report");
const openReplayButton = document.querySelector("#open-replay");
const recordClaimButton = document.querySelector("#record-claim");
const recordChainButton = document.querySelector("#record-chain");
const playReplayButton = document.querySelector("#play-replay");
const resetReplayButton = document.querySelector("#reset-replay");
const exportReplayButton = document.querySelector("#export-replay");
const replayFrame = document.querySelector("#replay-frame");
const replayList = document.querySelector("#replay-list");
const replayPage = document.querySelector("#replay-page");
const replayShowMoreButton = document.querySelector("#replay-show-more");
const replayProgressBar = document.querySelector("#replay-progress-bar");
const inspectorTrust = document.querySelector("#inspector-trust");
const routeLedgerStatus = document.querySelector("#route-ledger-status");
const routeLedgerDetails = document.querySelector("#route-ledger-details");
const routeLedgerArtifactPreview = document.querySelector("#route-ledger-artifact-preview");
const copyRouteLedgerButton = document.querySelector("#copy-route-ledger");
const downloadRouteLedgerButton = document.querySelector("#download-route-ledger");
const mathCoreList = document.querySelector("#math-core-list");
const replayCommand = document.querySelector(".replay-command");
const answerValue = document.querySelector(".answer-value");
const answerLabel = document.querySelector(".answer-label");
const promptMath = document.querySelector("#prompt-math");
const receiptSummary = document.querySelector(".receipt-summary");
const mathSurfaceStatus = document.querySelector("#math-surface-status");
const mathSurfaceProblem = document.querySelector("#math-surface-problem");
const mathSurfaceResult = document.querySelector("#math-surface-result");
const mathSurfaceFacts = document.querySelector("#math-surface-facts");
const promptInput = document.querySelector("#prompt-input");
const composer = document.querySelector("#composer");
const verifyButton = document.querySelector("#verify-button");
const plotCanvas = document.querySelector("#plot-canvas");
const plotKind = document.querySelector("#plot-kind");
const plotTitle = document.querySelector("#plot-title");
const plotCaption = document.querySelector("#plot-caption");
const plotFacts = document.querySelector("#plot-facts");
const plotData = document.querySelector("#plot-data");
const visualRendererSourcePanel = document.querySelector("#visual-renderer-source");
const plotNodeInspector = document.querySelector("#plot-node-inspector");
const researchMapStatus = document.querySelector("#research-map-status");
const saveResearchMapButton = document.querySelector("#save-research-map");
const refreshResearchMapButton = document.querySelector("#refresh-research-map");
const researchMapList = document.querySelector("#research-map-list");
const refreshVisualArtifactsButton = document.querySelector("#refresh-visual-artifacts");
const visualArtifactList = document.querySelector("#visual-artifact-list");
const copyPlotDataButton = document.querySelector("#copy-plot-data");
const downloadPlotDataButton = document.querySelector("#download-plot-data");
const downloadPlotSvgButton = document.querySelector("#download-plot-svg");
const savePlotSourceButton = document.querySelector("#save-plot-source");
const renderVisualArtifactButton = document.querySelector("#render-visual-artifact");
const toggleVisualFocusButton = document.querySelector("#toggle-visual-focus");
const toggleVisualDetailButton = document.querySelector("#toggle-visual-detail");
const visualZoomOutButton = document.querySelector("#visual-zoom-out");
const visualZoomResetButton = document.querySelector("#visual-zoom-reset");
const visualZoomInButton = document.querySelector("#visual-zoom-in");
const visualZoomFitButton = document.querySelector("#visual-zoom-fit");
const visualArtifactBanner = document.querySelector("#visual-artifact-banner");
const visualModeBar = document.querySelector("#visual-mode-bar");
const visualModeButtons = document.querySelectorAll(".visual-mode-button");
const taskDockState = document.querySelector("#task-dock-state");
const taskDockSummary = document.querySelector("#task-dock-summary");
const taskList = document.querySelector("#task-list");
const taskConsoleList = document.querySelector("#task-console-list");
const copyTaskConsoleButton = document.querySelector("#copy-task-console");
const surfaceStatusText = {
  trace: "math workspace",
  plot: "visual modes",
  runbook: "agent harness",
  checks: "verification gates",
  graph: "claim lineage",
  protocol: "review standard",
  notes: "local scratchpad",
  replay: "session reel",
  report: "printable draft"
};
const laneStatusText = {
  math: "Math lane",
  sources: "Sources lane",
  code: "Code lane",
  data: "Data lane",
  writing: "Writing lane",
  physics: "Physics lane",
  biology: "Biology lane",
  chemistry: "Chemistry lane",
  finance: "Finance lane",
  hardware: "Hardware lane",
  quantum: "Quantum lane",
  security: "Security lane",
  patent: "Patent lane"
};
const researchHarnessDomainByLane = {
  math: "math",
  sources: "general",
  code: "code",
  data: "general",
  writing: "learning",
  physics: "physics",
  biology: "biomedical",
  chemistry: "biomedical",
  finance: "general",
  hardware: "code",
  quantum: "physics",
  security: "code",
  patent: "patent"
};
const verificationGateCatalog = [
  {
    id: "receipt",
    label: "Receipt envelope",
    command: "truth-harness ask --json",
    description: "Problem, output, evidence profile, privacy, artifacts, and replay command are captured.",
    applies: () => true,
    status: (receipt) => receipt.runId && receipt.replay ? "passed" : "missing"
  },
  {
    id: "exact",
    label: "Exact arithmetic trace",
    command: "truth-harness ask \"compute ...\" --json",
    description: "Arithmetic is represented as exact rationals or integers with replayable steps.",
    applies: (receipt) => /arithmetic|counterexample|parity/u.test(receipt.details["Evidence kind"] ?? receipt.engine),
    status: (receipt) => receipt.engine.includes("rational") || receipt.engine.includes("counterexample") ? "passed" : "missing"
  },
  {
    id: "counterexample",
    label: "Counterexample search",
    command: "truth-harness ask \"for all ...\" --json",
    description: "Universal claims can be refuted with exact witnesses and recorded search bounds.",
    applies: (receipt) => /for all|universal|counterexample|parity/u.test(`${receipt.title} ${receipt.engine} ${receipt.details["Evidence kind"]}`),
    status: (receipt) => receipt.trust === "refuted" || receipt.engine.includes("counterexample") ? "passed" : "missing"
  },
  {
    id: "dimension",
    label: "Dimensional analysis",
    command: "npm run demo:physics",
    description: "Physics expressions get unit and base-dimension checks before simulation trust.",
    applies: (receipt) => /dimension|force|mass|acceleration|physics/u.test(`${receipt.title} ${receipt.engine} ${receipt.details["Evidence kind"]}`),
    status: (receipt) => receipt.trust === "dimension-checked" || receipt.engine.includes("dimensional") ? "passed" : "missing"
  },
  {
    id: "symbolic",
    label: "Symbolic CAS receipt",
    command: "npm run demo:symbolic",
    description: "Symbolic transformations run through a local CAS with recorded operation, output, limitations, and sanity-check status.",
    applies: (receipt) => state.lane === "math" || /symbolic|polynomial|equation|algebra/u.test(receipt.title),
    status: (receipt) => /symbolic|cas/u.test(receipt.engine) ? "passed" : "waiting"
  },
  {
    id: "independent-cas",
    label: "Independent CAS / proof escalation",
    command: "truth-harness cas backends / truth-harness proof check / truth-harness smt check",
    description: "Same-engine symbolic sanity checks are useful, but stronger claims need a second CAS, SMT result, or proof-checker artifact.",
    applies: (receipt) => state.lane === "math" || /symbolic|cas|polynomial|equation|algebra/u.test(`${receipt.title} ${receipt.engine}`),
    status: (receipt) => ["cross-checked", "smt-checked", "proved"].includes(receipt.trust) || /maxima:passed/u.test(receipt.details["Independent CAS"] ?? "") ? "passed" : "waiting"
  },
  {
    id: "smt",
    label: "SMT solver check",
    command: "truth-harness smt check --json",
    description: "Bounded logic, satisfiability, and equivalence claims should route through SMT when applicable.",
    applies: (receipt) => state.lane === "math" || /all|exists|integer|constraint|satisf/u.test(receipt.title),
    status: (receipt) => receipt.trust === "smt-checked" || /smt|z3/u.test(receipt.engine) ? "passed" : "waiting"
  },
  {
    id: "proof",
    label: "Lean proof bridge",
    command: "truth-harness proof check --backend lean",
    description: "Only accepted proof-checker output may mint a formally proved trust label.",
    applies: (receipt) => state.lane === "math" || /proof|lemma|forall|for all/u.test(receipt.title),
    status: (receipt) => receipt.details["Proof checker"] === "true" || receipt.trust === "proved" ? "passed" : "waiting"
  },
  {
    id: "bench",
    label: "Benchmark suite",
    command: "npm run proof:launch",
    description: "Claims and engines should be regression-tested against seed and research-grade benchmark suites.",
    applies: () => true,
    status: () => "waiting"
  },
  {
    id: "privacy",
    label: "Privacy and replay audit",
    command: "truth-harness replay <receipt.json>",
    description: "Network, model context, command logs, and replay boundaries must match the receipt.",
    applies: () => true,
    status: (receipt) => (receipt.details.Network ?? "").toLowerCase() === "none" ? "passed" : "waiting"
  },
  {
    id: "paper",
    label: "Paper-ready packet",
    command: "truth-harness render <receipt.json> markdown",
    description: "Export evidence, limitations, citations, open gaps, and reviewer-ready reproduction steps.",
    applies: () => true,
    status: () => "waiting"
  }
];
const capabilityLedgerRows = [
  {
    category: "Computation",
    compare: "WolframAlpha / CAS",
    status: "building",
    truthHarness: "Exact rational arithmetic, traces, counterexamples, units, SymPy adapter, benchmark records.",
    gap: "Broader calculus, plotting, optimization, ODEs, assumptions, and multi-engine CAS cross-checks.",
    next: "Add a typed math router that escalates arithmetic -> symbolic -> SMT/proof -> report packet."
  },
  {
    category: "Open Math Engines",
    compare: "SageMath / SymPy",
    status: "adapter-first",
    truthHarness: "Uses local adapters and records backend ids, outputs, limits, and replay commands.",
    gap: "Sage, Julia, R, and richer numerical libraries are not first-class adapters yet.",
    next: "Define engine capability manifests and golden tests per adapter."
  },
  {
    category: "Formal Trust",
    compare: "Lean / Coq / Isabelle",
    status: "strict-gate",
    truthHarness: "Only accepted proof-checker output may mint proved; failed proof attempts stay unverified.",
    gap: "Informal-to-formal statement help, proof search history, and mathlib-aware guidance are early.",
    next: "Make Lean proof attempts a visible chain: statement, attempt, error, repair, accepted artifact."
  },
  {
    category: "Notebooks",
    compare: "JupyterLab",
    status: "gap",
    truthHarness: "Notebook-run records exist for provenance, but execution is not yet a notebook IDE.",
    gap: "No cell runtime, rich outputs, plots, or file explorer in the web shell.",
    next: "Add notebook/output receipts before adding a full kernel UI."
  },
  {
    category: "Provenance",
    compare: "DVC / DataLad / MLflow",
    status: "ahead",
    truthHarness: "Claim ledger records now have ids, tags, dependencies, supersession links, verification ladders, finalization gates, snapshots, receipts, and replay commands.",
    gap: "No visual diff/rollback UI or large artifact pointer strategy yet.",
    next: "Promote every web result into a claim record, then add graph diff, revert, and bundle export."
  },
  {
    category: "Scientific RAG",
    compare: "PaperQA / literature tools",
    status: "building",
    truthHarness: "Local source ingest, cite receipts, literature records, model-context and disclosure packets.",
    gap: "No semantic retrieval, DOI enrichment, contradiction detection, or citation-span verifier yet.",
    next: "Promote every cited sentence to a source receipt with entailment and contradiction checks."
  },
  {
    category: "Agent Harness",
    compare: "Claude / Codex alone",
    status: "ahead",
    truthHarness: "MCP/CLI/API routes, activity log, runbooks, receipts, safety center, reports, local evidence graph.",
    gap: "Front end is not yet a full mirror for every CLI/MCP route.",
    next: "Every CLI command gets a UI route, and every UI action emits the same artifact contract."
  },
  {
    category: "Research Reports",
    compare: "Lab notebooks / paper drafts",
    status: "building",
    truthHarness: "Printable report drafts include identity, trace, evidence graph, activity citations, and boundaries.",
    gap: "No signed finalization, DOI/source bibliography, PDF polish, or peer-review checklist yet.",
    next: "Add finalized report packets with signatures, citations, artifact bundle, and validation checklist."
  }
];
const runbookLoopSteps = [
  "Restate the objective as a narrow claim and list assumptions before using a model.",
  "Create a model-context packet that includes only the local evidence needed for the next step.",
  "Run the smallest relevant verifier first: exact math, source citation, code test, simulation, or validation gate.",
  "Attach every output as a receipt, source citation, notebook run, code run, benchmark, or snapshot reference.",
  "Update the evidence graph and activity log before asking the next agent question.",
  "Branch only when a gap is explicit, budgeted, and tied to a validation gate.",
  "Stop or narrow the claim when proof, citation, replication, safety, or expert-review gates remain open.",
  "Export a reviewer packet with commands, receipts, limitations, and unanswered questions."
];
const runbookLedgerItems = [
  "claim ledger records: exact statement, claim id, dependencies, supersession, tags, trust, open checks, and report packet",
  "model-context packets: exact prompt context, target model, privacy disclosure, and approval state",
  "receipts: mathematical claims, proof checks, SMT/CAS runs, refutations, and replay commands",
  "sources: local corpus hits, page spans, quotes, DOI or file hash metadata, and entailment notes",
  "execution records: code runs, notebooks, simulations, benchmark runs, environment and seed metadata",
  "snapshots: workspace state after meaningful changes so future agents can reproduce the path",
  "checkpoints: decisions, failed attempts, unresolved gaps, next checks, and claim-language changes"
];
const universalRunbookStopRules = [
  "No final claim may outrun the strongest satisfied verification gate.",
  "No biomedical, safety, legal, financial, or patent conclusion may be presented without expert review.",
  "No hosted-model call is allowed without an inspectable context packet and disclosure record.",
  "No long-running branch continues without a receipt, checkpoint, or explicit failed-result artifact."
];
const laneProtocols = {
  math: {
    name: "Math",
    title: "Proof and Computation Review",
    claimStandard: "A math result is not trusted because an AI says it. It must be exact, reproducible, and either formally proved, independently checked, or explicitly labeled as conjecture.",
    acceptedEvidence: [
      "Formal proof objects from Lean or another proof checker when the claim says proved.",
      "Exact symbolic or rational traces with every transformation replayable.",
      "Independent CAS or SMT checks for algebraic, bounded, or satisfiability claims.",
      "Counterexample searches that record domains, bounds, and search completeness."
    ],
    verificationGates: [
      "Parse the problem into a typed mathematical statement before solving.",
      "Separate conjecture, computed result, refuted claim, and formally proved claim.",
      "Run at least one independent checker for nontrivial algebra or logic.",
      "Record definitions, assumptions, domain restrictions, and failed proof attempts."
    ],
    reviewBoundary: [
      "A numeric pattern is not a truth-harness.",
      "A CAS simplification is not a proof unless the accepted checker backs it.",
      "A bounded search only covers the stated range."
    ],
    deliverables: [
      "Statement packet with definitions and assumptions.",
      "Machine-checkable proof or replayable computation trace.",
      "Counterexample and benchmark appendix.",
      "Plain-language explanation at multiple audience levels."
    ]
  },
  sources: {
    name: "Sources",
    title: "Citation and Provenance Review",
    claimStandard: "A sourced claim must link every sentence-level assertion to inspectable evidence, with quotes, bibliographic metadata, and retrieval boundaries preserved.",
    acceptedEvidence: [
      "Local PDFs, notes, web archives, DOI metadata, and versioned datasets.",
      "Quoted passages with page, section, or timestamp references.",
      "Claim-to-source mappings that distinguish primary evidence from commentary.",
      "RAG packets showing exactly what context was sent to a model."
    ],
    verificationGates: [
      "Prefer primary sources over summaries for factual claims.",
      "Flag source conflict, retraction, date drift, and missing citation spans.",
      "Record retrieval time, file hash, document version, and query terms.",
      "Keep model synthesis separate from the evidence excerpt it used."
    ],
    reviewBoundary: [
      "A citation proves that a source said something, not that the source is correct.",
      "A model summary cannot replace the original passage.",
      "Paywalled or inaccessible context must be labeled incomplete."
    ],
    deliverables: [
      "Claim ledger with citation spans.",
      "Source bundle manifest with hashes.",
      "Conflict table and open verification questions.",
      "Exportable bibliography and evidence packet."
    ]
  },
  code: {
    name: "Code",
    title: "Software Verification Review",
    claimStandard: "A code claim must be tied to tests, static checks, reproducible execution, and an environment receipt that an agent or human can replay.",
    acceptedEvidence: [
      "Unit, integration, property, regression, and headless UI tests.",
      "Type checks, linters, security scans, dependency audits, and SBOMs.",
      "Build logs with runtime, OS, toolchain, commit, and command metadata.",
      "Reproducers for bugs, fixes, and performance regressions."
    ],
    verificationGates: [
      "Run the smallest meaningful test first, then the broader suite for shared behavior.",
      "Record exact commands, exit codes, logs, and changed files.",
      "Sandbox untrusted code and deny network/file-system access unless explicitly granted.",
      "Preserve failing cases as regression tests before declaring a fix."
    ],
    reviewBoundary: [
      "Passing tests are evidence, not proof of absence of bugs.",
      "AI-written code needs the same review and exploit thinking as human code.",
      "A command receipt must not claim a sandbox property it did not measure."
    ],
    deliverables: [
      "Patch summary with linked tests.",
      "Reproduction recipe and rollback notes.",
      "Security and dependency review packet.",
      "Human-readable change log."
    ]
  },
  data: {
    name: "Data",
    title: "Statistical and Causal Review",
    claimStandard: "A data claim must preserve lineage from raw data to conclusion, expose uncertainty, and distinguish association, prediction, and causal inference.",
    acceptedEvidence: [
      "Dataset manifests with schema, provenance, licenses, and hashes.",
      "Notebook runs with deterministic seeds and captured environments.",
      "Exploratory plots, model diagnostics, confidence intervals, and sensitivity checks.",
      "Causal diagrams and identification assumptions for causal claims."
    ],
    verificationGates: [
      "Validate schema, missingness, outliers, leakage, and sample selection.",
      "Separate train, validation, test, and holdout decisions in the audit trail.",
      "Run robustness checks and baseline comparisons.",
      "State uncertainty, effect sizes, and power limits."
    ],
    reviewBoundary: [
      "Correlation is not causation without an explicit identification strategy.",
      "A high model score can still hide leakage or distribution shift.",
      "A dashboard chart is not a reproducible analysis by itself."
    ],
    deliverables: [
      "Data card and lineage graph.",
      "Reproducible notebook receipt.",
      "Diagnostics appendix.",
      "Decision memo with uncertainty and limitations."
    ]
  },
  writing: {
    name: "Writing",
    title: "Argument and Source Review",
    claimStandard: "A writing claim must be traceable from outline to sources, revisions, fact checks, and reader-level explanations without hiding unsupported assertions.",
    acceptedEvidence: [
      "Argument maps showing thesis, subclaims, evidence, and objections.",
      "Citation-backed paragraphs with source spans and quote checks.",
      "Revision history showing what changed and why.",
      "Audience-level summaries that preserve the same claim boundaries."
    ],
    verificationGates: [
      "Detect uncited factual claims and ambiguous definitions.",
      "Check citations against the exact text they support.",
      "Maintain a contradiction and open-question log.",
      "Export drafts with source packets for peer review."
    ],
    reviewBoundary: [
      "Clear prose does not make a claim true.",
      "Paraphrases can drift from the source and must be checked.",
      "The app can help draft; humans remain accountable for publication claims."
    ],
    deliverables: [
      "Claim-backed manuscript draft.",
      "Citation and quote audit.",
      "Reviewer response log.",
      "Teaching summaries for different audiences."
    ]
  },
  physics: {
    name: "Physics",
    title: "Model, Unit, and Simulation Review",
    claimStandard: "A physics claim must state its model, units, conservation assumptions, numerical method, and regime of validity before it can be treated as evidence.",
    acceptedEvidence: [
      "Dimensional analysis and unit-consistency receipts.",
      "Analytic derivations with assumptions and boundary conditions.",
      "Numerical simulations with solver, mesh, timestep, tolerance, and convergence logs.",
      "Benchmark comparisons against known textbook or experimental cases."
    ],
    verificationGates: [
      "Check units and conserved quantities before trusting a simulation.",
      "Run convergence, stability, and sensitivity checks.",
      "Compare against a simpler analytic or limiting case.",
      "Record physical constants, coordinate systems, and approximations."
    ],
    reviewBoundary: [
      "A simulation is only as valid as the model and boundary conditions.",
      "Dimensional consistency is necessary but not sufficient.",
      "Agreement with one benchmark does not validate all regimes."
    ],
    deliverables: [
      "Model card with assumptions and validity regime.",
      "Solver receipt and convergence appendix.",
      "Benchmark comparison table.",
      "Reproducible plots and data export."
    ]
  },
  biology: {
    name: "Biology",
    title: "Biological Evidence Review",
    claimStandard: "A biology claim must separate hypothesis, literature signal, in vitro evidence, animal evidence, clinical evidence, and safety boundaries with no medical overclaiming.",
    acceptedEvidence: [
      "Primary literature, protocols, assay data, omics pipelines, and preregistrations.",
      "Dose-response curves, controls, replicates, blinding, and statistical plans.",
      "Pathway graphs with species, tissue, cell line, and context labels.",
      "Safety, ethics, IRB, biosafety, and clinical-trial context where relevant."
    ],
    verificationGates: [
      "Classify evidence tier before generating conclusions.",
      "Check controls, batch effects, sample size, and endpoint validity.",
      "Separate mechanism hypotheses from therapeutic claims.",
      "Require expert and regulatory review for medical or clinical interpretation."
    ],
    reviewBoundary: [
      "The app does not diagnose, prescribe, or validate a treatment.",
      "Cell or animal evidence does not imply human efficacy.",
      "Literature support can be weak, biased, or nonreplicable."
    ],
    deliverables: [
      "Evidence-tier map.",
      "Protocol and assay review packet.",
      "Replication and validation plan.",
      "Clinical and safety boundary memo."
    ]
  },
  chemistry: {
    name: "Chemistry",
    title: "Molecular and Materials Review",
    claimStandard: "A chemistry claim must ground structures, reactions, stoichiometry, spectra, hazards, and conditions in reproducible records and safety-aware validation.",
    acceptedEvidence: [
      "Molecular structures, reaction schemes, stoichiometry, and balance checks.",
      "Spectroscopy, chromatography, crystallography, or materials characterization data.",
      "Thermodynamic, kinetic, or quantum-chemistry calculations with method metadata.",
      "SDS, hazard, storage, and waste-handling references."
    ],
    verificationGates: [
      "Validate structures, charges, stereochemistry, and atom balance.",
      "Record solvents, temperature, pressure, catalysts, purity, and yields.",
      "Compare computed properties to experimental or reference data when possible.",
      "Require safety review before any wet-lab procedure."
    ],
    reviewBoundary: [
      "A plausible reaction is not a safe or proven synthesis.",
      "Computed chemistry depends strongly on method and basis assumptions.",
      "The app must not provide hazardous operational guidance without safety framing."
    ],
    deliverables: [
      "Reaction or molecule evidence packet.",
      "Characterization table.",
      "Method and uncertainty report.",
      "Safety and handling boundary sheet."
    ]
  },
  finance: {
    name: "Finance",
    title: "Audit and Risk Review",
    claimStandard: "A finance claim must be ledger-backed, reconciled, timestamped, and clear about risk, assumptions, and whether it is accounting, forecasting, or advice.",
    acceptedEvidence: [
      "Bank, brokerage, invoice, receipt, and ledger imports with hashes.",
      "Reconciliation reports tying source records to computed balances.",
      "Forecast assumptions, scenario tables, and sensitivity analysis.",
      "Tax, compliance, or policy references with jurisdiction and date."
    ],
    verificationGates: [
      "Reconcile every balance to source records before summarizing.",
      "Classify transactions with reviewable rules and exceptions.",
      "Separate historical facts from projections and recommendations.",
      "Flag missing records, stale prices, and jurisdiction-specific uncertainty."
    ],
    reviewBoundary: [
      "The app is not a fiduciary, accountant, or tax attorney.",
      "Forecasts can fail under market or life changes.",
      "A clean dashboard can still hide bad source data."
    ],
    deliverables: [
      "Reconciled ledger packet.",
      "Cash-flow and risk report.",
      "Exception queue.",
      "Advisor-ready export with assumptions."
    ]
  },
  hardware: {
    name: "Hardware",
    title: "Design, Calibration, and Safety Review",
    claimStandard: "A hardware claim must connect requirements, CAD or schematics, tolerances, BOM, firmware, calibration, and bench-test evidence before being trusted.",
    acceptedEvidence: [
      "CAD files, schematics, PCB layouts, firmware builds, and BOM manifests.",
      "Tolerance analyses, thermal, mechanical, and electrical calculations.",
      "Sensor calibration records and bench-test logs.",
      "Safety, standards, and failure-mode reviews."
    ],
    verificationGates: [
      "Trace each requirement to a design artifact and test.",
      "Check units, tolerances, ratings, and worst-case limits.",
      "Record instrument model, calibration date, setup photos, and raw measurements.",
      "Run failure-mode, safety, and manufacturability review before release."
    ],
    reviewBoundary: [
      "A design file is not proof the physical object works.",
      "Bench tests are limited by instruments, setup, and sample count.",
      "Safety-critical systems require expert certification."
    ],
    deliverables: [
      "Requirement-to-test matrix.",
      "BOM and design artifact bundle.",
      "Calibration and bench-test report.",
      "Failure-mode and safety review packet."
    ]
  },
  quantum: {
    name: "Quantum",
    title: "Quantum Circuit and Experiment Review",
    claimStandard: "A quantum claim must state the circuit, backend, noise model, measurement basis, shot count, simulator settings, and classical verification boundary.",
    acceptedEvidence: [
      "Circuit diagrams, QASM, simulator configs, and backend calibration metadata.",
      "State-vector, stabilizer, tensor, or hardware execution receipts.",
      "Noise models, shot statistics, confidence intervals, and error mitigation logs.",
      "Classical cross-checks for small systems."
    ],
    verificationGates: [
      "Version the circuit and measurement mapping.",
      "Compare ideal simulation, noisy simulation, and hardware results when possible.",
      "Report shot count, seed, backend, queue time, and calibration snapshot.",
      "Classify claims as educational, simulated, hardware-observed, or experimentally validated."
    ],
    reviewBoundary: [
      "A simulator result is not a hardware experiment.",
      "A hardware sample can be noise-dominated or calibration-specific.",
      "Quantum advantage claims require extraordinary independent review."
    ],
    deliverables: [
      "Circuit receipt and QASM export.",
      "Backend and noise report.",
      "Measurement statistics packet.",
      "Classical verification appendix."
    ]
  },
  security: {
    name: "Security",
    title: "Threat, Reproduction, and Disclosure Review",
    claimStandard: "A security claim must include a threat model, isolated reproduction, impact analysis, remediation evidence, and responsible-disclosure boundaries.",
    acceptedEvidence: [
      "Threat models, attack trees, repro scripts, logs, and environment manifests.",
      "Static and dynamic analysis with tool versions and findings.",
      "Patch diffs, regression tests, and exploitability notes.",
      "Disclosure timeline and affected-version matrix."
    ],
    verificationGates: [
      "Reproduce only in authorized, isolated environments.",
      "Record exact versions, inputs, privileges, and network conditions.",
      "Separate suspected issue, confirmed vulnerability, exploit, and fixed state.",
      "Validate remediation with tests and negative controls."
    ],
    reviewBoundary: [
      "The app must not help unauthorized exploitation.",
      "Scanner output can be false positive or false negative.",
      "Severity labels require context and owner review."
    ],
    deliverables: [
      "Threat model packet.",
      "Safe reproduction record.",
      "Fix and regression-test report.",
      "Disclosure-ready advisory draft."
    ]
  },
  patent: {
    name: "Patent",
    title: "Invention and Prior-Art Review",
    claimStandard: "A patent claim must be treated as an invention-support workflow, not legal advice, with dated records, prior art, claim charts, and counsel-review boundaries.",
    acceptedEvidence: [
      "Invention disclosures, dated notebooks, diagrams, prototypes, and test receipts.",
      "Patent, paper, product, and web prior-art collections with citation spans.",
      "Claim charts mapping features to evidence and prior art.",
      "Novelty, utility, enablement, and non-obviousness questions for counsel."
    ],
    verificationGates: [
      "Hash and timestamp invention records before drafting claims.",
      "Separate what was built, what was imagined, and what was verified.",
      "Search prior art across patents, papers, products, and public disclosures.",
      "Export counsel-ready packets without pretending to provide legal opinion."
    ],
    reviewBoundary: [
      "The app is not a patent attorney.",
      "Prior-art search can miss material references.",
      "Patentability and freedom to operate require qualified legal review."
    ],
    deliverables: [
      "Invention disclosure packet.",
      "Prior-art matrix.",
      "Claim-chart draft.",
      "Attorney handoff export."
    ]
  }
};
let replayTimer;
let catalogSearchTimer;
let sidebarResizeActive = false;
let sidebarResizePointerId = null;
let sidebarResizeStartX = 0;
let sidebarResizeStartWidth = SIDEBAR_DEFAULT_WIDTH;

researchNotes.value = loadNotes();
researcherNameInput.value = loadResearcherName();
updateResearcherNameSummary();
initSidebarLayout();
updateNotesStatus("local draft");
addActivity("system", "Workbench opened", "Static shell loaded; no external service contacted.", "passed");
addActivity("system", "Local API ready", "UI will submit prompts only to local receipt and claim ledger routes on this machine.", "waiting");
render();
void refreshWorkspaceEvents({ announce: false });
void refreshSafetyStatus();
void refreshEngineRuns({ announce: false });
void refreshReleaseAudit({ announce: false });
void refreshWorkspaceReadiness();
void refreshWorkspaceMaintenance({ announce: false });
void refreshCatalogStatus();
void refreshClaimLedger();
void refreshRouteLedger();
void refreshResearchSessions();
void refreshResearchMap();
void refreshVisualArtifacts();
void refreshWorkspaceReview();
void refreshLatestProfessorChallengeSeed({ announce: false });
void refreshWorkspaceRunNext({ announce: false });
void refreshWorkspacePilotLoop({ announce: false });
void refreshWorkspaceRunNextHandoffs({ announce: false });
void refreshWorkspaceGraph();
void refreshCasChecks();
void refreshSmtChecks();

function render() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  document.querySelector(".session-title h2").textContent = receipt.title;
  document.querySelector(".session-title p").textContent = receipt.subtitle;
  document.querySelector(".status-pill").textContent = receipt.trust;
  document.querySelector(".status-pill").className = `status-pill ${trustClass(receipt.trust)}`;
  document.querySelector(".engine-message .message-meta").textContent = receipt.engine;
  document.querySelector(".user-message p").textContent = receipt.title;
  inspectorTrust.textContent = receipt.trust;
  inspectorTrust.className = `status-pill ${trustClass(receipt.trust)}`;
  answerValue.innerHTML = renderMathInline(receipt.math?.output ?? receipt.output);
  answerValue.setAttribute("aria-label", receipt.output);
  answerLabel.textContent = receipt.trust === "refuted" ? "counterexample" : "verified output";
  promptMath.innerHTML = renderMathInline(receipt.math?.input ?? receipt.title);
  if (mathSurfaceStatus && mathSurfaceProblem && mathSurfaceResult && mathSurfaceFacts) {
    mathSurfaceStatus.textContent = `${receipt.trust} / ${receipt.engine}`;
    mathSurfaceProblem.innerHTML = renderMathInline(receipt.math?.input ?? receipt.title);
    mathSurfaceResult.innerHTML = renderMathInline(receipt.math?.output ?? receipt.output);
    mathSurfaceFacts.innerHTML = [
      ["Trust", receipt.trust],
      ["Engine", receipt.engine],
      ["Replay", receipt.replay]
    ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  }
  replayCommand.textContent = receipt.replay;
  receiptSummary.innerHTML = [
    receipt.runId,
    ...(receipt.claimId ? [`claim ${receipt.claimId}`] : []),
    `engine ${receipt.engine}`,
    `trust ${receipt.trust}`,
    ...receiptTags(receipt).map((tag) => `#${tag}`)
  ].map((item) => `<span>${escapeHtml(item)}</span>`).join("");

  receiptDetails.innerHTML = [
    ...Object.entries(receipt.details),
    ...claimReceiptDetailRows(receipt),
    ["Claim ledger", receipt.claimId ?? "not recorded"]
  ]
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
  renderRouteLedger(receipt);

  graphList.innerHTML = graphInspectorEntries(receipt)
    .map(([kind, summary]) => `<div class="graph-node"><span>${escapeHtml(kind)}</span><strong>${escapeHtml(summary)}</strong></div>`)
    .join("");
  renderBranchMap(receipt);
  renderMainGraph(receipt);
  renderSurface();
  renderMathPlot(receipt);

  traceList.innerHTML = (receipt.traces[state.level] ?? receipt.traces.middle)
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  document.querySelector(".boundary-list").innerHTML = receipt.limitations
    .map((limitation) => `<li>${escapeHtml(limitation)}</li>`)
    .join("");

  renderClaimList();
  renderClaimLedger();
  renderRouteHistory();
  renderWorkspaceReview();
  renderActivityLog();
  renderLane();
  renderProjectStart();
  renderProtocol();
  renderSafetyStatus();
  renderWorkspaceReadinessStatus();
  renderAgentRoutes(receipt);
  renderRunbook(receipt);
  renderWorkspaceRunNext();
  renderWorkspacePilotLoop();
  renderWorkspaceRunNextHandoffs();
  renderVerificationMatrix(receipt);
  renderReviewerReadinessConsole();
  renderReleaseAuditGate();
  renderCapabilityLedger();
  renderMaintenancePanel();
  renderTaskDock(receipt);
  renderReplay(receipt);
  renderCredibilityPackPanel();
  renderReport(receipt);
  updateClaimRecordButtons(receipt);
  renderCatalogSearchPanel();
  renderSidebarProjects();
  renderResearchSessions();
  renderSidebarActions();
  applySidebarSearch();
  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.level === state.level);
  });
}

function renderProjectStart() {
  if (projectStartLane) {
    projectStartLane.textContent = laneStatusText[state.lane] ?? "Research lane";
  }
  if (projectStartClaims) {
    const count = claimLedgerStore.size;
    projectStartClaims.textContent = `${count} ${count === 1 ? "claim" : "claims"}`;
  }
}

function renderSidebarProjects() {
  projectRows.forEach((row) => {
    const lane = row.dataset.projectLane;
    const summary = sidebarProjectSummary(lane);
    const label = row.querySelector("span:first-child");
    const meta = row.querySelector("span:last-child");

    if (label) {
      label.textContent = summary.label;
    }
    if (meta) {
      meta.textContent = summary.meta;
    }
    row.title = summary.detail;
  });
}

function sidebarProjectSummary(lane) {
  const totalClaims = claimLedgerStore.size;
  const totalRoutes = routeLedgerStore.size;
  const totalSessions = researchSessions.length;
  const queueItems = Number.isFinite(workspaceReview.summary?.totalItems)
    ? workspaceReview.summary.totalItems
    : workspaceReview.items?.length ?? 0;

  if (lane === "math") {
    const receiptCount = receiptStore.size;
    return {
      label: "Truth Harness",
      meta: totalClaims > 0 ? `${totalClaims} claims` : `${receiptCount} receipts`,
      detail: `${totalClaims} claim records, ${totalRoutes} verifier routes, ${totalSessions} research sessions, ${queueItems} project queue items.`
    };
  }

  const claimCount = countClaimsForLane(lane);
  const receiptCount = countReceiptsForLane(lane);
  const label = lane === "finance"
    ? "Finance audit lab"
    : lane === "physics"
      ? "Physics notes"
      : `${laneStatusText[lane] ?? "Research lane"}`;
  return {
    label,
    meta: claimCount > 0 ? `${claimCount} claims` : receiptCount > 0 ? `${receiptCount} receipts` : "template",
    detail: `${claimCount} claim records and ${receiptCount} visible receipts tagged for the ${lane ?? "research"} lane.`
  };
}

function countClaimsForLane(lane) {
  return [...claimLedgerStore.values()].filter((claim) => claim.domain === lane).length;
}

function countReceiptsForLane(lane) {
  return [...receiptStore.values()].filter((receipt) => receiptTags(receipt).includes(lane)).length;
}

function renderResearchSessions() {
  if (!sessionList) {
    return;
  }

  const query = state.sidebarQuery.trim().toLowerCase();
  const sessions = researchSessions
    .filter((session) => !query || researchSessionSearchText(session).includes(query))
    .slice(0, 4);

  if (sessions.length === 0) {
    sessionList.innerHTML = `<div class="sidebar-empty">${query ? "No matching local sessions." : "No local sessions yet."}</div>`;
    return;
  }

  sessionList.innerHTML = sessions.map((session) => {
    const title = session.title || session.objective || session.sessionId;
    const active = state.selectedResearchSessionId === session.sessionId ? " active" : "";
    const domains = Array.isArray(session.domains) && session.domains.length > 0 ? session.domains.join(", ") : "research";
    const openTasks = Number.isFinite(session.openTaskCount) ? session.openTaskCount : 0;
    const checkpoints = Number.isFinite(session.checkpointCount) ? session.checkpointCount : 0;
    const evidence = Number.isFinite(session.evidenceRefCount) ? session.evidenceRefCount : 0;
    const updated = formatRouteDate(session.updatedAt);
    const summary = `${domains} - ${openTasks} open tasks, ${checkpoints} checkpoints, ${evidence} evidence refs`;

    return `
      <button class="session-row${active}" data-session-id="${escapeHtml(session.sessionId)}" type="button" title="${escapeHtml(summary)}">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(updated)} - ${escapeHtml(summary)}</small>
      </button>
    `;
  }).join("");
}

function researchSessionSearchText(session) {
  return [
    session.sessionId,
    session.title,
    session.objective,
    ...(session.domains ?? []),
    session.privacy?.mode,
    session.modelPolicy?.hostedModels
  ]
    .join(" ")
    .toLowerCase();
}

function renderRouteLedger(receipt) {
  const route = receipt.verifierRoute;
  const rows = route ? routeLedgerRows(receipt, route) : [
    ["Status", "not persisted"],
    ["Next", "Submit a prompt to write a local verifier route."]
  ];
  const allowedArtifactPaths = rows
    .map(([, value]) => value)
    .map((value) => normalizedWorkspaceArtifactRef(value))
    .filter((value) => workspaceArtifactRefIsPreviewable(value));

  routeLedgerStatus.textContent = route ? "persisted locally" : "seed receipt";
  routeLedgerStatus.className = route ? "mini-label route-ledger-status-live" : "mini-label";
  routeLedgerDetails.innerHTML = rows
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${routeLedgerValueHtml(label, value)}</dd></div>`)
    .join("");
  if (routeLedgerArtifactPreview) {
    routeLedgerArtifactPreview.innerHTML = workspaceArtifactPreviewHtml("route-ledger", {
      allowedPaths: allowedArtifactPaths,
      emptyHtml: ""
    });
  }

  copyRouteLedgerButton.disabled = !route;
  downloadRouteLedgerButton.disabled = !route;
}

function routeLedgerRows(receipt, route) {
  const routePaths = receipt.routePaths ?? {};
  const routeReplay = route.replay?.command ?? receipt.replay;
  const obligationCounts = routeObligationCounts(route);
  const readiness = routeReadiness(route);
  return [
    ["Route ID", route.routeId],
    ["Status", `${route.status} / ${route.finalTrust ?? receipt.trust}`],
    ["Readiness", `${readiness.ready ? "ready" : "not-ready"} / ${readiness.strongestTrust}`],
    ["Replay", routeReplay],
    ["JSON", routePaths.json ?? "local route JSON path not returned"],
    ["Markdown", routePaths.markdown ?? "local route Markdown path not returned"],
    ["Gaps", String(route.gaps?.length ?? 0)],
    ["Obligations", obligationCounts.summary],
    ["Open obligations", String(obligationCounts.open)],
    ["Critical open", String(obligationCounts.criticalOpen)]
  ];
}

function routeLedgerValueHtml(label, value) {
  const codeLabels = new Set(["Route ID", "Replay", "JSON", "Markdown"]);
  if (!codeLabels.has(label)) {
    return escapeHtml(value);
  }

  if (workspaceArtifactRefIsPreviewable(value)) {
    return artifactRefControlHtml(value, {
      surface: "route-ledger",
      label: "Open"
    });
  }

  return `<code title="${escapeHtml(value)}">${escapeHtml(value)}</code>`;
}

function verifierRouteReportFacts(receipt) {
  const route = receipt.verifierRoute;
  if (!route) {
    return [
      ["Status", "not persisted"],
      ["Boundary", "This seed/demo receipt has no local verifier route artifact yet."]
    ];
  }

  const routePaths = receipt.routePaths ?? {};
  const obligationCounts = routeObligationCounts(route);
  const readiness = routeReadiness(route);
  return [
    ["Route ID", route.routeId],
    ["Status", `${route.status} / ${route.finalTrust ?? receipt.trust}`],
    ["Readiness", `${readiness.ready ? "ready" : "not-ready"} / ${readiness.strongestTrust}`],
    ["Readiness summary", readiness.summary],
    ["Evidence kind", route.evidenceKind ?? receipt.details["Evidence kind"] ?? "unknown"],
    ["Replay", route.replay?.command ?? receipt.replay],
    ["JSON", routePaths.json ?? "local route JSON path not returned"],
    ["Markdown", routePaths.markdown ?? "local route Markdown path not returned"],
    ["Gaps", String(route.gaps?.length ?? 0)],
    ["Obligations", obligationCounts.summary],
    ["Open obligations", String(obligationCounts.open)],
    ["Satisfied obligations", String(obligationCounts.satisfied)],
    ["Critical open obligations", String(obligationCounts.criticalOpen)]
  ];
}

function routeReportValueHtml(label, value) {
  const codeLabels = new Set(["Route ID", "Replay", "JSON", "Markdown"]);
  if (!codeLabels.has(label)) {
    return escapeHtml(value);
  }

  return `<code>${escapeHtml(value)}</code>`;
}

function verifierRouteObligationItems(receipt) {
  const obligations = receipt.verifierRoute?.proofObligations ?? [];
  if (obligations.length === 0) {
    return ["No proof obligations recorded for this route."];
  }

  return obligations.map((obligation) => {
    const command = obligation.command ?? commandForObligation(obligation, receipt);
    const satisfiedBy = routeObligationEvidenceHtml(obligation);
    return `<strong>${escapeHtml(obligation.title)}</strong> <code>${escapeHtml(obligation.obligationId)}</code>: ${escapeHtml(obligation.requiredBefore)}
      <ul class="report-sublist">
        <li>Close with: ${escapeHtml(obligationEvidencePath(obligation))}</li>
        <li>Acceptance: ${escapeHtml(obligationAcceptanceSummary(obligation))}</li>
        <li>Command: <code>${escapeHtml(command)}</code></li>
      </ul>
      ${satisfiedBy}`;
  });
}

function verifierRouteObligationMarkdown(receipt) {
  const obligations = receipt.verifierRoute?.proofObligations ?? [];
  if (obligations.length === 0) {
    return ["- none recorded"];
  }

  return obligations.flatMap((obligation) => [
    `- ${obligation.title} (${obligation.obligationId})`,
    `  - Status: ${obligation.status}`,
    `  - Severity: ${obligation.severity}`,
    `  - Statement: ${obligation.statement}`,
    `  - Required before: ${obligation.requiredBefore}`,
    ...routeObligationWorkOrderMarkdown(obligation, receipt),
    ...(obligation.satisfiedAt ? [`  - Satisfied at: ${obligation.satisfiedAt}`] : []),
    ...(obligation.satisfactionSummary ? [`  - Satisfaction: ${obligation.satisfactionSummary}`] : []),
    ...routeObligationEvidenceMarkdown(obligation),
    ...((obligation.acceptanceCriteria ?? []).map((criterion) => `  - Accept: ${criterion}`))
  ]);
}

function routeObligationWorkOrderMarkdown(obligation, receipt) {
  const command = obligation.command ?? commandForObligation(obligation, receipt);
  return [
    `  - Command: \`${command}\``,
    `  - Close with: ${obligationEvidencePath(obligation)}`,
    `  - Accept when: ${obligationAcceptanceSummary(obligation)}`,
    `  - Attached: ${routeObligationAttachedEvidenceSummary(obligation)}`
  ];
}

function routeObligationEvidenceHtml(obligation) {
  const refs = Array.isArray(obligation.satisfiedBy) ? obligation.satisfiedBy : [];
  if (refs.length === 0) {
    return "";
  }

  const items = refs
    .map((ref) => {
      const trust = ref.trust ? ` <code>${escapeHtml(ref.trust)}</code>` : "";
      const summary = ref.summary ? ` - ${escapeHtml(ref.summary)}` : "";
      return `<li><code>${escapeHtml(ref.kind)}:${escapeHtml(ref.ref)}</code>${trust}${summary}</li>`;
    })
    .join("");
  return `<ul class="report-sublist">${items}</ul>`;
}

function routeObligationEvidenceMarkdown(obligation) {
  const refs = Array.isArray(obligation.satisfiedBy) ? obligation.satisfiedBy : [];
  if (refs.length === 0) {
    return [];
  }

  return [
    "  - Satisfied by:",
    ...refs.map((ref) => {
      const trust = ref.trust ? ` (${ref.trust})` : "";
      const summary = ref.summary ? ` - ${ref.summary}` : "";
      return `    - ${ref.kind}:${ref.ref}${trust}${summary}`;
    })
  ];
}

function renderClaimList() {
  const query = state.sidebarQuery.trim().toLowerCase();
  const entries = sidebarRecentEntries(query);

  claimList.innerHTML = entries.length === 0
    ? `<div class="sidebar-empty">No matching claims.</div>`
    : entries
    .map(sidebarRecentEntryHtml)
    .join("");
}

function sidebarRecentEntries(query) {
  const seenClaimSignatures = new Set();
  const claimEntries = [...claimLedgerStore.values()]
    .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")))
    .map((claim, index) => sidebarClaimEntry(claim, index))
    .filter((entry) => {
      const signature = sidebarEntrySignature(entry);
      if (seenClaimSignatures.has(signature)) {
        return false;
      }
      seenClaimSignatures.add(signature);
      return sidebarEntryMatchesQuery(entry, query);
    });
  const claimedReceiptKeys = new Set(claimEntries.map((entry) => entry.receiptKey).filter(Boolean));
  const receiptEntries = [];

  recentReceiptKeys.forEach((key, index) => {
    if (claimedReceiptKeys.has(key)) {
      return;
    }
    const receipt = receiptStore.get(key);
    if (!receipt) {
      return;
    }
    const entry = sidebarReceiptEntry(key, receipt, index);
    if (sidebarEntryMatchesQuery(entry, query)) {
      receiptEntries.push(entry);
    }
  });

  return [...receiptEntries, ...claimEntries]
    .sort((left, right) => right.sortTime - left.sortTime || left.order - right.order)
    .slice(0, 12);
}

function sidebarReceiptEntry(key, receipt, index) {
  const sortTime = Date.parse(receipt.createdAt ?? "") || 0;
  return {
    kind: "receipt",
    order: index,
    sortTime,
    receiptKey: key,
    claimId: receipt.claimId,
    trust: receipt.trust,
    title: receipt.title,
    subtitle: receipt.subtitle,
    detail: receipt.claimId ?? receipt.runId,
    tags: receiptTags(receipt),
    searchText: [
      key,
      receipt.title,
      receipt.subtitle,
      receipt.trust,
      receipt.claimId,
      receipt.runId,
      receipt.engine,
      receipt.output,
      ...receiptTags(receipt),
      ...receiptTags(receipt).map((tag) => `#${tag}`)
    ]
      .filter(Boolean)
      .join(" ")
  };
}

function sidebarClaimEntry(claim, index) {
  const finalization = claimFinalizationSummary(claim);
  const receiptKey = receiptKeyForClaimRecord(claim);
  const sortTime = Date.parse(claim.createdAt ?? "") || 0;
  return {
    kind: "claim",
    order: 1000 + index,
    sortTime,
    receiptKey,
    claimId: claim.claimId,
    trust: claim.trust,
    title: claim.title,
    subtitle: `${claim.domain} - ${claim.trust} - ${finalization.label}`,
    detail: finalization.primaryCheck || claim.claimId,
    tags: claim.tags ?? [],
    searchText: [
      claim.claimId,
      claim.title,
      claim.statement,
      claim.normalizedStatement,
      claim.domain,
      claim.status,
      claim.trust,
      finalization.label,
      finalization.primaryCheck,
      ...(claim.tags ?? []),
      ...(claim.tags ?? []).map((tag) => `#${tag}`),
      ...(claim.dependsOn ?? []),
      ...(claim.supersedes ?? []),
      ...(claim.evidenceRefs ?? []).flatMap((ref) => [ref.kind, ref.ref, ref.trust, ref.summary])
    ]
      .filter(Boolean)
      .join(" ")
  };
}

function receiptKeyForClaimRecord(claim) {
  const directKey = receiptKeyForClaimId(claim.claimId);
  if (directKey) {
    return directKey;
  }

  for (const ref of claim.evidenceRefs ?? []) {
    for (const [key, receipt] of receiptStore.entries()) {
      if (evidenceRefMatchesReceipt(ref, receipt)) {
        return key;
      }
    }
  }

  const claimTitle = normalizeSidebarSignatureText(claim.title);
  if (!claimTitle) {
    return undefined;
  }

  for (const [key, receipt] of receiptStore.entries()) {
    if (normalizeSidebarSignatureText(receipt.title) === claimTitle && (!claim.trust || claim.trust === receipt.trust)) {
      return key;
    }
  }

  return undefined;
}

function sidebarEntrySignature(entry) {
  return `${normalizeSidebarSignatureText(entry.title)}:${entry.trust ?? ""}`;
}

function normalizeSidebarSignatureText(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim().toLowerCase();
}

function sidebarEntryMatchesQuery(entry, query) {
  if (!query) {
    return true;
  }

  return entry.searchText.toLowerCase().includes(query);
}

function sidebarRecentEntryHtml(entry) {
  const activeReceipt = entry.receiptKey && entry.receiptKey === state.receiptKey;
  const activeClaim = entry.claimId && receiptStore.get(state.receiptKey)?.claimId === entry.claimId;
  const dataAttrs = [
    `data-sidebar-entry-kind="${escapeHtml(entry.kind)}"`,
    entry.receiptKey ? `data-receipt="${escapeHtml(entry.receiptKey)}"` : "",
    entry.claimId ? `data-claim-id="${escapeHtml(entry.claimId)}"` : ""
  ].filter(Boolean).join(" ");
  const detail = entry.detail ? `<small class="claim-ledger-id">${escapeHtml(entry.detail)}</small>` : "";

  return `<button class="claim-row ${activeReceipt || activeClaim ? "active" : ""}" ${dataAttrs} type="button">
    <span class="trust-dot ${trustClass(entry.trust)}"></span>
    <span>
      <strong>${escapeHtml(entry.title)}</strong>
      <small>${escapeHtml(entry.subtitle)}</small>
      ${detail}
      ${renderTagPills((entry.tags ?? []).slice(0, 3))}
    </span>
  </button>`;
}

function renderMathPlot(receipt) {
  if (!plotCanvas || !plotTitle || !plotCaption || !plotFacts || !plotData) {
    return;
  }

  const selectedMapSnapshot = selectedResearchMapSnapshot();
  const selectedVisualArtifact = selectedVisualArtifactRecord?.visualId === state.selectedVisualArtifactId
    ? selectedVisualArtifactRecord
    : undefined;
  const plot = selectedVisualArtifact
    ? createSavedVisualArtifactModel(selectedVisualArtifact)
    : selectedMapSnapshot
      ? createSavedResearchMapVisualModel(selectedMapSnapshot)
      : createVisualModel(receipt, state.visualMode);
  if (plotKind) {
    plotKind.textContent = plot.kind;
  }
  if (researchMapStatus) {
    researchMapStatus.textContent = selectedVisualArtifact
      ? `${selectedVisualArtifact.kind ?? "visual"} artifact from visuals ledger`
      : selectedMapSnapshot
      ? `${selectedMapSnapshot.snapshotId} opened from local map`
      : `${plot.kind} can be saved locally`;
  }
  if (visualArtifactBanner) {
    visualArtifactBanner.hidden = !selectedVisualArtifact;
    visualArtifactBanner.innerHTML = selectedVisualArtifact
      ? savedVisualArtifactBannerHtml(selectedVisualArtifact)
      : "";
  }
  if (renderVisualArtifactButton) {
    const renderEngine = selectedVisualRenderEngine(selectedVisualArtifact);
    const canRender = Boolean(renderEngine);
    renderVisualArtifactButton.hidden = !canRender;
    renderVisualArtifactButton.disabled = !canRender;
    renderVisualArtifactButton.textContent = renderEngine === "plotly" ? "Render plot SVG" : "Render SVG";
  }
  if (savePlotSourceButton) {
    savePlotSourceButton.hidden = Boolean(selectedVisualArtifact);
    savePlotSourceButton.disabled = Boolean(selectedVisualArtifact) || !receipt;
  }
  if (visualModeBar) {
    visualModeBar.hidden = Boolean(selectedVisualArtifact);
  }
  plotTitle.textContent = plot.title;
  plotCaption.textContent = plot.caption;
  plotCanvas.innerHTML = plot.svg;
  plotCanvas.dataset.visualMode = plot.sourceVisualMode ?? state.visualMode;
  plotCanvas.dataset.visualArtifact = selectedVisualArtifact?.visualId ?? "";
  plotCanvas.dataset.visualArtifactKind = selectedVisualArtifact?.kind ?? "";
  plotCanvas.dataset.savedMapSnapshot = selectedMapSnapshot?.snapshotId ?? "";
  if (state.surface === "plot" && state.visualFitPending) {
    fitVisualToCanvas({ activity: false });
    state.visualFitPending = false;
  } else {
    applyVisualZoomToCanvas();
  }
  plotFacts.innerHTML = plot.facts
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
  plotData.innerHTML = renderPlotDataTable(plot);
  renderVisualRendererSource(plot.rendererSource);
  renderResearchMapNodeInspector(selectedMapSnapshot, plot);
  visualModeButtons.forEach((button) => {
    const activeMode = selectedVisualArtifact ? undefined : selectedMapSnapshot?.visualMode ?? state.visualMode;
    const active = button.dataset.visualMode === activeMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.disabled = Boolean(selectedVisualArtifact);
  });
  renderVisualArtifactHistory();
  renderResearchMapHistory();
}

function savedVisualArtifactBannerHtml(artifact) {
  const sourceCount = Array.isArray(artifact.sourceRefs) ? artifact.sourceRefs.length : 0;
  const renderer = artifact.renderer?.engine ?? artifact.renderer ?? "unknown renderer";
  const format = artifact.payload?.format ?? "unknown payload";
  const replay = artifact.replayCommand ?? "recorded visual artifact";
  const title = artifact.title ?? artifact.visualId ?? "Saved visual artifact";
  const renderedSummary = renderedVisualSummaryForSourceArtifact(artifact);
  const sourceSummary = sourceVisualSummaryForRenderedArtifact(artifact);
  return `<div>
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(artifact.kind ?? "visual")} - ${escapeHtml(renderer)} - ${escapeHtml(format)}</span>
  </div>
  <div class="visual-artifact-meta">
    <span>${escapeHtml(artifact.visualId ?? "unknown visual")}</span>
    <span>${sourceCount} source ref${sourceCount === 1 ? "" : "s"}</span>
    <span>${escapeHtml(artifact.privacy?.networkAccess ?? "network: none")}</span>
    ${renderedSummary?.visualId ? `<button class="text-button compact-button visual-artifact-link" data-open-rendered-visual-id="${escapeHtml(renderedSummary.visualId)}" type="button">Open rendered SVG</button>` : ""}
    ${sourceSummary?.visualId ? `<button class="text-button compact-button visual-artifact-link" data-open-source-visual-id="${escapeHtml(sourceSummary.visualId)}" type="button">Open source</button>` : ""}
    <code>${escapeHtml(replay)}</code>
  </div>`;
}

function selectedVisualRenderEngine(artifact) {
  if (!artifact || artifact.payload?.format === "svg") {
    return undefined;
  }

  if (artifact.payload?.format === "plotly-json" || savedVisualArtifactRendererSource(artifact)?.language === "plotly-json") {
    return "plotly";
  }

  return savedVisualArtifactRendererSource(artifact)?.language === "dot" ? "graphviz" : undefined;
}

function renderedVisualSummaryForSourceArtifact(artifact) {
  if (!artifact?.visualId || artifact.payload?.format === "svg") {
    return undefined;
  }

  const rendered = visualArtifacts
    .filter((summary) => isRenderedSvgVisualSummary(summary) && visualSummaryReferencesVisual(summary, artifact.visualId))
    .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")));

  return rendered[0];
}

function sourceVisualSummaryForRenderedArtifact(artifact) {
  if (!artifact?.visualId || artifact.payload?.format !== "svg") {
    return undefined;
  }

  const visualRef = (artifact.sourceRefs ?? []).find((ref) => ref?.kind === "visual" && typeof ref.ref === "string");
  if (!visualRef) {
    return undefined;
  }

  return visualArtifacts.find((summary) => visualRefMatchesSummary(visualRef.ref, summary));
}

function isRenderedSvgVisualSummary(summary) {
  const tags = new Set((summary?.tags ?? []).map((tag) => String(tag).toLowerCase()));
  return tags.has("rendered") && tags.has("svg");
}

function visualSummaryReferencesVisual(summary, visualId) {
  return (summary?.sourceRefs ?? []).some((ref) => ref?.kind === "visual" && visualRefMentionsVisualId(ref.ref, visualId));
}

function visualRefMatchesSummary(ref, summary) {
  return Boolean(summary?.visualId)
    && (visualRefMentionsVisualId(ref, summary.visualId) || String(ref ?? "") === summary.path);
}

function visualRefMentionsVisualId(ref, visualId) {
  const value = String(ref ?? "");
  return value === visualId || value.includes(visualId);
}

function reportFigureArtifactForReceipt(receipt) {
  const selected = selectedVisualArtifactRecord?.visualId === state.selectedVisualArtifactId
    ? selectedVisualArtifactRecord
    : undefined;
  if (selected && visualArtifactMatchesReceipt(selected, receipt)) {
    return selected;
  }

  const candidates = visualArtifacts
    .filter((artifact) => visualArtifactMatchesReceipt(artifact, receipt))
    .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")));
  return candidates.find((artifact) => isRenderedSvgVisualSummary(artifact)) ?? candidates[0];
}

function visualArtifactMatchesReceipt(artifact, receipt) {
  const refs = artifact?.sourceRefs ?? [];
  const promptRef = `prompt:${receipt.title}`;
  return refs.some((ref) => {
    if (!ref?.ref) {
      return false;
    }
    return evidenceRefMatchesReceipt(ref, receipt)
      || String(ref.ref) === promptRef
      || String(ref.ref).includes(receipt.runId);
  });
}

function reportFigureCitationHtml(figure) {
  if (!figure) {
    return `<section class="report-figure-citation">
      <h4>Saved Figure Artifact</h4>
      <p>No saved figure artifact is attached to this receipt yet. Use <strong>Make figure</strong> in Visuals to write a Plotly source artifact and linked SVG figure before exporting the report.</p>
    </section>`;
  }

  const renderer = figure.renderer?.engine ?? figure.renderer ?? "unknown";
  const replay = figure.replayCommand ?? `truth-harness visual show ${figure.visualId}`;
  const path = figure.path ?? "selected visual artifact";
  const sourceRefs = figure.sourceRefs ?? [];
  const sourceItems = sourceRefs.length > 0
    ? sourceRefs.map((ref) => `<li><code>${escapeHtml(ref.kind)}:${escapeHtml(ref.ref)}</code>${ref.label ? ` - ${escapeHtml(ref.label)}` : ""}</li>`).join("")
    : "<li>No source refs recorded.</li>";
  const boundary = figure.warnings?.[0] ?? "Visual artifacts are evidence views and do not upgrade source trust labels.";
  return `<section class="report-figure-citation">
    <h4>Saved Figure Artifact</h4>
    <dl class="report-facts">
      <div><dt>Figure</dt><dd><code>${escapeHtml(figure.visualId)}</code></dd></div>
      <div><dt>Title</dt><dd>${escapeHtml(figure.title ?? figure.visualId)}</dd></div>
      <div><dt>Kind</dt><dd>${escapeHtml(figure.kind ?? "visual")}</dd></div>
      <div><dt>Renderer</dt><dd>${escapeHtml(renderer)}</dd></div>
      <div><dt>Path</dt><dd><code>${escapeHtml(path)}</code></dd></div>
      <div><dt>Replay</dt><dd><code>${escapeHtml(replay)}</code></dd></div>
    </dl>
    <h5>Figure Source Refs</h5>
    <ul class="report-sublist">${sourceItems}</ul>
    <p>${escapeHtml(boundary)}</p>
  </section>`;
}

function reportFigureCitationMarkdown(figure) {
  if (!figure) {
    return [
      "- Saved figure artifact: not recorded",
      "- Figure action: Use `Make figure` in the Visuals tab to write a Plotly source artifact and linked SVG figure before exporting."
    ];
  }

  const renderer = figure.renderer?.engine ?? figure.renderer ?? "unknown";
  const replay = figure.replayCommand ?? `truth-harness visual show ${figure.visualId}`;
  const path = figure.path ?? "selected visual artifact";
  const boundary = figure.warnings?.[0] ?? "Visual artifacts are evidence views and do not upgrade source trust labels.";
  const refs = figure.sourceRefs?.length
    ? figure.sourceRefs.map((ref) => `  - \`${ref.kind}:${ref.ref}\`${ref.label ? ` - ${ref.label}` : ""}`)
    : ["  - none recorded"];
  return [
    `- Saved figure artifact: \`${figure.visualId}\``,
    `- Figure title: ${figure.title ?? figure.visualId}`,
    `- Figure kind: ${figure.kind ?? "visual"}`,
    `- Figure renderer: ${renderer}`,
    `- Figure path: \`${path}\``,
    `- Figure replay: \`${replay}\``,
    `- Figure trust boundary: ${boundary}`,
    "- Figure source refs:",
    ...refs
  ];
}

function visualZoomPercent() {
  return `${Math.round(state.visualZoom * 100)}%`;
}

function clampVisualZoom(value) {
  return Math.min(VISUAL_ZOOM_MAX, Math.max(VISUAL_ZOOM_MIN, Number(value) || 1));
}

function requestVisualFit() {
  state.visualFitPending = true;
}

function applyVisualZoomToCanvas(options = {}) {
  if (!plotCanvas) {
    return;
  }

  const svg = plotCanvas.querySelector("svg");
  if (!svg) {
    return;
  }

  const viewBox = svg.getAttribute("viewBox")?.split(/\s+/u).map(Number) ?? [];
  const baseWidth = Number.isFinite(viewBox[2]) && viewBox[2] > 0 ? viewBox[2] : 980;
  const baseHeight = Number.isFinite(viewBox[3]) && viewBox[3] > 0 ? viewBox[3] : 520;
  const zoom = clampVisualZoom(state.visualZoom);
  const width = Math.round(baseWidth * zoom);
  const height = Math.round(baseHeight * zoom);
  state.visualZoom = zoom;
  svg.style.width = `${width}px`;
  svg.style.minWidth = `${width}px`;
  svg.style.height = `${height}px`;
  svg.style.minHeight = `${height}px`;
  plotCanvas.dataset.visualZoom = visualZoomPercent();

  if (visualZoomResetButton) {
    visualZoomResetButton.textContent = visualZoomPercent();
    visualZoomResetButton.title = "Reset zoom to 100%";
  }

  if (visualZoomOutButton) {
    visualZoomOutButton.disabled = zoom <= VISUAL_ZOOM_MIN + 0.001;
  }

  if (visualZoomInButton) {
    visualZoomInButton.disabled = zoom >= VISUAL_ZOOM_MAX - 0.001;
  }

  if (options.center) {
    centerVisualCanvas();
  }
}

function setVisualZoom(nextZoom, options = {}) {
  const previousZoom = state.visualZoom;
  const canvasRect = plotCanvas.getBoundingClientRect();
  const anchor = options.anchor
    ? {
        x: Math.max(0, Math.min(plotCanvas.clientWidth, options.anchor.clientX - canvasRect.left)),
        y: Math.max(0, Math.min(plotCanvas.clientHeight, options.anchor.clientY - canvasRect.top))
      }
    : undefined;
  const previousScroll = {
    left: plotCanvas.scrollLeft,
    top: plotCanvas.scrollTop,
    width: Math.max(1, plotCanvas.scrollWidth),
    height: Math.max(1, plotCanvas.scrollHeight)
  };
  const anchorRatio = anchor
    ? {
        x: (previousScroll.left + anchor.x) / previousScroll.width,
        y: (previousScroll.top + anchor.y) / previousScroll.height
      }
    : undefined;
  state.visualZoom = clampVisualZoom(nextZoom);
  applyVisualZoomToCanvas();

  if (options.center) {
    centerVisualCanvas();
    return;
  }

  const leftRatio = anchorRatio?.x ?? (previousScroll.left + plotCanvas.clientWidth / 2) / previousScroll.width;
  const topRatio = anchorRatio?.y ?? (previousScroll.top + plotCanvas.clientHeight / 2) / previousScroll.height;
  const targetX = anchor?.x ?? plotCanvas.clientWidth / 2;
  const targetY = anchor?.y ?? plotCanvas.clientHeight / 2;
  plotCanvas.scrollLeft = Math.max(0, leftRatio * plotCanvas.scrollWidth - targetX);
  plotCanvas.scrollTop = Math.max(0, topRatio * plotCanvas.scrollHeight - targetY);

  if (Math.abs(previousZoom - state.visualZoom) > 0.001 && options.activity) {
    addActivity("human", "Adjusted visual zoom", `Visual canvas zoom set to ${visualZoomPercent()}.`, "passed");
  }
}

function normalizedVisualWheelDelta(event) {
  const modeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? plotCanvas.clientHeight : 1;
  return Math.max(
    -VISUAL_WHEEL_DELTA_MAX,
    Math.min(VISUAL_WHEEL_DELTA_MAX, event.deltaY * modeMultiplier)
  );
}

function queueVisualWheelZoom(event) {
  const delta = normalizedVisualWheelDelta(event);
  const nextZoom = clampVisualZoom(state.visualZoom * Math.exp(-delta * VISUAL_WHEEL_ZOOM_SENSITIVITY));
  pendingVisualWheelZoom = {
    zoom: nextZoom,
    anchor: {
      clientX: event.clientX,
      clientY: event.clientY
    }
  };

  if (pendingVisualWheelFrame) {
    return;
  }

  pendingVisualWheelFrame = requestAnimationFrame(() => {
    pendingVisualWheelFrame = undefined;
    if (!pendingVisualWheelZoom) {
      return;
    }

    const { zoom, anchor } = pendingVisualWheelZoom;
    pendingVisualWheelZoom = undefined;
    setVisualZoom(zoom, { anchor });
  });
}

function fitVisualToCanvas(options = {}) {
  const svg = plotCanvas.querySelector("svg");
  if (!svg) {
    return;
  }

  const viewBox = svg.getAttribute("viewBox")?.split(/\s+/u).map(Number) ?? [];
  const baseWidth = Number.isFinite(viewBox[2]) && viewBox[2] > 0 ? viewBox[2] : 980;
  const baseHeight = Number.isFinite(viewBox[3]) && viewBox[3] > 0 ? viewBox[3] : 520;
  const targetWidth = Math.max(360, plotCanvas.clientWidth - 44);
  const targetHeight = Math.max(320, plotCanvas.clientHeight - 44);
  const nextZoom = Math.min(targetWidth / baseWidth, targetHeight / baseHeight);
  setVisualZoom(nextZoom, { center: true, activity: options.activity ?? true });
}

function centerVisualCanvas() {
  plotCanvas.scrollLeft = Math.max(0, (plotCanvas.scrollWidth - plotCanvas.clientWidth) / 2);
  plotCanvas.scrollTop = Math.max(0, (plotCanvas.scrollHeight - plotCanvas.clientHeight) / 2);
}

function createVisualModel(receipt, mode) {
  const basePlot = createPlotModel(receipt);
  if (mode === "fraction-bars") {
    return createFractionBarsVisualModel(receipt, basePlot);
  }

  if (mode === "equation-map") {
    return createEquationMapVisualModel(receipt, basePlot);
  }

  if (mode === "step-flow") {
    return createStepFlowVisualModel(receipt, basePlot);
  }

  if (mode === "evidence-counts") {
    return createEvidenceCountsVisualModel(receipt, basePlot);
  }

  if (mode === "mind-map") {
    return createResearchMindMapVisualModel(receipt, basePlot);
  }

  if (mode === "concept-map") {
    return createConceptMapVisualModel(receipt, basePlot);
  }

  if (mode === "trust-ladder") {
    return createTrustLadderVisualModel(receipt, basePlot);
  }

  if (mode === "bubble-map") {
    return createBubbleMapVisualModel(receipt, basePlot);
  }

  return basePlot;
}

function createPlotModel(receipt) {
  if (/dimension|force|acceleration|M L T/u.test(`${receipt.title} ${receipt.engine} ${receipt.output}`)) {
    return createDimensionPlotModel(receipt);
  }

  if (/n\^2\+n/u.test(`${receipt.title} ${receipt.math?.input ?? ""}`)) {
    return createDiscretePolynomialPlotModel(receipt);
  }

  const fractions = parseFractionsFromText(`${receipt.title} ${receipt.output} ${receipt.math?.input ?? ""} ${receipt.math?.output ?? ""}`);
  const outputFraction = parseFraction(receipt.output) ?? parseFractionsFromText(receipt.math?.output ?? "").at(-1);
  if (fractions.length > 0 || outputFraction) {
    return createNumberLinePlotModel(receipt, fractions, outputFraction);
  }

  return createFallbackPlotModel(receipt);
}

function createNumberLinePlotModel(receipt, fractions, outputFraction) {
  const uniqueFractions = uniqueFractionsByLabel([
    ...fractions.slice(0, 4),
    ...(outputFraction ? [outputFraction] : [])
  ]);
  const values = uniqueFractions.map(fractionValue);
  const maxValue = Math.max(1, ...values, outputFraction ? fractionValue(outputFraction) : 0);
  const axisMax = Math.ceil(maxValue + 0.35);
  const denominator = Math.min(24, lcmMany(uniqueFractions.map((item) => item.denominator).filter(Boolean)) || 8);
  const width = 980;
  const height = 420;
  const left = 72;
  const right = 58;
  const y = 238;
  const axisWidth = width - left - right;
  const xFor = (value) => left + (value / axisMax) * axisWidth;
  const ticks = [];
  for (let index = 0; index <= axisMax * denominator; index += 1) {
    const value = index / denominator;
    const x = xFor(value);
    const major = Number.isInteger(value);
    ticks.push(`<g>
      <line x1="${x}" y1="${major ? y - 13 : y - 7}" x2="${x}" y2="${major ? y + 13 : y + 7}" stroke="${major ? "#6f6960" : "#343230"}" />
      ${major ? `<text x="${x}" y="${y + 38}" text-anchor="middle" fill="#aaa59d" font-size="13">${value}</text>` : ""}
    </g>`);
  }

  const markerRows = uniqueFractions.map((fraction, index) => {
    const value = fractionValue(fraction);
    const x = xFor(value);
    const isOutput = outputFraction && fractionLabel(fraction) === fractionLabel(outputFraction);
    const markerY = y - 76 - (index % 2) * 42;
    const color = isOutput ? "#7dd3a8" : "#b7a98a";
    return `<g>
      <line x1="${x}" y1="${markerY + 10}" x2="${x}" y2="${y - 15}" stroke="${color}" stroke-width="2" stroke-dasharray="${isOutput ? "0" : "4 5"}" />
      <circle cx="${x}" cy="${y}" r="${isOutput ? 7 : 5}" fill="${color}" />
      <rect x="${x - 42}" y="${markerY - 10}" width="84" height="24" rx="6" fill="#171717" stroke="${color}" opacity="0.96" />
      <text x="${x}" y="${markerY + 7}" text-anchor="middle" fill="#f2f2ee" font-size="13" font-weight="700">${escapeXml(fractionLabel(fraction))}</text>
    </g>`;
  });
  const dataRows = uniqueFractions.map((fraction) => {
    const label = fractionLabel(fraction);
    const isOutput = outputFraction && label === fractionLabel(outputFraction);
    return [isOutput ? "verified-output" : "plotted-fraction", label, String(fraction.numerator), String(fraction.denominator), fractionValue(fraction).toFixed(6)];
  });

  return {
    kind: "number line",
    title: "Exact Rational Number Line",
    caption: "Fractions are plotted from the receipt text and verified output; the result marker is highlighted.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Exact rational number line">
      <rect width="${width}" height="${height}" rx="14" fill="#101010" />
      <text x="${left}" y="58" fill="#f2f2ee" font-size="22" font-weight="750">${escapeXml(receipt.title)}</text>
      <text x="${left}" y="88" fill="#aaa59d" font-size="14">verified output: ${escapeXml(receipt.output)}</text>
      <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#6f6960" stroke-width="2" />
      ${ticks.join("")}
      ${markerRows.join("")}
    </svg>`,
    facts: [
      ["Engine", receipt.engine],
      ["Trust", receipt.trust],
      ["Output", receipt.output],
      ["Ticks", `1/${denominator} subdivisions`]
    ],
    dataColumns: ["role", "exact", "numerator", "denominator", "decimal"],
    dataRows
  };
}

function createFractionBarsVisualModel(receipt, basePlot) {
  const explicitOutputFraction = parseFraction(receipt.output);
  const fractions = uniqueFractionsByLabel([
    ...parseFractionsFromText(`${receipt.title} ${receipt.output} ${receipt.math?.input ?? ""} ${receipt.math?.output ?? ""}`),
    ...(explicitOutputFraction ? [explicitOutputFraction] : [])
  ]).slice(0, 5);

  if (fractions.length === 0) {
    return {
      ...basePlot,
      kind: "fraction bars unavailable",
      title: "Fraction Bars Need Rational Data",
      caption: "This view appears when a receipt exposes exact rational values. Use another visual mode for this claim.",
      facts: [
        ["Mode", "fraction bars"],
        ["Source visual", basePlot.kind],
        ["Trust", receipt.trust],
        ["Next", "attach rational values"]
      ]
    };
  }

  const width = 1240;
  const rowHeight = 92;
  const top = 166;
  const left = 118;
  const right = 190;
  const barHeight = 34;
  const barWidth = width - left - right;
  const height = Math.max(540, top + fractions.length * rowHeight + 92);
  const maxValue = Math.max(1, ...fractions.map(fractionValue));
  const axisMax = Math.ceil(maxValue);
  const outputLabel = fractionLabel(explicitOutputFraction ?? fractions[fractions.length - 1]);
  const rows = fractions.map((fraction, index) => {
    const value = fractionValue(fraction);
    const y = top + index * rowHeight;
    const fillWidth = Math.max(6, (value / axisMax) * barWidth);
    const label = fractionLabel(fraction);
    const isOutput = label === outputLabel;
    const fill = isOutput ? "#7dd3a8" : "#b7a98a";
    const backgroundTicks = Array.from({ length: axisMax + 1 }, (_item, tick) => {
      const x = left + (tick / axisMax) * barWidth;
      return `<g>
        <line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + barHeight + 8}" stroke="#343230" />
        <text x="${x}" y="${y + barHeight + 34}" text-anchor="middle" fill="#77716a" font-size="12">${tick}</text>
      </g>`;
    }).join("");

    return `<g>
      ${backgroundTicks}
      <rect x="${left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="9" fill="#171717" stroke="#2f2f2e" />
      <rect x="${left}" y="${y}" width="${fillWidth}" height="${barHeight}" rx="9" fill="${fill}" opacity="0.78" />
      <text x="${left - 24}" y="${y + 23}" text-anchor="end" fill="#f2f2ee" font-size="17" font-weight="750">${escapeXml(label)}</text>
      <text x="${left + fillWidth + 18}" y="${y + 23}" fill="${fill}" font-size="14" font-weight="750">${value.toFixed(3).replace(/0+$/u, "").replace(/\.$/u, "")}</text>
      ${isOutput ? `<text x="${left + barWidth + 28}" y="${y + 23}" fill="#7dd3a8" font-size="13" font-weight="750">verified output</text>` : ""}
    </g>`;
  }).join("");

  return {
    kind: "fraction bars",
    title: "Exact Fraction Bars",
    caption: "Each bar is scaled from the exact rational value recorded by the receipt; the verified output is highlighted.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Exact fraction bar comparison">
      <rect width="${width}" height="${height}" rx="16" fill="#101010" />
      <text x="72" y="62" fill="#f2f2ee" font-size="28" font-weight="750">${escapeXml(receipt.title)}</text>
      <text x="72" y="96" fill="#aaa59d" font-size="15">concrete proportion view for arithmetic intuition and checking</text>
      <text x="${left}" y="${top - 34}" fill="#aaa59d" font-size="13">0 to ${axisMax} exact units</text>
      ${rows}
    </svg>`,
    facts: [
      ["Mode", "fraction bars"],
      ["Fractions", String(fractions.length)],
      ["Output", outputLabel],
      ["Trust", receipt.trust]
    ],
    dataColumns: ["role", "exact", "numerator", "denominator", "decimal"],
    dataRows: fractions.map((fraction) => {
      const label = fractionLabel(fraction);
      return [
        label === outputLabel ? "verified-output" : "receipt-rational",
        label,
        String(fraction.numerator),
        String(fraction.denominator),
        fractionValue(fraction).toFixed(6)
      ];
    })
  };
}

function createEquationMapVisualModel(receipt, basePlot) {
  const inputFractions = uniqueFractionsByLabel(parseFractionsFromText(`${receipt.title} ${receipt.math?.input ?? ""}`)).slice(0, 4);
  const outputFraction = parseFraction(receipt.output) ?? parseFractionsFromText(receipt.math?.output ?? "").at(-1);
  const width = 1080;
  const height = 680;

  if (inputFractions.length >= 2 && outputFraction) {
    const denominator = lcmMany(inputFractions.map((fraction) => fraction.denominator).filter(Boolean));
    const rewritten = inputFractions.map((fraction) => ({
      original: fraction,
      numerator: fraction.numerator * (denominator / fraction.denominator),
      denominator
    }));
    const modules = [
      { id: "problem", label: "Problem", detail: receipt.title, x: 42, y: 292, width: 190, height: 92, tone: "accent" },
      ...inputFractions.slice(0, 2).map((fraction, index) => ({
        id: `term-${index + 1}`,
        label: `Term ${index + 1}`,
        detail: fractionLabel(fraction),
        x: 284,
        y: index === 0 ? 182 : 406,
        width: 170,
        height: 86,
        tone: "muted"
      })),
      { id: "common-denominator", label: "Shared module", detail: `common denominator ${denominator}`, x: 510, y: 292, width: 220, height: 92, tone: "warn" },
      { id: "rewrite", label: "Rewrite", detail: rewritten.map((item) => `${fractionLabel(item.original)}=${item.numerator}/${item.denominator}`).join("; "), x: 780, y: 292, width: 210, height: 92, tone: "muted" },
      { id: "verified-result", label: "Verified result", detail: fractionLabel(outputFraction), x: 436, y: 540, width: 230, height: 86, tone: "good" }
    ];
    const edges = [
      [232, 338, 284, 225],
      [232, 338, 284, 449],
      [454, 225, 510, 338],
      [454, 449, 510, 338],
      [730, 338, 780, 338],
      [885, 384, 551, 540],
      [620, 384, 551, 540]
    ];

    return {
      kind: "equation map",
      title: "Modular Equation Map",
      caption: "The arithmetic is shown as linked modules so longer equations can become reusable, reviewable subclaims.",
      svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Modular equation map">
        <rect width="${width}" height="${height}" rx="16" fill="#101010" />
        <text x="42" y="44" fill="#f2f2ee" font-size="22" font-weight="750">${escapeXml(receipt.title)}</text>
        <text x="42" y="76" fill="#aaa59d" font-size="13">modules can be linked to receipts, project threads, and reusable lemmas</text>
        ${edges.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#343230" stroke-width="2" />`).join("")}
        ${modules.map((node) => conceptNodeSvg(node, { interactive: true, active: isActiveVisualMapNode(node, modules) })).join("")}
      </svg>`,
      facts: [
        ["Mode", "equation map"],
        ["Modules", String(modules.length)],
        ["Reusable denominator", String(denominator)],
        ["Trust", receipt.trust]
      ],
      dataColumns: ["module", "value", "source"],
      dataRows: [
        ["problem", receipt.math?.input ?? receipt.title, "receipt.math.input"],
        ...inputFractions.map((fraction, index) => [`term-${index + 1}`, fractionLabel(fraction), "parsed input"]),
        ["common-denominator", String(denominator), "local lcm"],
        ["rewrite", rewritten.map((item) => `${fractionLabel(item.original)}=${item.numerator}/${item.denominator}`).join("; "), "derived module"],
        ["verified-result", fractionLabel(outputFraction), "receipt.output"]
      ],
      mapNodes: modules.map((node) => visualNodeForSnapshot(node, "equation-module")),
      mapEdges: [
        { from: "problem", to: "term-1", kind: "decomposes-to", label: "left term" },
        { from: "problem", to: "term-2", kind: "decomposes-to", label: "right term" },
        { from: "term-1", to: "common-denominator", kind: "feeds" },
        { from: "term-2", to: "common-denominator", kind: "feeds" },
        { from: "common-denominator", to: "rewrite", kind: "enables" },
        { from: "rewrite", to: "verified-result", kind: "produces" }
      ]
    };
  }

  const graphEntries = evidenceGraphEntries(receipt).slice(0, 5);
  const nodes = [
    { id: "claim", label: "Claim", detail: receipt.title, x: 58, y: 156, width: 230, height: 86, tone: "accent" },
    ...graphEntries.map(([kind, summary], index) => ({
      id: safeMapNodeId(kind, index),
      label: kind,
      detail: summary,
      x: 372 + (index % 3) * 210,
      y: index < 3 ? 88 : 254,
      width: 180,
      height: 78,
      tone: kind.includes("proof") || kind.includes("computation") ? "good" : "muted"
    }))
  ];
  const edges = nodes.slice(1).map((node) => [288, 199, node.x, node.y + node.height / 2]);

  return {
    kind: "equation map",
    title: "Claim Module Map",
    caption: "This receipt does not expose a fraction pipeline yet, so the map shows its current evidence modules.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Claim module map">
      <rect width="${width}" height="${height}" rx="16" fill="#101010" />
      <text x="42" y="44" fill="#f2f2ee" font-size="22" font-weight="750">${escapeXml(receipt.title)}</text>
      <text x="42" y="70" fill="#aaa59d" font-size="13">generic module graph generated from receipt evidence entries</text>
      ${edges.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#343230" stroke-width="2" />`).join("")}
      ${nodes.map((node) => conceptNodeSvg(node, { interactive: true, active: isActiveVisualMapNode(node, nodes) })).join("")}
    </svg>`,
    facts: [
      ["Mode", "equation map"],
      ["Modules", String(nodes.length)],
      ["Source visual", basePlot.kind],
      ["Trust", receipt.trust]
    ],
    dataColumns: ["module", "value", "source"],
    dataRows: nodes.map((node) => [node.label, node.detail, "receipt graph"]),
    mapNodes: nodes.map((node) => visualNodeForSnapshot(node, "claim-module")),
    mapEdges: nodes.slice(1).map((node) => ({ from: "claim", to: node.id, kind: "has-evidence" }))
  };
}

function createStepFlowVisualModel(receipt, basePlot) {
  const trace = receipt.traces[state.level] ?? receipt.traces.middle ?? [];
  const steps = trace.length > 0 ? trace.slice(0, 8) : [receipt.summary ?? basePlot.caption];
  const levelLabel = visualLevelLabel(state.level);
  const width = 920;
  const top = 96;
  const rowHeight = 76;
  const height = Math.max(360, top + steps.length * rowHeight + 50);
  const cardWidth = 686;
  const cardX = 152;
  const flowSvg = steps.map((step, index) => {
    const y = top + index * rowHeight;
    const isLast = index === steps.length - 1;
    return `<g>
      <circle cx="74" cy="${y + 24}" r="15" fill="#24221e" stroke="#b7a98a" />
      <text x="74" y="${y + 29}" text-anchor="middle" fill="#f2f2ee" font-size="12" font-weight="800">${index + 1}</text>
      ${isLast ? "" : `<line x1="74" y1="${y + 42}" x2="74" y2="${y + rowHeight - 2}" stroke="#343230" stroke-width="2" />`}
      <rect x="${cardX}" y="${y}" width="${cardWidth}" height="50" rx="10" fill="#141414" stroke="${isLast ? "#7dd3a8" : "#30302f"}" />
      ${svgTextBlock(step, cardX + 18, y + 22, { maxChars: 84, maxLines: 2, lineHeight: 17, fontSize: 13, fontWeight: 650 })}
    </g>`;
  }).join("");

  return {
    kind: "step flow",
    title: "Audience-Level Step Flow",
    caption: "The selected explanation level is rendered as replayable steps, so students and reviewers can follow the exact route.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Step-by-step receipt flow">
      <rect width="${width}" height="${height}" rx="16" fill="#101010" />
      <text x="44" y="44" fill="#f2f2ee" font-size="22" font-weight="750">${escapeXml(receipt.title)}</text>
      <text x="44" y="72" fill="#aaa59d" font-size="13">${escapeXml(levelLabel)} explanation route generated from the receipt trace</text>
      ${flowSvg}
    </svg>`,
    facts: [
      ["Mode", "step flow"],
      ["Level", levelLabel],
      ["Steps shown", String(steps.length)],
      ["Trust", receipt.trust]
    ],
    dataColumns: ["step", "level", "text", "source"],
    dataRows: steps.map((step, index) => [String(index + 1), state.level, step, "receipt.traces"])
  };
}

function createEvidenceCountsVisualModel(receipt, basePlot) {
  const rows = verificationRows(receipt);
  const openGates = rows.filter((row) => ["missing", "waiting"].includes(row.status)).length;
  const passedGates = rows.filter((row) => row.status === "passed").length;
  const dependencies = receiptDependencies(receipt).length;
  const dependents = dependentReceiptKeys(receipt).length;
  const metrics = [
    { label: "Trace steps", value: (receipt.traces[state.level] ?? receipt.traces.middle ?? []).length, source: "receipt.traces", color: "#b7a98a" },
    { label: "Graph nodes", value: evidenceGraphEntries(receipt).length, source: "receipt.graph", color: "#8db4ff" },
    { label: "Tags", value: receiptTags(receipt).length, source: "receipt.tags", color: "#c9b27f" },
    { label: "Linked claims", value: dependencies + dependents, source: "claim dependencies", color: "#a78bfa" },
    { label: "Verified gates", value: passedGates, source: "verification rows", color: "#7dd3a8" },
    { label: "Open gates", value: openGates, source: "verification rows", color: "#e6c36a" },
    { label: "Limitations", value: receipt.limitations.length, source: "receipt.limitations", color: "#f28b82" },
    { label: "Visual rows", value: basePlot.dataRows?.length ?? 0, source: basePlot.kind, color: "#8f8a83" }
  ];
  const maxValue = Math.max(1, ...metrics.map((metric) => metric.value));
  const width = 1040;
  const height = 500;
  const barX = 260;
  const barWidth = 620;
  const rowTop = 104;
  const rowHeight = 42;
  const barSvg = metrics.map((metric, index) => {
    const y = rowTop + index * rowHeight;
    const fillWidth = Math.max(4, (metric.value / maxValue) * barWidth);
    return `<g>
      <text x="58" y="${y + 19}" fill="#f2f2ee" font-size="13" font-weight="700">${escapeXml(metric.label)}</text>
      <rect x="${barX}" y="${y}" width="${barWidth}" height="24" rx="7" fill="#171717" stroke="#2f2f2e" />
      <rect x="${barX}" y="${y}" width="${fillWidth}" height="24" rx="7" fill="${metric.color}" opacity="0.82" />
      <text x="${barX + fillWidth + 12}" y="${y + 18}" fill="${metric.color}" font-size="13" font-weight="800">${metric.value}</text>
      <text x="${barX + barWidth + 26}" y="${y + 18}" fill="#8f8a83" font-size="12">${escapeXml(metric.source)}</text>
    </g>`;
  }).join("");

  return {
    kind: "evidence counts",
    title: "Evidence Count Comparison",
    caption: "A quick dashboard of receipt volume, open gaps, verified gates, links, tags, and limitations.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evidence count comparison">
      <rect width="${width}" height="${height}" rx="16" fill="#101010" />
      <text x="42" y="44" fill="#f2f2ee" font-size="22" font-weight="750">${escapeXml(receipt.title)}</text>
      <text x="42" y="70" fill="#aaa59d" font-size="13">counts make long-running work scannable before reading every receipt</text>
      ${barSvg}
    </svg>`,
    facts: [
      ["Mode", "counts"],
      ["Verified gates", String(passedGates)],
      ["Open gates", String(openGates)],
      ["Linked claims", String(dependencies + dependents)]
    ],
    dataColumns: ["metric", "count", "source"],
    dataRows: metrics.map((metric) => [metric.label, String(metric.value), metric.source])
  };
}

function createTrustLadderVisualModel(receipt) {
  const allRows = verificationRows(receipt).filter((row) => row.status !== "skipped");
  const rows = allRows.length > 0 ? allRows.slice(0, 8) : [{
    id: "receipt",
    label: "Receipt envelope",
    command: receipt.replay,
    description: "No verification catalog rows were available for this receipt.",
    status: "waiting"
  }];
  const counts = rows.reduce((accumulator, row) => {
    accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const width = 920;
  const top = 96;
  const rowHeight = 70;
  const height = Math.max(380, top + rows.length * rowHeight + 56);
  const cardX = 142;
  const cardWidth = 692;
  const ladderSvg = rows.map((row, index) => {
    const y = top + index * rowHeight;
    const color = visualStatusColor(row.status);
    const isLast = index === rows.length - 1;
    return `<g>
      ${isLast ? "" : `<line x1="82" y1="${y + 34}" x2="82" y2="${y + rowHeight}" stroke="#30302f" stroke-width="3" />`}
      <circle cx="82" cy="${y + 28}" r="16" fill="#141414" stroke="${color}" stroke-width="2" />
      <text x="82" y="${y + 33}" text-anchor="middle" fill="${color}" font-size="12" font-weight="800">${index + 1}</text>
      <rect x="${cardX}" y="${y}" width="${cardWidth}" height="56" rx="10" fill="#141414" stroke="${color}" opacity="0.98" />
      <text x="${cardX + 18}" y="${y + 22}" fill="#f2f2ee" font-size="14" font-weight="750">${escapeXml(row.label)}</text>
      <text x="${cardX + cardWidth - 18}" y="${y + 22}" text-anchor="end" fill="${color}" font-size="12" font-weight="800">${escapeXml(statusLabel(row.status))}</text>
      ${svgTextBlock(row.command, cardX + 18, y + 43, { fill: "#aaa59d", maxChars: 72, maxLines: 1, lineHeight: 14, fontSize: 12, fontWeight: 600 })}
    </g>`;
  }).join("");

  return {
    kind: "trust ladder",
    title: "Verification Gate Ladder",
    caption: "Open and satisfied gates are shown as a review ladder so a claim cannot outrun its strongest verified evidence.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Verification gate ladder">
      <rect width="${width}" height="${height}" rx="16" fill="#101010" />
      <text x="44" y="44" fill="#f2f2ee" font-size="22" font-weight="750">${escapeXml(receipt.title)}</text>
      <text x="44" y="72" fill="#aaa59d" font-size="13">gate order is generated from the current route obligations and verification catalog</text>
      ${ladderSvg}
    </svg>`,
    facts: [
      ["Mode", "trust ladder"],
      ["Verified", String(counts.passed ?? 0)],
      ["Open", String((counts.waiting ?? 0) + (counts.missing ?? 0))],
      ["Trust", receipt.trust]
    ],
    dataColumns: ["gate", "status", "command", "description"],
    dataRows: rows.map((row) => [row.label, statusLabel(row.status), row.command, row.description ?? ""])
  };
}

function visualLevelLabel(level) {
  return {
    middle: "Middle school",
    high: "High school",
    college: "College",
    expert: "Expert"
  }[level] ?? String(level ?? "selected");
}

function visualModeLabel(mode) {
  return {
    "number-line": "number line",
    "fraction-bars": "fraction bars",
    "equation-map": "equation map",
    "step-flow": "step flow",
    "evidence-counts": "counts",
    "mind-map": "mind map",
    "concept-map": "concept map",
    "trust-ladder": "trust ladder",
    "bubble-map": "bubble map"
  }[mode] ?? String(mode ?? "visual mode");
}

function visualNodeForSnapshot(node, kind) {
  return {
    id: node.id ?? safeMapNodeId(node.label, 0),
    label: String(node.label ?? "Node"),
    detail: String(node.detail ?? ""),
    kind,
    sourceRef: String(node.sourceRef ?? ""),
    tone: String(node.tone ?? "muted")
  };
}

function safeMapNodeId(value, index) {
  const text = String(value ?? `node-${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return text || `node-${index}`;
}

function visualStatusColor(status) {
  if (status === "passed") {
    return "#7dd3a8";
  }

  if (status === "missing") {
    return "#f28b82";
  }

  if (status === "waiting") {
    return "#e6c36a";
  }

  return "#8f8a83";
}

function createDiscretePolynomialPlotModel(receipt) {
  const width = 760;
  const height = 320;
  const left = 58;
  const right = 30;
  const top = 42;
  const bottom = 54;
  const points = [];
  for (let n = -6; n <= 6; n += 1) {
    const y = receipt.title.includes("n^2+n+1") ? n * n + n + 1 : n * n + n;
    points.push({ n, y, even: y % 2 === 0 });
  }
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const xFor = (n) => left + ((n + 6) / 12) * (width - left - right);
  const yFor = (value) => top + ((maxY - value) / Math.max(1, maxY - minY)) * (height - top - bottom);
  const zeroY = yFor(0);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(point.n)} ${yFor(point.y)}`).join(" ");
  const pointSvg = points.map((point) => {
    const color = point.even ? "#7dd3a8" : "#f28b82";
    return `<g>
      <circle cx="${xFor(point.n)}" cy="${yFor(point.y)}" r="5" fill="${color}" />
      <text x="${xFor(point.n)}" y="${height - 24}" text-anchor="middle" fill="#aaa59d" font-size="12">${point.n}</text>
    </g>`;
  });

  return {
    kind: "discrete plot",
    title: "Integer Sample Plot",
    caption: "Integer samples are plotted locally; red points are odd and green points are even.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Discrete polynomial parity plot">
      <rect width="${width}" height="${height}" rx="14" fill="#101010" />
      <text x="${left}" y="28" fill="#f2f2ee" font-size="20" font-weight="750">${escapeXml(receipt.math?.input ?? receipt.title)}</text>
      <line x1="${left}" y1="${zeroY}" x2="${width - right}" y2="${zeroY}" stroke="#343230" />
      <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#6f6960" />
      <path d="${path}" fill="none" stroke="#b7a98a" stroke-width="2" />
      ${pointSvg.join("")}
      <text x="${left}" y="${height - 14}" fill="#aaa59d" font-size="12">n</text>
    </svg>`,
    facts: [
      ["Sample", "integers -6..6"],
      ["Red", "odd value"],
      ["Green", "even value"],
      ["Receipt output", receipt.output]
    ],
    dataColumns: ["n", "value", "parity"],
    dataRows: points.map((point) => [String(point.n), String(point.y), point.even ? "even" : "odd"])
  };
}

function createDimensionPlotModel(receipt) {
  return {
    kind: "dimension diagram",
    title: "Dimensional Balance",
    caption: "This is not a physical simulation; it visualizes that both sides reduce to the same base dimensions.",
    svg: `<svg viewBox="0 0 760 280" role="img" aria-label="Dimensional balance diagram">
      <rect width="760" height="280" rx="14" fill="#101010" />
      <text x="54" y="42" fill="#f2f2ee" font-size="20" font-weight="750">${escapeXml(receipt.title)}</text>
      <g transform="translate(72 92)">
        <rect width="250" height="92" rx="10" fill="#171717" stroke="#30302f" />
        <text x="24" y="34" fill="#aaa59d" font-size="13">Left side</text>
        <text x="24" y="68" fill="#f2f2ee" font-size="26" font-weight="750">M L T^-2</text>
      </g>
      <g transform="translate(438 92)">
        <rect width="250" height="92" rx="10" fill="#171717" stroke="#30302f" />
        <text x="24" y="34" fill="#aaa59d" font-size="13">Right side</text>
        <text x="24" y="68" fill="#f2f2ee" font-size="26" font-weight="750">M L T^-2</text>
      </g>
      <line x1="332" y1="138" x2="428" y2="138" stroke="#7dd3a8" stroke-width="3" />
      <text x="380" y="124" text-anchor="middle" fill="#7dd3a8" font-size="13" font-weight="700">match</text>
    </svg>`,
    facts: [
      ["Engine", receipt.engine],
      ["Trust", receipt.trust],
      ["Output", receipt.output],
      ["Boundary", "dimensions only"]
    ],
    dataColumns: ["side", "base-dimension-vector", "source"],
    dataRows: [
      ["left", "M L T^-2", "receipt output"],
      ["right", "M L T^-2", "dimension check"]
    ]
  };
}

function createFallbackPlotModel(receipt) {
  return {
    kind: "plot unavailable",
    title: "No Numeric Plot Yet",
    caption: "This receipt has lineage and verification data, but no recognized numeric or symbolic plot adapter yet.",
    svg: `<svg viewBox="0 0 760 260" role="img" aria-label="No plot available">
      <rect width="760" height="260" rx="14" fill="#101010" />
      <text x="54" y="60" fill="#f2f2ee" font-size="22" font-weight="750">No plot adapter for this receipt yet</text>
      <text x="54" y="96" fill="#aaa59d" font-size="14">Next: attach a CAS, chart, simulation, or domain-specific visualizer.</text>
      <rect x="54" y="128" width="652" height="58" rx="8" fill="#171717" stroke="#30302f" />
      <text x="76" y="162" fill="#f2f2ee" font-size="14">${escapeXml(receipt.title)}</text>
    </svg>`,
    facts: [
      ["Engine", receipt.engine],
      ["Trust", receipt.trust],
      ["Output", receipt.output],
      ["Next", "add plot adapter"]
    ],
    dataColumns: ["field", "value"],
    dataRows: [
      ["title", receipt.title],
      ["engine", receipt.engine],
      ["trust", receipt.trust],
      ["output", receipt.output]
    ]
  };
}

function createResearchMindMapVisualModel(receipt, basePlot) {
  const dependencyLabels = receiptDependencies(receipt).map((key) => linkedClaimLabel(key));
  const dependentLabels = dependentReceiptKeys(receipt).map((key) => linkedClaimLabel(key));
  const rows = verificationRows(receipt);
  const openGateLabels = rows.filter((row) => ["missing", "waiting"].includes(row.status)).slice(0, 2).map((row) => row.label);
  const passedGateCount = rows.filter((row) => row.status === "passed").length;
  const tags = receiptTags(receipt).slice(0, 4).map((tag) => `#${tag}`);
  const width = 1360;
  const height = 900;
  const center = { x: 520, y: 390, width: 320, height: 110 };
  const nodes = [
    { id: "project-thread", label: "Project thread", detail: "Truth Harness workspace", x: 88, y: 156, width: 320, height: 104, tone: "accent", maxLines: 2 },
    { id: "current-claim", label: "Current claim", detail: receipt.title, x: center.x, y: center.y, width: center.width, height: center.height, tone: receipt.trust === "refuted" ? "danger" : "good", maxLines: 3 },
    { id: "parent-receipts", label: "Parent receipts", detail: dependencyLabels.length > 0 ? dependencyLabels.join("; ") : "none linked yet", x: 88, y: 386, width: 340, height: 116, tone: dependencyLabels.length > 0 ? "muted" : "warn", maxLines: 3 },
    { id: "child-receipts", label: "Child receipts", detail: dependentLabels.length > 0 ? dependentLabels.join("; ") : "future branches can attach here", x: 88, y: 648, width: 340, height: 112, tone: dependentLabels.length > 0 ? "muted" : "warn", maxLines: 3 },
    { id: "verified-gates", label: "Verified gates", detail: `${passedGateCount} gates satisfied`, x: 980, y: 158, width: 300, height: 104, tone: "good", maxLines: 2 },
    { id: "open-obligations", label: "Open obligations", detail: openGateLabels.length > 0 ? openGateLabels.join("; ") : "no open gates shown", x: 970, y: 386, width: 330, height: 116, tone: openGateLabels.length > 0 ? "warn" : "good", maxLines: 3 },
    { id: "tags", label: "Tags", detail: tags.length > 0 ? tags.join(" ") : "untagged", x: 980, y: 648, width: 300, height: 112, tone: "muted", maxLines: 3 },
    { id: "report-packet", label: "Report packet", detail: "receipts, limits, replay, visuals", x: 520, y: 704, width: 320, height: 108, tone: "accent", maxLines: 3 }
  ];
  const centerPoint = [center.x + center.width / 2, center.y + center.height / 2];
  const linkedNodes = nodes
    .filter((node) => node.label !== "Current claim")
  const edges = linkedNodes.map((node) => [centerPoint[0], centerPoint[1], node.x + node.width / 2, node.y + node.height / 2]);
  const edgeSvg = edges.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#343230" stroke-width="2" />`).join("");

  return {
    kind: "mind map",
    title: "Research Mind Map",
    caption: "A project-scale map linking the current claim to receipts, open gates, tags, reports, and future branches.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Research mind map">
      <rect width="${width}" height="${height}" rx="16" fill="#101010" />
      <text x="54" y="50" fill="#f2f2ee" font-size="26" font-weight="750">${escapeXml(receipt.title)}</text>
      <text x="54" y="82" fill="#aaa59d" font-size="15">Designed for multi-day problems where equations, evidence, agents, notes, and reports need one map.</text>
      ${edgeSvg}
      ${nodes.map((node) => conceptNodeSvg(node, { interactive: true, active: isActiveVisualMapNode(node, nodes) })).join("")}
    </svg>`,
    facts: [
      ["Mode", "mind map"],
      ["Parent receipts", String(dependencyLabels.length)],
      ["Child receipts", String(dependentLabels.length)],
      ["Source visual", basePlot.kind]
    ],
    dataColumns: ["node", "value", "source"],
    dataRows: [
      ["project-thread", "Truth Harness workspace", "local project"],
      ["current-claim", receipt.title, "receipt.title"],
      ["parent-receipts", dependencyLabels.join("; ") || "none", "receipt.dependsOn"],
      ["child-receipts", dependentLabels.join("; ") || "none", "dependent receipts"],
      ["verified-gates", String(passedGateCount), "verification rows"],
      ["open-obligations", openGateLabels.join("; ") || "none", "verification rows"],
      ["tags", tags.join(" ") || "untagged", "receipt.tags"],
      ["report-packet", "receipts, limits, replay, visuals", "export surface"]
    ],
    mapNodes: nodes.map((node) => visualNodeForSnapshot(node, "research-map-node")),
    mapEdges: linkedNodes.map((node) => ({
      from: "current-claim",
      to: node.id,
      kind: node.id.includes("receipt") ? "claim-link" : "context-link"
    }))
  };
}

function createConceptMapVisualModel(receipt, basePlot) {
  const width = 1120;
  const height = 760;
  const nodes = [
    {
      id: "problem",
      label: "Problem",
      detail: receipt.title,
      x: 440,
      y: 170,
      width: 260,
      height: 96,
      tone: "accent"
    },
    {
      id: "verifier",
      label: "Verifier",
      detail: receipt.engine,
      x: 78,
      y: 344,
      width: 270,
      height: 104,
      tone: "muted"
    },
    {
      id: "output",
      label: "Output",
      detail: receipt.output,
      x: 430,
      y: 354,
      width: 280,
      height: 98,
      tone: "good"
    },
    {
      id: "trust-label",
      label: "Trust label",
      detail: receipt.trust,
      x: 792,
      y: 344,
      width: 270,
      height: 104,
      tone: receipt.trust === "refuted" ? "danger" : "good"
    },
    {
      id: "evidence-path",
      label: "Evidence path",
      detail: `${receipt.graph.length} receipt steps, ${receiptTags(receipt).length} tags`,
      x: 248,
      y: 594,
      width: 280,
      height: 96,
      tone: "muted"
    },
    {
      id: "boundary",
      label: "Boundary",
      detail: receipt.limitations[0] ?? basePlot.caption,
      x: 612,
      y: 594,
      width: 300,
      height: 96,
      tone: "warn"
    }
  ];
  const edges = [
    [570, 266, 213, 344],
    [570, 266, 570, 354],
    [570, 266, 927, 344],
    [570, 452, 388, 594],
    [570, 452, 762, 594]
  ];
  const lineSvg = edges.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#343230" stroke-width="2" />`).join("");
  return {
    kind: "concept map",
    title: "Receipt Concept Map",
    caption: "The same receipt is shown as a claim, verifier, output, trust label, evidence path, and boundary map.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Receipt concept map">
      <rect width="${width}" height="${height}" rx="16" fill="#101010" />
      <text x="44" y="42" fill="#f2f2ee" font-size="21" font-weight="750">${escapeXml(receipt.title)}</text>
      <text x="44" y="68" fill="#aaa59d" font-size="13">auditable structure generated from the current receipt</text>
      ${lineSvg}
      ${nodes.map((node) => conceptNodeSvg(node, { interactive: true, active: isActiveVisualMapNode(node, nodes) })).join("")}
    </svg>`,
    facts: [
      ["Mode", "concept map"],
      ["Verifier", receipt.engine],
      ["Trust", receipt.trust],
      ["Boundary", receipt.limitations[0] ?? "receipt scoped"]
    ],
    dataColumns: ["node", "value", "source"],
    dataRows: [
      ["problem", receipt.title, "receipt.title"],
      ["verifier", receipt.engine, "receipt.engine"],
      ["output", receipt.output, "receipt.output"],
      ["trust", receipt.trust, "receipt.trust"],
      ["evidence-path", String(receipt.graph.length), "receipt.graph"],
      ["boundary", receipt.limitations[0] ?? basePlot.caption, "receipt.limitations"]
    ],
    mapNodes: nodes.map((node) => visualNodeForSnapshot(node, "concept-map-node")),
    mapEdges: [
      { from: "problem", to: "verifier", kind: "checked-by" },
      { from: "problem", to: "output", kind: "produces" },
      { from: "problem", to: "trust-label", kind: "assigned-trust" },
      { from: "output", to: "evidence-path", kind: "supported-by" },
      { from: "output", to: "boundary", kind: "bounded-by" }
    ]
  };
}

function isActiveVisualMapNode(node, nodes) {
  const selectedNodeId = state.selectedResearchMapNodeId;
  if (selectedNodeId) {
    return node.id === selectedNodeId;
  }

  return nodes[0]?.id === node.id;
}

function conceptNodeSvg(node, options = {}) {
  const tones = {
    accent: ["#171512", "#b7a98a", "#f2f2ee"],
    good: ["#102017", "#7dd3a8", "#f2f2ee"],
    warn: ["#211c10", "#e6c36a", "#f2f2ee"],
    danger: ["#241414", "#f28b82", "#f2f2ee"],
    muted: ["#141414", "#30302f", "#f2f2ee"]
  };
  const [fill, stroke, text] = tones[node.tone] ?? tones.muted;
  const interactiveAttributes = options.interactive
    ? ` class="visual-map-node${options.active ? " active" : ""}" data-map-node-id="${escapeXml(node.id)}" role="button" tabindex="0" aria-label="${escapeXml(`Inspect ${node.label}`)}"`
    : "";
  const activeRing = options.active
    ? `<rect x="-5" y="-5" width="${node.width + 10}" height="${node.height + 10}" rx="14" fill="none" stroke="#f1eadc" stroke-width="2" stroke-dasharray="5 4" />`
    : "";
  const detailFontSize = node.detailFontSize ?? 14;
  const detailLineHeight = node.detailLineHeight ?? 18;
  const detailMaxChars = node.maxChars ?? Math.max(18, Math.floor((node.width - 36) / 7.2));
  const detailMaxLines = node.maxLines ?? Math.max(2, Math.floor((node.height - 50) / detailLineHeight));
  return `<g${interactiveAttributes} transform="translate(${node.x} ${node.y})">
    ${activeRing}
    <rect width="${node.width}" height="${node.height}" rx="10" fill="${fill}" stroke="${stroke}" />
    <text x="18" y="29" fill="#aaa59d" font-size="13" font-weight="650">${escapeXml(node.label)}</text>
    ${svgTextBlock(node.detail, 18, 56, { fill: text, maxChars: detailMaxChars, maxLines: detailMaxLines, lineHeight: detailLineHeight, fontSize: detailFontSize, fontWeight: 750 })}
  </g>`;
}

function createBubbleMapVisualModel(receipt, basePlot) {
  const width = 920;
  const height = 440;
  const numericRows = normalizedPlotNumericRows(basePlot).slice(0, 8);
  const fallbackRows = [
    { role: "claim", label: receipt.title, value: 1, source: "receipt.title" },
    { role: "output", label: receipt.output, value: 1.25, source: "receipt.output" },
    { role: "trust", label: receipt.trust, value: 0.9, source: "receipt.trust" },
    { role: "trace", label: `${receipt.graph.length} steps`, value: Math.max(1, receipt.graph.length / 4), source: "receipt.graph" }
  ];
  const rows = numericRows.length > 0 ? numericRows : fallbackRows;
  const maxValue = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  const positions = [
    [224, 176],
    [458, 166],
    [696, 178],
    [320, 308],
    [584, 310],
    [150, 318],
    [770, 312],
    [458, 286]
  ];
  const bubbleSvg = rows.map((row, index) => {
    const [x, y] = positions[index % positions.length];
    const radius = 34 + Math.min(52, (Math.abs(row.value) / maxValue) * 52);
    const isOutput = /output|verified/u.test(row.role);
    const stroke = isOutput ? "#7dd3a8" : index % 2 === 0 ? "#b7a98a" : "#8db4ff";
    const fill = isOutput ? "#102017" : "#141414";
    return `<g>
      <circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2" opacity="0.97" />
      <text x="${x}" y="${y - 6}" text-anchor="middle" fill="#f2f2ee" font-size="16" font-weight="750">${escapeXml(truncateForImage(row.label, 18))}</text>
      <text x="${x}" y="${y + 17}" text-anchor="middle" fill="#aaa59d" font-size="12">${escapeXml(row.role)}</text>
    </g>`;
  }).join("");

  return {
    kind: "bubble map",
    title: "Quantity And Evidence Bubble Map",
    caption: "Quantities and receipt facets are shown as weighted bubbles; verified output is highlighted when present.",
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Quantity and evidence bubble map">
      <rect width="${width}" height="${height}" rx="16" fill="#101010" />
      <text x="44" y="42" fill="#f2f2ee" font-size="21" font-weight="750">${escapeXml(receipt.title)}</text>
      <text x="44" y="68" fill="#aaa59d" font-size="13">bubble size is generated from exact receipt data where numeric values exist</text>
      ${bubbleSvg}
    </svg>`,
    facts: [
      ["Mode", "bubble map"],
      ["Bubbles", String(rows.length)],
      ["Source visual", basePlot.kind],
      ["Trust", receipt.trust]
    ],
    dataColumns: ["bubble", "role", "value", "source"],
    dataRows: rows.map((row) => [row.label, row.role, String(row.value), row.source])
  };
}

function normalizedPlotNumericRows(plot) {
  const columns = plot.dataColumns ?? [];
  const decimalIndex = columns.indexOf("decimal");
  const exactIndex = columns.indexOf("exact");
  const roleIndex = columns.indexOf("role");
  const valueIndex = columns.indexOf("value");
  const labelIndex = exactIndex >= 0 ? exactIndex : valueIndex >= 0 ? valueIndex : 0;

  return (plot.dataRows ?? [])
    .map((row) => {
      const decimalValue = decimalIndex >= 0 ? Number(row[decimalIndex]) : NaN;
      const exactValue = exactIndex >= 0 ? fractionValue(parseFraction(row[exactIndex]) ?? { numerator: NaN, denominator: NaN }) : NaN;
      const value = Number.isFinite(decimalValue) ? decimalValue : exactValue;
      return {
        role: roleIndex >= 0 ? row[roleIndex] : "value",
        label: row[labelIndex] ?? row[0] ?? "value",
        value,
        source: plot.kind
      };
    })
    .filter((row) => Number.isFinite(row.value));
}

function svgTextBlock(value, x, y, options = {}) {
  const {
    fill = "#f2f2ee",
    maxChars = 34,
    maxLines = 2,
    lineHeight = 16,
    fontSize = 13,
    fontWeight = 650
  } = options;
  const safeMaxChars = Math.max(4, Math.floor(maxChars));
  const words = String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .flatMap((word) => splitSvgTextWord(word, safeMaxChars));
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > safeMaxChars && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });
  if (current) {
    lines.push(current);
  }
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && visibleLines.length > 0) {
    visibleLines[visibleLines.length - 1] = `${visibleLines[visibleLines.length - 1].slice(0, Math.max(0, safeMaxChars - 3))}...`;
  }

  return `<text fill="${fill}" font-size="${fontSize}" font-weight="${fontWeight}">
    ${visibleLines.map((line, index) => `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`).join("")}
  </text>`;
}

function splitSvgTextWord(word, maxChars) {
  if (word.length <= maxChars) {
    return [word];
  }

  const chunks = [];
  for (let index = 0; index < word.length; index += maxChars) {
    chunks.push(word.slice(index, index + maxChars));
  }
  return chunks;
}

function renderPlotDataTable(plot) {
  if (!plot.dataColumns?.length || !plot.dataRows?.length) {
    return `<div class="activity-empty">No visual data rows available.</div>`;
  }

  return `<section>
    <h5>Visual Data</h5>
    <div class="plot-data-table-wrap">
      <table class="plot-data-table">
        <thead>
          <tr>${plot.dataColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${plot.dataRows.map((row) => `<tr>${plot.dataColumns.map((_column, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderVisualRendererSource(rendererSource) {
  if (!visualRendererSourcePanel) {
    return;
  }

  if (!rendererSource?.content) {
    visualRendererSourcePanel.hidden = true;
    visualRendererSourcePanel.innerHTML = "";
    return;
  }

  const preview = rendererSource.content.length > 3000
    ? `${rendererSource.content.slice(0, 3000)}\n...`
    : rendererSource.content;
  visualRendererSourcePanel.hidden = false;
  visualRendererSourcePanel.innerHTML = `<div class="visual-renderer-source-header">
    <div>
      <h5>Renderer Source</h5>
      <span>${escapeHtml(rendererSource.language ?? "text")} - ${escapeHtml(rendererSource.contentHash ?? "hash not recorded")}</span>
    </div>
    <div class="activity-actions">
      <button class="text-button compact-button" data-visual-source-copy type="button">Copy source</button>
      <button class="text-button compact-button" data-visual-source-download type="button">Download source</button>
    </div>
  </div>
  <pre><code>${escapeHtml(preview)}</code></pre>`;
}

function formatPlotDataCsv(plot) {
  const rows = [
    plot.dataColumns,
    ...(plot.dataRows ?? [])
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function currentPlotModel() {
  if (selectedVisualArtifactRecord?.visualId === state.selectedVisualArtifactId) {
    return createSavedVisualArtifactModel(selectedVisualArtifactRecord);
  }

  const receipt = receiptStore.get(state.receiptKey);
  const savedSnapshot = selectedResearchMapSnapshot();
  if (savedSnapshot) {
    return createSavedResearchMapVisualModel(savedSnapshot);
  }

  return receipt ? createVisualModel(receipt, state.visualMode) : undefined;
}

function selectedResearchMapSnapshot() {
  if (!state.selectedResearchMapSnapshotId) {
    return undefined;
  }

  const snapshot = (researchMap.snapshots ?? []).find((item) => item.snapshotId === state.selectedResearchMapSnapshotId);
  if (!snapshot) {
    state.selectedResearchMapSnapshotId = undefined;
    state.selectedResearchMapNodeId = undefined;
    return undefined;
  }

  return snapshot;
}

function selectedResearchMapNode(snapshot = selectedResearchMapSnapshot()) {
  if (!snapshot) {
    state.selectedResearchMapNodeId = undefined;
    return undefined;
  }

  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
  if (nodes.length === 0) {
    state.selectedResearchMapNodeId = undefined;
    return undefined;
  }

  if (!state.selectedResearchMapNodeId) {
    return nodes[0];
  }

  const node = nodes.find((item) => item.id === state.selectedResearchMapNodeId);
  if (!node) {
    state.selectedResearchMapNodeId = undefined;
    return nodes[0];
  }

  return node;
}

function createLiveResearchMapSnapshot(plot) {
  const nodes = Array.isArray(plot?.mapNodes) ? plot.mapNodes : [];
  if (nodes.length === 0) {
    return undefined;
  }

  const receipt = receiptStore.get(state.receiptKey);
  const visualArtifactRef = plot.visualArtifactRef;
  return {
    schemaVersion: "truth-harness.research-map-snapshot.v0",
    snapshotId: visualArtifactRef?.visualId ? `visual-${visualArtifactRef.visualId}` : "live-visual-map",
    createdAt: receipt?.createdAt ?? new Date(0).toISOString(),
    visualMode: plot.sourceVisualMode ?? state.visualMode,
    kind: plot.kind ?? "visual map",
    title: plot.title ?? "Live Visual Map",
    caption: plot.caption ?? (visualArtifactRef ? "Saved local visual artifact opened for inspection." : "Live local visual map generated from the current receipt."),
    receiptRef: receipt
      ? {
        runId: receipt.runId,
        claimId: receipt.claimId,
        routeId: receipt.verifierRoute?.routeId,
        title: receipt.title,
        trust: receipt.trust
      }
      : {},
    facts: plot.facts ?? [],
    dataColumns: plot.dataColumns ?? [],
    dataRows: plot.dataRows ?? [],
    nodes,
    edges: Array.isArray(plot.mapEdges) ? plot.mapEdges : visualRowsAsMapEdges(nodes),
    tags: receipt ? receiptTags(receipt) : [],
    localOnly: true,
    networkAccess: "none",
    live: true,
    ...(visualArtifactRef ? { visualArtifactRef } : {})
  };
}

function createSavedResearchMapVisualModel(snapshot) {
  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
  const edges = Array.isArray(snapshot.edges) ? snapshot.edges : [];
  const selectedNode = selectedResearchMapNode(snapshot);
  const selectedNodeId = selectedNode?.id;
  const layoutNodes = layoutResearchMapNodes(nodes);
  const layoutById = new Map(layoutNodes.map((node) => [node.id, node]));
  const width = 1180;
  const height = Math.max(460, 190 + Math.ceil(Math.max(1, layoutNodes.length) / 3) * 148);
  const edgeSvg = edges
    .map((edge) => {
      const from = layoutById.get(edge.from);
      const to = layoutById.get(edge.to);
      if (!from || !to) {
        return "";
      }

      return `<g>
        <line x1="${from.x + from.width / 2}" y1="${from.y + from.height / 2}" x2="${to.x + to.width / 2}" y2="${to.y + to.height / 2}" stroke="#343230" stroke-width="2" />
        ${edge.label ? `<text x="${(from.x + to.x) / 2 + 72}" y="${(from.y + to.y) / 2 + 22}" fill="#8f8a83" font-size="11">${escapeXml(edge.label)}</text>` : ""}
      </g>`;
    })
    .join("");

  return {
    kind: `saved ${snapshot.kind ?? "map"}`,
    title: snapshot.title ?? "Saved Research Map",
    caption: `${snapshot.caption ?? "Saved local research map snapshot."} Snapshot ${snapshot.snapshotId ?? "unknown"} was loaded from .truth-harness/artifacts/research-map.json.`,
    svg: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Saved research map snapshot">
      <rect width="${width}" height="${height}" rx="16" fill="#101010" />
      <text x="44" y="44" fill="#f2f2ee" font-size="23" font-weight="750">${escapeXml(snapshot.title ?? "Saved Research Map")}</text>
      <text x="44" y="72" fill="#aaa59d" font-size="13">opened from local research-map artifact - ${escapeXml(snapshot.snapshotId ?? "snapshot")}</text>
      ${edgeSvg}
      ${layoutNodes.map((node) => conceptNodeSvg(node, { interactive: true, active: node.id === selectedNodeId })).join("")}
    </svg>`,
    facts: [
      ["Snapshot", snapshot.snapshotId ?? "unknown"],
      ["Saved", snapshot.createdAt ? formatActivityTime(snapshot.createdAt) : "unknown"],
      ["Nodes", String(nodes.length)],
      ["Edges", String(edges.length)],
      ["Source receipt", snapshot.receiptRef?.runId ?? "not recorded"],
      ["Network", snapshot.privacy?.networkAccess ?? snapshot.networkAccess ?? "none"]
    ],
    dataColumns: snapshot.dataColumns?.length ? snapshot.dataColumns : ["node", "value", "source"],
    dataRows: snapshot.dataRows?.length
      ? snapshot.dataRows
      : nodes.map((node) => [node.label ?? node.id, node.detail ?? "", node.sourceRef ?? node.kind ?? "saved map"]),
    mapNodes: nodes,
    mapEdges: edges,
    sourceVisualMode: snapshot.visualMode
  };
}

function createSavedVisualArtifactModel(artifact) {
  const payload = artifact.payload ?? {};
  const svg = renderSavedVisualArtifactSvg(artifact);
  const mapNodes = savedVisualArtifactMapNodes(artifact);
  const mapEdges = savedVisualArtifactMapEdges(artifact, mapNodes);
  const rendererSource = savedVisualArtifactRendererSource(artifact);
  const sourceRows = (artifact.sourceRefs ?? []).map((ref) => [
    `${ref.kind}:${ref.ref}`,
    ref.label ?? "source ref",
    "sourceRefs"
  ]);

  return {
    kind: `saved ${artifact.kind ?? "visual"}`,
    title: artifact.title ?? "Saved Visual Artifact",
    caption: `Saved visual artifact ${artifact.visualId ?? "unknown"} loaded from .truth-harness/visuals. Visuals are evidence views and do not upgrade source trust labels.`,
    svg,
    facts: [
      ["Visual", artifact.visualId ?? "unknown"],
      ["Kind", artifact.kind ?? "visual"],
      ["Renderer", artifact.renderer?.engine ?? "unknown"],
      ["Payload", payload.format ?? "unknown"],
      ["Renderer source", rendererSource?.language ?? "not recorded"],
      ["Sources", String((artifact.sourceRefs ?? []).length)],
      ["Network", artifact.privacy?.networkAccess ?? "none"]
    ],
    dataColumns: artifact.data?.columns?.length ? artifact.data.columns : ["field", "value", "source"],
    dataRows: artifact.data?.rows?.length
      ? artifact.data.rows
      : [
        ["title", artifact.title ?? "Saved Visual Artifact", "visual.title"],
        ["renderer", artifact.renderer?.engine ?? "unknown", "visual.renderer"],
        ["payload", payload.format ?? "unknown", "visual.payload"],
        ...sourceRows
    ],
    rendererSource,
    mapNodes,
    mapEdges,
    sourceVisualMode: artifact.kind === "plot" ? "number-line" : artifact.kind === "lineage-graph" ? "concept-map" : "mind-map",
    visualArtifactRef: {
      visualId: artifact.visualId,
      title: artifact.title,
      kind: artifact.kind,
      renderer: artifact.renderer?.engine,
      sourceRefs: artifact.sourceRefs ?? []
    }
  };
}

function savedVisualArtifactRendererSource(artifact) {
  const payload = artifact.payload ?? {};
  const explicit = payload.rendererSource;
  if (explicit && typeof explicit.content === "string") {
    return {
      language: explicit.language ?? sourceLanguageForPayload(payload, artifact),
      content: explicit.content,
      filename: explicit.filename ?? rendererSourceFilename(artifact, explicit.language),
      contentHash: explicit.contentHash ?? "hash not recorded"
    };
  }

  const content = payload.content;
  if (content && typeof content === "object" && typeof content.source === "string") {
    return {
      language: content.language ?? sourceLanguageForPayload(payload, artifact),
      content: content.source,
      filename: rendererSourceFilename(artifact, content.language),
      contentHash: "legacy source, hash not recorded"
    };
  }

  if (payload.format === "plotly-json" && content) {
    return {
      language: "plotly-json",
      content: JSON.stringify(content, null, 2),
      filename: rendererSourceFilename(artifact, "plotly-json"),
      contentHash: "legacy source, hash not recorded"
    };
  }

  if (payload.format === "canvas-json" && content) {
    return {
      language: "tldraw-json",
      content: JSON.stringify(content, null, 2),
      filename: rendererSourceFilename(artifact, "tldraw-json"),
      contentHash: "legacy source, hash not recorded"
    };
  }

  if (payload.format === "svg" && typeof content === "string") {
    return {
      language: "svg",
      content,
      filename: rendererSourceFilename(artifact, "svg"),
      contentHash: "legacy source, hash not recorded"
    };
  }

  return undefined;
}

function sourceLanguageForPayload(payload, artifact) {
  if (payload.format === "graph-json") {
    return artifact.renderer?.engine === "graphviz" ? "dot" : "mermaid";
  }
  if (payload.format === "plotly-json") {
    return "plotly-json";
  }
  if (payload.format === "canvas-json") {
    return "tldraw-json";
  }
  return payload.format ?? "text";
}

function rendererSourceFilename(artifact, language) {
  const base = String(artifact.visualId ?? artifact.kind ?? "visual").replace(/[^A-Za-z0-9_.-]/gu, "_");
  const extension = {
    mermaid: "mmd",
    dot: "dot",
    "plotly-json": "plotly.json",
    python: "py",
    "tldraw-json": "tldraw.json",
    svg: "svg",
    html: "html",
    text: "txt"
  }[language] ?? "txt";
  return `${base}.${extension}`;
}

function renderSavedVisualArtifactSvg(artifact) {
  const payload = artifact.payload ?? {};
  const content = payload.content;
  if (payload.format === "svg" && typeof content === "string" && isSafeLocalSvg(content)) {
    return content;
  }
  if (payload.format === "plotly-json") {
    return savedPlotlyVisualArtifactSvg(artifact);
  }
  if (payload.format === "graph-json") {
    return savedGraphVisualArtifactSvg(artifact);
  }
  if (payload.format === "canvas-json") {
    return savedCanvasVisualArtifactSvg(artifact);
  }

  return savedVisualArtifactPlaceholderSvg(artifact);
}

function isSafeLocalSvg(value) {
  const trimmed = value.trim();
  return trimmed.startsWith("<svg")
    && !/<script[\s>]/iu.test(trimmed)
    && !/\son[a-z]+\s*=/iu.test(trimmed)
    && !/javascript:/iu.test(trimmed);
}

function savedPlotlyVisualArtifactSvg(artifact) {
  const content = artifact.payload?.content ?? {};
  const series = Array.isArray(content.data) ? content.data[0] ?? {} : {};
  const labels = Array.isArray(series.y) ? series.y.map((value) => String(value)) : [];
  const values = Array.isArray(series.x) ? series.x.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : [];
  const texts = Array.isArray(series.text) ? series.text.map((value) => String(value)) : [];
  const colors = Array.isArray(series.marker?.color) ? series.marker.color.map((value) => String(value)) : [];
  const rows = values.map((value, index) => ({
    label: labels[index] ?? `value ${index + 1}`,
    value,
    text: texts[index] ?? String(value),
    color: colors[index] ?? (index === values.length - 1 ? "#7dd3a8" : "#b7a98a")
  }));
  if (rows.length === 0) {
    return savedVisualArtifactPlaceholderSvg(artifact);
  }

  const width = Math.max(980, Number(artifact.payload?.width) || 980);
  const rowHeight = 58;
  const top = 144;
  const left = 238;
  const right = 86;
  const bottom = 72;
  const height = Math.max(520, top + rows.length * rowHeight + bottom);
  const maxValue = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  const barWidth = width - left - right;
  const title = content.layout?.title?.text ?? content.layout?.title ?? artifact.title ?? "Saved Plot";
  const axisTitle = content.layout?.xaxis?.title?.text ?? content.layout?.xaxis?.title ?? "value";
  const bars = rows.map((row, index) => {
    const y = top + index * rowHeight;
    const fillWidth = Math.max(6, (Math.abs(row.value) / maxValue) * barWidth);
    const fill = safeSvgColor(row.color, index === values.length - 1 ? "#7dd3a8" : "#b7a98a");
    return `<g>
      <text x="${left - 18}" y="${y + 21}" text-anchor="end" fill="#dfd8cb" font-size="14" font-weight="720">${escapeXml(truncateForImage(row.label, 28))}</text>
      <rect x="${left}" y="${y}" width="${barWidth}" height="30" rx="8" fill="#151515" stroke="#2e2e2d" />
      <rect x="${left}" y="${y}" width="${fillWidth}" height="30" rx="8" fill="${fill}" opacity="0.78" />
      <text x="${Math.min(left + fillWidth + 14, width - right - 96)}" y="${y + 20}" fill="#f2f2ee" font-size="13" font-weight="750">${escapeXml(row.text)}</text>
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Saved Plotly visual artifact">
    <rect width="${width}" height="${height}" rx="16" fill="#101010" />
    <text x="64" y="58" fill="#f2f2ee" font-size="24" font-weight="780">${escapeXml(title)}</text>
    <text x="64" y="88" fill="#aaa59d" font-size="13">rendered locally from saved Plotly JSON; source receipt remains authoritative</text>
    <line x1="${left}" y1="${top - 20}" x2="${width - right}" y2="${top - 20}" stroke="#403d38" />
    ${bars}
    <text x="${left}" y="${height - 30}" fill="#aaa59d" font-size="13">${escapeXml(axisTitle)} - max ${maxValue.toFixed(3).replace(/0+$/u, "").replace(/\.$/u, "")}</text>
  </svg>`;
}

function savedGraphVisualArtifactSvg(artifact) {
  const graph = artifact.payload?.content?.graph ?? {};
  const nodes = savedVisualArtifactMapNodes(artifact).slice(0, 60);
  const edges = savedVisualArtifactMapEdges(artifact, nodes);
  if (nodes.length === 0) {
    return savedVisualArtifactPlaceholderSvg(artifact);
  }

  const layoutNodes = layoutArtifactGraphNodes(nodes, edges);
  const byId = new Map(layoutNodes.map((node) => [node.id, node]));
  const bounds = visualNodeBounds(layoutNodes);
  const width = Math.max(1080, bounds.maxX + 58);
  const height = Math.max(560, bounds.maxY + 72);
  const edgeSvg = edges.slice(0, 120).map((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) {
      return "";
    }
    const forward = to.x >= from.x;
    const x1 = forward ? from.x + from.width : from.x;
    const y1 = from.y + from.height / 2;
    const x2 = forward ? to.x : to.x + to.width;
    const y2 = to.y + to.height / 2;
    const tension = Math.max(54, Math.min(130, Math.abs(x2 - x1) * 0.42));
    const c1 = forward ? x1 + tension : x1 - tension;
    const c2 = forward ? x2 - tension : x2 + tension;
    return `<path d="M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}" fill="none" stroke="${artifactGraphEdgeColor(to)}" stroke-width="2" stroke-linecap="round" opacity="0.72" marker-end="url(#artifact-arrow)" />`;
  }).join("");
  const source = artifact.payload?.content?.source;
  const sourceLabel = typeof source === "string" ? `${source.split("\n")[0] ?? "graph source"} (${source.split("\n").length} lines)` : "graph source recorded";
  const truncated = Boolean(artifact.payload?.content?.truncated ?? graph.truncated);
  const columns = artifactGraphColumnLabels(layoutNodes);
  const metrics = [
    ["Nodes", String(nodes.length)],
    ["Edges", String(edges.length)],
    ["Renderer", artifact.renderer?.engine ?? "unknown"],
    ["Network", artifact.privacy?.networkAccess ?? "none"]
  ];

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Saved lineage graph visual artifact">
    <defs>
      <marker id="artifact-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#69655f" />
      </marker>
    </defs>
    <rect width="${width}" height="${height}" rx="16" fill="#101010" />
    <text x="46" y="44" fill="#f2f2ee" font-size="24" font-weight="780">${escapeXml(artifact.title ?? "Workspace Lineage Graph")}</text>
    <text x="46" y="72" fill="#aaa59d" font-size="13">${escapeXml(sourceLabel)}${truncated ? " - preview truncated" : ""}</text>
    ${metrics.map((metric, index) => artifactGraphMetricSvg(metric[0], metric[1], 46 + index * 142, 94)).join("")}
    ${columns}
    ${edgeSvg}
    ${layoutNodes.map((node) => conceptNodeSvg(node, { interactive: true, active: isActiveVisualMapNode(node, layoutNodes) })).join("")}
  </svg>`;
}

function savedCanvasVisualArtifactSvg(artifact) {
  const shapes = Array.isArray(artifact.payload?.content?.shapes) ? artifact.payload.content.shapes : [];
  const noteShapes = shapes.filter((shape) => shape?.type === "note");
  const connectorShapes = shapes.filter((shape) => shape?.type === "connector");
  if (noteShapes.length === 0) {
    return savedVisualArtifactPlaceholderSvg(artifact);
  }

  const bounds = noteShapes.reduce((accumulator, shape) => {
    const x = Number(shape.x) || 0;
    const y = Number(shape.y) || 0;
    const width = Number(shape.width) || 240;
    const height = Number(shape.height) || 110;
    return {
      minX: Math.min(accumulator.minX, x),
      minY: Math.min(accumulator.minY, y),
      maxX: Math.max(accumulator.maxX, x + width),
      maxY: Math.max(accumulator.maxY, y + height)
    };
  }, { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 });
  const pad = 72;
  const width = Math.max(1100, bounds.maxX - bounds.minX + pad * 2);
  const height = Math.max(620, bounds.maxY - bounds.minY + pad * 2 + 72);
  const offsetX = pad - bounds.minX;
  const offsetY = pad + 58 - bounds.minY;
  const noteById = new Map(noteShapes.map((shape) => [shape.id, shape]));
  const connectorSvg = connectorShapes.map((shape) => {
    const from = noteById.get(shape.from);
    const to = noteById.get(shape.to);
    if (!from || !to) {
      return "";
    }
    const x1 = (Number(from.x) || 0) + (Number(from.width) || 240) / 2 + offsetX;
    const y1 = (Number(from.y) || 0) + (Number(from.height) || 110) / 2 + offsetY;
    const x2 = (Number(to.x) || 0) + (Number(to.width) || 240) / 2 + offsetX;
    const y2 = (Number(to.y) || 0) + (Number(to.height) || 110) / 2 + offsetY;
    return `<g>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#34302b" stroke-width="2" />
      ${shape.props?.label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" fill="#8f8a83" font-size="10">${escapeXml(truncateForImage(shape.props.label, 24))}</text>` : ""}
    </g>`;
  }).join("");
  const nodes = noteShapes.map((shape, index) => canvasShapeToVisualNode(shape, index, offsetX, offsetY));

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Saved editable canvas visual artifact">
    <rect width="${width}" height="${height}" rx="16" fill="#101010" />
    <text x="48" y="48" fill="#f2f2ee" font-size="23" font-weight="780">${escapeXml(artifact.title ?? "Research Canvas")}</text>
    <text x="48" y="76" fill="#aaa59d" font-size="13">rendered from saved canvas-json; editable canvas source remains replayable</text>
    ${connectorSvg}
    ${nodes.map((node) => conceptNodeSvg(node, { interactive: true, active: isActiveVisualMapNode(node, nodes) })).join("")}
  </svg>`;
}

function savedVisualArtifactMapNodes(artifact) {
  const payload = artifact.payload ?? {};
  const content = payload.content ?? {};
  if (payload.format === "graph-json") {
    const graphNodes = Array.isArray(content.graph?.nodes) ? content.graph.nodes : [];
    return graphNodes.slice(0, 120).map((node, index) => ({
      id: safeMapNodeId(node.nodeId ?? node.id ?? node.path ?? `graph-${index}`, index + 1),
      label: node.label ?? node.path ?? node.nodeId ?? `Graph node ${index + 1}`,
      detail: [node.kind, node.trust, node.path].filter(Boolean).join(" | ") || "workspace graph node",
      kind: node.kind ?? "workspace-graph-node",
      sourceRef: node.path ?? node.nodeId ?? "",
      trust: node.trust ?? "",
      missing: Boolean(node.missing),
      valid: node.valid,
      tone: node.missing ? "danger" : node.valid === false ? "warn" : node.trust ? "good" : "muted"
    }));
  }
  if (payload.format === "canvas-json") {
    const shapes = Array.isArray(content.shapes) ? content.shapes : [];
    return shapes
      .filter((shape) => shape?.type === "note")
      .slice(0, 120)
      .map((shape, index) => canvasShapeToMapNode(shape, index));
  }

  return [];
}

function savedVisualArtifactMapEdges(artifact, nodes = savedVisualArtifactMapNodes(artifact)) {
  const payload = artifact.payload ?? {};
  const content = payload.content ?? {};
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (payload.format === "graph-json") {
    const graphEdges = Array.isArray(content.graph?.edges) ? content.graph.edges : [];
    return graphEdges.map((edge, index) => ({
      id: safeMapNodeId(edge.edgeId ?? `graph-edge-${index}`, index + 1),
      from: safeMapNodeId(edge.from ?? "", index + 1),
      to: safeMapNodeId(edge.to ?? "", index + 2),
      kind: edge.kind ?? "linked",
      label: edge.kind ?? "linked"
    })).filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  }
  if (payload.format === "canvas-json") {
    const shapes = Array.isArray(content.shapes) ? content.shapes : [];
    return shapes
      .filter((shape) => shape?.type === "connector")
      .map((shape, index) => ({
        id: safeMapNodeId(shape.id ?? `canvas-edge-${index}`, index + 1),
        from: safeMapNodeId(String(shape.from ?? "").replace(/^shape:/u, ""), index + 1),
        to: safeMapNodeId(String(shape.to ?? "").replace(/^shape:/u, ""), index + 2),
        kind: shape.props?.label ?? "canvas-link",
        label: shape.props?.label ?? "canvas-link"
      }))
      .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  }

  return [];
}

function canvasShapeToMapNode(shape, index) {
  const props = shape.props ?? {};
  return {
    id: safeMapNodeId(String(shape.id ?? `canvas-${index}`).replace(/^shape:/u, ""), index + 1),
    label: props.title ?? props.text ?? `Canvas note ${index + 1}`,
    detail: props.text ?? props.sourcePath ?? "canvas note",
    kind: "canvas-note",
    sourceRef: props.sourcePath ?? shape.id ?? "",
    tone: props.status === "missing" ? "danger" : props.status === "invalid" ? "warn" : props.trust ? "good" : "muted"
  };
}

function canvasShapeToVisualNode(shape, index, offsetX, offsetY) {
  const node = canvasShapeToMapNode(shape, index);
  return {
    ...node,
    x: (Number(shape.x) || 0) + offsetX,
    y: (Number(shape.y) || 0) + offsetY,
    width: Math.max(180, Number(shape.width) || 240),
    height: Math.max(92, Number(shape.height) || 110),
    maxLines: 3
  };
}

const ARTIFACT_GRAPH_COLUMNS = [
  ["workspace", "Workspace"],
  ["reasoning", "Routes & Claims"],
  ["evidence", "Receipts & Checks"],
  ["artifacts", "Artifacts"],
  ["gaps", "Gaps"]
];

function layoutArtifactGraphNodes(nodes, edges = []) {
  const grouped = new Map(ARTIFACT_GRAPH_COLUMNS.map(([key]) => [key, []]));
  nodes.forEach((node, index) => {
    const column = artifactGraphColumnKey(node);
    grouped.get(column)?.push({ ...node, originalIndex: index });
  });

  const activeColumns = ARTIFACT_GRAPH_COLUMNS.filter(([key]) => (grouped.get(key)?.length ?? 0) > 0);
  const columnGap = 34;
  const nodeWidth = 220;
  const nodeHeight = 88;
  const rowGap = 28;
  const left = 52;
  const top = 182;
  const edgeWeight = new Map();
  edges.forEach((edge) => {
    edgeWeight.set(edge.from, (edgeWeight.get(edge.from) ?? 0) + 1);
    edgeWeight.set(edge.to, (edgeWeight.get(edge.to) ?? 0) + 1);
  });

  return activeColumns.flatMap(([key], columnIndex) => {
    const columnNodes = grouped.get(key) ?? [];
    return columnNodes
      .slice()
      .sort((a, b) => {
        const weightDiff = (edgeWeight.get(b.id) ?? 0) - (edgeWeight.get(a.id) ?? 0);
        return weightDiff || a.originalIndex - b.originalIndex;
      })
      .map((node, rowIndex) => ({
        ...node,
        label: artifactGraphKindLabel(node),
        detail: artifactGraphNodeDetail(node),
        x: left + columnIndex * (nodeWidth + columnGap),
        y: top + rowIndex * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
        maxChars: 24,
        maxLines: 2,
        detailFontSize: 14,
        detailLineHeight: 18
      }));
  });
}

function artifactGraphColumnKey(node) {
  const text = `${node.kind ?? ""} ${node.label ?? ""} ${node.detail ?? ""} ${node.sourceRef ?? ""}`.toLowerCase();
  if (node.missing || node.tone === "danger" || text.includes("missing")) {
    return "gaps";
  }
  if (text.includes("manifest") || text.includes("project") || text.includes("workspace")) {
    return "workspace";
  }
  if (text.includes("route") || text.includes("claim") || text.includes("obligation")) {
    return "reasoning";
  }
  if (text.includes("receipt") || text.includes("proof") || text.includes("smt") || text.includes("cas") || text.includes("check")) {
    return "evidence";
  }
  if (text.includes("visual") || text.includes("artifact") || text.includes("report") || text.includes("benchmark")) {
    return "artifacts";
  }
  return "artifacts";
}

function artifactGraphKindLabel(node) {
  const value = String(node.kind ?? "artifact")
    .replace(/[-_]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const label = value
    ? value.replace(/\b\w/gu, (match) => match.toUpperCase())
    : "Artifact";
  return node.trust ? `${label} | ${node.trust}` : label;
}

function artifactGraphNodeDetail(node) {
  const detail = String(node.label ?? node.detail ?? node.sourceRef ?? "workspace node").trim();
  if (detail) {
    return detail;
  }
  return String(node.sourceRef ?? "workspace node");
}

function artifactGraphEdgeColor(node) {
  if (node.tone === "danger") {
    return "#8a4c4c";
  }
  if (node.tone === "warn") {
    return "#8d7431";
  }
  if (node.tone === "good") {
    return "#4e9673";
  }
  return "#4a4844";
}

function visualNodeBounds(nodes) {
  return nodes.reduce((bounds, node) => ({
    maxX: Math.max(bounds.maxX, node.x + node.width),
    maxY: Math.max(bounds.maxY, node.y + node.height)
  }), { maxX: 0, maxY: 0 });
}

function artifactGraphMetricSvg(label, value, x, y) {
  return `<g transform="translate(${x} ${y})">
    <rect width="122" height="34" rx="9" fill="#171614" stroke="#2f2c28" />
    <text x="12" y="14" fill="#8f8a83" font-size="10" font-weight="650">${escapeXml(label)}</text>
    <text x="12" y="27" fill="#f2f2ee" font-size="13" font-weight="780">${escapeXml(value)}</text>
  </g>`;
}

function artifactGraphColumnLabels(nodes) {
  const occupied = new Map();
  nodes.forEach((node) => {
    const key = artifactGraphColumnKey(node);
    if (!occupied.has(key)) {
      occupied.set(key, node.x);
    }
  });

  return ARTIFACT_GRAPH_COLUMNS
    .filter(([key]) => occupied.has(key))
    .map(([key, label]) => `<g transform="translate(${occupied.get(key)} 150)">
      <text x="0" y="0" fill="#aaa59d" font-size="12" font-weight="720">${escapeXml(label)}</text>
      <line x1="0" y1="11" x2="220" y2="11" stroke="#2f2c28" />
    </g>`)
    .join("");
}

function safeSvgColor(value, fallback) {
  const text = String(value ?? "").trim();
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/iu.test(text)) {
    return text;
  }
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/iu.test(text)) {
    return text;
  }
  return fallback;
}

function savedVisualArtifactPlaceholderSvg(artifact) {
  const width = 980;
  const height = 540;
  const payload = artifact.payload ?? {};
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Saved visual artifact placeholder">
    <rect width="${width}" height="${height}" rx="16" fill="#101010" />
    <rect x="64" y="82" width="852" height="324" rx="14" fill="#141312" stroke="#2d2b28" />
    <text x="96" y="136" fill="#f2f2ee" font-size="26" font-weight="760">${escapeXml(artifact.title ?? "Saved Visual Artifact")}</text>
    <text x="96" y="176" fill="#aaa59d" font-size="15">${escapeXml(artifact.visualId ?? "visual artifact")} - ${escapeXml(artifact.kind ?? "visual")}</text>
    <text x="96" y="236" fill="#dfd7ca" font-size="18" font-weight="700">Renderer: ${escapeXml(artifact.renderer?.engine ?? "unknown")}</text>
    <text x="96" y="278" fill="#dfd7ca" font-size="18" font-weight="700">Payload: ${escapeXml(payload.format ?? "unknown")}</text>
    <text x="96" y="334" fill="#aaa59d" font-size="14">This payload is saved and replayable, but the web viewer needs a dedicated renderer before drawing it.</text>
    <text x="96" y="366" fill="#aaa59d" font-size="14">The source artifact remains authoritative; this visual does not upgrade any trust label.</text>
  </svg>`;
}

function layoutResearchMapNodes(nodes) {
  const safeNodes = nodes.length > 0
    ? nodes
    : [{ id: "empty-map", label: "Empty map", detail: "No nodes were saved in this snapshot.", tone: "warn" }];
  const centerNode = safeNodes[0];
  const output = [{
    id: centerNode.id ?? "root",
    label: centerNode.label ?? "Root",
    detail: centerNode.detail ?? "",
    kind: centerNode.kind ?? "research-map-node",
    sourceRef: centerNode.sourceRef ?? "",
    x: 450,
    y: 132,
    width: 280,
    height: 92,
    tone: centerNode.tone ?? "good"
  }];
  const positions = [
    [86, 120],
    [820, 120],
    [86, 284],
    [820, 284],
    [450, 342],
    [86, 448],
    [820, 448],
    [450, 506]
  ];
  for (const [index, node] of safeNodes.slice(1, 9).entries()) {
    const [x, y] = positions[index] ?? [86 + (index % 3) * 360, 640 + Math.floor(index / 3) * 140];
    output.push({
      id: node.id ?? `node-${index + 2}`,
      label: node.label ?? `Node ${index + 2}`,
      detail: node.detail ?? "",
      kind: node.kind ?? "research-map-node",
      sourceRef: node.sourceRef ?? "",
      x,
      y,
      width: 268,
      height: 86,
      tone: node.tone ?? "muted"
    });
  }

  return output;
}

function renderResearchMapHistory() {
  if (!researchMapList) {
    return;
  }

  const snapshots = [...(researchMap.snapshots ?? [])].reverse();
  if (snapshots.length === 0) {
    researchMapList.innerHTML = `<div class="activity-empty">No saved maps yet. Use Save map to write the current visual to the local artifact ledger.</div>`;
    return;
  }

  researchMapList.innerHTML = snapshots
    .slice(0, 8)
    .map((snapshot) => {
      const active = snapshot.snapshotId === state.selectedResearchMapSnapshotId;
      const nodeCount = Array.isArray(snapshot.nodes) ? snapshot.nodes.length : 0;
      const edgeCount = Array.isArray(snapshot.edges) ? snapshot.edges.length : 0;
      const title = snapshot.title ?? "Saved Research Map";
      const receipt = snapshot.receiptRef?.title ?? snapshot.receiptRef?.runId ?? "local artifact";
      return `<button class="research-map-row ${active ? "active" : ""}" data-map-snapshot-id="${escapeHtml(snapshot.snapshotId)}" type="button">
        <span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(snapshot.kind ?? "map")} - ${escapeHtml(formatActivityTime(snapshot.createdAt))}</small>
          <small>${escapeHtml(receipt)} - ${nodeCount} nodes / ${edgeCount} edges</small>
        </span>
      </button>`;
    })
    .join("");
}

function renderVisualArtifactHistory() {
  if (!visualArtifactList) {
    return;
  }

  if (visualArtifacts.length === 0) {
    visualArtifactList.innerHTML = `<div class="activity-empty">No saved visual artifacts yet. Save a visual to create a replayable .truth-harness/visuals record.</div>`;
    return;
  }

  visualArtifactList.innerHTML = visualArtifacts
    .slice(0, 8)
    .map((artifact) => {
      const active = artifact.visualId === state.selectedVisualArtifactId;
      const sources = Array.isArray(artifact.sourceRefs) ? artifact.sourceRefs.length : 0;
      const typeLabel = visualArtifactSummaryTypeLabel(artifact);
      return `<button class="research-map-row ${active ? "active" : ""}" data-visual-artifact-id="${escapeHtml(artifact.visualId)}" type="button">
        <span>
          <strong>${escapeHtml(artifact.title ?? artifact.visualId)}</strong>
          <small>${escapeHtml(typeLabel)} - ${escapeHtml(artifact.kind ?? "visual")} - ${escapeHtml(formatActivityTime(artifact.createdAt))}</small>
          <small>${sources} source ref${sources === 1 ? "" : "s"} - ${escapeHtml((artifact.tags ?? []).map((tag) => `#${tag}`).join(" ") || "no tags")}</small>
        </span>
      </button>`;
    })
    .join("");
}

function visualArtifactSummaryTypeLabel(artifact) {
  if (isRenderedSvgVisualSummary(artifact)) {
    return "rendered SVG";
  }
  if (artifact?.renderer === "plotly") {
    return "Plotly source";
  }
  if (artifact?.renderer === "graphviz") {
    return "Graphviz source";
  }
  if (artifact?.renderer === "mermaid") {
    return "Mermaid source";
  }
  return artifact?.renderer ?? "visual artifact";
}

function renderResearchMapNodeInspector(snapshot, plot) {
  if (!plotNodeInspector) {
    return;
  }

  const inspectorSnapshot = snapshot ?? createLiveResearchMapSnapshot(plot);
  const liveMap = Boolean(inspectorSnapshot?.live);
  const visualArtifactRef = inspectorSnapshot?.visualArtifactRef;
  const snapshotLabel = visualArtifactRef?.visualId
    ? `visual artifact ${visualArtifactRef.visualId}`
    : liveMap
      ? "live unsaved map"
      : inspectorSnapshot?.snapshotId ?? "unknown";

  if (!inspectorSnapshot) {
    const mapNodeCount = Array.isArray(plot?.mapNodes) ? plot.mapNodes.length : 0;
    plotNodeInspector.innerHTML = `<div class="map-node-empty">
      <h5>Map Node Inspector</h5>
      <p>${mapNodeCount > 0
        ? "Save or open this map, then click a node to inspect its source, edges, and receipt route."
        : "Open a saved research map to inspect clickable nodes and their evidence routes."}</p>
    </div>`;
    return;
  }

  const node = selectedResearchMapNode(inspectorSnapshot);
  if (!node) {
    plotNodeInspector.innerHTML = `<div class="map-node-empty">
      <h5>Map Node Inspector</h5>
      <p>This saved map has no node records.</p>
    </div>`;
    return;
  }

  const nodeSource = researchMapNodeSource(inspectorSnapshot, node);
  const edges = researchMapNodeEdges(inspectorSnapshot, node);
  const receiptKey = receiptKeyForResearchMapNode(inspectorSnapshot, node);
  const edgeHtml = edges.length > 0
    ? `<ul class="map-node-edge-list">${edges.slice(0, 6).map((edge) => {
      const direction = edge.from === node.id ? "out" : "in";
      const partner = edge.from === node.id ? edge.to : edge.from;
      return `<li><span>${escapeHtml(direction)}</span><code>${escapeHtml(partner)}</code>${edge.kind ? ` <small>${escapeHtml(edge.kind)}</small>` : ""}</li>`;
    }).join("")}</ul>`
    : `<p class="map-node-muted">No edges recorded for this node.</p>`;

  plotNodeInspector.innerHTML = `<div class="map-node-inspector-card">
    <div class="map-node-inspector-header">
      <div>
        <h5>Selected Node</h5>
        <strong>${escapeHtml(node.label ?? node.id)}</strong>
      </div>
      <span class="mini-label">${escapeHtml(node.kind ?? "map node")}</span>
    </div>
    <p>${escapeHtml(node.detail ?? "No node detail recorded.")}</p>
    <dl class="map-node-facts">
      <div><dt>Node ID</dt><dd><code>${escapeHtml(node.id ?? "unknown")}</code></dd></div>
      <div><dt>Source</dt><dd>${escapeHtml(nodeSource.source)}</dd></div>
      <div><dt>Value</dt><dd>${escapeHtml(nodeSource.value)}</dd></div>
      <div><dt>Edges</dt><dd>${escapeHtml(String(edges.length))}</dd></div>
      <div><dt>Snapshot</dt><dd><code>${escapeHtml(snapshotLabel)}</code></dd></div>
      <div><dt>Receipt</dt><dd>${inspectorSnapshot.receiptRef?.runId ? `<code>${escapeHtml(inspectorSnapshot.receiptRef.runId)}</code>` : "not linked"}</dd></div>
    </dl>
    ${edgeHtml}
    <div class="map-node-actions">
      <button class="text-button compact-button" data-map-copy-node="${escapeHtml(node.id)}" type="button">Copy node</button>
      ${receiptKey ? `<button class="text-button compact-button" data-map-open-receipt="${escapeHtml(receiptKey)}" type="button">Open receipt</button>` : ""}
    </div>
    ${visualArtifactRef
      ? `<div class="map-node-live-note">
        <strong>Saved visual artifact</strong>
        <p>This node comes from ${escapeHtml(visualArtifactRef.visualId)}. Save it as a research map before attaching new thoughts to the visual workspace.</p>
        <button class="text-button compact-button" data-map-save-current type="button">Save as research map</button>
      </div>`
      : liveMap
      ? `<div class="map-node-live-note">
        <strong>Live map</strong>
        <p>Save this map before attaching linked thoughts so future agents can replay the exact snapshot.</p>
        <button class="text-button compact-button" data-map-save-current type="button">Save map to add notes</button>
      </div>`
      : `<form class="map-thought-form" data-map-thought-form>
      <div class="map-thought-form-header">
        <strong>Add Linked Thought</strong>
        <span class="mini-label">local snapshot</span>
      </div>
      <label>
        <span>Type</span>
        <select name="kind">
          <option value="next-check">Next check</option>
          <option value="question">Question</option>
          <option value="assumption">Assumption</option>
          <option value="hypothesis">Hypothesis</option>
          <option value="insight">Insight</option>
        </select>
      </label>
      <label>
        <span>Title</span>
        <input name="title" type="text" maxlength="96" placeholder="What should stay connected here?" />
      </label>
      <label>
        <span>Detail</span>
        <textarea name="detail" rows="3" maxlength="260" placeholder="What should future you or an agent verify?"></textarea>
      </label>
      <button class="text-button compact-button" type="submit">Save thought</button>
    </form>`}
  </div>`;
}

function researchMapNodeSource(snapshot, node) {
  const rows = Array.isArray(snapshot.dataRows) ? snapshot.dataRows : [];
  const nodeId = String(node.id ?? "");
  const row = rows.find((candidate) => {
    const key = String(candidate?.[0] ?? "");
    return key === nodeId || safeMapNodeId(key, 0) === nodeId;
  });
  return {
    value: String(row?.[1] ?? node.detail ?? "not recorded"),
    source: String(row?.[2] ?? node.sourceRef ?? node.kind ?? "snapshot.nodes")
  };
}

function researchMapNodeEdges(snapshot, node) {
  const nodeId = node?.id;
  if (!nodeId) {
    return [];
  }

  return (snapshot.edges ?? []).filter((edge) => edge.from === nodeId || edge.to === nodeId);
}

function receiptKeyForResearchMapNode(snapshot, node) {
  const source = `${node?.sourceRef ?? ""} ${node?.id ?? ""} ${node?.detail ?? ""}`;
  const explicitRunId = source.match(/run_[a-zA-Z0-9]+/u)?.[0];
  if (explicitRunId) {
    return receiptKeyForRunId(explicitRunId);
  }

  if (["current-claim", "receipt", "claim"].includes(String(node?.id ?? "")) && snapshot.receiptRef?.runId) {
    return receiptKeyForRunId(snapshot.receiptRef.runId);
  }

  if (String(node?.sourceRef ?? "").startsWith("receipt.") && snapshot.receiptRef?.runId) {
    return receiptKeyForRunId(snapshot.receiptRef.runId);
  }

  return undefined;
}

function selectedResearchMapNodePacket(snapshot, node) {
  const nodeSource = researchMapNodeSource(snapshot, node);
  const edges = researchMapNodeEdges(snapshot, node);
  return {
    schemaVersion: "truth-harness.research-map-node-selection.v0",
    localOnly: true,
    networkAccess: "none",
    snapshotId: snapshot.snapshotId,
    selectedAt: new Date().toISOString(),
    node: {
      id: node.id,
      label: node.label,
      detail: node.detail,
      kind: node.kind,
      sourceRef: node.sourceRef,
      tone: node.tone
    },
    source: nodeSource,
    receiptRef: snapshot.receiptRef ?? {},
    edges
  };
}

function researchThoughtKindLabel(kind) {
  return {
    "next-check": "Next check",
    question: "Question",
    assumption: "Assumption",
    hypothesis: "Hypothesis",
    insight: "Insight"
  }[kind] ?? "Thought";
}

function researchThoughtTone(kind) {
  return {
    "next-check": "accent",
    question: "warn",
    assumption: "muted",
    hypothesis: "warn",
    insight: "good"
  }[kind] ?? "muted";
}

function researchThoughtEdgeKind(kind) {
  return {
    "next-check": "requires-check",
    question: "asks",
    assumption: "assumes",
    hypothesis: "hypothesizes",
    insight: "notes"
  }[kind] ?? "thought-link";
}

function createResearchThoughtSnapshot(snapshot, parentNode, form) {
  const formData = new FormData(form);
  const kind = String(formData.get("kind") ?? "next-check");
  const titleText = String(formData.get("title") ?? "").replace(/\s+/gu, " ").trim();
  const detailText = String(formData.get("detail") ?? "").replace(/\s+/gu, " ").trim();
  const label = titleText || researchThoughtKindLabel(kind);
  const detail = detailText || titleText || `${researchThoughtKindLabel(kind)} linked to ${parentNode.label ?? parentNode.id}.`;
  const nodeId = safeMapNodeId(`thought-${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`, "thought");
  const node = {
    id: nodeId,
    label,
    detail,
    kind: `research-${kind}`,
    sourceRef: `human:${kind}:${snapshot.snapshotId ?? "local-map"}`,
    tone: researchThoughtTone(kind)
  };
  const edge = {
    id: safeMapNodeId(`edge-${parentNode.id}-${nodeId}`, "edge"),
    from: parentNode.id,
    to: nodeId,
    kind: researchThoughtEdgeKind(kind),
    label: researchThoughtKindLabel(kind)
  };
  const existingDataColumns = Array.isArray(snapshot.dataColumns) && snapshot.dataColumns.length > 0
    ? snapshot.dataColumns
    : ["node", "value", "source"];
  const dataRow = existingDataColumns.map((column, index) => {
    const normalized = String(column).toLowerCase();
    if (index === 0 || normalized.includes("node")) {
      return node.id;
    }
    if (normalized.includes("source")) {
      return node.sourceRef;
    }
    return detail;
  });

  return {
    ...snapshot,
    visualMode: "mind-map",
    kind: snapshot.kind ?? "mind map",
    title: snapshot.title ?? "Research Mind Map",
    caption: `${snapshot.caption ?? "Local research map."} Added ${researchThoughtKindLabel(kind).toLowerCase()} '${label}' under ${parentNode.label ?? parentNode.id}.`,
    facts: [
      ...(snapshot.facts ?? []),
      ["Map edit", `${researchThoughtKindLabel(kind)} linked to ${parentNode.label ?? parentNode.id}`]
    ].slice(-24),
    dataColumns: existingDataColumns,
    dataRows: [
      ...(snapshot.dataRows ?? []),
      dataRow
    ],
    nodes: [
      ...(snapshot.nodes ?? []),
      node
    ],
    edges: [
      ...(snapshot.edges ?? []),
      edge
    ],
    tags: uniqueTags([
      ...(snapshot.tags ?? []),
      "research-map",
      "linked-thought",
      kind
    ])
  };
}

async function saveResearchMapThought(form) {
  const snapshot = selectedResearchMapSnapshot();
  const parentNode = selectedResearchMapNode(snapshot);
  if (!snapshot || !parentNode) {
    return;
  }

  const title = String(new FormData(form).get("title") ?? "").trim();
  const detail = String(new FormData(form).get("detail") ?? "").trim();
  if (!title && !detail) {
    addActivity("web-ui", "Map thought missing", "Add a title or detail before saving a linked thought.", "missing");
    return;
  }

  const button = form.querySelector("button[type='submit']");
  const previousText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "Saving";
  }
  if (researchMapStatus) {
    researchMapStatus.textContent = "saving linked thought";
  }

  const draftSnapshot = createResearchThoughtSnapshot(snapshot, parentNode, form);
  const createdNodeId = draftSnapshot.nodes.at(-1)?.id;
  addActivity("human", "Saving linked thought", `${draftSnapshot.nodes.at(-1)?.label ?? "Thought"} is being attached to ${parentNode.label ?? parentNode.id}.`, "waiting");

  try {
    const response = await fetch("/api/research-map", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ snapshot: draftSnapshot })
    });
    const payload = await readLocalApiJson(response, "Local research map API failed.");
    applyResearchMapPayload(payload);
    state.selectedResearchMapSnapshotId = payload.snapshot?.snapshotId;
    state.selectedResearchMapNodeId = createdNodeId;
    requestVisualFit();
    updateLatestActivity(
      "Saving linked thought",
      "passed",
      localApiSuccessMessage(payload, `${createdNodeId ?? "thought node"} saved as a new local map snapshot.`)
    );
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    if (researchMapStatus) {
      researchMapStatus.textContent = `${payload.snapshot?.snapshotId ?? "map"} saved with linked thought`;
    }
    form.reset();
    render();
  } catch (error) {
    updateLatestActivity("Saving linked thought", "refuted", error instanceof Error ? error.message : "Unknown research map failure.");
    if (researchMapStatus) {
      researchMapStatus.textContent = "linked thought save failed";
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText ?? "Save thought";
    }
  }
}

function selectResearchMapNode(nodeId) {
  const savedSnapshot = selectedResearchMapSnapshot();
  const snapshot = savedSnapshot ?? createLiveResearchMapSnapshot(currentPlotModel());
  if (!snapshot || !nodeId) {
    return;
  }

  const node = (snapshot.nodes ?? []).find((item) => item.id === nodeId);
  if (!node) {
    return;
  }

  state.selectedResearchMapNodeId = node.id;
  addActivity(
    "human",
    "Selected research map node",
    `${node.label ?? node.id} inspected from ${snapshot.live ? "live visual map" : snapshot.snapshotId}.`,
    "passed"
  );
  render();
}

async function copySelectedResearchMapNode(button) {
  const snapshot = selectedResearchMapSnapshot() ?? createLiveResearchMapSnapshot(currentPlotModel());
  const node = selectedResearchMapNode(snapshot);
  if (!snapshot || !node) {
    return;
  }

  await copyOrDownloadText({
    text: `${JSON.stringify(selectedResearchMapNodePacket(snapshot, node), null, 2)}\n`,
    filename: `${snapshot.snapshotId}-${safeMapNodeId(node.id ?? node.label, 0)}.json`,
    type: "application/json",
    button,
    copiedTitle: "Copied map node packet",
    copiedDetail: `${node.label ?? node.id} copied with snapshot, source, receipt, and edge refs.`,
    fallbackTitle: "Downloaded map node packet",
    fallbackDetail: `${node.label ?? node.id} was saved as a local JSON packet instead.`
  });
}

function openResearchMapNodeReceipt(receiptKey) {
  const receipt = receiptStore.get(receiptKey);
  if (!receipt) {
    addActivity("web-ui", "Receipt link missing", `${receiptKey} was not found in the current local receipt store.`, "missing");
    return;
  }

  state.receiptKey = receiptKey;
  state.level = "middle";
  state.surface = "trace";
  state.selectedGraphIndex = 0;
  state.selectedResearchMapSnapshotId = undefined;
  state.selectedResearchMapNodeId = undefined;
  requestVisualFit();
  state.replayIndex = 0;
  promptInput.value = receipt.title;
  promoteRecentReceiptKey(receiptKey);
  addActivity("human", "Opened map receipt", `${receipt.runId} opened from selected research map node.`, "passed");
  render();
  resetActiveSurfaceScroll();
}

async function copyCurrentPlotData() {
  const receipt = receiptStore.get(state.receiptKey);
  const plot = currentPlotModel();
  if (!receipt || !plot) {
    return;
  }

  await copyOrDownloadText({
    text: formatPlotDataCsv(plot),
    filename: `${receipt.runId}-plot-data.csv`,
    type: "text/csv",
    button: copyPlotDataButton,
    copiedTitle: "Copied visual data",
    copiedDetail: `${receipt.runId} ${plot.kind} rows copied as CSV.`,
    fallbackTitle: "Downloaded visual data",
    fallbackDetail: `${receipt.runId} ${plot.kind} rows were saved as CSV instead.`
  });
}

function downloadCurrentPlotData() {
  const receipt = receiptStore.get(state.receiptKey);
  const plot = currentPlotModel();
  if (!receipt || !plot) {
    return;
  }

  downloadTextFile(`${receipt.runId}-plot-data.csv`, formatPlotDataCsv(plot), "text/csv");
  addActivity("human", "Downloaded visual data", `${receipt.runId} ${plot.kind} rows saved as CSV.`, "passed");
}

function downloadCurrentPlotSvg() {
  const receipt = receiptStore.get(state.receiptKey);
  const plot = currentPlotModel();
  if (!receipt || !plot) {
    return;
  }

  downloadTextFile(`${receipt.runId}-plot.svg`, plot.svg, "image/svg+xml");
  addActivity("human", "Downloaded visual SVG", `${receipt.runId} ${plot.kind} visualization saved as SVG.`, "passed");
}

async function copyCurrentVisualRendererSource(button) {
  const plot = currentPlotModel();
  const rendererSource = plot?.rendererSource;
  if (!rendererSource?.content) {
    return;
  }

  await copyOrDownloadText({
    text: `${rendererSource.content.trimEnd()}\n`,
    filename: rendererSource.filename ?? `truth-harness-renderer-source-${safeFilenameTimestamp()}.txt`,
    type: rendererSourceMimeType(rendererSource.language),
    button,
    copiedTitle: "Copied renderer source",
    copiedDetail: `${rendererSource.language ?? "text"} source copied from the visual artifact.`,
    fallbackTitle: "Downloaded renderer source",
    fallbackDetail: "the renderer source was saved as a local file instead."
  });
}

function downloadCurrentVisualRendererSource() {
  const plot = currentPlotModel();
  const rendererSource = plot?.rendererSource;
  if (!rendererSource?.content) {
    return;
  }

  downloadTextFile(
    rendererSource.filename ?? `truth-harness-renderer-source-${safeFilenameTimestamp()}.txt`,
    `${rendererSource.content.trimEnd()}\n`,
    rendererSourceMimeType(rendererSource.language)
  );
  addActivity("human", "Downloaded renderer source", `${rendererSource.language ?? "text"} visual renderer source saved locally.`, "passed");
}

function rendererSourceMimeType(language) {
  if (language === "plotly-json" || language === "tldraw-json") {
    return "application/json";
  }
  if (language === "svg") {
    return "image/svg+xml";
  }
  if (language === "html") {
    return "text/html";
  }
  if (language === "python") {
    return "text/x-python";
  }
  return "text/plain";
}

async function saveCurrentResearchMap() {
  const receipt = receiptStore.get(state.receiptKey);
  const plot = currentPlotModel();
  if (!receipt || !plot) {
    return;
  }

  const snapshot = createResearchMapSnapshot(receipt, plot);
  const previousText = saveResearchMapButton?.textContent;
  if (saveResearchMapButton) {
    saveResearchMapButton.disabled = true;
    saveResearchMapButton.textContent = "Saving";
  }
  if (researchMapStatus) {
    researchMapStatus.textContent = "saving local map";
  }
  addActivity("web-ui", "Saving research map", `${plot.kind} snapshot is being written to the local artifact store.`, "waiting");
  let saved = false;

  try {
    const response = await fetch("/api/research-map", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ snapshot })
    });
    const payload = await readLocalApiJson(response, "Local research map API failed.");
    const savedSnapshot = payload.snapshot ?? snapshot;
    applyResearchMapPayload(payload);
    let visualSavedMessage = "";
    try {
      const visualPayload = await saveCurrentVisualArtifactRecord(receipt, plot);
      visualSavedMessage = `; visual artifact ${visualPayload.visual?.visualId ?? "saved"} also written`;
      for (const item of visualPayload.activity ?? []) {
        addActivity(item.actor, item.action, item.detail, "passed", item.at);
      }
    } catch (error) {
      addActivity("web-ui", "Visual artifact save failed", error instanceof Error ? error.message : "Unknown visual artifact failure.", "waiting");
    }
    updateLatestActivity(
      "Saving research map",
      "passed",
      localApiSuccessMessage(payload, `${savedSnapshot.snapshotId ?? "map snapshot"} saved to ${payload.paths?.json ?? ".truth-harness/artifacts/research-map.json"}${visualSavedMessage}`)
    );
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    if (researchMapStatus) {
      const snapshotCount = payload.map?.snapshotCount ?? 1;
      researchMapStatus.textContent = `${snapshotCount} saved map snapshot${snapshotCount === 1 ? "" : "s"}`;
    }
    renderResearchMapHistory();
    renderVisualArtifactHistory();
    saved = true;
  } catch (error) {
    updateLatestActivity("Saving research map", "refuted", error instanceof Error ? error.message : "Unknown research map failure.");
    if (researchMapStatus) {
      researchMapStatus.textContent = "map save failed";
    }
  } finally {
    if (saveResearchMapButton) {
      saveResearchMapButton.disabled = false;
      saveResearchMapButton.textContent = previousText ?? "Save visual";
      if (saved) {
        flashButtonText(saveResearchMapButton, "Saved");
      }
    }
  }
}

function createResearchMapSnapshot(receipt, plot) {
  const nodes = Array.isArray(plot.mapNodes) && plot.mapNodes.length > 0
    ? plot.mapNodes
    : visualRowsAsMapNodes(plot);
  const edges = Array.isArray(plot.mapEdges) && plot.mapEdges.length > 0
    ? plot.mapEdges
    : visualRowsAsMapEdges(nodes);

  return {
    schemaVersion: "truth-harness.research-map-snapshot.v0",
    visualMode: state.visualMode,
    kind: plot.kind,
    title: plot.title,
    caption: plot.caption,
    receiptRef: {
      runId: receipt.runId,
      claimId: receipt.claimId,
      routeId: receipt.verifierRoute?.routeId,
      title: receipt.title,
      trust: receipt.trust
    },
    facts: plot.facts ?? [],
    dataColumns: plot.dataColumns ?? [],
    dataRows: plot.dataRows ?? [],
    nodes,
    edges,
    tags: receiptTags(receipt),
    localOnly: true,
    networkAccess: "none"
  };
}

async function saveCurrentVisualArtifactRecord(receipt, plot) {
  const response = await fetch("/api/visuals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(createVisualArtifactRequest(receipt, plot))
  });
  const payload = await readLocalApiJson(response, "Local visual artifact API failed.");
  applyVisualArtifactsPayload(payload);
  return payload;
}

async function saveCurrentPlotFigureArtifact() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  const workspaceReceipt = await ensureWorkspaceReceiptRef(receipt);
  const receiptPath = workspaceReceipt.receiptPaths?.ref ?? workspaceReceipt.receiptPaths?.json;
  const previousText = savePlotSourceButton?.textContent;
  if (savePlotSourceButton) {
    savePlotSourceButton.disabled = true;
    savePlotSourceButton.textContent = "Making";
  }
  addActivity("web-ui", "Making plot figure", "POST /api/visuals/plot then POST /api/visuals/render from the current receipt.", "waiting");
  let figureSaved = false;
  let sourceVisualId;

  try {
    const sourceResponse = await fetch("/api/visuals/plot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        receiptPath,
        problem: receiptPath ? undefined : receipt.title,
        renderer: "plotly",
        title: `Plot source for ${workspaceReceipt.title ?? receipt.title}`
      })
    });
    const sourcePayload = await readLocalApiJson(sourceResponse, "Local plot visual API failed.");
    applyVisualArtifactsPayload(sourcePayload);
    sourceVisualId = sourcePayload.visual?.visualId;
    if (!sourceVisualId) {
      throw new Error("Local plot visual API did not return a visual id.");
    }

    state.selectedVisualArtifactId = sourceVisualId;
    state.selectedResearchMapSnapshotId = undefined;
    state.selectedResearchMapNodeId = undefined;
    state.surface = "plot";
    for (const item of sourcePayload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }

    const renderResponse = await fetch("/api/visuals/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        visualRef: sourceVisualId,
        engine: "plotly",
        title: `Figure for ${workspaceReceipt.title ?? receipt.title}`
      })
    });
    const renderPayload = await readLocalApiJson(renderResponse, "Local plot figure render API failed.");
    applyVisualArtifactsPayload(renderPayload);
    state.selectedVisualArtifactId = renderPayload.visual?.visualId ?? sourceVisualId;
    requestVisualFit();
    for (const item of renderPayload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    updateLatestActivity(
      "Making plot figure",
      "passed",
      localApiSuccessMessage(renderPayload, `${sourceVisualId} rendered into ${renderPayload.visual?.visualId ?? "SVG figure"} with the source artifact preserved.`)
    );
    figureSaved = true;
    render();
    resetActiveSurfaceScroll();
  } catch (error) {
    updateLatestActivity("Making plot figure", "refuted", error instanceof Error ? error.message : "POST /api/visuals/plot or /api/visuals/render failed");
    addActivity("local-api", "Plot figure failed", error instanceof Error ? error.message : "Unknown plot figure failure.", "refuted");
    if (sourceVisualId) {
      state.selectedVisualArtifactId = sourceVisualId;
      requestVisualFit();
      render();
      resetActiveSurfaceScroll();
    }
  } finally {
    if (savePlotSourceButton) {
      savePlotSourceButton.disabled = false;
      savePlotSourceButton.textContent = previousText ?? "Make figure";
      if (figureSaved) {
        flashButtonText(savePlotSourceButton, "Figure saved");
      }
    }
  }
}

function createVisualArtifactRequest(receipt, plot) {
  const dimensions = visualSvgDimensions(plot.svg);
  return {
    title: `${receipt.title} - ${plot.kind}`,
    kind: visualArtifactKindForMode(state.visualMode),
    renderer: {
      engine: "truth-harness-native"
    },
    sourceRefs: visualSourceRefsForReceipt(receipt),
    replayCommand: `truth-harness visual list .`,
    payload: {
      format: "svg",
      content: plot.svg,
      width: dimensions.width,
      height: dimensions.height
    },
    data: {
      columns: plot.dataColumns ?? [],
      rows: plot.dataRows ?? []
    },
    tags: [...receiptTags(receipt), "visual", state.visualMode]
  };
}

function visualArtifactKindForMode(mode) {
  if (mode === "mind-map") {
    return "mind-map";
  }
  if (mode === "concept-map" || mode === "equation-map") {
    return "concept-map";
  }
  if (mode === "step-flow") {
    return "lineage-graph";
  }
  if (mode === "trust-ladder") {
    return "proof-tree";
  }
  return "plot";
}

function visualSourceRefsForReceipt(receipt) {
  if (receipt.receiptPaths?.ref) {
    return [{ kind: "receipt", ref: receipt.receiptPaths.ref, label: "Local receipt JSON" }];
  }
  if (receipt.receiptPaths?.json) {
    return [{ kind: "receipt", ref: receipt.receiptPaths.json, label: "Local receipt JSON" }];
  }
  if (receipt.verifierRoute?.routeId) {
    return [{ kind: "route", ref: receipt.verifierRoute.routeId, label: "Verifier route" }];
  }
  return [{ kind: "manual", ref: `built-in-demo:${receipt.runId}`, label: "Built-in demo receipt" }];
}

function visualSvgDimensions(svg) {
  const match = String(svg).match(/viewBox="([^"]+)"/u);
  const parts = match?.[1]?.split(/\s+/u).map(Number) ?? [];
  return {
    width: Number.isFinite(parts[2]) && parts[2] > 0 ? Math.round(parts[2]) : 980,
    height: Number.isFinite(parts[3]) && parts[3] > 0 ? Math.round(parts[3]) : 560
  };
}

function visualRowsAsMapNodes(plot) {
  const rows = plot.dataRows ?? [];
  return rows.slice(0, 80).map((row, index) => {
    const label = String(row[0] ?? `${plot.kind} ${index + 1}`);
    const detail = row.slice(1, 4).filter(Boolean).join(" | ");
    return {
      id: safeMapNodeId(label, index + 1),
      label,
      detail,
      kind: `${plot.kind}-data-row`,
      sourceRef: String(row[row.length - 1] ?? plot.kind),
      tone: index === 0 ? "accent" : "muted"
    };
  });
}

function visualRowsAsMapEdges(nodes) {
  const [rootNode, ...childNodes] = nodes;
  if (!rootNode) {
    return [];
  }

  return childNodes.map((node) => ({
    from: rootNode.id,
    to: node.id,
    kind: "visual-row-link"
  }));
}

function parseFractionsFromText(text) {
  return [...String(text).matchAll(/(-?\d+)\s*\/\s*(\d+)/gu)]
    .map((match) => ({ numerator: Number(match[1]), denominator: Number(match[2]) }))
    .filter((fraction) => Number.isFinite(fraction.numerator) && Number.isFinite(fraction.denominator) && fraction.denominator !== 0);
}

function parseFraction(text) {
  const match = String(text).trim().match(/^(-?\d+)\s*\/\s*(\d+)$/u);
  if (match) {
    return { numerator: Number(match[1]), denominator: Number(match[2]) };
  }

  const integer = Number(String(text).trim());
  return Number.isInteger(integer) ? { numerator: integer, denominator: 1 } : undefined;
}

function uniqueFractionsByLabel(fractions) {
  const seen = new Set();
  return fractions.filter((fraction) => {
    const label = fractionLabel(fraction);
    if (seen.has(label)) {
      return false;
    }
    seen.add(label);
    return true;
  });
}

function fractionValue(fraction) {
  return fraction.numerator / fraction.denominator;
}

function fractionLabel(fraction) {
  return fraction.denominator === 1 ? String(fraction.numerator) : `${fraction.numerator}/${fraction.denominator}`;
}

function gcd(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function lcm(left, right) {
  return Math.abs(left * right) / gcd(left, right);
}

function lcmMany(values) {
  return values.reduce((accumulator, value) => lcm(accumulator, value), 1);
}

function pagerSummary(shown, total, singular) {
  const plural = `${singular}s`;
  if (total === 0) {
    return `0 ${plural}`;
  }

  if (shown >= total) {
    return `All ${total} ${total === 1 ? singular : plural} shown`;
  }

  return `${shown} of ${total} ${plural} shown`;
}

function emptyAutonomyContract() {
  return {
    mode: "idle",
    canRunUnattended: false,
    suggestedBatchSize: 0,
    allowedActions: ["Read local workspace state only."],
    blockedActions: ["Do not make final claims without evidence."],
    stopConditions: ["No open local work item."],
    requiredArtifacts: [],
    humanReviewRequiredFor: ["any final claim whose evidence has not been independently checked"],
    agentPacket: "# Truth Harness Autonomy Contract\n\nMode: idle\n"
  };
}

function renderClaimLedger() {
  if (!claimLedgerList || !claimLedgerCount) {
    return;
  }

  const query = state.claimLedgerQuery.trim().toLowerCase();
  const claims = [...claimLedgerStore.values()];
  const filteredClaims = claims.filter((claim) => matchesClaimLedgerSearch(claim, query));
  const visibleClaims = filteredClaims.slice(0, state.claimLedgerLimit);
  const edgeCount = Array.isArray(claimLedgerGraph.edges) ? claimLedgerGraph.edges.length : 0;
  claimLedgerCount.textContent = query
    ? `${filteredClaims.length} of ${claims.length} records / ${edgeCount} links`
    : `${claims.length} records / ${edgeCount} links`;
  if (claimLedgerPage) {
    const shown = Math.min(state.claimLedgerLimit, filteredClaims.length);
    claimLedgerPage.textContent = pagerSummary(shown, filteredClaims.length, "claim");
  }
  if (claimLedgerMore) {
    claimLedgerMore.hidden = state.claimLedgerLimit >= filteredClaims.length;
  }

  claimLedgerList.innerHTML = visibleClaims.length === 0
    ? `<div class="activity-empty">${claims.length === 0 ? "No local claim records yet. Record the current receipt to create the first project claim." : "No claim records match this filter."}</div>`
    : visibleClaims
      .map((claim) => {
        const linkedKey = receiptKeyForClaimId(claim.claimId);
        const tagText = claim.tags?.slice(0, 3).map((tag) => `#${tag}`).join(" ") || "untagged";
        const finalization = claimFinalizationSummary(claim);
        const dependencyText = claim.dependsOn?.length
          ? `${claim.dependsOn.length} upstream`
          : "root claim";
        const revisionText = claim.supersedes?.length ? `revises ${claim.supersedes.length}` : "";
        const lineageText = [dependencyText, revisionText].filter(Boolean).join(" / ");
        return `<button class="ledger-record ${linkedKey ? "clickable" : ""}" data-claim-id="${escapeHtml(claim.claimId)}" type="button">
          <span class="trust-dot ${trustClass(claim.trust)}"></span>
          <span>
            <strong>${escapeHtml(claim.title)}</strong>
            <small>${escapeHtml(claim.domain)} - ${escapeHtml(claim.trust)} - ${escapeHtml(finalization.label)}</small>
            ${finalization.primaryCheck ? `<small class="ledger-blocker">${escapeHtml(finalization.primaryCheck)}</small>` : ""}
            <small>${escapeHtml(claim.claimId)} - ${escapeHtml(lineageText)}</small>
            <small>${escapeHtml(tagText)}</small>
          </span>
        </button>`;
      })
      .join("");
}

function matchesClaimLedgerSearch(claim, query) {
  if (!query) {
    return true;
  }

  const finalization = claimFinalizationSummary(claim);
  return [
    claim.claimId,
    claim.title,
    claim.statement,
    claim.normalizedStatement,
    claim.domain,
    claim.status,
    claim.trust,
    ...(claim.tags ?? []),
    ...(claim.tags ?? []).map((tag) => `#${tag}`),
    ...(claim.dependsOn ?? []),
    ...(claim.supersedes ?? []),
    ...(claim.authors ?? []),
    ...(claim.evidenceRefs ?? []).flatMap((ref) => [ref.kind, ref.ref, ref.trust, ref.summary]),
    ...(claim.finalization?.openChecks ?? []),
    claim.finalization?.summary,
    finalization.label,
    finalization.primaryCheck,
    ...(claim.warnings ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function claimReceiptDetailRows(receipt) {
  const claim = receipt.claimId ? claimLedgerStore.get(receipt.claimId) : undefined;
  if (!claim) {
    return [];
  }

  const finalization = claimFinalizationSummary(claim);
  return [
    ["Claim trust", claim.trust],
    ["Claim readiness", finalization.label],
    ["Claim open checks", String(finalization.openChecks.length)]
  ];
}

function claimFinalizationSummary(claim) {
  const openChecks = Array.isArray(claim?.finalization?.openChecks)
    ? claim.finalization.openChecks
    : [];
  const ready = Boolean(claim?.finalization?.readyForNarrowClaim);
  const label = ready
    ? "ready"
    : `${openChecks.length} open check${openChecks.length === 1 ? "" : "s"}`;

  return {
    ready,
    label,
    openChecks,
    primaryCheck: openChecks[0] ?? "",
    summary: claim?.finalization?.summary ?? ""
  };
}

function renderRouteHistory() {
  if (!routeHistoryList || !routeHistoryCount) {
    return;
  }

  const query = state.routeHistoryQuery.trim().toLowerCase();
  const currentRouteId = receiptStore.get(state.receiptKey)?.verifierRoute?.routeId;
  const routes = [...routeLedgerStore.values()];
  const filteredRoutes = routes.filter((route) => matchesRouteHistorySearch(route, query));
  const visibleRoutes = filteredRoutes.slice(0, state.routeHistoryLimit);
  routeHistoryCount.textContent = query
    ? `${filteredRoutes.length} of ${routes.length} routes`
    : `${routes.length} routes`;
  if (routeHistoryPage) {
    const shown = Math.min(state.routeHistoryLimit, filteredRoutes.length);
    routeHistoryPage.textContent = pagerSummary(shown, filteredRoutes.length, "route");
  }
  if (routeHistoryMore) {
    routeHistoryMore.hidden = state.routeHistoryLimit >= filteredRoutes.length;
  }

  routeHistoryList.innerHTML = visibleRoutes.length === 0
    ? `<div class="activity-empty">${routes.length === 0 ? "No persisted verifier routes yet. Submit a prompt to create the first local route." : "No saved routes match this filter."}</div>`
    : visibleRoutes
      .map((route) => {
        const active = route.routeId === currentRouteId;
        const gapText = route.gaps === 0
          ? "no gaps"
          : `${route.gaps} gap${route.gaps === 1 ? "" : "s"}${route.criticalGaps ? ` / ${route.criticalGaps} critical` : ""}`;
        const obligationText = routeObligationSummaryText(route);
        const readiness = routeReadiness(route);
        const capabilities = route.usedCapabilities?.slice(0, 3).join(", ") || "no capabilities recorded";
        const created = formatRouteDate(route.createdAt);
        return `<button class="route-record ${active ? "active" : ""}" data-testid="route-record" data-route-id="${escapeHtml(route.routeId)}" type="button">
          <span class="trust-dot ${trustClass(route.finalTrust)}"></span>
          <span>
            <strong>${escapeHtml(route.problem)}</strong>
            <small>${escapeHtml(readiness.ready ? "ready" : "not-ready")} - ${escapeHtml(readiness.strongestTrust)} - ${escapeHtml(gapText)}</small>
            <small>${escapeHtml(route.finalTrust)} - ${escapeHtml(route.status)} - ${escapeHtml(obligationText)}</small>
            <small><code>${escapeHtml(route.routeId)}</code> - ${escapeHtml(created)} - ${escapeHtml(route.evidenceKind)}</small>
            <small>${escapeHtml(capabilities)}</small>
          </span>
        </button>`;
      })
      .join("");
}

function renderWorkspaceReview() {
  if (!workspaceReviewList || !workspaceReviewCount) {
    return;
  }

  const items = Array.isArray(workspaceReview.items) ? workspaceReview.items : [];
  const summary = workspaceReview.summary ?? {};
  renderWorkspaceReviewAutonomy(workspaceReview.autonomy ?? emptyAutonomyContract());
  workspaceReviewCount.textContent = workspaceReviewCountText(summary);
  const visibleItems = items.slice(0, 8);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);
  if (state.selectedWorkspaceReviewItemId && !items.some((item) => item.itemId === state.selectedWorkspaceReviewItemId)) {
    state.selectedWorkspaceReviewItemId = undefined;
  }

  workspaceReviewList.innerHTML = visibleItems.length === 0
    ? `<div class="activity-empty">No project queue items yet. Saved verifier routes and claim blockers will appear here.</div>`
    : visibleItems
      .map((item, index) => {
        const meta = workspaceReviewItemMeta(item);
        const source = workspaceReviewSourceText(item);
        const acceptance = workspaceReviewAcceptanceHtml(item);
        const canOpenRoute = Boolean(item.routeId);
        const active = item.itemId === state.selectedWorkspaceReviewItemId;
        return `<article class="queue-item queue-${escapeHtml(item.priority ?? "medium")} ${active ? "active" : ""}">
          <div class="queue-main">
            <span class="queue-priority">${escapeHtml(item.priority ?? "medium")}</span>
            <div>
              <strong>${escapeHtml(item.title ?? "Workspace review item")}</strong>
              <small>${escapeHtml(item.summary ?? "")}</small>
              <small>${escapeHtml(meta)}</small>
              <small class="queue-source">${escapeHtml(source)}</small>
            </div>
          </div>
          ${acceptance}
          <details class="queue-command-details">
            <summary>Command</summary>
            <code class="queue-command">${escapeHtml(item.command ?? "")}</code>
          </details>
          <div class="queue-actions">
            <button class="text-button compact-button open-workspace-action" data-testid="workspace-open-action" data-review-index="${index}" type="button">${active ? "Viewing" : "Open action"}</button>
            ${canOpenRoute ? `<button class="text-button compact-button open-workspace-route" data-testid="workspace-open-route" data-route-id="${escapeHtml(item.routeId)}" type="button">Open route</button>` : ""}
            <button class="text-button compact-button copy-workspace-packet" data-review-index="${index}" type="button">Copy packet</button>
            <button class="text-button compact-button copy-workspace-command" data-review-index="${index}" type="button">Copy command</button>
          </div>
        </article>`;
      })
      .join("") +
      (hiddenCount > 0
        ? `<div class="queue-footer">${hiddenCount} more local action${hiddenCount === 1 ? "" : "s"} available in the CLI workspace review.</div>`
        : "");

  renderWorkspaceReviewAction(items);

  workspaceReviewList.querySelectorAll(".open-workspace-action").forEach((button) => {
    button.addEventListener("click", () => {
      const item = visibleItems[Number(button.dataset.reviewIndex)];
      if (!item?.itemId) {
        return;
      }

      state.selectedWorkspaceReviewItemId = item.itemId;
      state.selectedWorkspaceObligationId = item.obligationId;
      addActivity("human", "Opened project queue action", item.title ?? item.itemId, "waiting");
      state.surface = "checks";
      render();
    });
  });
  workspaceReviewList.querySelectorAll(".open-workspace-route").forEach((button) => {
    button.addEventListener("click", () => {
      void openSavedRoute(button.dataset.routeId);
    });
  });
  workspaceReviewList.querySelectorAll(".copy-workspace-command").forEach((button) => {
    button.addEventListener("click", () => {
      const item = visibleItems[Number(button.dataset.reviewIndex)];
      const command = item?.command;
      if (!command) {
        return;
      }

      copyOrDownloadText({
        text: `${command}\n`,
        filename: `truth-harness-project-queue-command-${safeFilenameTimestamp()}.txt`,
        type: "text/plain",
        button,
        copiedTitle: "Copied project queue command",
        copiedDetail: command,
        fallbackTitle: "Downloaded project queue command",
        fallbackDetail: "the project queue command was saved as plain text instead."
      });
    });
  });
  workspaceReviewList.querySelectorAll(".copy-workspace-packet").forEach((button) => {
    button.addEventListener("click", () => {
      const item = visibleItems[Number(button.dataset.reviewIndex)];
      const packet = item?.agentPacket;
      if (!packet) {
        return;
      }

      copyOrDownloadText({
        text: `${packet.trim()}\n`,
        filename: `truth-harness-agent-packet-${safeFilenameTimestamp()}.md`,
        type: "text/markdown",
        button,
        copiedTitle: "Copied project queue packet",
        copiedDetail: item.title ?? "workspace action",
        fallbackTitle: "Downloaded project queue packet",
        fallbackDetail: "the agent handoff packet was saved as markdown instead."
      });
    });
  });
}

function renderWorkspaceReviewAutonomy(autonomy) {
  if (!workspaceReviewAutonomy) {
    return;
  }

  const mode = autonomy.mode ?? "idle";
  const canRun = Boolean(autonomy.canRunUnattended);
  const stopCondition = autonomy.stopConditions?.[0] ?? "Stop when evidence, safety, or review boundaries are unclear.";
  const nextCommand = autonomy.nextCommand ?? "No open local work item.";
  workspaceReviewAutonomy.className = `autonomy-contract-card autonomy-${escapeHtml(mode)}`;
  workspaceReviewAutonomy.innerHTML = `<div class="autonomy-card-head">
    <span class="task-state ${canRun ? "waiting" : "skipped"}"></span>
    <div>
      <strong>${escapeHtml(autonomyModeLabel(mode))}</strong>
      <small>${escapeHtml(canRun ? `local batch up to ${autonomy.suggestedBatchSize ?? 0}` : "waiting for verified local work")}</small>
    </div>
  </div>
  <dl>
    <div><dt>Next</dt><dd><code>${escapeHtml(nextCommand)}</code></dd></div>
    <div><dt>Stop</dt><dd>${escapeHtml(stopCondition)}</dd></div>
  </dl>`;
}

function autonomyModeLabel(mode) {
  if (mode === "local-verifier-loop") {
    return "Local verifier loop";
  }

  if (mode === "human-review-gated") {
    return "Human-review gated";
  }

  return "Idle";
}

function renderWorkspaceReviewAction(items) {
  if (!workspaceReviewAction) {
    return;
  }

  const item = items.find((candidate) => candidate.itemId === state.selectedWorkspaceReviewItemId);
  if (!item) {
    workspaceReviewAction.hidden = true;
    workspaceReviewAction.innerHTML = "";
    state.selectedWorkspaceObligationId = undefined;
    return;
  }

  const receipt = receiptStore.get(state.receiptKey);
  const routeLoaded = Boolean(item.routeId && receipt?.verifierRoute?.routeId === item.routeId);
  const routeActionLabel = routeLoaded ? "Show work order" : "Open route + checks";
  workspaceReviewAction.hidden = false;
  workspaceReviewAction.innerHTML = `<div class="queue-action-head">
    <div>
      <span class="mini-label">${escapeHtml(item.kind ?? "workspace action")}</span>
      <h4>${escapeHtml(item.title ?? "Project queue action")}</h4>
    </div>
    <button class="icon-button close-workspace-action" type="button" aria-label="Close project queue action">x</button>
  </div>
  <p>${escapeHtml(item.summary ?? "")}</p>
  <dl class="queue-action-facts">${workspaceReviewActionFactsHtml(item)}</dl>
  <section class="queue-action-slots">
    <div class="queue-action-subhead">
      <strong>Evidence slots</strong>
      <span class="mini-label">${escapeHtml(workspaceReviewSlotCountText(item))}</span>
    </div>
    ${workspaceReviewEvidenceSlotsHtml(item)}
  </section>
  <details class="queue-packet-preview">
    <summary>Agent packet preview</summary>
    <pre>${escapeHtml(item.agentPacket ?? "")}</pre>
  </details>
  <div class="queue-action-actions">
    ${item.routeId ? `<button class="text-button compact-button open-workspace-action-route" data-testid="workspace-action-route" data-route-id="${escapeHtml(item.routeId)}" type="button">${escapeHtml(routeActionLabel)}</button>` : ""}
    <button class="text-button compact-button copy-workspace-action-packet" type="button">Copy packet</button>
    <button class="text-button compact-button copy-workspace-action-command" type="button">Copy command</button>
  </div>`;

  workspaceReviewAction.querySelector(".close-workspace-action")?.addEventListener("click", () => {
    state.selectedWorkspaceReviewItemId = undefined;
    state.selectedWorkspaceObligationId = undefined;
    render();
  });
  workspaceReviewAction.querySelector(".open-workspace-action-route")?.addEventListener("click", async (event) => {
    const routeId = event.currentTarget.dataset.routeId;
    if (!routeId) {
      return;
    }

    state.selectedWorkspaceObligationId = item.obligationId;
    if (receiptStore.get(state.receiptKey)?.verifierRoute?.routeId === routeId) {
      state.surface = "checks";
      render();
      return;
    }

    await openSavedRoute(routeId);
    state.surface = "checks";
    render();
  });
  workspaceReviewAction.querySelector(".copy-workspace-action-packet")?.addEventListener("click", (event) => {
    if (!item.agentPacket) {
      return;
    }

    copyOrDownloadText({
      text: `${item.agentPacket.trim()}\n`,
      filename: `truth-harness-agent-packet-${safeFilenameTimestamp()}.md`,
      type: "text/markdown",
      button: event.currentTarget,
      copiedTitle: "Copied project queue packet",
      copiedDetail: item.title ?? "workspace action",
      fallbackTitle: "Downloaded project queue packet",
      fallbackDetail: "the agent handoff packet was saved as markdown instead."
    });
  });
  workspaceReviewAction.querySelector(".copy-workspace-action-command")?.addEventListener("click", (event) => {
    if (!item.command) {
      return;
    }

    copyOrDownloadText({
      text: `${item.command}\n`,
      filename: `truth-harness-project-queue-command-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      button: event.currentTarget,
      copiedTitle: "Copied project queue command",
      copiedDetail: item.command,
      fallbackTitle: "Downloaded project queue command",
      fallbackDetail: "the project queue command was saved as plain text instead."
    });
  });
}

function workspaceReviewCountText(summary) {
  const total = Number(summary?.totalItems ?? 0);
  if (total === 0) {
    return "clear";
  }

  const critical = Number(summary?.criticalItems ?? 0);
  const high = Number(summary?.highItems ?? 0);
  if (critical > 0) {
    return `${total} items / ${critical} critical`;
  }

  if (high > 0) {
    return `${total} items / ${high} high`;
  }

  return `${total} items`;
}

function workspaceReviewActionFactsHtml(item) {
  return [
    ["Priority", item.priority],
    ["Trust", item.trust],
    ["Source", workspaceReviewSourceText(item)],
    ["Route", item.routeId],
    ["Obligation", item.obligationId],
    ["Proof declaration", workspaceReviewProofDeclarationText(item)],
    ["Proof attempt", workspaceReviewProofAttemptText(item)],
    ["Proof attempts", workspaceReviewProofAttemptHistoryText(item)],
    ["Proof repair target", workspaceReviewProofRepairTargetText(item)],
    ["Proof repair command", workspaceReviewProofRepairCommandText(item)],
    ["Proof repair evidence", workspaceReviewProofRepairEvidenceText(item)],
    ["Proof source", workspaceReviewProofSourceText(item)],
    ["Proof diagnostic", item.proofAttempt?.diagnosticSnippet],
    ["Claim", item.claimId],
    ["Session", item.sessionId]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
}

function workspaceReviewProofDeclarationText(item) {
  const declaration = item?.proofDeclaration;
  if (!declaration) {
    return "";
  }

  const location = [declaration.path, declaration.line ? `${declaration.line}:${declaration.column ?? 1}` : ""]
    .filter(Boolean)
    .join(":");
  const signatureHash = declaration.signatureSha256 ? `sig ${declaration.signatureSha256.slice(0, 12)}` : "";
  return [declaration.declarationId, declaration.signature, signatureHash, location].filter(Boolean).join(" / ");
}

function workspaceReviewProofAttemptText(item) {
  const proofAttempt = item?.proofAttempt;
  if (!proofAttempt) {
    return "";
  }

  return [proofAttempt.checkId, proofAttempt.status, proofAttempt.sourcePath].filter(Boolean).join(" / ");
}

function workspaceReviewProofAttemptHistoryText(item) {
  const attempts = Array.isArray(item?.proofAttemptHistory) ? item.proofAttemptHistory : [];
  if (attempts.length <= 1) {
    return "";
  }

  return attempts
    .slice(0, 5)
    .map((attempt) =>
      [attempt.checkId, attempt.status, attempt.sourceStatus, attempt.diagnosticSnippet]
        .filter(Boolean)
        .join(" / ")
    )
    .join(" ; ");
}

function workspaceReviewProofRepairTargetText(item) {
  const target = item?.proofRepairTarget;
  if (!target) {
    return "";
  }

  const location = `${target.sourcePath}:${target.markerLine}:${target.markerColumn}`;
  const declaration = target.declarationName ?? target.declarationId;
  const sourceHash = target.sourceSha256 ? `source ${target.sourceSha256.slice(0, 12)}` : "";
  return [target.repairTargetId, target.markerKind, declaration, sourceHash, location].filter(Boolean).join(" / ");
}

function workspaceReviewProofRepairCommandText(item) {
  return item?.proofRepairTarget?.afterEditCommands?.[0] ?? "";
}

function workspaceReviewProofRepairEvidenceText(item) {
  return item?.proofRepairTarget?.evidenceRequired?.join("; ") ?? "";
}

function workspaceReviewProofSourceText(item) {
  const proofAttempt = item?.proofAttempt;
  if (!proofAttempt?.sourceStatus) {
    return "";
  }

  const current = proofAttempt.sourceCurrentSha256 ? ` current ${proofAttempt.sourceCurrentSha256.slice(0, 12)}` : "";
  return `${proofAttempt.sourceStatus}${current}`;
}

function workspaceReviewSlotCountText(item) {
  const slots = Array.isArray(item.evidenceSlots) ? item.evidenceSlots : [];
  if (slots.length === 0) {
    return "no slots";
  }

  const required = slots.filter((slot) => slot.required).length;
  return `${slots.length} slot${slots.length === 1 ? "" : "s"} / ${required} required`;
}

function workspaceReviewEvidenceSlotsHtml(item) {
  const slots = Array.isArray(item.evidenceSlots) ? item.evidenceSlots : [];
  if (slots.length === 0) {
    return `<div class="activity-empty">No explicit evidence slots recorded for this action.</div>`;
  }

  return slots.map((slot) => `<article class="queue-evidence-slot">
    <div class="slot-head">
      <strong>${escapeHtml(slot.label ?? "Evidence slot")}</strong>
      <span class="mini-label">${escapeHtml(slot.status ?? "open")}${slot.required ? " / required" : ""}</span>
    </div>
    <p>${escapeHtml(slot.description ?? "")}</p>
    <small>Accepts: ${escapeHtml((slot.acceptedArtifacts ?? []).join("; ") || "local replayable artifact")}</small>
    <small>Attach to: ${escapeHtml(workspaceReviewSlotTargetText(slot))}</small>
    ${slot.suggestedCommand ? `<code>${escapeHtml(slot.suggestedCommand)}</code>` : ""}
    ${slot.attachCommand ? `<small>Attach command</small><code>${escapeHtml(slot.attachCommand)}</code>` : ""}
  </article>`).join("");
}

function workspaceReviewSlotTargetText(slot) {
  const target = slot?.attachTo;
  if (!target) {
    return "local workspace artifact";
  }

  return [
    target.routeId ? `route:${target.routeId}` : undefined,
    target.obligationId ? `obligation:${target.obligationId}` : undefined,
    target.claimId ? `claim:${target.claimId}` : undefined,
    target.sessionId ? `session:${target.sessionId}` : undefined,
    target.validationPlanId ? `validation:${target.validationPlanId}` : undefined,
    target.validationGateId ? `gate:${target.validationGateId}` : undefined
  ].filter(Boolean).join(" ") || "local workspace artifact";
}

function workspaceReviewItemMeta(item) {
  const parts = [
    item.kind,
    item.trust,
    item.domain
  ].filter(Boolean);
  return parts.join(" - ");
}

function workspaceReviewSourceText(item) {
  const label = item?.source?.label;
  if (!label) {
    return "Source: local workspace review";
  }

  return `Source: ${label}`;
}

function workspaceReviewAcceptanceHtml(item) {
  const criteria = Array.isArray(item.acceptanceCriteria) ? item.acceptanceCriteria : [];
  if (criteria.length === 0) {
    return "";
  }

  const hiddenCount = Math.max(0, criteria.length - 1);
  return `<div class="queue-acceptance">
    <span>Done when</span>
    <p>${escapeHtml(workspaceReviewDoneWhenText(item))}</p>
    ${hiddenCount > 0 ? `<small>+${hiddenCount} more criteria in packet</small>` : ""}
  </div>`;
}

function workspaceReviewDoneWhenText(item) {
  if (item.kind === "route-obligation") {
    return "Obligation satisfied; replayable artifact attached.";
  }

  if (item.kind === "route-ready-claim") {
    return "Narrow claim cites this route without trust upgrade.";
  }

  if (item.kind === "claim-blocker") {
    return "Open check resolved; supporting evidence attached.";
  }

  if (item.kind === "session-task") {
    return "Task updated with linked notes, receipts, or sources.";
  }

  if (item.kind === "session-next-check") {
    return "Checkpoint answered with evidence or a new blocker.";
  }

  return "The local evidence packet satisfies this action.";
}

function routeObligationSummaryText(route) {
  return routeObligationCounts(route).summary;
}

function routeReadiness(route) {
  const obligationCounts = routeObligationCounts(route);
  const strongestTrust = route.strongestRouteTrust ?? strongestRouteTrust(route);
  const ready = typeof route.readyForNarrowClaim === "boolean"
    ? route.readyForNarrowClaim
    : route.status !== "refuted" &&
      strongestTrust !== "unverified" &&
      strongestTrust !== "refuted" &&
      obligationCounts.open === 0;
  const blocking = routeCount(route.blockingObligations) || obligationCounts.open;
  const summary = route.readinessSummary ?? routeReadinessSummary({
    route,
    ready,
    strongestTrust,
    open: obligationCounts.open,
    criticalOpen: obligationCounts.criticalOpen
  });

  return {
    ready,
    strongestTrust,
    open: obligationCounts.open,
    criticalOpen: obligationCounts.criticalOpen,
    blocking,
    summary
  };
}

function strongestRouteTrust(route) {
  const obligations = Array.isArray(route?.proofObligations) ? route.proofObligations : [];
  const trusts = [
    route?.finalTrust,
    ...obligations.flatMap((obligation) => (obligation.satisfiedBy ?? []).map((ref) => ref.trust))
  ].filter(Boolean);

  if (trusts.includes("refuted")) {
    return "refuted";
  }

  for (const trust of ["proved", "cross-checked", "smt-checked", "dimension-checked", "exact-computed", "bounded-numeric", "source-cited", "unverified"]) {
    if (trusts.includes(trust)) {
      return trust;
    }
  }

  return "unverified";
}

function routeReadinessSummary({ route, ready, strongestTrust, open, criticalOpen }) {
  if (route?.status === "refuted" || strongestTrust === "refuted") {
    return "This route is refuted under the recorded assumptions; cite it only as a refutation or supersession input.";
  }

  if (ready) {
    return `Ready only as a narrow ${strongestTrust} claim matching the recorded evidence and limitations.`;
  }

  const plural = open === 1 ? "obligation" : "obligations";
  const criticalText = criticalOpen > 0 ? `, including ${criticalOpen} critical` : "";
  return `Not final: ${open} open ${plural}${criticalText}. Strongest support is ${strongestTrust}.`;
}

function routeObligationCounts(route) {
  const obligations = Array.isArray(route?.proofObligations) ? route.proofObligations : undefined;
  const total = obligations ? obligations.length : routeCount(route?.proofObligations);
  const open = obligations
    ? obligations.filter((obligation) => obligation.status === "open").length
    : routeCount(route?.openProofObligations);
  const satisfied = obligations
    ? obligations.filter((obligation) => obligation.status === "satisfied").length
    : routeCount(route?.satisfiedProofObligations);
  const notRequired = obligations
    ? obligations.filter((obligation) => obligation.status === "not-required").length
    : routeCount(route?.notRequiredProofObligations);
  const criticalOpen = obligations
    ? obligations.filter((obligation) => obligation.status === "open" && obligation.severity === "critical").length
    : routeCount(route?.criticalOpenProofObligations);

  if (total === 0) {
    return {
      total,
      open,
      satisfied,
      notRequired,
      criticalOpen,
      summary: "no obligations"
    };
  }

  let summary;
  if (open > 0) {
    summary = [
      `${open} open`,
      criticalOpen > 0 ? `${criticalOpen} critical` : undefined,
      satisfied > 0 ? `${satisfied} satisfied` : undefined,
      `${total} total`
    ].filter(Boolean).join(" / ");
  } else if (satisfied > 0) {
    summary = [`${satisfied}/${total} satisfied`, notRequired > 0 ? `${notRequired} not required` : undefined].filter(Boolean).join(" / ");
  } else if (notRequired === total) {
    summary = total === 1 ? "1 not required" : `${total} not required`;
  } else {
    summary = `${total} obligations / none open`;
  }

  return {
    total,
    open,
    satisfied,
    notRequired,
    criticalOpen,
    summary
  };
}

function routeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function matchesRouteHistorySearch(route, query) {
  if (!query) {
    return true;
  }

  const readiness = routeReadiness(route);
  return [
    route.routeId,
    route.path,
    route.problem,
    route.finalTrust,
    route.status,
    readiness.ready ? "ready" : "not-ready",
    readiness.strongestTrust,
    readiness.summary,
    route.evidenceKind,
    route.receiptRunId,
    ...(route.usedCapabilities ?? []),
    ...(route.nextActions ?? []),
    route.routePaths?.json,
    route.routePaths?.markdown,
    String(route.proofObligations ?? ""),
    String(route.openProofObligations ?? ""),
    String(route.satisfiedProofObligations ?? ""),
    String(route.notRequiredProofObligations ?? ""),
    String(route.criticalOpenProofObligations ?? ""),
    routeObligationSummaryText(route)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function formatRouteDate(isoTime) {
  if (!isoTime) {
    return "unknown time";
  }

  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return isoTime;
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function refreshRouteLedger({ announce = true } = {}) {
  if (!routeHistoryList || !routeHistoryCount) {
    return;
  }

  try {
    const response = await fetch("/api/routes", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local route ledger API failed.");

    applyRouteLedgerPayload(payload);
    if (announce) {
      addActivity(
        "local-api",
        "Loaded route ledger",
        localApiSuccessMessage(payload, `${routeLedgerStore.size} persisted verifier routes available.`),
        "passed"
      );
    }
    render();
  } catch (error) {
    routeHistoryCount.textContent = "unavailable";
    routeHistoryList.innerHTML = `<div class="activity-empty">Route ledger unavailable from the local API.</div>`;
    addActivity("local-api", "Route ledger unavailable", error instanceof Error ? error.message : "Unknown route ledger failure.", "waiting");
  }
}

async function readLocalApiJson(response, fallbackMessage) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(localApiErrorMessage(payload, fallbackMessage));
  }

  return payload;
}

function localApiErrorMessage(payload, fallbackMessage) {
  const message = typeof payload?.error === "string" && payload.error.trim()
    ? payload.error.trim()
    : fallbackMessage;
  if (payload?.schemaVersion !== "truth-harness.web-error.v0") {
    return message;
  }

  const detailParts = [
    typeof payload.requestId === "string" ? `request ${payload.requestId}` : undefined,
    typeof payload.method === "string" && typeof payload.path === "string" ? `${payload.method} ${payload.path}` : undefined,
    Number.isFinite(payload.status) ? `status ${payload.status}` : undefined
  ].filter(Boolean);

  return detailParts.length > 0 ? `${message} (${detailParts.join("; ")}).` : message;
}

function localApiSuccessMessage(payload, fallbackMessage) {
  return typeof payload?.requestId === "string" && payload.requestId
    ? `${fallbackMessage} (request ${payload.requestId})`
    : fallbackMessage;
}

function applyRouteLedgerPayload(payload) {
  routeLedgerStore.clear();
  for (const route of payload.routes ?? []) {
    if (route?.routeId) {
      routeLedgerStore.set(route.routeId, route);
    }
  }
}

async function refreshResearchSessions({ announce = true } = {}) {
  if (!sessionList) {
    return;
  }

  try {
    const response = await fetch("/api/sessions", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local research session API failed.");

    researchSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
    if (announce) {
      addActivity(
        "local-api",
        "Loaded research sessions",
        localApiSuccessMessage(payload, `${researchSessions.length} local research sessions available.`),
        "passed"
      );
    }
    render();
  } catch (error) {
    researchSessions = [];
    sessionList.innerHTML = `<div class="sidebar-empty">Research sessions unavailable.</div>`;
    addActivity("local-api", "Research sessions unavailable", error instanceof Error ? error.message : "Unknown research session failure.", "waiting");
  }
}

async function refreshWorkspaceReview({ announce = true } = {}) {
  if (!workspaceReviewList || !workspaceReviewCount) {
    return;
  }

  try {
    const response = await fetch("/api/workspace-review", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local workspace review API failed.");

    applyWorkspaceReviewPayload(payload);
    if (announce) {
      addActivity(
        "local-api",
        "Loaded project queue",
        localApiSuccessMessage(payload, `${workspaceReview.summary.totalItems ?? 0} local next actions available.`),
        "passed"
      );
    }
    render();
  } catch (error) {
    workspaceReviewCount.textContent = "unavailable";
    workspaceReviewList.innerHTML = `<div class="activity-empty">Project queue unavailable from the local API.</div>`;
    addActivity("local-api", "Project queue unavailable", error instanceof Error ? error.message : "Unknown workspace review failure.", "waiting");
  }
}

function applyWorkspaceReviewPayload(payload) {
  const fallback = {
    schemaVersion: "truth-harness.workspace-review.v0",
    autonomy: emptyAutonomyContract(),
    summary: {
      totalItems: 0,
      criticalItems: 0,
      highItems: 0,
      mediumItems: 0,
      lowItems: 0
    },
    items: []
  };
  workspaceReview = {
    ...fallback,
    ...(payload.review ?? {}),
    autonomy: payload.review?.autonomy ?? fallback.autonomy
  };
}

async function refreshWorkspaceRunNext({ announce = true } = {}) {
  if (!workspaceRunNextTitle) {
    return;
  }

  try {
    const response = await fetch("/api/workspace-run-next", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local workspace run-next API failed.");
    workspaceRunNextPlan = payload.plan;
    workspaceRunNextError = undefined;
    if (announce) {
      addActivity(
        "local-api",
        "Loaded next safe action",
        localApiSuccessMessage(payload, workspaceRunNextActivitySummary(workspaceRunNextPlan)),
        workspaceRunNextTrust(workspaceRunNextPlan?.status)
      );
    }
    renderWorkspaceRunNext();
  } catch (error) {
    workspaceRunNextPlan = undefined;
    workspaceRunNextError = error instanceof Error ? error.message : "Unknown workspace run-next failure.";
    renderWorkspaceRunNext();
    addActivity("local-api", "Next safe action unavailable", workspaceRunNextError, "waiting");
  }
}

async function saveWorkspaceRunNextHandoffFromUi() {
  if (workspaceRunNextSaving) {
    return;
  }

  workspaceRunNextSaving = true;
  workspaceRunNextError = undefined;
  renderWorkspaceRunNext();

  try {
    const response = await fetch("/api/workspace-run-next", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "workspace-review"
      })
    });
    const payload = await readLocalApiJson(response, "Local workspace run-next save failed.");
    workspaceRunNextPlan = payload.plan;
    workspaceRunNextOpenedError = undefined;
    workspaceRunNextError = undefined;
    addActivity(
      "local-api",
      "Saved revision-backed handoff",
      payload.activity?.[0]?.detail ??
        `${payload.plan?.planId ?? "run-next plan"} saved with source revision ${payload.plan?.sourceRevision?.revisionId ?? "not recorded"}.`,
      workspaceRunNextTrust(payload.plan?.status),
      payload.plan?.createdAt
    );
    void refreshCatalogStatus({ announce: false });
    void refreshWorkspaceEvents({ announce: false });
    await refreshWorkspaceRunNextHandoffs({ announce: false, verifySnapshots: true });
    if (payload.plan?.planId) {
      await openWorkspaceRunNextHandoff(payload.plan.planId);
    }
  } catch (error) {
    workspaceRunNextError = error instanceof Error ? error.message : "Unknown workspace run-next save failure.";
    addActivity("local-api", "Save handoff failed", workspaceRunNextError, "refuted");
  } finally {
    workspaceRunNextSaving = false;
    renderWorkspaceRunNext();
    renderWorkspaceRunNextHandoffs();
  }
}

async function refreshWorkspacePilotLoop({ announce = true } = {}) {
  if (!workspacePilotLoopTitle) {
    return;
  }

  try {
    const params = new URLSearchParams({
      maxSteps: "3"
    });
    const response = await fetch(`/api/workspace-pilot-loop?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local workspace pilot-loop API failed.");
    workspacePilotLoop = payload.loop;
    workspacePilotLoopError = undefined;
    if (announce) {
      addActivity(
        "local-api",
        "Loaded pilot-loop preview",
        localApiSuccessMessage(payload, workspacePilotLoopActivitySummary(workspacePilotLoop)),
        workspacePilotLoopTrust(workspacePilotLoop?.status)
      );
    }
    renderWorkspacePilotLoop();
  } catch (error) {
    workspacePilotLoop = undefined;
    workspacePilotLoopError = error instanceof Error ? error.message : "Unknown workspace pilot-loop failure.";
    renderWorkspacePilotLoop();
    addActivity("local-api", "Pilot-loop preview unavailable", workspacePilotLoopError, "waiting");
  }
}

function refreshWorkspaceRunNextHandoffsIfStale({ maxAgeMs = 5000 } = {}) {
  const neverLoaded = workspaceRunNextSummariesLoadedAt === 0;
  const stale = Date.now() - workspaceRunNextSummariesLoadedAt > maxAgeMs;
  if (!workspaceRunNextSummariesLoading && (neverLoaded || stale)) {
    void refreshWorkspaceRunNextHandoffs({ announce: false });
  }
}

async function refreshWorkspaceRunNextHandoffs({ announce = true, verifySnapshots = false } = {}) {
  if (!workspaceRunNextList) {
    return;
  }
  if (workspaceRunNextSummariesLoading) {
    return;
  }

  workspaceRunNextSummariesLoading = true;
  renderWorkspaceRunNextHandoffs();
  try {
    const params = new URLSearchParams({
      limit: "8"
    });
    if (verifySnapshots) {
      params.set("verifySnapshots", "true");
    }
    const response = await fetch(`/api/workspace-run-nexts?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local saved run-next API failed.");
    workspaceRunNextSummaries = Array.isArray(payload.plans) ? payload.plans : [];
    workspaceRunNextSummariesVerified = Boolean(payload.verifySnapshots);
    workspaceRunNextSummariesError = undefined;
    workspaceRunNextSummariesLoadedAt = Date.now();
    if (announce) {
      addActivity(
        "local-api",
        verifySnapshots ? "Verified saved handoffs" : "Loaded saved handoffs",
        localApiSuccessMessage(payload, `${workspaceRunNextSummaries.length} saved run-next intent packet${workspaceRunNextSummaries.length === 1 ? "" : "s"} loaded.`),
        "passed"
      );
    }
  } catch (error) {
    workspaceRunNextSummaries = [];
    workspaceRunNextSummariesVerified = false;
    workspaceRunNextSummariesError = error instanceof Error ? error.message : "Unknown saved run-next failure.";
    workspaceRunNextSummariesLoadedAt = Date.now();
    addActivity("local-api", "Saved handoffs unavailable", workspaceRunNextSummariesError, "waiting");
  } finally {
    workspaceRunNextSummariesLoading = false;
    renderWorkspaceRunNextHandoffs();
  }
}

async function openWorkspaceRunNextHandoff(planRef, { verifySnapshot = false } = {}) {
  const ref = String(planRef ?? "").trim();
  if (!ref) {
    return;
  }

  workspaceRunNextOpenedError = undefined;
  const verifyParam = verifySnapshot ? "?verifySnapshot=true" : "";
  addActivity(
    "web-ui",
    verifySnapshot ? "Verifying saved handoff" : "Opening saved handoff",
    `GET /api/workspace-run-nexts/${ref}${verifyParam}`,
    "waiting"
  );
  try {
    const response = await fetch(`/api/workspace-run-nexts/${encodeURIComponent(ref)}${verifyParam}`, {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local saved run-next inspection failed.");
    workspaceRunNextOpenedInspection = payload.inspection;
    workspaceRunNextPlan = payload.inspection?.plan ?? workspaceRunNextPlan;
    workspaceRunNextError = undefined;
    addActivity(
      "local-api",
      verifySnapshot ? "Verified saved handoff" : "Opened saved handoff",
      localApiSuccessMessage(
        payload,
        workspaceRunNextOpenedInspection?.resumeDecision?.reason ??
          (verifySnapshot ? `${ref} opened with snapshot drift status.` : `${ref} opened for fast reading; verify before resuming agent work.`)
      ),
      workspaceRunNextOpenedInspection?.resumeDecision?.safeToResume ? "passed" : "waiting"
    );
    render();
  } catch (error) {
    workspaceRunNextOpenedError = error instanceof Error ? error.message : "Unknown saved run-next inspection failure.";
    renderWorkspaceRunNextHandoffs();
    addActivity("local-api", "Open handoff failed", workspaceRunNextOpenedError, "refuted");
  }
}

async function startResearchHarnessFromUi() {
  const currentReceipt = receiptStore.get(state.receiptKey);
  const objective = promptInput?.value?.trim() || currentReceipt?.title?.trim();
  if (!objective) {
    addActivity("web-ui", "Harness objective missing", "Type a problem in the prompt or select a receipt before starting a hard-problem harness.", "waiting");
    return;
  }

  const cleanObjective = objective.replace(/(?:^|\s)#[a-z0-9][a-z0-9-]{1,40}/giu, " ").replace(/\s+/gu, " ").trim() || objective;
  const lane = state.lane ?? "math";
  const promptTags = extractPromptTags(objective);
  const domains = [
    ...new Set([
      researchHarnessDomainByLane[lane] ?? "general",
      ...promptTags
        .map((tag) => researchHarnessDomainByLane[tag])
        .filter(Boolean)
    ])
  ];
  const claims = currentReceipt?.title ? [currentReceipt.title] : [cleanObjective];

  if (startResearchHarnessButton) {
    startResearchHarnessButton.disabled = true;
    startResearchHarnessButton.textContent = "Starting";
  }
  addActivity("web-ui", "Starting research harness", "POST /api/research-harness will write a local session, validation plan, and first dry-run handoff.", "waiting");

  try {
    const response = await fetch("/api/research-harness", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        objective: cleanObjective,
        domains,
        claims,
        validationClaim: claims[0],
        planNext: true
      })
    });
    const payload = await readLocalApiJson(response, "Local research harness API failed.");
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, localApiSuccessMessage(payload, item.detail), "passed", item.at);
    }
    if (payload.runNext?.plan) {
      workspaceRunNextPlan = payload.runNext.plan;
      workspaceRunNextError = undefined;
    }
    await refreshResearchSessions({ announce: false });
    await refreshWorkspaceReview({ announce: false });
    await refreshWorkspaceRunNext({ announce: false });
    await refreshWorkspaceRunNextHandoffs({ announce: false });
    await refreshWorkspaceGraph({ announce: false });
    await refreshWorkspaceReadiness({ announce: false });
    await refreshWorkspaceEvents({ announce: false });
    state.surface = "runbook";
    render();
  } catch (error) {
    addActivity("local-api", "Research harness failed", error instanceof Error ? error.message : "Unknown research harness failure.", "refuted");
  } finally {
    if (startResearchHarnessButton) {
      startResearchHarnessButton.disabled = false;
      startResearchHarnessButton.textContent = "Start harness";
    }
  }
}

async function seedHardMathWorkspaceFromUi({
  preset = "all",
  button = seedHardMathButton,
  idleLabel = "Seed hard math",
  pendingLabel = "Seeding",
  activityTitle = "Seeding hard-math workspace",
  failureTitle = "Hard-math seed failed"
} = {}) {
  if (button) {
    button.disabled = true;
    button.textContent = pendingLabel;
  }
  addActivity(
    "web-ui",
    activityTitle,
    preset === "professor-challenge"
      ? "POST /api/workspace-seed/hard-math will write the five-case professor challenge and a dry-run run-next handoff."
      : "POST /api/workspace-seed/hard-math will write local validation sessions and a dry-run run-next handoff.",
    "waiting"
  );

  try {
    const response = await fetch("/api/workspace-seed/hard-math", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        preset,
        writeRunNextPlan: true
      })
    });
    const payload = await readLocalApiJson(response, "Local hard-math seed API failed.");
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, localApiSuccessMessage(payload, item.detail), "passed", item.at);
    }
    if (payload.seed?.runNext?.plan) {
      workspaceRunNextPlan = payload.seed.runNext.plan;
      workspaceRunNextError = undefined;
    }
    if (payload.seed?.preset === "professor-challenge") {
      professorChallengeSeed = payload.seed;
    }
    await refreshResearchSessions({ announce: false });
    await refreshWorkspaceReview({ announce: false });
    await refreshWorkspaceRunNext({ announce: false });
    await refreshWorkspacePilotLoop({ announce: false });
    await refreshWorkspaceRunNextHandoffs({ announce: false });
    await refreshWorkspaceGraph({ announce: false });
    await refreshWorkspaceReadiness({ announce: false });
    await refreshWorkspaceEvents({ announce: false });
    state.surface = "runbook";
    render();
  } catch (error) {
    addActivity("local-api", failureTitle, error instanceof Error ? error.message : "Unknown hard-math seed failure.", "refuted");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = idleLabel;
    }
  }
}

async function refreshLatestProfessorChallengeSeed({ announce = true } = {}) {
  try {
    const params = new URLSearchParams({ preset: "professor-challenge" });
    const response = await fetch(`/api/workspace-seed/hard-math/latest?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Latest professor challenge seed API failed.");
    if (payload.seed?.preset === "professor-challenge") {
      professorChallengeSeed = payload.seed;
      if (announce) {
        addActivity(
          "local-api",
          "Loaded professor challenge",
          `${payload.seed.cases?.length ?? 0} persisted professor challenge cases restored from ${payload.seed.paths?.json ?? ".truth-harness/findings"}.`,
          "passed",
          payload.seed.createdAt
        );
      }
      return payload.seed;
    }
    if (announce) {
      addActivity(
        "local-api",
        "No professor challenge seed",
        "No persisted professor challenge seed is available yet. Start the challenge to create local validation sessions and a run-next handoff.",
        "waiting"
      );
    }
    render();
    return undefined;
  } catch (error) {
    if (announce) {
      addActivity(
        "local-api",
        "Professor challenge unavailable",
        error instanceof Error ? error.message : "No persisted professor challenge seed could be loaded.",
        "waiting"
      );
    }
    return undefined;
  }
}

async function refreshWorkspaceGraph({ announce = true } = {}) {
  try {
    const response = await fetch("/api/workspace-graph", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local workspace graph API failed.");
    applyWorkspaceGraphPayload(payload);
    if (announce) {
      addActivity(
        "local-api",
        "Loaded workspace graph",
        localApiSuccessMessage(payload, `${workspaceGraph.summary?.nodes ?? 0} nodes / ${workspaceGraph.summary?.edges ?? 0} edges mapped.`),
        "passed"
      );
    }
    render();
  } catch (error) {
    applyWorkspaceGraphPayload({});
    addActivity("local-api", "Workspace graph unavailable", error instanceof Error ? error.message : "Unknown workspace graph failure.", "waiting");
  }
}

function applyWorkspaceGraphPayload(payload) {
  workspaceGraph = payload.graph ?? {
    schemaVersion: "truth-harness.workspace-graph.v0",
    nodes: [],
    edges: [],
    summary: {
      nodes: 0,
      edges: 0,
      missingRefs: 0
    },
    validation: {
      passed: true,
      errors: 0,
      warnings: 0,
      issues: []
    },
    warnings: []
  };
}

async function refreshCasChecks({ announce = true } = {}) {
  try {
    const response = await fetch("/api/cas", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local CAS ledger API failed.");

    applyCasCheckPayload(payload);
    if (announce) {
      addActivity(
        "local-api",
        "Loaded CAS ledger",
        localApiSuccessMessage(payload, `${casCheckStore.size} local CAS check records available.`),
        "passed"
      );
    }
    render();
  } catch (error) {
    if (casArtifactCount) {
      casArtifactCount.textContent = "CAS unavailable";
    }
    if (casArtifactList) {
      casArtifactList.innerHTML = `<div class="activity-empty">CAS artifact ledger unavailable from the local API.</div>`;
    }
    addActivity("local-api", "CAS ledger unavailable", error instanceof Error ? error.message : "Unknown CAS ledger failure.", "waiting");
  }
}

function applyCasCheckPayload(payload) {
  casCheckStore.clear();
  for (const check of payload.checks ?? []) {
    if (check?.checkId) {
      casCheckStore.set(check.checkId, check);
    }
  }
}

async function refreshSmtChecks({ announce = true } = {}) {
  try {
    const response = await fetch("/api/smt", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local SMT ledger API failed.");

    applySmtCheckPayload(payload);
    if (announce) {
      addActivity(
        "local-api",
        "Loaded SMT ledger",
        localApiSuccessMessage(payload, `${smtCheckStore.size} local SMT check records available.`),
        "passed"
      );
    }
    render();
  } catch (error) {
    if (casArtifactCount) {
      casArtifactCount.textContent = "evidence unavailable";
    }
    if (casArtifactList) {
      casArtifactList.innerHTML = `<div class="activity-empty">Evidence attachment ledger unavailable from the local API.</div>`;
    }
    addActivity("local-api", "SMT ledger unavailable", error instanceof Error ? error.message : "Unknown SMT ledger failure.", "waiting");
  }
}

function applySmtCheckPayload(payload) {
  smtCheckStore.clear();
  for (const check of payload.checks ?? []) {
    if (check?.checkId) {
      smtCheckStore.set(check.checkId, check);
    }
  }
}

async function openSavedRoute(routeId) {
  if (!routeId) {
    return;
  }

  addActivity("human", "Opening saved verifier route", routeId, "waiting");

  try {
    const response = await fetch(`/api/routes/${encodeURIComponent(routeId)}`, {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local verifier route read failed.");

    const viewModel = receiptToViewModel(payload.route.receipt, payload.route, payload.routePaths);
    const key = payload.route.receipt.runId;
    receiptStore.set(key, viewModel);
    promoteRecentReceiptKey(key);
    setReplayPlaying(false);
    state.receiptKey = key;
    state.level = "middle";
    state.selectedGraphIndex = 0;
    state.replayIndex = 0;
    promptInput.value = viewModel.title;
    updateLatestActivity(
      "Opening saved verifier route",
      "passed",
      localApiSuccessMessage(payload, `${payload.route.routeId} loaded from .truth-harness/routes.`)
    );
    render();
  } catch (error) {
    updateLatestActivity("Opening saved verifier route", "refuted", error instanceof Error ? error.message : "Unknown verifier route read failure.");
  }
}

async function runCasForObligation(button) {
  const receipt = receiptStore.get(state.receiptKey);
  const routeId = button.dataset.routeId;
  const obligationId = button.dataset.obligationId;
  if (!receipt || !routeId || !obligationId) {
    return;
  }

  const operation = casOperationForReceipt(receipt);
  const expression = casExpressionForReceipt(receipt);
  const result = casResultForReceipt(receipt);
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Running";
  addActivity("human", "Requested CAS check", `${operation} ${expression} -> ${result}`, "waiting");

  try {
    const response = await fetch("/api/cas/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        operation,
        expression,
        result,
        variable: "x"
      })
    });
    const payload = await readLocalApiJson(response, "Local CAS check failed.");

    applyCasCheckPayload(payload);
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, payload.record?.trust === "cross-checked" ? "passed" : "waiting", item.at);
    }

    if (payload.record?.trust !== "cross-checked") {
      addActivity(
        "local-api",
        "CAS obligation still open",
        `${payload.record?.checkId ?? "CAS check"} returned ${payload.record?.status ?? "unknown"} and cannot satisfy the route.`,
        "waiting"
      );
      render();
      return;
    }

    await attachEvidenceToRoute({
      routeId,
      obligationId,
      evidenceRef: {
        kind: "cas",
        ref: relativeArtifactRef(payload.paths?.json),
        trust: payload.record.trust,
        summary: `CAS ${payload.record.status}: ${payload.record.operation} ${payload.record.expression} -> ${payload.record.result}`
      }
    });
  } catch (error) {
    addActivity("local-api", "CAS check failed", error instanceof Error ? error.message : "Unknown CAS check failure.", "refuted");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function runSmtForObligation(button) {
  const receipt = receiptStore.get(state.receiptKey);
  const routeId = button.dataset.routeId;
  const obligationId = button.dataset.obligationId;
  if (!receipt || !routeId || !obligationId) {
    return;
  }

  const draft = smtProblemDraftForReceipt(receipt);
  if (!draft) {
    addActivity(
      "web-ui",
      "SMT draft unavailable",
      "The current claim does not contain explicit integer constraints the local SMT builder can encode.",
      "waiting"
    );
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Running";
  addActivity("human", "Requested SMT check", draft.constraints.join("; "), "waiting");

  try {
    const response = await fetch("/api/smt/solve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(draft)
    });
    const payload = await readLocalApiJson(response, "Local SMT check failed.");

    applySmtCheckPayload(payload);
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, payload.record?.trust === "smt-checked" ? "passed" : "waiting", item.at);
    }

    if (payload.record?.trust !== "smt-checked") {
      addActivity(
        "local-api",
        "SMT obligation still open",
        `${payload.record?.checkId ?? "SMT check"} returned ${payload.record?.status ?? "unknown"} and cannot satisfy the route.`,
        "waiting"
      );
      render();
      return;
    }

    await attachEvidenceToRoute({
      routeId,
      obligationId,
      evidenceRef: {
        kind: "smt",
        ref: relativeArtifactRef(payload.paths?.json),
        trust: payload.record.trust,
        summary: `SMT ${payload.record.status}: ${draft.constraints.join("; ")}`
      }
    });
  } catch (error) {
    addActivity("local-api", "SMT check failed", error instanceof Error ? error.message : "Unknown SMT check failure.", "refuted");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function attachEvidenceToRoute(input) {
  if (!input.routeId || !input.obligationId || !input.evidenceRef?.ref) {
    return;
  }

  const label = input.evidenceRef.kind === "smt" ? "SMT" : input.evidenceRef.kind === "cas" ? "CAS" : "local";
  addActivity("web-ui", `Attaching ${label} evidence`, `${input.evidenceRef.ref} -> ${input.obligationId}`, "waiting");

  try {
    const response = await fetch(`/api/routes/${encodeURIComponent(input.routeId)}/obligations/${encodeURIComponent(input.obligationId)}/satisfy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        evidenceRef: input.evidenceRef
      })
    });
    const payload = await readLocalApiJson(response, "Route obligation satisfaction failed.");

    applyRouteLedgerPayload(payload);
    syncRouteIntoReceipts(payload.route, payload.routePaths);
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    await refreshWorkspaceReview({ announce: false });
    await refreshWorkspaceRunNext({ announce: false });
    await refreshWorkspaceGraph({ announce: false });
    await refreshWorkspaceReadiness({ announce: false });
    await refreshWorkspaceEvents({ announce: false });
    render();
  } catch (error) {
    addActivity("local-api", `${label} attach rejected`, error instanceof Error ? error.message : "Unknown route satisfaction failure.", "refuted");
  }
}

async function copyObligationCommand(button) {
  const command = button.dataset.command;
  if (!command) {
    return;
  }

  await copyOrDownloadText({
    text: `${command}\n`,
    filename: `truth-harness-verifier-command-${safeFilenameTimestamp()}.txt`,
    type: "text/plain",
    button,
    copiedTitle: "Copied verifier command",
    copiedDetail: command,
    fallbackTitle: "Downloaded verifier command",
    fallbackDetail: "the verifier command was saved as plain text instead."
  });
}

function syncRouteIntoReceipts(route, routePaths) {
  if (!route?.routeId) {
    return;
  }

  for (const receipt of receiptStore.values()) {
    if (receipt.verifierRoute?.routeId === route.routeId || receipt.runId === route.receipt?.runId) {
      const obligationCounts = routeObligationCounts(route);
      receipt.verifierRoute = route;
      receipt.routePaths = routePaths ?? receipt.routePaths;
      receipt.details["Route status"] = route.status;
      receipt.details["Route gaps"] = String(route.gaps?.length ?? 0);
      receipt.details["Proof obligations"] = obligationCounts.summary;
      receipt.details["Open obligations"] = String(obligationCounts.open);
    }
  }
}

function relativeArtifactRef(path) {
  if (!path) {
    return "";
  }

  const marker = ".truth-harness";
  const index = path.indexOf(marker);
  return index >= 0 ? path.slice(index) : path;
}

async function refreshClaimLedger({ announce = true } = {}) {
  try {
    const response = await fetch("/api/claims", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local claim ledger API failed.");

    applyClaimLedgerPayload(payload);
    if (announce) {
      addActivity(
        "local-api",
        "Loaded claim ledger",
        localApiSuccessMessage(payload, `${claimLedgerStore.size} local claim records available.`),
        "passed"
      );
    }
    render();
  } catch (error) {
    claimLedgerCount.textContent = "unavailable";
    claimLedgerList.innerHTML = `<div class="activity-empty">Claim ledger unavailable from the local API.</div>`;
    addActivity("local-api", "Claim ledger unavailable", error instanceof Error ? error.message : "Unknown claim ledger failure.", "waiting");
  }
}

async function ensureClaimReviewPacket(claimId) {
  if (!claimId || claimReviewPacketStore.has(claimId) || claimReviewPacketLoading.has(claimId) || claimReviewPacketErrors.has(claimId)) {
    return;
  }

  claimReviewPacketLoading.add(claimId);
  claimReviewPacketErrors.delete(claimId);
  try {
    const response = await fetch(`/api/claims/${encodeURIComponent(claimId)}/review`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readLocalApiJson(response, "Local claim review packet failed.");
    if (payload.review?.claimId) {
      claimReviewPacketStore.set(payload.review.claimId, payload.review);
    }
  } catch (error) {
    claimReviewPacketErrors.set(claimId, error instanceof Error ? error.message : "Unknown claim review packet failure.");
  } finally {
    claimReviewPacketLoading.delete(claimId);
    render();
  }
}

function applyClaimLedgerPayload(payload) {
  claimLedgerStore.clear();
  const activeClaimIds = new Set();
  for (const claim of payload.claims ?? []) {
    if (claim?.claimId) {
      claimLedgerStore.set(claim.claimId, claim);
      activeClaimIds.add(claim.claimId);
    }
  }

  for (const claimId of claimReviewPacketStore.keys()) {
    if (!activeClaimIds.has(claimId)) {
      claimReviewPacketStore.delete(claimId);
      claimReviewPacketLoading.delete(claimId);
      claimReviewPacketErrors.delete(claimId);
    }
  }

  claimLedgerGraph = payload.graph ?? {
    schemaVersion: "truth-harness.claim-graph.v0",
    nodes: [],
    edges: [],
    warnings: []
  };
  linkClaimLedgerToReceipts();
}

async function refreshResearchMap({ announce = true } = {}) {
  try {
    const response = await fetch("/api/research-map", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local research map API failed.");
    applyResearchMapPayload(payload);
    if (announce) {
      const count = researchMap.snapshotCount ?? researchMap.snapshots?.length ?? 0;
      addActivity(
        "local-api",
        "Loaded research map",
        localApiSuccessMessage(payload, `${count} saved map snapshot${count === 1 ? "" : "s"} available.`),
        "passed"
      );
    }
    render();
  } catch (error) {
    if (researchMapStatus) {
      researchMapStatus.textContent = "map ledger unavailable";
    }
    if (researchMapList) {
      researchMapList.innerHTML = `<div class="activity-empty">Saved maps unavailable from the local API.</div>`;
    }
    addActivity("local-api", "Research map unavailable", error instanceof Error ? error.message : "Unknown research map failure.", "waiting");
  }
}

async function refreshVisualArtifacts({ announce = true } = {}) {
  try {
    const response = await fetch("/api/visuals", {
      method: "GET",
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local visual artifact API failed.");
    applyVisualArtifactsPayload(payload);
    if (announce) {
      addActivity(
        "local-api",
        "Loaded visual artifacts",
        localApiSuccessMessage(payload, `${visualArtifacts.length} saved visual artifact${visualArtifacts.length === 1 ? "" : "s"} available.`),
        "passed"
      );
    }
    render();
  } catch (error) {
    if (visualArtifactList) {
      visualArtifactList.innerHTML = `<div class="activity-empty">Saved visual artifacts unavailable from the local API.</div>`;
    }
    addActivity("local-api", "Visual artifacts unavailable", error instanceof Error ? error.message : "Unknown visual artifact failure.", "waiting");
  }
}

async function openVisualArtifact(visualId, options = {}) {
  const response = await fetch(`/api/visuals/${encodeURIComponent(visualId)}`, {
    method: "GET",
    cache: "no-store"
  });
  const payload = await readLocalApiJson(response, "Local visual artifact API failed.");
  applyVisualArtifactsPayload(payload);
  let selectedPayload = payload;
  let preferredSourceVisualId;
  if (options.preferRendered !== false) {
    const renderedSummary = renderedVisualSummaryForSourceArtifact(payload.visual);
    if (renderedSummary?.visualId) {
      preferredSourceVisualId = payload.visual?.visualId;
      const renderedResponse = await fetch(`/api/visuals/${encodeURIComponent(renderedSummary.visualId)}`, {
        method: "GET",
        cache: "no-store"
      });
      selectedPayload = await readLocalApiJson(renderedResponse, "Local rendered visual artifact API failed.");
      applyVisualArtifactsPayload(selectedPayload);
    }
  }

  state.selectedVisualArtifactId = selectedPayload.visual?.visualId;
  state.selectedResearchMapSnapshotId = undefined;
  state.selectedResearchMapNodeId = undefined;
  state.surface = "plot";
  requestVisualFit();
  addActivity(
    "human",
    "Opened visual artifact",
    preferredSourceVisualId
      ? `${preferredSourceVisualId} has rendered SVG ${selectedPayload.visual?.visualId ?? "available"}; opened the engine-rendered artifact.`
      : `${selectedPayload.visual?.visualId ?? visualId} loaded from .truth-harness/visuals.`,
    "passed"
  );
  render();
  resetActiveSurfaceScroll();
}

async function renderSelectedVisualArtifact() {
  const visualRef = state.selectedVisualArtifactId;
  if (!visualRef) {
    return;
  }

  const engine = selectedVisualRenderEngine(selectedVisualArtifactRecord);
  if (!engine) {
    addActivity("web-ui", "Visual render unavailable", `${visualRef} does not expose a supported renderer source.`, "waiting");
    return;
  }

  if (renderVisualArtifactButton) {
    renderVisualArtifactButton.disabled = true;
    renderVisualArtifactButton.textContent = "Rendering";
  }
  addActivity("web-ui", "Rendering visual artifact", `POST /api/visuals/render for ${visualRef} with ${engine}`, "waiting");

  try {
    const response = await fetch("/api/visuals/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        visualRef,
        engine
      })
    });
    const payload = await readLocalApiJson(response, "Local visual render API failed.");
    applyVisualArtifactsPayload(payload);
    state.selectedVisualArtifactId = payload.visual?.visualId;
    state.selectedResearchMapSnapshotId = undefined;
    state.selectedResearchMapNodeId = undefined;
    requestVisualFit();
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    updateLatestActivity("Rendering visual artifact", "passed", `${visualRef} rendered into ${payload.visual?.visualId ?? "new SVG visual"}.`);
    render();
    resetActiveSurfaceScroll();
  } catch (error) {
    updateLatestActivity("Rendering visual artifact", "refuted", "POST /api/visuals/render failed");
    addActivity("local-api", "Visual render failed", error instanceof Error ? error.message : "Unknown visual render failure.", "refuted");
  } finally {
    if (renderVisualArtifactButton) {
      renderVisualArtifactButton.disabled = false;
      renderVisualArtifactButton.textContent = selectedVisualRenderEngine(selectedVisualArtifactRecord) === "plotly"
        ? "Render plot SVG"
        : "Render SVG";
    }
  }
}

function applyResearchMapPayload(payload) {
  researchMap = payload.map ?? researchMap;
  const snapshots = researchMap.snapshots ?? [];
  if (state.selectedResearchMapSnapshotId && !snapshots.some((snapshot) => snapshot.snapshotId === state.selectedResearchMapSnapshotId)) {
    state.selectedResearchMapSnapshotId = undefined;
    state.selectedResearchMapNodeId = undefined;
  }
}

function applyVisualArtifactsPayload(payload) {
  visualArtifacts = Array.isArray(payload.visuals) ? payload.visuals : visualArtifacts;
  if (payload.visual?.visualId) {
    selectedVisualArtifactRecord = payload.visual;
  }
  if (state.selectedVisualArtifactId && !visualArtifacts.some((artifact) => artifact.visualId === state.selectedVisualArtifactId)) {
    state.selectedVisualArtifactId = undefined;
    selectedVisualArtifactRecord = undefined;
  }
}

function linkClaimLedgerToReceipts() {
  for (const receipt of receiptStore.values()) {
    if (receipt.claimId && !claimLedgerStore.has(receipt.claimId)) {
      delete receipt.claimId;
    }
  }

  for (const claim of claimLedgerStore.values()) {
    for (const ref of claim.evidenceRefs ?? []) {
      for (const receipt of receiptStore.values()) {
        if (evidenceRefMatchesReceipt(ref, receipt) && !receipt.claimId) {
          receipt.claimId = claim.claimId;
        }
      }
    }
  }
}

function evidenceRefMatchesReceipt(ref, receipt) {
  if (!ref || typeof ref.ref !== "string") {
    return false;
  }

  if (ref.ref.startsWith("local-web-receipt:")) {
    return receipt.runId === ref.ref.slice("local-web-receipt:".length);
  }

  if (ref.ref.startsWith("receipt:")) {
    return receipt.runId === ref.ref.slice("receipt:".length);
  }

  return receipt.receiptPaths?.ref === ref.ref
    || receipt.receiptPaths?.json === ref.ref
    || ref.ref.endsWith(`/${receipt.runId}.json`)
    || ref.ref.endsWith(`\\${receipt.runId}.json`)
    || ref.ref.includes(`${receipt.runId}.json`);
}

function receiptKeyForClaimId(claimId) {
  for (const [key, receipt] of receiptStore.entries()) {
    if (receipt.claimId === claimId) {
      return key;
    }
  }

  return undefined;
}

function receiptKeyForRunId(runId) {
  for (const [key, receipt] of receiptStore.entries()) {
    if (receipt.runId === runId) {
      return key;
    }
  }

  return undefined;
}

function promoteRecentReceiptKey(key) {
  const existingIndex = recentReceiptKeys.indexOf(key);
  if (existingIndex >= 0) {
    recentReceiptKeys.splice(existingIndex, 1);
  }
  recentReceiptKeys.unshift(key);
  recentReceiptKeys.splice(6);
}

function updateClaimRecordButtons(receipt) {
  if (!recordClaimButton || !recordChainButton || !receipt) {
    return;
  }

  const recorded = Boolean(receipt.claimId);
  const chainState = claimChainState(receipt);
  recordClaimButton.disabled = recorded;
  recordClaimButton.textContent = recorded ? "Claim recorded" : "Record claim";
  recordClaimButton.title = recorded
    ? `${receipt.claimId} is already stored in the local claim ledger.`
    : "Write this receipt into the local claim ledger.";

  recordChainButton.disabled = !chainState.needsWork;
  recordChainButton.textContent = chainState.label;
  recordChainButton.title = chainState.detail;
}

async function recordCurrentClaim() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt || receipt.claimId) {
    updateClaimRecordButtons(receipt);
    return;
  }

  recordClaimButton.disabled = true;
  recordClaimButton.textContent = "Recording";
  addActivity("human", "Recording claim", `${receipt.title} is being written to the local claim ledger.`, "waiting");

  try {
    const workspaceReceipt = await ensureWorkspaceReceiptRef(receipt);
    const response = await fetch("/api/claims", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(createClaimLedgerPayload(workspaceReceipt))
    });
    const payload = await readLocalApiJson(response, "Local claim ledger write failed.");

    applyClaimLedgerPayload(payload);
    receipt.claimId = payload.claim.claimId;
    updateLatestActivity(
      "Recording claim",
      "passed",
      localApiSuccessMessage(payload, `${payload.claim.claimId} written to .truth-harness/claims.`)
    );
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    await refreshWorkspaceReview({ announce: false });
    await refreshWorkspaceRunNext({ announce: false });
    await refreshWorkspaceGraph({ announce: false });
    await refreshWorkspaceReadiness({ announce: false });
    await refreshWorkspaceEvents({ announce: false });
  } catch (error) {
    updateLatestActivity("Recording claim", "refuted", error instanceof Error ? error.message : "Unknown claim ledger failure.");
  } finally {
    render();
  }
}

async function recordCurrentChain() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  recordChainButton.disabled = true;
  recordChainButton.textContent = "Recording chain";
  addActivity("human", "Recording claim chain", `${receipt.title} and its upstream subclaims are being written to the local claim ledger.`, "waiting");

  try {
    const claimId = await recordReceiptChain(state.receiptKey, {
      reviseExisting: true,
      visited: new Set()
    });
    await refreshWorkspaceReview({ announce: false });
    await refreshWorkspaceRunNext({ announce: false });
    await refreshWorkspaceGraph({ announce: false });
    await refreshWorkspaceReadiness({ announce: false });
    await refreshWorkspaceEvents({ announce: false });
    updateLatestActivity("Recording claim chain", "passed", `${claimId} is now linked to recorded upstream claims.`);
  } catch (error) {
    updateLatestActivity("Recording claim chain", "refuted", error instanceof Error ? error.message : "Unknown claim chain failure.");
  } finally {
    render();
  }
}

async function recordReceiptChain(key, options) {
  if (options.visited.has(key)) {
    throw new Error(`Circular receipt dependency detected at ${key}.`);
  }

  options.visited.add(key);
  const receipt = receiptStore.get(key);
  if (!receipt) {
    throw new Error(`Receipt dependency not found: ${key}.`);
  }

  const dependencyClaimIds = [];
  for (const dependencyKey of receiptDependencies(receipt)) {
    dependencyClaimIds.push(await recordReceiptChain(dependencyKey, {
      reviseExisting: true,
      visited: options.visited
    }));
  }
  options.visited.delete(key);

  const existingClaim = receipt.claimId ? claimLedgerStore.get(receipt.claimId) : undefined;
  const missingLinks = dependencyClaimIds.filter((claimId) => !existingClaim?.dependsOn?.includes(claimId));
  if (receipt.claimId && (!options.reviseExisting || missingLinks.length === 0)) {
    return receipt.claimId;
  }

  const supersedes = receipt.claimId && missingLinks.length > 0 ? [receipt.claimId] : [];
  const result = await writeReceiptClaim(receipt, {
    dependsOn: dependencyClaimIds,
    supersedes,
    activityTitle: supersedes.length > 0 ? "Revised linked claim" : "Recorded linked claim"
  });

  return result.claim.claimId;
}

async function writeReceiptClaim(receipt, { dependsOn = undefined, supersedes = [], activityTitle = "Recorded claim" } = {}) {
  const workspaceReceipt = await ensureWorkspaceReceiptRef(receipt);
  const response = await fetch("/api/claims", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(createClaimLedgerPayload(workspaceReceipt, {
      dependsOn,
      supersedes
    }))
  });
  const payload = await readLocalApiJson(response, "Local claim ledger write failed.");

  applyClaimLedgerPayload(payload);
  receipt.claimId = payload.claim.claimId;
  addActivity(
    "local-api",
    activityTitle,
    localApiSuccessMessage(payload, `${payload.claim.claimId} stored with ${payload.claim.dependsOn.length} upstream links.`),
    "passed",
    payload.claim.createdAt
  );
  for (const item of payload.activity ?? []) {
    addActivity(item.actor, item.action, item.detail, "passed", item.at);
  }

  return payload;
}

async function ensureWorkspaceReceiptRef(receipt) {
  if (receipt.receiptPaths?.ref) {
    return receipt;
  }

  addActivity("local-api", "Persisting receipt evidence", `${receipt.runId} needs a workspace receipt file before it can support a claim.`, "waiting");
  const response = await fetch("/api/receipt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ problem: receipt.title })
  });
  const payload = await readLocalApiJson(response, "Local receipt persistence failed.");

  receipt.receiptPaths = payload.receiptPaths;
  receipt.verifierRoute = receipt.verifierRoute ?? payload.route;
  receipt.routePaths = receipt.routePaths ?? payload.routePaths;
  addActivity(
    "local-api",
    "Persisted receipt evidence",
    localApiSuccessMessage(payload, `${payload.receipt?.runId ?? receipt.runId} saved to ${payload.receiptPaths?.ref ?? ".truth-harness/receipts"}.`),
    payload.receipt?.trust === "refuted" ? "refuted" : payload.receipt?.trust === "unverified" ? "waiting" : "passed"
  );
  for (const item of payload.activity ?? []) {
    addActivity(item.actor, item.action, item.detail, "passed", item.at);
  }

  return receipt;
}

function claimChainState(receipt) {
  const dependencyKeys = receiptDependencies(receipt);
  const dependencyClaimIds = dependencyKeys
    .map((key) => receiptStore.get(key)?.claimId)
    .filter(Boolean);
  const missingReceiptClaims = dependencyKeys.length - dependencyClaimIds.length;
  const currentClaim = receipt.claimId ? claimLedgerStore.get(receipt.claimId) : undefined;
  const missingLedgerLinks = dependencyClaimIds.filter((claimId) => !currentClaim?.dependsOn?.includes(claimId)).length;

  if (!receipt.claimId) {
    return {
      needsWork: true,
      label: dependencyKeys.length > 0 ? "Record chain" : "Record chain",
      detail: dependencyKeys.length > 0
        ? `Record ${dependencyKeys.length} upstream subclaim(s), then record this claim with dependency links.`
        : "Record this claim as a root ledger claim."
    };
  }

  if (missingReceiptClaims > 0 || missingLedgerLinks > 0) {
    return {
      needsWork: true,
      label: "Complete chain",
      detail: "Record missing upstream subclaims and revise this claim with ledger dependency links."
    };
  }

  return {
    needsWork: false,
    label: "Chain recorded",
    detail: "This receipt and its upstream subclaims are already linked in the local claim ledger."
  };
}

function createClaimLedgerPayload(receipt, options = {}) {
  const dependencies = options.dependsOn ?? receiptDependencies(receipt)
    .map((key) => receiptStore.get(key)?.claimId)
    .filter(Boolean);
  const nextChecks = verificationRows(receipt)
    .filter((row) => ["missing", "waiting"].includes(row.status))
    .slice(0, 5)
    .map((row) => `${row.label}: ${row.command}`);
  const researcher = currentResearcherName();

  return {
    title: receipt.title,
    statement: claimStatementForReceipt(receipt),
    domain: state.lane,
    trust: receipt.trust,
    tags: receiptTags(receipt),
    dependsOn: dependencies,
    supersedes: options.supersedes ?? [],
    derivedBy: receipt.derivedBy,
    authors: researcher === "Unsigned researcher" ? [] : [researcher],
    evidenceRefs: claimEvidenceRefs(receipt),
    nextChecks
  };
}

function claimEvidenceRefs(receipt) {
  const refs = [];

  if (receipt.receiptPaths?.ref) {
    refs.push({
      kind: "receipt",
      ref: receipt.receiptPaths.ref,
      summary: `${receipt.engine}: ${receipt.subtitle}`
    });
  } else {
    refs.push({
      kind: "other",
      ref: `local-web-receipt:${receipt.runId}`,
      trust: receipt.trust,
      summary: `${receipt.engine}: ${receipt.subtitle}`
    });
  }

  if (receipt.verifierRoute?.routeId) {
    const readiness = routeReadiness(receipt.verifierRoute);
    refs.push({
      kind: "route",
      ref: receipt.verifierRoute.routeId,
      summary: `${readiness.ready ? "Ready" : "Not ready"} verifier route ${receipt.verifierRoute.routeId}: ${readiness.summary}`
    });
  }

  return refs;
}

function claimStatementForReceipt(receipt) {
  const mathInput = receipt.math?.input ?? receipt.title;
  const mathOutput = receipt.math?.output ?? receipt.output;
  if (mathInput && mathOutput && receipt.trust !== "refuted") {
    return `${mathInput} = ${mathOutput}`;
  }

  return `${receipt.title}: ${receipt.output}`;
}

function matchesReceiptSearch(receipt, query) {
  if (!query) {
    return true;
  }

  return [
    receipt.title,
    receipt.subtitle,
    receipt.trust,
    receipt.claimId,
    receipt.runId,
    receipt.engine,
    receipt.output,
    receipt.replay,
    ...receiptTags(receipt),
    ...receiptTags(receipt).map((tag) => `#${tag}`),
    ...receiptDependencies(receipt).flatMap((key) => {
      const upstream = receiptStore.get(key);
      return upstream ? [key, upstream.title, upstream.runId, ...(upstream.tags ?? [])] : [key];
    }),
    ...dependentReceiptKeys(receipt).flatMap((key) => {
      const downstream = receiptStore.get(key);
      return downstream ? [key, downstream.title, downstream.runId, ...(downstream.tags ?? [])] : [key];
    }),
    ...Object.entries(receipt.details).flat(),
    ...receipt.graph.flat(),
    ...Object.values(receipt.traces).flat(),
    ...receipt.limitations
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function receiptTags(receipt) {
  return Array.isArray(receipt.tags) ? receipt.tags : [];
}

function receiptDependencies(receipt) {
  return Array.isArray(receipt.dependsOn) ? receipt.dependsOn : [];
}

function receiptKeyFor(receipt) {
  for (const [key, value] of receiptStore.entries()) {
    if (value === receipt) {
      return key;
    }
  }

  return undefined;
}

function dependentReceiptKeys(receipt) {
  const key = receiptKeyFor(receipt);
  if (!key) {
    return [];
  }

  return [...receiptStore.keys()].filter((candidateKey) => {
    if (candidateKey === key) {
      return false;
    }
    const candidate = receiptStore.get(candidateKey);
    return candidate && receiptDependencies(candidate).includes(key);
  });
}

function renderTagPills(tags) {
  if (!tags || tags.length === 0) {
    return "";
  }

  return `<span class="tag-strip">${tags.map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join("")}</span>`;
}

function linkedClaimLabel(key) {
  const receipt = receiptStore.get(key);
  return receipt ? `${receipt.title} (${receipt.claimId ?? receipt.trust})` : key;
}

function renderSurface() {
  document.body.dataset.surface = state.surface;
  document.body.classList.toggle("visual-focus-active", state.visualFocus);
  document.body.classList.toggle("visual-detail-collapsed", state.visualDetailCollapsed);
  if (toggleVisualFocusButton) {
    toggleVisualFocusButton.classList.toggle("active", state.visualFocus);
    toggleVisualFocusButton.setAttribute("aria-pressed", String(state.visualFocus));
    toggleVisualFocusButton.textContent = state.visualFocus ? "Exit focus" : "Focus";
  }
  if (toggleVisualDetailButton) {
    toggleVisualDetailButton.classList.toggle("active", state.visualDetailCollapsed);
    toggleVisualDetailButton.setAttribute("aria-pressed", String(state.visualDetailCollapsed));
    toggleVisualDetailButton.textContent = state.visualDetailCollapsed ? "Show detail" : "Hide detail";
  }
  surfaceTabs.forEach((button) => {
    const active = button.dataset.surface === state.surface;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  surfacePanels.forEach((panel) => {
    const active = panel.dataset.surfacePanel === state.surface;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
    panel.setAttribute("aria-hidden", String(!active));
  });
  surfaceStatus.textContent = surfaceStatusLabel();
}

function surfaceStatusLabel() {
  if (state.surface === "trace") {
    return `${visualLevelLabel(state.level)} math`;
  }

  if (state.surface === "plot") {
    if (state.selectedVisualArtifactId) {
      return `${selectedVisualArtifactRecord?.kind ?? "visual"} artifact`;
    }
    if (state.selectedResearchMapSnapshotId) {
      return "saved visual map";
    }
    return visualModeLabel(state.visualMode);
  }

  return surfaceStatusText[state.surface] ?? "local surface";
}

function resetActiveSurfaceScroll() {
  if (state.surface === "runbook") {
    document.querySelectorAll("#surface-runbook details").forEach((details) => {
      details.open = false;
    });
  }
  document.querySelector(`[data-surface-panel="${state.surface}"]`)?.scrollTo({ top: 0, left: 0 });
}

const UI_AUDIT_SURFACES = ["trace", "plot", "runbook", "checks", "graph", "protocol", "notes", "replay", "report"];
const UI_AUDIT_SCROLL_ALLOWLIST = [
  ".plot-canvas",
  ".git-branch-stage",
  ".research-map-list",
  ".visual-renderer-source",
  "#research-notes"
];
const UI_AUDIT_CLAMP_ALLOWLIST = [
  ".git-branch-title",
  ".git-branch-meta span",
  ".git-branch-meta code",
  ".research-map-row strong",
  ".research-map-row small"
];

function nextUiAuditPaint() {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    setTimeout(done, 120);
    requestAnimationFrame(() => requestAnimationFrame(done));
  });
}

function matchesAnySelector(element, selectors) {
  return selectors.some((selector) => {
    try {
      return element.matches(selector) || Boolean(element.closest(selector));
    } catch (_error) {
      return false;
    }
  });
}

function uiAuditElementSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }

  const testId = element.getAttribute("data-testid");
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  const className = typeof element.className === "string"
    ? element.className
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => `.${part}`)
      .join("")
    : "";
  return `${element.tagName.toLowerCase()}${className}`;
}

function elementIsVisibleForUiAudit(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0;
}

function uiAuditFinding(findings, severity, code, element, detail, metrics = {}) {
  findings.push({
    severity,
    code,
    selector: element ? uiAuditElementSelector(element) : "window",
    detail,
    metrics
  });
}

function collectOverflowAudit(panel, findings) {
  const candidates = [
    panel,
    ...panel.querySelectorAll("section, article, div, button, details, summary, textarea, input, code, pre, svg")
  ];

  for (const element of candidates) {
    if (!elementIsVisibleForUiAudit(element)) {
      continue;
    }

    const style = window.getComputedStyle(element);
    const horizontalOverflow = element.scrollWidth - element.clientWidth;
    const verticalOverflow = element.scrollHeight - element.clientHeight;
    const intentionallyScrollable = matchesAnySelector(element, UI_AUDIT_SCROLL_ALLOWLIST);
    const intentionallyClamped = matchesAnySelector(element, UI_AUDIT_CLAMP_ALLOWLIST) ||
      (style.webkitLineClamp && style.webkitLineClamp !== "none");
    const clipsX = ["hidden", "clip"].includes(style.overflowX);
    const clipsY = ["hidden", "clip"].includes(style.overflowY);

    if (horizontalOverflow > 4 && !intentionallyScrollable && !intentionallyClamped && clipsX) {
      uiAuditFinding(
        findings,
        "fail",
        "horizontal-overflow",
        element,
        "Visible content is wider than its clipped box.",
        {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: style.overflowX
        }
      );
    }

    if (verticalOverflow > 6 && !intentionallyScrollable && !intentionallyClamped && clipsY) {
      uiAuditFinding(
        findings,
        "fail",
        "vertical-clipping",
        element,
        "Visible content is taller than its clipped box.",
        {
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          overflowY: style.overflowY
        }
      );
    }
  }
}

function collectNestedScrollAudit(panel, findings) {
  const nestedScrollers = [...panel.querySelectorAll("*")]
    .filter((element) => {
      if (!elementIsVisibleForUiAudit(element) || matchesAnySelector(element, UI_AUDIT_SCROLL_ALLOWLIST)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const scrollsY = element.scrollHeight - element.clientHeight > 12 && ["auto", "scroll"].includes(style.overflowY);
      const scrollsX = element.scrollWidth - element.clientWidth > 12 && ["auto", "scroll"].includes(style.overflowX);
      return scrollsX || scrollsY;
    })
    .slice(0, 10);

  for (const element of nestedScrollers) {
    uiAuditFinding(
      findings,
      "warn",
      "nested-scroll-trap",
      element,
      "A visible nested scroll region can fight the main workspace scroll.",
      {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight
      }
    );
  }
}

function collectBranchMapOverlapAudit(findings) {
  if (!branchMap || !elementIsVisibleForUiAudit(branchMap)) {
    return;
  }

  const rows = [...branchMap.querySelectorAll(".git-branch-row")]
    .filter(elementIsVisibleForUiAudit)
    .map((element) => ({
      element,
      rect: element.getBoundingClientRect()
    }))
    .sort((left, right) => left.rect.top - right.rect.top);

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    const gap = current.rect.top - previous.rect.bottom;
    if (gap < 6) {
      uiAuditFinding(
        findings,
        "fail",
        "branch-map-overlap",
        current.element,
        "Branch map rows are overlapping or too close to read as a Git-style history.",
        {
          previousBottom: Math.round(previous.rect.bottom),
          currentTop: Math.round(current.rect.top),
          gap: Math.round(gap)
        }
      );
    }
  }
}

function visibleSurfaceAudit(surface) {
  const panel = document.querySelector(`[data-surface-panel="${surface}"]`);
  const findings = [];
  if (!panel) {
    uiAuditFinding(findings, "fail", "missing-surface", undefined, `Surface ${surface} was not found.`);
    return {
      surface,
      status: "failed",
      findings
    };
  }

  if (panel.hidden || panel.getAttribute("aria-hidden") === "true") {
    uiAuditFinding(findings, "fail", "inactive-surface", panel, `Surface ${surface} was not activated before audit.`);
  }

  collectOverflowAudit(panel, findings);
  collectNestedScrollAudit(panel, findings);
  collectBranchMapOverlapAudit(findings);

  const failed = findings.filter((finding) => finding.severity === "fail").length;
  const warned = findings.filter((finding) => finding.severity === "warn").length;
  return {
    surface,
    status: failed > 0 ? "failed" : warned > 0 ? "warning" : "passed",
    metrics: {
      panelClientWidth: panel.clientWidth,
      panelScrollWidth: panel.scrollWidth,
      panelClientHeight: panel.clientHeight,
      panelScrollHeight: panel.scrollHeight,
      branchRows: branchMap?.querySelectorAll(".git-branch-row").length ?? 0
    },
    findings
  };
}

async function restoreSurfaceAfterUiAudit(previousSurface, previousScrolls) {
  state.surface = previousSurface;
  render();
  await nextUiAuditPaint();
  previousScrolls.forEach((position, surface) => {
    document.querySelector(`[data-surface-panel="${surface}"]`)?.scrollTo(position);
  });
}

async function truthHarnessUiAudit(options = {}) {
  const previousSurface = state.surface;
  const previousScrolls = new Map(
    [...surfacePanels].map((panel) => [panel.dataset.surfacePanel, { top: panel.scrollTop, left: panel.scrollLeft }])
  );
  const requestedSurfaces = Array.isArray(options.surfaces) && options.surfaces.length > 0
    ? options.surfaces.filter((surface) => UI_AUDIT_SURFACES.includes(surface))
    : UI_AUDIT_SURFACES;
  const surfaces = [];

  try {
    for (const surface of requestedSurfaces) {
      state.surface = surface;
      if (surface === "plot") {
        requestVisualFit();
      }
      if (surface === "report") {
        const loaders = [];
        if (!state.credibilityPack && !state.credibilityPackLoading) {
          loaders.push(refreshCredibilityPack({ announce: false }));
        }
        if (!state.credibilityBundle && !state.credibilityBundleLoading) {
          loaders.push(refreshCredibilityBundle({ announce: false }));
        }
        if (!state.credibilityRunNextPlan && !state.credibilityRunNextLoading) {
          loaders.push(refreshCredibilityRunNext({ announce: false }));
        }
        if (!state.reportDraftsLoaded && !state.reportDraftsLoading) {
          loaders.push(refreshReportDrafts({ announce: false }));
        }
        if (loaders.length > 0) {
          await Promise.allSettled(loaders);
        }
      }
      render();
      resetActiveSurfaceScroll();
      await nextUiAuditPaint();
      surfaces.push(visibleSurfaceAudit(surface));
    }
  } finally {
    await restoreSurfaceAfterUiAudit(previousSurface, previousScrolls);
  }

  const findings = surfaces.flatMap((surface) =>
    surface.findings.map((finding) => ({
      surface: surface.surface,
      ...finding
    }))
  );
  const failures = findings.filter((finding) => finding.severity === "fail").length;
  const warnings = findings.filter((finding) => finding.severity === "warn").length;

  return {
    schemaVersion: "truth-harness.web-ui-layout-audit.v0",
    generatedAt: new Date().toISOString(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    status: failures > 0 ? "failed" : warnings > 0 ? "warning" : "passed",
    surfaces,
    summary: {
      surfaces: surfaces.length,
      passed: surfaces.filter((surface) => surface.status === "passed").length,
      warnings,
      failures
    },
    boundary: [
      "This browser layout audit checks visible DOM geometry only.",
      "It does not prove mathematical, scientific, legal, medical, or regulatory truth.",
      "A passing result does not replace human review or future pixel-diff screenshot baselines."
    ]
  };
}

window.truthHarnessUiAudit = truthHarnessUiAudit;

function writeTruthHarnessUiAuditResult(result) {
  const resultNode = document.querySelector("#truth-harness-ui-audit-result");
  if (!resultNode) {
    return;
  }

  resultNode.textContent = `${JSON.stringify(result, null, 2)}\n`;
  resultNode.dataset.status = result.status ?? "unknown";
  resultNode.dataset.generatedAt = result.generatedAt ?? new Date().toISOString();
}

function markTruthHarnessUiAuditRunning(source) {
  const resultNode = document.querySelector("#truth-harness-ui-audit-result");
  if (!resultNode) {
    return;
  }

  resultNode.textContent = "";
  resultNode.dataset.status = "running";
  resultNode.dataset.source = source;
  resultNode.dataset.startedAt = new Date().toISOString();
}

document.documentElement.dataset.truthHarnessUiAudit = "ready";

document.addEventListener("truth-harness:run-ui-audit", (event) => {
  const options = event instanceof CustomEvent && event.detail && typeof event.detail === "object"
    ? event.detail
    : {};
  markTruthHarnessUiAuditRunning("event");
  void truthHarnessUiAudit(options)
    .then(writeTruthHarnessUiAuditResult)
    .catch((error) => {
      writeTruthHarnessUiAuditResult({
        schemaVersion: "truth-harness.web-ui-layout-audit.v0",
        generatedAt: new Date().toISOString(),
        status: "failed",
        surfaces: [],
        summary: {
          surfaces: 0,
          passed: 0,
          warnings: 0,
          failures: 1
        },
        findings: [
          {
            severity: "fail",
            code: "audit-runtime-error",
            selector: "document",
            detail: error instanceof Error ? error.message : "Unknown UI audit failure."
          }
        ]
      });
    });
});

function scheduleTruthHarnessUiAuditFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("uiAudit") !== "1") {
    return;
  }

  markTruthHarnessUiAuditRunning("url");
  void truthHarnessUiAudit()
    .then(writeTruthHarnessUiAuditResult)
    .catch((error) => {
      writeTruthHarnessUiAuditResult({
        schemaVersion: "truth-harness.web-ui-layout-audit.v0",
        generatedAt: new Date().toISOString(),
        status: "failed",
        surfaces: [],
        summary: {
          surfaces: 0,
          passed: 0,
          warnings: 0,
          failures: 1
        },
        findings: [
          {
            severity: "fail",
            code: "audit-url-runtime-error",
            selector: "window.location",
            detail: error instanceof Error ? error.message : "Unknown URL-triggered UI audit failure."
          }
        ]
      });
    });
}

scheduleTruthHarnessUiAuditFromUrl();

function renderSidebarActions() {
  sidebarActionButtons.forEach((button) => {
    const action = button.dataset.sidebarAction;
    const active =
      (action === "new-session" && state.surface === "trace") ||
      (action === "lineage" && state.surface === "graph") ||
      (action === "agent-tools" && state.surface === "runbook") ||
      (action === "benchmarks" && state.surface === "checks");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  projectRows.forEach((row) => {
    const active = row.dataset.projectLane === state.lane;
    row.classList.toggle("selected", active);
    row.setAttribute("aria-pressed", String(active));
  });
}

function renderLane() {
  laneButtons.forEach((button) => {
    const active = button.dataset.lane === state.lane;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  laneStatus.textContent = laneStatusText[state.lane] ?? "General lane";
}

function renderProtocol() {
  const protocol = currentLaneProtocol();
  protocolLane.textContent = `${protocol.name} lane`;
  protocolSummary.innerHTML = `<strong>${escapeHtml(protocol.title)}</strong><p>${escapeHtml(protocol.claimStandard)}</p>`;
  protocolEvidence.innerHTML = renderProtocolItems(protocol.acceptedEvidence);
  protocolGates.innerHTML = renderProtocolItems(protocol.verificationGates);
  protocolReview.innerHTML = renderProtocolItems(protocol.reviewBoundary);
  protocolDeliverables.innerHTML = renderProtocolItems(protocol.deliverables);
  reviewStandardLane.textContent = protocol.name;
  reviewStandard.textContent = protocol.claimStandard;
}

function currentLaneProtocol() {
  return laneProtocols[state.lane] ?? laneProtocols.math;
}

function renderProtocolItems(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderAgentRoutes(receipt) {
  if (!receipt) {
    return;
  }

  const protocol = currentLaneProtocol();
  const routes = agentRouteCommands(receipt);
  routeLane.textContent = `${protocol.name} lane`;
  routeProtocol.textContent = protocol.title;
  routeReceipt.textContent = routes.receipt;
  routeReplay.textContent = routes.replay;
  routeReport.textContent = routes.report;
}

function renderRunbook(receipt) {
  if (!receipt) {
    return;
  }

  const packet = createRunbookPacket(receipt);
  runbookObjective.textContent = packet.objective;
  runbookMode.textContent = `${packet.lane} lane`;
  runbookStandard.textContent = packet.claimStandard;
  runbookClaim.textContent = packet.currentClaim;
  runbookTrust.textContent = packet.currentTrust;
  runbookStopRule.textContent = packet.nextAction;
  runbookNextCommand.textContent = packet.commands.next;
  runbookLoop.innerHTML = packet.loop.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  runbookLedger.innerHTML = packet.ledger.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  runbookStopRules.innerHTML = packet.stopRules.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  runbookPacket.textContent = formatRunbookPacket(packet);
}

function renderWorkspaceRunNext() {
  if (!workspaceRunNextStatus || !workspaceRunNextTitle || !workspaceRunNextSummary || !workspaceRunNextCommand) {
    return;
  }

  if (workspaceRunNextError) {
    workspaceRunNextStatus.textContent = "unavailable";
    workspaceRunNextStatus.className = "status-pill waiting";
    workspaceRunNextTitle.textContent = "Local next-action planner unavailable.";
    workspaceRunNextSummary.textContent = workspaceRunNextError;
    workspaceRunNextCommand.textContent = "truth-harness workspace run-next . --json";
    setWorkspaceRunNextDetails([
      ["Boundary", "Planner failed before any local action could be selected."],
      ["Fallback", "Use CLI or MCP run-next after checking the local API."]
    ]);
    renderProfessorChallengeSummary();
    renderWorkspaceRunNextEnginePlan();
    renderWorkspaceRunNextSafety();
    renderWorkspaceRunNextArtifactPreview();
    renderWorkspaceRunNextIdleActions();
    if (copyRunNextCommandButton) {
      copyRunNextCommandButton.disabled = false;
    }
    if (saveRunNextHandoffButton) {
      saveRunNextHandoffButton.disabled = true;
      saveRunNextHandoffButton.textContent = workspaceRunNextSaving ? "Saving" : "Save handoff";
    }
    return;
  }

  if (!workspaceRunNextPlan) {
    workspaceRunNextStatus.textContent = "loading";
    workspaceRunNextStatus.className = "status-pill waiting";
    workspaceRunNextTitle.textContent = "Loading local queue plan.";
    workspaceRunNextSummary.textContent = "Truth Harness will ask the local planner for the next safe action without executing it in the browser.";
    workspaceRunNextCommand.textContent = "GET /api/workspace-run-next";
    setWorkspaceRunNextDetails([
      ["Boundary", "Browser planning is dry-run only."],
      ["Execution", "CLI/MCP gates are required before local work runs."]
    ]);
    renderProfessorChallengeSummary();
    renderWorkspaceRunNextEnginePlan();
    renderWorkspaceRunNextSafety();
    renderWorkspaceRunNextArtifactPreview();
    renderWorkspaceRunNextIdleActions();
    if (copyRunNextCommandButton) {
      copyRunNextCommandButton.disabled = true;
    }
    if (saveRunNextHandoffButton) {
      saveRunNextHandoffButton.disabled = true;
      saveRunNextHandoffButton.textContent = workspaceRunNextSaving ? "Saving" : "Save handoff";
    }
    return;
  }

  const status = workspaceRunNextPlan.status ?? workspaceRunNextPlan.execution?.status ?? "planned";
  const item = workspaceRunNextPlan.item;
  const command = item?.command ?? workspaceRunNextPlan.execution?.command ?? "truth-harness workspace run-next . --json";
  workspaceRunNextStatus.textContent = workspaceRunNextPlan.dryRun ? `${workspaceRunNextStatusLabel(status)} dry run` : workspaceRunNextStatusLabel(status);
  workspaceRunNextStatus.className = `status-pill ${workspaceRunNextTrust(status)}`;
  workspaceRunNextTitle.textContent = item?.title ?? "No open local work item.";
  workspaceRunNextSummary.textContent = workspaceRunNextPlan.execution?.summary ?? "Browser-visible planning only; use CLI/MCP gates for bounded local execution.";
  workspaceRunNextCommand.textContent = command;
  setWorkspaceRunNextDetails(workspaceRunNextDetailsRows(workspaceRunNextPlan, command));
  renderProfessorChallengeSummary();
  renderWorkspaceRunNextEnginePlan(workspaceRunNextPlan);
  renderWorkspaceRunNextSafety(workspaceRunNextPlan);
  renderWorkspaceRunNextArtifactPreview(workspaceRunNextPlan);
  renderWorkspaceRunNextIdleActions(workspaceRunNextPlan);
  if (copyRunNextCommandButton) {
    copyRunNextCommandButton.disabled = !command;
  }
  if (saveRunNextHandoffButton) {
    saveRunNextHandoffButton.disabled = workspaceRunNextSaving;
    saveRunNextHandoffButton.textContent = workspaceRunNextSaving
      ? "Saving"
      : workspaceRunNextPlan.sourceRevision
        ? "Save fresh handoff"
        : "Save handoff";
  }
}

function renderProfessorChallengeSummary() {
  if (!workspaceProfessorChallenge) {
    return;
  }

  const seedCommand = "truth-harness workspace hard-math-seeds . --preset professor-challenge --latest --json";

  if (!professorChallengeSeed) {
    workspaceProfessorChallenge.hidden = false;
    workspaceProfessorChallenge.innerHTML = `<section class="workspace-professor-challenge-empty" aria-label="Professor challenge start state">
      <div class="workspace-professor-challenge-head">
        <div>
          <span class="mini-label">professor challenge</span>
          <strong>No reviewer workout loaded yet.</strong>
        </div>
        <span class="status-pill waiting">not started</span>
      </div>
      <p>Start the five-case local math challenge, restore the latest saved seed, or copy the restore command for an agent. The browser still only plans and writes local evidence through approved Truth Harness routes.</p>
      <div class="workspace-professor-challenge-next">
        <span class="mini-label">restore command</span>
        <strong>Reopen the latest professor challenge seed before asking an agent to continue.</strong>
        <code>${escapeHtml(seedCommand)}</code>
      </div>
      <div class="workspace-professor-challenge-actions" aria-label="Professor challenge start actions">
        <button class="text-button compact-button strong-action" data-professor-action="seed-challenge" type="button">Start challenge</button>
        <button class="text-button compact-button" data-professor-action="restore-latest" type="button">Restore latest</button>
        <button class="text-button compact-button" data-professor-action="copy-seed-command" data-command="${escapeHtml(seedCommand)}" type="button">Copy restore CLI</button>
      </div>
    </section>`;
    return;
  }

  const cases = Array.isArray(professorChallengeSeed.cases) ? professorChallengeSeed.cases : [];
  const nextPlan = professorChallengeSeed.runNext?.plan ?? workspaceRunNextPlan;
  const nextItem = nextPlan?.item;
  const nextCommand = nextItem?.command ?? nextPlan?.execution?.command ?? "truth-harness workspace run-next . --json";
  const nextTitle = nextItem?.title ?? "Run-next will select the highest-value open validation gate.";
  const created = professorChallengeSeed.createdAt ? new Date(professorChallengeSeed.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "local session";
  const caseCards = cases
    .map((seedCase, index) => {
      const gateCount = typeof seedCase.openBlockingGates === "number" ? `${seedCase.openBlockingGates} open` : "open";
      return `<article class="workspace-professor-challenge-case">
        <div class="workspace-professor-challenge-case-head">
          <span>${index + 1}</span>
          <strong>${escapeHtml(seedCase.title ?? seedCase.caseId ?? "Challenge case")}</strong>
        </div>
        <small>${escapeHtml(seedCase.caseId ?? "case")}</small>
        <dl class="workspace-run-next-mini-details">
          <div><dt>Plan</dt><dd>${escapeHtml(seedCase.validationPlanId ?? "not written")}</dd></div>
          <div><dt>Readiness</dt><dd>${escapeHtml(seedCase.validationReadiness ?? "open")}</dd></div>
          <div><dt>Gates</dt><dd>${escapeHtml(gateCount)}</dd></div>
        </dl>
      </article>`;
    })
    .join("");

  workspaceProfessorChallenge.hidden = false;
  workspaceProfessorChallenge.innerHTML = `<section aria-label="Last professor challenge seed">
    <div class="workspace-professor-challenge-head">
      <div>
        <span class="mini-label">professor challenge</span>
        <strong>${escapeHtml(professorChallengeSeed.seedId ?? "Seeded reviewer workout")}</strong>
      </div>
      <span class="status-pill waiting">${escapeHtml(`${cases.length} cases`)}</span>
    </div>
    <p>Seeded ${escapeHtml(created)} as a local reviewer workout for refutation, exact arithmetic, CAS, SMT, and Lean-boundary gates. This panel is a queue, not proof.</p>
    <div class="workspace-professor-challenge-grid">${caseCards}</div>
    <div class="workspace-professor-challenge-next">
      <span class="mini-label">next gate</span>
      <strong>${escapeHtml(nextTitle)}</strong>
      <code>${escapeHtml(nextCommand)}</code>
    </div>
    <div class="workspace-professor-challenge-actions" aria-label="Professor challenge resume actions">
      <button class="text-button compact-button strong-action" data-professor-action="refresh-run-next" type="button">Refresh gates</button>
      <button class="text-button compact-button" data-professor-action="preview-loop" type="button">Preview loop</button>
      <button class="text-button compact-button" data-professor-action="save-handoff" type="button">Save handoff</button>
      <button class="text-button compact-button" data-professor-action="copy-seed-command" data-command="${escapeHtml(seedCommand)}" type="button">Copy restore CLI</button>
      <button class="text-button compact-button" data-professor-action="copy-next-command" data-command="${escapeHtml(nextCommand)}" type="button">Copy next CLI</button>
    </div>
  </section>`;
}

async function handleProfessorChallengeAction(action, button) {
  if (!action) {
    return;
  }

  if (action === "copy-seed-command" || action === "copy-next-command") {
    await copyWorkspaceRunNextHandoffCommand(button?.dataset.command, button);
    return;
  }

  if (button) {
    button.disabled = true;
  }

  try {
    if (action === "seed-challenge") {
      await seedHardMathWorkspaceFromUi({
        preset: "professor-challenge",
        button,
        idleLabel: "Start challenge",
        pendingLabel: "Starting",
        activityTitle: "Starting professor challenge",
        failureTitle: "Professor challenge failed"
      });
      return;
    }

    if (action === "restore-latest") {
      const restoredSeed = await refreshLatestProfessorChallengeSeed({ announce: true });
      if (restoredSeed) {
        await refreshWorkspaceRunNext({ announce: false });
        await refreshWorkspacePilotLoop({ announce: false });
        addActivity(
          "web-ui",
          "Professor challenge restored",
          "Latest persisted professor challenge seed restored into the Run tab.",
          "passed"
        );
      }
      return;
    }

    if (action === "refresh-run-next") {
      await refreshLatestProfessorChallengeSeed({ announce: false });
      await refreshWorkspaceRunNext({ announce: true });
      await refreshWorkspacePilotLoop({ announce: false });
      addActivity(
        "web-ui",
        "Professor challenge resumed",
        "Restored the latest professor challenge seed and refreshed the verifier-directed next action.",
        "passed"
      );
      return;
    }

    if (action === "preview-loop") {
      await refreshWorkspaceRunNext({ announce: false });
      await refreshWorkspacePilotLoop({ announce: true });
      addActivity(
        "web-ui",
        "Professor challenge loop previewed",
        "Refreshed the bounded local pilot-loop preview without executing browser-side commands.",
        "waiting"
      );
      return;
    }

    if (action === "save-handoff") {
      await saveWorkspaceRunNextHandoffFromUi();
      return;
    }
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function renderWorkspacePilotLoop() {
  if (!workspacePilotLoopStatus || !workspacePilotLoopTitle || !workspacePilotLoopSummary || !workspacePilotLoopCommand) {
    return;
  }

  const supervisedCommand = "truth-harness workspace pilot-loop . --execute-local --write --max-steps 3";
  workspacePilotLoopCommand.textContent = supervisedCommand;

  if (workspacePilotLoopError) {
    workspacePilotLoopStatus.textContent = "unavailable";
    workspacePilotLoopStatus.className = "status-pill waiting";
    workspacePilotLoopTitle.textContent = "Local pilot-loop preview unavailable.";
    workspacePilotLoopSummary.textContent = workspacePilotLoopError;
    setDefinitionRows(workspacePilotLoopDetails, [
      ["Boundary", "Preview failed before any autonomous loop could be inspected."],
      ["Fallback", "Use CLI or MCP pilot-loop after checking the local API."]
    ]);
    renderWorkspacePilotLoopSteps();
    if (copyPilotLoopCommandButton) {
      copyPilotLoopCommandButton.disabled = false;
    }
    return;
  }

  if (!workspacePilotLoop) {
    workspacePilotLoopStatus.textContent = "loading";
    workspacePilotLoopStatus.className = "status-pill waiting";
    workspacePilotLoopTitle.textContent = "Loading bounded loop preview.";
    workspacePilotLoopSummary.textContent = "Truth Harness will simulate the next verifier-directed loop without executing anything in the browser.";
    workspacePilotLoopCommand.textContent = "GET /api/workspace-pilot-loop";
    setDefinitionRows(workspacePilotLoopDetails, [
      ["Boundary", "Browser loop preview is dry-run only."],
      ["Execution", "CLI/MCP gates are required before local work runs."]
    ]);
    renderWorkspacePilotLoopSteps();
    if (copyPilotLoopCommandButton) {
      copyPilotLoopCommandButton.disabled = true;
    }
    return;
  }

  const firstStep = workspacePilotLoop.steps?.[0];
  const status = workspacePilotLoop.status ?? "stopped";
  workspacePilotLoopStatus.textContent = `${workspacePilotLoopStatusLabel(status)} preview`;
  workspacePilotLoopStatus.className = `status-pill ${workspacePilotLoopTrust(status)}`;
  workspacePilotLoopTitle.textContent = firstStep?.item?.title ?? "No open verifier-directed item.";
  workspacePilotLoopSummary.textContent = firstStep?.execution?.summary ?? `Pilot loop stopped at ${workspacePilotLoop.stopReason}.`;
  setDefinitionRows(workspacePilotLoopDetails, workspacePilotLoopDetailsRows(workspacePilotLoop));
  renderWorkspacePilotLoopSteps(workspacePilotLoop);
  if (copyPilotLoopCommandButton) {
    copyPilotLoopCommandButton.disabled = false;
  }
}

function renderWorkspacePilotLoopSteps(loop) {
  if (!workspacePilotLoopSteps) {
    return;
  }

  const steps = Array.isArray(loop?.steps) ? loop.steps : [];
  if (steps.length === 0) {
    workspacePilotLoopSteps.innerHTML = `<div class="workspace-run-next-empty">No pilot-loop step selected yet. Start a validation-backed harness or refresh the reviewer queue to create a concrete blocker.</div>`;
    return;
  }

  workspacePilotLoopSteps.innerHTML = steps
    .slice(0, 3)
    .map((step) => {
      const command = step.item?.command ?? step.execution?.command ?? "no command selected";
      const label = step.stopReason ?? step.execution?.kind ?? step.status ?? "planned";
      return `<article class="workspace-pilot-loop-step">
        <div class="workspace-run-next-row-head">
          <span class="status-pill ${workspaceRunNextTrust(step.status)}">${escapeHtml(label)}</span>
          <strong>${escapeHtml(step.item?.title ?? "No open item")}</strong>
        </div>
        <p>${escapeHtml(step.execution?.summary ?? "No execution summary recorded.")}</p>
        <code>${escapeHtml(command)}</code>
      </article>`;
    })
    .join("");
}

function renderWorkspaceRunNextIdleActions(plan) {
  if (!workspaceRunNextIdleActions) {
    return;
  }

  const actions = workspaceRunNextIdleActionsForUi(plan);
  if (actions.length === 0) {
    workspaceRunNextIdleActions.innerHTML = "";
    workspaceRunNextIdleActions.hidden = true;
    return;
  }

  workspaceRunNextIdleActions.hidden = false;
  workspaceRunNextIdleActions.innerHTML = actions
    .map((action) => {
      const requiresHuman = action.requiresHumanInput ? "needs objective" : "local read only";
      return `<article class="workspace-run-next-idle-card">
        <div class="workspace-run-next-idle-head">
          <span class="mini-label">${escapeHtml(action.actionId ?? "idle-action")}</span>
          <span class="status-pill ${action.requiresHumanInput ? "waiting" : "passed"}">${escapeHtml(requiresHuman)}</span>
        </div>
        <strong>${escapeHtml(action.title ?? "Idle next action")}</strong>
        <p>${escapeHtml(action.reason ?? "Use this when no workspace queue item is open.")}</p>
        <code>${escapeHtml(action.command ?? "")}</code>
        <div class="workspace-run-next-row-actions">
          <button class="text-button compact-button copy-run-next-idle-command" type="button" data-command="${escapeHtml(action.command ?? "")}">Copy command</button>
        </div>
        <p class="workspace-run-next-boundary">${escapeHtml(action.boundary ?? "Local planning only; no browser execution.")}</p>
      </article>`;
    })
    .join("");
}

function workspaceRunNextIdleActionsForUi(plan) {
  if (Array.isArray(plan?.idleNextActions) && plan.idleNextActions.length > 0) {
    return plan.idleNextActions;
  }
  if (!plan || plan.item || plan.mode !== "idle" || plan.execution?.kind !== "no-open-item") {
    return [];
  }

  return fallbackWorkspaceRunNextIdleActions(plan.workspacePath ?? ".");
}

function fallbackWorkspaceRunNextIdleActions(workspacePath) {
  const workspace = quoteCommandArgForUi(workspacePath);
  return [
    {
      actionId: "start-validation-backed-harness",
      title: "Start a new hard-problem harness",
      command: 'truth-harness research harness "State the narrow hard problem or conjecture here" --domain math --plan-next',
      reason:
        "There is no open local queue item. Create a session with a linked validation plan and a saved run-next handoff.",
      boundary: "Needs a narrow human objective before any claim can be validated.",
      requiresHumanInput: true
    },
    {
      actionId: "refresh-strict-docker-professor-rehearsal",
      title: "Refresh the strict all-engine professor rehearsal",
      command: "npm run docker:professor:all",
      reason:
        "Writes the no-network Maxima/Z3/cvc5/Lean/SageMath reviewer evidence, closure reports, credibility pack, and portable reviewer bundle.",
      boundary: "Starts the heavier all-engine Docker image through npm; the browser and run-next planner never execute this automatically.",
      requiresHumanInput: true
    },
    {
      actionId: "refresh-docker-professor-rehearsal",
      title: "Refresh the Docker professor reviewer rehearsal",
      command: "npm run docker:professor",
      reason:
        "Writes no-network Maxima/Z3/cvc5/Lean evidence, benchmarks, closure reports, the credibility pack, and the portable reviewer bundle.",
      boundary: "Starts Docker through npm without SageMath; the browser and run-next planner never execute this automatically.",
      requiresHumanInput: true
    },
    {
      actionId: "refresh-professor-review",
      title: "Refresh the professor credibility packet",
      command: `truth-harness workspace credibility-pack ${workspace} --require-all-engines`,
      reason: "Recompute the reviewer packet from saved local artifacts so blockers are visible before the next loop.",
      boundary: "Reads local evidence only; run the Docker professor rehearsal first when reviewer artifacts need refresh.",
      requiresHumanInput: false
    },
    {
      actionId: "refresh-release-audit",
      title: "Refresh the strict release audit",
      command: `truth-harness workspace release-audit ${workspace} --require-all-engines --require-saved-strict-engine-run --require-sandbox`,
      reason: "Confirm the workspace is reviewer-clean before starting another autonomous loop.",
      boundary: "Composes existing local evidence only; strict Docker reviewer commands remain explicit.",
      requiresHumanInput: false
    }
  ];
}

function setWorkspaceRunNextDetails(rows) {
  setArtifactAwareDefinitionRows(workspaceRunNextDetails, rows, "workspace-run-next");
}

function renderWorkspaceRunNextEnginePlan(plan) {
  if (!workspaceRunNextEngine) {
    return;
  }

  const enginePlan = plan?.enginePlan;
  if (!enginePlan) {
    workspaceRunNextEngine.hidden = true;
    workspaceRunNextEngine.innerHTML = "";
    return;
  }

  workspaceRunNextEngine.hidden = false;
  workspaceRunNextEngine.innerHTML = workspaceRunNextEnginePlanHtml(enginePlan);
}

function workspaceRunNextEnginePlanHtml(enginePlan) {
  const firstStep = workspaceRunNextEngineFirstStep(enginePlan);
  const openGates = workspaceRunNextEngineOpenGates(enginePlan);
  const classifications = Array.isArray(enginePlan.classifications) && enginePlan.classifications.length > 0
    ? enginePlan.classifications.join(", ")
    : "unknown";
  const openGateSummary = openGates.length > 0
    ? openGates.map((step) => `${step.capabilityId} (${step.status})`).join(", ")
    : "No unavailable verifier gates for this route.";
  const steps = Array.isArray(enginePlan.steps) ? enginePlan.steps.slice(0, 6) : [];

  return `<section class="workspace-run-next-engine-card">
    <div class="workspace-run-next-engine-head">
      <div>
        <span class="mini-label">engine route</span>
        <strong>${escapeHtml(firstStep?.displayName ?? "No verifier route selected")}</strong>
      </div>
      <span class="status-pill ${workspaceRunNextEngineStatusTrust(enginePlan.status)}">${escapeHtml(enginePlan.status ?? "planned")}</span>
    </div>
    <p>${escapeHtml(firstStep?.evidenceRequired ?? "No concrete verifier evidence requirement recorded.")}</p>
    <dl class="workspace-run-next-engine-facts">
      <div><dt>Problem</dt><dd>${escapeHtml(enginePlan.problem ?? "not recorded")}</dd></div>
      <div><dt>Classification</dt><dd>${escapeHtml(classifications)}</dd></div>
      <div><dt>Trust ceiling</dt><dd>${escapeHtml(enginePlan.targetTrustCeiling ?? "none")}</dd></div>
      <div><dt>Open gates</dt><dd>${escapeHtml(openGateSummary)}</dd></div>
    </dl>
    <div class="workspace-run-next-engine-command">
      <span>first durable command</span>
      <code>${escapeHtml(enginePlan.recommendedFirstCommand ?? "truth-harness workspace run-next . --json")}</code>
    </div>
    ${steps.length > 0 ? `<div class="workspace-run-next-engine-steps">
      ${steps.map((step) => workspaceRunNextEngineStepHtml(step)).join("")}
    </div>` : ""}
    <p class="workspace-run-next-boundary">Engine plans route work only. Trust labels move after concrete receipts, CAS/SMT/proof records, source citations, or validation attachments are written and accepted.</p>
  </section>`;
}

function workspaceRunNextEngineStepHtml(step) {
  return `<article class="workspace-run-next-engine-step ${step.canRunNow ? "ready" : "blocked"}">
    <div>
      <span>${escapeHtml(String(step.rank ?? ""))}</span>
      <strong>${escapeHtml(step.displayName ?? step.capabilityId ?? "engine")}</strong>
    </div>
    <small>${escapeHtml([step.role, step.trustIfSuccessful, step.status].filter(Boolean).join(" / "))}</small>
  </article>`;
}

function workspaceRunNextEngineFirstStep(enginePlan) {
  const steps = Array.isArray(enginePlan?.steps) ? enginePlan.steps : [];
  return (
    steps.find((step) => step.canRunNow && step.role !== "provenance-check" && step.role !== "planned-upgrade") ??
    steps.find((step) => step.canRunNow) ??
    steps.find((step) => step.role !== "planned-upgrade") ??
    steps[0]
  );
}

function workspaceRunNextEngineOpenGates(enginePlan) {
  return (Array.isArray(enginePlan?.steps) ? enginePlan.steps : []).filter((step) => !step.canRunNow && step.role !== "planned-upgrade");
}

function workspaceRunNextEngineStatusTrust(status) {
  if (status === "ready-to-route") {
    return "passed";
  }
  if (status === "insufficient-engines") {
    return "refuted";
  }
  return "waiting";
}

function renderWorkspaceRunNextArtifactPreview(plan) {
  if (!workspaceRunNextArtifactPreview) {
    return;
  }
  if (!plan) {
    workspaceRunNextArtifactPreview.innerHTML = "";
    return;
  }

  const artifactRefs = workspaceArtifactRefObjects(plan);
  const allowedPaths = workspaceArtifactPathsForValue(plan);
  workspaceRunNextArtifactPreview.innerHTML = `${workspaceRunNextArtifactRefsHtml(artifactRefs, "workspace-run-next", {
    compact: true,
    emptyHtml: ""
  })}${workspaceRunNextRevalidationQueueHtml(plan, "workspace-run-next", {
    compact: true,
    limit: 4,
    emptyHtml: ""
  })}${workspaceArtifactPreviewHtml("workspace-run-next", {
    allowedPaths,
    emptyHtml: ""
  })}`;
}

function renderWorkspaceRunNextSafety(value) {
  if (!workspaceRunNextSafety) {
    return;
  }
  workspaceRunNextSafety.innerHTML = workspaceRunNextSafetyHtml(value, { surface: "workspace-run-next" });
}

function workspaceRunNextSafetyHtml(value, { surface = "workspace-run-next", compact = false } = {}) {
  const status = workspaceRunNextCheckpointStatus(value);
  if (status.empty) {
    return "";
  }

  const decision = workspaceRunNextDecisionFromValue(value);
  const revision = workspaceRunNextRevisionFromValue(value);
  const snapshot = workspaceRunNextSnapshotFromValue(value);
  const drift = workspaceRunNextDriftSummary(value, revision, snapshot);
  const command = decision?.nextCommand ?? value?.plan?.item?.command ?? value?.item?.command ?? value?.execution?.command;
  const revisionValue = escapeHtml(revision.id ?? revision.path ?? revision.status ?? "not recorded");
  const snapshotValue = escapeHtml(snapshot.id ?? snapshot.path ?? snapshot.status ?? "not recorded");
  const checkedAt = revision.verifiedAt ?? snapshot.verifiedAt;

  return `<section class="workspace-run-next-safety ${compact ? "compact" : ""}" aria-label="Run-next resume safety">
    <div class="workspace-run-next-safety-head">
      <div>
        <span class="mini-label">resume safety</span>
        <strong>${escapeHtml(status.title)}</strong>
      </div>
      <span class="status-pill ${workspaceRunNextResumeTrust(decision)}">${escapeHtml(status.label)}</span>
    </div>
    <p>${escapeHtml(status.reason)}</p>
    <dl class="workspace-run-next-safety-grid">
      <div><dt>Source revision</dt><dd>${revisionValue}</dd></div>
      <div><dt>Source snapshot</dt><dd>${snapshotValue}</dd></div>
      <div><dt>Drift check</dt><dd>${escapeHtml(drift)}</dd></div>
      <div><dt>Checked</dt><dd>${escapeHtml(checkedAt ? formatActivityTime(checkedAt) : "not checked")}</dd></div>
    </dl>
    ${command && !compact ? `<code>${escapeHtml(command)}</code>` : ""}
  </section>`;
}

function workspaceRunNextCheckpointStatus(value) {
  const plan = value?.plan ?? value;
  const decision = workspaceRunNextDecisionFromValue(value);
  const revision = workspaceRunNextRevisionFromValue(value);
  const snapshot = workspaceRunNextSnapshotFromValue(value);
  const hasRevision = Boolean(plan?.sourceRevision || revision.id);
  const hasSnapshot = Boolean(plan?.sourceSnapshot || snapshot.id);

  if (!hasRevision && !hasSnapshot) {
    return {
      empty: false,
      label: "write first",
      title: "No resume checkpoint yet",
      reason: "This preview has not been saved. Save a handoff before giving it to an autonomous agent."
    };
  }

  if (!hasRevision && hasSnapshot && !decision?.safeToResume && decision?.status !== "rerun-run-next") {
    return {
      label: "legacy checkpoint",
      title: "Snapshot-only handoff",
      reason: decision?.reason ?? "This older packet predates revision-backed handoffs; verify its source snapshot or save a fresh handoff."
    };
  }

  if (decision?.safeToResume) {
    return {
      label: "safe to resume",
      title: hasRevision ? "Checkpoint verified" : "Legacy checkpoint verified",
      reason: decision.reason ?? "The saved handoff still matches its source revision and snapshot."
    };
  }

  if (decision?.status === "choose-idle-action") {
    return {
      label: "choose action",
      title: "Idle checkpoint verified",
      reason: decision.reason ?? "This saved handoff is a verified idle action menu; choose one local next action explicitly."
    };
  }

  if (decision?.status === "rerun-run-next" || revision.status === "drifted" || snapshot.status === "drifted") {
    return {
      label: "rerun needed",
      title: "Workspace drift detected",
      reason: decision?.reason ?? revision.summary ?? snapshot.summary ?? "The saved handoff no longer matches the checked workspace state."
    };
  }

  return {
    label: "verify first",
    title: "Checkpoint recorded",
    reason: decision?.reason ?? "Open or verify this handoff before resuming agent work."
  };
}

function workspaceRunNextDecisionFromValue(value) {
  return value?.resumeDecision ?? value?.plan?.resumeDecision;
}

function workspaceRunNextRevisionFromValue(value) {
  const plan = value?.plan ?? value;
  const check = value?.sourceRevision ?? value;
  return {
    id: plan?.sourceRevision?.revisionId ?? value?.sourceRevisionId,
    path: plan?.sourceRevision?.path ?? value?.sourceRevisionPath,
    status: check?.sourceRevisionStatus ?? value?.sourceRevisionStatus,
    summary: check?.sourceRevisionDriftSummary ?? value?.sourceRevisionDriftSummary,
    verifiedAt: check?.sourceRevisionVerifiedAt ?? value?.sourceRevisionVerifiedAt,
    missing: check?.sourceRevisionMissing ?? value?.sourceRevisionMissing,
    changed: check?.sourceRevisionChanged ?? value?.sourceRevisionChanged,
    added: check?.sourceRevisionAdded ?? value?.sourceRevisionAdded,
    ignoredAdded: check?.sourceRevisionIgnoredAdded ?? value?.sourceRevisionIgnoredAdded
  };
}

function workspaceRunNextSnapshotFromValue(value) {
  const plan = value?.plan ?? value;
  const check = value?.sourceSnapshot ?? value;
  return {
    id: plan?.sourceSnapshot?.snapshotId ?? value?.sourceSnapshotId,
    path: plan?.sourceSnapshot?.path ?? value?.sourceSnapshotPath,
    status: check?.sourceSnapshotStatus ?? value?.sourceSnapshotStatus,
    summary: check?.sourceSnapshotDriftSummary ?? value?.sourceSnapshotDriftSummary,
    verifiedAt: check?.sourceSnapshotVerifiedAt ?? value?.sourceSnapshotVerifiedAt,
    missing: check?.sourceSnapshotMissing ?? value?.sourceSnapshotMissing,
    changed: check?.sourceSnapshotChanged ?? value?.sourceSnapshotChanged,
    added: check?.sourceSnapshotAdded ?? value?.sourceSnapshotAdded,
    ignoredAdded: check?.sourceSnapshotIgnoredAdded ?? value?.sourceSnapshotIgnoredAdded
  };
}

function workspaceRunNextDriftSummary(value, revision, snapshot) {
  const source = revision.status && revision.status !== "not-recorded" ? revision : snapshot;
  if (source.summary) {
    return source.summary;
  }
  if (!source.status) {
    return value?.plan?.sourceRevision || value?.sourceRevisionId ? "recorded, not checked" : "not recorded";
  }
  if (source.status === "verified") {
    const ignored = source.ignoredAdded ? `; ${source.ignoredAdded} expected generated file${source.ignoredAdded === 1 ? "" : "s"} ignored` : "";
    return `verified${ignored}`;
  }
  if (source.status === "not-recorded") {
    return "not recorded";
  }
  const missing = source.missing ?? 0;
  const changed = source.changed ?? 0;
  const added = source.added ?? 0;
  return `${source.status}: ${missing} missing, ${changed} changed, ${added} added`;
}

function setDefinitionRows(element, rows) {
  if (!element) {
    return;
  }

  element.innerHTML = rows
    .filter((row) => row[1])
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
}

function setArtifactAwareDefinitionRows(element, rows, surface) {
  if (!element) {
    return;
  }

  element.innerHTML = rows
    .filter((row) => row[1])
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${artifactAwareValueHtml(value, surface)}</dd></div>`)
    .join("");
}

function workspaceRunNextDetailsRows(plan, command) {
  const idleActions = plan?.idleNextActions?.map((action) => action.title).join(" / ");
  const revalidations = workspaceRunNextRevalidationSummary(plan);
  const proofRepairRows = workspaceRunNextProofRepairRows(plan?.item);
  if (plan?.rationale) {
    return [
      ["Target", plan.rationale.target],
      ["Source", plan.rationale.source],
      ["Evidence", plan.rationale.candidateEvidenceRef],
      ["Revision", plan.sourceRevision?.path],
      ["Snapshot", plan.sourceSnapshot?.path],
      ["Revalidations", revalidations],
      ["Session", plan.item?.sessionId],
      ["Execution", plan.execution?.kind ?? "dry-run"],
      ["Boundary", plan.rationale.executionBoundary],
      ["Stop", plan.rationale.firstStopCondition],
      ["Warning", plan.rationale.firstWarning],
      ["Idle actions", idleActions],
      ...proofRepairRows
    ];
  }

  const item = plan?.item;
  const execution = plan?.execution;
  const evidence = execution?.evidenceRef ?? evidenceRefFromCommand(command);
  const gate = item?.validationGateId
    ? `${item.validationGateKind ?? "gate"} ${item.validationGateId}`
    : item?.obligationId
      ? `${item.obligationKind ?? "obligation"} ${item.obligationId}`
      : item?.claimId ?? item?.routeId ?? item?.reportId ?? "workspace queue";
  const source = [item?.kind, item?.priority].filter(Boolean).join(" / ");
  const boundary = plan?.dryRun
    ? "Browser shows the local plan only; CLI/MCP must opt into execution."
    : "Executed through the bounded in-process run-next planner.";

  return [
    ["Target", gate],
    ["Source", source || "workspace-review"],
    ["Evidence", evidence],
    ["Revision", plan?.sourceRevision?.path],
    ["Snapshot", plan?.sourceSnapshot?.path],
    ["Revalidations", revalidations],
    ["Session", item?.sessionId],
    ["Execution", execution?.kind ?? "dry-run"],
    ["Boundary", boundary],
    ["Stop", plan?.stopConditions?.[0]],
    ["Warning", plan?.warnings?.[0]],
    ["Idle actions", idleActions],
    ...proofRepairRows
  ];
}

function workspaceRunNextProofRepairRows(item) {
  const target = item?.proofRepairTarget;
  if (!target) {
    return [];
  }

  return [
    ["Proof repair target", workspaceReviewProofRepairTargetText(item)],
    ["Proof repair command", workspaceReviewProofRepairCommandText(item)],
    ["Proof repair evidence", workspaceReviewProofRepairEvidenceText(item)],
    ["Proof repair boundary", target.boundary]
  ];
}

function workspaceRunNextProofRepairCardHtml(item) {
  const target = item?.proofRepairTarget;
  const attempt = item?.proofAttempt;
  if (!target && !attempt) {
    return "";
  }

  const declaration = target?.declarationName
    ?? target?.declarationId
    ?? attempt?.declarationName
    ?? attempt?.declaration?.name
    ?? attempt?.declaration?.declarationId
    ?? "declaration not recorded";
  const sourcePath = target?.sourcePath ?? attempt?.sourcePath ?? "source not recorded";
  const location = target
    ? `${target.sourcePath}:${target.markerLine}:${target.markerColumn} - ${declaration}`
    : `${sourcePath} - ${declaration}`;
  const command = target?.afterEditCommands?.[0] ?? item?.command ?? "truth-harness proof check <source.lean> --write";
  const evidence = target?.evidenceRequired?.join("; ") || "Accepted scoped proof-check record for the same route and obligation.";
  const sourceSha256 = target?.sourceSha256 ?? attempt?.sourceSha256;
  const declarationSha256 = target?.declarationSignatureSha256 ?? attempt?.declaration?.signatureSha256;
  const status = attempt?.sourceStatus ?? attempt?.status ?? target?.markerKind ?? "repair target";
  const diagnostic = attempt?.diagnosticSnippet
    ? `<p class="workspace-run-next-proof-diagnostic"><span class="mini-label">latest Lean diagnostic</span>${escapeHtml(attempt.diagnosticSnippet)}</p>`
    : "";
  const attemptRows = attempt
    ? `
      <div><dt>Attempt artifact</dt><dd>${artifactAwareValueHtml(attempt.path, "workspace-run-next")}</dd></div>
      <div><dt>Attempt status</dt><dd>${escapeHtml(`${attempt.status} / ${attempt.trust}`)}</dd></div>
      <div><dt>Source status</dt><dd>${escapeHtml(workspaceRunNextProofAttemptSourceStatusText(attempt))}</dd></div>
    `
    : "";
  const history = workspaceRunNextProofAttemptHistoryCardHtml(item?.proofAttemptHistory);
  return `<section class="workspace-run-next-proof-repair">
    <div class="workspace-run-next-proof-repair-head">
      <div>
        <span class="mini-label">proof repair target</span>
        <strong>${escapeHtml(target?.repairTargetId ?? attempt?.checkId ?? "proof attempt repair")}</strong>
      </div>
      <span class="status-pill waiting">${escapeHtml(status)}</span>
    </div>
    <p>${escapeHtml(location)}</p>
    <dl class="workspace-run-next-mini-details">
      ${sourceSha256 ? `<div><dt>Source SHA-256</dt><dd>${escapeHtml(sourceSha256)}</dd></div>` : ""}
      ${declarationSha256 ? `<div><dt>Declaration SHA-256</dt><dd>${escapeHtml(declarationSha256)}</dd></div>` : ""}
      <div><dt>Evidence required</dt><dd>${escapeHtml(evidence)}</dd></div>
      ${attemptRows}
    </dl>
    ${diagnostic}
    ${history}
    <code>${escapeHtml(command)}</code>
    <p class="workspace-run-next-boundary">${escapeHtml(target?.boundary ?? "Repair attempt is a local planning aid, not proof evidence. Edit the source, rerun Lean, and attach only an accepted scoped proof-check record.")}</p>
  </section>`;
}

function workspaceRunNextProofAttemptSourceStatusText(attempt) {
  if (!attempt?.sourceStatus) {
    return "not recorded";
  }
  const current = attempt.sourceCurrentSha256 && attempt.sourceCurrentSha256 !== attempt.sourceSha256
    ? `; current sha256 ${attempt.sourceCurrentSha256}`
    : "";
  return `${attempt.sourceStatus}; failed attempt sha256 ${attempt.sourceSha256 ?? "not recorded"}${current}`;
}

function workspaceRunNextProofAttemptHistoryCardHtml(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return "";
  }
  const rows = history.slice(0, 4).map((attempt) => `<li>
    <strong>${escapeHtml(attempt.checkId ?? "proof attempt")}</strong>
    <span>${escapeHtml(`${attempt.status ?? "unknown"} / ${attempt.sourceStatus ?? "source unchecked"}`)}</span>
  </li>`).join("");
  const remaining = history.length > 4 ? `<li><span>${escapeHtml(`${history.length - 4} older attempt${history.length - 4 === 1 ? "" : "s"} hidden`)}</span></li>` : "";
  return `<div class="workspace-run-next-proof-history" aria-label="Proof attempt history">
    <span class="mini-label">proof attempt history</span>
    <ul>${rows}${remaining}</ul>
  </div>`;
}

function workspacePilotLoopDetailsRows(loop) {
  const firstStep = loop?.steps?.[0];
  const firstCommand = firstStep?.item?.command ?? firstStep?.execution?.command;
  return [
    ["Loop", loop?.loopId],
    ["Source", loop?.source],
    ["Stop", loop?.stopReason],
    ["Steps", `${loop?.summary?.plannedSteps ?? 0} planned / ${loop?.summary?.executedSteps ?? 0} executed`],
    ["Evidence", loop?.summary?.evidenceRefs?.join(", ")],
    ["First command", firstCommand],
    ["Boundary", loop?.dryRun ? "Preview only; browser cannot execute." : "Bounded local execution."],
    ["Warning", loop?.warnings?.[0]]
  ];
}

function renderWorkspaceRunNextHandoffs() {
  if (!workspaceRunNextHistoryTitle || !workspaceRunNextList || !workspaceRunNextInspection) {
    return;
  }

  if (workspaceRunNextSummariesError) {
    workspaceRunNextHistoryTitle.textContent = "Saved handoffs unavailable.";
    workspaceRunNextList.innerHTML = `<div class="workspace-run-next-empty">${escapeHtml(workspaceRunNextSummariesError)}</div>`;
    if (workspaceRunNextHistoryArtifactPreview) {
      workspaceRunNextHistoryArtifactPreview.innerHTML = "";
    }
    workspaceRunNextInspection.innerHTML = "";
    return;
  }

  if (workspaceRunNextSummariesLoading && workspaceRunNextSummaries.length === 0) {
    workspaceRunNextHistoryTitle.textContent = "Loading saved handoffs...";
    workspaceRunNextList.innerHTML = `<div class="workspace-run-next-empty">${
      workspaceRunNextSummariesVerified
        ? "Checking local run-next packets, source revisions, and source snapshots."
        : "Loading local run-next packets without expensive snapshot verification."
    }</div>`;
    if (workspaceRunNextHistoryArtifactPreview) {
      workspaceRunNextHistoryArtifactPreview.innerHTML = "";
    }
    workspaceRunNextInspection.innerHTML = "";
    return;
  }

  const count = workspaceRunNextSummaries.length;
  workspaceRunNextHistoryTitle.textContent = count === 0
    ? "No saved handoff packets yet."
    : `${count} saved handoff${count === 1 ? "" : "s"}${workspaceRunNextSummariesVerified ? " with drift checked" : ""}.`;

  if (count === 0) {
    workspaceRunNextList.innerHTML = `<div class="workspace-run-next-empty">Use Start harness, Save plan in the Report tab, or CLI/MCP write mode to create resumable local intent packets.</div>`;
    if (workspaceRunNextHistoryArtifactPreview) {
      workspaceRunNextHistoryArtifactPreview.innerHTML = "";
    }
    workspaceRunNextInspection.innerHTML = "";
    return;
  }

  workspaceRunNextList.innerHTML = workspaceRunNextSummaries
    .map((summary) => renderWorkspaceRunNextSummary(summary))
    .join("");
  if (workspaceRunNextHistoryArtifactPreview) {
    workspaceRunNextHistoryArtifactPreview.innerHTML = workspaceArtifactPreviewHtml("workspace-run-next-history", {
      allowedPaths: workspaceArtifactPathsForValue(workspaceRunNextSummaries),
      emptyHtml: ""
    });
  }

  workspaceRunNextInspection.innerHTML = workspaceRunNextOpenedError
    ? `<div class="workspace-run-next-empty refuted">${escapeHtml(workspaceRunNextOpenedError)}</div>`
    : renderWorkspaceRunNextInspection(workspaceRunNextOpenedInspection);
}

function renderWorkspaceRunNextSummary(summary) {
  const command = summary.resumeDecision?.nextCommand ?? `truth-harness workspace show-run-next ${summary.planId} --json`;
  const status = summary.resumeDecision?.status ?? "verify-snapshot-first";
  const revision = summary.sourceRevisionStatus ?? (summary.sourceRevisionId ? "not checked" : "not recorded");
  const snapshot = summary.sourceSnapshotStatus ?? (summary.sourceSnapshotId ? "not checked" : "not recorded");
  const itemTitle = summary.itemTitle ?? "No open work item.";
  const repairSummary = workspaceRunNextProofRepairSummaryText(summary);
  const proofAttemptSummary = workspaceRunNextProofAttemptHistorySummaryText(summary);
  const packetPathHtml = workspaceArtifactRefIsPreviewable(summary.path)
    ? artifactRefControlHtml(summary.path, {
        surface: "workspace-run-next-history",
        label: "Open"
      })
    : escapeHtml(summary.path ?? "not recorded");
  const artifactRefsHtml = workspaceRunNextArtifactRefsHtml(workspaceArtifactRefObjects(summary), "workspace-run-next-history", {
    compact: true,
    limit: 4,
    emptyHtml: ""
  });
  const revalidationHtml = workspaceRunNextRevalidationQueueHtml(summary, "workspace-run-next-history", {
    compact: true,
    limit: 2,
    emptyHtml: ""
  });
  return `<article class="workspace-run-next-row" data-plan-id="${escapeHtml(summary.planId)}">
    <div class="workspace-run-next-row-main">
      <div class="workspace-run-next-row-head">
        <span class="status-pill ${workspaceRunNextResumeTrust(summary.resumeDecision)}">${escapeHtml(workspaceRunNextResumeLabel(status))}</span>
        <strong>${escapeHtml(itemTitle)}</strong>
      </div>
      <p>${escapeHtml(summary.rationaleTarget ?? summary.rationaleSource ?? summary.executionKind ?? "saved workspace handoff")}</p>
      <code>${escapeHtml(command)}</code>
      <dl class="workspace-run-next-mini-details">
        <div><dt>Plan</dt><dd>${escapeHtml(summary.planId)}</dd></div>
        <div><dt>Saved</dt><dd>${escapeHtml(formatActivityTime(summary.createdAt))}</dd></div>
        <div><dt>Revision</dt><dd>${escapeHtml(revision)}</dd></div>
        <div><dt>Snapshot</dt><dd>${escapeHtml(snapshot)}</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(summary.rationaleSource ?? summary.itemKind ?? "workspace-review")}</dd></div>
        ${repairSummary ? `<div><dt>Repair</dt><dd>${escapeHtml(repairSummary)}</dd></div>` : ""}
        ${proofAttemptSummary ? `<div><dt>Proof trail</dt><dd>${escapeHtml(proofAttemptSummary)}</dd></div>` : ""}
        <div><dt>Packet</dt><dd>${packetPathHtml}</dd></div>
      </dl>
      ${workspaceRunNextSafetyHtml(summary, { surface: "workspace-run-next-history", compact: true })}
      ${artifactRefsHtml}
      ${revalidationHtml}
    </div>
    <div class="workspace-run-next-row-actions">
      <button class="text-button compact-button open-run-next-handoff" data-plan-id="${escapeHtml(summary.planId)}" type="button">Open</button>
      <button class="text-button compact-button verify-run-next-handoff" data-plan-id="${escapeHtml(summary.planId)}" type="button">Verify</button>
      <button class="text-button compact-button copy-run-next-handoff-command" data-command="${escapeHtml(command)}" type="button">Copy</button>
    </div>
  </article>`;
}

function workspaceRunNextProofRepairSummaryText(value) {
  const target = value?.proofRepairTargetSummary ?? value?.item?.proofRepairTarget;
  if (!target) {
    return "";
  }

  const location = `${target.sourcePath}:${target.markerLine}:${target.markerColumn}`;
  const declaration = target.declarationName ?? target.declarationId;
  const command = target.afterEditCommand ?? target.afterEditCommands?.[0];
  return [target.repairTargetId, location, declaration, command].filter(Boolean).join(" / ");
}

function workspaceRunNextProofAttemptHistorySummaryText(value) {
  const summary = value?.proofAttemptHistorySummary;
  if (summary) {
    const latest = [summary.latestCheckId, summary.latestStatus, summary.latestSourcePath, summary.latestSourceStatus]
      .filter(Boolean)
      .join(" / ");
    const prior = Array.isArray(summary.priorCheckIds) && summary.priorCheckIds.length > 0
      ? ` prior ${summary.priorCheckIds.join(", ")}`
      : "";
    return `${summary.total} attempt${summary.total === 1 ? "" : "s"}; latest ${latest}${prior}`;
  }

  const attempts = Array.isArray(value?.item?.proofAttemptHistory) ? value.item.proofAttemptHistory : [];
  if (attempts.length === 0) {
    return "";
  }

  const latest = attempts[0];
  return `${attempts.length} attempt${attempts.length === 1 ? "" : "s"}; latest ${
    [latest.checkId, latest.status, latest.sourcePath, latest.sourceStatus].filter(Boolean).join(" / ")
  }`;
}

function renderWorkspaceRunNextInspection(inspection) {
  if (!inspection?.plan) {
    return "";
  }

  const decision = inspection.resumeDecision;
  const plan = inspection.plan;
  const command = decision?.nextCommand ?? plan.item?.command ?? plan.execution?.command ?? `truth-harness workspace show-run-next ${plan.planId} --json`;
  const sourceRevision = inspection.sourceRevision;
  const revisionSummary = sourceRevision
    ? sourceRevision.sourceRevisionDriftSummary ?? sourceRevision.sourceRevisionStatus
    : "revision not verified in this view";
  const sourceSnapshot = inspection.sourceSnapshot;
  const snapshotSummary = sourceSnapshot
    ? sourceSnapshot.sourceSnapshotDriftSummary ?? sourceSnapshot.sourceSnapshotStatus
    : "snapshot not verified in this view";
  const packetPath = inspection.path ?? plan.sourceSnapshot?.path ?? "not recorded";
  const sourceRevisionPath = plan.sourceRevision?.path;
  const sourceSnapshotPath = plan.sourceSnapshot?.path;
  const artifactRefs = workspaceArtifactRefObjects(inspection);
  const allowedPaths = workspaceArtifactPathsForValue(inspection);
  const revalidationHtml = workspaceRunNextRevalidationQueueHtml(inspection, "workspace-run-next-inspection", {
    limit: 6,
    emptyHtml: ""
  });
  return `<div class="workspace-run-next-opened">
    <div class="workspace-run-next-opened-head">
      <div>
        <span class="mini-label">Opened handoff</span>
        <strong>${escapeHtml(plan.item?.title ?? plan.planId)}</strong>
      </div>
      <span class="status-pill ${workspaceRunNextResumeTrust(decision)}">${escapeHtml(workspaceRunNextResumeLabel(decision?.status))}</span>
    </div>
    <p>${escapeHtml(decision?.reason ?? "Inspect the saved plan before resuming work.")}</p>
    <code>${escapeHtml(command)}</code>
    ${workspaceRunNextSafetyHtml(inspection, { surface: "workspace-run-next-inspection" })}
    <dl class="workspace-run-next-details compact">
      <div><dt>Plan</dt><dd>${escapeHtml(plan.planId)}</dd></div>
      <div><dt>Packet</dt><dd>${artifactAwareValueHtml(packetPath, "workspace-run-next-inspection")}</dd></div>
      ${sourceRevisionPath ? `<div><dt>Revision file</dt><dd>${artifactAwareValueHtml(sourceRevisionPath, "workspace-run-next-inspection")}</dd></div>` : ""}
      ${sourceSnapshotPath ? `<div><dt>Snapshot file</dt><dd>${artifactAwareValueHtml(sourceSnapshotPath, "workspace-run-next-inspection")}</dd></div>` : ""}
      <div><dt>Revision</dt><dd>${escapeHtml(revisionSummary)}</dd></div>
      <div><dt>Snapshot</dt><dd>${escapeHtml(snapshotSummary)}</dd></div>
      <div><dt>Boundary</dt><dd>${escapeHtml(plan.rationale?.executionBoundary ?? "Browser inspection only.")}</dd></div>
    </dl>
    ${workspaceRunNextProofRepairCardHtml(plan.item)}
    ${workspaceRunNextArtifactRefsHtml(artifactRefs, "workspace-run-next-inspection", {
      limit: 8,
      emptyHtml: ""
    })}
    ${revalidationHtml}
    ${workspaceArtifactPreviewHtml("workspace-run-next-inspection", {
      allowedPaths,
      emptyHtml: ""
    })}
    <div class="workspace-run-next-actions">
      ${
        decision?.status === "verify-snapshot-first"
          ? `<button class="text-button compact-button verify-run-next-handoff" data-plan-id="${escapeHtml(plan.planId)}" type="button">Verify source checkpoint</button>`
          : ""
      }
      <button class="text-button compact-button copy-run-next-handoff-command" data-command="${escapeHtml(command)}" type="button">Copy resume command</button>
    </div>
  </div>`;
}

function workspaceRunNextResumeLabel(status) {
  if (status === "safe-to-resume") {
    return "safe to resume";
  }
  if (status === "choose-idle-action") {
    return "choose action";
  }
  if (status === "rerun-run-next") {
    return "rerun needed";
  }
  if (status === "verify-snapshot-first") {
    return "verify first";
  }
  return status ?? "inspect";
}

function workspaceRunNextResumeTrust(decision) {
  if (decision?.safeToResume) {
    return "exact";
  }
  if (decision?.action === "choose-idle-action") {
    return "waiting";
  }
  if (decision?.action === "rerun-workspace-run-next") {
    return "refuted";
  }
  return "waiting";
}

function evidenceRefFromCommand(command) {
  if (!command) {
    return undefined;
  }
  const match = command.match(/--evidence\s+("[^"]+"|'[^']+'|\S+)/u);
  if (!match) {
    return undefined;
  }
  return match[1].replace(/^["']|["']$/gu, "");
}

function workspaceRunNextStatusLabel(status) {
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "executed") {
    return "executed";
  }
  return "planned";
}

function workspaceRunNextTrust(status) {
  if (status === "blocked") {
    return "refuted";
  }
  if (status === "executed") {
    return "passed";
  }
  return "waiting";
}

function workspacePilotLoopStatusLabel(status) {
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "completed") {
    return "complete";
  }
  return "stopped";
}

function workspacePilotLoopTrust(status) {
  if (status === "blocked") {
    return "refuted";
  }
  if (status === "completed") {
    return "passed";
  }
  return "waiting";
}

function workspaceRunNextActivitySummary(plan) {
  if (!plan?.item) {
    return "No open local work item is available.";
  }

  return `Next dry-run item: ${plan.item.title}.`;
}

function workspacePilotLoopActivitySummary(loop) {
  if (!loop) {
    return "Pilot-loop preview did not return a loop record.";
  }

  return `Pilot-loop preview stopped at ${loop.stopReason} after ${loop.summary?.plannedSteps ?? 0} planned step${loop.summary?.plannedSteps === 1 ? "" : "s"}.`;
}

function createRunbookPacket(receipt) {
  const protocol = currentLaneProtocol();
  const routes = agentRouteCommands(receipt);
  const rows = verificationRows(receipt);
  const openGates = rows.filter((row) => ["missing", "waiting"].includes(row.status));
  const satisfiedGates = rows.filter((row) => row.status === "passed");
  const nextAction = openGates[0] ?? rows.find((row) => row.status === "skipped") ?? rows[0];

  return {
    schemaVersion: "truth-harness.agent-runbook.v0",
    objective: protocol.title,
    lane: protocol.name,
    protocol: protocol.title,
    claimStandard: protocol.claimStandard,
    currentClaim: receipt.title,
    currentTrust: receipt.trust,
    currentRunId: receipt.runId,
    tags: receiptTags(receipt),
    dependsOn: receiptDependencies(receipt).map((key) => ({
      key,
      label: linkedClaimLabel(key)
    })),
    derivedBy: receipt.derivedBy ?? "No derivation note recorded.",
    nextAction: nextAction?.description ?? "Prepare a narrow reviewer packet with no unchecked claims.",
    privacy: {
      default: "local-first",
      modelCalls: "explicit context packets only",
      network: receipt.details.Network ?? "unknown"
    },
    budgets: {
      maxDepth: 6,
      maxBranches: 4,
      checkpointEvery: "after each tool run or claim change",
      maxUnverifiedFinalClaims: 0
    },
    commands: {
      receipt: routes.receipt,
      replay: routes.replay,
      report: routes.report,
      next: nextAction?.command ?? receipt.replay
    },
    environment: verificationEnvironmentRunbookModel(),
    satisfiedGates: satisfiedGates.map((row) => row.label),
    openGates: openGates.map((row) => ({
      label: row.label,
      status: statusLabel(row.status),
      obligationId: row.obligationId,
      obligationKind: row.obligationKind,
      command: row.command,
      nextCheck: row.description,
      evidencePath: row.evidencePath,
      acceptanceSummary: row.acceptanceSummary,
      attachedEvidenceSummary: row.attachedEvidenceSummary
    })),
    loop: protocol.verificationGates,
    ledger: protocol.acceptedEvidence,
    universalLoop: runbookLoopSteps,
    requiredLedger: runbookLedgerItems,
    stopRules: [...protocol.reviewBoundary, ...universalRunbookStopRules].slice(0, 4),
    deliverables: protocol.deliverables,
    finalArtifact: "Export a reviewer packet with report markdown, activity log, receipts, model-context packets, source citations, validation gaps, and replay commands."
  };
}

function formatRunbookPacket(packet) {
  const openGateLines = packet.openGates.length > 0
    ? packet.openGates.flatMap((gate) => [
      `- ${gate.label}: ${gate.status}`,
      ...(gate.obligationId ? [`  - Obligation: ${gate.obligationId} (${gate.obligationKind ?? "evidence"})`] : []),
      `  - Command: ${gate.command}`,
      ...(gate.evidencePath ? [`  - Close with: ${gate.evidencePath}`] : []),
      ...(gate.acceptanceSummary ? [`  - Accept when: ${gate.acceptanceSummary}`] : []),
      ...(gate.attachedEvidenceSummary ? [`  - Attached: ${gate.attachedEvidenceSummary}`] : []),
      `  - Next check: ${gate.nextCheck}`
    ]).join("\n")
    : "- No open gates. Prepare narrow reviewer packet.";
  const environmentFacts = Object.entries(packet.environment?.facts ?? {});
  const environmentCommands = Object.entries(packet.environment?.commands ?? {});
  const environmentNotes = packet.environment?.notes ?? [];
  return [
    "# Truth Harness Agent Runbook",
    "",
    `Schema: ${packet.schemaVersion}`,
    "",
    `Objective: ${packet.objective}`,
    `Lane: ${packet.lane}`,
    `Protocol: ${packet.protocol}`,
    `Claim standard: ${packet.claimStandard}`,
    `Current claim: ${packet.currentClaim}`,
    `Current trust: ${packet.currentTrust}`,
    `Run ID: ${packet.currentRunId}`,
    `Tags: ${packet.tags.length > 0 ? packet.tags.map((tag) => `#${tag}`).join(", ") : "none"}`,
    `Derived by: ${packet.derivedBy}`,
    "",
    "## Upstream Claims",
    "",
    ...(packet.dependsOn.length > 0 ? packet.dependsOn.map((item) => `- ${item.label}`) : ["- none"]),
    "",
    `Next action: ${packet.nextAction}`,
    "",
    "## Privacy",
    `- Default: ${packet.privacy.default}`,
    `- Model calls: ${packet.privacy.modelCalls}`,
    `- Network: ${packet.privacy.network}`,
    "",
    "## Budgets",
    `- Max depth: ${packet.budgets.maxDepth}`,
    `- Max branches: ${packet.budgets.maxBranches}`,
    `- Checkpoint cadence: ${packet.budgets.checkpointEvery}`,
    `- Max unverified final claims: ${packet.budgets.maxUnverifiedFinalClaims}`,
    "",
    "## Commands",
    `- Receipt: ${packet.commands.receipt}`,
    `- Replay: ${packet.commands.replay}`,
    `- Report: ${packet.commands.report}`,
    `- Next: ${packet.commands.next}`,
    "",
    "## Verification Environment",
    ...(environmentFacts.length > 0 ? environmentFacts.map(([label, value]) => `- ${label}: ${value}`) : ["- Status: not loaded"]),
    "",
    "Verifier commands:",
    ...(environmentCommands.length > 0 ? environmentCommands.map(([label, command]) => `- ${label}: ${command}`) : ["- none loaded"]),
    "",
    "Environment notes:",
    ...(environmentNotes.length > 0 ? environmentNotes.map((note) => `- ${note}`) : ["- none loaded"]),
    "",
    "## Open Gates",
    openGateLines,
    "",
    "## Lane Work Pattern",
    ...packet.loop.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Grounded Evidence",
    ...packet.ledger.map((item) => `- ${item}`),
    "",
    "## Universal Agent Harness",
    ...packet.universalLoop.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Required Ledger",
    ...packet.requiredLedger.map((item) => `- ${item}`),
    "",
    "## Deliverables",
    ...packet.deliverables.map((item) => `- ${item}`),
    "",
    "## Stop Rules",
    ...packet.stopRules.map((rule) => `- ${rule}`),
    "",
    `Final artifact: ${packet.finalArtifact}`
  ].join("\n");
}

function renderVerificationMatrix(receipt) {
  if (!receipt) {
    return;
  }

  const rows = verificationRows(receipt);
  const claimReview = claimReviewGateModel(receipt);
  const counts = rows.reduce((accumulator, row) => {
    accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const nextAction = rows.find((row) => ["missing", "waiting"].includes(row.status)) ?? rows.find((row) => row.status === "skipped") ?? rows[0];

  matrixCurrentClaim.textContent = receipt.title;
  matrixNextCommand.textContent = claimReview.nextCommand ?? nextAction?.command ?? receipt.replay;
  matrixSummary.textContent = `${claimReview.label} / ${counts.passed ?? 0} passed / ${counts.waiting ?? 0} waiting / ${counts.missing ?? 0} missing`;
  renderChecksWorkOrder(receipt, rows);
  renderClaimReviewGate(claimReview);

  verificationMatrix.innerHTML = rows
    .map((row) => {
      const focused = row.obligationId && row.obligationId === state.selectedWorkspaceObligationId;
      return `<article class="matrix-row ${row.status} ${focused ? "focused" : ""}" data-obligation-id="${escapeHtml(row.obligationId ?? "")}">
      <span class="task-state ${row.status}"></span>
      <div>
        <div class="matrix-row-head">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(focused ? `${statusLabel(row.status)} / queue focus` : statusLabel(row.status))}</span>
        </div>
        <p>${escapeHtml(row.description)}</p>
        ${verificationRowObligationHtml(row)}
        <code class="matrix-command">${escapeHtml(row.command)}</code>
        ${verificationRowActionHtml(row)}
      </div>
    </article>`;
    })
    .join("");
  focusSelectedVerificationRow();
  renderEvidenceArtifactList(receipt);

  mathCoreList.innerHTML = rows
    .filter((row) => ["exact", "counterexample", "dimension", "symbolic", "smt", "proof", "bench"].includes(row.id))
    .map((row) => `<div class="progress-row">
      <span class="task-state ${row.status}"></span>
      <strong>${escapeHtml(row.label)}</strong>
      <small>${escapeHtml(statusLabel(row.status))}</small>
    </div>`)
    .join("");
}

function renderChecksWorkOrder(receipt, rows) {
  if (!checksWorkOrder) {
    return;
  }

  const item = selectedWorkspaceReviewItem();
  if (!item) {
    checksWorkOrder.hidden = true;
    checksWorkOrder.innerHTML = "";
    return;
  }

  const routeMatches = !item.routeId || receipt?.verifierRoute?.routeId === item.routeId;
  const focusedRow = rows.find((row) => row.obligationId && row.obligationId === item.obligationId);
  const slot = Array.isArray(item.evidenceSlots) ? item.evidenceSlots[0] : undefined;
  const runAction = routeMatches ? checksWorkRunActionHtml(focusedRow) : "";
  const existingEvidence = routeMatches ? focusedEvidenceSuggestion(focusedRow) : undefined;
  const heldBackEvidence = routeMatches && !existingEvidence ? focusedHeldBackEvidence(focusedRow) : undefined;
  const engineReadiness = routeMatches ? focusedEngineReadiness(focusedRow) : undefined;
  checksWorkOrder.hidden = false;
  checksWorkOrder.className = `checks-work-order ${routeMatches ? "route-ready" : "route-mismatch"}`;
  checksWorkOrder.innerHTML = `<div class="checks-work-head">
    <div>
      <span class="mini-label">Queue work order</span>
      <h4>${escapeHtml(item.title ?? "Focused workspace action")}</h4>
    </div>
    <span class="status-pill ${routeMatches ? "exact" : "waiting"}">${escapeHtml(routeMatches ? "route loaded" : "route needed")}</span>
  </div>
  <div class="checks-work-actions">
    ${runAction}
    ${existingEvidence ? `<button class="text-button compact-button checks-work-primary attach-focused-evidence-artifact" data-route-id="${escapeHtml(focusedRow.routeId)}" data-obligation-id="${escapeHtml(focusedRow.obligationId)}" data-evidence-kind="${escapeHtml(existingEvidence.kind)}" data-evidence-ref="${escapeHtml(existingEvidence.path)}" data-evidence-trust="${escapeHtml(existingEvidence.trust)}" data-evidence-summary="${escapeHtml(existingEvidence.summary)}" type="button">Attach existing ${escapeHtml(existingEvidence.kind.toUpperCase())}</button>` : ""}
    ${item.routeId && !routeMatches ? `<button class="text-button compact-button open-checks-work-route" data-testid="checks-work-open-route" data-route-id="${escapeHtml(item.routeId)}" type="button">Open route</button>` : ""}
    <button class="text-button compact-button copy-checks-work-packet" type="button">Copy packet</button>
    <button class="text-button compact-button copy-checks-work-command" type="button">Copy command</button>
    <button class="text-button compact-button clear-checks-work-order" type="button">Clear focus</button>
  </div>
  <p>${escapeHtml(item.summary ?? "")}</p>
  ${engineReadiness ? `<div class="checks-work-engine ${escapeHtml(engineReadiness.statusClass)}">
    <span class="mini-label">Engine readiness</span>
    <strong>${escapeHtml(engineReadiness.title)}</strong>
    <small>${escapeHtml(engineReadiness.detail)}</small>
    ${engineReadiness.evidence ? `<small>${escapeHtml(engineReadiness.evidence)}</small>` : ""}
    <code>${escapeHtml(engineReadiness.command)}</code>
    <button class="text-button compact-button copy-engine-readiness-command" data-testid="copy-engine-readiness-command" data-command="${escapeHtml(engineReadiness.command)}" type="button">Copy engine command</button>
  </div>` : ""}
  ${heldBackEvidence ? `<div class="checks-work-note warning">
    <span class="mini-label">Evidence held back</span>
    <strong>${escapeHtml(heldBackEvidence.kind.toUpperCase())} record cannot close this obligation yet.</strong>
    <small>${escapeHtml(`Found ${heldBackEvidence.trust}/${heldBackEvidence.status}; requires ${heldBackEvidence.expectedTrust}.`)}</small>
    <small>${escapeHtml(heldBackEvidence.path)}</small>
    <code>${escapeHtml(heldBackEvidence.nextCommand)}</code>
    <button class="text-button compact-button copy-held-back-command" data-command="${escapeHtml(heldBackEvidence.nextCommand)}" type="button">Copy rerun command</button>
  </div>` : ""}
  <div class="checks-work-grid">
    <section>
      <span class="mini-label">Evidence slot</span>
      <strong>${escapeHtml(slot?.label ?? "Local evidence artifact")}</strong>
      <small>${escapeHtml(slot?.description ?? "Attach replayable evidence before upgrading trust.")}</small>
      <small>${escapeHtml(slot ? `Accepts: ${(slot.acceptedArtifacts ?? []).join("; ")}` : "Accepts: replayable local artifact")}</small>
    </section>
    <section>
      <span class="mini-label">Focused row</span>
      <strong>${escapeHtml(focusedRow?.label ?? item.obligationId ?? item.kind ?? "workspace item")}</strong>
      <small>${escapeHtml(focusedRow ? `${statusLabel(focusedRow.status)} / ${focusedRow.obligationKind ?? "evidence"}` : routeMatches ? "No matching matrix row is visible." : "Open the route before working this item.")}</small>
      <small>${escapeHtml(workspaceReviewSlotTargetText(slot ?? { attachTo: { routeId: item.routeId, obligationId: item.obligationId, claimId: item.claimId, sessionId: item.sessionId } }))}</small>
    </section>
  </div>
  <details class="checks-work-command">
    <summary>Command</summary>
    <code>${escapeHtml(item.command ?? "")}</code>
  </details>`;

  checksWorkOrder.querySelector(".open-checks-work-route")?.addEventListener("click", async (event) => {
    const routeId = event.currentTarget.dataset.routeId;
    if (!routeId) {
      return;
    }

    await openSavedRoute(routeId);
    state.surface = "checks";
    render();
  });
  checksWorkOrder.querySelector(".run-cas-obligation")?.addEventListener("click", (event) => {
    void runCasForObligation(event.currentTarget);
  });
  checksWorkOrder.querySelector(".run-smt-obligation")?.addEventListener("click", (event) => {
    void runSmtForObligation(event.currentTarget);
  });
  checksWorkOrder.querySelector(".attach-focused-evidence-artifact")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    void attachEvidenceToRoute({
      routeId: button.dataset.routeId,
      obligationId: button.dataset.obligationId,
      evidenceRef: {
        kind: button.dataset.evidenceKind,
        ref: button.dataset.evidenceRef,
        trust: button.dataset.evidenceTrust,
        summary: button.dataset.evidenceSummary
      }
    });
  });
  checksWorkOrder.querySelector(".copy-held-back-command")?.addEventListener("click", (event) => {
    copyOrDownloadText({
      text: `${event.currentTarget.dataset.command ?? ""}\n`,
      filename: `truth-harness-held-back-rerun-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      button: event.currentTarget,
      copiedTitle: "Copied rerun command",
      copiedDetail: "Use Docker to rerun the held-back evidence path.",
      fallbackTitle: "Downloaded rerun command",
      fallbackDetail: "the held-back evidence rerun command was saved as plain text instead."
    });
  });
  checksWorkOrder.querySelector(".copy-engine-readiness-command")?.addEventListener("click", (event) => {
    copyOrDownloadText({
      text: `${event.currentTarget.dataset.command ?? ""}\n`,
      filename: `truth-harness-engine-command-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      button: event.currentTarget,
      copiedTitle: "Copied engine command",
      copiedDetail: "Use this command to run the focused verifier path.",
      fallbackTitle: "Downloaded engine command",
      fallbackDetail: "the focused engine command was saved as plain text instead."
    });
  });
  checksWorkOrder.querySelector(".copy-checks-work-packet")?.addEventListener("click", (event) => {
    if (!item.agentPacket) {
      return;
    }

    copyOrDownloadText({
      text: `${item.agentPacket.trim()}\n`,
      filename: `truth-harness-agent-packet-${safeFilenameTimestamp()}.md`,
      type: "text/markdown",
      button: event.currentTarget,
      copiedTitle: "Copied focused work packet",
      copiedDetail: item.title ?? "workspace action",
      fallbackTitle: "Downloaded focused work packet",
      fallbackDetail: "the focused work packet was saved as markdown instead."
    });
  });
  checksWorkOrder.querySelector(".copy-checks-work-command")?.addEventListener("click", (event) => {
    if (!item.command) {
      return;
    }

    copyOrDownloadText({
      text: `${item.command}\n`,
      filename: `truth-harness-focused-command-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      button: event.currentTarget,
      copiedTitle: "Copied focused command",
      copiedDetail: item.command,
      fallbackTitle: "Downloaded focused command",
      fallbackDetail: "the focused work command was saved as plain text instead."
    });
  });
  checksWorkOrder.querySelector(".clear-checks-work-order")?.addEventListener("click", () => {
    state.selectedWorkspaceReviewItemId = undefined;
    state.selectedWorkspaceObligationId = undefined;
    render();
  });
}

function checksWorkRunActionHtml(row) {
  if (!row || row.status === "passed" || !row.obligationId) {
    return "";
  }

  if (row.canRunCas) {
    return `<button class="text-button compact-button checks-work-primary run-cas-obligation" data-route-id="${escapeHtml(row.routeId)}" data-obligation-id="${escapeHtml(row.obligationId)}" type="button">Run CAS + attach</button>`;
  }

  if (row.canRunSmt) {
    return `<button class="text-button compact-button checks-work-primary run-smt-obligation" data-route-id="${escapeHtml(row.routeId)}" data-obligation-id="${escapeHtml(row.obligationId)}" type="button">Run Z3 + attach</button>`;
  }

  return "";
}

function focusedEvidenceSuggestion(row) {
  if (!row || row.status === "passed" || !row.obligationId) {
    return undefined;
  }

  const artifacts = focusedEvidenceArtifacts();

  return artifacts.find((artifact) => {
    if (row.obligationKind === "solver-encoding") {
      return artifact.kind === "smt" && artifact.trust === "smt-checked";
    }

    if (row.obligationKind === "independent-check") {
      return (artifact.kind === "cas" && artifact.trust === "cross-checked")
        || (artifact.kind === "smt" && artifact.trust === "smt-checked");
    }

    return false;
  });
}

function focusedHeldBackEvidence(row) {
  if (!row || row.status === "passed" || !row.obligationId) {
    return undefined;
  }

  const artifacts = focusedEvidenceArtifacts();
  const candidate = artifacts.find((artifact) => {
    if (row.obligationKind === "solver-encoding") {
      return artifact.kind === "smt";
    }

    if (row.obligationKind === "independent-check") {
      return artifact.kind === "cas" || artifact.kind === "smt";
    }

    return false;
  });
  if (!candidate) {
    return undefined;
  }

  return {
    ...candidate,
    expectedTrust: row.obligationKind === "solver-encoding"
      ? "smt-checked or proved evidence"
      : "cross-checked, smt-checked, or proved evidence",
    nextCommand: heldBackEvidenceNextCommand(candidate)
  };
}

function focusedEvidenceArtifacts() {
  return [
    ...[...casCheckStore.values()].map((check) => normalizeCasAttachment(check)),
    ...[...smtCheckStore.values()].map((check) => normalizeSmtAttachment(check))
  ].sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")));
}

function heldBackEvidenceNextCommand(artifact) {
  if (artifact.status === "solver-unavailable" && artifact.kind === "smt") {
    return dockerCliCommand(`smt check ${artifact.sourcePath ?? "<source.smt2>"} --write`);
  }

  if (artifact.status === "solver-unavailable" && artifact.kind === "cas") {
    return dockerCliCommand(`cas check --operation ${artifact.operation ?? "simplify"} --expression "${truncateForCommand(artifact.expression ?? "<expression>", 48)}" --result "${truncateForCommand(artifact.result ?? "<result>", 32)}" --write`);
  }

  return "Review the mismatch or rerun with an independent checker before attaching evidence.";
}

function focusedEngineReadiness(row) {
  if (!row || row.status === "passed" || !row.obligationId) {
    return undefined;
  }

  const target = focusedEngineTarget(row);
  if (!target) {
    return undefined;
  }

  const payload = state.safetyStatus;
  if (!payload) {
    return {
      statusClass: "waiting",
      title: `${target.displayName} status loading`,
      detail: "Backend probes report readiness only; a concrete replayable run is still required.",
      command: target.fallbackCommand
    };
  }

  if (payload.error) {
    return {
      statusClass: "waiting",
      title: `${target.displayName} status unavailable`,
      detail: "The local status API is unavailable, so use the Docker verifier path before relying on this obligation.",
      command: target.fallbackCommand
    };
  }

  const engine = focusedEngineStatus(target);
  const available = engine?.status === "available";
  const displayName = engine?.displayName ?? target.displayName;
  const evidenceCase = focusedEngineEvidenceCase(target);
  return {
    statusClass: available ? "ready" : "missing",
    title: `${displayName} ${available ? "available on host" : "missing on host"}`,
    detail: available
      ? `${target.trustLabel} still requires a concrete replayable run; a status probe is not evidence.`
      : `Use the Docker verifier path instead of installing or trusting ad hoc host tools; ${target.trustLabel} remains blocked until a concrete accepted run succeeds.`,
    command: available ? (engine?.command ?? target.hostCommand) : target.fallbackCommand,
    evidence: evidenceCase
      ? `${engineEvidenceCaseLabel(evidenceCase.status)} concrete smoke: ${evidenceCase.evidenceMinted ? "evidence minted" : "no evidence minted"} (${evidenceCase.trust}).`
      : "No concrete engine evidence smoke record is loaded for this verifier yet."
  };
}

function focusedEngineEvidenceCase(target) {
  const cases = Array.isArray(state.safetyStatus?.engineVerification?.cases)
    ? state.safetyStatus.engineVerification.cases
    : [];
  const normalizedIds = new Set(target.ids.map((id) => id.toLowerCase()));
  return cases.find((entry) => {
    const candidates = [
      entry.id,
      entry.capabilityId,
      entry.displayName
    ].filter(Boolean).map((value) => String(value).toLowerCase());
    return candidates.some((value) =>
      normalizedIds.has(value)
      || target.ids.some((id) => value.includes(id.toLowerCase()))
    );
  });
}

function focusedEngineTarget(row) {
  if (row.obligationKind === "solver-encoding") {
    return {
      ids: ["z3", "z3-smt-solver"],
      displayName: "Z3 SMT solver",
      hostCommand: row.command ?? "truth-harness smt check <constraints.smt2> --write",
      fallbackCommand: dockerizeFocusedCommand(row.command ?? "truth-harness smt check <constraints.smt2> --write"),
      trustLabel: "smt-checked"
    };
  }

  if (row.obligationKind === "independent-check") {
    return {
      ids: ["maxima", "maxima-cas"],
      displayName: "Maxima CAS",
      hostCommand: row.command ?? "truth-harness cas check --write",
      fallbackCommand: dockerizeFocusedCommand(row.command ?? "truth-harness cas check --write"),
      trustLabel: "cross-checked"
    };
  }

  if (row.obligationKind === "formal-proof") {
    return {
      ids: ["lean", "lean-proof-checker"],
      displayName: "Lean proof checker",
      hostCommand: row.command ?? "truth-harness proof check <proof.lean> --write",
      fallbackCommand: "npm run docker:proof",
      trustLabel: "proved"
    };
  }

  return undefined;
}

function focusedEngineStatus(target) {
  const engines = Array.isArray(state.safetyStatus?.verification?.engines)
    ? state.safetyStatus.verification.engines
    : [];
  const normalizedIds = new Set(target.ids.map((id) => id.toLowerCase()));
  return engines.find((engine) => {
    const candidates = [
      engine.id,
      engine.backendId,
      engine.displayName,
      engine.adapter,
      engine.role
    ].filter(Boolean).map((value) => String(value).toLowerCase());
    return candidates.some((value) =>
      normalizedIds.has(value)
      || target.ids.some((id) => value.includes(id.toLowerCase()))
    );
  });
}

function dockerizeFocusedCommand(command) {
  return command.startsWith("truth-harness ")
    ? dockerCliCommand(command.slice("truth-harness ".length))
    : "npm run docker:proof";
}

function dockerCliCommand(commandTail) {
  const trimmed = String(commandTail).trim();
  const optionIndex = firstCliOptionIndex(trimmed);
  if (optionIndex < 0) {
    return `npm run docker:cli -- ${trimmed}`;
  }

  return `npm run docker:cli -- ${trimmed.slice(0, optionIndex).trimEnd()} -- ${trimmed.slice(optionIndex).trimStart()}`;
}

function firstCliOptionIndex(commandTail) {
  let quote = "";
  let escaped = false;
  for (let index = 0; index < commandTail.length - 2; index += 1) {
    const char = commandTail[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/u.test(char) && commandTail[index + 1] === "-" && commandTail[index + 2] === "-") {
      return index + 1;
    }
  }

  return -1;
}

function selectedWorkspaceReviewItem() {
  const items = Array.isArray(workspaceReview.items) ? workspaceReview.items : [];
  return items.find((item) => item.itemId === state.selectedWorkspaceReviewItemId);
}

function focusSelectedVerificationRow() {
  if (state.surface !== "checks" || !state.selectedWorkspaceObligationId || !verificationMatrix) {
    return;
  }

  const row = verificationMatrix.querySelector(".matrix-row.focused");
  if (!row) {
    return;
  }

  requestAnimationFrame(() => {
    const target = checksWorkOrder && !checksWorkOrder.hidden ? checksWorkOrder : row;
    target.scrollIntoView({
      block: "start",
      inline: "nearest",
      behavior: "smooth"
    });
  });
}

function claimReviewGateModel(receipt) {
  const claim = receipt.claimId ? claimLedgerStore.get(receipt.claimId) : undefined;
  if (!claim) {
    return {
      status: "not-recorded",
      label: "not recorded",
      trust: receipt.trust,
      ready: false,
      decision: "Record this result into the claim ledger before an agent relies on it downstream.",
      blockers: ["No local claim ledger record is linked to the selected receipt."],
      claimId: receipt.claimId ?? "not recorded",
      nextCommand: receipt.claimId
        ? `truth-harness claim show ${receipt.claimId} --json`
        : `truth-harness claim add ${quoteCommandArgForUi(receipt.title)} --evidence receipt:<receipt.json> --json`
    };
  }

  const finalization = claimFinalizationSummary(claim);
  const reviewStatus = claimReviewStatusForClaim(claim, finalization);
  const blockers = claimReviewBlockersForClaim(claim, finalization);
  return {
    status: reviewStatus,
    label: claimReviewStatusLabel(reviewStatus),
    trust: claim.trust,
    ready: reviewStatus === "ready",
    decision: claimReviewDecisionForClaim(claim, reviewStatus),
    blockers,
    claimId: claim.claimId,
    nextCommand: `truth-harness claim review ${claim.claimId} --json`
  };
}

function renderClaimReviewGate(model) {
  if (!claimReviewGate) {
    return;
  }

  claimReviewGate.className = `claim-gate-card ${model.status}`;
  claimReviewStatus.textContent = model.label;
  claimReviewStatus.className = `status-pill ${claimReviewStatusClass(model.status)}`;
  claimReviewDecision.textContent = model.decision;
  claimReviewFacts.innerHTML = [
    ["Claim", model.claimId],
    ["Trust", model.trust],
    ["Ready", model.ready ? "yes" : "no"],
    ["Blockers", String(model.blockers.length)]
  ]
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
  const visibleBlockers = model.blockers.slice(0, 6);
  const hiddenBlockerCount = Math.max(0, model.blockers.length - visibleBlockers.length);
  claimReviewBlockers.innerHTML = model.blockers.length > 0
    ? [
      ...visibleBlockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`),
      ...(hiddenBlockerCount > 0 ? [`<li>${escapeHtml(`${hiddenBlockerCount} more checks in claim review packet.`)}</li>`] : [])
    ].join("")
    : "<li>No blocking checks remain for the current narrow claim.</li>";
  claimReviewCommand.textContent = model.nextCommand;
}

function claimReviewStatusForClaim(claim, finalization) {
  if (claim.status !== "active") {
    return "inactive";
  }

  if (claim.trust === "refuted") {
    return "refuted";
  }

  return finalization.ready ? "ready" : "blocked";
}

function claimReviewStatusLabel(status) {
  return status.replaceAll("-", " ");
}

function claimReviewStatusClass(status) {
  if (status === "ready") {
    return "exact";
  }

  if (status === "refuted") {
    return "refuted";
  }

  return "waiting";
}

function claimReviewDecisionForClaim(claim, status) {
  if (status === "ready") {
    return `Ready only as a narrow ${claim.trust} claim matching the attached evidence.`;
  }

  if (status === "refuted") {
    return "Do not present this as true; cite it only as a refuted result under the recorded assumptions.";
  }

  if (status === "inactive") {
    return `Do not cite this as current; claim status is ${claim.status}.`;
  }

  return "Not ready for a final claim; keep it scoped or attach stronger evidence.";
}

function claimReviewBlockersForClaim(claim, finalization) {
  const blockers = [...finalization.openChecks];
  for (const step of claim.verification ?? []) {
    if (step.status === "waiting" || step.status === "blocked") {
      blockers.push(`${step.stage}: ${step.summary}`);
    }
  }

  return [...new Set(blockers)];
}

function verificationRowObligationHtml(row) {
  if (!row.obligationId) {
    return "";
  }

  const severity = row.severity ? `<span>${escapeHtml(row.severity)}</span>` : "";
  return `<div class="obligation-work-order">
    <div class="obligation-meta">
      <code>${escapeHtml(row.obligationId)}</code>
      <span>${escapeHtml(row.obligationKind ?? "evidence")}</span>
      ${severity}
    </div>
    <dl class="obligation-facts">
      <div>
        <dt>Close with</dt>
        <dd>${escapeHtml(row.evidencePath ?? "Replayable local evidence artifact.")}</dd>
      </div>
      <div>
        <dt>Accept when</dt>
        <dd>${escapeHtml(row.acceptanceSummary ?? "The matching verifier accepts the artifact.")}</dd>
      </div>
      <div>
        <dt>Attached</dt>
        <dd>${escapeHtml(row.attachedEvidenceSummary ?? "No evidence attached yet.")}</dd>
      </div>
    </dl>
  </div>`;
}

function renderEvidenceArtifactList(receipt) {
  if (!casArtifactList || !casArtifactCount) {
    return;
  }

  const artifacts = [
    ...[...casCheckStore.values()].map((check) => normalizeCasAttachment(check)),
    ...[...smtCheckStore.values()].map((check) => normalizeSmtAttachment(check))
  ].sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")));
  const openObligations = currentOpenEvidenceObligations(receipt);
  casArtifactCount.textContent = artifacts.length === 0
    ? "no records"
    : `${artifacts.length} evidence record${artifacts.length === 1 ? "" : "s"}`;

  if (artifacts.length === 0) {
    casArtifactList.innerHTML = `<div class="activity-empty">No evidence artifacts yet. Run a CAS or SMT obligation to write the first local verifier record.</div>`;
    return;
  }

  casArtifactList.innerHTML = artifacts.slice(0, 8)
    .map((artifact) => {
      const statusClass = trustClass(artifact.trust);
      const target = attachmentTargetForArtifact(artifact, openObligations);
      return `<article class="cas-artifact-card">
        <span class="task-state ${statusClass}"></span>
        <div class="cas-artifact-body">
          <div class="cas-artifact-head">
            <strong>${escapeHtml(artifact.summary)}</strong>
            <span>${escapeHtml(artifact.status)} / ${escapeHtml(artifact.trust)}</span>
          </div>
          <small><code>${escapeHtml(artifact.checkId)}</code> - ${escapeHtml(artifact.path)}</small>
          ${artifact.warning ? `<small>${escapeHtml(artifact.warning)}</small>` : ""}
          ${target ? `<button class="text-button compact-button attach-evidence-artifact" data-route-id="${escapeHtml(target.routeId)}" data-obligation-id="${escapeHtml(target.obligationId)}" data-evidence-kind="${escapeHtml(artifact.kind)}" data-evidence-ref="${escapeHtml(artifact.path)}" data-evidence-trust="${escapeHtml(artifact.trust)}" data-evidence-summary="${escapeHtml(artifact.summary)}" type="button">${escapeHtml(target.label)}</button>` : ""}
        </div>
      </article>`;
    })
    .join("");
}

function normalizeCasAttachment(check) {
  const summary = `${check.operation} ${check.expression} -> ${check.result}`;
  return {
    kind: "cas",
    checkId: check.checkId,
    createdAt: check.createdAt,
    operation: check.operation,
    expression: check.expression,
    result: check.result,
    status: check.status,
    trust: check.trust,
    summary,
    path: check.path ?? check.paths?.json ?? check.checkId,
    warning: check.warnings?.[0]
  };
}

function normalizeSmtAttachment(check) {
  const sourcePath = check.sourcePath ?? check.source?.path ?? "SMT-LIB source";
  return {
    kind: "smt",
    checkId: check.checkId,
    createdAt: check.createdAt,
    sourcePath,
    status: check.status,
    trust: check.trust,
    summary: `${sourcePath} -> ${check.status}`,
    path: check.path ?? check.paths?.json ?? check.checkId,
    warning: check.warnings?.[0]
  };
}

function attachmentTargetForArtifact(artifact, openObligations) {
  if (artifact.kind === "cas" && artifact.trust === "cross-checked" && openObligations.independent) {
    return {
      ...openObligations.independent,
      label: "Attach to independent check"
    };
  }

  if (artifact.kind === "smt" && artifact.trust === "smt-checked") {
    const target = openObligations.solver ?? openObligations.independent;
    if (target) {
      return {
        ...target,
        label: target === openObligations.solver ? "Attach to SMT obligation" : "Attach to independent check"
      };
    }
  }

  return undefined;
}

function currentOpenEvidenceObligations(receipt) {
  const route = receipt?.verifierRoute;
  const empty = {
    independent: undefined,
    solver: undefined
  };
  if (!route) {
    return empty;
  }

  const toTarget = (obligation) => obligation
    ? {
        routeId: route.routeId,
        obligationId: obligation.obligationId
      }
    : undefined;

  return {
    independent: toTarget(route.proofObligations?.find((item) => item.kind === "independent-check" && item.status === "open")),
    solver: toTarget(route.proofObligations?.find((item) => item.kind === "solver-encoding" && item.status === "open"))
  };
}

function renderCapabilityLedger() {
  if (!capabilityLedger) {
    return;
  }

  capabilityLedger.innerHTML = capabilityLedgerRows
    .map((row) => `<article class="parity-row ${escapeHtml(row.status)}">
      <div class="parity-row-head">
        <span class="ledger-state ${escapeHtml(row.status)}"></span>
        <div>
          <strong>${escapeHtml(row.category)}</strong>
          <small>${escapeHtml(row.compare)}</small>
        </div>
        <span>${escapeHtml(parityStatusLabel(row.status))}</span>
      </div>
      <dl>
        <div>
          <dt>Today</dt>
          <dd>${escapeHtml(row.truthHarness)}</dd>
        </div>
        <div>
          <dt>Gap</dt>
          <dd>${escapeHtml(row.gap)}</dd>
        </div>
        <div>
          <dt>Next</dt>
          <dd>${escapeHtml(row.next)}</dd>
        </div>
      </dl>
    </article>`)
    .join("");
}

function parityStatusLabel(status) {
  if (status === "ahead") {
    return "ahead";
  }

  if (status === "strict-gate") {
    return "trust edge";
  }

  if (status === "adapter-first") {
    return "adapter edge";
  }

  if (status === "gap") {
    return "gap";
  }

  return "building";
}

function renderTaskDock(receipt) {
  if (!receipt) {
    return;
  }

  const rows = verificationRows(receipt);
  const counts = rows.reduce((accumulator, row) => {
    accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const openRows = rows.filter((row) => ["missing", "waiting"].includes(row.status));
  const visibleRows = (openRows.length > 0 ? openRows : rows.filter((row) => row.status === "passed")).slice(0, 3);
  const passed = counts.passed ?? 0;
  const open = openRows.length;

  taskDockState.className = `task-state ${open > 0 ? "waiting" : "passed"}`;
  taskDockSummary.textContent = open > 0 ? `${passed} passed / ${open} open` : `${passed} passed / ready`;
  taskList.innerHTML = visibleRows
    .map((row) => `<div class="task-row">
      <span class="task-state ${row.status}"></span>
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(statusLabel(row.status))}</strong>
    </div>`)
    .join("");
  if (taskConsoleList) {
    const consoleItems = taskConsoleItems(receipt, rows);
    taskConsoleList.innerHTML = consoleItems.length === 0
      ? `<div class="task-console-row">
        <span class="task-state skipped"></span>
        <div>
          <strong>No command surface yet</strong>
          <code>Submit or open a route to expose replayable local commands.</code>
        </div>
      </div>`
      : consoleItems
        .map((item) => `<div class="task-console-row">
          <span class="task-state ${escapeHtml(item.status)}"></span>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <code>${escapeHtml(item.command)}</code>
          </div>
        </div>`)
        .join("");
  }
}

function taskConsoleItems(receipt, rows = []) {
  const items = [];
  const seenCommands = new Set();
  const pushCommand = (label, command, status = "waiting") => {
    const normalizedCommand = String(command ?? "").trim();
    if (!normalizedCommand || seenCommands.has(normalizedCommand)) {
      return;
    }

    seenCommands.add(normalizedCommand);
    items.push({
      label,
      command: normalizedCommand,
      status
    });
  };

  pushCommand("Replay current receipt", receipt?.replay, receipt?.trust === "refuted" ? "refuted" : "passed");
  for (const row of rows.filter((candidate) => ["missing", "waiting"].includes(candidate.status))) {
    pushCommand(row.label, row.command, row.status);
  }
  for (const row of rows.filter((candidate) => candidate.status === "passed")) {
    pushCommand(row.label, row.command, row.status);
  }

  return items.slice(0, 5);
}

function formatTaskConsoleCommands(receipt) {
  const rows = receipt ? verificationRows(receipt) : [];
  return taskConsoleItems(receipt, rows)
    .map((item, index) => `${index + 1}. ${item.label}\n   ${item.command}`)
    .join("\n");
}

async function refreshSafetyStatus() {
  if (!safetyStatusPill) {
    return;
  }

  try {
    const response = await fetch("/api/status", {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local status API failed.");

    state.safetyStatus = payload;
    renderSafetyStatus();
    renderRunbook(receiptStore.get(state.receiptKey));
    renderReport(receiptStore.get(state.receiptKey));
    addActivity(
      "local-api",
      "Loaded safety center",
      localApiSuccessMessage(payload, safetyStatusSummary(payload)),
      payload.safety?.codeRunSandbox?.canAttestNetworkNone ? "passed" : "waiting"
    );
    addActivity(
      "local-api",
      "Loaded engine readiness",
      localApiSuccessMessage(payload, engineReadinessSummary(payload)),
      payload.engineReadiness?.summary?.readyClaimClasses > 0 || payload.verification?.readyCount > 0 ? "passed" : "waiting"
    );
    addActivity(
      "local-api",
      "Loaded engine evidence gate",
      localApiSuccessMessage(payload, engineEvidenceSummary(payload)),
      payload.engineVerification?.concretePassed > 0 ? "passed" : "waiting"
    );
  } catch (error) {
    state.safetyStatus = {
      error: error instanceof Error ? error.message : "Unknown local status failure."
    };
    renderSafetyStatus();
    renderRunbook(receiptStore.get(state.receiptKey));
    renderReport(receiptStore.get(state.receiptKey));
    addActivity("local-api", "Safety center unavailable", state.safetyStatus.error, "refuted");
  }
}

async function refreshEngineRuns({ announce = true } = {}) {
  try {
    const response = await fetch("/api/engine-runs", {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local engine evidence runs API failed.");
    state.engineRuns = Array.isArray(payload.runs) ? payload.runs : [];
    state.engineRunsError = undefined;
    renderEngineEvidenceGate(state.safetyStatus);
    if (announce) {
      addActivity(
        "local-api",
        "Loaded engine evidence runs",
        `${state.engineRuns.length} saved local engine evidence run${state.engineRuns.length === 1 ? "" : "s"} available.`,
        state.engineRuns.length > 0 ? "passed" : "waiting"
      );
    }
  } catch (error) {
    state.engineRuns = [];
    state.engineRunsError = error instanceof Error ? error.message : "Unknown engine evidence run failure.";
    renderEngineEvidenceGate(state.safetyStatus);
    if (announce) {
      addActivity("local-api", "Engine evidence runs unavailable", state.engineRunsError, "waiting");
    }
  }
}

async function saveEngineEvidenceRun(button, { requireAllEngines = false } = {}) {
  if (state.engineRunsSaving) {
    return;
  }

  const mode = requireAllEngines ? "all-engines" : "default";
  state.engineRunsSaving = true;
  state.engineRunsSavingMode = mode;
  if (button) {
    button.disabled = true;
    button.textContent = requireAllEngines ? "Saving strict" : "Saving";
  }

  try {
    const response = await fetch("/api/engine-runs", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ timeoutMs: 1500, requireAllEngines })
    });
    const payload = await readLocalApiJson(response, "Local engine evidence run write failed.");
    state.engineRuns = Array.isArray(payload.runs) ? payload.runs : [];
    if (payload.run?.report) {
      state.safetyStatus = {
        ...(state.safetyStatus ?? {}),
        engineVerification: payload.run.report
      };
    }
    state.engineRunsError = undefined;
    addActivity(
      "local-api",
      requireAllEngines ? "Saved strict engine reviewer run" : "Saved engine evidence run",
      payload.activity?.[0]?.detail ?? `${payload.run?.runId ?? "engine run"} saved under .truth-harness/engine-runs.`,
      payload.run?.status === "passed" ? "passed" : "waiting",
      payload.run?.createdAt
    );
    void refreshReleaseAudit({ announce: false });
  } catch (error) {
    state.engineRunsError = error instanceof Error ? error.message : "Unknown engine evidence run write failure.";
    addActivity("local-api", "Engine evidence save failed", state.engineRunsError, "refuted");
  } finally {
    state.engineRunsSaving = false;
    state.engineRunsSavingMode = undefined;
    renderEngineEvidenceGate(state.safetyStatus);
  }
}

async function refreshCredibilityPack({ announce = true } = {}) {
  state.credibilityPackLoading = true;
  state.credibilityPackError = undefined;
  renderCredibilityPackPanel();

  try {
    const params = new URLSearchParams({
      requireAllEngines: "true",
      timeoutMs: "1500"
    });
    const response = await fetch(`/api/credibility-pack?${params.toString()}`, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local credibility pack API failed.");
    state.credibilityPack = payload.pack;
    state.credibilityPackPaths = payload.paths;
    state.credibilityPackError = undefined;
    if (announce) {
      addActivity(
        "local-api",
        "Loaded professor credibility pack",
        localApiSuccessMessage(payload, credibilityPackActivitySummary(payload.pack)),
        payload.pack?.status === "ready-for-review" ? "passed" : "waiting",
        payload.pack?.createdAt
      );
    }
  } catch (error) {
    state.credibilityPack = undefined;
    state.credibilityPackPaths = undefined;
    state.credibilityPackError = error instanceof Error ? error.message : "Unknown credibility pack failure.";
    if (announce) {
      addActivity("local-api", "Credibility pack unavailable", state.credibilityPackError, "waiting");
    }
  } finally {
    state.credibilityPackLoading = false;
    renderCredibilityPackPanel();
  }
}

async function writeCredibilityPackFromUi(button) {
  if (state.credibilityPackSaving) {
    return;
  }

  state.credibilityPackSaving = true;
  state.credibilityPackError = undefined;
  if (button) {
    button.disabled = true;
    button.textContent = "Writing";
  }
  renderCredibilityPackPanel();

  try {
    const response = await fetch("/api/credibility-pack", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requireAllEngines: true,
        timeoutMs: 1500
      })
    });
    const payload = await readLocalApiJson(response, "Local credibility pack write failed.");
    state.credibilityPack = payload.pack;
    state.credibilityPackPaths = payload.paths;
    state.credibilityPackError = undefined;
    addActivity(
      "local-api",
      "Wrote professor credibility pack",
      payload.activity?.[0]?.detail ?? `${payload.pack?.packId ?? "credibility pack"} saved under .truth-harness/findings.`,
      payload.pack?.status === "ready-for-review" ? "passed" : "waiting",
      payload.pack?.createdAt
    );
    void refreshCredibilityBundle({ announce: false });
    void refreshCatalogStatus({ announce: false });
    void refreshReleaseAudit({ announce: false });
  } catch (error) {
    state.credibilityPackError = error instanceof Error ? error.message : "Unknown credibility pack write failure.";
    addActivity("local-api", "Credibility pack write failed", state.credibilityPackError, "refuted");
  } finally {
    state.credibilityPackSaving = false;
    renderCredibilityPackPanel();
  }
}

async function refreshCredibilityBundle({ announce = true } = {}) {
  state.credibilityBundleLoading = true;
  state.credibilityBundleError = undefined;
  renderCredibilityPackPanel();
  renderReviewerReadinessConsole();

  try {
    const response = await fetch("/api/credibility-bundle/latest", {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local credibility bundle API failed.");
    state.credibilityBundle = payload;
    state.credibilityBundleError = undefined;
    if (payload.latest) {
      void refreshCredibilityArchive({ announce: false });
      void refreshCredibilityBundleVerificationHistory({ announce: false });
    } else {
      state.credibilityArchive = undefined;
      state.credibilityArchiveError = undefined;
      state.credibilityBundleVerifications = [];
      state.credibilityBundleVerificationsError = undefined;
    }
    if (announce) {
      addActivity(
        "local-api",
        payload.latest ? "Loaded verified reviewer bundle" : "No reviewer bundle found",
        localApiSuccessMessage(payload, credibilityBundleActivitySummary(payload)),
        credibilityBundleTrust(payload),
        payload.manifest?.createdAt
      );
    }
  } catch (error) {
    state.credibilityBundle = undefined;
    state.credibilityArchive = undefined;
    state.credibilityBundleVerifications = [];
    state.credibilityBundleError = error instanceof Error ? error.message : "Unknown credibility bundle failure.";
    if (announce) {
      addActivity("local-api", "Credibility bundle unavailable", state.credibilityBundleError, "waiting");
    }
  } finally {
    state.credibilityBundleLoading = false;
    renderCredibilityPackPanel();
    renderReviewerReadinessConsole();
    renderReport(receiptStore.get(state.receiptKey));
  }
}

async function verifyCredibilityBundleFromUi(button) {
  if (state.credibilityBundleVerifying) {
    return;
  }

  state.credibilityBundleVerifying = true;
  state.credibilityBundleVerifyError = undefined;
  if (button) {
    button.disabled = true;
    button.textContent = "Verifying";
  }
  renderCredibilityPackPanel();

  try {
    const response = await fetch("/api/credibility-bundle/latest/verify", {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local credibility bundle verification failed.");
    state.credibilityBundle = payload;
    state.credibilityBundleVerifyError = undefined;
    state.credibilityBundleVerifiedAt = payload.verifiedAt ?? new Date().toISOString();
    if (payload.latest) {
      void refreshCredibilityArchive({ announce: false });
      void refreshCredibilityBundleVerificationHistory({ announce: false });
    }
    addActivity(
      "local-api",
      payload.latest ? "Verified reviewer bundle" : "No reviewer bundle to verify",
      payload.verificationPaths?.json
        ? `Saved ${payload.verification?.verificationId ?? "bundle verification"} under .truth-harness/findings.`
        : localApiSuccessMessage(payload, credibilityBundleActivitySummary(payload)),
      credibilityBundleTrust(payload),
      payload.verifiedAt
    );
  } catch (error) {
    state.credibilityBundleVerifyError = error instanceof Error ? error.message : "Unknown credibility bundle verification failure.";
    addActivity("local-api", "Reviewer bundle verification failed", state.credibilityBundleVerifyError, "refuted");
  } finally {
    state.credibilityBundleVerifying = false;
    renderCredibilityPackPanel();
    renderReviewerReadinessConsole();
    renderReport(receiptStore.get(state.receiptKey));
  }
}

async function refreshCredibilityBundleVerificationHistory({ announce = true } = {}) {
  state.credibilityBundleVerificationsLoading = true;
  state.credibilityBundleVerificationsError = undefined;
  renderCredibilityPackPanel();

  try {
    const response = await fetch("/api/credibility-bundle/verifications?limit=8", {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local credibility bundle verification history failed.");
    state.credibilityBundleVerifications = Array.isArray(payload.verifications) ? payload.verifications : [];
    state.credibilityBundleVerificationsError = undefined;
    if (announce) {
      addActivity(
        "local-api",
        "Loaded reviewer verification history",
        `${state.credibilityBundleVerifications.length} saved bundle verification artifact(s) available.`,
        "passed"
      );
    }
  } catch (error) {
    state.credibilityBundleVerifications = [];
    state.credibilityBundleVerificationsError = error instanceof Error ? error.message : "Unknown credibility verification history failure.";
    if (announce) {
      addActivity("local-api", "Reviewer verification history unavailable", state.credibilityBundleVerificationsError, "waiting");
    }
  } finally {
    state.credibilityBundleVerificationsLoading = false;
    renderCredibilityPackPanel();
    renderReport(receiptStore.get(state.receiptKey));
  }
}

async function refreshCredibilityArchive({ announce = true } = {}) {
  state.credibilityArchiveLoading = true;
  state.credibilityArchiveError = undefined;
  renderCredibilityPackPanel();

  try {
    const response = await fetch("/api/credibility-bundle/latest/archive-metadata", {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local credibility bundle archive metadata API failed.");
    state.credibilityArchive = payload.archive;
    state.credibilityArchiveError = undefined;
    if (announce) {
      addActivity(
        "local-api",
        "Loaded reviewer archive checksum",
        `${payload.archive?.filename ?? "archive"} sha256 ${payload.archive?.sha256 ?? "unknown"}.`,
        "passed"
      );
    }
  } catch (error) {
    state.credibilityArchive = undefined;
    state.credibilityArchiveError = error instanceof Error ? error.message : "Unknown credibility archive metadata failure.";
    if (announce) {
      addActivity("local-api", "Credibility archive checksum unavailable", state.credibilityArchiveError, "waiting");
    }
  } finally {
    state.credibilityArchiveLoading = false;
    renderCredibilityPackPanel();
  }
}

async function refreshCredibilityRunNext({ announce = true } = {}) {
  state.credibilityRunNextLoading = true;
  state.credibilityRunNextError = undefined;
  renderCredibilityPackPanel();

  try {
    const params = new URLSearchParams({
      source: "credibility-actions",
      requireAllEngines: "true",
      timeoutMs: "1500"
    });
    const response = await fetch(`/api/workspace-run-next?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local credibility run-next API failed.");
    state.credibilityRunNextPlan = payload.plan;
    state.credibilityRunNextPaths = payload.paths;
    state.credibilityRunNextError = undefined;
    if (announce) {
      addActivity(
        "local-api",
        "Planned credibility reviewer action",
        localApiSuccessMessage(payload, workspaceRunNextActivitySummary(state.credibilityRunNextPlan)),
        workspaceRunNextTrust(state.credibilityRunNextPlan?.status),
        state.credibilityRunNextPlan?.createdAt
      );
    }
  } catch (error) {
    state.credibilityRunNextPlan = undefined;
    state.credibilityRunNextPaths = undefined;
    state.credibilityRunNextError = error instanceof Error ? error.message : "Unknown credibility run-next failure.";
    if (announce) {
      addActivity("local-api", "Credibility reviewer action unavailable", state.credibilityRunNextError, "waiting");
    }
  } finally {
    state.credibilityRunNextLoading = false;
    renderCredibilityPackPanel();
  }
}

async function saveCredibilityRunNextFromUi(button) {
  if (state.credibilityRunNextSaving) {
    return;
  }

  state.credibilityRunNextSaving = true;
  state.credibilityRunNextError = undefined;
  if (button) {
    button.disabled = true;
    button.textContent = "Saving";
  }
  renderCredibilityPackPanel();

  try {
    const response = await fetch("/api/workspace-run-next", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "credibility-actions",
        requireAllEngines: true,
        timeoutMs: 1500
      })
    });
    const payload = await readLocalApiJson(response, "Local credibility run-next save failed.");
    state.credibilityRunNextPlan = payload.plan;
    state.credibilityRunNextPaths = payload.paths;
    state.credibilityRunNextError = undefined;
    addActivity(
      "local-api",
      "Saved credibility reviewer plan",
      payload.activity?.[0]?.detail ?? `${payload.plan?.planId ?? "run-next plan"} saved under .truth-harness/findings.`,
      workspaceRunNextTrust(payload.plan?.status),
      payload.plan?.createdAt
    );
    void refreshCatalogStatus({ announce: false });
    void refreshWorkspaceEvents({ announce: false });
  } catch (error) {
    state.credibilityRunNextError = error instanceof Error ? error.message : "Unknown credibility run-next save failure.";
    addActivity("local-api", "Credibility reviewer plan save failed", state.credibilityRunNextError, "refuted");
  } finally {
    state.credibilityRunNextSaving = false;
    renderCredibilityPackPanel();
  }
}

async function refreshReleaseAudit({ announce = true } = {}) {
  if (!releaseAuditGate) {
    return;
  }

  state.releaseAuditLoading = true;
  state.releaseAuditError = undefined;
  state.releaseAuditArtifactPreviewPath = undefined;
  state.releaseAuditArtifactPreview = undefined;
  state.releaseAuditArtifactPreviewLoading = false;
  state.releaseAuditArtifactPreviewError = undefined;
  renderReviewerReadinessConsole();
  renderReleaseAuditGate();

  try {
    const params = new URLSearchParams({
      mode: "public-review",
      requireAllEngines: "true",
      requireSavedStrictEngineRun: "true",
      requireSandbox: "true",
      timeoutMs: "1500",
      maxReports: "50",
      compact: "true"
    });
    const response = await fetch(`/api/release-audit?${params.toString()}`, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local release audit API failed.");
    state.releaseAudit = payload.audit;
    state.releaseAuditError = undefined;
    if (announce) {
      addActivity(
        "local-api",
        "Loaded release audit",
        localApiSuccessMessage(payload, releaseAuditActivitySummary(payload.audit)),
        payload.audit?.status === "ready" ? "passed" : "waiting",
        payload.audit?.createdAt
      );
    }
  } catch (error) {
    state.releaseAudit = undefined;
    state.releaseAuditError = error instanceof Error ? error.message : "Unknown release audit failure.";
    if (announce) {
      addActivity("local-api", "Release audit unavailable", state.releaseAuditError, "waiting");
    }
  } finally {
    state.releaseAuditLoading = false;
    renderReviewerReadinessConsole();
    renderReleaseAuditGate();
  }
}

async function openWorkspaceArtifactPreview(path, { surface = "workspace" } = {}) {
  const artifactPath = normalizedWorkspaceArtifactRef(path);
  if (!artifactPath || !workspaceArtifactRefIsPreviewable(artifactPath)) {
    return;
  }

  state.workspaceArtifactPreviewSurface = surface;
  state.workspaceArtifactPreviewPath = artifactPath;
  state.workspaceArtifactPreview = undefined;
  state.workspaceArtifactPreviewError = undefined;
  state.workspaceArtifactPreviewLoading = true;
  renderWorkspaceArtifactPreviewSurface(surface);

  try {
    const params = new URLSearchParams({ path: artifactPath });
    const response = await fetch(`/api/workspace-artifact?${params.toString()}`, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local workspace artifact preview failed.");
    state.workspaceArtifactPreview = payload.artifact;
    state.workspaceArtifactPreviewError = undefined;
    addActivity(
      "local-api",
      "Opened workspace artifact",
      localApiSuccessMessage(payload, `${payload.artifact?.path ?? artifactPath} previewed read-only from .truth-harness.`),
      "passed"
    );
  } catch (error) {
    state.workspaceArtifactPreview = undefined;
    state.workspaceArtifactPreviewError = error instanceof Error ? error.message : "Unknown workspace artifact preview failure.";
    addActivity("local-api", "Workspace artifact unavailable", state.workspaceArtifactPreviewError, "waiting");
  } finally {
    state.workspaceArtifactPreviewLoading = false;
    renderWorkspaceArtifactPreviewSurface(surface);
  }
}

function renderWorkspaceArtifactPreviewSurface(surface) {
  const receipt = receiptStore.get(state.receiptKey);
  if (surface === "route-ledger" && receipt) {
    renderRouteLedger(receipt);
    return;
  }
  if (surface === "claim-evidence" && receipt) {
    renderMainGraph(receipt);
    return;
  }
  if (surface === "workspace-run-next") {
    renderWorkspaceRunNext();
    return;
  }
  if (surface === "workspace-run-next-history" || surface === "workspace-run-next-inspection") {
    renderWorkspaceRunNextHandoffs();
    return;
  }
  if (surface === "report-drafts") {
    renderReportDraftHistory(receipt);
    return;
  }
  if (surface === "saved-report-draft" && state.openedReportDraft) {
    renderSavedReportDraftPreview(state.openedReportDraft);
    return;
  }
  render();
}

async function openReleaseAuditArtifactPreview(path) {
  const artifactPath = typeof path === "string" ? path.trim() : "";
  if (!artifactPath) {
    return;
  }

  state.releaseAuditArtifactPreviewPath = artifactPath;
  state.releaseAuditArtifactPreview = undefined;
  state.releaseAuditArtifactPreviewError = undefined;
  state.releaseAuditArtifactPreviewLoading = true;
  renderReleaseAuditGate();

  try {
    const params = new URLSearchParams({ path: artifactPath });
    const response = await fetch(`/api/workspace-artifact?${params.toString()}`, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local workspace artifact preview failed.");
    state.releaseAuditArtifactPreview = payload.artifact;
    state.releaseAuditArtifactPreviewError = undefined;
    addActivity(
      "local-api",
      "Opened evidence artifact",
      localApiSuccessMessage(payload, `${payload.artifact?.path ?? artifactPath} previewed read-only from .truth-harness.`),
      "passed"
    );
  } catch (error) {
    state.releaseAuditArtifactPreview = undefined;
    state.releaseAuditArtifactPreviewError = error instanceof Error ? error.message : "Unknown workspace artifact preview failure.";
    addActivity("local-api", "Evidence artifact unavailable", state.releaseAuditArtifactPreviewError, "waiting");
  } finally {
    state.releaseAuditArtifactPreviewLoading = false;
    renderReleaseAuditGate();
  }
}

async function refreshWorkspaceReadiness({ announce = true } = {}) {
  if (!workspaceReadinessPill) {
    return;
  }

  try {
    const response = await fetch("/api/workspace-readiness", {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local workspace readiness API failed.");
    state.workspaceReadiness = payload;
    renderWorkspaceReadinessStatus();
    if (announce) {
      addActivity(
        "local-api",
        "Loaded workspace health",
        localApiSuccessMessage(payload, workspaceReadinessSummary(payload.readiness)),
        workspaceReadinessActivityTrust(payload.readiness?.status)
      );
    }
  } catch (error) {
    state.workspaceReadiness = {
      error: error instanceof Error ? error.message : "Unknown workspace readiness failure."
    };
    renderWorkspaceReadinessStatus();
    addActivity("local-api", "Workspace health unavailable", state.workspaceReadiness.error, "waiting");
  }
}

async function refreshWorkspaceMaintenance({ announce = false } = {}) {
  if (!maintenanceStatus) {
    return;
  }

  state.maintenanceLoading = true;
  state.maintenanceError = undefined;
  renderMaintenancePanel();

  try {
    const response = await fetch("/api/workspace-maintenance", {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local workspace maintenance API failed.");
    state.maintenance = payload.maintenance;
    state.maintenanceError = undefined;
    if (announce) {
      addActivity(
        "local-api",
        "Checked workspace maintenance",
        localApiSuccessMessage(payload, maintenanceSummary(payload.maintenance)),
        payload.maintenance?.validation?.passed ? "passed" : "waiting"
      );
    }
  } catch (error) {
    state.maintenance = undefined;
    state.maintenanceError = error instanceof Error ? error.message : "Unknown workspace maintenance failure.";
    addActivity("local-api", "Workspace maintenance unavailable", state.maintenanceError, "waiting");
  } finally {
    state.maintenanceLoading = false;
    renderMaintenancePanel();
  }
}

async function repairWorkspaceArtifactsFromUi({ preview = false } = {}) {
  if (state.maintenanceLoading) {
    return;
  }

  state.maintenanceLoading = true;
  state.maintenanceError = undefined;
  renderMaintenancePanel();
  addActivity(
    "human",
    preview ? "Previewing artifact repair" : "Repairing artifact metadata",
    preview
      ? "Local API will inspect legacy JSON metadata without writing files."
      : "Local API will repair known legacy artifact metadata without changing trust labels.",
    "waiting"
  );

  try {
    const response = await fetch("/api/workspace-maintenance/repair-artifacts", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ preview })
    });
    const payload = await readLocalApiJson(response, "Workspace artifact repair failed.");
    updateLatestActivity(
      preview ? "Previewing artifact repair" : "Repairing artifact metadata",
      "passed",
      localApiSuccessMessage(payload, `${payload.repair?.actions?.length ?? 0} artifact metadata action(s) ${preview ? "previewed" : "applied"}.`)
    );
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    await refreshWorkspaceMaintenance({ announce: false });
    await refreshWorkspaceReadiness({ announce: false });
    await refreshWorkspaceGraph();
  } catch (error) {
    state.maintenanceError = error instanceof Error ? error.message : "Unknown workspace artifact repair failure.";
    updateLatestActivity(preview ? "Previewing artifact repair" : "Repairing artifact metadata", "refuted", state.maintenanceError);
  } finally {
    state.maintenanceLoading = false;
    renderMaintenancePanel();
  }
}

async function cleanWorkspaceFromUi({ confirmDelete = false } = {}) {
  if (state.maintenanceLoading) {
    return;
  }

  if (confirmDelete) {
    const confirmed = window.confirm(
      "Clear rebuildable scratch data under .truth-harness/indexes, .truth-harness/validation, and .truth-harness/snapshots? Receipts, claims, routes, notes, and research records are preserved."
    );
    if (!confirmed) {
      return;
    }
  }

  state.maintenanceLoading = true;
  state.maintenanceError = undefined;
  renderMaintenancePanel();
  addActivity(
    "human",
    confirmDelete ? "Clearing scratch workspace data" : "Previewing workspace cleanup",
    confirmDelete
      ? "Only scratch directories selected by the workspace manifest will be cleared."
      : "Local API will report scratch cleanup impact without deleting files.",
    "waiting"
  );

  try {
    const response = await fetch("/api/workspace-maintenance/clean", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        targets: ["scratch"],
        confirmDelete
      })
    });
    const payload = await readLocalApiJson(response, "Workspace cleanup failed.");
    updateLatestActivity(
      confirmDelete ? "Clearing scratch workspace data" : "Previewing workspace cleanup",
      "passed",
      localApiSuccessMessage(payload, maintenanceCleanSummary(payload.clean))
    );
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    await refreshWorkspaceMaintenance({ announce: false });
    await refreshCatalogStatus({ announce: false });
    await refreshWorkspaceReadiness({ announce: false });
    await refreshWorkspaceEvents({ announce: false });
  } catch (error) {
    state.maintenanceError = error instanceof Error ? error.message : "Unknown workspace cleanup failure.";
    updateLatestActivity(confirmDelete ? "Clearing scratch workspace data" : "Previewing workspace cleanup", "refuted", state.maintenanceError);
  } finally {
    state.maintenanceLoading = false;
    renderMaintenancePanel();
  }
}

async function archiveWorkspaceScratchFromUi() {
  if (state.maintenanceLoading) {
    return;
  }

  state.maintenanceLoading = true;
  state.maintenanceError = undefined;
  renderMaintenancePanel();
  addActivity(
    "human",
    "Archiving scratch workspace data",
    "Local API will copy rebuildable scratch directories into .truth-harness/archives before any cleanup.",
    "waiting"
  );

  try {
    const response = await fetch("/api/workspace-maintenance/archive", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        targets: ["scratch"],
        reason: "web scratch maintenance"
      })
    });
    const payload = await readLocalApiJson(response, "Workspace archive failed.");
    updateLatestActivity(
      "Archiving scratch workspace data",
      "passed",
      localApiSuccessMessage(payload, maintenanceArchiveSummary(payload.archive))
    );
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    await refreshWorkspaceMaintenance({ announce: false });
    await refreshWorkspaceEvents({ announce: false });
  } catch (error) {
    state.maintenanceError = error instanceof Error ? error.message : "Unknown workspace archive failure.";
    updateLatestActivity("Archiving scratch workspace data", "refuted", state.maintenanceError);
  } finally {
    state.maintenanceLoading = false;
    renderMaintenancePanel();
  }
}

async function refreshCatalogStatus({ announce = false } = {}) {
  if (!catalogSearchStatus) {
    return;
  }

  try {
    const response = await fetch("/api/catalog/status", {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local catalog status API failed.");
    state.catalogStatus = payload.catalog;
    state.catalogError = undefined;
    renderCatalogSearchPanel();
    if (announce) {
      addActivity(
        "local-api",
        "Loaded catalog status",
        localApiSuccessMessage(payload, catalogStatusSummary(payload.catalog)),
        payload.catalog?.readable ? "passed" : "waiting"
      );
    }
  } catch (error) {
    state.catalogStatus = undefined;
    state.catalogError = error instanceof Error ? error.message : "Unknown catalog status failure.";
    renderCatalogSearchPanel();
    addActivity("local-api", "Catalog status unavailable", state.catalogError, "waiting");
  }
}

async function rebuildCatalogIndex() {
  if (!catalogRebuildButton || state.catalogRebuildLoading) {
    return;
  }

  state.catalogRebuildLoading = true;
  state.catalogError = undefined;
  renderCatalogSearchPanel();
  addActivity("human", "Rebuilding catalog", "Local SQLite catalog is being rebuilt from canonical .truth-harness JSON artifacts.", "waiting");

  try {
    const response = await fetch("/api/catalog/rebuild", {
      method: "POST",
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readLocalApiJson(response, "Local catalog rebuild failed.");
    state.catalogStatus = payload.catalog;
    state.catalogSearch = undefined;
    updateLatestActivity(
      "Rebuilding catalog",
      "passed",
      localApiSuccessMessage(payload, `${payload.rebuild?.artifactCount ?? 0} artifacts indexed; canonical JSON remains authoritative.`)
    );
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    await refreshCatalogSearch({ force: true, announce: false });
  } catch (error) {
    state.catalogError = error instanceof Error ? error.message : "Unknown catalog rebuild failure.";
    updateLatestActivity("Rebuilding catalog", "refuted", state.catalogError);
  } finally {
    state.catalogRebuildLoading = false;
    renderCatalogSearchPanel();
  }
}

function scheduleCatalogSearch() {
  window.clearTimeout(catalogSearchTimer);
  catalogSearchTimer = window.setTimeout(() => {
    void refreshCatalogSearch();
  }, 220);
}

async function refreshCatalogSearch({ force = false, announce = false } = {}) {
  if (!catalogResultList) {
    return;
  }

  const query = state.sidebarQuery.trim();
  const refFilter = normalizedWorkspaceArtifactRef(state.catalogRefFilter);
  const hasRefFilter = Boolean(refFilter);
  if (!force && !hasRefFilter && query.length < 2) {
    state.catalogSearch = undefined;
    state.catalogError = undefined;
    renderCatalogSearchPanel();
    return;
  }

  if (!state.catalogStatus?.readable && !force) {
    renderCatalogSearchPanel();
    return;
  }

  state.catalogSearchLoading = true;
  state.catalogError = undefined;
  renderCatalogSearchPanel();

  try {
    const params = new URLSearchParams();
    if (hasRefFilter) {
      params.set("ref", refFilter);
    } else if (query) {
      params.set("query", query);
    }
    params.set("limit", hasRefFilter ? "20" : "8");
    const response = await fetch(`/api/catalog/search?${params.toString()}`, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local catalog search failed.");
    state.catalogSearch = payload.search;
    state.catalogError = undefined;
    if (announce) {
      addActivity(
        "local-api",
        "Searched catalog",
        localApiSuccessMessage(
          payload,
          hasRefFilter
            ? `${payload.search?.total ?? 0} catalog rows cite ${refFilter}.`
            : `${payload.search?.total ?? 0} catalog rows matched ${query || "all indexed artifacts"}.`
        ),
        "passed"
      );
    }
  } catch (error) {
    state.catalogSearch = undefined;
    state.catalogError = error instanceof Error ? error.message : "Unknown catalog search failure.";
  } finally {
    state.catalogSearchLoading = false;
    renderCatalogSearchPanel();
    applySidebarSearch();
  }
}

function renderCatalogSearchPanel() {
  if (!catalogSearchStatus || !catalogRebuildButton || !catalogResultList) {
    return;
  }

  const query = state.sidebarQuery.trim();
  const refFilter = normalizedWorkspaceArtifactRef(state.catalogRefFilter);
  const hasRefFilter = Boolean(refFilter);
  const searchFocused = document.activeElement === sidebarSearch;
  const quietStatus = !hasRefFilter && query.length === 0 && !searchFocused && !state.catalogSearchLoading && !state.catalogError;
  const catalog = state.catalogStatus;
  const results = state.catalogSearch?.results ?? [];
  catalogRebuildButton.disabled = state.catalogRebuildLoading;
  catalogRebuildButton.textContent = state.catalogRebuildLoading ? "Rebuilding" : "Rebuild";
  catalogSearchStatus.textContent = state.catalogSearchLoading
    ? hasRefFilter ? "catalog citations" : "catalog searching"
    : state.catalogError
      ? "catalog needs attention"
      : hasRefFilter ? "cited-by lookup" : catalogStatusSummary(catalog);
  catalogResultList.hidden = false;

  if (quietStatus) {
    catalogResultList.hidden = true;
    catalogResultList.innerHTML = "";
    clearCatalogArtifactPreview();
    return;
  }

  if (state.catalogError) {
    catalogResultList.innerHTML = `<div class="sidebar-empty">${escapeHtml(state.catalogError)}</div>`;
    clearCatalogArtifactPreview();
    return;
  }

  if (!catalog) {
    catalogResultList.innerHTML = `<div class="sidebar-empty">Checking local catalog status.</div>`;
    clearCatalogArtifactPreview();
    return;
  }

  if (!catalog.readable) {
    catalogResultList.innerHTML = `<div class="sidebar-empty">Rebuild the local catalog to search receipts, routes, claims, visuals, and reviews.</div>`;
    clearCatalogArtifactPreview();
    return;
  }

  if (catalog.stale) {
    const freshness = catalog.freshness;
    const detail = freshness?.checked
      ? `${freshness.changedArtifacts ?? 0} changed, ${freshness.newArtifacts ?? 0} new, ${freshness.missingArtifacts ?? 0} missing.`
      : "Freshness was not checked.";
    catalogResultList.innerHTML = `<div class="sidebar-empty">Catalog is stale. Rebuild before relying on search completeness. ${escapeHtml(detail)}</div>`;
    clearCatalogArtifactPreview();
    return;
  }

  if (!hasRefFilter && query.length < 2) {
    catalogResultList.innerHTML = `<div class="sidebar-empty">Type 2+ characters to search ${catalog.artifactCount ?? 0} indexed artifacts.</div>`;
    clearCatalogArtifactPreview();
    return;
  }

  if (state.catalogSearchLoading) {
    catalogResultList.innerHTML = hasRefFilter
      ? `${catalogRefFilterHtml(refFilter)}<div class="sidebar-empty">Finding local artifacts that cite this ref.</div>`
      : `<div class="sidebar-empty">Searching local catalog.</div>`;
    clearCatalogArtifactPreview();
    return;
  }

  const refFilterHtml = hasRefFilter ? catalogRefFilterHtml(refFilter) : "";
  const emptyHtml = hasRefFilter
    ? `<div class="sidebar-empty">No indexed artifacts cite this ref yet.</div>`
    : `<div class="sidebar-empty">No catalog rows match this search.</div>`;
  catalogResultList.innerHTML = `${refFilterHtml}${results.length === 0
    ? emptyHtml
    : results.map(catalogResultHtml).join("")}`;
  renderCatalogArtifactPreview();
}

function catalogRefFilterHtml(refFilter) {
  return `<div class="catalog-ref-filter">
    <div>
      <span class="mini-label">cited by</span>
      <code>${escapeHtml(refFilter)}</code>
    </div>
    <button class="text-button compact-button clear-catalog-ref-filter" type="button">Clear</button>
  </div>`;
}

function clearCatalogArtifactPreview() {
  if (!catalogArtifactPreview) {
    return;
  }
  catalogArtifactPreview.hidden = true;
  catalogArtifactPreview.innerHTML = "";
}

function renderCatalogArtifactPreview() {
  if (!catalogArtifactPreview) {
    return;
  }
  const html = workspaceArtifactPreviewHtml("catalog-search", { emptyHtml: "" });
  catalogArtifactPreview.hidden = html.trim().length === 0;
  catalogArtifactPreview.innerHTML = html;
}

function catalogResultHtml(row) {
  const title = row.title || row.summary || row.artifactId || row.path;
  const subtitle = [row.path, row.summary].filter(Boolean).join(" - ");
  const artifactRefsHtml = catalogArtifactRefsSummaryHtml(row);
  return `<button class="catalog-result-row" data-catalog-kind="${escapeHtml(row.kind)}" data-catalog-artifact-id="${escapeHtml(row.artifactId ?? "")}" data-catalog-path="${escapeHtml(row.path)}" type="button">
    <strong>${escapeHtml(title)}</strong>
    <small>${escapeHtml(subtitle || row.kind)}</small>
    <span class="catalog-result-meta">
      <span>${escapeHtml(row.kind)}</span>
      ${row.trust ? `<span>${escapeHtml(row.trust)}</span>` : ""}
      ${row.domain ? `<span>${escapeHtml(row.domain)}</span>` : ""}
    </span>
    ${artifactRefsHtml}
  </button>`;
}

function catalogArtifactRefsSummaryHtml(row) {
  const refs = Array.isArray(row.artifactRefs) ? row.artifactRefs : [];
  if (refs.length === 0) {
    return "";
  }

  const visibleRefs = refs.slice(0, 2);
  const summary = visibleRefs
    .map((ref) => {
      const hash = ref.sha256 ? ` sha ${shortHash(ref.sha256)}` : "";
      return `${ref.role}: ${ref.path}${hash}`;
    })
    .join(" | ");
  const hidden = refs.length > visibleRefs.length ? ` | +${refs.length - visibleRefs.length} more` : "";
  return `<span class="catalog-result-refs" title="${escapeHtml(refs.map((ref) => ref.citation || ref.path).join("\n"))}">
    ${escapeHtml(`${refs.length} local artifact ${refs.length === 1 ? "ref" : "refs"} - ${summary}${hidden}`)}
  </span>`;
}

function catalogStatusSummary(catalog) {
  if (!catalog) {
    return "catalog checking";
  }
  if (!catalog.exists) {
    return "catalog missing";
  }
  if (!catalog.readable) {
    return "catalog unreadable";
  }
  if (catalog.stale) {
    return "catalog stale";
  }
  return `${catalog.artifactCount ?? 0} indexed`;
}

function renderMaintenancePanel() {
  if (!maintenanceStatus || !maintenanceMetrics || !maintenanceDetail) {
    return;
  }

  const maintenance = state.maintenance;
  const repairActions = maintenance?.artifactRepair?.actions?.length ?? 0;
  const scratchFiles = maintenance?.scratchCleanup?.entries?.reduce((sum, entry) => sum + (entry.files ?? 0), 0) ?? 0;
  const scratchBytes = maintenance?.scratchCleanup?.entries?.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0) ?? 0;
  const archiveCount = maintenance?.archives?.total ?? 0;
  const validation = maintenance?.validation;
  const buttons = [
    maintenanceRefreshButton,
    maintenanceRepairPreviewButton,
    maintenanceRepairApplyButton,
    maintenanceCleanPreviewButton,
    maintenanceArchiveScratchButton,
    maintenanceCleanScratchButton
  ].filter(Boolean);

  for (const button of buttons) {
    button.disabled = state.maintenanceLoading;
  }

  if (state.maintenanceLoading && !maintenance) {
    maintenanceStatus.textContent = "checking";
    maintenanceMetrics.innerHTML = `<span>Validation</span><strong>checking</strong>`;
    maintenanceDetail.textContent = "Reading local workspace maintenance state.";
    return;
  }

  if (state.maintenanceError) {
    maintenanceStatus.textContent = "needs attention";
    maintenanceMetrics.innerHTML = `<span>Local API</span><strong>unavailable</strong>`;
    maintenanceDetail.textContent = state.maintenanceError;
    return;
  }

  if (!maintenance) {
    maintenanceStatus.textContent = "not checked";
    maintenanceMetrics.innerHTML = `<span>Validation</span><strong>not checked</strong>`;
    maintenanceDetail.textContent = "Use Check to preview local repair and scratch cleanup impact.";
    return;
  }

  const healthy = validation?.passed === true && repairActions === 0;
  maintenanceStatus.textContent = healthy ? "healthy" : repairActions > 0 ? "repair available" : "checked";
  maintenanceMetrics.innerHTML = `
    <span>${validation?.passed ? "Validation passed" : "Validation blocked"}</span>
    <strong>${validation?.checkedFiles ?? 0} files / ${scratchFiles} scratch</strong>
  `;
  maintenanceDetail.textContent = repairActions > 0
    ? `${repairActions} artifact metadata repair action${repairActions === 1 ? "" : "s"} available. Scratch preview: ${formatBytes(scratchBytes)}. Archives: ${archiveCount}.`
    : `No metadata repairs pending. Scratch preview: ${scratchFiles} file${scratchFiles === 1 ? "" : "s"}, ${formatBytes(scratchBytes)}. Archives: ${archiveCount}.`;
}

function maintenanceSummary(maintenance) {
  if (!maintenance) {
    return "Workspace maintenance state unavailable.";
  }

  const repairActions = maintenance.artifactRepair?.actions?.length ?? 0;
  const scratchFiles = maintenance.scratchCleanup?.entries?.reduce((sum, entry) => sum + (entry.files ?? 0), 0) ?? 0;
  const archiveCount = maintenance.archives?.total ?? 0;
  const validation = maintenance.validation;
  return `${validation?.passed ? "Validation passed" : "Validation needs attention"} across ${validation?.checkedFiles ?? 0} files; ${repairActions} repair actions pending; ${scratchFiles} scratch files previewed; ${archiveCount} local archives.`;
}

function maintenanceCleanSummary(clean) {
  if (!clean) {
    return "Workspace cleanup result unavailable.";
  }

  const files = clean.dryRun
    ? clean.entries?.reduce((sum, entry) => sum + (entry.files ?? 0), 0) ?? 0
    : clean.deletedFiles ?? 0;
  const bytes = clean.dryRun
    ? clean.entries?.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0) ?? 0
    : clean.deletedBytes ?? 0;
  return clean.dryRun
    ? `${files} scratch file${files === 1 ? "" : "s"} (${formatBytes(bytes)}) would be cleared; no files deleted.`
    : `${files} scratch file${files === 1 ? "" : "s"} (${formatBytes(bytes)}) deleted from selected .truth-harness directories.`;
}

function maintenanceArchiveSummary(archive) {
  if (!archive) {
    return "Workspace archive result unavailable.";
  }

  const files = archive.archivedFiles ?? 0;
  const bytes = archive.archivedBytes ?? 0;
  const path = archive.archiveDir ?? ".truth-harness/archives";
  return `${files} file${files === 1 ? "" : "s"} (${formatBytes(bytes)}) archived locally at ${path}; no files deleted.`;
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let scaled = value;
  let unitIndex = 0;
  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled /= 1024;
    unitIndex += 1;
  }

  return `${unitIndex === 0 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[unitIndex]}`;
}

function openCatalogResult(button) {
  const kind = button.dataset.catalogKind;
  const artifactId = button.dataset.catalogArtifactId;
  const path = button.dataset.catalogPath;
  const previewPath = normalizedWorkspaceArtifactRef(path);

  if (kind === "routes" && artifactId) {
    void openSavedRoute(artifactId);
    return;
  }

  if (kind === "claims" && artifactId) {
    const key = receiptKeyForClaimId(artifactId);
    if (key) {
      setReplayPlaying(false);
      state.receiptKey = key;
      state.level = "middle";
      state.selectedGraphIndex = 0;
      state.replayIndex = 0;
      promptInput.value = receiptStore.get(state.receiptKey)?.title ?? promptInput.value;
      render();
      return;
    }
  }

  if (workspaceArtifactRefIsPreviewable(previewPath)) {
    void openWorkspaceArtifactPreview(previewPath, { surface: "catalog-search" });
    return;
  }

  addActivity("human", "Opened catalog row", `${artifactId || path || kind} is indexed locally; open the matching artifact from its ledger or CLI path.`, "waiting");
}

async function searchCatalogCitations(ref) {
  const refFilter = normalizedWorkspaceArtifactRef(ref);
  if (!refFilter) {
    addActivity("human", "Cited-by lookup skipped", "No local artifact reference was available for this row.", "waiting");
    return;
  }

  state.catalogRefFilter = refFilter;
  state.catalogSearch = undefined;
  state.catalogError = undefined;
  if (sidebarSearch) {
    sidebarSearch.value = "";
  }
  state.sidebarQuery = "";
  renderClaimList();
  applySidebarSearch();
  await refreshCatalogSearch({ force: true, announce: true });
}

function clearCatalogCitationSearch() {
  state.catalogRefFilter = undefined;
  state.catalogSearch = undefined;
  state.catalogError = undefined;
  renderCatalogSearchPanel();
  scheduleCatalogSearch();
}

function renderSafetyStatus() {
  if (!safetyStatusPill || !safetyDetails || !safetyNotes) {
    return;
  }

  const payload = state.safetyStatus;
  if (!payload) {
    safetyStatusPill.textContent = "checking";
    safetyStatusPill.className = "status-pill waiting";
    safetyDetails.innerHTML = `<div><dt>Sandbox</dt><dd>checking local status</dd></div>`;
    safetyNotes.innerHTML = `<li>Loading local execution boundary.</li>`;
    renderEngineReadinessStatus(payload);
    return;
  }

  if (payload.error) {
    safetyStatusPill.textContent = "unavailable";
    safetyStatusPill.className = "status-pill refuted";
    safetyDetails.innerHTML = `<div><dt>Status</dt><dd>local API unavailable</dd></div>`;
    safetyNotes.innerHTML = `<li>${escapeHtml(payload.error)}</li>`;
    renderEngineReadinessStatus(payload);
    return;
  }

  const safety = payload.safety ?? {};
  const sandbox = safety.codeRunSandbox ?? {};
  const mcp = safety.mcpCodeRun ?? {};
  const webServer = safety.webServer ?? {};
  const runtime = runtimeIdentityForUi(payload);
  const attested = sandbox.canAttestNetworkNone === true;
  const exposed = mcp.exposed === true;
  const unsandboxedAllowed = mcp.unsandboxedAllowed === true;
  const mcpState = !exposed ? "disabled by default" : unsandboxedAllowed ? "unsandboxed opt-in" : "sandbox gated";
  const webGuardState = webServer.localHostGuard === false ? "non-local opt-in" : "local host + same-origin";
  const bodyLimit = Number.isFinite(webServer.maxJsonBodyBytes)
    ? `${Math.round(webServer.maxJsonBodyBytes / 1024)} KiB JSON`
    : "not reported";
  const modelCallState = payload.externalCalls ? "external calls possible" : "none from local API";
  const rows = [
    ["Runtime", runtime.label],
    ["Project root", runtime.projectRootLabel],
    ["Local API", payload.localOnly ? "local only" : "check config"],
    ["Browser guard", webGuardState],
    ["API body limit", bodyLimit],
    ["Code run", `${formatSafetyPhrase(sandbox.provider)} / ${formatSafetyPhrase(sandbox.processSandbox)}`],
    ["Network", attested ? "none attested" : formatSafetyPhrase(sandbox.networkIsolation)],
    ["MCP tool", mcpState],
    ["Model calls", modelCallState]
  ];

  safetyStatusPill.textContent = attested ? "sandbox-attested" : "needs sandbox";
  safetyStatusPill.className = `status-pill ${attested ? "exact" : "waiting"}`;
  safetyDetails.innerHTML = rows
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");

  const noteCandidates = [
    runtime.staleHint,
    sandbox.reason,
    webServer.recommendation,
    mcp.recommendation,
    ...(Array.isArray(sandbox.notes) ? sandbox.notes : [])
  ].filter(Boolean);
  const notes = noteCandidates.length > 0 ? noteCandidates.slice(0, 3) : ["No local safety metadata was returned."];
  safetyNotes.innerHTML = notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  renderEngineReadinessStatus(payload);
}

function runtimeIdentityForUi(payload) {
  const reported = payload?.runtime;
  if (reported && typeof reported === "object") {
    return {
      label: runtimeKindLabel(reported.runtimeKind),
      projectRootLabel: compactRuntimePathForUi(reported.projectRoot),
      staleHint: reported.staleHint ?? "Runtime identity was reported by the local web API."
    };
  }

  const sandbox = payload?.safety?.codeRunSandbox ?? {};
  const webServer = payload?.safety?.webServer ?? {};
  const containerLike = sandbox.platform === "linux" && webServer.bindHost === "0.0.0.0";
  return {
    label: containerLike ? "probable Docker/container" : "legacy local API",
    projectRootLabel: "not reported",
    staleHint: containerLike
      ? "This API build does not expose runtime identity. If source looks stale, rebuild or restart Docker."
      : "This API build does not expose runtime identity. Restart the local web server after source changes."
  };
}

function runtimeKindLabel(kind) {
  switch (kind) {
    case "docker-container":
      return "Docker /workspace";
    case "windows-host":
      return "Windows host repo";
    case "local-host":
      return "local host repo";
    default:
      return formatSafetyPhrase(kind ?? "local API");
  }
}

function compactRuntimePathForUi(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "not reported";
  }
  const normalized = text.replace(/\\/gu, "/");
  if (normalized === "/workspace" || normalized.startsWith("/workspace/")) {
    return normalized;
  }
  const marker = "/AntigravityProjects/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex >= 0) {
    return `...${normalized.slice(markerIndex)}`;
  }
  return normalized.length > 54 ? `...${normalized.slice(-51)}` : normalized;
}

function renderWorkspaceReadinessStatus(payload = state.workspaceReadiness) {
  if (!workspaceReadinessPill || !workspaceReadinessDetails || !workspaceReadinessNotes) {
    return;
  }

  if (!payload) {
    workspaceReadinessPill.textContent = "checking";
    workspaceReadinessPill.className = "status-pill waiting";
    workspaceReadinessDetails.innerHTML = `<div><dt>Project</dt><dd>checking local workspace</dd></div>`;
    workspaceReadinessNotes.innerHTML = `<li>Validation, queue, graph, and stress guidance load from the local API.</li>`;
    return;
  }

  if (payload.error) {
    workspaceReadinessPill.textContent = "unavailable";
    workspaceReadinessPill.className = "status-pill refuted";
    workspaceReadinessDetails.innerHTML = `<div><dt>Status</dt><dd>local API unavailable</dd></div>`;
    workspaceReadinessNotes.innerHTML = `<li>${escapeHtml(payload.error)}</li>`;
    return;
  }

  const readiness = payload.readiness ?? payload;
  const validation = readiness.summary?.validation ?? {};
  const review = readiness.summary?.review ?? {};
  const graph = readiness.summary?.graph ?? {};
  const gates = Array.isArray(readiness.gates) ? readiness.gates : [];
  const status = readiness.status ?? "unknown";
  const stressGate = gates.find((gate) => gate.id === "stress-fixture");
  const rows = [
    ["Status", workspaceReadinessLabel(status)],
    ["Validation", `${validation.passed ? "passed" : "failed"} / ${validation.errors ?? 0} errors`],
    ["Files", `${validation.checkedFiles ?? 0} checked / ${validation.invalidFiles ?? 0} invalid`],
    ["Graph", `${graph.nodes ?? 0} nodes / ${graph.edges ?? 0} edges / ${graph.missingRefs ?? 0} missing refs`],
    ["Queue", `${review.totalItems ?? 0} open / ${review.criticalItems ?? 0} critical`],
    ["Stress", stressGate?.command ?? readiness.commands?.stress ?? "run workspace stress from CLI"]
  ];

  workspaceReadinessPill.textContent = workspaceReadinessLabel(status);
  workspaceReadinessPill.className = `status-pill ${workspaceReadinessClass(status)}`;
  workspaceReadinessDetails.innerHTML = rows
    .map(([label, value]) => {
      const rowClass = label === "Stress" ? ` class="wide-value"` : "";
      return `<div${rowClass}><dt>${escapeHtml(label)}</dt><dd>${workspaceReadinessValueHtml(label, value)}</dd></div>`;
    })
    .join("");

  const gateNotes = gates
    .filter((gate) => gate.status !== "passed")
    .map((gate) => `${gate.label}: ${gate.detail}`);
  const notes = [
    ...gateNotes,
    ...(Array.isArray(readiness.warnings) ? readiness.warnings : [])
  ];
  workspaceReadinessNotes.innerHTML = (notes.length > 0 ? notes.slice(0, 5) : ["No workspace readiness notes returned."])
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");
}

function renderReviewerReadinessConsole() {
  if (!reviewerReadinessConsole) {
    return;
  }

  const audit = state.releaseAudit;
  const bundlePayload = state.credibilityBundle;
  const manifest = bundlePayload?.manifest;
  const bundleVerification = audit?.reviewerBundleVerification ?? bundlePayload?.verification;
  const auditCommand = audit?.commands?.releaseAudit ?? "truth-harness workspace release-audit . --require-all-engines --require-saved-strict-engine-run --require-sandbox";
  const strictProfessorCommand = audit?.commands?.dockerProfessorAll ?? manifest?.reviewerCommands?.dockerStrictProfessorEvidence ?? "npm run docker:professor:all";
  const dockerProfessorCommand = audit?.commands?.dockerProfessor ?? manifest?.reviewerCommands?.dockerProfessorEvidence ?? "npm run docker:professor";
  const leanRepairCommand = audit?.commands?.dockerLeanRepairGate ?? manifest?.reviewerCommands?.dockerLeanRepairGate ?? "npm run docker:proof-repair";
  const bundleVerifyCommand = bundlePayload?.command ??
    manifest?.reviewerCommands?.verifyBundle ??
    "truth-harness workspace verify-credibility-bundle . <bundle-ref> --write";
  const loading = state.releaseAuditLoading || state.credibilityBundleLoading || state.credibilityBundleVerifying;
  const errors = [
    state.releaseAuditError,
    state.credibilityBundleError,
    state.credibilityBundleVerifyError
  ].filter(Boolean);
  const bundleClean = reviewerBundleVerificationClean(bundleVerification);
  const strictEngineCheck = releaseAuditCheckById(audit, "saved-strict-engine-run");
  const engineCheck = releaseAuditCheckById(audit, "engine-evidence");
  const hardMathCheck = releaseAuditCheckById(audit, "hard-math-closure");
  const leanSafetyCheck = releaseAuditCheckById(audit, "lean-proof-safety");
  const sandboxCheck = releaseAuditCheckById(audit, "code-run-sandbox");
  const bundleCheck = releaseAuditCheckById(audit, "reviewer-bundle-verification");
  const nextCommand = reviewerReadinessNextCommand({
    audit,
    bundleClean,
    strictProfessorCommand,
    dockerProfessorCommand,
    leanRepairCommand,
    bundleVerifyCommand,
    auditCommand
  });
  const status = reviewerReadinessStatus({ audit, bundleClean, loading, errors });
  const statusClass = status === "ready" ? "exact" : status === "checking" ? "waiting" : "refuted";
  const headline = status === "ready"
    ? "Ready for serious outside review"
    : status === "checking"
      ? "Checking reviewer evidence"
      : "Not ready for professor review yet";
  const detail = status === "ready"
    ? "Strict local evidence, reviewer bundle integrity, and source-workspace match are all visible from one place."
    : errors.length > 0
      ? errors[0]
      : "The console fails closed until strict evidence, bundle verification, and source workspace match are all present.";
  const cards = [
    reviewerReadinessCard({
      label: "Professor gate",
      value: audit?.professorReady ? "ready" : loading ? "checking" : "blocked",
      status: audit?.professorReady ? "pass" : loading ? "warn" : "fail",
      detail: audit ? `${audit.summary?.blockingFailures ?? 0} blocking failure${audit.summary?.blockingFailures === 1 ? "" : "s"}` : "Release audit has not loaded yet.",
      command: auditCommand
    }),
    reviewerReadinessCard({
      label: "Reviewer bundle",
      value: audit ? releaseAuditReviewerBundleSummary(audit) : bundlePayload?.latest ? credibilityBundleCopiedFilesLabel(bundlePayload.verification) : "not exported",
      status: bundleClean ? "pass" : bundlePayload?.latest || audit ? "warn" : "fail",
      detail: reviewerBundleVerificationDetail(bundleVerification),
      command: bundleVerifyCommand
    }),
    reviewerReadinessCard({
      label: "Lean repair gate",
      value: leanSafetyCheck?.status === "pass" && hardMathCheck?.status === "pass" ? "gated" : "run gate",
      status: leanSafetyCheck?.status === "pass" && hardMathCheck?.status === "pass" ? "pass" : "warn",
      detail: "Runs the no-network proof-repair fixture before reviewer packets are trusted.",
      command: leanRepairCommand
    }),
    reviewerReadinessCard({
      label: "Strict engines",
      value: strictEngineCheck?.status === "pass" ? "saved" : engineCheck?.status === "pass" ? "core saved" : "missing",
      status: strictEngineCheck?.status ?? engineCheck?.status ?? "fail",
      detail: strictEngineCheck?.summary ?? engineCheck?.summary ?? "Maxima, Z3, cvc5, Lean, and Sage evidence must be saved for strict review.",
      command: strictProfessorCommand
    }),
    reviewerReadinessCard({
      label: "Sandbox",
      value: sandboxCheck?.status === "pass" ? "measured" : sandboxCheck?.status === "warn" ? "warning" : "not measured",
      status: sandboxCheck?.status ?? "warn",
      detail: sandboxCheck?.summary ?? "Code-run claims should not be trusted without measured sandbox evidence.",
      command: auditCommand
    })
  ];
  const blockers = reviewerReadinessBlockers(audit, bundleClean);

  reviewerReadinessConsole.innerHTML = `
    <div class="reviewer-readiness-head">
      <div>
        <span class="mini-label">reviewer readiness</span>
        <h3>${escapeHtml(headline)}</h3>
        <p>${escapeHtml(detail)}</p>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(reviewerReadinessStatusLabel(status))}</span>
    </div>
    <div class="reviewer-readiness-main">
      <section class="reviewer-readiness-next">
        <span class="mini-label">next safest action</span>
        <strong>${escapeHtml(reviewerReadinessNextLabel({ audit, bundleClean, errors }))}</strong>
        <code>${escapeHtml(nextCommand)}</code>
        <div class="reviewer-readiness-actions">
          <button class="text-button compact-button strong-action copy-reviewer-readiness-command" data-testid="copy-reviewer-readiness-next-command" data-command="${escapeHtml(nextCommand)}" type="button">Copy next</button>
          <button class="text-button compact-button refresh-release-audit-from-console" data-testid="refresh-reviewer-readiness" type="button" ${state.releaseAuditLoading ? "disabled" : ""}>${state.releaseAuditLoading ? "Refreshing" : "Refresh"}</button>
        </div>
      </section>
      <div class="reviewer-readiness-grid">
        ${cards.join("")}
      </div>
    </div>
    <details class="reviewer-readiness-blockers" ${blockers.length > 0 ? "open" : ""}>
      <summary>
        <strong>Open blockers</strong>
        <span>${blockers.length} item${blockers.length === 1 ? "" : "s"}</span>
      </summary>
      ${blockers.length > 0 ? `<ul>${blockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join("")}</ul>` : "<p>No reviewer blockers are visible from the latest local audit.</p>"}
    </details>
  `;

  reviewerReadinessConsole.querySelector(".refresh-release-audit-from-console")?.addEventListener("click", () => {
    void refreshReleaseAudit({ announce: true });
    void refreshCredibilityBundle({ announce: false });
  });
  reviewerReadinessConsole.querySelectorAll(".copy-reviewer-readiness-command").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      void copyOrDownloadText({
        button: target,
        text: `${target.dataset.command ?? ""}\n`,
        filename: `truth-harness-reviewer-readiness-${safeFilenameTimestamp()}.txt`,
        type: "text/plain",
        copiedTitle: "Copied reviewer command",
        copiedDetail: "Reviewer readiness command copied from the Checks tab.",
        fallbackTitle: "Downloaded reviewer command",
        fallbackDetail: "the reviewer readiness command was saved as a local text file instead."
      });
    });
  });
}

function reviewerReadinessStatus({ audit, bundleClean, loading, errors }) {
  if (loading) {
    return "checking";
  }
  if (errors.length > 0) {
    return "blocked";
  }
  if (audit?.professorReady && bundleClean) {
    return "ready";
  }
  return "blocked";
}

function reviewerReadinessStatusLabel(status) {
  if (status === "ready") {
    return "review-ready";
  }
  if (status === "checking") {
    return "checking";
  }
  return "blocked";
}

function reviewerBundleVerificationClean(verification) {
  return Boolean(
    verification?.passed &&
    verification?.sourceMatchesWorkspace &&
    (verification.manifestDigestStatus === "verified" || verification.manifestDigestStatus === undefined)
  );
}

function reviewerBundleVerificationDetail(verification) {
  if (!verification) {
    return "No saved bundle verification is loaded yet.";
  }
  if (!verification.passed) {
    return "Copied reviewer files changed or are missing.";
  }
  if (!verification.sourceMatchesWorkspace) {
    return "The live workspace has drifted since the bundle was exported.";
  }
  if (verification.manifestDigestStatus && verification.manifestDigestStatus !== "verified") {
    return `Manifest digest is ${verification.manifestDigestStatus}; reviewer metadata needs investigation.`;
  }
  return `${verification.checkedBundleFiles ?? 0} bundle files and ${verification.checkedSourceFiles ?? 0} source files verified.`;
}

function reviewerReadinessNextCommand({ audit, bundleClean, strictProfessorCommand, dockerProfessorCommand, leanRepairCommand, bundleVerifyCommand, auditCommand }) {
  const firstAction = Array.isArray(audit?.nextActions) ? audit.nextActions[0] : undefined;
  if (firstAction) {
    return firstAction;
  }
  if (!audit) {
    return auditCommand;
  }
  const bundleCheck = releaseAuditCheckById(audit, "reviewer-bundle-verification");
  if (!bundleClean || bundleCheck?.status !== "pass") {
    return bundleVerifyCommand;
  }
  if (releaseAuditCheckById(audit, "hard-math-closure")?.status !== "pass") {
    return dockerProfessorCommand;
  }
  if (releaseAuditCheckById(audit, "lean-proof-safety")?.status !== "pass") {
    return leanRepairCommand;
  }
  if (releaseAuditCheckById(audit, "saved-strict-engine-run")?.status !== "pass") {
    return strictProfessorCommand;
  }
  return auditCommand;
}

function reviewerReadinessNextLabel({ audit, bundleClean, errors }) {
  if (errors.length > 0) {
    return "Fix local API or audit loading before trusting the panel.";
  }
  if (!audit) {
    return "Load the strict release audit.";
  }
  if (!bundleClean) {
    return "Verify or regenerate the reviewer bundle.";
  }
  if (audit.professorReady) {
    return "Export or inspect the reviewer packet.";
  }
  return "Close the highest-priority release audit blocker.";
}

function reviewerReadinessBlockers(audit, bundleClean) {
  const blockers = [];
  if (!audit) {
    blockers.push("Release audit has not loaded yet.");
    return blockers;
  }
  if (!bundleClean) {
    blockers.push("Reviewer bundle has not been verified cleanly against the current workspace.");
  }
  for (const check of Array.isArray(audit.checks) ? audit.checks : []) {
    if (check.status === "fail" || (check.status === "warn" && check.blocking)) {
      blockers.push(`${check.title}: ${check.summary}`);
    }
    if (blockers.length >= 6) {
      break;
    }
  }
  return blockers;
}

function reviewerReadinessCard({ label, value, status, detail, command }) {
  const statusClass = status === "pass" ? "exact" : status === "fail" ? "refuted" : "waiting";
  return `<article class="reviewer-readiness-card ${escapeHtml(status)}">
    <div>
      <span class="mini-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
    <span class="status-pill ${statusClass}">${escapeHtml(releaseAuditGateStatusLabel(status))}</span>
    <p>${escapeHtml(detail)}</p>
    ${command ? `<div class="reviewer-readiness-command">
      <code>${escapeHtml(command)}</code>
      <button class="text-button compact-button copy-reviewer-readiness-command" data-command="${escapeHtml(command)}" type="button">Copy</button>
    </div>` : ""}
  </article>`;
}

function renderReleaseAuditGate() {
  if (!releaseAuditGate) {
    return;
  }

  const audit = state.releaseAudit;
  const status = state.releaseAuditError
    ? "blocked"
    : state.releaseAuditLoading
      ? "checking"
      : audit?.status ?? "not loaded";
  const statusClass = releaseAuditStatusClass(status);
  const command = audit?.commands?.releaseAudit ?? "truth-harness workspace release-audit . --require-all-engines";
  const summary = audit?.summary ?? {};
  const reviewerBoard = releaseAuditReviewerBoardHtml(audit);
  const failedChecks = Array.isArray(audit?.checks)
    ? audit.checks.filter((check) => check.status === "fail")
    : [];
  const warningChecks = Array.isArray(audit?.checks)
    ? audit.checks.filter((check) => check.status === "warn")
    : [];
  const visibleChecks = [...failedChecks, ...warningChecks]
    .filter((check) => check.id !== "adversarial-ai-benchmark")
    .filter((check) => check.id !== "math-credibility-ladder")
    .slice(0, 5);
  const nextActions = Array.isArray(audit?.nextActions) ? audit.nextActions.slice(0, 4) : [];
  const benchmarkCards = [
    releaseAuditBenchmarkCardHtml(audit),
    releaseAuditMathLadderCardHtml(audit)
  ].join("");
  const rows = audit
    ? [
        ["Checks", `${summary.passedChecks ?? 0} pass / ${summary.warningChecks ?? 0} warn / ${summary.failedChecks ?? 0} fail`],
        ["Engines", releaseAuditEngineEvidenceSummary(audit)],
        ["Saved engine ladder", releaseAuditSavedEngineLadderSummary(audit)],
        ["Reviewer bundle", releaseAuditReviewerBundleSummary(audit)],
        ["Adversarial benchmark", releaseAuditBenchmarkSummary(summary)],
        ["Math ladder", releaseAuditMathLadderSummary(summary)],
        ["Hard math", summary.hardMathClosure ?? "missing"],
        ["Lean proof safety", `${summary.leanProofSafetyItems ?? 0} blocker${summary.leanProofSafetyItems === 1 ? "" : "s"}`],
        ["Report drafts", `${summary.reportDrafts ?? 0} saved / ${summary.reportDraftsNeedingAttention ?? 0} attention`],
        ["Research sessions", `${summary.researchSessions ?? 0} sessions / ${summary.sessionContinuationItems ?? 0} open`],
        ["Review queue", `${summary.reviewItems ?? 0} open / ${summary.criticalReviewItems ?? 0} critical`],
        ["Catalog", summary.catalogFresh ? "fresh" : "rebuild required"],
        ["Sandbox", summary.sandboxAvailable ? "measured" : "not measured"],
        ["Launch", audit.publicLaunchReady ? "public ready" : audit.professorReady ? "professor review ready" : "blocked"]
      ]
    : [
        ["Mode", "public review"],
        ["Engines", "strict all-engines required"],
        ["Sandbox", "required"],
        ["Status", state.releaseAuditError ?? "Refresh to inspect the current workspace."]
      ];
  const checkCards = visibleChecks
    .map((check) => releaseAuditCheckCardHtml(check))
    .join("");
  const actionCards = nextActions
    .map((action, index) => `<button class="release-audit-action copy-release-action-command" data-command="${escapeHtml(action)}" type="button">
      <span>${index + 1}</span>
      <code>${escapeHtml(action)}</code>
    </button>`)
    .join("");
  const limitations = Array.isArray(audit?.limitations)
    ? audit.limitations.slice(0, 3).map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")
    : "<li>Release audit loads locally and never starts Docker or external services from the browser.</li>";

  releaseAuditGate.innerHTML = `
    <div class="release-audit-head">
      <div>
        <span class="mini-label">project release gate</span>
        <h3>Release Readiness Gate</h3>
        <p>One local view of validation, catalog freshness, strict engine evidence, review queue, sandbox posture, and UI launch warnings.</p>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(releaseAuditStatusLabel(status))}</span>
    </div>
    <dl class="release-audit-summary">
      ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>
    <div class="release-audit-toolbar">
      <button class="text-button compact-button refresh-release-audit" data-testid="refresh-release-audit" type="button" ${state.releaseAuditLoading ? "disabled" : ""}>${state.releaseAuditLoading ? "Refreshing" : "Refresh gate"}</button>
      <button class="text-button compact-button copy-release-command" data-testid="copy-release-audit-command" data-command="${escapeHtml(command)}" type="button">Copy audit command</button>
    </div>
    <div class="release-audit-command">
      <span>Replayable audit</span>
      <code>${escapeHtml(command)}</code>
    </div>
    ${reviewerBoard}
    <div class="release-audit-benchmark-row">${benchmarkCards}</div>
    <details class="release-audit-details release-audit-ledger" open>
      <summary>
        <strong>Blocking Ledger</strong>
        <span>${visibleChecks.length} blocking or warning check${visibleChecks.length === 1 ? "" : "s"}</span>
      </summary>
      ${checkCards ? `<div class="release-audit-check-grid">${checkCards}</div>` : `<p>No blocking or warning checks returned for this audit scope.</p>`}
    </details>
    ${actionCards ? `<details class="release-audit-details">
      <summary>
        <strong>Next Blocking Actions</strong>
        <span>copyable for Codex, Claude, or terminal</span>
      </summary>
      <div class="release-audit-actions">${actionCards}</div>
    </details>` : ""}
    <details class="release-audit-details">
      <summary>
        <strong>Audit Boundary</strong>
        <span>what this gate does not prove</span>
      </summary>
      <ul class="release-audit-limitations">${limitations}</ul>
    </details>
  `;

  releaseAuditGate.querySelector(".refresh-release-audit")?.addEventListener("click", () => {
    void refreshReleaseAudit({ announce: true });
  });
  releaseAuditGate.querySelector(".copy-release-command")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    void copyOrDownloadText({
      button,
      text: `${button.dataset.command ?? command}\n`,
      filename: `truth-harness-release-audit-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: "Copied release audit command",
      copiedDetail: "Strict release-audit command copied from the Checks tab.",
      fallbackTitle: "Downloaded release audit command",
      fallbackDetail: "the release-audit command was saved as a local text file instead."
    });
  });
  releaseAuditGate.querySelectorAll(".copy-release-action-command").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      void copyOrDownloadText({
        button: target,
        text: `${target.dataset.command ?? ""}\n`,
        filename: `truth-harness-release-action-${safeFilenameTimestamp()}.txt`,
        type: "text/plain",
        copiedTitle: "Copied release action",
        copiedDetail: "Release-audit next action copied from the Checks tab.",
        fallbackTitle: "Downloaded release action",
        fallbackDetail: "the release-audit next action was saved as a local text file instead."
      });
    });
  });
  releaseAuditGate.querySelectorAll(".copy-release-benchmark-command").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      const label = target.dataset.benchmarkLabel ?? "benchmark";
      void copyOrDownloadText({
        button: target,
        text: `${target.dataset.command ?? ""}\n`,
        filename: `truth-harness-${label}-${safeFilenameTimestamp()}.txt`,
        type: "text/plain",
        copiedTitle: "Copied benchmark command",
        copiedDetail: `${label} command copied from the Checks tab.`,
        fallbackTitle: "Downloaded benchmark command",
        fallbackDetail: `the ${label} command was saved as a local text file instead.`
      });
    });
  });
  releaseAuditGate.querySelectorAll(".select-release-audit-check").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      if (state.selectedReleaseAuditCheckId !== target.dataset.checkId) {
        state.releaseAuditArtifactPreviewPath = undefined;
        state.releaseAuditArtifactPreview = undefined;
        state.releaseAuditArtifactPreviewError = undefined;
      }
      state.selectedReleaseAuditCheckId = target.dataset.checkId;
      renderReleaseAuditGate();
    });
  });
  releaseAuditGate.querySelectorAll(".copy-release-gate-command").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      const commandText = target.dataset.command ?? "";
      void copyOrDownloadText({
        button: target,
        text: `${commandText}\n`,
        filename: `truth-harness-release-gate-command-${safeFilenameTimestamp()}.txt`,
        type: "text/plain",
        copiedTitle: "Copied gate command",
        copiedDetail: "Release gate command copied from the Checks tab inspector.",
        fallbackTitle: "Downloaded gate command",
        fallbackDetail: "the release gate command was saved as a local text file instead."
      });
    });
  });
  releaseAuditGate.querySelectorAll(".copy-release-gate-evidence").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      const evidenceText = target.dataset.evidence ?? "";
      void copyOrDownloadText({
        button: target,
        text: `${evidenceText}\n`,
        filename: `truth-harness-release-gate-evidence-${safeFilenameTimestamp()}.txt`,
        type: "text/plain",
        copiedTitle: "Copied gate evidence",
        copiedDetail: "Release gate evidence refs copied from the Checks tab inspector.",
        fallbackTitle: "Downloaded gate evidence",
        fallbackDetail: "the release gate evidence refs were saved as a local text file instead."
      });
    });
  });
  releaseAuditGate.querySelectorAll(".open-release-artifact-preview").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      void openReleaseAuditArtifactPreview(target.dataset.path);
    });
  });
}

const RELEASE_AUDIT_REVIEWER_GROUPS = [
  {
    title: "Workspace Spine",
    note: "Local project, schema validation, and catalog state.",
    ids: ["workspace", "workspace-validation", "catalog"]
  },
  {
    title: "Verifier Evidence",
    note: "Strict engines, Docker reviewer run, and portable bundle verification.",
    ids: ["engine-evidence", "saved-strict-engine-run", "reviewer-bundle-verification"]
  },
  {
    title: "Math Credibility",
    note: "AI-failure benchmark, hard-math ladder, Lean proof-safety, and closure fixtures.",
    ids: ["adversarial-ai-benchmark", "math-credibility-ladder", "lean-proof-safety", "hard-math-closure"]
  },
  {
    title: "Review Handoff",
    note: "Reports, sessions, human review queue, sandbox, and UI review.",
    ids: ["report-drafts", "research-session-continuity", "review-queue", "code-run-sandbox", "web-ui-smoke"]
  }
];

function releaseAuditReviewerBoardHtml(audit) {
  if (!audit) {
    return `<section class="release-audit-board empty" data-testid="release-audit-board">
      <div class="release-audit-scoreboard">
        <article class="release-audit-score-card waiting">
          <span class="mini-label">reviewer readiness</span>
          <strong>Not loaded</strong>
          <p>Refresh the release gate to inspect local evidence.</p>
        </article>
      </div>
    </section>`;
  }

  const summary = audit.summary ?? {};
  const selectedCheck = releaseAuditSelectedCheck(audit);
  const scoreCards = [
    {
      label: "Professor review",
      value: audit.professorReady ? "ready" : "blocked",
      status: audit.professorReady ? "pass" : "fail",
      detail: `${summary.blockingFailures ?? 0} blocking failure${summary.blockingFailures === 1 ? "" : "s"}`
    },
    {
      label: "Public launch",
      value: audit.publicLaunchReady ? "ready" : "not yet",
      status: audit.publicLaunchReady ? "pass" : "warn",
      detail: `${summary.warningChecks ?? 0} warning${summary.warningChecks === 1 ? "" : "s"}`
    },
    {
      label: "Reviewer bundle",
      value: releaseAuditReviewerBundleSummary(audit),
      status: releaseAuditCheckById(audit, "reviewer-bundle-verification")?.status ?? "warn",
      detail: audit.reviewerBundleVerification
        ? `${audit.reviewerBundleVerification.checkedBundleFiles} bundle files / ${audit.reviewerBundleVerification.checkedSourceFiles} source files`
        : "portable bundle not verified"
    },
    {
      label: "Hard math closure",
      value: summary.hardMathClosure ?? "missing",
      status: releaseAuditCheckById(audit, "hard-math-closure")?.status ?? "warn",
      detail: "exact, symbolic, and SMT fixtures"
    },
    {
      label: "Lean proof safety",
      value: `${summary.leanProofSafetyItems ?? 0} blocker${summary.leanProofSafetyItems === 1 ? "" : "s"}`,
      status: releaseAuditCheckById(audit, "lean-proof-safety")?.status ?? "warn",
      detail: "sorry, admit, local axiom, and local constant scan"
    }
  ];

  return `<section class="release-audit-board" data-testid="release-audit-board">
    <div class="release-audit-scoreboard">
      ${scoreCards.map((card) => releaseAuditScoreCardHtml(card)).join("")}
    </div>
    <div class="release-audit-group-grid">
      ${RELEASE_AUDIT_REVIEWER_GROUPS.map((group) => releaseAuditReviewerGroupHtml(audit, group, selectedCheck?.id)).join("")}
    </div>
    ${releaseAuditGateInspectorHtml(audit, selectedCheck)}
  </section>`;
}

function releaseAuditScoreCardHtml(card) {
  const statusClass = card.status === "fail" ? "refuted" : card.status === "warn" ? "waiting" : "exact";
  return `<article class="release-audit-score-card ${escapeHtml(card.status)}">
    <span class="mini-label">${escapeHtml(card.label)}</span>
    <strong>${escapeHtml(card.value)}</strong>
    <p>${escapeHtml(card.detail)}</p>
    <span class="status-pill ${statusClass}">${escapeHtml(releaseAuditGateStatusLabel(card.status))}</span>
  </article>`;
}

function releaseAuditReviewerGroupHtml(audit, group, selectedCheckId) {
  const checks = group.ids.map((id) => releaseAuditCheckById(audit, id));
  const presentChecks = checks.filter(Boolean);
  const groupStatus = releaseAuditWorstStatus(presentChecks);
  const passed = presentChecks.filter((check) => check.status === "pass").length;
  const statusClass = groupStatus === "fail" ? "refuted" : groupStatus === "warn" ? "waiting" : "exact";

  return `<section class="release-audit-group ${escapeHtml(groupStatus)}">
    <div class="release-audit-group-head">
      <div>
        <strong>${escapeHtml(group.title)}</strong>
        <p>${escapeHtml(group.note)}</p>
      </div>
      <span class="status-pill ${statusClass}">${passed}/${group.ids.length}</span>
    </div>
    <div class="release-audit-group-list">
      ${group.ids.map((id) => releaseAuditGateRowHtml(releaseAuditCheckById(audit, id), id, selectedCheckId)).join("")}
    </div>
  </section>`;
}

function releaseAuditGateRowHtml(check, id, selectedCheckId) {
  if (!check) {
    return `<button class="release-audit-gate-row warn" data-check-id="${escapeHtml(id)}" type="button" disabled>
      <span class="task-state waiting"></span>
      <div>
        <strong>${escapeHtml(id)}</strong>
        <p>Gate was not returned by the local release audit.</p>
      </div>
      <small>missing</small>
    </button>`;
  }

  const statusClass = check.status === "fail" ? "refuted" : check.status === "warn" ? "waiting" : "exact";
  const command = check.command ? `<code>${escapeHtml(check.command)}</code>` : "";
  const selected = check.id === selectedCheckId ? " selected" : "";
  return `<button class="release-audit-gate-row select-release-audit-check ${escapeHtml(check.status)}${selected}" data-check-id="${escapeHtml(check.id)}" type="button">
    <span class="task-state ${statusClass}"></span>
    <div>
      <strong>${escapeHtml(check.title)}</strong>
      <p>${escapeHtml(check.summary)}</p>
      ${command}
    </div>
    <small>${escapeHtml(releaseAuditGateStatusLabel(check.status))}</small>
  </button>`;
}

function releaseAuditSelectedCheck(audit) {
  const checks = Array.isArray(audit?.checks) ? audit.checks : [];
  const selected = checks.find((check) => check.id === state.selectedReleaseAuditCheckId);
  if (selected) {
    return selected;
  }
  return checks.find((check) => check.status === "fail") ??
    checks.find((check) => check.status === "warn") ??
    checks.find((check) => check.id === "reviewer-bundle-verification") ??
    checks[0];
}

function releaseAuditGateInspectorHtml(audit, check) {
  if (!audit || !check) {
    return `<aside class="release-audit-inspector empty" data-testid="release-audit-gate-inspector">
      <span class="mini-label">gate inspector</span>
      <strong>No gate selected</strong>
      <p>Refresh the release audit or select a reviewer gate to inspect evidence.</p>
    </aside>`;
  }

  const statusClass = check.status === "fail" ? "refuted" : check.status === "warn" ? "waiting" : "exact";
  const details = Array.isArray(check.details) ? check.details.slice(0, 10) : [];
  const refs = releaseAuditGateEvidenceRefs(audit, check);
  const evidenceText = [
    `Gate: ${check.title}`,
    `Gate ID: ${check.id}`,
    `Status: ${check.status}`,
    `Blocking: ${String(check.blocking)}`,
    check.command ? `Command: ${check.command}` : undefined,
    refs.length > 0 ? "Evidence refs:" : undefined,
    ...refs.map((ref) => `- ${ref.label}: ${ref.value}`),
    details.length > 0 ? "Details:" : undefined,
    ...details.map((detail) => `- ${detail}`)
  ].filter(Boolean).join("\n");

  const facts = [
    ["Gate ID", check.id],
    ["Status", releaseAuditGateStatusLabel(check.status)],
    ["Blocking", check.blocking ? "yes" : "no"],
    ["Command", check.command ? "available" : "not required"]
  ];

  return `<aside class="release-audit-inspector ${escapeHtml(check.status)}" data-testid="release-audit-gate-inspector">
    <div class="release-audit-inspector-head">
      <div>
        <span class="mini-label">selected gate</span>
        <strong>${escapeHtml(check.title)}</strong>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(releaseAuditGateStatusLabel(check.status))}</span>
    </div>
    <p>${escapeHtml(check.summary)}</p>
    <dl class="release-audit-inspector-facts">
      ${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>
    ${check.command ? `<div class="release-audit-inspector-command">
      <code>${escapeHtml(check.command)}</code>
      <button class="text-button compact-button copy-release-gate-command" data-command="${escapeHtml(check.command)}" type="button">Copy command</button>
    </div>` : ""}
    ${refs.length > 0 ? `<div class="release-audit-evidence-refs">
      <strong>Evidence refs</strong>
      <ul>
        ${refs.map((ref) => releaseAuditEvidenceRefHtml(ref)).join("")}
      </ul>
    </div>` : ""}
    ${releaseAuditArtifactPreviewHtml()}
    <div class="release-audit-inspector-detail-list">
      <strong>Recorded details</strong>
      ${details.length > 0 ? `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : `<p>No additional detail strings were returned by this gate.</p>`}
    </div>
    <button class="text-button compact-button copy-release-gate-evidence" data-evidence="${escapeHtml(evidenceText)}" type="button">Copy evidence packet</button>
  </aside>`;
}

function releaseAuditEvidenceRefHtml(ref) {
  const previewable = releaseAuditArtifactRefIsPreviewable(ref.value);
  const current = state.releaseAuditArtifactPreviewPath === ref.value;
  const label = current && state.releaseAuditArtifactPreviewLoading ? "Opening" : current ? "Open" : "Open";
  return `<li>
    <span>${escapeHtml(ref.label)}</span>
    <div class="release-audit-evidence-ref-value">
      <code>${escapeHtml(ref.value)}</code>
      ${previewable ? `<button class="text-button compact-button open-release-artifact-preview${current ? " selected" : ""}" data-path="${escapeHtml(ref.value)}" type="button" ${state.releaseAuditArtifactPreviewLoading && current ? "disabled" : ""}>${label}</button>` : ""}
    </div>
  </li>`;
}

function releaseAuditArtifactRefIsPreviewable(value) {
  return workspaceArtifactRefIsPreviewable(value);
}

function releaseAuditArtifactPreviewHtml() {
  const path = state.releaseAuditArtifactPreviewPath;
  if (!path) {
    return "";
  }

  if (state.releaseAuditArtifactPreviewLoading) {
    return `<section class="release-audit-artifact-preview loading" data-testid="release-audit-artifact-preview">
      <div class="release-audit-artifact-preview-head">
        <div>
          <span class="mini-label">artifact preview</span>
          <strong>Opening local evidence</strong>
        </div>
        <span class="status-pill waiting">read-only</span>
      </div>
      <p>${escapeHtml(path)}</p>
    </section>`;
  }

  if (state.releaseAuditArtifactPreviewError) {
    return `<section class="release-audit-artifact-preview error" data-testid="release-audit-artifact-preview">
      <div class="release-audit-artifact-preview-head">
        <div>
          <span class="mini-label">artifact preview</span>
          <strong>Preview unavailable</strong>
        </div>
        <span class="status-pill waiting">blocked</span>
      </div>
      <p>${escapeHtml(state.releaseAuditArtifactPreviewError)}</p>
    </section>`;
  }

  const artifact = state.releaseAuditArtifactPreview;
  if (!artifact) {
    return "";
  }

  const content = artifact.kind === "json" && artifact.parsed
    ? JSON.stringify(artifact.parsed, null, 2)
    : String(artifact.content ?? "");
  const facts = [
    ["Kind", artifact.kind ?? "text"],
    ["Size", formatBytes(artifact.sizeBytes ?? 0)],
    ["Preview", artifact.truncated ? `first ${formatBytes(artifact.previewBytes ?? 0)}` : "complete"],
    ["File SHA-256", artifact.sha256 ?? "not reported"],
    ...(artifact.previewSha256 ? [["Preview SHA-256", artifact.previewSha256]] : [])
  ];

  return `<section class="release-audit-artifact-preview" data-testid="release-audit-artifact-preview">
    <div class="release-audit-artifact-preview-head">
      <div>
        <span class="mini-label">artifact preview</span>
        <strong>${escapeHtml(artifact.path ?? path)}</strong>
      </div>
      <span class="status-pill exact">read-only</span>
    </div>
    <dl class="release-audit-artifact-preview-facts">
      ${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>
    ${artifact.parseWarning ? `<p>${escapeHtml(artifact.parseWarning)}</p>` : ""}
    <pre>${escapeHtml(content || "(empty artifact)")}</pre>
  </section>`;
}

function workspaceArtifactRefIsPreviewable(value) {
  const text = normalizedWorkspaceArtifactRef(value);
  return text.startsWith(".truth-harness/") &&
    /\.(csv|dot|html|json|lean|log|md|mermaid|mmd|smt2|svg|tsv|txt|xml|ya?ml)$/iu.test(text);
}

function normalizedWorkspaceArtifactRef(value) {
  return relativeArtifactRef(String(value ?? "")).trim().replace(/\\/gu, "/").replace(/^\.\/+/u, "");
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function workspaceArtifactRefsFromText(value) {
  const text = typeof value === "string" ? value : "";
  if (!text.includes(".truth-harness")) {
    return [];
  }

  const matches = text.match(/(?:[A-Za-z]:[\\/][^\s"'`<>]+[\\/]\.truth-harness[^\s"'`<>]*|\/[^\s"'`<>]*\.truth-harness\/[^\s"'`<>]*|\.truth-harness\/[^\s"'`<>]*)/giu) ?? [];
  return uniqueStrings(matches
    .map((match) => normalizedWorkspaceArtifactRef(match).replace(/[),.;:\]`]+$/gu, ""))
    .filter((ref) => workspaceArtifactRefIsPreviewable(ref)));
}

function collectWorkspaceArtifactRefs(value, refs = [], seen = new WeakSet()) {
  if (typeof value === "string") {
    for (const ref of workspaceArtifactRefsFromText(value)) {
      refs.push(ref);
    }
    return uniqueStrings(refs);
  }

  if (!value || typeof value !== "object") {
    return uniqueStrings(refs);
  }

  if (seen.has(value)) {
    return uniqueStrings(refs);
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectWorkspaceArtifactRefs(item, refs, seen);
    }
    return uniqueStrings(refs);
  }

  for (const item of Object.values(value)) {
    collectWorkspaceArtifactRefs(item, refs, seen);
  }
  return uniqueStrings(refs);
}

function workspaceArtifactPathsForValue(value) {
  return uniqueStrings([
    ...workspaceArtifactRefObjects(value).map((ref) => ref.path),
    ...collectWorkspaceArtifactRefs(value)
  ]).filter((ref) => workspaceArtifactRefIsPreviewable(ref));
}

function workspaceArtifactRefObjects(value, refs = [], seen = new WeakSet()) {
  if (!value || typeof value !== "object") {
    return refs;
  }
  if (seen.has(value)) {
    return refs;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      workspaceArtifactRefObjects(item, refs, seen);
    }
    return uniqueWorkspaceArtifactRefObjects(refs);
  }

  if (Array.isArray(value.artifactRefs)) {
    for (const ref of value.artifactRefs) {
      if (!ref || typeof ref !== "object") {
        continue;
      }
      const path = normalizedWorkspaceArtifactRef(ref.path ?? "");
      if (!workspaceArtifactRefIsPreviewable(path)) {
        continue;
      }
      refs.push({
        path,
        role: String(ref.role ?? "referenced-artifact"),
        source: String(ref.source ?? "artifactRefs"),
        ...(typeof ref.sizeBytes === "number" ? { sizeBytes: ref.sizeBytes } : {}),
        ...(typeof ref.sha256 === "string" ? { sha256: ref.sha256 } : {}),
        ...(typeof ref.sha256Scope === "string" ? { sha256Scope: ref.sha256Scope } : {}),
        ...(typeof ref.citation === "string" ? { citation: ref.citation } : {})
      });
    }
  }

  for (const item of Object.values(value)) {
    if (Array.isArray(item) || (item && typeof item === "object")) {
      workspaceArtifactRefObjects(item, refs, seen);
    }
  }
  return uniqueWorkspaceArtifactRefObjects(refs);
}

function uniqueWorkspaceArtifactRefObjects(refs) {
  const seen = new Set();
  const unique = [];
  for (const ref of refs) {
    const key = `${ref.role}:${ref.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(ref);
  }
  return unique;
}

function workspaceRunNextArtifactRefsHtml(refs, surface, { limit = 6, compact = false, emptyHtml = "" } = {}) {
  const visibleRefs = Array.isArray(refs) ? refs.slice(0, limit) : [];
  if (visibleRefs.length === 0) {
    return emptyHtml;
  }

  const hiddenCount = Math.max(0, refs.length - visibleRefs.length);
  return `<section class="workspace-run-next-artifact-refs${compact ? " compact" : ""}" aria-label="Workspace run-next artifact refs">
    <div class="workspace-run-next-artifact-refs-head">
      <span class="mini-label">artifact refs</span>
      <span>${escapeHtml(`${refs.length} local ${refs.length === 1 ? "file" : "files"}`)}</span>
    </div>
    <div class="workspace-run-next-artifact-ref-list">
      ${visibleRefs.map((ref) => `<article class="workspace-run-next-artifact-ref">
        <div>
          <span class="mini-label">${escapeHtml(ref.role)}</span>
          <small>${escapeHtml(ref.source)}</small>
          ${ref.sha256 ? `<small class="workspace-artifact-integrity">sha256 ${escapeHtml(shortHash(ref.sha256))}${typeof ref.sizeBytes === "number" ? ` - ${escapeHtml(formatBytes(ref.sizeBytes))}` : ""}</small>` : ""}
        </div>
        ${artifactRefControlHtml(ref.path, { surface, label: "Open", citation: artifactRefCitation(ref) })}
      </article>`).join("")}
    </div>
    ${hiddenCount > 0 ? `<p>${escapeHtml(`${hiddenCount} more artifact refs are available in the JSON packet.`)}</p>` : ""}
  </section>`;
}

function workspaceRunNextRevalidationItems(value) {
  const queue = Array.isArray(value?.revalidationQueue)
    ? value.revalidationQueue
    : Array.isArray(value?.plan?.revalidationQueue)
      ? value.plan.revalidationQueue
      : [];
  return queue.filter((item) => item && typeof item === "object");
}

function workspaceRunNextRevalidationSummary(value) {
  const queue = workspaceRunNextRevalidationItems(value);
  if (queue.length === 0) {
    return undefined;
  }
  const high = queue.filter((item) => item.priority === "high").length;
  return `${queue.length} downstream review${queue.length === 1 ? "" : "s"}${high > 0 ? `, ${high} high priority` : ""}`;
}

function workspaceRunNextRevalidationQueueHtml(value, surface, { limit = 4, compact = false, emptyHtml = "" } = {}) {
  const queue = workspaceRunNextRevalidationItems(value);
  if (queue.length === 0) {
    return emptyHtml;
  }

  const visibleItems = queue.slice(0, limit);
  const hiddenCount = Math.max(0, queue.length - visibleItems.length);
  return `<section class="workspace-run-next-revalidations${compact ? " compact" : ""}" aria-label="Workspace run-next revalidation queue">
    <div class="workspace-run-next-revalidations-head">
      <span class="mini-label">revalidation queue</span>
      <span>${escapeHtml(`${queue.length} downstream review${queue.length === 1 ? "" : "s"}`)}</span>
    </div>
    <div class="workspace-run-next-revalidation-list">
      ${visibleItems.map((item) => workspaceRunNextRevalidationItemHtml(item, surface, compact)).join("")}
    </div>
    ${hiddenCount > 0 ? `<p>${escapeHtml(`${hiddenCount} more revalidation tasks are available in the JSON packet.`)}</p>` : ""}
    ${compact ? "" : `<p class="workspace-run-next-boundary">Revalidation tasks are dependency review only; they do not close gates or upgrade trust.</p>`}
  </section>`;
}

function workspaceRunNextRevalidationItemHtml(item, surface, compact) {
  const priority = item.priority === "high" ? "high" : "medium";
  const label = item.dependentTitle ?? item.dependentArtifactId ?? item.dependentKind ?? "dependent artifact";
  const command = item.command ?? "truth-harness workspace run-next . --json";
  const dependent = item.dependentPath ? artifactAwareValueHtml(item.dependentPath, surface) : escapeHtml(item.dependentKind ?? "not recorded");
  const ref = item.refPath ? artifactAwareValueHtml(item.refPath, surface) : "not recorded";
  return `<article class="workspace-run-next-revalidation ${priority}">
    <div class="workspace-run-next-revalidation-head">
      <span class="status-pill ${priority === "high" ? "waiting" : "passed"}">${escapeHtml(priority)}</span>
      <strong>${escapeHtml(label)}</strong>
    </div>
    <p>${escapeHtml(item.evidenceRequired ?? item.reason ?? "Review the dependent artifact before relying on this evidence.")}</p>
    ${compact ? "" : `<dl class="workspace-run-next-mini-details">
      <div><dt>Ref</dt><dd>${ref}</dd></div>
      <div><dt>Dependent</dt><dd>${dependent}</dd></div>
      <div><dt>Kind</dt><dd>${escapeHtml(item.dependentKind ?? "artifact")}</dd></div>
      <div><dt>Field</dt><dd>${escapeHtml(item.fieldPath ?? "not recorded")}</dd></div>
    </dl>`}
    <code>${escapeHtml(command)}</code>
    <div class="workspace-run-next-row-actions">
      <button class="text-button compact-button copy-run-next-revalidation-command" data-command="${escapeHtml(command)}" type="button">Copy review</button>
    </div>
  </article>`;
}

function artifactAwareValueHtml(value, surface) {
  const text = String(value ?? "");
  const refs = workspaceArtifactRefsFromText(text);
  if (refs.length === 0) {
    return escapeHtml(text);
  }

  const directRef = normalizedWorkspaceArtifactRef(text);
  if (refs.length === 1 && directRef === refs[0]) {
    return artifactRefControlHtml(text, {
      surface,
      label: "Open"
    });
  }

  return `<span class="workspace-artifact-value-text">${escapeHtml(text)}</span>
    <span class="workspace-artifact-ref-list">
      ${refs.map((ref) => artifactRefControlHtml(ref, { surface, label: "Open" })).join("")}
    </span>`;
}

function artifactRefControlHtml(value, { surface, label = "Open", citation } = {}) {
  const previewPath = normalizedWorkspaceArtifactRef(value);
  const current = state.workspaceArtifactPreviewSurface === surface && state.workspaceArtifactPreviewPath === previewPath;
  const opening = current && state.workspaceArtifactPreviewLoading;
  const citationText = citation ?? previewPath;
  return `<span class="workspace-artifact-ref-control">
    <code title="${escapeHtml(value)}">${escapeHtml(value)}</code>
    <span class="workspace-artifact-ref-actions">
      <button class="text-button compact-button open-workspace-artifact-preview${current ? " selected" : ""}" data-artifact-preview-surface="${escapeHtml(surface)}" data-path="${escapeHtml(previewPath)}" type="button" ${opening ? "disabled" : ""}>${opening ? "Opening" : escapeHtml(label)}</button>
      <button class="text-button compact-button search-catalog-citations" data-ref="${escapeHtml(previewPath)}" type="button">Cited by</button>
      <button class="text-button compact-button copy-workspace-artifact-citation" data-citation="${escapeHtml(citationText)}" type="button">Copy citation</button>
    </span>
  </span>`;
}

function artifactRefCitation(ref) {
  const path = normalizedWorkspaceArtifactRef(ref?.path);
  if (!path) {
    return "";
  }
  return typeof ref?.citation === "string" && ref.citation.trim()
    ? ref.citation.trim()
    : ref?.sha256
      ? `${path} sha256:${ref.sha256}`
      : path;
}

function shortHash(value) {
  const text = String(value ?? "");
  return text.length > 12 ? `${text.slice(0, 12)}...` : text;
}

function workspaceArtifactPreviewHtml(surface, { allowedPaths = [], emptyHtml = "" } = {}) {
  const path = state.workspaceArtifactPreviewPath;
  if (state.workspaceArtifactPreviewSurface !== surface || !path) {
    return emptyHtml;
  }
  if (allowedPaths.length > 0 && !allowedPaths.includes(path)) {
    return emptyHtml;
  }

  if (state.workspaceArtifactPreviewLoading) {
    return `<section class="release-audit-artifact-preview workspace-artifact-preview loading" data-testid="workspace-artifact-preview">
      <div class="release-audit-artifact-preview-head workspace-artifact-preview-head">
        <div>
          <span class="mini-label">artifact preview</span>
          <strong>Opening local evidence</strong>
        </div>
        <span class="status-pill waiting">read-only</span>
      </div>
      <p>${escapeHtml(path)}</p>
    </section>`;
  }

  if (state.workspaceArtifactPreviewError) {
    return `<section class="release-audit-artifact-preview workspace-artifact-preview error" data-testid="workspace-artifact-preview">
      <div class="release-audit-artifact-preview-head workspace-artifact-preview-head">
        <div>
          <span class="mini-label">artifact preview</span>
          <strong>Preview unavailable</strong>
        </div>
        <span class="status-pill waiting">blocked</span>
      </div>
      <p>${escapeHtml(state.workspaceArtifactPreviewError)}</p>
    </section>`;
  }

  const artifact = state.workspaceArtifactPreview;
  if (!artifact) {
    return emptyHtml;
  }

  const content = artifact.kind === "json" && artifact.parsed
    ? JSON.stringify(artifact.parsed, null, 2)
    : String(artifact.content ?? "");
  const facts = [
    ["Kind", artifact.kind ?? "text"],
    ["Size", formatBytes(artifact.sizeBytes ?? 0)],
    ["Preview", artifact.truncated ? `first ${formatBytes(artifact.previewBytes ?? 0)}` : "complete"],
    ["File SHA-256", artifact.sha256 ?? "not reported"],
    ...(artifact.previewSha256 ? [["Preview SHA-256", artifact.previewSha256]] : [])
  ];

  return `<section class="release-audit-artifact-preview workspace-artifact-preview" data-testid="workspace-artifact-preview">
    <div class="release-audit-artifact-preview-head workspace-artifact-preview-head">
      <div>
        <span class="mini-label">artifact preview</span>
        <strong>${escapeHtml(artifact.path ?? path)}</strong>
      </div>
      <div class="workspace-artifact-preview-actions">
        <button class="text-button compact-button search-catalog-citations" data-ref="${escapeHtml(artifact.path ?? path)}" type="button">Cited by</button>
        <span class="status-pill exact">read-only</span>
      </div>
    </div>
    <dl class="release-audit-artifact-preview-facts workspace-artifact-preview-facts">
      ${facts.map(([factLabel, value]) => `<div><dt>${escapeHtml(factLabel)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>
    ${artifact.parseWarning ? `<p>${escapeHtml(artifact.parseWarning)}</p>` : ""}
    <pre>${escapeHtml(content || "(empty artifact)")}</pre>
  </section>`;
}

function releaseAuditGateEvidenceRefs(audit, check) {
  const pack = audit?.credibilityPack;
  const refs = [];
  const add = (label, value) => {
    if (typeof value === "string" && value.trim()) {
      refs.push({ label, value });
    }
  };

  if (check.id === "reviewer-bundle-verification") {
    add("verification artifact", audit.reviewerBundleVerification?.artifactPath);
    add("bundle ref", audit.reviewerBundleVerification?.bundleRef);
    add("pack id", audit.reviewerBundleVerification?.packId);
    add("verification id", audit.reviewerBundleVerification?.verificationId);
  }
  if (check.id === "adversarial-ai-benchmark") {
    const run = pack?.benchmarkLedger?.latestAdversarialRun;
    add("benchmark artifact", run?.path);
    add("benchmark id", run?.artifactId);
    add("replay command", run?.replayCommand);
    for (const replay of run?.receiptReplays?.slice(0, 3) ?? []) {
      add("receipt replay", replay);
    }
  }
  if (check.id === "math-credibility-ladder") {
    const run = pack?.benchmarkLedger?.latestMathCredibilityLadderRun;
    add("ladder artifact", run?.path);
    add("ladder id", run?.artifactId);
    add("replay command", run?.replayCommand);
    for (const replay of run?.receiptReplays?.slice(0, 3) ?? []) {
      add("receipt replay", replay);
    }
  }
  if (check.id === "hard-math-closure") {
    const reports = [
      ["exact closure", pack?.hardMathClosureLedger?.latestExactClosure],
      ["symbolic closure", pack?.hardMathClosureLedger?.latestSymbolicClosure],
      ["SMT closure", pack?.hardMathClosureLedger?.latestSmtClosure]
    ];
    for (const [label, report] of reports) {
      add(`${label} artifact`, report?.path);
      add(`${label} command`, report?.command);
    }
  }
  if (check.id === "saved-strict-engine-run") {
    const run = pack?.engineRunLedger?.latestStrictReviewerRun;
    add("engine run artifact", run?.path);
    add("engine run id", run?.runId);
    add("engine ladder level", run?.strongestLevelId);
  }
  if (check.id === "engine-evidence") {
    const professor = pack?.engineRunLedger?.latestProfessorReviewerRun;
    const strict = pack?.engineRunLedger?.latestStrictReviewerRun;
    const strongest = pack?.engineRunLedger?.strongestSavedLevelRun;
    add("strongest saved level", pack?.summary?.savedEngineLadderLevel);
    add("strongest level run", strongest?.path);
    add("professor engine run", professor?.path);
    add("strict engine run", strict?.path);
    add("engine verify command", pack?.reviewerCommands?.verifyEngines);
  }
  if (check.id === "code-run-sandbox") {
    add("sandbox evidence", audit.sandboxEvidence?.path);
    add("sandbox run id", audit.sandboxEvidence?.runId);
  }
  if (check.id === "web-ui-smoke") {
    add("UI review id", audit.webUiReview?.reviewId);
    add("UI review screenshot", audit.webUiReview?.screenshotPath);
  }
  if (check.id === "report-drafts") {
    add("credibility pack", pack?.packId);
    add("reproduce pack", pack?.reviewerCommands?.reproducePack);
  }
  if (check.command) {
    add("gate command", check.command);
  }

  return refs;
}

function releaseAuditCheckById(audit, id) {
  return Array.isArray(audit?.checks) ? audit.checks.find((check) => check.id === id) : undefined;
}

function releaseAuditWorstStatus(checks) {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "warn") || checks.length === 0) {
    return "warn";
  }
  return "pass";
}

function releaseAuditGateStatusLabel(status) {
  if (status === "pass") {
    return "passed";
  }
  if (status === "warn") {
    return "warning";
  }
  return "blocking";
}

function releaseAuditReviewerBundleSummary(audit) {
  const verification = audit?.reviewerBundleVerification;
  if (!verification) {
    return "not verified";
  }
  if (!verification.passed) {
    return "failed integrity";
  }
  if (!verification.sourceMatchesWorkspace) {
    return "source drift";
  }
  if (verification.manifestDigestStatus !== "verified") {
    return verification.manifestDigestStatus === "mismatch" ? "digest mismatch" : "digest missing";
  }
  return `${verification.checkedBundleFiles}/${verification.checkedSourceFiles} files verified`;
}

function releaseAuditBenchmarkCardHtml(audit) {
  if (!audit) {
    return "";
  }

  const check = Array.isArray(audit.checks)
    ? audit.checks.find((item) => item.id === "adversarial-ai-benchmark")
    : undefined;
  const packSummary = audit.credibilityPack?.summary ?? {};
  const latestRun = audit.credibilityPack?.benchmarkLedger?.latestAdversarialRun;
  const receiptReplay = latestRun?.receiptReplays?.[0];
  const status = check?.status ?? (packSummary.latestAdversarialBenchmarkStatus === "passed" ? "pass" : "fail");
  const statusClass = status === "fail" ? "refuted" : status === "warn" ? "waiting" : "exact";
  const command = latestRun?.replayCommand ?? check?.command ?? releaseAuditBenchmarkCommand(audit);
  const details = Array.isArray(check?.details)
    ? check.details.slice(0, 3).map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")
    : "";
  const facts = [
    ["Status", packSummary.latestAdversarialBenchmarkStatus ?? audit.summary?.adversarialBenchmark ?? "missing"],
    ["Trust accuracy", formatPercent(packSummary.latestAdversarialBenchmarkAccuracy)],
    ["Saved runs", String(packSummary.savedBenchmarkRuns ?? 0)],
    ["Latest run", latestRun?.artifactId ?? "none"],
    ["Failed cases", String(latestRun?.failed ?? 0)]
  ];

  return `<section class="release-audit-benchmark-card benchmark-${escapeHtml(status)}">
    <div class="release-audit-benchmark-head">
      <div>
        <span class="mini-label">adversarial AI-failure suite</span>
        <strong>Fluent-Wrong Math Gate</strong>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(releaseAuditBenchmarkLabel(status))}</span>
    </div>
    <p>${escapeHtml(check?.summary ?? "Run the saved benchmark that catches fluent-but-wrong AI math behavior before serious review.")}</p>
    <dl class="release-audit-benchmark-facts">
      ${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>
    ${latestRun?.path ? `<small>Artifact: <code>${escapeHtml(latestRun.path)}</code></small>` : ""}
    ${receiptReplay ? `<small>Receipt replay: <code>${escapeHtml(receiptReplay)}</code></small>` : ""}
    <div class="release-audit-benchmark-command">
      <code>${escapeHtml(command)}</code>
      <button class="text-button compact-button copy-release-benchmark-command" data-testid="copy-release-benchmark-command" data-benchmark-label="adversarial-benchmark" data-command="${escapeHtml(command)}" type="button">Copy benchmark</button>
    </div>
    ${details ? `<ul>${details}</ul>` : ""}
  </section>`;
}

function releaseAuditMathLadderCardHtml(audit) {
  if (!audit) {
    return "";
  }

  const check = Array.isArray(audit.checks)
    ? audit.checks.find((item) => item.id === "math-credibility-ladder")
    : undefined;
  const packSummary = audit.credibilityPack?.summary ?? {};
  const latestRun = audit.credibilityPack?.benchmarkLedger?.latestMathCredibilityLadderRun;
  const receiptReplay = latestRun?.receiptReplays?.[0];
  const status = check?.status ?? (packSummary.latestMathCredibilityLadderStatus === "passed" ? "pass" : "fail");
  const statusClass = status === "fail" ? "refuted" : status === "warn" ? "waiting" : "exact";
  const command = latestRun?.replayCommand ?? check?.command ?? releaseAuditMathLadderCommand(audit);
  const details = Array.isArray(check?.details)
    ? check.details.slice(0, 3).map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")
    : "";
  const facts = [
    ["Status", packSummary.latestMathCredibilityLadderStatus ?? audit.summary?.mathCredibilityLadder ?? "missing"],
    ["Trust accuracy", formatPercent(packSummary.latestMathCredibilityLadderAccuracy)],
    ["Saved runs", String(packSummary.savedBenchmarkRuns ?? 0)],
    ["Latest run", latestRun?.artifactId ?? "none"],
    ["Failed cases", String(latestRun?.failed ?? 0)]
  ];

  return `<section class="release-audit-benchmark-card benchmark-${escapeHtml(status)}">
    <div class="release-audit-benchmark-head">
      <div>
        <span class="mini-label">native-safe hard-math floor</span>
        <strong>Math Credibility Ladder</strong>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(releaseAuditBenchmarkLabel(status))}</span>
    </div>
    <p>${escapeHtml(check?.summary ?? "Run the saved hard-math ladder before claiming the math lane is professor-ready.")}</p>
    <dl class="release-audit-benchmark-facts">
      ${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>
    ${latestRun?.path ? `<small>Artifact: <code>${escapeHtml(latestRun.path)}</code></small>` : ""}
    ${receiptReplay ? `<small>Receipt replay: <code>${escapeHtml(receiptReplay)}</code></small>` : ""}
    <div class="release-audit-benchmark-command">
      <code>${escapeHtml(command)}</code>
      <button class="text-button compact-button copy-release-benchmark-command" data-benchmark-label="math-credibility-ladder" data-command="${escapeHtml(command)}" type="button">Copy ladder</button>
    </div>
    ${details ? `<ul>${details}</ul>` : ""}
  </section>`;
}

function releaseAuditBenchmarkCommand(audit) {
  return audit?.commands?.adversarialBenchmark ??
    audit?.credibilityPack?.reviewerCommands?.runAdversarialBenchmark ??
    "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures";
}

function releaseAuditMathLadderCommand(audit) {
  return audit?.commands?.mathCredibilityLadder ??
    audit?.credibilityPack?.reviewerCommands?.runMathCredibilityLadder ??
    "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures";
}

function releaseAuditBenchmarkSummary(summary) {
  const status = summary?.adversarialBenchmark ?? "missing";
  return status === "passed" ? "passed" : status === "failed" ? "failed" : "missing";
}

function releaseAuditMathLadderSummary(summary) {
  const status = summary?.mathCredibilityLadder ?? "missing";
  return status === "passed" ? "passed" : status === "failed" ? "failed" : "missing";
}

function releaseAuditBenchmarkLabel(status) {
  if (status === "pass") {
    return "passing";
  }
  if (status === "warn") {
    return "warning";
  }
  return "blocking";
}

function releaseAuditCheckCardHtml(check) {
  const statusClass = check.status === "fail" ? "refuted" : check.status === "warn" ? "waiting" : "exact";
  const command = check.command ? `<code>${escapeHtml(check.command)}</code>` : "";
  const detailLimit = check.id === "engine-evidence" ? 8 : 3;
  const details = Array.isArray(check.details)
    ? check.details.slice(0, detailLimit).map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")
    : "";

  return `<section class="release-audit-check ${escapeHtml(check.status)}">
    <div class="release-audit-check-head">
      <span class="task-state ${statusClass}"></span>
      <strong>${escapeHtml(check.title)}</strong>
      <small>${check.blocking ? "blocking" : check.status}</small>
    </div>
    <p>${escapeHtml(check.summary)}</p>
    ${(command || details) ? `<details class="release-audit-mini-details">
      <summary>Command and details</summary>
      ${command}
      ${details ? `<ul>${details}</ul>` : ""}
    </details>` : ""}
  </section>`;
}

function releaseAuditEngineEvidenceSummary(audit) {
  const summary = audit?.summary ?? {};
  const concreteGates = summary.concreteEngineGates ?? "0/5";
  const requiredGates = summary.requiredEngineGates ?? "0/5";
  const savedLevel = releaseAuditSavedEngineLadderSummary(audit);
  const engineCheck = Array.isArray(audit?.checks)
    ? audit.checks.find((check) => check.id === "engine-evidence")
    : undefined;
  const checkSummary = typeof engineCheck?.summary === "string" ? engineCheck.summary : "";

  if (
    engineCheck?.status === "pass" &&
    checkSummary.includes("Saved no-network Docker engine evidence")
  ) {
    return `saved Docker evidence (${savedLevel}); live host ${concreteGates} concrete / ${requiredGates} required`;
  }

  return `${requiredGates} required / ${concreteGates} concrete`;
}

function releaseAuditSavedEngineLadderSummary(audit) {
  const summary = audit?.summary ?? {};
  const packSummary = audit?.credibilityPack?.summary ?? {};
  const run = audit?.credibilityPack?.engineRunLedger?.strongestSavedLevelRun
    ?? audit?.credibilityPack?.engineRunLedger?.latestStrictReviewerRun
    ?? audit?.credibilityPack?.engineRunLedger?.latestProfessorReviewerRun;
  const inferred = savedEngineLadderFromRun(run);
  const level = summary.savedEngineLadderLevel ?? packSummary.savedEngineLadderLevel ?? inferred.level;
  const title = packSummary.savedEngineLadderLevelTitle ?? inferred.title;
  if (!level) {
    return "missing";
  }
  return title ? `${level} (${title})` : level;
}

function releaseAuditActivitySummary(audit) {
  if (!audit) {
    return "Release audit did not return a payload.";
  }

  const summary = audit.summary ?? {};
  return `Release audit ${audit.status}; ${summary.blockingFailures ?? 0} blocking failure${summary.blockingFailures === 1 ? "" : "s"}, ${summary.reportDraftsNeedingAttention ?? 0} report draft${summary.reportDraftsNeedingAttention === 1 ? "" : "s"} needing attention, ${summary.sessionContinuationItems ?? 0} session continuation item${summary.sessionContinuationItems === 1 ? "" : "s"}, ${summary.criticalReviewItems ?? 0} critical queue item${summary.criticalReviewItems === 1 ? "" : "s"}.`;
}

function formatPercent(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "not recorded";
}

function releaseAuditStatusLabel(status) {
  if (status === "ready") {
    return "ready";
  }
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "checking") {
    return "checking";
  }
  return "not loaded";
}

function releaseAuditStatusClass(status) {
  if (status === "ready") {
    return "exact";
  }
  if (status === "blocked") {
    return "refuted";
  }
  return "waiting";
}

function renderEngineReadinessStatus(payload) {
  if (!engineReadinessPill || !engineReadinessDetails || !engineReadinessNotes) {
    renderDockerVerifierPath(payload);
    return;
  }

  if (!payload) {
    engineReadinessPill.textContent = "checking";
    engineReadinessPill.className = "status-pill waiting";
    engineReadinessDetails.innerHTML = `<div><dt>Backends</dt><dd>checking local tools</dd></div>`;
    engineReadinessNotes.innerHTML = `<li>Backend probes report availability only; evidence still requires concrete replayable runs.</li>`;
    renderDockerVerifierPath(payload);
    return;
  }

  if (payload.error) {
    engineReadinessPill.textContent = "unavailable";
    engineReadinessPill.className = "status-pill refuted";
    engineReadinessDetails.innerHTML = `<div><dt>Status</dt><dd>local API unavailable</dd></div>`;
    engineReadinessNotes.innerHTML = `<li>${escapeHtml(payload.error)}</li>`;
    renderDockerVerifierPath(payload);
    return;
  }

  const readinessReport = payload.engineReadiness;
  const readiness = payload.verification ?? {};
  const manifest = payload.engineManifest ?? {};
  const evidence = payload.engineVerification ?? {};
  const engines = Array.isArray(readiness.engines) ? readiness.engines : [];
  const gates = Array.isArray(readinessReport?.gates) ? readinessReport.gates : [];
  const readyTrustLabels = Array.isArray(readinessReport?.summary?.readyTrustLabels)
    ? readinessReport.summary.readyTrustLabels
    : [];
  const totalCount = Number.isFinite(readiness.totalCount) ? readiness.totalCount : engines.length;
  const readyCount = Number.isFinite(readiness.readyCount)
    ? readiness.readyCount
    : engines.filter((engine) => engine.status === "available").length;
  const readyClaimClasses = Number.isFinite(readinessReport?.summary?.readyClaimClasses)
    ? readinessReport.summary.readyClaimClasses
    : undefined;
  const totalClaimClasses = Number.isFinite(readinessReport?.summary?.totalClaimClasses)
    ? readinessReport.summary.totalClaimClasses
    : undefined;
  const manifestReadyCount = Number.isFinite(manifest.readyCount) ? manifest.readyCount : 0;
  const manifestTotalCount = Number.isFinite(manifest.totalCount) ? manifest.totalCount : 0;
  const nativeCount = Number.isFinite(manifest.nativeCount) ? manifest.nativeCount : 0;
  const plannedCount = Number.isFinite(manifest.plannedCount) ? manifest.plannedCount : 0;
  const allReady = totalCount > 0 && readyCount === totalCount;
  const anyReady = readyCount > 0;
  const reportStatus = readinessReport?.status;
  const rows = [
    ["Readiness", formatSafetyPhrase(reportStatus ?? "checking")],
    readyClaimClasses !== undefined && totalClaimClasses !== undefined
      ? ["Claim classes", `${readyClaimClasses}/${totalClaimClasses} responsibly supported`]
      : undefined,
    readyTrustLabels.length > 0
      ? ["Trust labels", readyTrustLabels.map((label) => `<code>${escapeHtml(label)}</code>`).join(" ")]
      : undefined,
    ["Adapters", `${readyCount}/${totalCount} verification backends`],
    ["Manifest", `${manifestReadyCount}/${manifestTotalCount} active capabilities`],
    ["Evidence gate", `${evidence.concretePassed ?? 0}/${evidence.concreteTotal ?? 0} concrete checks`],
    ["Native", `${nativeCount} local kernels`],
    ["Roadmap", `${plannedCount} planned adapters`],
    ...gates.map((gate) => [
      gate.title ?? gate.id ?? "Gate",
      `<span>${escapeHtml(formatSafetyPhrase(gate.status ?? "unknown"))}</span><small>${escapeHtml(gate.summary ?? "")}</small>`
    ]),
    ...engines.map((engine) => [
      engine.lane ?? engine.displayName ?? "Backend",
      engineReadinessValue(engine)
    ])
  ].filter(Boolean);

  engineReadinessPill.textContent = engineReadinessStatusLabel(reportStatus, {
    allReady,
    anyReady,
    readyCount,
    totalCount
  });
  engineReadinessPill.className = `status-pill ${engineReadinessStatusClass(reportStatus, { allReady, anyReady })}`;
  engineReadinessDetails.innerHTML = rows
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`)
    .join("");

  const boundaryNotes = [
    "Readiness does not mint evidence, truth labels, or proof.",
    readinessReport?.trustBoundary?.professorReadyRequiresConcreteEngineRuns
      ? "Professor-ready claims require concrete engine runs, not status probes."
      : undefined,
    evidence.evidenceMinted !== undefined
      ? `Concrete engine gate minted ${evidence.evidenceMinted} replayable evidence record${evidence.evidenceMinted === 1 ? "" : "s"}.`
      : undefined,
    ...(Array.isArray(readinessReport?.recommendedNextActions) ? readinessReport.recommendedNextActions : []),
    ...engines
      .filter((engine) => engine.status !== "available")
      .map((engine) => `${engine.displayName ?? engine.id ?? "Backend"}: ${engine.note ?? "not available"}`),
    ...(Array.isArray(readinessReport?.warnings) ? readinessReport.warnings : []),
    ...(Array.isArray(evidence.warnings) ? evidence.warnings : []),
    ...engines
      .filter((engine) => engine.status === "available")
      .map((engine) => engine.trustBoundary)
  ].filter(Boolean);

  engineReadinessNotes.innerHTML = boundaryNotes
    .slice(0, 5)
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");
  renderDockerVerifierPath(payload);
}

function renderDockerVerifierPath(payload = state.safetyStatus) {
  if (!dockerVerifierPill || !dockerVerifierSummary || !dockerVerifierNotes) {
    return;
  }

  if (!payload) {
    dockerVerifierPill.textContent = "checking";
    dockerVerifierPill.className = "status-pill waiting";
    dockerVerifierSummary.textContent = "Checking local proof, CAS, and SMT engines before recommending the isolated verifier path.";
    dockerVerifierNotes.innerHTML = `<li>Engine probes are readiness checks only; claim evidence still requires a concrete replayable run.</li>`;
    renderEngineEvidenceGate(payload);
    return;
  }

  if (payload.error) {
    dockerVerifierPill.textContent = "manual";
    dockerVerifierPill.className = "status-pill waiting";
    dockerVerifierSummary.textContent = "The local status API is unavailable, so use the Docker commands manually when you are ready to verify engines.";
    dockerVerifierNotes.innerHTML = `<li>${escapeHtml(payload.error)}</li>`;
    renderEngineEvidenceGate(payload);
    return;
  }

  const readiness = payload.verification ?? {};
  const guidance = payload.dockerVerifier ?? {};
  const engines = Array.isArray(readiness.engines) ? readiness.engines : [];
  const totalCount = Number.isFinite(readiness.totalCount) ? readiness.totalCount : engines.length;
  const readyCount = Number.isFinite(readiness.readyCount)
    ? readiness.readyCount
    : engines.filter((engine) => engine.status === "available").length;
  const missingEngines = engines
    .filter((engine) => engine.status !== "available")
    .map((engine) => engine.displayName ?? engine.id ?? "Backend");
  const recommended = typeof guidance.recommended === "boolean"
    ? guidance.recommended
    : totalCount === 0 || readyCount < totalCount;
  const commands = guidance.commands ?? {};
  const professorCommand = commands.professor ?? "npm run docker:professor";
  const proofCommand = commands.proof ?? "npm run docker:proof";
  const allEnginesCommand = commands.allEngines ?? "npm run docker:all-engines";
  const professorAllCommand = commands.professorAll ?? "npm run docker:professor:all";
  const verifyCommand = commands.verify ?? "npm run docker:verify";

  if (dockerProfessorCommand) {
    dockerProfessorCommand.textContent = professorCommand;
  }
  if (dockerProofCommand) {
    dockerProofCommand.textContent = proofCommand;
  }
  if (dockerAllEnginesCommand) {
    dockerAllEnginesCommand.textContent = allEnginesCommand;
  }
  if (dockerProfessorAllCommand) {
    dockerProfessorAllCommand.textContent = professorAllCommand;
  }
  if (dockerVerifyCommand) {
    dockerVerifyCommand.textContent = verifyCommand;
  }
  dockerCopyCommands.forEach((button) => {
    if (button.dataset.commandKey === "professor") {
      button.dataset.command = professorCommand;
    }
    if (button.dataset.commandKey === "proof") {
      button.dataset.command = proofCommand;
    }
    if (button.dataset.commandKey === "allEngines") {
      button.dataset.command = allEnginesCommand;
    }
    if (button.dataset.commandKey === "professorAll") {
      button.dataset.command = professorAllCommand;
    }
    if (button.dataset.commandKey === "verify") {
      button.dataset.command = verifyCommand;
    }
  });

  dockerVerifierPill.textContent = guidance.status ?? (recommended ? "recommended" : "optional");
  dockerVerifierPill.className = `status-pill ${recommended ? "waiting" : "exact"}`;
  dockerVerifierSummary.textContent = recommended
    ? `Local host engines are incomplete${missingEngines.length > 0 ? `: ${missingEngines.join(", ")}` : ""}. Use Docker to run the pinned verifier suite without installing these tools directly on the PC.`
    : "Local engines are available; Docker remains the reproducible verifier route for clean-room replay.";

  const notes = Array.isArray(guidance.notes) && guidance.notes.length > 0
    ? guidance.notes
    : [
        "npm run docker:professor writes the reviewer rehearsal artifacts in the no-network compose service.",
        "npm run docker:proof runs the truth-harness service with no external network route and records engine outputs only through normal receipts.",
        "npm run docker:all-engines is the heavy strict reviewer gate for Maxima, Z3, cvc5, Lean, and SageMath.",
        "npm run docker:professor:all packages the strict all-engine gate into a professor credibility pack and reviewer bundle.",
        "npm run docker:verify builds and tests the verification image; builds may fetch dependencies if the image is not already cached.",
        "Docker status does not prove a claim. Only accepted Lean, Z3, or Maxima artifacts can satisfy their matching obligations."
      ];
  dockerVerifierNotes.innerHTML = notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  renderEngineEvidenceGate(payload);
}

function renderEngineEvidenceGate(payload = state.safetyStatus) {
  if (!engineEvidenceGate) {
    return;
  }

  if (!payload) {
    engineEvidenceGate.innerHTML = `<div class="panel-heading compact-heading">
      <h3>Engine Evidence Gate</h3>
      <span class="status-pill waiting">checking</span>
    </div>
    <p>Loading concrete engine evidence checks. Readiness probes alone never satisfy a trust label.</p>`;
    return;
  }

  if (payload.error) {
    engineEvidenceGate.innerHTML = `<div class="panel-heading compact-heading">
      <h3>Engine Evidence Gate</h3>
      <span class="status-pill refuted">unavailable</span>
    </div>
    <p>${escapeHtml(payload.error)}</p>`;
    return;
  }

  const report = payload.engineVerification;
  if (!report) {
    engineEvidenceGate.innerHTML = `<div class="panel-heading compact-heading">
      <h3>Engine Evidence Gate</h3>
      <span class="status-pill waiting">missing</span>
    </div>
    <p>The status API did not return concrete engine evidence metadata.</p>`;
    return;
  }

  const cases = Array.isArray(report.cases) ? report.cases : [];
  const command = report.docker?.coreCommand ?? "npm run docker:engines";
  const professorCommand = report.docker?.professorCommand ?? "npm run docker:professor";
  const leanCommand = report.docker?.leanCommand ?? "docker compose run --rm lean-proof npm run cli -- engines verify --require-lean";
  const strictReviewerCommand = report.docker?.allEnginesCommand ?? "npm run docker:all-engines";
  const statusClass = report.status === "passed" ? "exact" : report.status === "partial" ? "checked" : "waiting";
  const warnings = Array.isArray(report.warnings) ? report.warnings : [];
  const savedRun = latestEngineRun();
  const strictSavedRun = latestEngineRun({ requireAllEngines: true });
  const savedRunCount = Array.isArray(state.engineRuns) ? state.engineRuns.length : 0;
  const strictModeActive = Number(report.requiredTotal ?? 0) >= 5;
  const defaultSaving = state.engineRunsSaving && state.engineRunsSavingMode !== "all-engines";
  const strictSaving = state.engineRunsSaving && state.engineRunsSavingMode === "all-engines";

  engineEvidenceGate.innerHTML = `<div class="panel-heading compact-heading">
    <div>
      <h3>Engine Evidence Gate</h3>
      <p class="panel-subtitle">reviewer-grade engine evidence, not install probes</p>
    </div>
    <span class="status-pill ${statusClass}">${escapeHtml(engineEvidenceStatusLabel(report.status))}</span>
  </div>
  <div class="engine-evidence-summary">
    <div>
      <span class="mini-label">Concrete checks</span>
      <strong>${escapeHtml(`${report.concretePassed ?? 0}/${report.concreteTotal ?? cases.length}`)}</strong>
      <small>${escapeHtml(`${report.evidenceMinted ?? 0} evidence records minted`)}</small>
    </div>
    <div>
      <span class="mini-label">Required gates</span>
      <strong>${escapeHtml(`${report.requiredPassed ?? 0}/${report.requiredTotal ?? 0}`)}</strong>
      <small>${escapeHtml(strictModeActive ? "all-engines standard" : report.requiredTotal > 0 ? "custom strict mode" : "daily smoke")}</small>
    </div>
    <div>
      <span class="mini-label">Network</span>
      <strong>${escapeHtml(report.networkAccess ?? "none")}</strong>
      <small>${escapeHtml(report.docker?.networkPolicy ?? "local status")}</small>
    </div>
    <div>
      <span class="mini-label">Reviewer standard</span>
      <strong>${escapeHtml(strictModeActive ? "strict" : "fast")}</strong>
      <small>${escapeHtml(strictSavedRun ? `last strict: ${strictSavedRun.status}` : "strict run not saved")}</small>
    </div>
  </div>
  <div class="engine-evidence-command-stack">
    <div class="engine-evidence-command-row primary">
      <div>
        <span class="mini-label">Professor evidence rehearsal</span>
        <code>${escapeHtml(professorCommand)}</code>
      </div>
      <button class="text-button compact-button copy-engine-evidence-command" data-testid="copy-professor-evidence-command" data-command="${escapeHtml(professorCommand)}" type="button">Copy professor</button>
    </div>
    <div class="engine-evidence-command-row">
      <div>
        <span class="mini-label">Daily engine smoke</span>
        <code>${escapeHtml(command)}</code>
      </div>
      <button class="text-button compact-button copy-engine-evidence-command" data-testid="copy-engine-evidence-command" data-command="${escapeHtml(command)}" type="button">Copy smoke</button>
      <button class="text-button compact-button save-engine-evidence-run" data-testid="save-engine-evidence-run" data-require-all-engines="false" type="button" ${state.engineRunsSaving ? "disabled" : ""}>${defaultSaving ? "Saving" : "Save smoke"}</button>
    </div>
    <div class="engine-evidence-command-row strict">
      <div>
        <span class="mini-label">Strict reviewer gate</span>
        <code>${escapeHtml(strictReviewerCommand)}</code>
      </div>
      <button class="text-button compact-button copy-engine-evidence-command" data-testid="copy-all-engines-command" data-command="${escapeHtml(strictReviewerCommand)}" type="button">Copy strict</button>
      <button class="text-button compact-button save-engine-evidence-run strong-action" data-testid="save-all-engines-run" data-require-all-engines="true" type="button" ${state.engineRunsSaving ? "disabled" : ""}>${strictSaving ? "Saving strict" : "Save strict run"}</button>
    </div>
    <div class="engine-evidence-command-row lean">
      <div>
        <span class="mini-label">Lean fixture path</span>
        <code>${escapeHtml(leanCommand)}</code>
      </div>
      <button class="text-button compact-button copy-engine-evidence-command" data-command="${escapeHtml(leanCommand)}" type="button">Copy Lean</button>
    </div>
  </div>
  <div class="engine-evidence-saved-grid">
    <div class="engine-evidence-saved-run ${savedRun ? "" : "empty"}">
      <div>
        <span class="mini-label">Latest saved run</span>
        <strong>${escapeHtml(savedRun ? `${savedRunCount} saved` : "none saved")}</strong>
        <small>${escapeHtml(savedRun ? `${savedRun.status} / ${savedRun.path}` : "Save a local engine run into .truth-harness/engine-runs.")}</small>
        ${state.engineRunsError ? `<small class="warning-text">${escapeHtml(state.engineRunsError)}</small>` : ""}
      </div>
      ${savedRun ? `<code>${escapeHtml(savedRun.runId)}</code>` : `<code>truth-harness engines verify --write</code>`}
    </div>
    <div class="engine-evidence-saved-run ${strictSavedRun ? "strict" : "empty"}">
      <div>
        <span class="mini-label">Latest strict reviewer run</span>
        <strong>${escapeHtml(strictSavedRun ? strictSavedRun.status : "not saved")}</strong>
        <small>${escapeHtml(strictSavedRun ? `${strictSavedRun.requiredPassed}/${strictSavedRun.requiredTotal} required gates / ${strictSavedRun.path}` : "Use Save strict run before sending a reviewer bundle.")}</small>
      </div>
      ${strictSavedRun ? `<code>${escapeHtml(strictSavedRun.runId)}</code>` : `<code>--require-all-engines</code>`}
    </div>
  </div>
  <div class="engine-evidence-case-grid">
    ${cases.length > 0 ? cases.map((entry) => engineEvidenceCaseHtml(entry)).join("") : `<article class="engine-evidence-case missing"><strong>No cases returned</strong><p>The local API could not load the engine evidence report.</p></article>`}
  </div>
  ${warnings.length > 0 ? `<ul class="engine-evidence-warnings">${warnings.slice(0, 4).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : `<p class="engine-evidence-boundary">Readiness probes are provenance only. Trust upgrades require the concrete evidence rows above or attached receipt artifacts.</p>`}`;

  engineEvidenceGate.querySelectorAll(".copy-engine-evidence-command").forEach((button) => {
    button.addEventListener("click", (event) => {
      copyOrDownloadText({
        text: `${event.currentTarget.dataset.command ?? command}\n`,
        filename: `truth-harness-engine-evidence-${safeFilenameTimestamp()}.txt`,
        type: "text/plain",
        button: event.currentTarget,
        copiedTitle: "Copied engine evidence command",
        copiedDetail: "Run this from the workspace to reproduce the local engine evidence gate.",
        fallbackTitle: "Downloaded engine evidence command",
        fallbackDetail: "the engine evidence command was saved as plain text instead."
      });
    });
  });
  engineEvidenceGate.querySelectorAll(".save-engine-evidence-run").forEach((button) => {
    button.addEventListener("click", (event) => {
      void saveEngineEvidenceRun(event.currentTarget, {
        requireAllEngines: event.currentTarget.dataset.requireAllEngines === "true"
      });
    });
  });
}

function latestEngineRun({ requireAllEngines = false } = {}) {
  const runs = Array.isArray(state.engineRuns) ? state.engineRuns : [];
  return runs
    .filter((run) => run && typeof run.createdAt === "string")
    .filter((run) => !requireAllEngines || Number(run.requiredTotal ?? 0) >= 5)
    .slice()
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
}

function engineEvidenceCaseHtml(entry) {
  const status = entry.status ?? "missing";
  const statusClass = engineEvidenceCaseClass(status);
  const trust = entry.trust ?? "none";
  const evidence = entry.evidenceMinted ? "evidence earned" : "no evidence minted";
  const replay = entry.replay ?? entry.command ?? "";

  return `<article class="engine-evidence-case ${statusClass}">
    <div>
      <span class="task-state ${statusClass}"></span>
      <strong>${escapeHtml(entry.displayName ?? entry.id ?? "Engine case")}</strong>
      <span>${escapeHtml(engineEvidenceCaseLabel(status))}</span>
    </div>
    <p>${escapeHtml(engineEvidenceCaseSummary(entry))}</p>
    <small>${escapeHtml(`${trust} / ${evidence}`)}</small>
    ${replay ? `<code>${escapeHtml(replay)}</code>` : ""}
  </article>`;
}

function engineEvidenceCaseSummary(entry) {
  const summary = entry.summary ?? "No engine case summary returned.";
  if (/spawnSync\s+\S+\s+EPERM/iu.test(summary)) {
    return `${entry.displayName ?? "This engine"} could not be launched from the host process. Use the pinned Docker smoke command for a clean no-network evidence run.`;
  }
  return summary;
}

function engineEvidenceStatusLabel(status) {
  switch (status) {
    case "passed":
      return "evidence passed";
    case "partial":
      return "partial evidence";
    case "failed":
      return "evidence gaps";
    default:
      return "checking";
  }
}

function engineEvidenceCaseClass(status) {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
      return "missing";
    case "not-required":
      return "waiting";
    case "missing":
    default:
      return "waiting";
  }
}

function engineEvidenceCaseLabel(status) {
  switch (status) {
    case "passed":
      return "PASS";
    case "failed":
      return "FAIL";
    case "not-required":
      return "SKIP";
    case "missing":
    default:
      return "MISS";
  }
}

function safetyStatusSummary(payload) {
  const sandbox = payload?.safety?.codeRunSandbox;
  const runtime = runtimeIdentityForUi(payload);
  if (!sandbox) {
    return `Local status endpoint responded without sandbox metadata. Runtime: ${runtime.label}.`;
  }

  if (sandbox.canAttestNetworkNone) {
    return `Code-run sandbox attested by ${formatSafetyPhrase(sandbox.provider)} with ${formatSafetyPhrase(sandbox.networkIsolation)} network isolation. Runtime: ${runtime.label}.`;
  }

  return `Code-run sandbox not attested: ${sandbox.reason ?? "no measured sandbox provider"}. Runtime: ${runtime.label}.`;
}

function engineReadinessSummary(payload) {
  const report = payload?.engineReadiness;
  const readiness = payload?.verification;
  const manifest = payload?.engineManifest;
  if (report) {
    const summary = report.summary ?? {};
    const gates = Array.isArray(report.gates) ? report.gates : [];
    const blockedGates = gates
      .filter((gate) => gate.status !== "ready")
      .map((gate) => gate.title ?? gate.id)
      .filter(Boolean);
    return `${formatSafetyPhrase(report.status)}; ${summary.readyClaimClasses ?? 0}/${summary.totalClaimClasses ?? 0} claim classes responsibly supported; ready labels: ${
      Array.isArray(summary.readyTrustLabels) && summary.readyTrustLabels.length > 0
        ? summary.readyTrustLabels.join(", ")
        : "none"
    }. ${blockedGates.length > 0 ? `Blocked gates: ${blockedGates.join(", ")}.` : "All readiness gates are open."}`;
  }

  if (!readiness) {
    return "No verification engine readiness metadata returned.";
  }

  const engines = Array.isArray(readiness.engines) ? readiness.engines : [];
  const readyCount = Number.isFinite(readiness.readyCount)
    ? readiness.readyCount
    : engines.filter((engine) => engine.status === "available").length;
  const totalCount = Number.isFinite(readiness.totalCount) ? readiness.totalCount : engines.length;
  const nativeCount = Number.isFinite(manifest?.nativeCount) ? manifest.nativeCount : 0;
  const activeCapabilities = Number.isFinite(manifest?.totalCount) ? manifest.totalCount : 0;
  const missing = engines
    .filter((engine) => engine.status !== "available")
    .map((engine) => engine.displayName ?? engine.id)
    .filter(Boolean);

  if (missing.length === 0 && totalCount > 0) {
    return `${readyCount}/${totalCount} local verification engines available, with ${nativeCount}/${activeCapabilities} native/workspace capabilities active. Probes are readiness only, not evidence.`;
  }

  return `${readyCount}/${totalCount} local verification engines available, with ${nativeCount}/${activeCapabilities} native/workspace capabilities active. Missing: ${missing.join(", ") || "unknown"}.`;
}

function engineEvidenceSummary(payload) {
  const report = payload?.engineVerification;
  if (!report) {
    return "No concrete engine evidence report returned.";
  }

  const concretePassed = Number.isFinite(report.concretePassed) ? report.concretePassed : 0;
  const concreteTotal = Number.isFinite(report.concreteTotal) ? report.concreteTotal : 0;
  const evidenceMinted = Number.isFinite(report.evidenceMinted) ? report.evidenceMinted : 0;
  const warnings = Array.isArray(report.warnings) ? report.warnings.length : 0;
  return `${concretePassed}/${concreteTotal} concrete engine evidence checks passed; ${evidenceMinted} replayable evidence records minted; ${warnings} warnings.`;
}

function engineReadinessStatusLabel(status, fallback) {
  switch (status) {
    case "professor-ready":
      return "professor ready";
    case "research-core-ready":
      return "research core";
    case "partial":
      return "partial";
    case "blocked":
      return "blocked";
    default:
      return fallback.allReady ? "all ready" : fallback.anyReady ? `${fallback.readyCount}/${fallback.totalCount} ready` : "install engines";
  }
}

function engineReadinessStatusClass(status, fallback) {
  switch (status) {
    case "professor-ready":
      return "exact";
    case "research-core-ready":
      return "checked";
    case "blocked":
      return "refuted";
    case "partial":
      return "waiting";
    default:
      return fallback.allReady ? "exact" : fallback.anyReady ? "checked" : "waiting";
  }
}

function workspaceReadinessSummary(readiness) {
  if (!readiness) {
    return "Workspace health unavailable.";
  }

  const validation = readiness.summary?.validation ?? {};
  const review = readiness.summary?.review ?? {};
  const graph = readiness.summary?.graph ?? {};
  return `Workspace ${workspaceReadinessLabel(readiness.status)}; ${validation.checkedFiles ?? 0} files checked, ${graph.missingRefs ?? 0} missing refs, ${review.totalItems ?? 0} queue items.`;
}

function workspaceReadinessActivityTrust(status) {
  if (status === "healthy" || status === "open-work") return "passed";
  if (status === "blocked") return "refuted";
  return "waiting";
}

function workspaceReadinessLabel(status) {
  switch (status) {
    case "healthy":
      return "healthy";
    case "open-work":
      return "open work";
    case "critical-work":
      return "critical work";
    case "missing-refs":
      return "missing refs";
    case "blocked":
      return "blocked";
    default:
      return "checking";
  }
}

function workspaceReadinessClass(status) {
  switch (status) {
    case "healthy":
      return "exact";
    case "open-work":
      return "checked";
    case "blocked":
      return "refuted";
    case "critical-work":
    case "missing-refs":
    default:
      return "waiting";
  }
}

function workspaceReadinessValueHtml(label, value) {
  if (label === "Stress") {
    return `<code>${escapeHtml(value)}</code>`;
  }
  return escapeHtml(value);
}

function engineReadinessValue(engine) {
  const status = formatSafetyPhrase(engine.status ?? "unknown");
  const command = engine.command ? `<code>${escapeHtml(engine.command)}</code>` : "";
  const version = engine.version ? `<small>${escapeHtml(engine.version)}</small>` : "";
  const boundary = engine.trustBoundary ? `<small>${escapeHtml(engine.trustBoundary)}</small>` : "";

  return `<span>${escapeHtml(engine.displayName ?? engine.id ?? "Backend")} - ${escapeHtml(status)}</span>${command}${version}${boundary}`;
}

function formatSafetyPhrase(value) {
  return String(value ?? "unknown").replaceAll("-", " ");
}

function verificationRows(receipt) {
  const routeRows = routeObligationVerificationRows(receipt);
  const catalogRows = verificationGateCatalog.map((gate) => {
    const applicable = gate.applies(receipt);
    const status = applicable ? gate.status(receipt) : "skipped";
    return {
      ...gate,
      status
    };
  });

  return [...routeRows, ...catalogRows];
}

function routeObligationVerificationRows(receipt) {
  const route = receipt?.verifierRoute;
  const obligations = route?.proofObligations ?? [];
  return obligations
    .filter((obligation) => obligation.status !== "not-required")
    .slice(0, 6)
    .map((obligation) => {
      const command = obligation.command ?? commandForObligation(obligation, receipt);
      return {
        id: `route-obligation-${obligation.obligationId}`,
        label: obligation.title,
        command,
        description: [
          obligation.requiredBefore,
          obligation.nextStep,
          obligation.satisfactionSummary
        ].filter(Boolean).join(" "),
        severity: obligation.severity,
        requiredBefore: obligation.requiredBefore,
        nextStep: obligation.nextStep,
        evidencePath: obligationEvidencePath(obligation),
        acceptanceSummary: obligationAcceptanceSummary(obligation),
        attachedEvidenceSummary: routeObligationAttachedEvidenceSummary(obligation),
        status: obligation.status === "satisfied"
          ? "passed"
          : obligation.severity === "critical" ? "missing" : "waiting",
        routeId: route.routeId,
        obligationId: obligation.obligationId,
        obligationKind: obligation.kind,
        canRunCas: obligation.status === "open"
          && obligation.kind === "independent-check"
          && command.startsWith("truth-harness cas check")
          && casResultLooksCheckable(receipt),
        canRunSmt: obligation.status === "open"
          && obligation.kind === "solver-encoding"
          && Boolean(smtProblemDraftForReceipt(receipt))
      };
    });
}

function commandForObligation(obligation, receipt) {
  if (obligation.kind === "independent-check") {
    return `truth-harness cas check --operation simplify --expression "${truncateForCommand(casExpressionForReceipt(receipt), 36)}" --result "${truncateForCommand(casResultForReceipt(receipt), 24)}" --write`;
  }

  if (obligation.kind === "solver-encoding") {
    return "truth-harness smt check <constraints.smt2> --write";
  }

  if (obligation.kind === "formal-proof") {
    return "truth-harness proof check <proof.lean> --write";
  }

  return receipt.replay;
}

function obligationEvidencePath(obligation) {
  if (obligation.kind === "formal-proof") {
    return "Accepted proof-check record from .truth-harness/proofs, or a proof-checker-backed receipt/route labeled proved.";
  }

  if (obligation.kind === "solver-encoding") {
    return "SMT-check record from .truth-harness/smt with trust smt-checked, or stronger proof evidence.";
  }

  if (obligation.kind === "independent-check") {
    return "Independent CAS-check record from .truth-harness/cas with trust cross-checked, or stronger SMT/proof evidence.";
  }

  return "Replayable evidence artifact stronger than unverified, with the local artifact path attached to this route.";
}

function obligationAcceptanceSummary(obligation) {
  if (obligation.satisfactionSummary) {
    return obligation.satisfactionSummary;
  }

  const criteria = Array.isArray(obligation.acceptanceCriteria) ? obligation.acceptanceCriteria : [];
  if (criteria.length > 0) {
    return criteria[0];
  }

  return "Attach a replayable local evidence artifact that satisfies this obligation kind.";
}

function routeObligationAttachedEvidenceSummary(obligation) {
  const refs = Array.isArray(obligation.satisfiedBy) ? obligation.satisfiedBy : [];
  if (refs.length === 0) {
    return "No evidence attached yet.";
  }

  if (refs.length === 1) {
    const ref = refs[0];
    const trust = ref.trust ? ` (${ref.trust})` : "";
    return `${ref.kind}:${ref.ref}${trust}`;
  }

  return `${refs.length} evidence refs attached.`;
}

function casOperationForReceipt(receipt) {
  const text = `${receipt.title} ${receipt.replay}`.toLowerCase();
  if (/\bfactor\b/u.test(text)) {
    return "factor";
  }
  if (/\bexpand\b/u.test(text)) {
    return "expand";
  }
  if (/\bdifferentiate\b|\bderivative\b/u.test(text)) {
    return "differentiate";
  }
  if (/\bintegrate\b|\bintegral\b/u.test(text)) {
    return "integrate";
  }

  return "simplify";
}

function casExpressionForReceipt(receipt) {
  const raw = String(receipt.title ?? "").trim();
  return raw
    .replace(/^(compute|calculate|simplify|symbolic\s+simplify|factor|expand|differentiate|derive|integrate)\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim() || raw;
}

function casResultForReceipt(receipt) {
  return String(receipt.output ?? receipt.details?.Output ?? "").trim();
}

function casResultLooksCheckable(receipt) {
  const result = casResultForReceipt(receipt);
  if (!result) {
    return false;
  }

  return !/\b(unavailable|unsupported|failed|failure|error|could not|missing|not installed)\b/iu.test(result);
}

function smtProblemDraftForReceipt(receipt) {
  const text = String(receipt?.title ?? "").trim();
  if (!/[<>!=]=?|[<>]/u.test(text)) {
    return undefined;
  }

  const constraintText = extractSmtConstraintText(text);
  if (!constraintText) {
    return undefined;
  }

  const constraints = constraintText
    .split(/\s+(?:and|&&)\s+|[;,]/iu)
    .map((item) => cleanSmtConstraintFragment(item))
    .filter(Boolean);
  if (constraints.length === 0) {
    return undefined;
  }

  const reserved = new Set([
    "and",
    "check",
    "constraint",
    "constraints",
    "find",
    "for",
    "integer",
    "integers",
    "model",
    "sat",
    "satisfiable",
    "solve",
    "smt",
    "such",
    "that",
    "where"
  ]);
  const variables = [...new Set(constraints.flatMap((constraint) =>
    [...constraint.matchAll(/\b[A-Za-z][A-Za-z0-9_]*\b/gu)]
      .map((match) => match[0])
      .filter((word) => !reserved.has(word.toLowerCase()))
  ))].sort();

  if (variables.length === 0) {
    return undefined;
  }

  return {
    queryName: `web-${receipt.runId ?? "smt"}`,
    variables,
    constraints,
    includeModel: true
  };
}

function extractSmtConstraintText(text) {
  const explicit = /\b(?:constraints?|where|such that)\b[:\s-]*(.+)$/iu.exec(text);
  if (explicit?.[1]) {
    return explicit[1].trim();
  }

  if (/\b(?:smt|solver|sat|satisfiable)\b/iu.test(text)) {
    return text;
  }

  return undefined;
}

function cleanSmtConstraintFragment(value) {
  return value
    .replace(/[\u2264]/gu, "<=")
    .replace(/[\u2265]/gu, ">=")
    .replace(/[\u2260]/gu, "!=")
    .replace(/^(?:(?:solve|check|find|integer|integers|constraints?|where|such|that|smt|sat|satisfiable)\s+)+/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function verificationRowActionHtml(row) {
  if (row.status === "passed" || !row.obligationId) {
    return "";
  }

  if (row.canRunCas) {
    return `<div class="matrix-row-actions">
      <button class="text-button compact-button run-cas-obligation" data-route-id="${escapeHtml(row.routeId)}" data-obligation-id="${escapeHtml(row.obligationId)}" type="button">Run CAS + attach</button>
      <span class="mini-label">writes .truth-harness/cas first</span>
    </div>`;
  }

  if (row.canRunSmt) {
    return `<div class="matrix-row-actions">
      <button class="text-button compact-button run-smt-obligation" data-route-id="${escapeHtml(row.routeId)}" data-obligation-id="${escapeHtml(row.obligationId)}" type="button">Run Z3 + attach</button>
      <span class="mini-label">writes .truth-harness/smt first</span>
    </div>`;
  }

  return `<div class="matrix-row-actions">
    <button class="text-button compact-button copy-obligation-command" data-command="${escapeHtml(row.command)}" type="button">Copy command</button>
    <span class="mini-label">${escapeHtml(row.obligationKind ?? "evidence")} evidence required</span>
  </div>`;
}

function statusLabel(status) {
  if (status === "passed") {
    return "verified";
  }

  if (status === "missing") {
    return "required gap";
  }

  if (status === "skipped") {
    return "not applicable";
  }

  return "waiting";
}

function agentRouteCommands(receipt) {
  return {
    receipt: `truth-harness ask "${truncateForCommand(receipt.title, 34)}" --json`,
    replay: `truth-harness replay ${receipt.runId}.json`,
    report: `truth-harness render ${receipt.runId}.json markdown`
  };
}

function truncateForCommand(value, maxLength) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function quoteCommandArgForUi(value) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return /^[A-Za-z0-9_./\\:-]+$/u.test(text) ? text : JSON.stringify(text);
}

function applySidebarSearch() {
  const query = state.sidebarQuery.trim().toLowerCase();
  let matched = 0;
  let total = sidebarRecentEntries("").length;

  document.querySelectorAll(".project-row, .session-row, .lane-row, .task-row, .progress-row").forEach((row) => {
    total += 1;
    const visible = !query || searchableSidebarText(row).includes(query);
    row.hidden = !visible;
    if (visible) {
      matched += 1;
    }
  });

  matched += claimList.querySelectorAll(".claim-row").length;
  const catalogResults = state.catalogSearch?.results?.length ?? 0;
  if (query && catalogResults > 0) {
    matched += catalogResults;
    total += catalogResults;
  }
  sidebarSearchCount.textContent = query ? `${matched} of ${total}` : "all items";
}

function searchableSidebarText(row) {
  const protocol = row.dataset.lane ? laneProtocols[row.dataset.lane] : undefined;
  return [
    row.textContent,
    protocol?.title,
    protocol?.claimStandard,
    ...(protocol?.acceptedEvidence ?? []),
    ...(protocol?.verificationGates ?? []),
    ...(protocol?.reviewBoundary ?? []),
    ...(protocol?.deliverables ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

function renderReplay(receipt) {
  if (!receipt) {
    return;
  }

  const frames = replayFrames(receipt);
  const activeIndex = Math.min(state.replayIndex, frames.length - 1);
  state.replayIndex = activeIndex;
  state.replayLimit = Math.max(state.replayLimit, activeIndex + 1);
  const activeFrame = frames[activeIndex];
  const visibleFrames = frames.slice(0, state.replayLimit);
  const percent = frames.length <= 1 ? 100 : (activeIndex / (frames.length - 1)) * 100;

  playReplayButton.textContent = state.replayPlaying ? "Pause" : "Play";
  replayProgressBar.style.width = `${percent}%`;
  if (replayPage) {
    replayPage.textContent = pagerSummary(visibleFrames.length, frames.length, "frame");
  }
  if (replayShowMoreButton) {
    replayShowMoreButton.hidden = visibleFrames.length >= frames.length;
  }
  replayFrame.innerHTML = `<span class="task-state ${activeFrame.status}"></span>
    <div>
      <strong>${escapeHtml(activeFrame.title)}</strong>
      <p>${escapeHtml(activeFrame.detail)}</p>
      <small>${escapeHtml(activeFrame.actor)} - ${escapeHtml(activeFrame.kind)}</small>
    </div>`;
  replayList.innerHTML = visibleFrames
    .map((frame, index) => `<button class="replay-step ${index === activeIndex ? "active" : ""}" data-replay-index="${index}" type="button">
      <span class="task-state ${frame.status}"></span>
      <span>
        <strong>${escapeHtml(frame.title)}</strong>
        <small>${escapeHtml(frame.detail)}</small>
      </span>
    </button>`)
    .join("");
}

function replayFrames(receipt) {
  return [
    {
      actor: "human",
      kind: "problem",
      status: trustClass(receipt.trust),
      title: "Problem received",
      detail: receipt.title
    },
    ...receipt.graph.map(([kind, summary], index) => ({
      actor: receipt.engine,
      kind,
      status: trustClass(receipt.trust),
      title: `Evidence ${index + 1}: ${kind}`,
      detail: summary
    })),
    ...activityEvents.slice().reverse().map((event) => ({
      actor: event.actor,
      kind: "activity",
      status: event.status,
      title: event.title,
      detail: `${formatActivityTime(event.at)} - ${event.detail}`
    }))
  ];
}

function setReplayPlaying(playing) {
  state.replayPlaying = playing;
  if (replayTimer) {
    clearInterval(replayTimer);
    replayTimer = undefined;
  }

  if (playing) {
    replayTimer = setInterval(() => {
      const receipt = receiptStore.get(state.receiptKey);
      if (!receipt) {
        setReplayPlaying(false);
        return;
      }

      const lastIndex = replayFrames(receipt).length - 1;
      if (state.replayIndex >= lastIndex) {
        setReplayPlaying(false);
        renderReplay(receipt);
        return;
      }

      state.replayIndex += 1;
      renderReplay(receipt);
    }, 850);
  }

  const receipt = receiptStore.get(state.receiptKey);
  if (receipt) {
    renderReplay(receipt);
  }
}

function resetReplay() {
  setReplayPlaying(false);
  state.replayIndex = 0;
  state.replayLimit = REPLAY_PAGE_SIZE;
  renderReplay(receiptStore.get(state.receiptKey));
}

function exportReplayImage() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  downloadTextFile(`${receipt.runId}-session-replay.svg`, replaySvg(receipt), "image/svg+xml");
  addActivity("human", "Exported session replay image", `${receipt.runId} replay image saved as SVG.`, "passed");
}

function replaySvg(receipt) {
  const frames = replayFrames(receipt).slice(0, 9);
  const width = 1100;
  const rowHeight = 76;
  const height = 190 + frames.length * rowHeight;
  const rows = frames.map((frame, index) => {
    const y = 150 + index * rowHeight;
    const color = frame.status === "refuted" ? "#f28b82" : frame.status === "waiting" ? "#e6c36a" : "#7dd3a8";
    return `<g transform="translate(42 ${y})">
      <circle cx="10" cy="15" r="5" fill="${color}" />
      <text x="30" y="18" fill="#f2f2ee" font-size="20" font-weight="700">${escapeXml(frame.title)}</text>
      <text x="30" y="48" fill="#aaa59d" font-size="16">${escapeXml(truncateForImage(frame.detail, 118))}</text>
    </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#101010" />
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="20" fill="#171717" stroke="#30302f" />
    <text x="42" y="70" fill="#f2f2ee" font-family="Inter, Segoe UI, sans-serif" font-size="30" font-weight="750">Truth Harness Session Replay</text>
    <text x="42" y="108" fill="#b7a98a" font-family="Inter, Segoe UI, sans-serif" font-size="18">${escapeXml(receipt.runId)} - ${escapeXml(receipt.trust)}</text>
    ${rows}
  </svg>`;
}

function truncateForImage(value, maxLength) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function evidenceGraphEntries(receipt) {
  const upstream = receiptDependencies(receipt)
    .map((key) => ["depends_on", linkedClaimLabel(key)]);
  const downstream = dependentReceiptKeys(receipt)
    .map((key) => ["unlocks", linkedClaimLabel(key)]);
  const ledgerEntries = claimLedgerGraphEntries(receipt);
  const tags = receiptTags(receipt).length > 0
    ? [["tags", receiptTags(receipt).map((tag) => `#${tag}`).join(" ")]]
    : [];

  return [...upstream, ...ledgerEntries, ...receipt.graph, ...downstream, ...tags];
}

function graphInspectorEntries(receipt) {
  const nodeCount = workspaceGraph.summary?.nodes ?? 0;
  if (nodeCount <= 0) {
    return evidenceGraphEntries(receipt);
  }

  const edgeCount = workspaceGraph.summary?.edges ?? 0;
  const missingRefs = workspaceGraph.summary?.missingRefs ?? 0;
  const validation = workspaceGraph.validation ?? {};
  const validationSummary = validation.passed
    ? "validated local workspace graph"
    : `${validation.errors ?? 0} errors / ${validation.warnings ?? 0} warnings`;

  return [
    ["workspace_graph", `${nodeCount} nodes / ${edgeCount} edges`],
    ["validation", validationSummary],
    ["missing_refs", `${missingRefs} unresolved reference${missingRefs === 1 ? "" : "s"}`],
    ...evidenceGraphEntries(receipt).slice(0, 4)
  ];
}

function claimLedgerGraphEntries(receipt) {
  if (!receipt.claimId) {
    return [["ledger_status", "Not recorded in the local claim ledger yet."]];
  }

  const claim = claimLedgerStore.get(receipt.claimId);
  if (!claim) {
    return [["ledger_status", `${receipt.claimId} not loaded from local claim ledger.`]];
  }

  const dependencies = (claim.dependsOn ?? []).map((claimId) => ["claim_depends_on", claimLedgerLabel(claimId)]);
  const supersedes = (claim.supersedes ?? []).map((claimId) => ["claim_supersedes", claimLedgerLabel(claimId)]);
  const unlocks = (claimLedgerGraph.edges ?? [])
    .filter((edge) => edge.kind === "depends-on" && edge.from === receipt.claimId)
    .map((edge) => ["claim_unlocks", claimLedgerLabel(edge.to)]);
  return [
    ["claim_record", `${claim.claimId} (${claim.trust}, ${claim.status})`],
    ...dependencies,
    ...supersedes,
    ...unlocks
  ];
}

function claimLedgerLabel(claimId) {
  const claim = claimLedgerStore.get(claimId);
  return claim ? `${claim.title} (${claim.claimId})` : claimId;
}

function graphDisplayEntries(receipt) {
  const nodes = Array.isArray(workspaceGraph.nodes) ? workspaceGraph.nodes : [];
  if (nodes.length === 0) {
    return evidenceGraphEntries(receipt).map(([kind, summary]) => ({
      kind,
      summary,
      source: "receipt"
    }));
  }

  const currentIds = new Set([
    receipt.runId,
    receipt.claimId,
    receipt.verifierRoute?.routeId
  ].filter(Boolean));

  const workspaceEntries = [...nodes]
    .sort((left, right) =>
      graphNodeRank(left, currentIds) - graphNodeRank(right, currentIds) ||
      String(left.label ?? left.artifactId ?? left.path ?? left.nodeId).localeCompare(String(right.label ?? right.artifactId ?? right.path ?? right.nodeId))
    )
    .slice(0, 40)
    .map((node) => ({
      kind: graphNodeKindLabel(node),
      summary: node.label ?? node.artifactId ?? node.path ?? node.nodeId,
      source: "workspace",
      node
    }));

  return [
    {
      kind: "workspace graph",
      summary: `${workspaceGraph.summary?.nodes ?? nodes.length} nodes / ${workspaceGraph.summary?.edges ?? 0} edges / ${workspaceGraph.summary?.missingRefs ?? 0} missing refs`,
      source: "workspace",
      workspaceSummary: true
    },
    ...workspaceEntries
  ];
}

function graphNodeRank(node, currentIds) {
  if (currentIds.has(node.artifactId)) {
    return 0;
  }
  if (node.valid !== false && node.kind === "claims") {
    return 1;
  }
  if (node.valid !== false && node.kind === "routes") {
    return 2;
  }
  if (node.valid !== false && node.kind === "sessions") {
    return 3;
  }
  if (node.valid !== false) {
    return 4;
  }
  if (node.missing) {
    return 7;
  }
  return 8;
}

function graphNodeKindLabel(node) {
  const label = String(node.kind ?? "artifact").replaceAll("-", " ");
  if (node.missing) {
    return label === "missing ref" ? "missing ref" : `missing ${label}`;
  }
  if (node.valid === false) {
    return `${label} needs review`;
  }
  return label;
}

function renderMainGraph(receipt) {
  const entries = graphDisplayEntries(receipt);
  if (state.selectedGraphIndex >= entries.length) {
    state.selectedGraphIndex = 0;
  }

  mainGraphList.innerHTML = entries
    .map((entry, index) => `<button class="canvas-node ${entry.node?.missing ? "warning-node" : ""} ${entry.node?.valid === false && !entry.node?.missing ? "invalid-node" : ""} ${index === state.selectedGraphIndex ? "active" : ""}" data-graph-index="${index}" type="button">
      <span class="canvas-index">${index + 1}</span>
      <div>
        <strong>${escapeHtml(entry.kind)}</strong>
        <p>${escapeHtml(entry.summary)}</p>
      </div>
    </button>`)
    .join("");
  renderGraphDetail(receipt, entries[state.selectedGraphIndex], state.selectedGraphIndex);
}

function renderGraphDetail(receipt, entry, index) {
  if (!graphDetail || !entry) {
    return;
  }

  if (entry.workspaceSummary) {
    renderWorkspaceGraphSummaryDetail(index);
    return;
  }

  if (entry.node) {
    renderWorkspaceGraphNodeDetail(entry, index);
    return;
  }

  const kind = Array.isArray(entry) ? entry[0] : entry.kind;
  const summary = Array.isArray(entry) ? entry[1] : entry.summary;
  const claimId = claimIdFromGraphSummary(summary);
  const claim = claimId ? claimLedgerStore.get(claimId) : undefined;
  const linkedReceiptKey = claimId ? receiptKeyForClaimId(claimId) : undefined;
  const currentClaim = receipt.claimId ? claimLedgerStore.get(receipt.claimId) : undefined;
  const previousClaim = kind === "claim_supersedes" && claim ? claim : undefined;
  const compareHtml = currentClaim && previousClaim
    ? renderRevisionCompare(currentClaim, previousClaim)
    : "";
  const finalization = claim ? claimFinalizationSummary(claim) : undefined;
  if (claim?.claimId) {
    void ensureClaimReviewPacket(claim.claimId);
  }
  const claimReviewPacket = claim?.claimId ? claimReviewPacketStore.get(claim.claimId) : undefined;
  const openChecksHtml = claim ? renderClaimOpenChecksHtml(claim) : "";
  const evidenceRefsHtml = claim ? renderClaimEvidenceRefsHtml(claim, claimReviewPacket) : "";
  const claimHtml = claim
    ? `<dl class="graph-detail-facts">
        <div><dt>Claim ID</dt><dd><code>${escapeHtml(claim.claimId)}</code></dd></div>
        <div><dt>Trust</dt><dd>${escapeHtml(claim.trust)}</dd></div>
        <div><dt>Readiness</dt><dd>${escapeHtml(finalization.label)}</dd></div>
        <div><dt>Open checks</dt><dd>${escapeHtml(String(finalization.openChecks.length))}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(claim.status)}</dd></div>
        <div><dt>Domain</dt><dd>${escapeHtml(claim.domain)}</dd></div>
        <div><dt>Updated</dt><dd>${escapeHtml(formatActivityTime(claim.updatedAt))}</dd></div>
        <div><dt>Links</dt><dd>${escapeHtml((claim.dependsOn?.length ?? 0) + " upstream / " + (claim.supersedes?.length ?? 0) + " revisions")}</dd></div>
      </dl>
      <p class="claim-finalization-summary">${escapeHtml(finalization.summary || "No finalization summary recorded.")}</p>
      ${openChecksHtml}
      ${evidenceRefsHtml}
      <div class="graph-detail-tags">${renderTagPills(claim.tags ?? []) || `<span class="mini-label">No tags</span>`}</div>
      ${linkedReceiptKey ? `<button class="text-button compact-button graph-open-receipt" data-claim-id="${escapeHtml(claim.claimId)}" type="button">Open receipt</button>` : ""}`
    : `<p>${escapeHtml(summary)}</p>`;

  graphDetail.innerHTML = `
    <span class="mini-label">node ${index + 1}</span>
    <h4>${escapeHtml(kind)}</h4>
    ${claim ? `<p>${escapeHtml(claim.title)}</p>` : ""}
    ${claimHtml}
    ${compareHtml}
  `;
}

function renderWorkspaceGraphNodeDetail(entry, index) {
  const node = entry.node;
  const edges = workspaceGraphNodeEdges(node.nodeId);
  const issueText = node.issueCodes?.length ? node.issueCodes.join(", ") : "none";
  const repairHtml = node.missing ? renderMissingGraphRefRepair(node, edges) : "";
  const edgeHtml = edges.length
    ? `<ul class="graph-edge-list">
        ${edges.slice(0, 8).map((edge) => `<li>
          <span>${escapeHtml(edge.from === node.nodeId ? "out" : "in")}</span>
          <strong>${escapeHtml(edge.kind)}</strong>
          <code>${escapeHtml(edge.ref)}</code>
          <small>${escapeHtml(edge.resolved ? "resolved" : "missing")}</small>
        </li>`).join("")}
      </ul>`
    : `<p>No recorded workspace edges for this node yet.</p>`;

  graphDetail.innerHTML = `
    <span class="mini-label">workspace node ${index + 1}</span>
    <h4>${escapeHtml(entry.kind)}</h4>
    <p>${escapeHtml(entry.summary)}</p>
    <dl class="graph-detail-facts">
      <div><dt>Artifact ID</dt><dd><code>${escapeHtml(node.artifactId ?? "not recorded")}</code></dd></div>
      <div><dt>Path</dt><dd><code>${escapeHtml(node.path ?? "missing reference")}</code></dd></div>
      <div><dt>Valid</dt><dd>${escapeHtml(node.valid === false ? "needs review" : "yes")}</dd></div>
      <div><dt>Trust</dt><dd>${escapeHtml(node.trust ?? "not a trust-bearing artifact")}</dd></div>
      <div><dt>Schema</dt><dd>${escapeHtml(node.schemaVersion ?? "not recorded")}</dd></div>
      <div><dt>Edges</dt><dd>${escapeHtml(String(edges.length))}</dd></div>
      <div><dt>Issues</dt><dd>${escapeHtml(issueText)}</dd></div>
    </dl>
    ${repairHtml}
    <h5>Evidence Connections</h5>
    ${edgeHtml}
  `;
}

function renderMissingGraphRefRepair(node, edges) {
  const firstEdge = edges[0];
  const refText = firstEdge ? `${firstEdge.refKind ?? "artifact"}:${firstEdge.ref}` : node.label;
  const packet = missingGraphRefRepairPacket(node, edges);
  const sourceList = edges.length
    ? `<ul>${edges.slice(0, 5).map((edge) => `<li><code>${escapeHtml(edge.sourcePath)}</code> <span>${escapeHtml(edge.fieldPath)}</span></li>`).join("")}</ul>`
    : "<p>No source artifact was recorded for this missing ref.</p>";

  return `<section class="graph-repair-panel">
    <h5>Repair Missing Reference</h5>
    <p>This graph node is not corrupted data. It means one or more local artifacts point at evidence that has not been persisted into the workspace yet.</p>
    <dl class="graph-detail-facts">
      <div><dt>Missing ref</dt><dd><code>${escapeHtml(refText)}</code></dd></div>
      <div><dt>Sources</dt><dd>${escapeHtml(String(edges.length))} workspace reference${edges.length === 1 ? "" : "s"}</dd></div>
      <div><dt>Next</dt><dd>Attach a saved receipt, route, claim, or source artifact, then refresh the workspace graph.</dd></div>
    </dl>
    <div class="graph-detail-actions">
      <button class="text-button compact-button graph-copy-text" data-copy-text="${escapeHtml(refText)}" data-copy-title="Copied missing ref" type="button">Copy ref</button>
      <button class="text-button compact-button graph-copy-text" data-copy-text="${escapeHtml(packet)}" data-copy-title="Copied missing-ref repair packet" type="button">Copy repair packet</button>
    </div>
    <h5>Source Fields</h5>
    ${sourceList}
  </section>`;
}

function missingGraphRefRepairPacket(node, edges) {
  const firstEdge = edges[0];
  const refText = firstEdge ? `${firstEdge.refKind ?? "artifact"}:${firstEdge.ref}` : node.label;
  return [
    "# Truth Harness Missing Reference",
    "",
    `Missing ref: ${refText}`,
    `Graph node: ${node.nodeId}`,
    "",
    "## Source Fields",
    ...(edges.length > 0
      ? edges.map((edge) => `- ${edge.sourcePath} ${edge.fieldPath} (${edge.kind})`)
      : ["- No source fields recorded."]),
    "",
    "## Repair Options",
    "- Persist the missing evidence as a receipt, route, claim, source, proof, SMT, CAS, snapshot, or other local artifact.",
    "- Replace legacy refs with workspace-local evidence refs that validation can resolve.",
    "- If this is intentionally external or historical, record that boundary in the artifact summary before relying on the claim.",
    "",
    "Validation command: truth-harness workspace validate",
    "Graph command: truth-harness workspace graph"
  ].join("\n");
}

function renderWorkspaceGraphSummaryDetail(index) {
  const summary = workspaceGraph.summary ?? {};
  const validation = workspaceGraph.validation ?? {};
  const warningHtml = (workspaceGraph.warnings ?? []).length
    ? `<ul class="graph-edge-list">
        ${(workspaceGraph.warnings ?? []).slice(0, 3).map((warning) => `<li>
          <span>note</span>
          <strong>boundary</strong>
          <code>${escapeHtml(warning)}</code>
          <small>local</small>
        </li>`).join("")}
      </ul>`
    : `<p>No workspace graph warnings recorded.</p>`;

  graphDetail.innerHTML = `
    <span class="mini-label">workspace node ${index + 1}</span>
    <h4>Workspace Evidence Graph</h4>
    <p>Local map of receipts, claims, routes, sessions, snapshots, model packets, checks, and unresolved references.</p>
    <dl class="graph-detail-facts">
      <div><dt>Artifacts</dt><dd>${escapeHtml(String(summary.artifacts ?? 0))}</dd></div>
      <div><dt>Valid</dt><dd>${escapeHtml(String(summary.validArtifacts ?? 0))}</dd></div>
      <div><dt>Needs review</dt><dd>${escapeHtml(String(summary.invalidArtifacts ?? 0))}</dd></div>
      <div><dt>Edges</dt><dd>${escapeHtml(String(summary.edges ?? 0))}</dd></div>
      <div><dt>Missing refs</dt><dd>${escapeHtml(String(summary.missingRefs ?? 0))}</dd></div>
      <div><dt>Validation</dt><dd>${escapeHtml(validation.passed ? "passed" : `${validation.errors ?? 0} errors / ${validation.warnings ?? 0} warnings`)}</dd></div>
      <div><dt>Network</dt><dd>${escapeHtml(workspaceGraph.networkAccess ?? "none")}</dd></div>
    </dl>
    <h5>Trust Boundary</h5>
    ${warningHtml}
  `;
}

function workspaceGraphNodeEdges(nodeId) {
  return (workspaceGraph.edges ?? []).filter((edge) => edge.from === nodeId || edge.to === nodeId);
}

function renderBranchMap(receipt) {
  if (!branchMap) {
    return;
  }

  const currentKey = receiptKeyFor(receipt) ?? state.receiptKey;
  const upstream = receiptDependencies(receipt).slice(0, 3);
  const downstream = dependentReceiptKeys(receipt).slice(0, 3);
  const currentLane = upstream.length > 0 ? Math.min(upstream.length, 3) : 0;
  const rows = [
    ...upstream.map((key, index) => ({
      key,
      lane: Math.min(index, 3),
      role: "parent"
    })),
    {
      key: currentKey,
      lane: currentLane,
      role: "head",
      current: true
    },
    ...downstream.map((key, index) => ({
      key,
      lane: branchChildLane(currentLane, index),
      role: index === 0 ? "child" : "branch"
    }))
  ].slice(0, 7);
  const currentRowIndex = rows.findIndex((row) => row.current);
  const laneSet = new Set(rows.map((row) => row.lane));
  const railHtml = [...laneSet]
    .sort((a, b) => a - b)
    .map((lane) => `<line class="git-rail git-rail-${lane}" x1="${branchLaneX(lane)}" y1="18" x2="${branchLaneX(lane)}" y2="${branchRowY(rows.length - 1)}" />`)
    .join("");
  const edgeHtml = rows
    .flatMap((row, index) => {
      if (row.current) {
        return [];
      }
      if (index < currentRowIndex) {
        return [branchEdgePath(row.lane, index, currentLane, currentRowIndex, "parent")];
      }
      return [branchEdgePath(currentLane, currentRowIndex, row.lane, index, "child")];
    })
    .join("");
  const nodeHtml = rows
    .map((row, index) => branchNodeHtml(row, index))
    .join("");

  branchMapStatus.textContent =
    upstream.length > 0 || downstream.length > 0
      ? `${upstream.length} parent / ${downstream.length} child`
      : "single receipt";
  branchMap.innerHTML = `
    <div class="branch-map-stage git-branch-stage">
      <div class="git-branch-canvas branch-rows-${Math.max(rows.length, 1)}">
      <svg class="git-branch-lines" viewBox="0 0 92 ${branchCanvasHeight(rows.length)}" preserveAspectRatio="none" aria-hidden="true">
        ${railHtml}
        ${edgeHtml}
      </svg>
      ${nodeHtml}
      </div>
    </div>
  `;
}

function branchChildLane(currentLane, index) {
  if (index === 0) {
    return currentLane;
  }
  if (index === 1) {
    return Math.min(currentLane + 1, 3);
  }
  return Math.max(currentLane - 1, 0);
}

function branchCanvasHeight(rowCount) {
  return 32 + Math.max(rowCount, 1) * 104;
}

function branchRowY(rowIndex) {
  return 60 + rowIndex * 104;
}

function branchLaneX(lane) {
  return 18 + lane * 14;
}

function branchEdgePath(fromLane, fromRow, toLane, toRow, kind) {
  const x1 = branchLaneX(fromLane);
  const y1 = branchRowY(fromRow);
  const x2 = branchLaneX(toLane);
  const y2 = branchRowY(toRow);
  if (x1 === x2) {
    return `<path class="git-edge git-edge-${kind}" d="M ${x1} ${y1} L ${x2} ${y2}" />`;
  }

  const midY = y1 + (y2 - y1) * 0.5;
  return `<path class="git-edge git-edge-${kind}" d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" />`;
}

function branchNodeHtml(row, index) {
  const { key, lane, role, current = false } = row;
  const receipt = receiptStore.get(key);
  const title = receipt?.title ?? key;
  const trust = receipt?.trust ?? "unverified";
  const tag = receipt?.claimId ?? receipt?.runId ?? key;
  const shortTag = String(tag).replace(/^claim_/u, "cl_").replace(/^run_/u, "run_").slice(0, 18);
  const actionAttrs = current
    ? "disabled aria-current=\"true\""
    : `data-receipt-key="${escapeHtml(key)}"`;

  return `<button class="branch-node git-branch-row git-row-${index} git-lane-${lane} ${current ? "active" : ""}" type="button" ${actionAttrs}>
    <span class="git-dot ${trustClass(trust)}" aria-hidden="true"></span>
    <span class="git-branch-copy">
      <span class="git-branch-title">${escapeHtml(title)}</span>
      <span class="git-branch-meta">
        <span>${escapeHtml(role.toUpperCase())}</span>
        <code>${escapeHtml(shortTag)}</code>
        <span>${escapeHtml(trust)}</span>
      </span>
    </span>
  </button>`;
}

function renderClaimOpenChecksHtml(claim) {
  const checks = claimFinalizationSummary(claim).openChecks;
  if (checks.length === 0) {
    return `<section class="claim-review-panel"><h5>Finalization Checks</h5><p>No open finalization checks.</p></section>`;
  }

  return `<section class="claim-review-panel">
    <h5>Open Finalization Checks</h5>
    <ul>${checks.slice(0, 5).map((check) => `<li>${escapeHtml(check)}</li>`).join("")}</ul>
  </section>`;
}

function renderClaimEvidenceRefsHtml(claim, reviewPacket) {
  const refs = Array.isArray(claim?.evidenceRefs) ? claim.evidenceRefs : [];
  const claimId = claim?.claimId;
  const reviewLoading = claimId ? claimReviewPacketLoading.has(claimId) : false;
  const reviewError = claimId ? claimReviewPacketErrors.get(claimId) : undefined;
  const artifactRefs = workspaceArtifactRefObjects(reviewPacket ?? claim);
  if (refs.length === 0) {
    return `<section class="claim-review-panel">
      <h5>Evidence Refs</h5>
      <p>No local evidence refs attached.</p>
      ${claimReviewPacketStatusHtml(reviewLoading, reviewError, reviewPacket)}
      ${workspaceRunNextArtifactRefsHtml(artifactRefs, "claim-evidence", {
        compact: true,
        emptyHtml: ""
      })}
    </section>`;
  }

  const visibleRefs = refs.slice(0, 6);
  const allowedArtifactPaths = uniqueStrings([
    ...visibleRefs
      .map((ref) => ref.ref)
      .map((ref) => normalizedWorkspaceArtifactRef(ref))
      .filter((ref) => workspaceArtifactRefIsPreviewable(ref)),
    ...workspaceArtifactPathsForValue(reviewPacket ?? claim)
  ]);

  return `<section class="claim-review-panel">
    <h5>Evidence Refs</h5>
    <ul>${visibleRefs.map((ref) => {
      const trust = ref.trust ? ` (${ref.trust})` : "";
      const summary = ref.summary ? ` - ${ref.summary}` : "";
      const refHtml = workspaceArtifactRefIsPreviewable(ref.ref)
        ? `<span class="claim-evidence-ref-kind">${escapeHtml(ref.kind)}:</span>${artifactRefControlHtml(ref.ref, { surface: "claim-evidence", label: "Open" })}`
        : `<code>${escapeHtml(ref.kind)}:${escapeHtml(ref.ref)}</code>`;
      return `<li>${refHtml}${escapeHtml(trust)}${summary ? `<span>${escapeHtml(summary)}</span>` : ""}</li>`;
    }).join("")}</ul>
    ${claimReviewPacketStatusHtml(reviewLoading, reviewError, reviewPacket)}
    ${workspaceRunNextArtifactRefsHtml(artifactRefs, "claim-evidence", {
      compact: true,
      emptyHtml: ""
    })}
    ${workspaceArtifactPreviewHtml("claim-evidence", { allowedPaths: allowedArtifactPaths })}
  </section>`;
}

function claimReviewPacketStatusHtml(loading, error, reviewPacket) {
  if (reviewPacket?.artifactRefs?.length > 0) {
    return `<p class="claim-review-packet-status">Review packet loaded with ${escapeHtml(String(reviewPacket.artifactRefs.length))} local artifact citation${reviewPacket.artifactRefs.length === 1 ? "" : "s"}.</p>`;
  }
  if (loading) {
    return `<p class="claim-review-packet-status">Loading local claim-review artifact citations...</p>`;
  }
  if (error) {
    return `<p class="claim-review-packet-status warning">Claim-review packet unavailable: ${escapeHtml(error)}</p>`;
  }
  return "";
}

function renderRevisionCompare(currentClaim, previousClaim) {
  const addedDependencies = (currentClaim.dependsOn ?? []).filter((claimId) => !(previousClaim.dependsOn ?? []).includes(claimId));
  const removedDependencies = (previousClaim.dependsOn ?? []).filter((claimId) => !(currentClaim.dependsOn ?? []).includes(claimId));
  const addedTags = (currentClaim.tags ?? []).filter((tag) => !(previousClaim.tags ?? []).includes(tag));
  const removedTags = (previousClaim.tags ?? []).filter((tag) => !(currentClaim.tags ?? []).includes(tag));
  const rows = [
    ["Statement", currentClaim.statement === previousClaim.statement ? "unchanged" : "changed"],
    ["Trust", `${previousClaim.trust} -> ${currentClaim.trust}`],
    ["Dependencies added", addedDependencies.map(claimLedgerLabel).join("; ") || "none"],
    ["Dependencies removed", removedDependencies.map(claimLedgerLabel).join("; ") || "none"],
    ["Tags added", addedTags.map((tag) => `#${tag}`).join(", ") || "none"],
    ["Tags removed", removedTags.map((tag) => `#${tag}`).join(", ") || "none"]
  ];

  return `<section class="revision-panel">
    <h5>Revision Compare</h5>
    <dl class="graph-detail-facts">
      ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>
  </section>`;
}

function claimIdFromGraphSummary(summary) {
  const match = String(summary).match(/claim_[a-f0-9]{16}/u);
  return match?.[0];
}

function renderActivityLog() {
  const filteredEvents = filteredActivityEvents();
  const visibleEvents = filteredEvents.slice(0, state.activityLimit);
  const previousScrollTop = activityLog.scrollTop;

  activityCount.textContent =
    filteredEvents.length === activityEvents.length
      ? `${activityEvents.length} events`
      : `${filteredEvents.length} of ${activityEvents.length} events`;
  activityShowMore.hidden = visibleEvents.length >= filteredEvents.length;

  activityLog.innerHTML = visibleEvents.length === 0
    ? `<div class="activity-empty">No matching activity.</div>`
    : visibleEvents
      .map((event) => `<div class="activity-row">
      <span class="task-state ${event.status}"></span>
      <div>
        <div class="activity-row-head">
          <strong>${escapeHtml(event.title)}</strong>
          <time datetime="${escapeHtml(event.at)}">${escapeHtml(formatActivityTime(event.at))}</time>
        </div>
        <small><span>${escapeHtml(event.actor)}</span> - ${escapeHtml(event.detail)}</small>
      </div>
    </div>`)
      .join("");

  activityLog.scrollTop = previousScrollTop;
}

async function refreshWorkspaceEvents({ announce = true, limit = 100 } = {}) {
  if (!activityLog) {
    return;
  }

  try {
    const response = await fetch(`/api/events?limit=${encodeURIComponent(String(limit))}`, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const payload = await readLocalApiJson(response, "Local workspace event log API failed.");
    const added = mergeWorkspaceEventLog(payload.eventLog);
    if (announce) {
      addActivity(
        "local-api",
        "Loaded workspace events",
        localApiSuccessMessage(payload, `${payload.eventLog?.events?.length ?? 0} durable local artifact events loaded.`),
        "passed"
      );
    } else if (added > 0) {
      renderActivityLog();
    }
  } catch (error) {
    if (announce) {
      addActivity("local-api", "Workspace events unavailable", error instanceof Error ? error.message : "Unknown workspace event log failure.", "waiting");
    }
  }
}

function mergeWorkspaceEventLog(eventLog) {
  const events = Array.isArray(eventLog?.events) ? eventLog.events : [];
  let added = 0;
  for (const record of events) {
    const event = activityEventFromWorkspaceEvent(record);
    if (!event || activityEvents.some((item) => item.id === event.id)) {
      continue;
    }
    activityEvents.push(event);
    added += 1;
  }

  if (added > 0) {
    activityEvents.sort((left, right) => right.at.localeCompare(left.at) || right.id.localeCompare(left.id));
  }
  return added;
}

function activityEventFromWorkspaceEvent(record) {
  if (!record?.eventId || !record.createdAt) {
    return undefined;
  }

  const actor = record.actor?.name ?? record.actor?.kind ?? "truth-harness-core";
  const artifact = record.artifactId ?? record.kind ?? "workspace artifact";
  const path = record.path ? ` at ${record.path}` : "";
  const hash = record.artifact?.sha256 ? ` sha256=${record.artifact.sha256.slice(0, 12)}` : "";
  return {
    id: record.eventId,
    actor,
    title: workspaceEventTitle(record.action),
    detail: record.summary ?? `${artifact}${path}${hash}`,
    status: workspaceEventStatus(record.action),
    at: record.createdAt,
    workspaceEventId: record.eventId,
    path: record.path
  };
}

function workspaceEventTitle(action) {
  switch (action) {
    case "artifact-written":
      return "Artifact written";
    case "catalog-stale":
      return "Catalog marked stale";
    case "workspace-initialized":
      return "Workspace initialized";
    default:
      return "Workspace event";
  }
}

function workspaceEventStatus(action) {
  return action === "catalog-stale" ? "waiting" : "passed";
}

function addActivity(actor, title, detail, status = "passed", at = new Date().toISOString()) {
  const requestId = extractActivityRequestId(detail);
  const event = {
    id: `activity_${++activityEventCounter}`,
    actor,
    title,
    detail,
    status,
    at
  };
  if (requestId) {
    event.requestId = requestId;
  }
  activityEvents.unshift(event);
  if (activityLog) {
    renderActivityLog();
  }
  if (reportPreview) {
    renderReport(receiptStore.get(state.receiptKey));
  }
  if (replayList) {
    renderReplay(receiptStore.get(state.receiptKey));
  }
}

function updateLatestActivity(title, status, detail) {
  const event = activityEvents.find((item) => item.title === title);
  if (!event) {
    return;
  }

  event.status = status;
  if (detail) {
    event.detail = detail;
    const requestId = extractActivityRequestId(detail);
    if (requestId) {
      event.requestId = requestId;
    } else {
      delete event.requestId;
    }
  }
  renderActivityLog();
}

function filteredActivityEvents() {
  const query = state.activityQuery.trim().toLowerCase();
  if (!query) {
    return activityEvents;
  }

  return activityEvents.filter((event) => activityEventText(event).toLowerCase().includes(query));
}

function activityEventText(event) {
  return [event.at, event.status, event.actor, event.title, event.detail, event.requestId ?? "", event.workspaceEventId ?? "", event.path ?? ""].join(" ");
}

function extractActivityRequestId(value) {
  return String(value ?? "").match(/\bweb_(?:req|err)_[0-9a-f-]{36}\b/u)?.[0];
}

function formatActivityTime(isoTime) {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return isoTime;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatActivityExport(events) {
  return events
    .map((event) => {
      const requestMarker = event.requestId ? ` request=${event.requestId}` : "";
      const eventMarker = event.workspaceEventId ? ` event=${event.workspaceEventId}` : "";
      return `[${event.at}] ${event.status.toUpperCase()}${requestMarker}${eventMarker} ${event.actor}: ${event.title} - ${event.detail}`;
    })
    .join("\n");
}

async function copyActivityLog() {
  const text = formatActivityExport(activityEvents);
  await copyOrDownloadText({
    text,
    filename: `truth-harness-activity-${safeFilenameTimestamp()}.txt`,
    type: "text/plain",
    button: copyActivityButton,
    copiedTitle: "Copied activity log",
    copiedDetail: `${activityEvents.length} events copied to clipboard.`,
    fallbackTitle: "Downloaded activity log",
    fallbackDetail: `${activityEvents.length} events were saved as plain text instead.`
  });
}

async function copyTaskConsoleCommands() {
  const receipt = receiptStore.get(state.receiptKey);
  const text = formatTaskConsoleCommands(receipt);
  if (!text) {
    return;
  }

  await copyOrDownloadText({
    text: `${text}\n`,
    filename: `truth-harness-agent-console-${safeFilenameTimestamp()}.txt`,
    type: "text/plain",
    button: copyTaskConsoleButton,
    copiedTitle: "Copied agent console commands",
    copiedDetail: `${taskConsoleItems(receipt, verificationRows(receipt)).length} current commands copied.`,
    fallbackTitle: "Downloaded agent console commands",
    fallbackDetail: "the current command surface was saved as plain text instead."
  });
}

async function copyWorkspaceRunNextCommand() {
  const command = workspaceRunNextCommand?.textContent?.trim();
  if (!command) {
    return;
  }

  await copyOrDownloadText({
    text: `${command}\n`,
    filename: `truth-harness-next-action-${safeFilenameTimestamp()}.txt`,
    type: "text/plain",
    button: copyRunNextCommandButton,
    copiedTitle: "Copied next action command",
    copiedDetail: "Workspace run-next command copied for agent handoff.",
    fallbackTitle: "Downloaded next action command",
    fallbackDetail: "Workspace run-next command was saved as plain text instead."
  });
}

async function copyWorkspacePilotLoopCommand() {
  const command = workspacePilotLoopCommand?.textContent?.trim();
  if (!command) {
    return;
  }

  await copyOrDownloadText({
    text: `${command}\n`,
    filename: `truth-harness-pilot-loop-${safeFilenameTimestamp()}.txt`,
    type: "text/plain",
    button: copyPilotLoopCommandButton,
    copiedTitle: "Copied pilot-loop command",
    copiedDetail: "Bounded workspace pilot-loop command copied for supervised agent work.",
    fallbackTitle: "Downloaded pilot-loop command",
    fallbackDetail: "Workspace pilot-loop command was saved as plain text instead."
  });
}

async function copyWorkspaceRunNextHandoffCommand(command, button) {
  const text = String(command ?? "").trim();
  if (!text) {
    return;
  }

  await copyOrDownloadText({
    text: `${text}\n`,
    filename: `truth-harness-saved-handoff-${safeFilenameTimestamp()}.txt`,
    type: "text/plain",
    button,
    copiedTitle: "Copied handoff command",
    copiedDetail: "Saved run-next resume/recovery command copied for an agent.",
    fallbackTitle: "Downloaded handoff command",
    fallbackDetail: "Saved run-next command was saved as plain text instead."
  });
}

async function copyWorkspaceArtifactCitation(citation, button) {
  const text = String(citation ?? "").trim();
  if (!text) {
    return;
  }

  await copyOrDownloadText({
    text: `${text}\n`,
    filename: `truth-harness-artifact-citation-${safeFilenameTimestamp()}.txt`,
    type: "text/plain",
    button,
    copiedTitle: "Copied artifact citation",
    copiedDetail: "Local artifact path and file hash copied for review or agent handoff.",
    fallbackTitle: "Downloaded artifact citation",
    fallbackDetail: "the artifact citation was saved as a local text file instead."
  });
}

function downloadActivityLog() {
  const payload = {
    schemaVersion: "truth-harness.web-activity-export.v0",
    exportedAt: new Date().toISOString(),
    eventCount: activityEvents.length,
    events: activityEvents
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `truth-harness-activity-${payload.exportedAt.replaceAll(":", "-")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  addActivity("human", "Downloaded activity log", `${payload.eventCount} events saved as JSON.`, "passed");
}

async function copyRunbookPacket() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  const packet = formatRunbookPacket(createRunbookPacket(receipt));
  await copyOrDownloadText({
    text: packet,
    filename: `${receipt.runId}-agent-runbook.md`,
    type: "text/markdown",
    button: copyRunbookButton,
    copiedTitle: "Copied agent runbook",
    copiedDetail: `${receipt.runId} runbook copied for agent handoff.`,
    fallbackTitle: "Downloaded agent runbook",
    fallbackDetail: `${receipt.runId} recursive runbook was saved as Markdown instead.`
  });
}

function downloadRunbookPacket() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  downloadTextFile(`${receipt.runId}-agent-runbook.md`, formatRunbookPacket(createRunbookPacket(receipt)), "text/markdown");
  addActivity("human", "Downloaded agent runbook", `${receipt.runId} recursive runbook saved as Markdown.`, "passed");
}

async function copyRouteLedgerPacket() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt?.verifierRoute) {
    return;
  }

  await copyOrDownloadText({
    text: formatRouteLedgerPacket(receipt),
    filename: `${receipt.verifierRoute.routeId}-route.md`,
    type: "text/markdown",
    button: copyRouteLedgerButton,
    copiedTitle: "Copied verifier route",
    copiedDetail: `${receipt.verifierRoute.routeId} route packet copied.`,
    fallbackTitle: "Downloaded verifier route",
    fallbackDetail: `${receipt.verifierRoute.routeId} route packet was saved as Markdown instead.`
  });
}

function downloadRouteLedgerPacket() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt?.verifierRoute) {
    return;
  }

  downloadTextFile(`${receipt.verifierRoute.routeId}-route.md`, formatRouteLedgerPacket(receipt), "text/markdown");
  addActivity("human", "Downloaded verifier route", `${receipt.verifierRoute.routeId} route packet saved as Markdown.`, "passed");
}

function formatRouteLedgerPacket(receipt) {
  const route = receipt.verifierRoute;
  if (!route) {
    return "";
  }

  const routePaths = receipt.routePaths ?? {};
  const routeReplay = route.replay?.command ?? receipt.replay;
  const gaps = Array.isArray(route.gaps) && route.gaps.length > 0
    ? route.gaps.map((gap) => `- ${routeItemSummary(gap)}`)
    : ["- No route gaps recorded."];
  const obligations = Array.isArray(route.proofObligations) && route.proofObligations.length > 0
    ? route.proofObligations.flatMap((obligation) => [
      `- ${obligation.obligationId}: ${obligation.title} (${obligation.status}) - ${obligation.requiredBefore}`,
      ...routeObligationWorkOrderMarkdown(obligation, receipt),
      ...(obligation.satisfiedAt ? [`  - Satisfied at: ${obligation.satisfiedAt}`] : []),
      ...(obligation.satisfactionSummary ? [`  - Satisfaction: ${obligation.satisfactionSummary}`] : []),
      ...routeObligationEvidenceMarkdown(obligation)
    ])
    : ["- No proof obligations recorded."];
  const warnings = Array.isArray(route.warnings) && route.warnings.length > 0
    ? route.warnings.map((warning) => `- ${routeItemSummary(warning)}`)
    : ["- No route warnings recorded."];
  const capabilities = route.manifestSummary?.usedCapabilities?.length
    ? route.manifestSummary.usedCapabilities.map((capability) => `- ${routeItemSummary(capability)}`)
    : ["- Capability summary not recorded in the UI payload."];

  return `${[
    `# Verifier Route ${route.routeId}`,
    "",
    `Claim: ${receipt.title}`,
    `Trust: ${route.finalTrust ?? receipt.trust}`,
    `Status: ${route.status}`,
    `Evidence kind: ${route.evidenceKind ?? receipt.details["Evidence kind"] ?? "unknown"}`,
    `Receipt run: ${route.receipt?.runId ?? receipt.runId}`,
    `Replay: \`${routeReplay}\``,
    "",
    "## Local Artifacts",
    "",
    `- JSON: ${routePaths.json ?? "not returned by current UI response"}`,
    `- Markdown: ${routePaths.markdown ?? "not returned by current UI response"}`,
    "",
    "## Used Capabilities",
    "",
    ...capabilities,
    "",
    "## Proof Obligations",
    "",
    ...obligations,
    "",
    "## Gaps",
    "",
    ...gaps,
    "",
    "## Warnings",
    "",
    ...warnings,
    "",
    "## Reproducibility Boundary",
    "",
    route.reproducibilityBoundary ?? receipt.limitations.join(" ")
  ].join("\n")}\n`;
}

function routeItemSummary(item) {
  if (typeof item === "string") {
    return item;
  }

  if (!item || typeof item !== "object") {
    return String(item);
  }

  const label = item.displayName ?? item.id ?? item.kind ?? item.title ?? item.command ?? "item";
  const status = item.status ?? item.trust ?? item.finalTrust ?? item.severity;
  const detail = item.summary ?? item.description ?? item.reason ?? item.nextStep ?? item.role;
  return [label, status, detail].filter(Boolean).join(" - ");
}

function showOlderActivity() {
  const filteredEvents = filteredActivityEvents();
  if (state.activityLimit >= filteredEvents.length) {
    return;
  }

  state.activityLimit += ACTIVITY_PAGE_SIZE;
  renderActivityLog();
}

function loadNotes() {
  try {
    return localStorage.getItem(NOTES_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function loadResearcherName() {
  return readStorageValue(RESEARCHER_NAME_STORAGE_KEY) ?? "";
}

function currentResearcherName() {
  const name = researcherNameInput.value.trim();
  return name || "Unsigned researcher";
}

function updateResearcherNameSummary() {
  researcherNameSummary.textContent = currentResearcherName();
}

function saveResearcherName() {
  const name = researcherNameInput.value.trim();
  writeStorageValue(RESEARCHER_NAME_STORAGE_KEY, name);
  updateResearcherNameSummary();
  renderReport(receiptStore.get(state.receiptKey));
}

function initSidebarLayout() {
  const savedCollapsed = readStorageValue(SIDEBAR_COLLAPSED_STORAGE_KEY);
  const shouldAutoCollapse = savedCollapsed === null && window.innerWidth <= 1120;
  const shouldCollapse = savedCollapsed === null ? shouldAutoCollapse : savedCollapsed === "true";

  setSidebarWidth(readStoredSidebarWidth(), { persist: false });
  setSidebarCollapsed(shouldCollapse, { persist: false });
}

function readStorageValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Layout preferences are helpful, not mission-critical evidence.
  }
}

function readStoredSidebarWidth() {
  const storedWidth = Number(readStorageValue(SIDEBAR_WIDTH_STORAGE_KEY));
  if (!Number.isFinite(storedWidth)) {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  return clampSidebarWidth(storedWidth);
}

function clampSidebarWidth(width) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function setSidebarWidth(width, options = {}) {
  const { persist = true } = options;
  const nextWidth = clampSidebarWidth(width);
  appShell.style.setProperty("--sidebar-width", `${nextWidth}px`);
  sidebarResizer.setAttribute("aria-valuenow", String(nextWidth));

  if (persist) {
    writeStorageValue(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
  }

  return nextWidth;
}

function setSidebarCollapsed(collapsed, options = {}) {
  const { persist = true } = options;
  state.sidebarCollapsed = collapsed;
  appShell.classList.toggle("sidebar-collapsed", collapsed);
  sidebarToggle.setAttribute("aria-pressed", String(collapsed));
  sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  sidebarToggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  sidebarRestore.hidden = !collapsed;

  if (persist) {
    writeStorageValue(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  }
}

function beginSidebarResize(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  sidebarResizeActive = true;
  sidebarResizePointerId = event.pointerId;
  sidebarResizeStartX = event.clientX;
  sidebarResizeStartWidth = sidebar.getBoundingClientRect().width || readStoredSidebarWidth();
  setSidebarCollapsed(false);
  appShell.classList.add("sidebar-resizing");
  sidebarResizer.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function updateSidebarResize(event) {
  if (!sidebarResizeActive || event.pointerId !== sidebarResizePointerId) {
    return;
  }

  const delta = event.clientX - sidebarResizeStartX;
  setSidebarWidth(sidebarResizeStartWidth + delta);
}

function endSidebarResize(event) {
  if (!sidebarResizeActive || event.pointerId !== sidebarResizePointerId) {
    return;
  }

  sidebarResizeActive = false;
  sidebarResizePointerId = null;
  appShell.classList.remove("sidebar-resizing");
  sidebarResizer.releasePointerCapture?.(event.pointerId);
}

function handleSidebarResizerKey(event) {
  const currentWidth = sidebar.getBoundingClientRect().width || readStoredSidebarWidth();
  let nextWidth = null;

  if (event.key === "ArrowLeft") {
    nextWidth = currentWidth - 16;
  } else if (event.key === "ArrowRight") {
    nextWidth = currentWidth + 16;
  } else if (event.key === "Home") {
    nextWidth = SIDEBAR_MIN_WIDTH;
  } else if (event.key === "End") {
    nextWidth = SIDEBAR_MAX_WIDTH;
  }

  if (nextWidth === null) {
    return;
  }

  event.preventDefault();
  setSidebarCollapsed(false);
  setSidebarWidth(nextWidth);
}

function saveNotes() {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, researchNotes.value);
    updateNotesStatus(`saved ${formatActivityTime(new Date().toISOString())}`);
  } catch {
    updateNotesStatus("save failed");
  }

  renderReport(receiptStore.get(state.receiptKey));
}

function updateNotesStatus(text) {
  notesStatus.textContent = text;
}

function verificationEnvironmentReportModel() {
  const payload = state.safetyStatus;
  if (!payload) {
    return {
      facts: [["Status", "checking local verification environment"]],
      notes: ["Engine readiness and sandbox status load from local /api/status."],
      commands: []
    };
  }

  if (payload.error) {
    return {
      facts: [["Status", `local status unavailable: ${payload.error}`]],
      notes: ["Do not claim a sandbox, engine, or Docker verifier boundary until /api/status is available."],
      commands: []
    };
  }

  const readiness = payload.verification ?? {};
  const docker = payload.dockerVerifier ?? {};
  const sandbox = payload.safety?.codeRunSandbox ?? {};
  const readyCount = Number.isFinite(readiness.readyCount) ? readiness.readyCount : 0;
  const totalCount = Number.isFinite(readiness.totalCount) ? readiness.totalCount : 0;
  const missingEngines = Array.isArray(docker.missingEngines)
    ? docker.missingEngines
    : Array.isArray(readiness.engines)
      ? readiness.engines
          .filter((engine) => engine.status !== "available")
          .map((engine) => engine.displayName ?? engine.id ?? "Backend")
      : [];
  const commands = Object.entries(docker.commands ?? {})
    .map(([label, command]) => [label, command])
    .filter(([, command]) => command);
  const sandboxState = sandbox.canAttestNetworkNone
    ? `attested ${formatSafetyPhrase(sandbox.provider)} / ${formatSafetyPhrase(sandbox.networkIsolation)}`
    : `not attested: ${sandbox.reason ?? "no measured sandbox provider"}`;

  return {
    facts: [
      ["Local API", payload.localOnly ? "local only" : "check configuration"],
      ["Hosted model calls", payload.externalCalls ? "possible" : "none from local API"],
      ["Engine readiness", `${readyCount}/${totalCount} verification engines ready`],
      ["Missing engines", missingEngines.length > 0 ? missingEngines.join(", ") : "none reported"],
      ["Code-run sandbox", sandboxState],
      ["Docker verifier", docker.status ?? (docker.recommended ? "recommended" : "optional")],
      ["Docker boundary", "web UI exposes copyable commands only; it never runs Docker automatically"]
    ],
    commands,
    notes: [
      ...(Array.isArray(docker.notes) ? docker.notes : []),
      "Environment status is not evidence. Trust labels require concrete replayable artifacts."
    ].slice(0, 6)
  };
}

function verificationEnvironmentRunbookModel() {
  const environment = verificationEnvironmentReportModel();
  return {
    facts: Object.fromEntries(environment.facts),
    commands: Object.fromEntries(environment.commands),
    notes: environment.notes
  };
}

function verificationEnvironmentFactsHtml() {
  const environment = verificationEnvironmentReportModel();
  return environment.facts
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
}

function verificationEnvironmentCommandHtml() {
  const environment = verificationEnvironmentReportModel();
  if (environment.commands.length === 0) {
    return `<li>No verifier command guidance loaded.</li>`;
  }

  return environment.commands
    .map(([label, command]) => `<li><strong>${escapeHtml(label)}</strong>: <code>${escapeHtml(command)}</code></li>`)
    .join("");
}

function verificationEnvironmentNotesHtml() {
  return verificationEnvironmentReportModel().notes
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");
}

function verificationEnvironmentMarkdown() {
  const environment = verificationEnvironmentReportModel();
  return [
    "## Verification Environment",
    "",
    ...environment.facts.map(([label, value]) => `- ${label}: ${value}`),
    "",
    "Verifier commands:",
    "",
    ...(environment.commands.length > 0
      ? environment.commands.map(([label, command]) => `- ${label}: \`${command}\``)
      : ["- none loaded"]),
    "",
    "Environment notes:",
    "",
    ...environment.notes.map((note) => `- ${note}`)
  ];
}

function createTeachingPacket(receipt) {
  const levelLabel = visualLevelLabel(state.level);
  const trace = receipt.traces[state.level] ?? receipt.traces.middle ?? [];
  const tags = receiptTags(receipt);
  const text = `${receipt.title} ${receipt.output} ${receipt.math?.input ?? ""} ${receipt.math?.output ?? ""} ${tags.join(" ")}`.toLowerCase();
  const fractionLike = text.includes("fraction") || text.includes("/") || text.includes("\\frac");
  const proofBacked = receipt.details?.["Proof checker"] === "true" || receipt.trust === "proved";
  const route = receipt.verifierRoute;
  const routeReadinessText = route ? routeReadiness(route).summary : "No saved verifier route is attached to this seed receipt.";

  const learningGoals = [
    `Explain the verified result ${receipt.output} from the receipt trace without skipping evidence steps.`,
    `Identify which engine produced the result (${receipt.engine}) and what trust label was assigned (${receipt.trust}).`,
    "Separate the computed result from stronger claims that would require proof, independent checks, or expert review.",
    ...(fractionLike
      ? ["Use common denominators or equivalent fractions to reason about the result before checking the receipt."]
      : ["Translate the problem into smaller claims that can each be checked or replayed."])
  ];

  const prerequisites = fractionLike
    ? [
      "Fraction notation and numerator/denominator roles.",
      "Equivalent fractions and common denominators.",
      "Adding rational numbers exactly instead of relying on decimal approximations."
    ]
    : [
      "Reading the problem statement as a precise claim.",
      "Following a step-by-step computational trace.",
      "Knowing the difference between a calculation, a proof, a simulation, and a source citation."
    ];

  const classroomPrompts = trace.slice(0, 6).map((step, index) =>
    `Step ${index + 1}: ${step} Ask students which rule or prior fact justifies this step, then compare their answer to the receipt.`
  );

  const misconceptionChecks = [
    ...(fractionLike
      ? [
        "Students may add denominators directly. Ask them to explain why denominator alignment is required.",
        "Students may treat 11/8 as wrong because it is greater than 1. Ask them to place both inputs and the result on the number line."
      ]
      : [
        "Students may accept the final answer because software printed it. Ask them to point to the verifier, replay command, and limitations.",
        "Students may confuse a bounded check or simulation with a general proof. Ask what would be needed for a stronger trust label."
      ]),
    proofBacked
      ? "Even with a proof checker, students should cite the exact proof artifact and accepted backend."
      : "This receipt is not labeled proved. Students should not present it as a formal theorem without an accepted proof-checker artifact."
  ];

  const activity = [
    "Start with a quiet solve: students write their own answer and one sentence of justification.",
    "Reveal the receipt trace one step at a time and have students mark each step as definition, rewrite, computation, or assumption.",
    "Ask students to find the strongest claim the receipt supports and one claim it does not support.",
    "Have students write a new subclaim that could be saved as a reusable receipt for a harder problem."
  ];

  const assessmentRubric = [
    ["Trace fidelity", "Student explanation follows the recorded steps and does not invent unsupported operations."],
    ["Evidence awareness", "Student names the engine, replay command, trust label, and limitations."],
    ["Conceptual transfer", "Student can create or identify a reusable subclaim for a related problem."],
    ["Overclaim prevention", "Student states what extra proof, source, simulation, or review would be needed for a stronger claim."]
  ];

  return {
    title: `Teaching Packet: ${receipt.title}`,
    audience: levelLabel,
    verifiedClaim: `${receipt.title} -> ${receipt.output}`,
    trust: receipt.trust,
    engine: receipt.engine,
    replay: receipt.replay,
    routeReadiness: routeReadinessText,
    learningGoals,
    prerequisites,
    classroomPrompts: classroomPrompts.length > 0 ? classroomPrompts : ["Ask students to restate the claim, identify the verifier, and list what evidence would be needed next."],
    misconceptionChecks,
    activity,
    assessmentRubric,
    boundary: [
      "This packet teaches from a local evidence receipt. It is not a substitute for instructor judgment.",
      "AI explanations, visualizations, and report text do not upgrade trust labels.",
      "Students should cite the receipt, replay command, and limitations when using the result."
    ]
  };
}

function renderTeachingPacketHtml(packet) {
  return `<section class="teaching-packet">
    <div class="teaching-packet-header">
      <span class="mini-label">professor packet</span>
      <h4>${escapeHtml(packet.title)}</h4>
      <p>Audience: ${escapeHtml(packet.audience)}. Verified claim: <code>${escapeHtml(packet.verifiedClaim)}</code></p>
    </div>
    <dl class="report-facts">
      <div><dt>Trust</dt><dd>${escapeHtml(packet.trust)}</dd></div>
      <div><dt>Engine</dt><dd>${escapeHtml(packet.engine)}</dd></div>
      <div><dt>Route</dt><dd>${escapeHtml(packet.routeReadiness)}</dd></div>
      <div><dt>Replay</dt><dd><code>${escapeHtml(packet.replay)}</code></dd></div>
    </dl>
    <div class="teaching-grid">
      <section>
        <h5>Learning Goals</h5>
        <ul>${packet.learningGoals.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      <section>
        <h5>Prerequisites</h5>
        <ul>${packet.prerequisites.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      <section>
        <h5>Misconception Checks</h5>
        <ul>${packet.misconceptionChecks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      <section>
        <h5>Classroom Activity</h5>
        <ol>${packet.activity.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
      </section>
    </div>
    <h5>Step Prompts</h5>
    <ol>${packet.classroomPrompts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    <h5>Assessment Rubric</h5>
    <table class="report-table">
      <thead><tr><th>Criterion</th><th>Evidence of understanding</th></tr></thead>
      <tbody>${packet.assessmentRubric.map(([criterion, evidence]) => `<tr><td>${escapeHtml(criterion)}</td><td>${escapeHtml(evidence)}</td></tr>`).join("")}</tbody>
    </table>
    <h5>Teaching Boundary</h5>
    <ul>${packet.boundary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>`;
}

function teachingPacketMarkdown(packet) {
  return [
    `# ${packet.title}`,
    "",
    `- Audience: ${packet.audience}`,
    `- Verified claim: ${packet.verifiedClaim}`,
    `- Trust: ${packet.trust}`,
    `- Engine: ${packet.engine}`,
    `- Replay: \`${packet.replay}\``,
    `- Route readiness: ${packet.routeReadiness}`,
    "",
    "## Learning Goals",
    "",
    ...packet.learningGoals.map((item) => `- ${item}`),
    "",
    "## Prerequisites",
    "",
    ...packet.prerequisites.map((item) => `- ${item}`),
    "",
    "## Step Prompts",
    "",
    ...packet.classroomPrompts.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Misconception Checks",
    "",
    ...packet.misconceptionChecks.map((item) => `- ${item}`),
    "",
    "## Classroom Activity",
    "",
    ...packet.activity.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Assessment Rubric",
    "",
    "| Criterion | Evidence of understanding |",
    "| --- | --- |",
    ...packet.assessmentRubric.map(([criterion, evidence]) => `| ${criterion} | ${evidence} |`),
    "",
    "## Teaching Boundary",
    "",
    ...packet.boundary.map((item) => `- ${item}`)
  ].join("\n");
}

function renderCredibilityPackPanel() {
  if (!credibilityPackPanel) {
    return;
  }

  const pack = state.credibilityPack;
  const status = pack?.status ?? (state.credibilityPackLoading ? "checking" : "not loaded");
  const statusClass = credibilityPackStatusClass(status);
  const command = credibilityPackReviewerCommand(pack);
  const warningItems = credibilityPackWarnings(pack)
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");
  const actionItems = credibilityPackActionItemsHtml(pack);
  const runNextCard = credibilityRunNextHtml();
  const pathRows = credibilityPackPathRows(state.credibilityPackPaths);
  const benchmarkCard = credibilityBenchmarkCardHtml(pack);
  const bundleCard = credibilityBundleCardHtml();
  const bundleHistory = credibilityBundleVerificationHistoryHtml();
  const reviewerChecklist = credibilityReviewerChecklistHtml(pack);
  const engineEvidenceLadder = credibilityEngineEvidenceLadderHtml(pack);
  const summaryRows = pack
    ? credibilityPackSummaryRows(pack)
      .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${credibilityPackValueHtml(value)}</dd></div>`)
      .join("")
    : [
        ["Reviewer mode", "strict all-engines"],
        ["Privacy", "local-only"],
        ["Network", "none"],
        ["Status", state.credibilityPackError ?? "Refresh to inspect the current workspace."]
      ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");

  credibilityPackPanel.innerHTML = `
    <div class="credibility-pack-head">
      <div>
        <span class="mini-label">workspace reviewer packet</span>
        <h4>Professor Credibility Pack</h4>
        <p>Workspace-level validation, strict engine gates, open review queue, replay commands, and local-only privacy boundaries.</p>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(credibilityPackStatusLabel(status))}</span>
    </div>
    ${bundleCard}
    ${bundleHistory}
    ${reviewerChecklist}
    <dl class="credibility-pack-summary">${summaryRows}</dl>
    ${engineEvidenceLadder}
    <div class="credibility-pack-actions">
      <button class="text-button compact-button refresh-credibility-pack" data-testid="refresh-credibility-pack" type="button" ${state.credibilityPackLoading ? "disabled" : ""}>${state.credibilityPackLoading ? "Refreshing" : "Refresh"}</button>
      <button class="text-button compact-button strong-action write-credibility-pack" data-testid="write-credibility-pack" type="button" ${state.credibilityPackSaving ? "disabled" : ""}>${state.credibilityPackSaving ? "Writing" : "Write reviewer pack"}</button>
      <button class="text-button compact-button copy-credibility-pack-command" data-testid="copy-credibility-pack-command" data-command="${escapeHtml(command)}" type="button">Copy command</button>
    </div>
    <div class="credibility-pack-command">
      <span>Replayable command</span>
      <code>${escapeHtml(command)}</code>
    </div>
    ${benchmarkCard}
    ${runNextCard}
    ${actionItems ? `<div class="credibility-pack-action-plan">
      <div class="credibility-pack-section-head">
        <strong>Reviewer Action Plan</strong>
        <span>${escapeHtml(credibilityPackActionSummary(pack))}</span>
      </div>
      ${actionItems}
    </div>` : ""}
    ${pathRows ? `<dl class="credibility-pack-paths">${pathRows}</dl>` : ""}
    ${warningItems ? `<ul class="credibility-pack-warnings">${warningItems}</ul>` : ""}
  `;

  credibilityPackPanel.querySelector(".refresh-credibility-pack")?.addEventListener("click", () => {
    void refreshCredibilityPack({ announce: true });
  });
  credibilityPackPanel.querySelector(".write-credibility-pack")?.addEventListener("click", (event) => {
    void writeCredibilityPackFromUi(event.currentTarget);
  });
  credibilityPackPanel.querySelector(".copy-credibility-pack-command")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    void copyOrDownloadText({
      button,
      text: `${button.dataset.command ?? command}\n`,
      filename: `truth-harness-credibility-pack-command-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: "Copied credibility command",
      copiedDetail: "Reviewer credibility-pack command copied from the Report tab.",
      fallbackTitle: "Downloaded credibility command",
      fallbackDetail: "the reviewer credibility-pack command was saved as a local text file instead."
    });
  });
  credibilityPackPanel.querySelectorAll(".copy-credibility-benchmark-command").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      const label = target.dataset.benchmarkLabel ?? "benchmark";
      void copyOrDownloadText({
        button: target,
        text: `${target.dataset.command ?? ""}\n`,
        filename: `truth-harness-${label}-${safeFilenameTimestamp()}.txt`,
        type: "text/plain",
        copiedTitle: "Copied benchmark command",
        copiedDetail: `${label} command copied from the credibility pack.`,
        fallbackTitle: "Downloaded benchmark command",
        fallbackDetail: `the ${label} command was saved as a local text file instead.`
      });
    });
  });
  credibilityPackPanel.querySelector(".refresh-credibility-bundle")?.addEventListener("click", () => {
    void refreshCredibilityBundle({ announce: true });
  });
  credibilityPackPanel.querySelector(".verify-credibility-bundle")?.addEventListener("click", (event) => {
    void verifyCredibilityBundleFromUi(event.currentTarget);
  });
  credibilityPackPanel.querySelector(".refresh-credibility-bundle-history")?.addEventListener("click", () => {
    void refreshCredibilityBundleVerificationHistory({ announce: true });
  });
  credibilityPackPanel.querySelector(".copy-credibility-bundle-command")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const commandText = button.dataset.command ?? credibilityBundleCommand();
    void copyOrDownloadText({
      button,
      text: `${commandText}\n`,
      filename: `truth-harness-credibility-bundle-verify-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: "Copied bundle verifier",
      copiedDetail: "Reviewer bundle verification command copied from the Report tab.",
      fallbackTitle: "Downloaded bundle verifier",
      fallbackDetail: "the reviewer bundle verification command was saved as a local text file instead."
    });
  });
  credibilityPackPanel.querySelector(".copy-strict-professor-command")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const commandText = button.dataset.command ?? credibilityStrictProfessorCommand();
    void copyOrDownloadText({
      button,
      text: `${commandText}\n`,
      filename: `truth-harness-strict-professor-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: "Copied strict reviewer route",
      copiedDetail: "Strict all-engine Docker professor command copied from the Report tab.",
      fallbackTitle: "Downloaded strict reviewer route",
      fallbackDetail: "the strict all-engine Docker professor command was saved as a local text file instead."
    });
  });
  credibilityPackPanel.querySelector(".copy-strict-engine-command")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const commandText = button.dataset.command ?? credibilityStrictEngineCommand();
    void copyOrDownloadText({
      button,
      text: `${commandText}\n`,
      filename: `truth-harness-strict-engine-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: "Copied strict engine route",
      copiedDetail: "Strict all-engine evidence writer command copied from the Report tab.",
      fallbackTitle: "Downloaded strict engine route",
      fallbackDetail: "the strict all-engine evidence writer command was saved as a local text file instead."
    });
  });
  credibilityPackPanel.querySelector(".copy-credibility-bundle-path")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const path = button.dataset.path ?? state.credibilityBundle?.paths?.relativeBundle ?? "";
    void copyOrDownloadText({
      button,
      text: `${path}\n`,
      filename: `truth-harness-credibility-bundle-path-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: "Copied bundle path",
      copiedDetail: "Reviewer bundle path copied from the Report tab.",
      fallbackTitle: "Downloaded bundle path",
      fallbackDetail: "the reviewer bundle path was saved as a local text file instead."
    });
  });
  credibilityPackPanel.querySelectorAll(".download-credibility-bundle-file").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      const href = target.dataset.href ?? "";
      const label = target.dataset.label ?? "reviewer bundle file";
      if (!href) {
        return;
      }
      addActivity(
        "local-api",
        "Downloaded reviewer bundle file",
        `${label} requested from the latest local portable reviewer bundle.`,
        "passed"
      );
      window.location.href = href;
    });
  });
  credibilityPackPanel.querySelectorAll(".download-credibility-verification-file").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      const href = target.dataset.href ?? "";
      const label = target.dataset.label ?? "saved verifier artifact";
      if (!href) {
        return;
      }
      addActivity(
        "local-api",
        "Downloaded verification artifact",
        `${label} requested from saved local reviewer verification history.`,
        "passed"
      );
      window.location.href = href;
    });
  });
  credibilityPackPanel.querySelector(".plan-credibility-run-next")?.addEventListener("click", () => {
    void refreshCredibilityRunNext({ announce: true });
  });
  credibilityPackPanel.querySelector(".save-credibility-run-next")?.addEventListener("click", (event) => {
    void saveCredibilityRunNextFromUi(event.currentTarget);
  });
  credibilityPackPanel.querySelector(".copy-credibility-run-next-command")?.addEventListener("click", (event) => {
    const target = event.currentTarget;
    void copyOrDownloadText({
      button: target,
      text: `${target.dataset.command ?? credibilityRunNextCommand()}\n`,
      filename: `truth-harness-credibility-run-next-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: "Copied reviewer next action",
      copiedDetail: "Credibility run-next command copied from the Report tab.",
      fallbackTitle: "Downloaded reviewer next action",
      fallbackDetail: "the credibility run-next command was saved as a local text file instead."
    });
  });
  credibilityPackPanel.querySelectorAll(".copy-credibility-action-command").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      void copyOrDownloadText({
        button: target,
        text: `${target.dataset.command ?? ""}\n`,
        filename: `truth-harness-reviewer-action-${safeFilenameTimestamp()}.txt`,
        type: "text/plain",
        copiedTitle: "Copied reviewer action",
        copiedDetail: target.dataset.title ?? "Reviewer action command copied from the credibility pack.",
        fallbackTitle: "Downloaded reviewer action",
        fallbackDetail: "the reviewer action command was saved as a local text file instead."
      });
    });
  });
}

function credibilityBundleCardHtml() {
  const payload = state.credibilityBundle;
  const manifest = payload?.manifest;
  const verification = payload?.verification;
  const archive = state.credibilityArchive;
  const hasBundle = payload?.latest && manifest;
  const strictAllEngine = credibilityBundleIsStrictAllEngine(manifest);
  const verifying = state.credibilityBundleVerifying;
  const bundleError = state.credibilityBundleError ?? state.credibilityBundleVerifyError;
  const verificationStatus = credibilityBundleVerificationStatus(verification, manifest);
  const status = bundleError
    ? "error"
    : state.credibilityBundleLoading || verifying
      ? "checking"
      : hasBundle
        ? !strictAllEngine
          ? "standard"
          : verificationStatus.statusText === "clean"
          ? "verified"
          : verificationStatus.statusText === "metadata unchecked"
            ? "unchecked"
            : verificationStatus.statusText === "source drift"
              ? "drift"
              : "error"
        : "missing";
  const statusClass = status === "verified" ? "exact" : status === "drift" || status === "unchecked" ? "waiting" : status === "error" ? "refuted" : "waiting";
  const statusLabel = state.credibilityBundleLoading
    ? "checking"
    : verifying
      ? "verifying"
    : status === "verified"
      ? "strict verified"
      : status === "unchecked"
        ? "metadata unchecked"
      : status === "standard"
        ? "standard bundle"
      : status === "drift"
        ? "bundle drift"
        : status === "error"
          ? "unavailable"
          : "no bundle";
  const detail = bundleError
    ? bundleError
    : hasBundle
      ? strictAllEngine
        ? verificationStatus.statusText === "clean"
          ? "Latest portable reviewer bundle includes strict all-engine evidence. Copied file hashes, manifest metadata, and live source drift are all checked separately."
          : `${credibilityBundleDigestDetail(verification, manifest)} Copied file hashes and live source drift are shown separately below.`
        : "A portable reviewer bundle exists, but it is not the strict all-engine professor packet. Regenerate with the strict Docker route before serious outside review."
      : "Run the strict Docker professor route to create a portable reviewer bundle after engine and benchmark gates pass.";
  const command = credibilityBundleCommand();
  const strictProfessorCommand = credibilityStrictProfessorCommand(manifest);
  const strictEngineCommand = credibilityStrictEngineCommand(manifest);
  const path = payload?.paths?.relativeBundle ?? payload?.bundleRef ?? "";
  const facts = hasBundle
    ? [
        ["Reviewer standard", credibilityBundleReviewerStandard(manifest)],
        ["Required engines", strictAllEngine ? "Maxima, Z3, cvc5, Lean, SageMath" : "not all strict engines"],
        ["Bundle", manifest.bundleId],
        ["Pack", manifest.packId],
        ["Pack status", manifest.packStatus],
        ["Engine gates", credibilityPackEngineEvidenceSummaryFromSummary(manifest.packSummary)],
        ["Copied files", credibilityBundleCopiedFilesLabel(verification)],
        ["Manifest digest", credibilityBundleDigestLabel(verification, manifest)],
        ["Source workspace", verification?.sourceMatchesWorkspace ? "matches bundle" : "drifted"],
        ["Files", `${verification?.checkedBundleFiles ?? manifest.summary?.totalFiles ?? 0} checked`],
        ["Last web verify", state.credibilityBundleVerifiedAt ? formatActivityTime(state.credibilityBundleVerifiedAt) : "not clicked"],
        ["Verification artifact", payload?.verificationPaths?.json ? "saved to findings" : "not saved yet"],
        ["Archive SHA-256", archive?.sha256 ?? (state.credibilityArchiveLoading ? "calculating" : state.credibilityArchiveError ?? "not loaded")]
      ]
    : [
        ["Expected route", "npm run docker:professor:all"],
        ["Required engines", "Maxima, Z3, cvc5, Lean, SageMath"],
        ["Network", "no-network compose service"],
        ["Status", state.credibilityBundleLoading ? "checking local findings" : "not exported yet"]
      ];

  return `<section class="credibility-bundle-card bundle-${escapeHtml(status)}" aria-label="Portable reviewer bundle">
    <div class="credibility-bundle-head">
      <div>
        <span class="mini-label">${strictAllEngine ? "strict portable handoff" : "portable handoff"}</span>
        <strong>${strictAllEngine ? "Strict All-Engine Reviewer Bundle" : "Verified Reviewer Bundle"}</strong>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(statusLabel)}</span>
    </div>
    <p>${escapeHtml(detail)}</p>
    <dl class="credibility-bundle-facts">
      ${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${credibilityBundleValueHtml(value)}</dd></div>`).join("")}
    </dl>
    ${path ? `<small>Bundle path: <code>${escapeHtml(path)}</code></small>` : ""}
    ${payload?.verificationPaths?.json ? `<small>Verification artifact: <code>${escapeHtml(payload.verificationPaths.json)}</code></small>` : ""}
    <div class="credibility-bundle-command">
      <code>${escapeHtml(command)}</code>
      <div class="credibility-bundle-actions">
        <button class="text-button compact-button refresh-credibility-bundle" data-testid="refresh-credibility-bundle" type="button" ${state.credibilityBundleLoading ? "disabled" : ""}>${state.credibilityBundleLoading ? "Refreshing" : "Refresh bundle"}</button>
        <button class="text-button compact-button strong-action verify-credibility-bundle" data-testid="verify-credibility-bundle" type="button" ${hasBundle && !verifying ? "" : "disabled"}>${verifying ? "Verifying" : "Verify now"}</button>
        <button class="text-button compact-button copy-credibility-bundle-command" data-testid="copy-credibility-bundle-command" data-command="${escapeHtml(command)}" type="button">Copy verify</button>
        <button class="text-button compact-button strong-action copy-strict-professor-command" data-testid="copy-strict-professor-command" data-command="${escapeHtml(strictProfessorCommand)}" type="button">Copy strict packet</button>
        <button class="text-button compact-button copy-strict-engine-command" data-testid="copy-strict-engine-command" data-command="${escapeHtml(strictEngineCommand)}" type="button">Copy engine run</button>
        <button class="text-button compact-button copy-credibility-bundle-path" data-testid="copy-credibility-bundle-path" data-path="${escapeHtml(path)}" type="button" ${path ? "" : "disabled"}>Copy path</button>
        <button class="text-button compact-button download-credibility-bundle-file" data-testid="download-credibility-bundle-readme" data-label="Bundle README" data-href="/api/credibility-bundle/latest/file?kind=readme" type="button" ${hasBundle ? "" : "disabled"}>README</button>
        <button class="text-button compact-button download-credibility-bundle-file" data-testid="download-credibility-bundle-manifest" data-label="Bundle manifest" data-href="/api/credibility-bundle/latest/file?kind=manifest" type="button" ${hasBundle ? "" : "disabled"}>Manifest</button>
        <button class="text-button compact-button download-credibility-bundle-file" data-testid="download-credibility-bundle-pack" data-label="Credibility pack markdown" data-href="/api/credibility-bundle/latest/file?kind=pack-md" type="button" ${hasBundle ? "" : "disabled"}>Pack MD</button>
        <button class="text-button compact-button strong-action download-credibility-bundle-file" data-testid="download-credibility-bundle-archive" data-label="Reviewer bundle archive" data-href="/api/credibility-bundle/latest/archive" type="button" ${hasBundle ? "" : "disabled"}>Archive</button>
        <button class="text-button compact-button download-credibility-bundle-file" data-testid="download-credibility-bundle-sha256" data-label="Reviewer bundle SHA-256 sidecar" data-href="/api/credibility-bundle/latest/archive.sha256" type="button" ${hasBundle && archive?.sha256 ? "" : "disabled"}>SHA256</button>
      </div>
    </div>
  </section>`;
}

function credibilityBundleVerificationHistoryHtml() {
  const items = Array.isArray(state.credibilityBundleVerifications) ? state.credibilityBundleVerifications : [];
  const statusLabel = state.credibilityBundleVerificationsLoading
    ? "loading"
    : state.credibilityBundleVerificationsError
      ? "unavailable"
      : `${items.length} saved`;
  const statusClass = state.credibilityBundleVerificationsError ? "refuted" : items.length > 0 ? "exact" : "waiting";
  const body = state.credibilityBundleVerificationsError
    ? `<p>${escapeHtml(state.credibilityBundleVerificationsError)}</p>`
    : items.length > 0
      ? `<div class="credibility-verification-history-list">
          ${items.map((item) => credibilityBundleVerificationHistoryItemHtml(item)).join("")}
        </div>`
      : `<p>No saved bundle verification artifacts yet. Click Verify now on the reviewer bundle to create a citeable local check.</p>`;

  return `<section class="credibility-verification-history" aria-label="Saved bundle verification history">
    <div class="credibility-bundle-head">
      <div>
        <span class="mini-label">saved local checks</span>
        <strong>Bundle Verification History</strong>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(statusLabel)}</span>
    </div>
    ${body}
    <div class="credibility-bundle-actions">
      <button class="text-button compact-button refresh-credibility-bundle-history" data-testid="refresh-credibility-bundle-history" type="button" ${state.credibilityBundleVerificationsLoading ? "disabled" : ""}>${state.credibilityBundleVerificationsLoading ? "Refreshing" : "Refresh history"}</button>
    </div>
  </section>`;
}

function credibilityBundleVerificationHistoryItemHtml(item) {
  const verification = item?.verification ?? {};
  const verificationId = typeof verification.verificationId === "string" ? verification.verificationId : "";
  const status = credibilityBundleVerificationStatus(verification);
  const jsonHref = verificationId ? `/api/credibility-bundle/verifications/file?id=${encodeURIComponent(verificationId)}&kind=json` : "";
  const markdownHref = verificationId ? `/api/credibility-bundle/verifications/file?id=${encodeURIComponent(verificationId)}&kind=markdown` : "";
  const facts = [
    ["Bundle", verification.bundleId ?? "unknown"],
    ["Checked", `${verification.checkedBundleFiles ?? 0} bundle, ${verification.checkedSourceFiles ?? 0} source`],
    ["Manifest digest", credibilityBundleDigestLabel(verification)],
    ["Verified", verification.verifiedAt ? formatActivityTime(verification.verifiedAt) : "unknown"],
    ["Artifact", item?.paths?.relativeJson ?? item?.paths?.json ?? "unknown"]
  ];

  return `<article class="credibility-verification-history-item">
    <div class="credibility-verification-history-row">
      <strong>${credibilityBundleValueHtml(verification.verificationId ?? "unidentified verification")}</strong>
      <span class="status-pill ${status.statusClass}">${escapeHtml(status.statusText)}</span>
    </div>
    <dl>
      ${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${credibilityBundleValueHtml(value)}</dd></div>`).join("")}
    </dl>
    <div class="credibility-verification-history-actions">
      <button class="text-button compact-button download-credibility-verification-file" data-testid="download-credibility-verification-json" data-label="Verification JSON" data-href="${escapeHtml(jsonHref)}" type="button" ${jsonHref ? "" : "disabled"}>JSON</button>
      <button class="text-button compact-button download-credibility-verification-file" data-testid="download-credibility-verification-markdown" data-label="Verification Markdown" data-href="${escapeHtml(markdownHref)}" type="button" ${markdownHref ? "" : "disabled"}>Markdown</button>
    </div>
  </article>`;
}

function credibilityReviewerChecklistHtml(pack) {
  const payload = state.credibilityBundle;
  const manifest = payload?.manifest;
  const verification = payload?.verification;
  const summary = manifest?.packSummary ?? pack?.summary ?? {};
  const actionPlan = pack?.reviewerActionPlan;
  const hasBundle = Boolean(payload?.latest && manifest);
  const strictAllEngine = credibilityBundleIsStrictAllEngine(manifest);
  const checklist = [
    {
      label: "Strict all-engine bundle exported",
      passed: hasBundle && strictAllEngine,
      detail: hasBundle
        ? strictAllEngine
          ? `${manifest.bundleId} includes Maxima, Z3, cvc5, Lean, and SageMath in one portable packet.`
          : `${manifest.bundleId} exists but is not the strict all-engine professor packet.`
        : "No reviewer bundle is present yet.",
      command: credibilityStrictProfessorCommand(manifest)
    },
    {
      label: "Copied file hashes",
      passed: credibilityBundleCopiedFilesClean(verification),
      detail: credibilityBundleCopiedFilesClean(verification)
        ? `${verification.checkedBundleFiles ?? 0} bundled files match the manifest${state.credibilityBundleVerifiedAt ? `; web verified ${formatActivityTime(state.credibilityBundleVerifiedAt)}` : ""}.`
        : "Click Verify now or run the verify command before handoff.",
      command: credibilityBundleCommand()
    },
    {
      label: "Manifest metadata digest",
      passed: credibilityBundleDigestStatus(verification, manifest) === "verified",
      detail: credibilityBundleDigestDetail(verification, manifest),
      command: credibilityBundleCommand()
    },
    {
      label: "Source workspace still matches",
      passed: Boolean(verification?.sourceMatchesWorkspace),
      detail: verification?.sourceMatchesWorkspace ? `${verification.checkedSourceFiles ?? 0} source files still match the exported bundle.` : "The source workspace changed after export or has not been verified yet.",
      command: credibilityBundleCommand()
    },
    {
      label: "Workspace schema validation",
      passed: summary.validationPassed === true && Number(summary.validationErrors ?? 0) === 0,
      detail: `${summary.checkedFiles ?? "0"} files checked, ${summary.validationErrors ?? "0"} errors, ${summary.validationWarnings ?? "0"} warnings.`,
      command: manifest?.reviewerCommands?.validateWorkspace ?? pack?.reviewerCommands?.validateWorkspace
    },
    {
      label: "Required engine gates",
      passed: credibilityPackEngineGatePassed(summary.requiredEngineGates, summary),
      detail: credibilityPackEngineGateDetail(summary, "required"),
      command: manifest?.reviewerCommands?.verifyEngines ?? pack?.reviewerCommands?.verifyEngines
    },
    {
      label: "Concrete engine breadth",
      passed: credibilityPackEngineGatePassed(summary.concreteEngineGates, summary),
      detail: credibilityPackEngineGateDetail(summary, "concrete"),
      command: manifest?.reviewerCommands?.verifyEngines ?? pack?.reviewerCommands?.verifyEngines
    },
    {
      label: "Adversarial AI-failure benchmark",
      passed: summary.latestAdversarialBenchmarkStatus === "passed",
      detail: `Latest saved adversarial benchmark status: ${summary.latestAdversarialBenchmarkStatus ?? "missing"}.`,
      command: manifest?.reviewerCommands?.runAdversarialBenchmark ?? pack?.reviewerCommands?.runAdversarialBenchmark
    },
    {
      label: "Math credibility ladder",
      passed: summary.latestMathCredibilityLadderStatus === "passed",
      detail: `Latest saved hard-math readiness ladder status: ${summary.latestMathCredibilityLadderStatus ?? "missing"}.`,
      command: manifest?.reviewerCommands?.runMathCredibilityLadder ?? pack?.reviewerCommands?.runMathCredibilityLadder
    },
    {
      label: "Critical review queue closed",
      passed: Number(summary.criticalReviewItems ?? actionPlan?.criticalActions ?? 1) === 0,
      detail: `${summary.reviewItems ?? actionPlan?.totalActions ?? "unknown"} open review item(s), ${summary.criticalReviewItems ?? actionPlan?.criticalActions ?? "unknown"} critical.`,
      command: manifest?.reviewerCommands?.reviewWorkspace ?? pack?.reviewerCommands?.reviewWorkspace
    },
    {
      label: "Local-only privacy boundary",
      passed: (manifest?.localOnly ?? pack?.localOnly) === true && (manifest?.networkAccess ?? pack?.networkAccess) === "none",
      detail: "The reviewer packet records local-only execution and no network access for the bundle workflow.",
      command: undefined
    }
  ];
  const passed = checklist.filter((item) => item.passed).length;
  const total = checklist.length;
  const statusClass = passed === total ? "exact" : checklist.some((item) => !item.passed && item.label.includes("Critical")) ? "refuted" : "waiting";
  const statusText = passed === total ? "ready" : `${passed}/${total} gates`;

  return `<section class="credibility-review-checklist" aria-label="External reviewer checklist">
    <div class="credibility-checklist-head">
      <div>
        <span class="mini-label">external review readiness</span>
        <strong>Professor Review Checklist</strong>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(statusText)}</span>
    </div>
    <p>Each row is derived from local pack or bundle evidence. Passing this checklist means ready for outside inspection, not that every claim is true.</p>
    <div class="credibility-checklist-grid">
      ${checklist.map((item) => credibilityChecklistItemHtml(item)).join("")}
    </div>
  </section>`;
}

function credibilityChecklistItemHtml(item) {
  const className = item.passed ? "passed" : "blocked";
  return `<div class="credibility-checklist-item checklist-${className}">
    <span>${item.passed ? "passed" : "blocked"}</span>
    <strong>${escapeHtml(item.label)}</strong>
    <p>${escapeHtml(item.detail)}</p>
    ${item.command ? `<code>${escapeHtml(item.command)}</code>` : ""}
  </div>`;
}

function gateStringIsComplete(value) {
  if (typeof value !== "string") {
    return false;
  }
  const match = value.match(/^(\d+)\/(\d+)$/u);
  if (!match) {
    return false;
  }
  const passed = Number(match[1]);
  const total = Number(match[2]);
  return total > 0 && passed === total;
}

function credibilityPackEngineGatePassed(value, summary = {}) {
  return gateStringIsComplete(value) || Boolean(credibilityPackSavedEngineCoverageLabel(summary));
}

function credibilityPackEngineGateDetail(summary = {}, kind) {
  const savedCoverage = credibilityPackSavedEngineCoverageLabel(summary);
  if (savedCoverage) {
    return `${savedCoverage}; current web container probe is informational: status ${summary.engineStatus ?? "unknown"} (${summary.concreteEngineGates ?? "0/0"} concrete, ${summary.requiredEngineGates ?? "0/0"} required).`;
  }
  if (kind === "required") {
    return `${summary.requiredEngineGates ?? "0/0"} required reviewer gates are satisfied.`;
  }
  return `${summary.concreteEngineGates ?? "0/0"} concrete Maxima/Z3/cvc5/Lean/Sage fixture gates are satisfied.`;
}

function credibilityBundleCommand() {
  return state.credibilityBundle?.command ??
    state.credibilityBundle?.manifest?.reviewerCommands?.verifyBundle ??
    "npm run docker:professor:all";
}

function credibilityBundleIsStrictAllEngine(manifest) {
  if (!manifest) {
    return false;
  }
  const commands = manifest.reviewerCommands ?? {};
  const summary = manifest.packSummary ?? {};
  return Boolean(
    commands.verifyEngines?.includes("--require-all-engines") ||
    commands.reproducePack?.includes("--require-all-engines") ||
    commands.dockerStrictProfessorEvidence ||
    (summary.requiredEngineGates === "5/5" && summary.concreteEngineGates === "5/5")
  );
}

function credibilityBundleReviewerStandard(manifest) {
  return credibilityBundleIsStrictAllEngine(manifest)
    ? "strict all-engine professor packet"
    : "standard reviewer packet";
}

function credibilityBundleDigestStatus(verification, manifest) {
  const status = verification?.manifestDigestStatus;
  if (status === "verified" || status === "mismatch" || status === "not-recorded") {
    return status;
  }
  return manifest?.bundleDigest?.value ? "recorded" : "not-recorded";
}

function credibilityBundleDigestLabel(verification, manifest) {
  const status = credibilityBundleDigestStatus(verification, manifest);
  if (status === "verified") {
    return "verified";
  }
  if (status === "mismatch") {
    return "mismatch";
  }
  if (status === "recorded") {
    return "recorded; verify now";
  }
  return "not recorded";
}

function credibilityBundleDigestDetail(verification, manifest) {
  const status = credibilityBundleDigestStatus(verification, manifest);
  if (status === "verified") {
    return "Reviewer commands, limitations, summary, provenance, and file lists still match the export-time manifest digest.";
  }
  if (status === "mismatch") {
    return "The manifest metadata changed after export. Treat reviewer commands, limitations, summary, and provenance as edited until investigated.";
  }
  if (status === "recorded") {
    return "A manifest digest is recorded, but this browser view has not run bundle verification yet.";
  }
  return "This older bundle predates manifest digests. Copied file hashes can still be checked, but reviewer metadata has no digest self-check.";
}

function credibilityBundleCopiedFilesClean(verification) {
  return Boolean(
    verification &&
    Array.isArray(verification.missingBundleFiles) &&
    Array.isArray(verification.changedBundleFiles) &&
    verification.missingBundleFiles.length === 0 &&
    verification.changedBundleFiles.length === 0
  );
}

function credibilityBundleCopiedFilesLabel(verification) {
  if (!verification) {
    return "not verified";
  }
  return credibilityBundleCopiedFilesClean(verification) ? "passed" : "changed";
}

function credibilityBundleVerificationStatus(verification, manifest) {
  const digestStatus = credibilityBundleDigestStatus(verification, manifest);
  const copiedFilesClean = credibilityBundleCopiedFilesClean(verification);
  if (!copiedFilesClean) {
    return {
      statusText: "bundle changed",
      statusClass: "refuted"
    };
  }
  if (digestStatus === "mismatch") {
    return {
      statusText: "metadata changed",
      statusClass: "refuted"
    };
  }
  if (verification?.sourceMatchesWorkspace !== true) {
    return {
      statusText: "source drift",
      statusClass: "waiting"
    };
  }
  if (digestStatus !== "verified") {
    return {
      statusText: "metadata unchecked",
      statusClass: "waiting"
    };
  }
  return {
    statusText: "clean",
    statusClass: "exact"
  };
}

function credibilityStrictProfessorCommand(manifest = state.credibilityBundle?.manifest) {
  return manifest?.reviewerCommands?.dockerStrictProfessorEvidence ?? "npm run docker:professor:all";
}

function credibilityStrictEngineCommand(manifest = state.credibilityBundle?.manifest) {
  return manifest?.reviewerCommands?.dockerAllEngines ?? "npm run docker:all-engines:write";
}

function credibilityBundleValueHtml(value) {
  const text = String(value ?? "");
  if (/^(cbun|cred)_[a-f0-9]+$/u.test(text)) {
    return `<code>${escapeHtml(text)}</code>`;
  }
  if (/^[a-f0-9]{64}$/u.test(text)) {
    return `<code>${escapeHtml(text)}</code>`;
  }
  return escapeHtml(text);
}

function credibilityBundleTrust(payload) {
  if (!payload?.latest) {
    return "waiting";
  }
  return payload.verification?.passed &&
    payload.verification?.sourceMatchesWorkspace &&
    credibilityBundleDigestStatus(payload.verification, payload.manifest) === "verified"
    ? "passed"
    : "waiting";
}

function credibilityBundleActivitySummary(payload) {
  if (!payload?.latest) {
    return "No portable reviewer bundle is present yet; run npm run docker:professor:all after evidence gates pass.";
  }

  const manifest = payload.manifest ?? {};
  const verification = payload.verification ?? {};
  const standard = credibilityBundleReviewerStandard(manifest);
  return `${manifest.bundleId ?? "bundle"} for ${manifest.packId ?? "pack"} (${standard}); copied files ${credibilityBundleCopiedFilesLabel(verification)}, manifest digest ${credibilityBundleDigestLabel(verification, manifest)}, source ${verification.sourceMatchesWorkspace ? "matches" : "drifted"}.`;
}

function credibilityBenchmarkCardHtml(pack) {
  const summary = pack?.summary ?? {};
  const latestRun = pack?.benchmarkLedger?.latestAdversarialRun;
  const ladderRun = pack?.benchmarkLedger?.latestMathCredibilityLadderRun;
  const receiptReplay = latestRun?.receiptReplays?.[0];
  const ladderReceiptReplay = ladderRun?.receiptReplays?.[0];
  const status = summary.latestAdversarialBenchmarkStatus ?? "missing";
  const ladderStatus = summary.latestMathCredibilityLadderStatus ?? "missing";
  const command = latestRun?.replayCommand ?? credibilityBenchmarkCommand(pack);
  const ladderCommand = ladderRun?.replayCommand ?? credibilityMathLadderCommand(pack);
  const statusClass = status === "passed" ? "exact" : status === "failed" ? "refuted" : "waiting";
  const ladderStatusClass = ladderStatus === "passed" ? "exact" : ladderStatus === "failed" ? "refuted" : "waiting";
  const label = status === "passed" ? "passing" : status === "failed" ? "regression" : "required";
  const ladderLabel = ladderStatus === "passed" ? "passing" : ladderStatus === "failed" ? "regression" : "required";
  const detail = status === "passed"
    ? "The saved adversarial suite is passing and can be replayed by a reviewer."
    : status === "failed"
      ? "The latest adversarial suite has failures; fix or triage before professor review."
      : "Run and save the adversarial suite before asking a professor to trust this workspace.";
  const ladderDetail = ladderStatus === "passed"
    ? "The saved hard-math ladder is passing and can be replayed by a reviewer."
    : ladderStatus === "failed"
      ? "The latest hard-math ladder has failures; fix or triage before professor review."
      : "Run and save the hard-math ladder before claiming the math lane is professor-ready.";
  const facts = [
    ["Status", status],
    ["Trust accuracy", formatPercent(summary.latestAdversarialBenchmarkAccuracy)],
    ["Saved runs", String(summary.savedBenchmarkRuns ?? 0)],
    ["Latest run", latestRun?.artifactId ?? "none"],
    ["Failed cases", String(latestRun?.failed ?? 0)]
  ];
  const ladderFacts = [
    ["Status", ladderStatus],
    ["Trust accuracy", formatPercent(summary.latestMathCredibilityLadderAccuracy)],
    ["Saved runs", String(summary.savedBenchmarkRuns ?? 0)],
    ["Latest run", ladderRun?.artifactId ?? "none"],
    ["Failed cases", String(ladderRun?.failed ?? 0)]
  ];

  return `<section class="credibility-benchmark-card benchmark-${escapeHtml(status)}">
    <div class="credibility-benchmark-head">
      <div>
        <span class="mini-label">professor credibility gate</span>
        <strong>Adversarial AI-Failure Benchmark</strong>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(label)}</span>
    </div>
    <p>${escapeHtml(detail)}</p>
    <dl class="credibility-benchmark-facts">
      ${facts.map(([labelText, value]) => `<div><dt>${escapeHtml(labelText)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>
    ${latestRun?.path ? `<small>Artifact: <code>${escapeHtml(latestRun.path)}</code></small>` : ""}
    ${receiptReplay ? `<small>Receipt replay: <code>${escapeHtml(receiptReplay)}</code></small>` : ""}
    <div class="credibility-benchmark-command">
      <code>${escapeHtml(command)}</code>
      <button class="text-button compact-button copy-credibility-benchmark-command" data-testid="copy-credibility-benchmark-command" data-benchmark-label="adversarial-benchmark" data-command="${escapeHtml(command)}" type="button">Copy benchmark</button>
    </div>
  </section>
  <section class="credibility-benchmark-card benchmark-${escapeHtml(ladderStatus)}">
    <div class="credibility-benchmark-head">
      <div>
        <span class="mini-label">native-safe hard-math floor</span>
        <strong>Math Credibility Ladder</strong>
      </div>
      <span class="status-pill ${ladderStatusClass}">${escapeHtml(ladderLabel)}</span>
    </div>
    <p>${escapeHtml(ladderDetail)}</p>
    <dl class="credibility-benchmark-facts">
      ${ladderFacts.map(([labelText, value]) => `<div><dt>${escapeHtml(labelText)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>
    ${ladderRun?.path ? `<small>Artifact: <code>${escapeHtml(ladderRun.path)}</code></small>` : ""}
    ${ladderReceiptReplay ? `<small>Receipt replay: <code>${escapeHtml(ladderReceiptReplay)}</code></small>` : ""}
    <div class="credibility-benchmark-command">
      <code>${escapeHtml(ladderCommand)}</code>
      <button class="text-button compact-button copy-credibility-benchmark-command" data-benchmark-label="math-credibility-ladder" data-command="${escapeHtml(ladderCommand)}" type="button">Copy ladder</button>
    </div>
  </section>`;
}

function credibilityBenchmarkCommand(pack) {
  return pack?.reviewerCommands?.runAdversarialBenchmark ??
    "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures";
}

function credibilityMathLadderCommand(pack) {
  return pack?.reviewerCommands?.runMathCredibilityLadder ??
    "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures";
}

function credibilityRunNextHtml() {
  const plan = state.credibilityRunNextPlan;
  const command = credibilityRunNextCommand();
  const status = state.credibilityRunNextError
    ? "blocked"
    : state.credibilityRunNextLoading
      ? "planned"
      : plan?.status ?? "planned";
  const title = state.credibilityRunNextError
    ? "Credibility next-action planner unavailable."
    : plan?.item?.title ?? "Plan the next reviewer action.";
  const summary = state.credibilityRunNextError
    ? state.credibilityRunNextError
    : plan?.execution?.summary ?? "Dry-run planner turns the reviewer action queue into one copyable CLI/MCP step without executing in the browser.";
  const source = plan?.item?.kind === "credibility-action" ? "credibility-actions" : "report queue";
  const statusLabel = state.credibilityRunNextLoading ? "planning" : workspaceRunNextStatusLabel(status);
  const copyDisabled = !plan?.item?.command && state.credibilityRunNextLoading ? "disabled" : "";
  const saveDisabled = state.credibilityRunNextLoading || state.credibilityRunNextSaving ? "disabled" : "";
  const pathRows = credibilityRunNextPathRows(state.credibilityRunNextPaths);

  return `<section class="credibility-run-next-card" aria-label="Credibility run-next dry run">
    <div class="credibility-run-next-main">
      <div class="credibility-pack-section-head">
        <strong>Next Safe Reviewer Action</strong>
        <span class="status-pill ${workspaceRunNextTrust(status)}">${escapeHtml(statusLabel)} dry run</span>
      </div>
      <span class="mini-label">${escapeHtml(source)} / browser-safe plan</span>
      <h5>${escapeHtml(title)}</h5>
      <p>${escapeHtml(summary)}</p>
      <code>${escapeHtml(command)}</code>
      ${pathRows ? `<dl class="credibility-run-next-paths">${pathRows}</dl>` : ""}
    </div>
    <div class="credibility-run-next-actions">
      <button class="text-button compact-button plan-credibility-run-next" data-testid="plan-credibility-run-next" type="button" ${state.credibilityRunNextLoading ? "disabled" : ""}>${state.credibilityRunNextLoading ? "Planning" : "Plan next action"}</button>
      <button class="text-button compact-button strong-action save-credibility-run-next" data-testid="save-credibility-run-next" type="button" ${saveDisabled}>${state.credibilityRunNextSaving ? "Saving" : "Save plan"}</button>
      <button class="text-button compact-button copy-credibility-run-next-command" data-testid="copy-credibility-run-next-command" data-command="${escapeHtml(command)}" type="button" ${copyDisabled}>Copy command</button>
    </div>
  </section>`;
}

function credibilityRunNextCommand() {
  return state.credibilityRunNextPlan?.item?.command ??
    state.credibilityRunNextPlan?.execution?.command ??
    "truth-harness workspace run-next . --source credibility-actions --json --require-all-engines";
}

function credibilityRunNextPathRows(paths) {
  if (!paths?.json && !paths?.markdown) {
    return "";
  }

  return [
    ["Saved JSON", paths.json],
    ["Saved Markdown", paths.markdown]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(value)}</code></dd></div>`)
    .join("");
}

function credibilityEngineEvidenceLadderHtml(pack) {
  const rows = Array.isArray(pack?.engineEvidenceLadder)
    ? pack.engineEvidenceLadder
    : credibilityEngineEvidenceLadderFromCases(pack?.engineEvidence?.cases);
  const savedLedgerCard = credibilityEngineSavedLedgerHtml(pack);
  if (rows.length === 0 && !savedLedgerCard) {
    return "";
  }

  const cards = rows.slice(0, 6).map((entry) => {
    const statusClass = credibilityEngineLadderStatusClass(entry);
    const gate = entry.gate === "required" ? "required gate" : "optional gate";
    return `<article class="credibility-engine-ladder-card ${statusClass}">
      <div>
        <span class="mini-label">${escapeHtml(gate)} / ${escapeHtml(entry.evidenceTier ?? "unknown evidence")}</span>
        <strong>${escapeHtml(entry.displayName ?? entry.caseId ?? "Engine gate")}</strong>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(entry.status ?? "unknown")}</span>
      <dl>
        <div><dt>Trust</dt><dd>${escapeHtml(entry.trust ?? "unverified")}</dd></div>
        <div><dt>Replay</dt><dd><code>${escapeHtml(entry.replayCommand ?? "truth-harness engines verify --write")}</code></dd></div>
      </dl>
      <p>${escapeHtml(entry.reviewerMeaning ?? "No reviewer meaning recorded for this engine gate.")}</p>
    </article>`;
  }).join("");

  return `<section class="credibility-engine-ladder" aria-label="Engine evidence ladder">
    <div class="credibility-pack-section-head">
      <strong>Engine Evidence Ladder</strong>
      <span>${rows.length} gate${rows.length === 1 ? "" : "s"} / saved ladder evidence is cited separately</span>
    </div>
    ${savedLedgerCard}
    <div class="credibility-engine-ladder-grid">${cards}</div>
  </section>`;
}

function credibilityEngineSavedLedgerHtml(pack) {
  const summary = pack?.summary ?? {};
  const run = pack?.engineRunLedger?.strongestSavedLevelRun
    ?? pack?.engineRunLedger?.latestStrictReviewerRun
    ?? pack?.engineRunLedger?.latestProfessorReviewerRun;
  const inferred = savedEngineLadderFromRun(run);
  const level = summary.savedEngineLadderLevel ?? run?.strongestLevelId ?? inferred.level;
  if (!level && !run) {
    return "";
  }

  const statusClass = level === "engine-level-5-strict-all-engines" ? "exact" : run?.status === "passed" ? "waiting" : "refuted";
  const title = summary.savedEngineLadderLevelTitle ?? run?.strongestLevelTitle ?? inferred.title ?? "Saved engine evidence";
  const path = run?.path ?? "no saved engine run artifact";
  const runId = summary.savedEngineLadderLevelRunId ?? run?.runId ?? "not recorded";
  return `<article class="credibility-engine-saved-level ${statusClass}" data-testid="credibility-saved-engine-level">
    <div>
      <span class="mini-label">saved Docker engine ladder</span>
      <strong>${escapeHtml(level ?? "No saved engine ladder level")}</strong>
      <p>${escapeHtml(title)}. This is durable reviewer evidence only; each future claim still needs its own receipt or proof/check artifact.</p>
    </div>
    <dl>
      <div><dt>Evidence run</dt><dd><code>${escapeHtml(runId)}</code></dd></div>
      <div><dt>Status</dt><dd>${escapeHtml(run?.status ?? "missing")}</dd></div>
      <div><dt>Required gates</dt><dd>${escapeHtml(run ? `${run.requiredPassed}/${run.requiredTotal}` : "not recorded")}</dd></div>
      <div><dt>Artifact</dt><dd><code>${escapeHtml(path)}</code></dd></div>
    </dl>
  </article>`;
}

function savedEngineLadderFromRun(run) {
  if (!run) {
    return { level: undefined, title: undefined };
  }
  const requiredPassed = Number(run.requiredPassed ?? 0);
  const requiredTotal = Number(run.requiredTotal ?? 0);
  if (run.status === "passed" && requiredTotal >= 5 && requiredPassed >= requiredTotal) {
    return {
      level: "engine-level-5-strict-all-engines",
      title: "Strict all-engine saved evidence"
    };
  }
  return {
    level: run.strongestLevelId,
    title: run.strongestLevelTitle
  };
}

function credibilityEngineEvidenceLadderFromCases(cases) {
  if (!Array.isArray(cases)) {
    return [];
  }

  return cases.map((entry) => ({
    caseId: entry.id,
    displayName: entry.displayName,
    gate: entry.required ? "required" : "optional",
    status: entry.status,
    trust: entry.trust,
    evidenceTier: credibilityEngineEvidenceTierFromCase(entry),
    reviewerMeaning: credibilityEngineEvidenceMeaningFromCase(entry),
    replayCommand: entry.command
  }));
}

function credibilityEngineEvidenceTierFromCase(entry) {
  if (entry?.evidenceMinted) {
    return "earned evidence";
  }
  if (entry?.status === "not-required") {
    return "readiness/provenance only";
  }
  if (entry?.status === "missing") {
    return "missing evidence";
  }
  return "failed evidence";
}

function credibilityEngineEvidenceMeaningFromCase(entry) {
  if (entry?.evidenceMinted) {
    return `Concrete ${entry.trust ?? "trust-label"} evidence earned for this fixture; replay it before citing the engine gate.`;
  }
  if (entry?.status === "not-required") {
    return "A local backend may be available, but no concrete trust-label evidence was requested or earned in this run.";
  }
  if (entry?.status === "missing" && entry?.required) {
    return "Required evidence is missing, so strict reviewer readiness fails closed.";
  }
  if (entry?.status === "missing") {
    return "Optional evidence is missing; this is not a blocker, but no claim can cite this engine until a concrete run succeeds.";
  }
  if (entry?.required) {
    return "Required evidence was attempted and failed, so strict reviewer readiness fails closed.";
  }
  return "Optional evidence was attempted and failed; do not cite this engine row as support.";
}

function credibilityEngineLadderStatusClass(entry) {
  const tier = String(entry?.evidenceTier ?? "");
  if (tier === "earned evidence") {
    return "exact";
  }
  if (tier === "failed evidence") {
    return "refuted";
  }
  return "waiting";
}

function credibilityPackSummaryRows(pack) {
  const summary = pack.summary ?? {};
  return [
    ["Professor ready", summary.professorReady ? "yes" : "blocked"],
    ["Workspace validation", `${summary.validationPassed ? "passed" : "failed"} (${summary.validationErrors ?? 0} errors, ${summary.validationWarnings ?? 0} warnings)`],
    ["Strict engine gates", `${summary.requiredEngineGates ?? "0/0"} required${credibilityPackSavedEngineRunLedgerLabel(summary)}`],
    ["Engine evidence", credibilityPackEngineEvidenceSummary(pack)],
    ["Saved engine ladder", credibilityPackSavedEngineLadderSummary(summary, pack?.engineRunLedger)],
    ["Adversarial benchmark", `${summary.latestAdversarialBenchmarkStatus ?? "missing"} (${formatPercent(summary.latestAdversarialBenchmarkAccuracy)})`],
    ["Math ladder", `${summary.latestMathCredibilityLadderStatus ?? "missing"} (${formatPercent(summary.latestMathCredibilityLadderAccuracy)})`],
    ["Saved engine ledger", `${summary.savedEngineRuns ?? 0} run${summary.savedEngineRuns === 1 ? "" : "s"}`],
    ["Open review queue", `${summary.reviewItems ?? 0} items (${summary.criticalReviewItems ?? 0} critical, ${summary.highReviewItems ?? 0} high)`],
    ["Snapshot", `${summary.snapshotFiles ?? 0} files, ${formatBytes(summary.snapshotBytes ?? 0)}`],
    ["Pack ID", pack.packId]
  ];
}

function credibilityPackEngineEvidenceSummary(pack) {
  return credibilityPackEngineEvidenceSummaryFromSummary(pack?.summary);
}

function credibilityPackEngineEvidenceSummaryFromSummary(summary = {}) {
  const engineStatus = summary.engineStatus ?? "unknown";
  const concreteGates = summary.concreteEngineGates ?? "0/0";
  const requiredGates = summary.requiredEngineGates ?? "0/0";
  const evidenceRecords = summary.engineEvidenceMinted ?? 0;
  const liveSummary = `${engineStatus} (${concreteGates} concrete gates, ${requiredGates} required gates, ${evidenceRecords} evidence records earned)`;
  const savedCoverage = credibilityPackSavedEngineCoverageLabel(summary);

  if (savedCoverage && engineStatus !== "passed") {
    return `${savedCoverage}; current web container probe is non-blocking: ${liveSummary}`;
  }

  return liveSummary;
}

function credibilityPackSavedEngineRunLedgerLabel(summary = {}) {
  const labels = [];
  if (summary.savedEngineLadderLevel) {
    labels.push(`strongest saved level: ${summary.savedEngineLadderLevel}`);
  }
  if (summary.latestProfessorEngineRunStatus) {
    labels.push(
      `latest professor Docker: ${summary.latestProfessorEngineRunStatus}${summary.latestProfessorEngineRunLevel ? ` (${summary.latestProfessorEngineRunLevel})` : ""}`
    );
  }
  if (summary.latestStrictEngineRunStatus) {
    labels.push(
      `latest strict reviewer: ${summary.latestStrictEngineRunStatus}${summary.latestStrictEngineRunLevel ? ` (${summary.latestStrictEngineRunLevel})` : ""}`
    );
  }
  return labels.length > 0 ? ` (${labels.join(", ")})` : "";
}

function credibilityPackSavedEngineLadderSummary(summary = {}, engineRunLedger = {}) {
  const run = engineRunLedger.strongestSavedLevelRun
    ?? engineRunLedger.latestStrictReviewerRun
    ?? engineRunLedger.latestProfessorReviewerRun;
  const inferred = savedEngineLadderFromRun(run);
  const level = summary.savedEngineLadderLevel ?? inferred.level;
  if (!level) {
    return "missing";
  }
  const title = summary.savedEngineLadderLevelTitle ?? inferred.title;
  return title ? `${level} (${title})` : level;
}

function credibilityPackSavedEngineCoverageLabel(summary = {}) {
  if (summary.latestStrictEngineRunStatus === "passed") {
    return "saved strict Docker evidence covers these gates";
  }
  if (summary.latestProfessorEngineRunStatus === "passed") {
    return "saved Docker professor evidence covers these gates";
  }
  return undefined;
}

function credibilityPackWarnings(pack) {
  const warnings = [];
  if (state.credibilityPackError) {
    warnings.push(state.credibilityPackError);
  }
  if (pack?.warnings?.length) {
    warnings.push(...pack.warnings.slice(0, 5));
  }
  if (pack?.limitations?.length) {
    warnings.push(pack.limitations[0]);
  }
  if (!pack && !state.credibilityPackError) {
    warnings.push("Reviewer packs are generated locally and do not call hosted models or external services.");
  }
  return [...new Set(warnings)];
}

function credibilityPackActionItemsHtml(pack) {
  const actions = pack?.reviewerActionPlan?.actions ?? [];
  if (actions.length === 0) {
    return "";
  }

  return actions.slice(0, 6).map((item) => `<article class="credibility-pack-action action-${escapeHtml(item.priority)}">
    <div>
      <span class="mini-label">${escapeHtml(item.priority)} / ${escapeHtml(item.category)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.detail)}</p>
      <small>Closes: ${escapeHtml((item.closes ?? []).join(", "))}</small>
    </div>
    <button class="text-button compact-button copy-credibility-action-command" data-command="${escapeHtml(item.command)}" data-title="${escapeHtml(item.title)}" type="button">Copy</button>
  </article>`).join("");
}

function credibilityPackActionSummary(pack) {
  const plan = pack?.reviewerActionPlan;
  if (!plan) {
    return "refresh pack";
  }

  return `${plan.totalActions} actions / ${plan.criticalActions} critical / ${plan.highActions} high`;
}

function credibilityPackPathRows(paths) {
  if (!paths?.json && !paths?.markdown) {
    return "";
  }

  return [
    ["JSON", paths.json],
    ["Markdown", paths.markdown]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(value)}</code></dd></div>`)
    .join("");
}

function credibilityPackReviewerCommand(pack) {
  return pack?.reviewerCommands?.reproducePack ?? "truth-harness workspace credibility-pack . --require-all-engines";
}

function credibilityPackStatusLabel(status) {
  if (status === "ready-for-review") {
    return "ready for review";
  }
  if (status === "blocked") {
    return "blocked honestly";
  }
  return status;
}

function credibilityPackStatusClass(status) {
  if (status === "ready-for-review") {
    return "exact";
  }
  if (status === "blocked") {
    return "waiting";
  }
  return "waiting";
}

function credibilityPackValueHtml(value) {
  if (typeof value === "string" && value.startsWith("cred_")) {
    return `<code>${escapeHtml(value)}</code>`;
  }
  return escapeHtml(String(value ?? ""));
}

function credibilityPackActivitySummary(pack) {
  if (!pack?.summary) {
    return "Professor credibility pack loaded from the local workspace.";
  }

  return `${pack.status}; validation ${pack.summary.validationPassed ? "passed" : "failed"}, engines ${credibilityPackEngineEvidenceSummary(pack)}, adversarial ${pack.summary.latestAdversarialBenchmarkStatus ?? "missing"}, ladder ${pack.summary.latestMathCredibilityLadderStatus ?? "missing"}, queue ${pack.summary.reviewItems} item${pack.summary.reviewItems === 1 ? "" : "s"}.`;
}

function credibilityBundleVerificationReportItems(limit = 5) {
  const items = Array.isArray(state.credibilityBundleVerifications) ? state.credibilityBundleVerifications : [];
  return items.slice(0, limit).map((item) => {
    const verification = item?.verification ?? {};
    const verificationId = typeof verification.verificationId === "string" ? verification.verificationId : "";
    const status = credibilityBundleVerificationStatus(verification);
    return {
      verification,
      verificationId,
      bundleId: verification.bundleId ?? "unknown",
      status: status.statusText,
      statusClass: status.statusClass,
      manifestDigest: credibilityBundleDigestLabel(verification),
      checkedBundleFiles: verification.checkedBundleFiles ?? 0,
      checkedSourceFiles: verification.checkedSourceFiles ?? 0,
      verifiedAt: verification.verifiedAt ?? "unknown",
      relativeJson: item?.paths?.relativeJson ?? item?.paths?.json ?? "not recorded",
      relativeMarkdown: item?.paths?.relativeMarkdown ?? item?.paths?.markdown ?? "not recorded",
      jsonHref: verificationId ? `/api/credibility-bundle/verifications/file?id=${encodeURIComponent(verificationId)}&kind=json` : "",
      markdownHref: verificationId ? `/api/credibility-bundle/verifications/file?id=${encodeURIComponent(verificationId)}&kind=markdown` : ""
    };
  });
}

function credibilityBundleVerificationReportHtml() {
  if (state.credibilityBundleVerificationsError) {
    return `<section class="report-verification-citations warning">
      <p>Saved reviewer-bundle verification history could not be loaded: ${escapeHtml(state.credibilityBundleVerificationsError)}</p>
    </section>`;
  }

  const items = credibilityBundleVerificationReportItems();
  if (items.length === 0) {
    return `<section class="report-verification-citations warning">
      <p>No saved <code>cver_...</code> reviewer-bundle verification is attached to this report yet. Use <strong>Verify now</strong> on the reviewer bundle before treating this packet as externally reviewable.</p>
    </section>`;
  }

  return `<section class="report-verification-citations">
    <p>Saved local reviewer checks cite when the portable bundle was verified and whether the live source workspace still matched the copied evidence.</p>
    <div class="report-verification-list">
      ${items.map((item) => `<article class="report-verification-citation ${item.statusClass}">
        <div class="report-verification-head">
          <strong>${escapeHtml(item.verificationId || "unidentified verification")}</strong>
          <span class="status-pill ${item.statusClass}">${escapeHtml(item.status)}</span>
        </div>
        <dl>
          <div><dt>Bundle</dt><dd>${escapeHtml(item.bundleId)}</dd></div>
          <div><dt>Verified</dt><dd>${escapeHtml(formatActivityTime(item.verifiedAt))}</dd></div>
          <div><dt>Manifest digest</dt><dd>${escapeHtml(item.manifestDigest)}</dd></div>
          <div><dt>Checked files</dt><dd>${escapeHtml(`${item.checkedBundleFiles} bundle, ${item.checkedSourceFiles} source`)}</dd></div>
          <div><dt>JSON artifact</dt><dd><code>${escapeHtml(item.relativeJson)}</code></dd></div>
          <div><dt>Markdown artifact</dt><dd><code>${escapeHtml(item.relativeMarkdown)}</code></dd></div>
          <div><dt>Local downloads</dt><dd><code>${escapeHtml(item.jsonHref)}</code><br><code>${escapeHtml(item.markdownHref)}</code></dd></div>
        </dl>
      </article>`).join("")}
    </div>
  </section>`;
}

function credibilityBundleVerificationReportMarkdown() {
  if (state.credibilityBundleVerificationsError) {
    return [
      "## Reviewer Bundle Verifications",
      "",
      `- Saved reviewer-bundle verification history could not be loaded: ${state.credibilityBundleVerificationsError}`
    ];
  }

  const items = credibilityBundleVerificationReportItems();
  if (items.length === 0) {
    return [
      "## Reviewer Bundle Verifications",
      "",
      "- No saved `cver_...` reviewer-bundle verification is attached to this report yet.",
      "- Before external review, use `Verify now` in the Report tab or run `truth-harness workspace verify-credibility-bundle <bundle-id> --write`."
    ];
  }

  return [
    "## Reviewer Bundle Verifications",
    "",
    "Saved local reviewer checks cite when the portable bundle was verified and whether the live source workspace still matched the copied evidence.",
    "",
    ...items.flatMap((item) => [
      `- ${item.verificationId || "unidentified verification"}: ${item.status}`,
      `  - Bundle: ${item.bundleId}`,
      `  - Verified: ${item.verifiedAt}`,
      `  - Manifest digest: ${item.manifestDigest}`,
      `  - Checked files: ${item.checkedBundleFiles} bundle, ${item.checkedSourceFiles} source`,
      `  - JSON artifact: \`${item.relativeJson}\``,
      `  - Markdown artifact: \`${item.relativeMarkdown}\``,
      `  - Local JSON download: \`${item.jsonHref}\``,
      `  - Local Markdown download: \`${item.markdownHref}\``
    ])
  ];
}

function renderReportDraftHistory(receipt = receiptStore.get(state.receiptKey)) {
  if (!reportDraftList || !reportDraftsStatus) {
    return;
  }

  const drafts = state.reportDrafts ?? [];
  if (refreshReportDraftsButton) {
    refreshReportDraftsButton.disabled = state.reportDraftsLoading;
  }
  if (showCurrentReportButton) {
    showCurrentReportButton.disabled = !state.openedReportDraft;
  }
  const integrity = reportDraftIntegritySummary(drafts);
  reportDraftsStatus.textContent = state.reportDraftsLoading
    ? "loading local report drafts..."
    : state.reportDraftsError
      ? `report history unavailable: ${state.reportDraftsError}`
      : drafts.length > 0
        ? `${drafts.length} saved; ${integrity.needsReview} needing integrity review`
        : "no saved report drafts yet";

  if (state.reportDraftsError) {
    reportDraftList.innerHTML = `<div class="report-draft-empty">${escapeHtml(state.reportDraftsError)}</div>`;
    return;
  }

  if (state.reportDraftsLoading && drafts.length === 0) {
    reportDraftList.innerHTML = `<div class="report-draft-empty">Reading local findings for saved report drafts.</div>`;
    return;
  }

  if (drafts.length === 0) {
    reportDraftList.innerHTML = `<div class="report-draft-empty">Save the current report to create a durable Markdown and JSON draft.</div>`;
    return;
  }

  reportDraftList.innerHTML = `${reportDraftIntegritySummaryHtml(drafts)}${drafts
    .map((item) => reportDraftHistoryRowHtml(item, receipt))
    .join("")}${workspaceArtifactPreviewHtml("report-drafts", {
      allowedPaths: workspaceArtifactPathsForValue(drafts),
      emptyHtml: ""
    })}`;
}

function reportDraftIntegritySummary(drafts) {
  return drafts.reduce((summary, item) => {
    const status = reportDraftIntegrityStatus(item);
    summary.total += 1;
    summary[status] = (summary[status] ?? 0) + 1;
    if (status !== "verified") {
      summary.needsReview += 1;
    }
    return summary;
  }, {
    total: 0,
    verified: 0,
    "sha-mismatch": 0,
    missing: 0,
    unknown: 0,
    needsReview: 0
  });
}

function reportDraftIntegrityStatus(item) {
  if (item?.markdownVerified === true || item?.markdownStatus === "verified") {
    return "verified";
  }
  if (
    item?.markdownVerified === false &&
    typeof item?.markdownSha256 === "string" &&
    typeof item?.report?.markdownSha256 === "string" &&
    item.markdownSha256 !== item.report.markdownSha256
  ) {
    return "sha-mismatch";
  }
  if (item?.markdownStatus === "missing") {
    return "missing";
  }
  if (item?.markdownStatus === "sha-mismatch") {
    return "sha-mismatch";
  }
  return "unknown";
}

function reportDraftIntegritySummaryHtml(drafts) {
  const summary = reportDraftIntegritySummary(drafts);
  const healthy = summary.needsReview === 0;
  const command = "truth-harness workspace reports .";
  const rows = [
    ["Verified", summary.verified, "hash matches JSON"],
    ["Mismatched", summary["sha-mismatch"], "edited after save"],
    ["Missing", summary.missing, "Markdown sidecar gone"],
    ["Unknown", summary.unknown, "needs local read"]
  ];

  return `<section class="report-draft-integrity ${healthy ? "verified" : "attention"}">
    <div>
      <span class="mini-label">report integrity</span>
      <strong>${healthy ? "All saved drafts match their JSON sidecars." : `${summary.needsReview} saved draft${summary.needsReview === 1 ? "" : "s"} need review before sharing.`}</strong>
      <p>Truth Harness verifies the Markdown a human reads against the SHA-256 and byte length stored in the report-draft JSON receipt.</p>
    </div>
    <dl>
      ${rows.map(([label, count, detail]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(count))}<small>${escapeHtml(detail)}</small></dd></div>`).join("")}
    </dl>
    <button class="text-button compact-button copy-report-drafts-command" data-command="${escapeHtml(command)}" type="button">Copy review command</button>
  </section>`;
}

function reportDraftIntegrityLabel(status) {
  switch (status) {
    case "verified":
      return "hash verified";
    case "sha-mismatch":
      return "sha mismatch";
    case "missing":
      return "markdown missing";
    default:
      return "needs review";
  }
}

function reportDraftIntegrityClass(status) {
  if (status === "verified") {
    return "exact";
  }
  if (status === "unknown") {
    return "waiting";
  }
  return "refuted";
}

function reportDraftReviewCommand(item) {
  const reportId = item?.report?.reportId;
  return reportId ? `truth-harness workspace report ${reportId} . --json` : "truth-harness workspace reports .";
}

function reportDraftIntegrityDetail(item) {
  const status = reportDraftIntegrityStatus(item);
  if (status === "verified") {
    return "Markdown hash and byte length match the saved JSON receipt.";
  }
  if (status === "missing") {
    return "The JSON receipt exists, but the Markdown a reviewer would read is missing.";
  }
  if (status === "sha-mismatch") {
    return "The Markdown changed after save; regenerate or inspect before sharing.";
  }
  return "Open this draft locally before relying on it.";
}

function reportDraftHistoryRowHtml(item, receipt) {
  const report = item.report ?? {};
  const active = state.openedReportDraft?.report?.reportId === report.reportId;
  const current = receipt?.runId && report.receiptRunId === receipt.runId;
  const status = reportDraftIntegrityStatus(item);
  const statusClass = reportDraftIntegrityClass(status);
  const statusText = reportDraftIntegrityLabel(status);
  const title = report.title ?? report.reportId ?? "Saved report draft";
  const createdAt = report.createdAt ? formatActivityTime(report.createdAt) : "local draft";
  const markdownPath = item.paths?.relativeMarkdown ?? report.paths?.markdown ?? "local markdown path not recorded";
  const jsonPath = item.paths?.relativeJson ?? report.paths?.json ?? "local JSON path not recorded";
  const artifactRefsHtml = reportDraftArtifactRefsHtml(item, "report-drafts", {
    compact: true,
    fallbackMarkdownPath: markdownPath,
    fallbackJsonPath: jsonPath
  });
  const command = reportDraftReviewCommand(item);
  return `<article class="report-draft-row ${active ? "active" : ""}" data-report-id="${escapeHtml(report.reportId ?? "")}">
    <div class="report-draft-main">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(createdAt)} - ${escapeHtml(report.trust ?? "unlabeled")}${current ? " - current receipt" : ""}</small>
      </div>
      <div class="report-draft-paths">
        ${artifactRefsHtml}
      </div>
      <p>${escapeHtml(reportDraftIntegrityDetail(item))}</p>
    </div>
    <div class="report-draft-side">
      <span class="report-draft-status ${statusClass}">${escapeHtml(statusText)}</span>
      <button class="text-button compact-button open-report-draft" data-report-id="${escapeHtml(report.reportId ?? "")}" type="button">Open</button>
      <button class="text-button compact-button copy-report-draft-command" data-report-id="${escapeHtml(report.reportId ?? "")}" data-command="${escapeHtml(command)}" type="button">Copy command</button>
    </div>
  </article>`;
}

function reportDraftArtifactRefsHtml(item, surface, { compact = false, fallbackMarkdownPath, fallbackJsonPath } = {}) {
  const artifactRefs = workspaceArtifactRefObjects(item);
  if (artifactRefs.length > 0) {
    return workspaceRunNextArtifactRefsHtml(artifactRefs, surface, {
      compact,
      limit: 4,
      emptyHtml: ""
    });
  }

  const markdownPath = fallbackMarkdownPath ?? item?.paths?.relativeMarkdown ?? item?.report?.paths?.markdown;
  const jsonPath = fallbackJsonPath ?? item?.paths?.relativeJson ?? item?.report?.paths?.json;
  return [
    workspaceArtifactRefIsPreviewable(markdownPath)
      ? artifactRefControlHtml(markdownPath, { surface, label: "Open Markdown" })
      : `<code>${escapeHtml(markdownPath ?? "local markdown path not recorded")}</code>`,
    workspaceArtifactRefIsPreviewable(jsonPath)
      ? artifactRefControlHtml(jsonPath, { surface, label: "Open JSON" })
      : ""
  ].join("");
}

async function refreshReportDrafts({ announce = true } = {}) {
  if (state.reportDraftsLoading) {
    return;
  }

  state.reportDraftsLoading = true;
  state.reportDraftsError = undefined;
  renderReportDraftHistory();
  try {
    const response = await fetch("/api/reports?limit=8", {
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readLocalApiJson(response, "Local report draft history failed.");
    state.reportDrafts = Array.isArray(payload.reports) ? payload.reports : [];
    state.reportDraftsLoaded = true;
    state.reportDraftsError = undefined;
    if (announce) {
      addActivity("local-api", "Loaded report drafts", `${state.reportDrafts.length} saved local report draft(s) found in .truth-harness/findings.`, "passed");
    }
  } catch (error) {
    state.reportDraftsError = error instanceof Error ? error.message : "Unknown report draft history failure.";
    state.reportDraftsLoaded = true;
    if (announce) {
      addActivity("local-api", "Report draft history unavailable", state.reportDraftsError, "waiting");
    }
  } finally {
    state.reportDraftsLoading = false;
    renderReportDraftHistory();
  }
}

async function openSavedReportDraft(reportId) {
  if (!/^report_[a-f0-9]{16}$/u.test(reportId)) {
    return;
  }

  try {
    const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readLocalApiJson(response, "Local report draft could not be opened.");
    state.openedReportDraft = payload;
    addActivity(
      "human",
      "Opened saved report draft",
      `${payload.report?.reportId ?? reportId} opened from local findings; Markdown hash ${payload.markdownVerified ? "verified" : "needs review"}.`,
      payload.markdownVerified ? "passed" : "waiting"
    );
    renderReport(receiptStore.get(state.receiptKey));
    reportPreview?.scrollTo({ top: 0, left: 0 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown report draft open failure.";
    addActivity("local-api", "Report draft open failed", detail, "refuted");
    state.reportDraftsError = detail;
    renderReportDraftHistory();
  }
}

function showCurrentReportDraft() {
  if (!state.openedReportDraft) {
    return;
  }

  state.openedReportDraft = undefined;
  renderReport(receiptStore.get(state.receiptKey));
  addActivity("human", "Opened current report draft", "Report preview returned to the live receipt-generated draft.", "passed");
}

function renderSavedReportDraftPreview(payload) {
  const report = payload.report ?? {};
  const status = reportDraftIntegrityStatus(payload);
  const verified = status === "verified";
  const statusClass = reportDraftIntegrityClass(status);
  const statusLabel = reportDraftIntegrityLabel(status);
  const command = reportDraftReviewCommand({ report });
  const warnings = Array.isArray(report.warnings) ? report.warnings : [];
  const markdownPath = payload.paths?.relativeMarkdown ?? report.paths?.markdown ?? "not recorded";
  const jsonPath = payload.paths?.relativeJson ?? report.paths?.json ?? "not recorded";
  const allowedPaths = workspaceArtifactPathsForValue(payload);
  const artifactRefsHtml = reportDraftArtifactRefsHtml(payload, "saved-report-draft", {
    compact: true,
    fallbackMarkdownPath: markdownPath,
    fallbackJsonPath: jsonPath
  });
  reportPreview.innerHTML = `
    <header class="saved-report-header">
      <div>
        <h2>${escapeHtml(report.title ?? "Saved Report Draft")}</h2>
        <p>${escapeHtml(report.summary ?? "Saved local Markdown report draft.")}</p>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(statusLabel)}</span>
    </header>
    <section class="saved-report-integrity ${verified ? "verified" : "attention"}">
      <div>
        <span class="mini-label">saved draft integrity</span>
        <strong>${verified ? "Markdown matches the JSON receipt." : "Review this draft before sharing."}</strong>
        <p>${escapeHtml(reportDraftIntegrityDetail(payload))}</p>
      </div>
      <code>${escapeHtml(command)}</code>
    </section>
    <dl class="report-facts">
      <div><dt>Report ID</dt><dd><code>${escapeHtml(report.reportId ?? "not recorded")}</code></dd></div>
      <div><dt>Created</dt><dd>${escapeHtml(report.createdAt ?? "not recorded")}</dd></div>
      <div><dt>Trust</dt><dd>${escapeHtml(report.trust ?? "unlabeled")}</dd></div>
      <div><dt>Receipt</dt><dd><code>${escapeHtml(report.receiptRunId ?? "not recorded")}</code></dd></div>
      <div><dt>Markdown status</dt><dd>${escapeHtml(statusLabel)}</dd></div>
      <div><dt>Markdown SHA-256</dt><dd><code>${escapeHtml(payload.markdownSha256 ?? report.markdownSha256 ?? "not recorded")}</code></dd></div>
      <div><dt>Expected SHA-256</dt><dd><code>${escapeHtml(report.markdownSha256 ?? "not recorded")}</code></dd></div>
      <div><dt>Byte length</dt><dd>${escapeHtml(String(report.markdownByteLength ?? "not recorded"))}</dd></div>
      <div><dt>Markdown path</dt><dd>${artifactAwareValueHtml(markdownPath, "saved-report-draft")}</dd></div>
      <div><dt>JSON path</dt><dd>${artifactAwareValueHtml(jsonPath, "saved-report-draft")}</dd></div>
    </dl>
    ${artifactRefsHtml}
    ${workspaceArtifactPreviewHtml("saved-report-draft", {
      allowedPaths,
      emptyHtml: ""
    })}
    ${warnings.length > 0 ? `<ul class="report-sublist">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}
    <section class="saved-report-markdown">${renderMarkdownSubset(payload.markdown ?? "")}</section>
  `;
}

function renderMarkdownSubset(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/u);
  const html = [];
  let list = undefined;
  let inCode = false;
  let codeLines = [];

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = undefined;
    }
  };
  const openList = (nextList) => {
    if (list !== nextList) {
      closeList();
      list = nextList;
      html.push(`<${list}>`);
    }
  };
  const closeCode = () => {
    if (inCode) {
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      inCode = false;
      codeLines = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        closeCode();
      } else {
        closeList();
        inCode = true;
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/u.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(4, heading[1].length + 1);
      html.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/u.exec(line);
    if (ordered) {
      openList("ol");
      html.push(`<li>${renderMarkdownInline(ordered[1])}</li>`);
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/u.exec(line);
    if (unordered) {
      openList("ul");
      html.push(`<li>${renderMarkdownInline(unordered[1])}</li>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    html.push(`<p>${renderMarkdownInline(line)}</p>`);
  }

  closeCode();
  closeList();
  return html.join("");
}

function renderMarkdownInline(value) {
  return escapeHtml(value).replace(/`([^`]+)`/gu, "<code>$1</code>");
}

function renderReport(receipt) {
  if (!receipt) {
    return;
  }

  if (state.openedReportDraft?.report?.receiptRunId && state.openedReportDraft.report.receiptRunId !== receipt.runId) {
    state.openedReportDraft = undefined;
  }
  if (state.surface === "report" && !state.reportDraftsLoaded && !state.reportDraftsLoading) {
    void refreshReportDrafts({ announce: false });
  }
  renderReportDraftHistory(receipt);
  if (state.openedReportDraft) {
    renderSavedReportDraftPreview(state.openedReportDraft);
    renderReportSaveStatus(receipt);
    return;
  }

  const protocol = currentLaneProtocol();
  const routes = agentRouteCommands(receipt);
  const runbook = createRunbookPacket(receipt);
  const researcher = currentResearcherName();
  const matrixItems = verificationRows(receipt)
    .map((row) => `<li><strong>${escapeHtml(row.label)}</strong>: ${escapeHtml(statusLabel(row.status))} - <code>${escapeHtml(row.command)}</code></li>`)
    .join("");
  const notes = researchNotes.value.trim();
  const plot = createPlotModel(receipt);
  const reportFigure = reportFigureArtifactForReceipt(receipt);
  const teachingPacket = createTeachingPacket(receipt);
  const mathInput = receipt.math?.input;
  const mathOutput = receipt.math?.output;
  const tags = receiptTags(receipt);
  const dependencies = receiptDependencies(receipt);
  const dependents = dependentReceiptKeys(receipt);
  const claim = receipt.claimId ? claimLedgerStore.get(receipt.claimId) : undefined;
  const claimFinalization = claim ? claimFinalizationSummary(claim) : undefined;
  const graphItems = evidenceGraphEntries(receipt)
    .map(([kind, summary]) => `<li><strong>${escapeHtml(kind)}</strong>: ${escapeHtml(summary)}</li>`)
    .join("");
  const tagItems = tags.length > 0
    ? tags.map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join("")
    : `<span class="mini-label">No tags yet.</span>`;
  const upstreamItems = dependencies.length > 0
    ? dependencies.map((key) => `<li>${escapeHtml(linkedClaimLabel(key))}</li>`).join("")
    : `<li>No upstream claims recorded.</li>`;
  const downstreamItems = dependents.length > 0
    ? dependents.map((key) => `<li>${escapeHtml(linkedClaimLabel(key))}</li>`).join("")
    : `<li>No downstream claims recorded.</li>`;
  const traceItems = (receipt.traces[state.level] ?? receipt.traces.middle)
    .slice(0, 8)
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");
  const activityItems = activityEvents
    .slice(0, 8)
    .map((event) => {
      const requestMarker = event.requestId ? ` <code>${escapeHtml(event.requestId)}</code>` : "";
      return `<li><time datetime="${escapeHtml(event.at)}">${escapeHtml(event.at)}</time> - ${escapeHtml(event.actor)}: ${escapeHtml(event.title)}${requestMarker}</li>`;
    })
    .join("");
  const plotRows = plot.dataRows
    .slice(0, 8)
    .map((row) => `<tr>${plot.dataColumns.map((_column, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`)
    .join("");
  const routeFactRows = verifierRouteReportFacts(receipt)
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${routeReportValueHtml(label, value)}</dd></div>`)
    .join("");
  const obligationItems = verifierRouteObligationItems(receipt)
    .map((item) => `<li>${item}</li>`)
    .join("");
  const claimFinalizationRows = claimFinalization
    ? [
      ["Claim readiness", claimFinalization.label],
      ["Claim trust", claim.trust],
      ["Claim open checks", String(claimFinalization.openChecks.length)],
      ["Claim finalization", claimFinalization.summary || "No finalization summary recorded."]
    ]
    : [
      ["Claim readiness", "not recorded"],
      ["Claim finalization", "Record the receipt into the claim ledger before using this as a citable claim."]
    ];
  const claimFinalizationHtml = claimFinalizationRows
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
  const claimOpenCheckItems = claimFinalization?.openChecks?.length
    ? claimFinalization.openChecks.slice(0, 8).map((check) => `<li>${escapeHtml(check)}</li>`).join("")
    : "<li>No open claim finalization checks recorded.</li>";

  reportPreview.innerHTML = `
    <header>
      <h2>${escapeHtml(receipt.title)}</h2>
      <p>${escapeHtml(receipt.subtitle)}</p>
      <p>Researcher: ${escapeHtml(researcher)}. Agent/tooling: Truth Harness local evidence session.</p>
      <p>Workbench: Truth Harness by Ocean Bennett. License: AGPL-3.0 with visible attribution requirement.</p>
    </header>
    <div class="report-math">${renderMathInline(mathInput ?? receipt.title)} <span>&rarr;</span> ${renderMathInline(mathOutput ?? receipt.output)}</div>
    <h3>Teaching Packet</h3>
    ${renderTeachingPacketHtml(teachingPacket)}
    <h3>Visual Evidence</h3>
    <dl class="report-facts">
      <div><dt>Kind</dt><dd>${escapeHtml(plot.kind)}</dd></div>
      <div><dt>Title</dt><dd>${escapeHtml(plot.title)}</dd></div>
      <div><dt>Boundary</dt><dd>${escapeHtml(plot.caption)}</dd></div>
    </dl>
    ${reportFigureCitationHtml(reportFigure)}
    <table class="report-table">
      <thead><tr>${plot.dataColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
      <tbody>${plotRows}</tbody>
    </table>
    <dl class="report-facts">
      <div><dt>Trust</dt><dd>${escapeHtml(receipt.trust)}</dd></div>
      <div><dt>Output</dt><dd>${escapeHtml(receipt.output)}</dd></div>
      <div><dt>Engine</dt><dd>${escapeHtml(receipt.engine)}</dd></div>
      <div><dt>Run</dt><dd>${escapeHtml(receipt.runId)}</dd></div>
      <div><dt>Claim ledger</dt><dd>${escapeHtml(receipt.claimId ?? "not recorded")}</dd></div>
      <div><dt>Researcher</dt><dd>${escapeHtml(researcher)}</dd></div>
      <div><dt>Workbench</dt><dd>Truth Harness by Ocean Bennett</dd></div>
      <div><dt>License</dt><dd>AGPL-3.0 with visible attribution</dd></div>
      <div><dt>Replay</dt><dd><code>${escapeHtml(receipt.replay)}</code></dd></div>
    </dl>
    <h3>Saved Verifier Route</h3>
    <dl class="report-facts">${routeFactRows}</dl>
    <h3>Proof Obligations</h3>
    <ol>${obligationItems}</ol>
    <h3>Ledger Metadata</h3>
    <div class="report-tags">${tagItems}</div>
    <dl class="report-facts">${claimFinalizationHtml}</dl>
    <h3>Claim Finalization Checks</h3>
    <ul>${claimOpenCheckItems}</ul>
    <dl class="report-facts">
      <div><dt>Derived by</dt><dd>${escapeHtml(receipt.derivedBy ?? "No derivation note recorded.")}</dd></div>
      <div><dt>Upstream claims</dt><dd><ul>${upstreamItems}</ul></dd></div>
      <div><dt>Downstream claims</dt><dd><ul>${downstreamItems}</ul></dd></div>
    </dl>
    <h3>Agent Routes</h3>
    <dl class="report-facts">
      <div><dt>Receipt</dt><dd><code>${escapeHtml(routes.receipt)}</code></dd></div>
      <div><dt>Replay</dt><dd><code>${escapeHtml(routes.replay)}</code></dd></div>
      <div><dt>Report</dt><dd><code>${escapeHtml(routes.report)}</code></dd></div>
    </dl>
    <h3>Verification Environment</h3>
    <dl class="report-facts">${verificationEnvironmentFactsHtml()}</dl>
    <ul>${verificationEnvironmentCommandHtml()}</ul>
    <ul class="report-sublist">${verificationEnvironmentNotesHtml()}</ul>
    <h3>Reviewer Bundle Verifications</h3>
    ${credibilityBundleVerificationReportHtml()}
    <h3>Agent Runbook</h3>
    <dl class="report-facts">
      <div><dt>Mode</dt><dd>${escapeHtml(runbook.lane)} - ${escapeHtml(runbook.protocol)}</dd></div>
      <div><dt>Next</dt><dd><code>${escapeHtml(runbook.commands.next)}</code></dd></div>
      <div><dt>Budget</dt><dd>depth ${escapeHtml(runbook.budgets.maxDepth)}, branches ${escapeHtml(runbook.budgets.maxBranches)}</dd></div>
      <div><dt>Stop</dt><dd>${escapeHtml(runbook.stopRules[0])}</dd></div>
    </dl>
    <h3>Verification Matrix</h3>
    <ol>${matrixItems}</ol>
    <h3>${escapeHtml(protocol.name)} Review Standard</h3>
    <p>${escapeHtml(protocol.claimStandard)}</p>
    <dl class="report-facts">
      <div><dt>Protocol</dt><dd>${escapeHtml(protocol.title)}</dd></div>
      <div><dt>Primary gate</dt><dd>${escapeHtml(protocol.verificationGates[0])}</dd></div>
      <div><dt>Boundary</dt><dd>${escapeHtml(protocol.reviewBoundary[0])}</dd></div>
      <div><dt>Packet</dt><dd>${escapeHtml(protocol.deliverables[0])}</dd></div>
    </dl>
    <h3>Evidence Path</h3>
    <ol>${graphItems}</ol>
    <h3>Trace Excerpt</h3>
    <ol>${traceItems}</ol>
    <h3>Research Notes</h3>
    <p>${notes ? escapeHtml(notes).replaceAll("\n", "<br>") : "No local notes added yet."}</p>
    <h3>Boundaries</h3>
    <ul>${receipt.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")}</ul>
    <h3>Session Citations</h3>
    <ul>${activityItems}</ul>
  `;
  renderReportSaveStatus(receipt);
}

function generateReportMarkdown(receipt) {
  const trace = receipt.traces[state.level] ?? receipt.traces.middle;
  const protocol = currentLaneProtocol();
  const routes = agentRouteCommands(receipt);
  const runbook = createRunbookPacket(receipt);
  const researcher = currentResearcherName();
  const matrix = verificationRows(receipt);
  const notes = researchNotes.value.trim() || "No local notes added yet.";
  const plot = createPlotModel(receipt);
  const reportFigure = reportFigureArtifactForReceipt(receipt);
  const teachingPacket = createTeachingPacket(receipt);
  const mathInput = receipt.math?.input ?? receipt.title;
  const mathOutput = receipt.math?.output ?? receipt.output;
  const tags = receiptTags(receipt);
  const dependencies = receiptDependencies(receipt);
  const dependents = dependentReceiptKeys(receipt);
  const claim = receipt.claimId ? claimLedgerStore.get(receipt.claimId) : undefined;
  const claimFinalization = claim ? claimFinalizationSummary(claim) : undefined;
  const claimFinalizationMarkdown = claimFinalization
    ? [
      `- Claim readiness: ${claimFinalization.label}`,
      `- Claim trust: ${claim.trust}`,
      `- Claim open checks: ${claimFinalization.openChecks.length}`,
      `- Claim finalization: ${claimFinalization.summary || "No finalization summary recorded."}`,
      "",
      "Claim finalization checks:",
      "",
      ...(claimFinalization.openChecks.length > 0
        ? claimFinalization.openChecks.map((check) => `- ${check}`)
        : ["- No open claim finalization checks recorded."])
    ]
    : [
      "- Claim readiness: not recorded",
      "- Claim finalization: Record the receipt into the claim ledger before using this as a citable claim.",
      "",
      "Claim finalization checks:",
      "",
      "- No claim ledger record loaded."
    ];
  const lines = [
    `# ${receipt.title}`,
    "",
    `Summary: ${receipt.subtitle}`,
    "",
    "## Authorship and Session Identity",
    "",
    `- Human researcher: ${researcher}`,
    "- Agent/tooling: Truth Harness local evidence session",
    "- Workbench: Truth Harness by Ocean Bennett",
    "- License: AGPL-3.0 with visible attribution requirement",
    "- Identity storage: local browser storage; include stronger signatures before public or legal use",
    "",
    "## Math View",
    "",
    `- Input TeX: \`${mathInput}\``,
    `- Output TeX: \`${mathOutput}\``,
    "",
    "## Teaching Packet",
    "",
    teachingPacketMarkdown(teachingPacket),
    "",
    "## Visual Evidence",
    "",
    `- Kind: ${plot.kind}`,
    `- Title: ${plot.title}`,
    `- Boundary: ${plot.caption}`,
    ...reportFigureCitationMarkdown(reportFigure),
    "",
    "Visual data CSV:",
    "",
    "```csv",
    formatPlotDataCsv(plot).trimEnd(),
    "```",
    "",
    "## Receipt",
    "",
    `- Trust: ${receipt.trust}`,
    `- Output: ${receipt.output}`,
    `- Engine: ${receipt.engine}`,
    `- Run ID: ${receipt.runId}`,
    `- Claim ledger ID: ${receipt.claimId ?? "not recorded"}`,
    `- Replay: \`${receipt.replay}\``,
    "",
    "## Saved Verifier Route",
    "",
    ...verifierRouteReportFacts(receipt).map(([label, value]) => `- ${label}: ${value}`),
    "",
    "## Proof Obligations",
    "",
    ...verifierRouteObligationMarkdown(receipt),
    "",
    "## Ledger Metadata",
    "",
    `- Tags: ${tags.length > 0 ? tags.map((tag) => `#${tag}`).join(", ") : "none"}`,
    ...claimFinalizationMarkdown,
    "",
    `- Derived by: ${receipt.derivedBy ?? "No derivation note recorded."}`,
    "- Upstream claims:",
    ...(dependencies.length > 0 ? dependencies.map((key) => `  - ${linkedClaimLabel(key)}`) : ["  - none"]),
    "- Downstream claims:",
    ...(dependents.length > 0 ? dependents.map((key) => `  - ${linkedClaimLabel(key)}`) : ["  - none"]),
    "",
    "## Agent Routes",
    "",
    `- Receipt: \`${routes.receipt}\``,
    `- Replay: \`${routes.replay}\``,
    `- Report: \`${routes.report}\``,
    "",
    ...verificationEnvironmentMarkdown(),
    "",
    ...credibilityBundleVerificationReportMarkdown(),
    "",
    "## Agent Runbook",
    "",
    `- Mode: ${runbook.lane} / ${runbook.protocol}`,
    `- Next command: \`${runbook.commands.next}\``,
    `- Max depth: ${runbook.budgets.maxDepth}`,
    `- Max branches: ${runbook.budgets.maxBranches}`,
    `- Checkpoint cadence: ${runbook.budgets.checkpointEvery}`,
    `- Stop rule: ${runbook.stopRules[0]}`,
    "",
    "Recursive loop:",
    "",
    ...runbook.loop.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Verification Matrix",
    "",
    ...matrix.map((row) => `- ${row.label}: ${statusLabel(row.status)}. Command: \`${row.command}\``),
    "",
    `## ${protocol.name} Review Standard`,
    "",
    protocol.claimStandard,
    "",
    `Protocol: ${protocol.title}`,
    "",
    "Accepted evidence:",
    "",
    ...protocol.acceptedEvidence.map((item) => `- ${item}`),
    "",
    "Verification gates:",
    "",
    ...protocol.verificationGates.map((item) => `- ${item}`),
    "",
    "Review boundary:",
    "",
    ...protocol.reviewBoundary.map((item) => `- ${item}`),
    "",
    "Review packet:",
    "",
    ...protocol.deliverables.map((item) => `- ${item}`),
    "",
    "## Evidence Path",
    "",
    ...evidenceGraphEntries(receipt).map(([kind, summary], index) => `${index + 1}. ${kind}: ${summary}`),
    "",
    "## Trace Excerpt",
    "",
    ...trace.slice(0, 12).map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Research Notes",
    "",
    notes,
    "",
    "## Boundaries",
    "",
    ...receipt.limitations.map((limitation) => `- ${limitation}`),
    "",
    "## Session Citations",
    "",
    ...activityEvents.slice(0, 20).map((event) => {
      const requestMarker = event.requestId ? ` [request: ${event.requestId}]` : "";
      return `- [${event.at}]${requestMarker} ${event.actor}: ${event.title} - ${event.detail}`;
    })
  ];

  return `${lines.join("\n")}\n`;
}

function reportDraftPayload(receipt) {
  const markdown = generateReportMarkdown(receipt);
  return {
    title: receipt.title,
    summary: receipt.subtitle,
    receiptRunId: receipt.runId,
    claimId: receipt.claimId,
    trust: receipt.trust,
    bundleVerificationIds: credibilityBundleVerificationReportItems(20)
      .map((item) => item.verificationId)
      .filter(Boolean),
    markdown
  };
}

function currentReportDocument(receipt) {
  const opened = state.openedReportDraft;
  if (opened?.markdown && opened?.report?.reportId) {
    return {
      markdown: opened.markdown,
      filename: `${opened.report.reportId}-report-draft.md`,
      label: opened.report.reportId,
      copiedDetail: `${opened.report.reportId} saved report draft copied as Markdown.`,
      downloadedDetail: `${opened.report.reportId} saved report draft downloaded as Markdown.`
    };
  }

  return {
    markdown: generateReportMarkdown(receipt),
    filename: `${receipt.runId}-report.md`,
    label: receipt.runId,
    copiedDetail: `${receipt.runId} report copied as Markdown.`,
    downloadedDetail: `${receipt.runId} report saved as Markdown.`
  };
}

function renderReportSaveStatus(receipt = receiptStore.get(state.receiptKey)) {
  if (!reportSaveStatus) {
    return;
  }

  if (state.reportSaving) {
    reportSaveStatus.textContent = "saving report draft to local workspace...";
    reportSaveStatus.className = "mini-label report-save-status waiting";
    return;
  }

  if (state.reportSaveError) {
    reportSaveStatus.textContent = `report save failed: ${state.reportSaveError}`;
    reportSaveStatus.className = "mini-label report-save-status refuted";
    return;
  }

  const opened = state.openedReportDraft;
  if (opened?.report?.reportId) {
    const verified = opened.markdownVerified === true;
    reportSaveStatus.textContent = `opened ${opened.report.reportId} from local findings; markdown hash ${verified ? "verified" : "needs review"}`;
    reportSaveStatus.className = `mini-label report-save-status ${verified ? "exact" : "refuted"}`;
    return;
  }

  const saved = state.savedReportDraft;
  if (saved && (!receipt || saved.receiptRunId === receipt.runId)) {
    reportSaveStatus.textContent = `saved ${saved.reportId} -> ${saved.paths?.markdown ?? "local report draft"}`;
    reportSaveStatus.className = "mini-label report-save-status exact";
    return;
  }

  reportSaveStatus.textContent = "report draft not saved to workspace yet";
  reportSaveStatus.className = "mini-label report-save-status";
}

async function saveReportDraftFromUi(button) {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt || state.reportSaving) {
    return;
  }

  state.reportSaving = true;
  state.reportSaveError = undefined;
  if (button) {
    button.disabled = true;
    button.textContent = "Saving";
  }
  renderReportSaveStatus(receipt);

  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(reportDraftPayload(receipt))
    });
    const payload = await readLocalApiJson(response, "Local report save failed.");
    state.savedReportDraft = payload.report;
    state.reportSaveError = undefined;
    state.openedReportDraft = undefined;
    addActivity(
      "local-api",
      "Saved report draft",
      payload.activity?.[0]?.detail ?? `${payload.report?.reportId ?? receipt.runId} report draft saved under .truth-harness/findings.`,
      "passed",
      payload.report?.createdAt
    );
    void refreshCatalogStatus({ announce: false });
    void refreshReportDrafts({ announce: false });
  } catch (error) {
    state.reportSaveError = error instanceof Error ? error.message : "Unknown report save failure.";
    addActivity("local-api", "Report save failed", state.reportSaveError, "refuted");
  } finally {
    state.reportSaving = false;
    if (button) {
      button.disabled = false;
      button.textContent = "Save";
    }
    renderReport(receipt);
  }
}

function downloadTextFile(filename, text, type) {
  const blob = new Blob([text], {
    type
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function copyOrDownloadText(options) {
  try {
    await copyTextToClipboard(options.text);
    flashButtonText(options.button, "Copied");
    addActivity("human", options.copiedTitle, options.copiedDetail, "passed");
  } catch (error) {
    downloadTextFile(options.filename, options.text, options.type);
    flashButtonText(options.button, "Downloaded");
    addActivity(
      "web-ui",
      options.fallbackTitle,
      `Clipboard copy was blocked (${clipboardErrorMessage(error)}), so ${options.fallbackDetail}`,
      "waiting"
    );
  }
}

function flashButtonText(button, nextText, duration = 1200) {
  if (!button) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = nextText;
  setTimeout(() => {
    button.textContent = originalText;
  }, duration);
}

function clipboardErrorMessage(error) {
  return error instanceof Error ? error.message : "clipboard write failed";
}

function safeFilenameTimestamp(date = new Date()) {
  return date.toISOString().replace(/[.:]/gu, "-");
}

async function copyTextToClipboard(text) {
  if (globalThis.navigator?.clipboard?.writeText) {
    try {
      await globalThis.navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the local textarea copy path when browser permission blocks direct clipboard writes.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard permission denied. Use Download instead.");
  }
}

function receiptToViewModel(receipt, route, routePaths, receiptPaths) {
  const trace = parseTraceArtifact(receipt);
  const outputs = receipt.evidenceProfile.outputs ?? [];
  const primaryOutput = outputs[0] ?? receipt.summary;
  const backend = receipt.evidenceProfile.backends[0]?.id ?? receipt.evidenceProfile.kind;
  const graph = receipt.graph.nodes.map((node) => [node.kind, node.summary]);
  const traces = trace ? tracesFromArithmeticArtifact(trace) : tracesFromReceipt(receipt);
  const backendTags = receipt.evidenceProfile.backends.map((item) => item.id).filter(Boolean);
  const symbolicArtifact = parseJsonArtifact(receipt, "symbolic-computation-result");
  const independentCasArtifact = parseJsonArtifact(receipt, "independent-cas-check");
  const details = {
    "Evidence kind": receipt.evidenceProfile.kind,
    Backend: receipt.evidenceProfile.backends.map((item) => item.id).join(", ") || "none",
    Output: primaryOutput,
    "Trace steps": trace ? String(trace.steps.length) : String(receipt.graph.nodes.length),
    Network: receipt.privacy.networkAccess,
    "Proof checker": String(receipt.evidenceProfile.proofCheckerBacked)
  };
  if (symbolicArtifact?.checkStatus) {
    details["CAS sanity"] = String(symbolicArtifact.checkStatus);
  }
  if (Array.isArray(symbolicArtifact?.checks)) {
    details["CAS checks"] = symbolicArtifact.checks
      .map((check) => `${check.id}:${check.status}`)
      .join(", ");
  }
  if (independentCasArtifact?.status) {
    details["Independent CAS"] = `maxima:${independentCasArtifact.status}`;
  }
  if (independentCasArtifact?.residual) {
    details["CAS residual"] = String(independentCasArtifact.residual);
  }
  if (receiptPaths?.ref) {
    details["Receipt JSON"] = receiptPaths.ref;
  }
  if (route?.routeId) {
    const obligationCounts = routeObligationCounts(route);
    const readiness = routeReadiness(route);
    details["Verifier route"] = route.routeId;
    details["Route status"] = route.status;
    details["Route readiness"] = `${readiness.ready ? "ready" : "not-ready"} / ${readiness.strongestTrust}`;
    details["Route gaps"] = String(route.gaps?.length ?? 0);
    details["Proof obligations"] = obligationCounts.summary;
    details["Open obligations"] = String(obligationCounts.open);
  }

  return {
    trust: receipt.trust,
    title: receipt.problem,
    subtitle: receipt.summary,
    runId: receipt.runId,
    engine: backend,
    replay: receipt.replay,
    output: primaryOutput,
    tags: uniqueTags(["imported", receipt.evidenceProfile.kind, ...backendTags]),
    dependsOn: [],
    derivedBy: "Imported from local receipt API response.",
    details,
    graph,
    traces,
    limitations: receipt.evidenceProfile.limitations,
    verifierRoute: route,
    routePaths,
    receiptPaths
  };
}

function extractPromptTags(problem) {
  return [...problem.matchAll(/(?:^|\s)#([a-z0-9][a-z0-9-]{1,40})/giu)]
    .map((match) => match[1].toLowerCase());
}

function uniqueTags(tags) {
  return [...new Set(tags
    .map((tag) => String(tag).trim().replace(/^#/u, "").toLowerCase())
    .filter(Boolean))];
}

function parseTraceArtifact(receipt) {
  return parseJsonArtifact(receipt, "exact-arithmetic-trace");
}

function parseJsonArtifact(receipt, kind) {
  const artifact = receipt.artifacts.find((item) => item.kind === kind);
  if (!artifact) {
    return undefined;
  }

  try {
    return JSON.parse(artifact.content);
  } catch {
    return undefined;
  }
}

function tracesFromArithmeticArtifact(trace) {
  const views = Object.fromEntries(
    trace.explanations.map((view) => [view.audience.replace("-school", "").replace("-", ""), view.steps])
  );

  return {
    middle: views.middle ?? trace.steps.map((step) => step.rule),
    high: views.high ?? trace.steps.map((step) => step.rule),
    college: views.college ?? trace.steps.map((step) => `${step.operation} -> ${step.result}`),
    expert: views.expert ?? trace.steps.map((step) => `${step.id}: ${step.operation}; result=${step.result}`)
  };
}

function tracesFromReceipt(receipt) {
  const graphSteps = receipt.graph.nodes
    .filter((node) => ["claim", "tool_run", "computation", "counterexample", "proof"].includes(node.kind))
    .map((node) => `${node.kind}: ${node.summary}`);
  const fallback = graphSteps.length > 0 ? graphSteps : [receipt.summary];

  return {
    middle: fallback,
    high: [...fallback, ...receipt.findings.map((finding) => finding.message)],
    college: receipt.evidenceProfile.outputs.length > 0 ? receipt.evidenceProfile.outputs : fallback,
    expert: [
      `runId=${receipt.runId}`,
      `trust=${receipt.trust}`,
      `evidenceKind=${receipt.evidenceProfile.kind}`,
      `backends=${receipt.evidenceProfile.backends.map((backend) => backend.id).join(", ") || "none"}`
    ]
  };
}

function trustClass(trust) {
  if (trust === "refuted") {
    return "refuted";
  }

  if (trust === "dimension-checked" || trust === "smt-checked" || trust === "cross-checked" || trust === "bounded-numeric") {
    return "checked";
  }

  if (trust === "unverified") {
    return "waiting";
  }

  return "exact";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderMathInline(value) {
  let html = escapeHtml(value);
  html = html.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/gu, (_match, numerator, denominator) => {
    return `<span class="math-frac"><span class="math-frac-row math-frac-num">${renderMathInline(numerator)}</span><span class="math-frac-row math-frac-den">${renderMathInline(denominator)}</span></span>`;
  });
  html = html
    .replace(/\\text\{([^{}]+)\}/gu, '<span class="math-text">$1</span>')
    .replace(/\\mathbb\{Q\}/gu, '<span class="math-symbol">&Qopf;</span>')
    .replace(/\\cdot/gu, '<span class="math-op">&middot;</span>')
    .replace(/\\times/gu, '<span class="math-op">&times;</span>')
    .replace(/\\leq?/gu, '<span class="math-op">&le;</span>')
    .replace(/\\geq?/gu, '<span class="math-op">&ge;</span>')
    .replace(/\\neq/gu, '<span class="math-op">&ne;</span>')
    .replace(/\\rightarrow/gu, '<span class="math-op">&rarr;</span>')
    .replace(/\\Rightarrow/gu, '<span class="math-op">&rArr;</span>')
    .replace(/\\,/gu, '<span class="math-space"></span>')
    .replace(/\\\s+/gu, " ");
  html = html.replace(/\^\{([^{}]+)\}/gu, (_match, exponent) => `<sup>${renderMathInline(exponent)}</sup>`);
  html = html.replace(/\^([A-Za-z0-9+\-]+)/gu, (_match, exponent) => `<sup>${renderMathInline(exponent)}</sup>`);
  html = html.replace(/_\{([^{}]+)\}/gu, (_match, subscript) => `<sub>${renderMathInline(subscript)}</sub>`);
  html = html.replace(/_([A-Za-z0-9+\-]+)/gu, (_match, subscript) => `<sub>${renderMathInline(subscript)}</sub>`);

  return `<span class="math-inline">${html}</span>`;
}

function openSidebarAction(action) {
  if (action === "new-session") {
    state.surface = "trace";
    setReplayPlaying(false);
    render();
    promptInput.focus();
    promptInput.select();
    composer.scrollIntoView({ block: "nearest" });
    addActivity("human", "Opened new session composer", "Ready to route a new local claim through Truth Harness.", "waiting");
    return;
  }

  if (action === "lineage") {
    state.surface = "graph";
    render();
    resetActiveSurfaceScroll();
    addActivity("human", "Opened lineage", "Claim, route, session, and evidence graph surfaces are visible.", "waiting");
    return;
  }

  if (action === "agent-tools") {
    state.surface = "runbook";
    render();
    resetActiveSurfaceScroll();
    addActivity("human", "Opened agent harness", "Runbook, next action, and agent packet are ready for local verification work.", "waiting");
    return;
  }

  if (action === "benchmarks") {
    state.surface = "checks";
    render();
    resetActiveSurfaceScroll();
    addActivity("human", "Opened verification checks", "Route obligations, engine readiness, and benchmark-style gates are visible.", "waiting");
  }
}

function openSidebarProject(row) {
  const lane = row.dataset.projectLane;
  if (!lane) {
    return;
  }

  state.lane = lane;
  state.surface = lane === "math" ? "trace" : "protocol";
  render();
  resetActiveSurfaceScroll();
  const projectName = row.querySelector("span")?.textContent?.trim() ?? "Project";
  addActivity("human", `Opened ${projectName}`, `${laneStatusText[lane] ?? "Research lane"} template loaded locally.`, "waiting");
}

function openSidebarSession(sessionId) {
  if (!sessionId) {
    return;
  }

  const session = researchSessions.find((candidate) => candidate.sessionId === sessionId);
  if (!session) {
    return;
  }

  state.selectedResearchSessionId = sessionId;
  state.surface = "runbook";
  state.sidebarQuery = "";
  sidebarSearch.value = "";
  render();
  resetActiveSurfaceScroll();
  const title = session.title || session.objective || session.sessionId;
  const openTasks = Number.isFinite(session.openTaskCount) ? session.openTaskCount : 0;
  addActivity("human", "Opened research session", `${title} has ${openTasks} open tasks and ${session.evidenceRefCount ?? 0} evidence refs.`, "waiting");
}

function openReceiptKey(key) {
  if (!key || !receiptStore.has(key)) {
    return false;
  }

  setReplayPlaying(false);
  state.receiptKey = key;
  state.level = "middle";
  state.selectedGraphIndex = 0;
  state.selectedResearchMapSnapshotId = undefined;
  state.selectedResearchMapNodeId = undefined;
  state.selectedVisualArtifactId = undefined;
  selectedVisualArtifactRecord = undefined;
  requestVisualFit();
  state.replayIndex = 0;
  promptInput.value = receiptStore.get(state.receiptKey)?.title ?? promptInput.value;
  render();
  return true;
}

function openSidebarClaim(claimId) {
  if (!claimId) {
    return;
  }

  const linkedKey = receiptKeyForClaimId(claimId);
  if (linkedKey && openReceiptKey(linkedKey)) {
    return;
  }

  setReplayPlaying(false);
  state.surface = "graph";
  state.claimLedgerQuery = claimId;
  state.claimLedgerLimit = LEDGER_PAGE_SIZE;
  if (claimLedgerSearch) {
    claimLedgerSearch.value = claimId;
  }
  addActivity("human", "Opened claim ledger artifact", `${claimId} is stored locally; filtered the claim ledger because no receipt view is loaded for it.`, "waiting");
  render();
  resetActiveSurfaceScroll();
}

sidebarToggle.addEventListener("click", () => {
  const collapsed = !state.sidebarCollapsed;
  setSidebarCollapsed(collapsed);
  addActivity("human", collapsed ? "Collapsed navigation" : "Expanded navigation", "Researcher workspace layout changed locally.", "passed");
});

sidebarRestore.addEventListener("click", () => {
  setSidebarCollapsed(false);
  addActivity("human", "Expanded navigation", "Researcher workspace layout changed locally.", "passed");
});

sidebarResizer.addEventListener("pointerdown", beginSidebarResize);
sidebarResizer.addEventListener("pointermove", updateSidebarResize);
sidebarResizer.addEventListener("pointerup", endSidebarResize);
sidebarResizer.addEventListener("pointercancel", endSidebarResize);
sidebarResizer.addEventListener("keydown", handleSidebarResizerKey);

sidebarActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openSidebarAction(button.dataset.sidebarAction);
  });
});

projectRows.forEach((row) => {
  row.addEventListener("click", () => {
    openSidebarProject(row);
  });
});

sessionList?.addEventListener("click", (event) => {
  const row = event.target.closest(".session-row[data-session-id]");
  if (!row) {
    return;
  }

  openSidebarSession(row.dataset.sessionId);
});

researcherNameInput.addEventListener("input", saveResearcherName);

projectStartFocus?.addEventListener("click", () => {
  state.surface = "trace";
  render();
  promptInput.focus();
  composer.scrollIntoView({ block: "nearest" });
  addActivity("human", "Opened new route composer", "Researcher focused the local verification composer from the project start panel.", "waiting");
});

projectStartChecks?.addEventListener("click", () => {
  state.surface = "checks";
  render();
  resetActiveSurfaceScroll();
});

projectStartReport?.addEventListener("click", () => {
  state.surface = "report";
  render();
  if (!state.credibilityPack && !state.credibilityPackLoading) {
    void refreshCredibilityPack({ announce: false });
  }
  if (!state.credibilityBundle && !state.credibilityBundleLoading) {
    void refreshCredibilityBundle({ announce: false });
  }
  if (!state.credibilityRunNextPlan && !state.credibilityRunNextLoading) {
    void refreshCredibilityRunNext({ announce: false });
  }
  if (!state.reportDraftsLoaded && !state.reportDraftsLoading) {
    void refreshReportDrafts({ announce: false });
  }
  resetActiveSurfaceScroll();
});

claimList.addEventListener("click", (event) => {
  const button = event.target.closest(".claim-row");
  if (!button) {
    return;
  }

  if (button.dataset.receipt && openReceiptKey(button.dataset.receipt)) {
    document.querySelector("#surface-checks")?.scrollTo({ top: 0, left: 0 });
    return;
  }

  openSidebarClaim(button.dataset.claimId);
});

catalogRebuildButton?.addEventListener("click", () => {
  void rebuildCatalogIndex();
});

maintenanceRefreshButton?.addEventListener("click", () => {
  void refreshWorkspaceMaintenance({ announce: true });
});

maintenanceRepairPreviewButton?.addEventListener("click", () => {
  void repairWorkspaceArtifactsFromUi({ preview: true });
});

maintenanceRepairApplyButton?.addEventListener("click", () => {
  void repairWorkspaceArtifactsFromUi({ preview: false });
});

maintenanceCleanPreviewButton?.addEventListener("click", () => {
  void cleanWorkspaceFromUi({ confirmDelete: false });
});

maintenanceArchiveScratchButton?.addEventListener("click", () => {
  void archiveWorkspaceScratchFromUi();
});

maintenanceCleanScratchButton?.addEventListener("click", () => {
  void cleanWorkspaceFromUi({ confirmDelete: true });
});

catalogResultList?.addEventListener("click", (event) => {
  const button = event.target.closest(".catalog-result-row");
  if (!button) {
    return;
  }

  openCatalogResult(button);
});

claimLedgerList.addEventListener("click", (event) => {
  const button = event.target.closest(".ledger-record");
  if (!button) {
    return;
  }

  const claim = claimLedgerStore.get(button.dataset.claimId);
  const key = claim ? receiptKeyForClaimRecord(claim) : receiptKeyForClaimId(button.dataset.claimId);
  if (!key) {
    openSidebarClaim(button.dataset.claimId);
    return;
  }

  openReceiptKey(key);
});

mainGraphList.addEventListener("click", (event) => {
  const button = event.target.closest(".canvas-node");
  if (!button) {
    return;
  }

  state.selectedGraphIndex = Number(button.dataset.graphIndex);
  renderMainGraph(receiptStore.get(state.receiptKey));
});

graphDetail.addEventListener("click", (event) => {
  const copyButton = event.target.closest(".graph-copy-text");
  if (copyButton) {
    void copyOrDownloadText({
      button: copyButton,
      text: copyButton.dataset.copyText ?? "",
      filename: `truth-harness-graph-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: copyButton.dataset.copyTitle ?? "Copied graph detail",
      copiedDetail: "Workspace graph detail copied from the local lineage inspector.",
      fallbackTitle: "Downloaded graph detail",
      fallbackDetail: "the graph detail was saved as a local text file instead."
    });
    return;
  }

  const button = event.target.closest(".graph-open-receipt");
  if (!button) {
    return;
  }

  const key = receiptKeyForClaimId(button.dataset.claimId);
  if (!key) {
    return;
  }

  setReplayPlaying(false);
  state.receiptKey = key;
  state.level = "middle";
  state.selectedGraphIndex = 0;
  state.selectedResearchMapSnapshotId = undefined;
  state.selectedResearchMapNodeId = undefined;
  requestVisualFit();
  state.replayIndex = 0;
  promptInput.value = receiptStore.get(state.receiptKey)?.title ?? promptInput.value;
  render();
});

branchMap.addEventListener("click", (event) => {
  const button = event.target.closest(".branch-node[data-receipt-key]");
  if (!button || !receiptStore.has(button.dataset.receiptKey)) {
    return;
  }

  setReplayPlaying(false);
  state.receiptKey = button.dataset.receiptKey;
  state.level = "middle";
  state.selectedGraphIndex = 0;
  state.selectedResearchMapSnapshotId = undefined;
  state.selectedResearchMapNodeId = undefined;
  requestVisualFit();
  state.replayIndex = 0;
  promptInput.value = receiptStore.get(state.receiptKey)?.title ?? promptInput.value;
  render();
});

laneButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextLane = button.dataset.lane;
    if (!nextLane || nextLane === state.lane) {
      return;
    }

    state.lane = nextLane;
    renderLane();
    renderProtocol();
    renderAgentRoutes(receiptStore.get(state.receiptKey));
    renderRunbook(receiptStore.get(state.receiptKey));
    renderVerificationMatrix(receiptStore.get(state.receiptKey));
    renderReport(receiptStore.get(state.receiptKey));
    renderSidebarActions();
  });
});

sidebarSearch.addEventListener("input", () => {
  state.sidebarQuery = sidebarSearch.value;
  state.catalogRefFilter = undefined;
  renderClaimList();
  applySidebarSearch();
  scheduleCatalogSearch();
});

sidebarSearch.addEventListener("focus", renderSidebarActions);
sidebarSearch.addEventListener("blur", renderSidebarActions);

claimLedgerSearch.addEventListener("input", () => {
  state.claimLedgerQuery = claimLedgerSearch.value;
  state.claimLedgerLimit = LEDGER_PAGE_SIZE;
  renderClaimLedger();
});

routeHistorySearch.addEventListener("input", () => {
  state.routeHistoryQuery = routeHistorySearch.value;
  state.routeHistoryLimit = LEDGER_PAGE_SIZE;
  renderRouteHistory();
});

claimLedgerMore?.addEventListener("click", () => {
  state.claimLedgerLimit += LEDGER_PAGE_SIZE;
  renderClaimLedger();
});

routeHistoryMore?.addEventListener("click", () => {
  state.routeHistoryLimit += LEDGER_PAGE_SIZE;
  renderRouteHistory();
});

verificationMatrix.addEventListener("click", (event) => {
  const casButton = event.target.closest(".run-cas-obligation");
  if (casButton) {
    void runCasForObligation(casButton);
    return;
  }

  const smtButton = event.target.closest(".run-smt-obligation");
  if (smtButton) {
    void runSmtForObligation(smtButton);
    return;
  }

  const copyButton = event.target.closest(".copy-obligation-command");
  if (copyButton) {
    void copyObligationCommand(copyButton);
  }
});

casArtifactList.addEventListener("click", (event) => {
  const attachButton = event.target.closest(".attach-evidence-artifact");
  if (!attachButton) {
    return;
  }

  void attachEvidenceToRoute({
    routeId: attachButton.dataset.routeId,
    obligationId: attachButton.dataset.obligationId,
    evidenceRef: {
      kind: attachButton.dataset.evidenceKind,
      ref: attachButton.dataset.evidenceRef,
      trust: attachButton.dataset.evidenceTrust,
      summary: attachButton.dataset.evidenceSummary
    }
  });
});

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest(".route-record[data-route-id]");
  if (routeButton) {
    event.stopPropagation();
    void openSavedRoute(routeButton.dataset.routeId);
    return;
  }

  const citationButton = event.target.closest(".copy-workspace-artifact-citation");
  if (citationButton) {
    event.stopPropagation();
    void copyWorkspaceArtifactCitation(citationButton.dataset.citation, citationButton);
    return;
  }

  const citedByButton = event.target.closest(".search-catalog-citations");
  if (citedByButton) {
    event.stopPropagation();
    void searchCatalogCitations(citedByButton.dataset.ref);
    return;
  }

  const revalidationCopyButton = event.target.closest(".copy-run-next-revalidation-command");
  if (revalidationCopyButton?.dataset.command) {
    event.stopPropagation();
    void copyWorkspaceRunNextHandoffCommand(revalidationCopyButton.dataset.command, revalidationCopyButton);
    return;
  }

  const clearCitedByButton = event.target.closest(".clear-catalog-ref-filter");
  if (clearCitedByButton) {
    event.stopPropagation();
    clearCatalogCitationSearch();
    return;
  }

  const previewButton = event.target.closest(".open-workspace-artifact-preview");
  if (!previewButton) {
    return;
  }

  void openWorkspaceArtifactPreview(previewButton.dataset.path, {
    surface: previewButton.dataset.artifactPreviewSurface ?? "workspace"
  });
});

document.querySelectorAll(".docker-copy-command").forEach((button) => {
  button.addEventListener("click", async () => {
    const command = button.dataset.command;
    if (!command) {
      return;
    }

    await copyOrDownloadText({
      text: `${command}\n`,
      filename: `truth-harness-docker-verifier-command-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      button,
      copiedTitle: "Copied Docker verifier command",
      copiedDetail: command,
      fallbackTitle: "Downloaded Docker verifier command",
      fallbackDetail: "the Docker verifier command was saved as plain text instead."
    });
  });
});

openReplayButton.addEventListener("click", () => {
  state.surface = "replay";
  render();
});

recordClaimButton.addEventListener("click", () => {
  void recordCurrentClaim();
});

recordChainButton.addEventListener("click", () => {
  void recordCurrentChain();
});

playReplayButton.addEventListener("click", () => {
  setReplayPlaying(!state.replayPlaying);
});

resetReplayButton.addEventListener("click", resetReplay);

exportReplayButton.addEventListener("click", exportReplayImage);

replayList.addEventListener("click", (event) => {
  const button = event.target.closest(".replay-step");
  if (!button) {
    return;
  }

  setReplayPlaying(false);
  state.replayIndex = Number(button.dataset.replayIndex);
  renderReplay(receiptStore.get(state.receiptKey));
});

replayShowMoreButton?.addEventListener("click", () => {
  state.replayLimit += REPLAY_PAGE_SIZE;
  renderReplay(receiptStore.get(state.receiptKey));
});

activitySearch.addEventListener("input", () => {
  state.activityQuery = activitySearch.value;
  state.activityLimit = ACTIVITY_PAGE_SIZE;
  renderActivityLog();
});

surfaceTabs.forEach((button) => {
  button.addEventListener("click", () => {
    const nextSurface = button.dataset.surface;
    if (!nextSurface || nextSurface === state.surface) {
      return;
    }

    state.surface = nextSurface;
    if (nextSurface === "plot") {
      requestVisualFit();
    }
    if (nextSurface === "runbook") {
      refreshWorkspaceRunNextHandoffsIfStale();
    }
    if (nextSurface === "report" && !state.credibilityPack && !state.credibilityPackLoading) {
      void refreshCredibilityPack({ announce: false });
    }
    if (nextSurface === "report" && !state.credibilityBundle && !state.credibilityBundleLoading) {
      void refreshCredibilityBundle({ announce: false });
    }
    if (nextSurface === "report" && !state.credibilityRunNextPlan && !state.credibilityRunNextLoading) {
      void refreshCredibilityRunNext({ announce: false });
    }
    if (nextSurface === "report" && !state.reportDraftsLoaded && !state.reportDraftsLoading) {
      void refreshReportDrafts({ announce: false });
    }
    render();
    resetActiveSurfaceScroll();
  });
});

visualModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextMode = button.dataset.visualMode;
    if (!nextMode) {
      return;
    }

    const alreadyLive = nextMode === state.visualMode && !state.selectedResearchMapSnapshotId;
    if (alreadyLive) {
      return;
    }

    state.selectedResearchMapSnapshotId = undefined;
    state.selectedResearchMapNodeId = undefined;
    state.selectedVisualArtifactId = undefined;
    selectedVisualArtifactRecord = undefined;
    requestVisualFit();
    state.visualMode = nextMode;
    state.surface = "plot";
    render();
    resetActiveSurfaceScroll();
  });
});

visualZoomOutButton.addEventListener("click", () => {
  setVisualZoom(state.visualZoom - VISUAL_ZOOM_STEP, { activity: true });
});

visualZoomResetButton.addEventListener("click", () => {
  setVisualZoom(1, { center: true, activity: true });
});

visualZoomInButton.addEventListener("click", () => {
  setVisualZoom(state.visualZoom + VISUAL_ZOOM_STEP, { activity: true });
});

visualZoomFitButton.addEventListener("click", () => {
  fitVisualToCanvas();
});

toggleVisualFocusButton.addEventListener("click", () => {
  state.visualFocus = !state.visualFocus;
  state.surface = "plot";
  requestVisualFit();
  addActivity(
    "human",
    state.visualFocus ? "Entered visual focus" : "Exited visual focus",
    state.visualFocus
      ? "Receipt inspector hidden so the research map can use the full workspace."
      : "Receipt inspector restored beside the workspace.",
    "passed"
  );
  render();
  resetActiveSurfaceScroll();
});

toggleVisualDetailButton.addEventListener("click", () => {
  state.visualDetailCollapsed = !state.visualDetailCollapsed;
  state.surface = "plot";
  requestVisualFit();
  addActivity(
    "human",
    state.visualDetailCollapsed ? "Collapsed visual detail" : "Expanded visual detail",
    state.visualDetailCollapsed
      ? "Visual detail rail hidden so the map canvas can expand."
      : "Visual detail rail restored with node inspector, data, and saved maps.",
    "passed"
  );
  render();
  resetActiveSurfaceScroll();
});

activityShowMore.addEventListener("click", showOlderActivity);

activityLog.addEventListener("scroll", () => {
  const nearBottom = activityLog.scrollTop + activityLog.clientHeight >= activityLog.scrollHeight - 24;
  if (nearBottom) {
    showOlderActivity();
  }
});

copyActivityButton.addEventListener("click", () => {
  copyActivityLog().catch((error) => {
    addActivity("web-ui", "Copy failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
  });
});

copyTaskConsoleButton?.addEventListener("click", () => {
  copyTaskConsoleCommands().catch((error) => {
    addActivity("web-ui", "Copy agent console failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
  });
});

startResearchHarnessButton?.addEventListener("click", () => {
  startResearchHarnessFromUi().catch((error) => {
    addActivity("web-ui", "Start harness failed", error instanceof Error ? error.message : "Unknown research harness failure.", "refuted");
  });
});

seedProfessorChallengeButton?.addEventListener("click", () => {
  seedHardMathWorkspaceFromUi({
    preset: "professor-challenge",
    button: seedProfessorChallengeButton,
    idleLabel: "Professor challenge",
    pendingLabel: "Seeding challenge",
    activityTitle: "Seeding professor challenge",
    failureTitle: "Professor challenge failed"
  }).catch((error) => {
    addActivity("web-ui", "Professor challenge failed", error instanceof Error ? error.message : "Unknown professor challenge failure.", "refuted");
  });
});

seedHardMathButton?.addEventListener("click", () => {
  seedHardMathWorkspaceFromUi().catch((error) => {
    addActivity("web-ui", "Seed hard math failed", error instanceof Error ? error.message : "Unknown hard-math seed failure.", "refuted");
  });
});

saveRunNextHandoffButton?.addEventListener("click", () => {
  saveWorkspaceRunNextHandoffFromUi().catch((error) => {
    addActivity("web-ui", "Save handoff failed", error instanceof Error ? error.message : "Unknown run-next save failure.", "refuted");
  });
});

refreshRunNextButton?.addEventListener("click", () => {
  void refreshWorkspaceRunNext();
});

copyRunNextCommandButton?.addEventListener("click", () => {
  copyWorkspaceRunNextCommand().catch((error) => {
    addActivity("web-ui", "Copy next action failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
  });
});

refreshPilotLoopButton?.addEventListener("click", () => {
  void refreshWorkspacePilotLoop();
});

copyPilotLoopCommandButton?.addEventListener("click", () => {
  copyWorkspacePilotLoopCommand().catch((error) => {
    addActivity("web-ui", "Copy pilot-loop failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
  });
});

workspaceProfessorChallenge?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-professor-action]");
  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.professorAction;
  handleProfessorChallengeAction(action, actionButton).catch((error) => {
    addActivity("web-ui", "Professor challenge action failed", error instanceof Error ? error.message : "Unknown professor challenge action failure.", "refuted");
  });
});

workspaceRunNextIdleActions?.addEventListener("click", (event) => {
  const copyButton = event.target.closest(".copy-run-next-idle-command");
  if (copyButton?.dataset.command) {
    void copyWorkspaceRunNextHandoffCommand(copyButton.dataset.command, copyButton);
  }
});

refreshRunNextsButton?.addEventListener("click", () => {
  void refreshWorkspaceRunNextHandoffs({ announce: true });
});

verifyRunNextsButton?.addEventListener("click", () => {
  void refreshWorkspaceRunNextHandoffs({ announce: true, verifySnapshots: true });
});

workspaceRunNextList?.addEventListener("click", (event) => {
  if (event.target.closest(".open-workspace-artifact-preview")) {
    return;
  }

  const openButton = event.target.closest(".open-run-next-handoff");
  if (openButton?.dataset.planId) {
    void openWorkspaceRunNextHandoff(openButton.dataset.planId);
    return;
  }

  const verifyButton = event.target.closest(".verify-run-next-handoff");
  if (verifyButton?.dataset.planId) {
    void openWorkspaceRunNextHandoff(verifyButton.dataset.planId, { verifySnapshot: true });
    return;
  }

  const copyButton = event.target.closest(".copy-run-next-handoff-command");
  if (copyButton?.dataset.command) {
    void copyWorkspaceRunNextHandoffCommand(copyButton.dataset.command, copyButton);
  }
});

workspaceRunNextInspection?.addEventListener("click", (event) => {
  if (event.target.closest(".open-workspace-artifact-preview")) {
    return;
  }

  const verifyButton = event.target.closest(".verify-run-next-handoff");
  if (verifyButton?.dataset.planId) {
    void openWorkspaceRunNextHandoff(verifyButton.dataset.planId, { verifySnapshot: true });
    return;
  }

  const copyButton = event.target.closest(".copy-run-next-handoff-command");
  if (copyButton?.dataset.command) {
    void copyWorkspaceRunNextHandoffCommand(copyButton.dataset.command, copyButton);
  }
});

downloadActivityButton.addEventListener("click", downloadActivityLog);

copyRunbookButton.addEventListener("click", () => {
  copyRunbookPacket().catch((error) => {
    addActivity("web-ui", "Copy runbook failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
  });
});

downloadRunbookButton.addEventListener("click", downloadRunbookPacket);

copyRouteLedgerButton.addEventListener("click", () => {
  copyRouteLedgerPacket().catch((error) => {
    addActivity("web-ui", "Copy route failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
  });
});

downloadRouteLedgerButton.addEventListener("click", downloadRouteLedgerPacket);

refreshResearchMapButton.addEventListener("click", () => {
  void refreshResearchMap();
});

refreshVisualArtifactsButton?.addEventListener("click", () => {
  void refreshVisualArtifacts();
});

plotCanvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    queueVisualWheelZoom(event);
  },
  { passive: false }
);

plotCanvas.addEventListener("selectstart", (event) => {
  event.preventDefault();
});

plotCanvas.addEventListener("dragstart", (event) => {
  event.preventDefault();
});

plotCanvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  suppressVisualClick = false;
  visualPanDrag = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    moved: false,
    scrollLeft: plotCanvas.scrollLeft,
    scrollTop: plotCanvas.scrollTop
  };
  plotCanvas.classList.add("panning");
  plotCanvas.setPointerCapture?.(event.pointerId);
});

plotCanvas.addEventListener("pointermove", (event) => {
  if (!visualPanDrag || visualPanDrag.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  const deltaX = event.clientX - visualPanDrag.x;
  const deltaY = event.clientY - visualPanDrag.y;
  if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
    visualPanDrag.moved = true;
  }
  plotCanvas.scrollLeft = visualPanDrag.scrollLeft - deltaX;
  plotCanvas.scrollTop = visualPanDrag.scrollTop - deltaY;
});

function stopVisualPan(event) {
  if (!visualPanDrag || (event.pointerId && visualPanDrag.pointerId !== event.pointerId)) {
    return;
  }

  suppressVisualClick = Boolean(visualPanDrag.moved);
  plotCanvas.classList.remove("panning");
  plotCanvas.releasePointerCapture?.(visualPanDrag.pointerId);
  visualPanDrag = undefined;
}

plotCanvas.addEventListener("pointerup", stopVisualPan);
plotCanvas.addEventListener("pointercancel", stopVisualPan);
plotCanvas.addEventListener("pointerleave", stopVisualPan);

plotCanvas.addEventListener("click", (event) => {
  if (suppressVisualClick) {
    event.preventDefault();
    event.stopPropagation();
    suppressVisualClick = false;
    return;
  }

  const nodeElement = event.target.closest("[data-map-node-id]");
  if (!nodeElement) {
    return;
  }

  selectResearchMapNode(nodeElement.dataset.mapNodeId);
});

plotCanvas.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) {
    return;
  }

  const nodeElement = event.target.closest("[data-map-node-id]");
  if (!nodeElement) {
    return;
  }

  event.preventDefault();
  selectResearchMapNode(nodeElement.dataset.mapNodeId);
});

plotNodeInspector.addEventListener("click", (event) => {
  const saveButton = event.target.closest("[data-map-save-current]");
  if (saveButton) {
    saveCurrentResearchMap().catch((error) => {
      addActivity("web-ui", "Save map failed", error instanceof Error ? error.message : "Unknown research map failure.", "refuted");
    });
    return;
  }

  const openButton = event.target.closest("[data-map-open-receipt]");
  if (openButton?.dataset.mapOpenReceipt) {
    openResearchMapNodeReceipt(openButton.dataset.mapOpenReceipt);
    return;
  }

  const copyButton = event.target.closest("[data-map-copy-node]");
  if (copyButton) {
    copySelectedResearchMapNode(copyButton).catch((error) => {
      addActivity("web-ui", "Copy map node failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
    });
  }
});

plotNodeInspector.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-map-thought-form]");
  if (!form) {
    return;
  }

  event.preventDefault();
  saveResearchMapThought(form).catch((error) => {
    addActivity("web-ui", "Save map thought failed", error instanceof Error ? error.message : "Unknown research map failure.", "refuted");
  });
});

visualArtifactBanner?.addEventListener("click", (event) => {
  const renderedButton = event.target.closest("[data-open-rendered-visual-id]");
  if (renderedButton?.dataset.openRenderedVisualId) {
    openVisualArtifact(renderedButton.dataset.openRenderedVisualId, { preferRendered: false }).catch((error) => {
      addActivity("web-ui", "Open rendered visual failed", error instanceof Error ? error.message : "Unknown visual artifact failure.", "refuted");
    });
    return;
  }

  const sourceButton = event.target.closest("[data-open-source-visual-id]");
  if (sourceButton?.dataset.openSourceVisualId) {
    openVisualArtifact(sourceButton.dataset.openSourceVisualId, { preferRendered: false }).catch((error) => {
      addActivity("web-ui", "Open source visual failed", error instanceof Error ? error.message : "Unknown visual artifact failure.", "refuted");
    });
  }
});

researchMapList.addEventListener("click", (event) => {
  const button = event.target.closest(".research-map-row");
  if (!button?.dataset.mapSnapshotId) {
    return;
  }

  state.selectedResearchMapSnapshotId = button.dataset.mapSnapshotId;
  state.selectedResearchMapNodeId = undefined;
  state.selectedVisualArtifactId = undefined;
  selectedVisualArtifactRecord = undefined;
  state.surface = "plot";
  requestVisualFit();
  addActivity("human", "Opened saved research map", `${button.dataset.mapSnapshotId} loaded from local map history.`, "passed");
  render();
  resetActiveSurfaceScroll();
});

visualArtifactList?.addEventListener("click", (event) => {
  const button = event.target.closest(".research-map-row");
  if (!button?.dataset.visualArtifactId) {
    return;
  }

  openVisualArtifact(button.dataset.visualArtifactId).catch((error) => {
    addActivity("web-ui", "Open visual artifact failed", error instanceof Error ? error.message : "Unknown visual artifact failure.", "refuted");
  });
});

saveResearchMapButton.addEventListener("click", () => {
  saveCurrentResearchMap().catch((error) => {
    addActivity("web-ui", "Visual save failed", error instanceof Error ? error.message : "Unknown visual save failure.", "refuted");
  });
});

savePlotSourceButton?.addEventListener("click", () => {
  saveCurrentPlotFigureArtifact().catch((error) => {
    addActivity("web-ui", "Plot figure failed", error instanceof Error ? error.message : "Unknown plot figure failure.", "refuted");
  });
});

copyPlotDataButton.addEventListener("click", () => {
  copyCurrentPlotData().catch((error) => {
    addActivity("web-ui", "Copy plot data failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
  });
});

downloadPlotDataButton.addEventListener("click", downloadCurrentPlotData);

downloadPlotSvgButton.addEventListener("click", downloadCurrentPlotSvg);

renderVisualArtifactButton?.addEventListener("click", () => {
  renderSelectedVisualArtifact().catch((error) => {
    addActivity("web-ui", "Visual render failed", error instanceof Error ? error.message : "Unknown visual render failure.", "refuted");
  });
});

visualRendererSourcePanel?.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-visual-source-copy]");
  if (copyButton) {
    copyCurrentVisualRendererSource(copyButton).catch((error) => {
      addActivity("web-ui", "Copy renderer source failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
    });
    return;
  }

  const downloadButton = event.target.closest("[data-visual-source-download]");
  if (downloadButton) {
    downloadCurrentVisualRendererSource();
  }
});

researchNotes.addEventListener("input", saveNotes);

researchNotes.addEventListener("change", () => {
  addActivity("human", "Updated scratchpad", "Local session notes were saved in browser storage.", "passed");
});

saveReportButton.addEventListener("click", () => {
  void saveReportDraftFromUi(saveReportButton);
});

refreshReportDraftsButton?.addEventListener("click", () => {
  void refreshReportDrafts({ announce: true });
});

showCurrentReportButton?.addEventListener("click", showCurrentReportDraft);

reportDraftList?.addEventListener("click", (event) => {
  if (event.target.closest(".open-workspace-artifact-preview")) {
    return;
  }

  const copyButton = event.target.closest(".copy-report-draft-command, .copy-report-drafts-command");
  if (copyButton) {
    copyOrDownloadText({
      text: `${copyButton.dataset.command ?? "truth-harness workspace reports ."}\n`,
      filename: `truth-harness-report-draft-command-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      button: copyButton,
      copiedTitle: "Copied report draft command",
      copiedDetail: "Saved report draft integrity command copied from the Report tab.",
      fallbackTitle: "Downloaded report draft command",
      fallbackDetail: "the report draft integrity command was saved as a local text file instead."
    });
    return;
  }

  const openButton = event.target.closest(".open-report-draft");
  const row = event.target.closest(".report-draft-row[data-report-id]");
  const reportId = openButton?.dataset.reportId ?? row?.dataset.reportId;
  if (reportId) {
    void openSavedReportDraft(reportId);
  }
});

copyReportButton.addEventListener("click", () => {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  const document = currentReportDocument(receipt);
  copyOrDownloadText({
    text: document.markdown,
    filename: document.filename,
    type: "text/markdown",
    button: copyReportButton,
    copiedTitle: "Copied report draft",
    copiedDetail: document.copiedDetail,
    fallbackTitle: "Downloaded report draft",
    fallbackDetail: `${document.label} report was saved as Markdown instead.`
  });
});

downloadReportButton.addEventListener("click", () => {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  const document = currentReportDocument(receipt);
  downloadTextFile(document.filename, document.markdown, "text/markdown");
  addActivity("human", "Downloaded report draft", document.downloadedDetail, "passed");
});

copyTeachingPacketButton.addEventListener("click", () => {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  const markdown = teachingPacketMarkdown(createTeachingPacket(receipt));
  copyOrDownloadText({
    text: `${markdown}\n`,
    filename: `${receipt.runId}-teaching-packet.md`,
    type: "text/markdown",
    button: copyTeachingPacketButton,
    copiedTitle: "Copied teaching packet",
    copiedDetail: `${receipt.runId} teaching packet copied as Markdown.`,
    fallbackTitle: "Downloaded teaching packet",
    fallbackDetail: `${receipt.runId} teaching packet was saved as Markdown instead.`
  });
});

downloadTeachingPacketButton.addEventListener("click", () => {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  downloadTextFile(`${receipt.runId}-teaching-packet.md`, `${teachingPacketMarkdown(createTeachingPacket(receipt))}\n`, "text/markdown");
  addActivity("human", "Downloaded teaching packet", `${receipt.runId} teaching packet saved as Markdown.`, "passed");
});

printReportButton.addEventListener("click", () => {
  state.surface = "report";
  render();
  addActivity("human", "Printed report draft", `${receiptStore.get(state.receiptKey)?.runId ?? "current"} report sent to print dialog.`, "passed");
  setTimeout(() => window.print(), 50);
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.level = button.dataset.level;
    render();
  });
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const problem = promptInput.value.trim();
  if (!problem) {
    return;
  }
  const promptTags = extractPromptTags(problem);
  const problemForApi = problem.replace(/(?:^|\s)#[a-z0-9][a-z0-9-]{1,40}/giu, " ").replace(/\s+/gu, " ").trim() || problem;

  verifyButton.disabled = true;
  verifyButton.textContent = "Verifying";
  addActivity("human", "Submitted prompt", promptTags.length > 0 ? `${problemForApi} (${promptTags.map((tag) => `#${tag}`).join(" ")})` : problemForApi, "passed");
  addActivity("web-ui", "Calling local API", "POST /api/receipt", "waiting");

  try {
    const response = await fetch("/api/receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem: problemForApi })
    });
    const payload = await readLocalApiJson(response, "Local receipt API failed.");
    updateLatestActivity("Calling local API", "passed", localApiSuccessMessage(payload, "POST /api/receipt completed"));

    const viewModel = receiptToViewModel(payload.receipt, payload.route, payload.routePaths, payload.receiptPaths);
    viewModel.tags = uniqueTags([...receiptTags(viewModel), ...promptTags]);
    const key = payload.receipt.runId;
    receiptStore.set(key, viewModel);
    promoteRecentReceiptKey(key);
    setReplayPlaying(false);
    state.receiptKey = key;
    state.level = "middle";
    state.selectedResearchMapSnapshotId = undefined;
    state.selectedResearchMapNodeId = undefined;
    requestVisualFit();
    state.replayIndex = 0;
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
    await refreshRouteLedger({ announce: false });
    await refreshWorkspaceReview({ announce: false });
    await refreshWorkspaceRunNext({ announce: false });
    await refreshWorkspaceGraph({ announce: false });
    await refreshWorkspaceReadiness({ announce: false });
    await refreshWorkspaceEvents({ announce: false });
    addActivity("web-ui", "Rendered receipt", `${payload.receipt.runId} displayed with trace and evidence graph.`, "passed");
  } catch (error) {
    updateLatestActivity("Calling local API", "refuted", "POST /api/receipt failed");
    addActivity("local-api", "Verification failed", error instanceof Error ? error.message : "Unknown API failure.", "refuted");
  } finally {
    verifyButton.disabled = false;
    verifyButton.textContent = "Verify";
    render();
  }
});
