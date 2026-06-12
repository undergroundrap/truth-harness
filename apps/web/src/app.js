const seedReceipts = {
  rational: {
    trust: "exact-computed",
    title: "3 / 4 + 5 / 8",
    subtitle: "exact arithmetic trace",
    runId: "run_7e1b03d529609565",
    engine: "local-rational-arithmetic",
    replay: 'theorem ask "compute 3 / 4 + 5 / 8" --json',
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
    replay: 'theorem ask "common denominator for 3 / 4 and 5 / 8" --json',
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
    replay: 'theorem ask "for all integers n, n^2+n+1 is even" --json',
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
    replay: 'theorem ask "dimension check force = mass * acceleration" --json',
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
const recentReceiptKeys = ["rational", "denominator", "parity", "dimension"];
const ACTIVITY_PAGE_SIZE = 12;
const NOTES_STORAGE_KEY = "theorem-workbench.session-notes.v0";
const RESEARCHER_NAME_STORAGE_KEY = "theorem-workbench.researcher-name.v0";
const SIDEBAR_WIDTH_STORAGE_KEY = "theorem-workbench.sidebar-width.v0";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "theorem-workbench.sidebar-collapsed.v0";
const SIDEBAR_DEFAULT_WIDTH = 300;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const activityEvents = [];
let activityEventCounter = 0;
const state = {
  receiptKey: "rational",
  level: "middle",
  surface: "trace",
  lane: "math",
  replayIndex: 0,
  replayPlaying: false,
  sidebarQuery: "",
  sidebarCollapsed: false,
  activityQuery: "",
  activityLimit: ACTIVITY_PAGE_SIZE,
  safetyStatus: undefined
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
const laneButtons = document.querySelectorAll(".lane-row");
const laneStatus = document.querySelector("#lane-status");
const traceList = document.querySelector("#trace-list");
const receiptDetails = document.querySelector("#receipt-details");
const graphList = document.querySelector("#graph-list");
const mainGraphList = document.querySelector("#main-graph-list");
const matrixSummary = document.querySelector("#matrix-summary");
const matrixCurrentClaim = document.querySelector("#matrix-current-claim");
const matrixNextCommand = document.querySelector("#matrix-next-command");
const verificationMatrix = document.querySelector("#verification-matrix");
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
const researchNotes = document.querySelector("#research-notes");
const notesStatus = document.querySelector("#notes-status");
const reportPreview = document.querySelector("#report-preview");
const copyReportButton = document.querySelector("#copy-report");
const downloadReportButton = document.querySelector("#download-report");
const printReportButton = document.querySelector("#print-report");
const routeLane = document.querySelector("#route-lane");
const routeProtocol = document.querySelector("#route-protocol");
const routeReceipt = document.querySelector("#route-receipt");
const routeReplay = document.querySelector("#route-replay");
const routeReport = document.querySelector("#route-report");
const openReplayButton = document.querySelector("#open-replay");
const playReplayButton = document.querySelector("#play-replay");
const resetReplayButton = document.querySelector("#reset-replay");
const exportReplayButton = document.querySelector("#export-replay");
const replayFrame = document.querySelector("#replay-frame");
const replayList = document.querySelector("#replay-list");
const replayProgressBar = document.querySelector("#replay-progress-bar");
const inspectorTrust = document.querySelector("#inspector-trust");
const mathCoreList = document.querySelector("#math-core-list");
const replayCommand = document.querySelector(".replay-command");
const answerValue = document.querySelector(".answer-value");
const answerLabel = document.querySelector(".answer-label");
const promptMath = document.querySelector("#prompt-math");
const receiptSummary = document.querySelector(".receipt-summary");
const promptInput = document.querySelector("#prompt-input");
const composer = document.querySelector("#composer");
const verifyButton = document.querySelector("#verify-button");
const taskDockState = document.querySelector("#task-dock-state");
const taskDockSummary = document.querySelector("#task-dock-summary");
const taskList = document.querySelector("#task-list");
const surfaceStatusText = {
  trace: "explainable steps",
  runbook: "agent harness",
  checks: "verification gates",
  graph: "evidence path",
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
    command: "theorem ask --json",
    description: "Problem, output, evidence profile, privacy, artifacts, and replay command are captured.",
    applies: () => true,
    status: (receipt) => receipt.runId && receipt.replay ? "passed" : "missing"
  },
  {
    id: "exact",
    label: "Exact arithmetic trace",
    command: "theorem ask \"compute ...\" --json",
    description: "Arithmetic is represented as exact rationals or integers with replayable steps.",
    applies: (receipt) => /arithmetic|counterexample|parity/u.test(receipt.details["Evidence kind"] ?? receipt.engine),
    status: (receipt) => receipt.engine.includes("rational") || receipt.engine.includes("counterexample") ? "passed" : "missing"
  },
  {
    id: "counterexample",
    label: "Counterexample search",
    command: "theorem ask \"for all ...\" --json",
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
    label: "Symbolic / CAS cross-check",
    command: "npm run demo:symbolic",
    description: "Algebraic transformations need a second symbolic engine or recorded unsupported status.",
    applies: (receipt) => state.lane === "math" || /symbolic|polynomial|equation|algebra/u.test(receipt.title),
    status: (receipt) => /symbolic|cas/u.test(receipt.engine) ? "passed" : "waiting"
  },
  {
    id: "smt",
    label: "SMT solver check",
    command: "theorem smt check --json",
    description: "Bounded logic, satisfiability, and equivalence claims should route through SMT when applicable.",
    applies: (receipt) => state.lane === "math" || /all|exists|integer|constraint|satisf/u.test(receipt.title),
    status: (receipt) => receipt.trust === "smt-checked" || /smt|z3/u.test(receipt.engine) ? "passed" : "waiting"
  },
  {
    id: "proof",
    label: "Lean proof bridge",
    command: "theorem proof check --backend lean",
    description: "Only accepted proof-checker output may mint a formally proved trust label.",
    applies: (receipt) => state.lane === "math" || /proof|theorem|lemma|forall|for all/u.test(receipt.title),
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
    command: "theorem replay <receipt.json>",
    description: "Network, model context, command logs, and replay boundaries must match the receipt.",
    applies: () => true,
    status: (receipt) => (receipt.details.Network ?? "").toLowerCase() === "none" ? "passed" : "waiting"
  },
  {
    id: "paper",
    label: "Paper-ready packet",
    command: "theorem render <receipt.json> markdown",
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
    theorem: "Exact rational arithmetic, traces, counterexamples, units, SymPy adapter, benchmark records.",
    gap: "Broader calculus, plotting, optimization, ODEs, assumptions, and multi-engine CAS cross-checks.",
    next: "Add a typed math router that escalates arithmetic -> symbolic -> SMT/proof -> report packet."
  },
  {
    category: "Open Math Engines",
    compare: "SageMath / SymPy",
    status: "adapter-first",
    theorem: "Uses local adapters and records backend ids, outputs, limits, and replay commands.",
    gap: "Sage, Julia, R, and richer numerical libraries are not first-class adapters yet.",
    next: "Define engine capability manifests and golden tests per adapter."
  },
  {
    category: "Formal Trust",
    compare: "Lean / Coq / Isabelle",
    status: "strict-gate",
    theorem: "Only accepted proof-checker output may mint proved; failed proof attempts stay unverified.",
    gap: "Informal-to-formal statement help, proof search history, and mathlib-aware guidance are early.",
    next: "Make Lean proof attempts a visible chain: statement, attempt, error, repair, accepted artifact."
  },
  {
    category: "Notebooks",
    compare: "JupyterLab",
    status: "gap",
    theorem: "Notebook-run records exist for provenance, but execution is not yet a notebook IDE.",
    gap: "No cell runtime, rich outputs, plots, or file explorer in the web shell.",
    next: "Add notebook/output receipts before adding a full kernel UI."
  },
  {
    category: "Provenance",
    compare: "DVC / DataLad / MLflow",
    status: "ahead",
    theorem: "Claim-level receipts, snapshots, replay commands, activity log, trust labels, and local store.",
    gap: "No large artifact pointer strategy or visual diff/rollback yet.",
    next: "Make claim chains git-like: dependencies, versions, diffs, revert, and bundle export."
  },
  {
    category: "Scientific RAG",
    compare: "PaperQA / literature tools",
    status: "building",
    theorem: "Local source ingest, cite receipts, literature records, model-context and disclosure packets.",
    gap: "No semantic retrieval, DOI enrichment, contradiction detection, or citation-span verifier yet.",
    next: "Promote every cited sentence to a source receipt with entailment and contradiction checks."
  },
  {
    category: "Agent Harness",
    compare: "Claude / Codex alone",
    status: "ahead",
    theorem: "MCP/CLI/API routes, activity log, runbooks, receipts, safety center, reports, local evidence graph.",
    gap: "Front end is not yet a full mirror for every CLI/MCP route.",
    next: "Every CLI command gets a UI route, and every UI action emits the same artifact contract."
  },
  {
    category: "Research Reports",
    compare: "Lab notebooks / paper drafts",
    status: "building",
    theorem: "Printable report drafts include identity, trace, evidence graph, activity citations, and boundaries.",
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
      "A numeric pattern is not a theorem.",
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
addActivity("system", "Local API ready", "UI will submit prompts only to /api/receipt on this machine.", "waiting");
render();
void refreshSafetyStatus();

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
  replayCommand.textContent = receipt.replay;
  receiptSummary.innerHTML = [
    receipt.runId,
    `engine ${receipt.engine}`,
    `trust ${receipt.trust}`,
    ...receiptTags(receipt).map((tag) => `#${tag}`)
  ].map((item) => `<span>${escapeHtml(item)}</span>`).join("");

  receiptDetails.innerHTML = Object.entries(receipt.details)
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");

  graphList.innerHTML = evidenceGraphEntries(receipt)
    .map(([kind, summary]) => `<div class="graph-node"><span>${escapeHtml(kind)}</span><strong>${escapeHtml(summary)}</strong></div>`)
    .join("");
  renderMainGraph(receipt);

  traceList.innerHTML = (receipt.traces[state.level] ?? receipt.traces.middle)
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  document.querySelector(".boundary-list").innerHTML = receipt.limitations
    .map((limitation) => `<li>${escapeHtml(limitation)}</li>`)
    .join("");

  renderClaimList();
  renderActivityLog();
  renderSurface();
  renderLane();
  renderProtocol();
  renderSafetyStatus();
  renderAgentRoutes(receipt);
  renderRunbook(receipt);
  renderVerificationMatrix(receipt);
  renderCapabilityLedger();
  renderTaskDock(receipt);
  renderReplay(receipt);
  renderReport(receipt);
  applySidebarSearch();
  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.level === state.level);
  });
}

