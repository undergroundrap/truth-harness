const receipts = {
  rational: {
    trust: "exact-computed",
    title: "3 / 4 + 5 / 8",
    runId: "run_7e1b03d529609565",
    engine: "local-rational-arithmetic",
    replay: 'theorem ask "compute 3 / 4 + 5 / 8" --json',
    details: {
      "Evidence kind": "exact-arithmetic",
      "Backend": "local-rational-arithmetic",
      "Output": "11/8",
      "Trace steps": "7",
      "Network": "none",
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
    }
  },
  parity: {
    trust: "refuted",
    title: "n^2+n+1 is even",
    runId: "run_df379de5f447a5c6",
    engine: "finite-counterexample-search",
    replay: 'theorem ask "for all integers n, n^2+n+1 is even" --json',
    details: {
      "Evidence kind": "universal-parity",
      "Backend": "finite-counterexample-search",
      "Output": "n=-20, value=381",
      "Search range": "-20..20",
      "Network": "none",
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
    }
  },
  dimension: {
    trust: "dimension-checked",
    title: "force = mass * acceleration",
    runId: "run_dimension_sample",
    engine: "local-dimensional-analysis",
    replay: 'theorem ask "dimension check force = mass * acceleration" --json',
    details: {
      "Evidence kind": "dimension-analysis",
      "Backend": "local-dimensional-analysis",
      "Output": "M L T^-2",
      "Matched": "true",
      "Network": "none",
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
    }
  }
};

const state = {
  receiptKey: "rational",
  level: "middle"
};

const traceList = document.querySelector("#trace-list");
const receiptDetails = document.querySelector("#receipt-details");
const graphList = document.querySelector("#graph-list");
const inspectorTrust = document.querySelector("#inspector-trust");
const replayCommand = document.querySelector(".replay-command");
const answerValue = document.querySelector(".answer-value");
const answerLabel = document.querySelector(".answer-label");
const receiptSummary = document.querySelector(".receipt-summary");
const promptInput = document.querySelector("#prompt-input");
const composer = document.querySelector("#composer");

function render() {
  const receipt = receipts[state.receiptKey];
  document.querySelector(".session-title h2").textContent = receipt.title;
  document.querySelector(".status-pill").textContent = receipt.trust;
  document.querySelector(".status-pill").className = `status-pill ${trustClass(receipt.trust)}`;
  inspectorTrust.textContent = receipt.trust;
  inspectorTrust.className = `status-pill ${trustClass(receipt.trust)}`;
  answerValue.textContent = receipt.details.Output;
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

  traceList.innerHTML = receipt.traces[state.level]
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  document.querySelectorAll(".claim-row").forEach((button) => {
    button.classList.toggle("active", button.dataset.receipt === state.receiptKey);
  });
  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.level === state.level);
  });
}

function trustClass(trust) {
  if (trust === "refuted") {
    return "refuted";
  }

  if (trust === "dimension-checked") {
    return "checked";
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

document.querySelectorAll(".claim-row").forEach((button) => {
  button.addEventListener("click", () => {
    state.receiptKey = button.dataset.receipt;
    state.level = "middle";
    promptInput.value = receipts[state.receiptKey].title;
    render();
  });
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.level = button.dataset.level;
    render();
  });
});

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = promptInput.value.toLowerCase();
  if (value.includes("force")) {
    state.receiptKey = "dimension";
  } else if (value.includes("n^2") || value.includes("even")) {
    state.receiptKey = "parity";
  } else {
    state.receiptKey = "rational";
  }
  state.level = "middle";
  render();
});

render();
