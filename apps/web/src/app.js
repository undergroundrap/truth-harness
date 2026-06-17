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
  credibilityRunNextPlan: undefined,
  credibilityRunNextLoading: false,
  credibilityRunNextSaving: false,
  credibilityRunNextError: undefined,
  credibilityRunNextPaths: undefined,
  releaseAudit: undefined,
  releaseAuditLoading: false,
  releaseAuditError: undefined,
  workspaceReadiness: undefined,
  catalogStatus: undefined,
  catalogSearch: undefined,
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
const refreshRunNextButton = document.querySelector("#refresh-run-next");
const copyRunNextCommandButton = document.querySelector("#copy-run-next-command");
const researchNotes = document.querySelector("#research-notes");
const notesStatus = document.querySelector("#notes-status");
const credibilityPackPanel = document.querySelector("#credibility-pack-panel");
const reportPreview = document.querySelector("#report-preview");
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
void refreshWorkspaceRunNext({ announce: false });
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
  renderVerificationMatrix(receipt);
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

  routeLedgerStatus.textContent = route ? "persisted locally" : "seed receipt";
  routeLedgerStatus.className = route ? "mini-label route-ledger-status-live" : "mini-label";
  routeLedgerDetails.innerHTML = rows
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${routeLedgerValueHtml(label, value)}</dd></div>`)
    .join("");

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
        return `<button class="route-record ${active ? "active" : ""}" data-route-id="${escapeHtml(route.routeId)}" type="button">
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

  routeHistoryList.querySelectorAll(".route-record").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void openSavedRoute(button.dataset.routeId);
    });
  });
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
    ["Claim", item.claimId],
    ["Session", item.sessionId]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
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
    target.sessionId ? `session:${target.sessionId}` : undefined
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