function renderClaimList() {
  const query = state.sidebarQuery.trim().toLowerCase();
  const visibleKeys = recentReceiptKeys.filter((key) => {
    const receipt = receiptStore.get(key);
    return receipt && matchesReceiptSearch(receipt, query);
  });

  claimList.innerHTML = visibleKeys.length === 0
    ? `<div class="sidebar-empty">No matching claims.</div>`
    : visibleKeys
    .map((key) => {
      const receipt = receiptStore.get(key);
      return `<button class="claim-row ${key === state.receiptKey ? "active" : ""}" data-receipt="${escapeHtml(key)}" type="button">
        <span class="trust-dot ${trustClass(receipt.trust)}"></span>
        <span>
          <strong>${escapeHtml(receipt.title)}</strong>
          <small>${escapeHtml(receipt.subtitle)}</small>
          ${renderTagPills(receiptTags(receipt).slice(0, 3))}
        </span>
      </button>`;
    })
    .join("");
}

function matchesReceiptSearch(receipt, query) {
  if (!query) {
    return true;
  }

  return [
    receipt.title,
    receipt.subtitle,
    receipt.trust,
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
  return receipt ? `${receipt.title} (${receipt.trust})` : key;
}

function renderSurface() {
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
  surfaceStatus.textContent = surfaceStatusText[state.surface] ?? "local surface";
}

function resetActiveSurfaceScroll() {
  if (state.surface === "runbook") {
    document.querySelectorAll("#surface-runbook details").forEach((details) => {
      details.open = false;
    });
  }
  document.querySelector(`[data-surface-panel="${state.surface}"]`)?.scrollTo({ top: 0, left: 0 });
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

function createRunbookPacket(receipt) {
  const protocol = currentLaneProtocol();
  const routes = agentRouteCommands(receipt);
  const rows = verificationRows(receipt);
  const openGates = rows.filter((row) => ["missing", "waiting"].includes(row.status));
  const satisfiedGates = rows.filter((row) => row.status === "passed");
  const nextAction = openGates[0] ?? rows.find((row) => row.status === "skipped") ?? rows[0];

  return {
    schemaVersion: "theorem.agent-runbook.v0",
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
    satisfiedGates: satisfiedGates.map((row) => row.label),
    openGates: openGates.map((row) => ({
      label: row.label,
      status: statusLabel(row.status),
      command: row.command,
      nextCheck: row.description
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
    ? packet.openGates.map((gate) => `- ${gate.label}: ${gate.status}; run ${gate.command}; ${gate.nextCheck}`).join("\n")
    : "- No open gates. Prepare narrow reviewer packet.";
  return [
    "# Theorem Workbench Agent Runbook",
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
  const counts = rows.reduce((accumulator, row) => {
    accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const nextAction = rows.find((row) => ["missing", "waiting"].includes(row.status)) ?? rows.find((row) => row.status === "skipped") ?? rows[0];

  matrixCurrentClaim.textContent = receipt.title;
  matrixNextCommand.textContent = nextAction?.command ?? receipt.replay;
  matrixSummary.textContent = `${counts.passed ?? 0} passed / ${counts.waiting ?? 0} waiting / ${counts.missing ?? 0} missing`;

  verificationMatrix.innerHTML = rows
    .map((row) => `<article class="matrix-row ${row.status}">
      <span class="task-state ${row.status}"></span>
      <div>
        <div class="matrix-row-head">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(statusLabel(row.status))}</span>
        </div>
        <p>${escapeHtml(row.description)}</p>
        <code>${escapeHtml(row.command)}</code>
      </div>
    </article>`)
    .join("");

  mathCoreList.innerHTML = rows
    .filter((row) => ["exact", "counterexample", "dimension", "symbolic", "smt", "proof", "bench"].includes(row.id))
    .map((row) => `<div class="progress-row">
      <span class="task-state ${row.status}"></span>
      <strong>${escapeHtml(row.label)}</strong>
      <small>${escapeHtml(statusLabel(row.status))}</small>
    </div>`)
    .join("");
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
          <dd>${escapeHtml(row.theorem)}</dd>
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
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Local status API failed.");
    }

    state.safetyStatus = payload;
    renderSafetyStatus();
    addActivity(
      "local-api",
      "Loaded safety center",
      safetyStatusSummary(payload),
      payload.safety?.codeRunSandbox?.canAttestNetworkNone ? "passed" : "waiting"
    );
  } catch (error) {
    state.safetyStatus = {
      error: error instanceof Error ? error.message : "Unknown local status failure."
    };
    renderSafetyStatus();
    addActivity("local-api", "Safety center unavailable", state.safetyStatus.error, "refuted");
  }
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
    return;
  }

  if (payload.error) {
    safetyStatusPill.textContent = "unavailable";
    safetyStatusPill.className = "status-pill refuted";
    safetyDetails.innerHTML = `<div><dt>Status</dt><dd>local API unavailable</dd></div>`;
    safetyNotes.innerHTML = `<li>${escapeHtml(payload.error)}</li>`;
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
  const modelCallState = payload.externalCalls ? "external calls possible" : "none from local API";
  const rows = [
    ["Local API", payload.localOnly ? "local only" : "check config"],
    ["Browser guard", webGuardState],
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

function formatSafetyPhrase(value) {
  return String(value ?? "unknown").replaceAll("-", " ");
}

function verificationRows(receipt) {
  return verificationGateCatalog.map((gate) => {
    const applicable = gate.applies(receipt);
    const status = applicable ? gate.status(receipt) : "skipped";
    return {
      ...gate,
      status
    };
  });
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
    receipt: `theorem ask "${truncateForCommand(receipt.title, 34)}" --json`,
    replay: `theorem replay ${receipt.runId}.json`,
    report: `theorem render ${receipt.runId}.json markdown`
  };
}

function truncateForCommand(value, maxLength) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function applySidebarSearch() {
  const query = state.sidebarQuery.trim().toLowerCase();
  let matched = 0;
  let total = recentReceiptKeys.length;

  document.querySelectorAll(".project-row, .lane-row, .task-row, .progress-row").forEach((row) => {
    total += 1;
    const visible = !query || searchableSidebarText(row).includes(query);
    row.hidden = !visible;
    if (visible) {
      matched += 1;
    }
  });

  matched += claimList.querySelectorAll(".claim-row").length;
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
  const activeFrame = frames[activeIndex];
  const percent = frames.length <= 1 ? 100 : (activeIndex / (frames.length - 1)) * 100;

  playReplayButton.textContent = state.replayPlaying ? "Pause" : "Play";
  replayProgressBar.style.width = `${percent}%`;
  replayFrame.innerHTML = `<span class="task-state ${activeFrame.status}"></span>
    <div>
      <strong>${escapeHtml(activeFrame.title)}</strong>
      <p>${escapeHtml(activeFrame.detail)}</p>
      <small>${escapeHtml(activeFrame.actor)} - ${escapeHtml(activeFrame.kind)}</small>
    </div>`;
  replayList.innerHTML = frames
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
    <text x="42" y="70" fill="#f2f2ee" font-family="Inter, Segoe UI, sans-serif" font-size="30" font-weight="750">Theorem Workbench Session Replay</text>
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
  const tags = receiptTags(receipt).length > 0
    ? [["tags", receiptTags(receipt).map((tag) => `#${tag}`).join(" ")]]
    : [];

  return [...upstream, ...receipt.graph, ...downstream, ...tags];
}

function renderMainGraph(receipt) {
  mainGraphList.innerHTML = evidenceGraphEntries(receipt)
    .map(([kind, summary], index) => `<div class="canvas-node">
      <span class="canvas-index">${index + 1}</span>
      <div>
        <strong>${escapeHtml(kind)}</strong>
        <p>${escapeHtml(summary)}</p>
      </div>
    </div>`)
    .join("");
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

function addActivity(actor, title, detail, status = "passed", at = new Date().toISOString()) {
  activityEvents.unshift({
    id: `activity_${++activityEventCounter}`,
    actor,
    title,
    detail,
    status,
    at
  });
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
  return [event.at, event.status, event.actor, event.title, event.detail].join(" ");
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
    .map((event) => `[${event.at}] ${event.status.toUpperCase()} ${event.actor}: ${event.title} - ${event.detail}`)
    .join("\n");
}

async function copyActivityLog() {
  const text = formatActivityExport(activityEvents);
  await navigator.clipboard.writeText(text);
  const originalText = copyActivityButton.textContent;
  copyActivityButton.textContent = "Copied";
  addActivity("human", "Copied activity log", `${activityEvents.length} events copied to clipboard.`, "passed");
  setTimeout(() => {
    copyActivityButton.textContent = originalText;
  }, 1200);
}

function downloadActivityLog() {
  const payload = {
    schemaVersion: "theorem.web-activity-export.v0",
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
  link.download = `theorem-workbench-activity-${payload.exportedAt.replaceAll(":", "-")}.json`;
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
  await navigator.clipboard.writeText(packet);
  const originalText = copyRunbookButton.textContent;
  copyRunbookButton.textContent = "Copied";
  addActivity("human", "Copied agent runbook", `${receipt.runId} runbook copied for agent handoff.`, "passed");
  setTimeout(() => {
    copyRunbookButton.textContent = originalText;
  }, 1200);
}

function downloadRunbookPacket() {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  downloadTextFile(`${receipt.runId}-agent-runbook.md`, formatRunbookPacket(createRunbookPacket(receipt)), "text/markdown");
  addActivity("human", "Downloaded agent runbook", `${receipt.runId} recursive runbook saved as Markdown.`, "passed");
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
  const mathInput = receipt.math?.input;
  const mathOutput = receipt.math?.output;
  const tags = receiptTags(receipt);
  const dependencies = receiptDependencies(receipt);
  const dependents = dependentReceiptKeys(receipt);
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
    .map((event) => `<li><time datetime="${escapeHtml(event.at)}">${escapeHtml(event.at)}</time> - ${escapeHtml(event.actor)}: ${escapeHtml(event.title)}</li>`)
    .join("");

  reportPreview.innerHTML = `
    <header>
      <h2>${escapeHtml(receipt.title)}</h2>
      <p>${escapeHtml(receipt.subtitle)}</p>
      <p>Researcher: ${escapeHtml(researcher)}. Agent/tooling: Theorem Workbench local evidence session.</p>
    </header>
    <div class="report-math">${renderMathInline(mathInput ?? receipt.title)} <span>&rarr;</span> ${renderMathInline(mathOutput ?? receipt.output)}</div>
    <dl class="report-facts">
      <div><dt>Trust</dt><dd>${escapeHtml(receipt.trust)}</dd></div>
      <div><dt>Output</dt><dd>${escapeHtml(receipt.output)}</dd></div>
      <div><dt>Engine</dt><dd>${escapeHtml(receipt.engine)}</dd></div>
      <div><dt>Run</dt><dd>${escapeHtml(receipt.runId)}</dd></div>
      <div><dt>Researcher</dt><dd>${escapeHtml(researcher)}</dd></div>
      <div><dt>Replay</dt><dd><code>${escapeHtml(receipt.replay)}</code></dd></div>
    </dl>
    <h3>Ledger Metadata</h3>
    <div class="report-tags">${tagItems}</div>
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
  const mathInput = receipt.math?.input ?? receipt.title;
  const mathOutput = receipt.math?.output ?? receipt.output;
  const tags = receiptTags(receipt);
  const dependencies = receiptDependencies(receipt);
  const dependents = dependentReceiptKeys(receipt);
  const lines = [
    `# ${receipt.title}`,
    "",
    `Summary: ${receipt.subtitle}`,
    "",
    "## Authorship and Session Identity",
    "",
    `- Human researcher: ${researcher}`,
    "- Agent/tooling: Theorem Workbench local evidence session",
    "- Identity storage: local browser storage; include stronger signatures before public or legal use",
    "",
    "## Math View",
    "",
    `- Input TeX: \`${mathInput}\``,
    `- Output TeX: \`${mathOutput}\``,
    "",
    "## Receipt",
    "",
    `- Trust: ${receipt.trust}`,
    `- Output: ${receipt.output}`,
    `- Engine: ${receipt.engine}`,
    `- Run ID: ${receipt.runId}`,
    `- Replay: \`${receipt.replay}\``,
    "",
    "## Ledger Metadata",
    "",
    `- Tags: ${tags.length > 0 ? tags.map((tag) => `#${tag}`).join(", ") : "none"}`,
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
    ...activityEvents.slice(0, 20).map((event) => `- [${event.at}] ${event.actor}: ${event.title} - ${event.detail}`)
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

function receiptToViewModel(receipt) {
  const trace = parseTraceArtifact(receipt);
  const outputs = receipt.evidenceProfile.outputs ?? [];
  const primaryOutput = outputs[0] ?? receipt.summary;
  const backend = receipt.evidenceProfile.backends[0]?.id ?? receipt.evidenceProfile.kind;
  const graph = receipt.graph.nodes.map((node) => [node.kind, node.summary]);
  const traces = trace ? tracesFromArithmeticArtifact(trace) : tracesFromReceipt(receipt);
  const backendTags = receipt.evidenceProfile.backends.map((item) => item.id).filter(Boolean);

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
    details: {
      "Evidence kind": receipt.evidenceProfile.kind,
      Backend: receipt.evidenceProfile.backends.map((item) => item.id).join(", ") || "none",
      Output: primaryOutput,
      "Trace steps": trace ? String(trace.steps.length) : String(receipt.graph.nodes.length),
      Network: receipt.privacy.networkAccess,
      "Proof checker": String(receipt.evidenceProfile.proofCheckerBacked)
    },
    graph,
    traces,
    limitations: receipt.evidenceProfile.limitations
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
  const artifact = receipt.artifacts.find((item) => item.kind === "exact-arithmetic-trace");
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

  if (trust === "dimension-checked" || trust === "smt-checked" || trust === "bounded-numeric") {
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
    return `<span class="math-frac"><span>${renderMathInline(numerator)}</span><span>${renderMathInline(denominator)}</span></span>`;
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

researcherNameInput.addEventListener("input", saveResearcherName);

claimList.addEventListener("click", (event) => {
  const button = event.target.closest(".claim-row");
  if (!button) {
    return;
  }

  setReplayPlaying(false);
  state.receiptKey = button.dataset.receipt;
  state.level = "middle";
  state.replayIndex = 0;
  promptInput.value = receiptStore.get(state.receiptKey)?.title ?? promptInput.value;
  render();
  document.querySelector("#surface-checks").scrollTop = 0;
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
  });
});

sidebarSearch.addEventListener("input", () => {
  state.sidebarQuery = sidebarSearch.value;
  renderClaimList();
  applySidebarSearch();
});

openReplayButton.addEventListener("click", () => {
  state.surface = "replay";
  render();
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
    render();
    resetActiveSurfaceScroll();
  });
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

downloadActivityButton.addEventListener("click", downloadActivityLog);

copyRunbookButton.addEventListener("click", () => {
  copyRunbookPacket().catch((error) => {
    addActivity("web-ui", "Copy runbook failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
  });
});

downloadRunbookButton.addEventListener("click", downloadRunbookPacket);

researchNotes.addEventListener("input", saveNotes);

researchNotes.addEventListener("change", () => {
  addActivity("human", "Updated scratchpad", "Local session notes were saved in browser storage.", "passed");
});

copyReportButton.addEventListener("click", () => {
  const receipt = receiptStore.get(state.receiptKey);
  if (!receipt) {
    return;
  }

  navigator.clipboard.writeText(generateReportMarkdown(receipt))
    .then(() => {
      addActivity("human", "Copied report draft", `${receipt.runId} report copied as Markdown.`, "passed");
      copyReportButton.textContent = "Copied";
      setTimeout(() => {
        copyReportButton.textContent = "Copy";
      }, 1200);
    })
    .catch((error) => {
      addActivity("web-ui", "Copy report failed", error instanceof Error ? error.message : "Clipboard write failed.", "refuted");
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
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Local receipt API failed.");
    }
    updateLatestActivity("Calling local API", "passed", "POST /api/receipt completed");

    const viewModel = receiptToViewModel(payload.receipt);
    viewModel.tags = uniqueTags([...receiptTags(viewModel), ...promptTags]);
    const key = payload.receipt.runId;
    receiptStore.set(key, viewModel);
    recentReceiptKeys.unshift(key);
    recentReceiptKeys.splice(6);
    setReplayPlaying(false);
    state.receiptKey = key;
    state.level = "middle";
    state.replayIndex = 0;
    for (const item of payload.activity ?? []) {
      addActivity(item.actor, item.action, item.detail, "passed", item.at);
    }
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
