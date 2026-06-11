const seedReceipts = {
  rational: {
    trust: "exact-computed",
    title: "3 / 4 + 5 / 8",
    subtitle: "exact arithmetic trace",
    runId: "run_7e1b03d529609565",
    engine: "local-rational-arithmetic",
    replay: 'theorem ask "compute 3 / 4 + 5 / 8" --json',
    output: "11/8",
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
  parity: {
    trust: "refuted",
    title: "for all integers n, n^2+n+1 is even",
    subtitle: "counterexample found",
    runId: "run_df379de5f447a5c6",
    engine: "finite-counterexample-search",
    replay: 'theorem ask "for all integers n, n^2+n+1 is even" --json',
    output: "n=-20, value=381",
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
const recentReceiptKeys = ["rational", "parity", "dimension"];
const ACTIVITY_PAGE_SIZE = 12;
const NOTES_STORAGE_KEY = "theorem-workbench.session-notes.v0";
const activityEvents = [];
let activityEventCounter = 0;
const state = {
  receiptKey: "rational",
  level: "middle",
  surface: "trace",
  activityQuery: "",
  activityLimit: ACTIVITY_PAGE_SIZE
};

const claimList = document.querySelector("#claim-list");
const traceList = document.querySelector("#trace-list");
const receiptDetails = document.querySelector("#receipt-details");
const graphList = document.querySelector("#graph-list");
const mainGraphList = document.querySelector("#main-graph-list");
const activityLog = document.querySelector("#activity-log");
const activitySearch = document.querySelector("#activity-search");
const activityCount = document.querySelector("#activity-count");
const activityShowMore = document.querySelector("#activity-show-more");
const copyActivityButton = document.querySelector("#copy-activity");
const downloadActivityButton = document.querySelector("#download-activity");
const surfaceTabs = document.querySelectorAll(".surface-tab");
const surfacePanels = document.querySelectorAll("[data-surface-panel]");
const surfaceStatus = document.querySelector("#surface-status");
const researchNotes = document.querySelector("#research-notes");
const notesStatus = document.querySelector("#notes-status");
const reportPreview = document.querySelector("#report-preview");
const copyReportButton = document.querySelector("#copy-report");
const downloadReportButton = document.querySelector("#download-report");
const printReportButton = document.querySelector("#print-report");
const inspectorTrust = document.querySelector("#inspector-trust");
const replayCommand = document.querySelector(".replay-command");
const answerValue = document.querySelector(".answer-value");
const answerLabel = document.querySelector(".answer-label");
const receiptSummary = document.querySelector(".receipt-summary");
const promptInput = document.querySelector("#prompt-input");
const composer = document.querySelector("#composer");
const verifyButton = document.querySelector("#verify-button");
const surfaceStatusText = {
  trace: "explainable steps",
  graph: "evidence path",
  notes: "local scratchpad",
  report: "printable draft"
};

researchNotes.value = loadNotes();
updateNotesStatus("local draft");
addActivity("system", "Workbench opened", "Static shell loaded; no external service contacted.", "passed");
addActivity("system", "Local API ready", "UI will submit prompts only to /api/receipt on this machine.", "waiting");
render();

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
  answerValue.textContent = receipt.output;
  answerLabel.textContent = receipt.trust === "refuted" ? "counterexample" : "verified output";
  replayCommand.textContent = receipt.replay;
  receiptSummary.innerHTML = [
    receipt.runId,
    `engine ${receipt.engine}`,
    `trust ${receipt.trust}`
  ].map((item) => `<span>${escapeHtml(item)}</span>`).join("");

  receiptDetails.innerHTML = Object.entries(receipt.details)
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");

  graphList.innerHTML = receipt.graph
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
  renderReport(receipt);
  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.level === state.level);
  });
}

function renderClaimList() {
  claimList.innerHTML = recentReceiptKeys
    .map((key) => {
      const receipt = receiptStore.get(key);
      return `<button class="claim-row ${key === state.receiptKey ? "active" : ""}" data-receipt="${escapeHtml(key)}" type="button">
        <span class="trust-dot ${trustClass(receipt.trust)}"></span>
        <span>
          <strong>${escapeHtml(receipt.title)}</strong>
          <small>${escapeHtml(receipt.subtitle)}</small>
        </span>
      </button>`;
    })
    .join("");
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

function renderMainGraph(receipt) {
  mainGraphList.innerHTML = receipt.graph
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

  const notes = researchNotes.value.trim();
  const graphItems = receipt.graph
    .map(([kind, summary]) => `<li><strong>${escapeHtml(kind)}</strong>: ${escapeHtml(summary)}</li>`)
    .join("");
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
    </header>
    <dl class="report-facts">
      <div><dt>Trust</dt><dd>${escapeHtml(receipt.trust)}</dd></div>
      <div><dt>Output</dt><dd>${escapeHtml(receipt.output)}</dd></div>
      <div><dt>Engine</dt><dd>${escapeHtml(receipt.engine)}</dd></div>
      <div><dt>Run</dt><dd>${escapeHtml(receipt.runId)}</dd></div>
      <div><dt>Replay</dt><dd><code>${escapeHtml(receipt.replay)}</code></dd></div>
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
  const notes = researchNotes.value.trim() || "No local notes added yet.";
  const lines = [
    `# ${receipt.title}`,
    "",
    `Summary: ${receipt.subtitle}`,
    "",
    "## Receipt",
    "",
    `- Trust: ${receipt.trust}`,
    `- Output: ${receipt.output}`,
    `- Engine: ${receipt.engine}`,
    `- Run ID: ${receipt.runId}`,
    `- Replay: \`${receipt.replay}\``,
    "",
    "## Evidence Path",
    "",
    ...receipt.graph.map(([kind, summary], index) => `${index + 1}. ${kind}: ${summary}`),
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

  return {
    trust: receipt.trust,
    title: receipt.problem,
    subtitle: receipt.summary,
    runId: receipt.runId,
    engine: backend,
    replay: receipt.replay,
    output: primaryOutput,
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

claimList.addEventListener("click", (event) => {
  const button = event.target.closest(".claim-row");
  if (!button) {
    return;
  }

  state.receiptKey = button.dataset.receipt;
  state.level = "middle";
  promptInput.value = receiptStore.get(state.receiptKey)?.title ?? promptInput.value;
  addActivity("human", "Selected receipt", `Opened ${state.receiptKey} from recent claims.`, "passed");
  render();
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
    addActivity("human", "Changed work surface", `Opened ${state.surface} view.`, "passed");
    render();
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
    addActivity("human", "Changed explanation level", `Viewing ${state.level} trace details.`, "passed");
    render();
  });
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const problem = promptInput.value.trim();
  if (!problem) {
    return;
  }

  verifyButton.disabled = true;
  verifyButton.textContent = "Verifying";
  addActivity("human", "Submitted prompt", problem, "passed");
  addActivity("web-ui", "Calling local API", "POST /api/receipt", "waiting");

  try {
    const response = await fetch("/api/receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Local receipt API failed.");
    }
    updateLatestActivity("Calling local API", "passed", "POST /api/receipt completed");

    const viewModel = receiptToViewModel(payload.receipt);
    const key = payload.receipt.runId;
    receiptStore.set(key, viewModel);
    recentReceiptKeys.unshift(key);
    recentReceiptKeys.splice(6);
    state.receiptKey = key;
    state.level = "middle";
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