function applyClaimLedgerPayload(payload) {
  claimLedgerStore.clear();
  for (const claim of payload.claims ?? []) {
    if (claim?.claimId) {
      claimLedgerStore.set(claim.claimId, claim);
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
    if (copyRunNextCommandButton) {
      copyRunNextCommandButton.disabled = false;
    }
    return;
  }

  if (!workspaceRunNextPlan) {
    workspaceRunNextStatus.textContent = "loading";
    workspaceRunNextStatus.className = "status-pill waiting";
    workspaceRunNextTitle.textContent = "Loading local queue plan.";
    workspaceRunNextSummary.textContent = "Truth Harness will ask the local planner for the next safe action without executing it in the browser.";
    workspaceRunNextCommand.textContent = "GET /api/workspace-run-next";
    if (copyRunNextCommandButton) {
      copyRunNextCommandButton.disabled = true;
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
  if (copyRunNextCommandButton) {
    copyRunNextCommandButton.disabled = !command;
  }
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

function workspaceRunNextActivitySummary(plan) {
  if (!plan?.item) {
    return "No open local work item is available.";
  }

  return `Next dry-run item: ${plan.item.title}.`;
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
    return `npm run docker:cli -- smt check ${artifact.sourcePath ?? "<source.smt2>"} --write`;
  }

  if (artifact.status === "solver-unavailable" && artifact.kind === "cas") {
    return `npm run docker:cli -- cas check --operation ${artifact.operation ?? "simplify"} --expression "${truncateForCommand(artifact.expression ?? "<expression>", 48)}" --result "${truncateForCommand(artifact.result ?? "<result>", 32)}" --write`;
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
    ? `npm run docker:cli -- ${command.slice("truth-harness ".length)}`
    : "npm run docker:proof";
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
      payload.verification?.readyCount > 0 ? "passed" : "waiting"
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
  renderReleaseAuditGate();

  try {
    const params = new URLSearchParams({
      mode: "public-review",
      requireAllEngines: "true",
      requireSavedStrictEngineRun: "true",
      requireSandbox: "true",
      timeoutMs: "1500"
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
  if (!force && query.length < 2) {
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
    if (query) {
      params.set("query", query);
    }
    params.set("limit", "8");
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
        localApiSuccessMessage(payload, `${payload.search?.total ?? 0} catalog rows matched ${query || "all indexed artifacts"}.`),
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
  const searchFocused = document.activeElement === sidebarSearch;
  const quietStatus = query.length === 0 && !searchFocused && !state.catalogSearchLoading && !state.catalogError;
  const catalog = state.catalogStatus;
  const results = state.catalogSearch?.results ?? [];
  catalogRebuildButton.disabled = state.catalogRebuildLoading;
  catalogRebuildButton.textContent = state.catalogRebuildLoading ? "Rebuilding" : "Rebuild";
  catalogSearchStatus.textContent = state.catalogSearchLoading
    ? "catalog searching"
    : state.catalogError
      ? "catalog needs attention"
      : catalogStatusSummary(catalog);
  catalogResultList.hidden = false;

  if (quietStatus) {
    catalogResultList.hidden = true;
    catalogResultList.innerHTML = "";
    return;
  }

  if (state.catalogError) {
    catalogResultList.innerHTML = `<div class="sidebar-empty">${escapeHtml(state.catalogError)}</div>`;
    return;
  }

  if (!catalog) {
    catalogResultList.innerHTML = `<div class="sidebar-empty">Checking local catalog status.</div>`;
    return;
  }

  if (!catalog.readable) {
    catalogResultList.innerHTML = `<div class="sidebar-empty">Rebuild the local catalog to search receipts, routes, claims, visuals, and reviews.</div>`;
    return;
  }

  if (catalog.stale) {
    const freshness = catalog.freshness;
    const detail = freshness?.checked
      ? `${freshness.changedArtifacts ?? 0} changed, ${freshness.newArtifacts ?? 0} new, ${freshness.missingArtifacts ?? 0} missing.`
      : "Freshness was not checked.";
    catalogResultList.innerHTML = `<div class="sidebar-empty">Catalog is stale. Rebuild before relying on search completeness. ${escapeHtml(detail)}</div>`;
    return;
  }

  if (query.length < 2) {
    catalogResultList.innerHTML = `<div class="sidebar-empty">Type 2+ characters to search ${catalog.artifactCount ?? 0} indexed artifacts.</div>`;
    return;
  }

  if (state.catalogSearchLoading) {
    catalogResultList.innerHTML = `<div class="sidebar-empty">Searching local catalog.</div>`;
    return;
  }

  catalogResultList.innerHTML = results.length === 0
    ? `<div class="sidebar-empty">No catalog rows match this search.</div>`
    : results.map(catalogResultHtml).join("");
}

function catalogResultHtml(row) {
  const title = row.title || row.summary || row.artifactId || row.path;
  const subtitle = [row.path, row.summary].filter(Boolean).join(" - ");
  return `<button class="catalog-result-row" data-catalog-kind="${escapeHtml(row.kind)}" data-catalog-artifact-id="${escapeHtml(row.artifactId ?? "")}" data-catalog-path="${escapeHtml(row.path)}" type="button">
    <strong>${escapeHtml(title)}</strong>
    <small>${escapeHtml(subtitle || row.kind)}</small>
    <span class="catalog-result-meta">
      <span>${escapeHtml(row.kind)}</span>
      ${row.trust ? `<span>${escapeHtml(row.trust)}</span>` : ""}
      ${row.domain ? `<span>${escapeHtml(row.domain)}</span>` : ""}
    </span>
  </button>`;
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

  addActivity("human", "Opened catalog row", `${artifactId || path || kind} is indexed locally; open the matching artifact from its ledger or CLI path.`, "waiting");
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
    sandbox.reason,
    webServer.recommendation,
    mcp.recommendation,
    ...(Array.isArray(sandbox.notes) ? sandbox.notes : [])
  ].filter(Boolean);
  const notes = noteCandidates.length > 0 ? noteCandidates.slice(0, 3) : ["No local safety metadata was returned."];
  safetyNotes.innerHTML = notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  renderEngineReadinessStatus(payload);
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
  const failedChecks = Array.isArray(audit?.checks)
    ? audit.checks.filter((check) => check.status === "fail")
    : [];
  const warningChecks = Array.isArray(audit?.checks)
    ? audit.checks.filter((check) => check.status === "warn")
    : [];
  const visibleChecks = [...failedChecks, ...warningChecks]
    .filter((check) => check.id !== "adversarial-ai-benchmark")
    .slice(0, 5);
  const nextActions = Array.isArray(audit?.nextActions) ? audit.nextActions.slice(0, 4) : [];
  const benchmarkCard = releaseAuditBenchmarkCardHtml(audit);
  const rows = audit
    ? [
        ["Checks", `${summary.passedChecks ?? 0} pass / ${summary.warningChecks ?? 0} warn / ${summary.failedChecks ?? 0} fail`],
        ["Engines", `${summary.requiredEngineGates ?? "0/5"} required / ${summary.concreteEngineGates ?? "0/5"} concrete`],
        ["Adversarial benchmark", releaseAuditBenchmarkSummary(summary)],
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
    ${benchmarkCard}
    ${checkCards ? `<div class="release-audit-check-grid">${checkCards}</div>` : `<p>No blocking or warning checks returned for this audit scope.</p>`}
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
  releaseAuditGate.querySelector(".copy-release-benchmark-command")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    void copyOrDownloadText({
      button,
      text: `${button.dataset.command ?? releaseAuditBenchmarkCommand(audit)}\n`,
      filename: `truth-harness-adversarial-benchmark-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: "Copied benchmark command",
      copiedDetail: "Adversarial benchmark command copied from the Checks tab.",
      fallbackTitle: "Downloaded benchmark command",
      fallbackDetail: "the adversarial benchmark command was saved as a local text file instead."
    });
  });
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
      <button class="text-button compact-button copy-release-benchmark-command" data-testid="copy-release-benchmark-command" data-command="${escapeHtml(command)}" type="button">Copy benchmark</button>
    </div>
    ${details ? `<ul>${details}</ul>` : ""}
  </section>`;
}

function releaseAuditBenchmarkCommand(audit) {
  return audit?.commands?.adversarialBenchmark ??
    audit?.credibilityPack?.reviewerCommands?.runAdversarialBenchmark ??
    "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures";
}

function releaseAuditBenchmarkSummary(summary) {
  const status = summary?.adversarialBenchmark ?? "missing";
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
  const details = Array.isArray(check.details)
    ? check.details.slice(0, 3).map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")
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

function releaseAuditActivitySummary(audit) {
  if (!audit) {
    return "Release audit did not return a payload.";
  }

  const summary = audit.summary ?? {};
  return `Release audit ${audit.status}; ${summary.blockingFailures ?? 0} blocking failure${summary.blockingFailures === 1 ? "" : "s"}, ${summary.criticalReviewItems ?? 0} critical queue item${summary.criticalReviewItems === 1 ? "" : "s"}.`;
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

  const readiness = payload.verification ?? {};
  const manifest = payload.engineManifest ?? {};
  const evidence = payload.engineVerification ?? {};
  const engines = Array.isArray(readiness.engines) ? readiness.engines : [];
  const totalCount = Number.isFinite(readiness.totalCount) ? readiness.totalCount : engines.length;
  const readyCount = Number.isFinite(readiness.readyCount)
    ? readiness.readyCount
    : engines.filter((engine) => engine.status === "available").length;
  const manifestReadyCount = Number.isFinite(manifest.readyCount) ? manifest.readyCount : 0;
  const manifestTotalCount = Number.isFinite(manifest.totalCount) ? manifest.totalCount : 0;
  const nativeCount = Number.isFinite(manifest.nativeCount) ? manifest.nativeCount : 0;
  const plannedCount = Number.isFinite(manifest.plannedCount) ? manifest.plannedCount : 0;
  const allReady = totalCount > 0 && readyCount === totalCount;
  const anyReady = readyCount > 0;
  const rows = [
    ["Adapters", `${readyCount}/${totalCount} verification backends`],
    ["Manifest", `${manifestReadyCount}/${manifestTotalCount} active capabilities`],
    ["Evidence gate", `${evidence.concretePassed ?? 0}/${evidence.concreteTotal ?? 0} concrete checks`],
    ["Native", `${nativeCount} local kernels`],
    ["Roadmap", `${plannedCount} planned adapters`],
    ...engines.map((engine) => [
      engine.lane ?? engine.displayName ?? "Backend",
      engineReadinessValue(engine)
    ])
  ];

  engineReadinessPill.textContent = allReady ? "all ready" : anyReady ? `${readyCount}/${totalCount} ready` : "install engines";
  engineReadinessPill.className = `status-pill ${allReady ? "exact" : anyReady ? "checked" : "waiting"}`;
  engineReadinessDetails.innerHTML = rows
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`)
    .join("");

  const boundaryNotes = [
    "Status probes do not mint evidence, truth labels, or proof.",
    evidence.evidenceMinted !== undefined
      ? `Concrete engine gate minted ${evidence.evidenceMinted} replayable evidence record${evidence.evidenceMinted === 1 ? "" : "s"}.`
      : undefined,
    ...engines
      .filter((engine) => engine.status !== "available")
      .map((engine) => `${engine.displayName ?? engine.id ?? "Backend"}: ${engine.note ?? "not available"}`),
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
  const verifyCommand = commands.verify ?? "npm run docker:verify";

  if (dockerProfessorCommand) {
    dockerProfessorCommand.textContent = professorCommand;
  }
  if (dockerProofCommand) {
    dockerProofCommand.textContent = proofCommand;
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
  const strictReviewerCommand = "truth-harness engines verify --write --require-all-engines";
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
  if (!sandbox) {
    return "Local status endpoint responded without sandbox metadata.";
  }

  if (sandbox.canAttestNetworkNone) {
    return `Code-run sandbox attested by ${formatSafetyPhrase(sandbox.provider)} with ${formatSafetyPhrase(sandbox.networkIsolation)} network isolation.`;
  }

  return `Code-run sandbox not attested: ${sandbox.reason ?? "no measured sandbox provider"}`;
}

function engineReadinessSummary(payload) {
  const readiness = payload?.verification;
  const manifest = payload?.engineManifest;
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
  const openChecksHtml = claim ? renderClaimOpenChecksHtml(claim) : "";
  const evidenceRefsHtml = claim ? renderClaimEvidenceRefsHtml(claim) : "";
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
      <svg class="git-branch-lines" viewBox="0 0 84 ${branchCanvasHeight(rows.length)}" preserveAspectRatio="none" aria-hidden="true">
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
  return 22 + Math.max(rowCount, 1) * 48;
}

function branchRowY(rowIndex) {
  return 32 + rowIndex * 48;
}

function branchLaneX(lane) {
  return 16 + lane * 16;
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

function renderClaimEvidenceRefsHtml(claim) {
  const refs = Array.isArray(claim?.evidenceRefs) ? claim.evidenceRefs : [];
  if (refs.length === 0) {
    return `<section class="claim-review-panel"><h5>Evidence Refs</h5><p>No local evidence refs attached.</p></section>`;
  }

  return `<section class="claim-review-panel">
    <h5>Evidence Refs</h5>
    <ul>${refs.slice(0, 6).map((ref) => {
      const trust = ref.trust ? ` (${ref.trust})` : "";
      const summary = ref.summary ? ` - ${ref.summary}` : "";
      return `<li><code>${escapeHtml(ref.kind)}:${escapeHtml(ref.ref)}</code>${escapeHtml(trust)}${summary ? `<span>${escapeHtml(summary)}</span>` : ""}</li>`;
    }).join("")}</ul>
  </section>`;
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
    <dl class="credibility-pack-summary">${summaryRows}</dl>
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
  credibilityPackPanel.querySelector(".copy-credibility-benchmark-command")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const benchmarkCommand = credibilityBenchmarkCommand(pack);
    void copyOrDownloadText({
      button,
      text: `${button.dataset.command ?? benchmarkCommand}\n`,
      filename: `truth-harness-adversarial-benchmark-${safeFilenameTimestamp()}.txt`,
      type: "text/plain",
      copiedTitle: "Copied adversarial benchmark",
      copiedDetail: "Adversarial benchmark command copied from the credibility pack.",
      fallbackTitle: "Downloaded adversarial benchmark",
      fallbackDetail: "the adversarial benchmark command was saved as a local text file instead."
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

function credibilityBenchmarkCardHtml(pack) {
  const summary = pack?.summary ?? {};
  const latestRun = pack?.benchmarkLedger?.latestAdversarialRun;
  const receiptReplay = latestRun?.receiptReplays?.[0];
  const status = summary.latestAdversarialBenchmarkStatus ?? "missing";
  const command = latestRun?.replayCommand ?? credibilityBenchmarkCommand(pack);
  const statusClass = status === "passed" ? "exact" : status === "failed" ? "refuted" : "waiting";
  const label = status === "passed" ? "passing" : status === "failed" ? "regression" : "required";
  const detail = status === "passed"
    ? "The saved adversarial suite is passing and can be replayed by a reviewer."
    : status === "failed"
      ? "The latest adversarial suite has failures; fix or triage before professor review."
      : "Run and save the adversarial suite before asking a professor to trust this workspace.";
  const facts = [
    ["Status", status],
    ["Trust accuracy", formatPercent(summary.latestAdversarialBenchmarkAccuracy)],
    ["Saved runs", String(summary.savedBenchmarkRuns ?? 0)],
    ["Latest run", latestRun?.artifactId ?? "none"],
    ["Failed cases", String(latestRun?.failed ?? 0)]
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
      <button class="text-button compact-button copy-credibility-benchmark-command" data-testid="copy-credibility-benchmark-command" data-command="${escapeHtml(command)}" type="button">Copy benchmark</button>
    </div>
  </section>`;
}

function credibilityBenchmarkCommand(pack) {
  return pack?.reviewerCommands?.runAdversarialBenchmark ??
    "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures";
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

function credibilityPackSummaryRows(pack) {
  const summary = pack.summary ?? {};
  return [
    ["Professor ready", summary.professorReady ? "yes" : "blocked"],
    ["Workspace validation", `${summary.validationPassed ? "passed" : "failed"} (${summary.validationErrors ?? 0} errors, ${summary.validationWarnings ?? 0} warnings)`],
    ["Strict engine gates", `${summary.requiredEngineGates ?? "0/0"} required${summary.latestStrictEngineRunStatus ? `, latest saved ${summary.latestStrictEngineRunStatus}` : ""}`],
    ["Engine evidence", `${summary.engineStatus ?? "unknown"} (${summary.concreteEngineGates ?? "0/0"} concrete, ${summary.engineEvidenceMinted ?? 0} evidence records)`],
    ["Adversarial benchmark", `${summary.latestAdversarialBenchmarkStatus ?? "missing"} (${formatPercent(summary.latestAdversarialBenchmarkAccuracy)})`],
    ["Saved engine ledger", `${summary.savedEngineRuns ?? 0} run${summary.savedEngineRuns === 1 ? "" : "s"}`],
    ["Open review queue", `${summary.reviewItems ?? 0} items (${summary.criticalReviewItems ?? 0} critical, ${summary.highReviewItems ?? 0} high)`],
    ["Snapshot", `${summary.snapshotFiles ?? 0} files, ${formatBytes(summary.snapshotBytes ?? 0)}`],
    ["Pack ID", pack.packId]
  ];
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

  return `${pack.status}; validation ${pack.summary.validationPassed ? "passed" : "failed"}, engines ${pack.summary.requiredEngineGates}, benchmark ${pack.summary.latestAdversarialBenchmarkStatus ?? "missing"}, queue ${pack.summary.reviewItems} item${pack.summary.reviewItems === 1 ? "" : "s"}.`;
}

function renderReport(receipt) {
  if (!receipt) {
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
    if (nextSurface === "report" && !state.credibilityPack && !state.credibilityPackLoading) {
      void refreshCredibilityPack({ announce: false });
    }
    if (nextSurface === "report" && !state.credibilityRunNextPlan && !state.credibilityRunNextLoading) {
      void refreshCredibilityRunNext({ announce: false });
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

refreshRunNextButton?.addEventListener("click", () => {
  void refreshWorkspaceRunNext();
});

copyRunNextCommandButton?.addEventListener("click", () => {
  copyWorkspaceRunNextCommand().catch((error) => {
    addActivity("web-ui", "Copy next action failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
  });
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

copyReportButton.addEventListener("click", () => {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  const markdown = generateReportMarkdown(receipt);
  copyOrDownloadText({
    text: markdown,
    filename: `${receipt.runId}-report.md`,
    type: "text/markdown",
    button: copyReportButton,
    copiedTitle: "Copied report draft",
    copiedDetail: `${receipt.runId} report copied as Markdown.`,
    fallbackTitle: "Downloaded report draft",
    fallbackDetail: `${receipt.runId} report was saved as Markdown instead.`
  });
});

downloadReportButton.addEventListener("click", () => {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  downloadTextFile(`${receipt.runId}-report.md`, generateReportMarkdown(receipt), "text/markdown");
  addActivity("human", "Downloaded report draft", `${receipt.runId} report saved as Markdown.`, "passed");
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
