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
const activityEvents = [];
const state = {
  receiptKey: "rational",
  level: "middle"
};

const claimList = document.querySelector("#claim-list");
const traceList = document.querySelector("#trace-list");
const receiptDetails = document.querySelector("#receipt-details");
const graphList = document.querySelector("#graph-list");
const activityLog = document.querySelector("#activity-log");
const inspectorTrust = document.querySelector("#inspector-trust");
const replayCommand = document.querySelector(".replay-command");
const answerValue = document.querySelector(".answer-value");
const answerLabel = document.querySelector(".answer-label");
const receiptSummary = document.querySelector(".receipt-summary");
const promptInput = document.querySelector("#prompt-input");
const composer = document.querySelector("#composer");
const verifyButton = document.querySelector("#verify-button");

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

  traceList.innerHTML = (receipt.traces[state.level] ?? receipt.traces.middle)
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  document.querySelector(".boundary-list").innerHTML = receipt.limitations
    .map((limitation) => `<li>${escapeHtml(limitation)}</li>`)
    .join("");

  renderClaimList();
  renderActivityLog();
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

function renderActivityLog() {
  activityLog.innerHTML = activityEvents
    .slice(0, 8)
    .map((event) => `<div class="activity-row">
      <span class="task-state ${event.status}"></span>
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        <small>${escapeHtml(event.actor)} - ${escapeHtml(event.detail)}</small>
      </div>
    </div>`)
    .join("");
}

function addActivity(actor, title, detail, status = "passed") {
  activityEvents.unshift({
    actor,
    title,
    detail,
    status,
    at: new Date().toISOString()
  });
  if (activityLog) {
    renderActivityLog();
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
      addActivity(item.actor, item.action, item.detail, "passed");
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
