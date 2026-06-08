import type { Artifact, EvidenceEdge, GraphNode, Receipt } from "./types.js";

export type ReceiptRenderFormat = "markdown" | "html";

export function renderReceipt(receipt: Receipt, format: ReceiptRenderFormat): string {
  if (format === "markdown") {
    return renderReceiptMarkdown(receipt);
  }

  return renderReceiptHtml(receipt);
}

export function renderReceiptMarkdown(receipt: Receipt): string {
  const lines: string[] = [
    `# Theorem Receipt ${receipt.runId}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Schema | \`${escapeMarkdownTable(receipt.schemaVersion)}\` |`,
    `| Created | ${escapeMarkdownTable(receipt.createdAt)} |`,
    `| Trust | \`${escapeMarkdownTable(receipt.trust)}\` |`,
    `| Replay | \`${escapeMarkdownTable(receipt.replay)}\` |`,
    "",
    "## Problem",
    "",
    escapeMarkdownText(receipt.problem),
    "",
    "## Summary",
    "",
    escapeMarkdownText(receipt.summary),
    ""
  ];

  if (receipt.findings.length > 0) {
    lines.push("## Findings", "");
    for (const finding of receipt.findings) {
      lines.push(`- \`${finding.level}\`: ${escapeMarkdownText(finding.message)}`);
    }
    lines.push("");
  }

  lines.push(
    "## Evidence Graph",
    "",
    "| Node | Kind | Trust | Summary |",
    "| --- | --- | --- | --- |",
    ...receipt.graph.nodes.map(renderNodeMarkdown),
    "",
    "## Edges",
    "",
    "| From | Relation | To |",
    "| --- | --- | --- |",
    ...receipt.graph.edges.map(renderEdgeMarkdown),
    ""
  );

  if (receipt.artifacts.length > 0) {
    lines.push("## Artifacts", "");
    for (const artifact of receipt.artifacts) {
      lines.push(...renderArtifactMarkdown(artifact));
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderReceiptHtml(receipt: Receipt): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Theorem Receipt ${escapeHtml(receipt.runId)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f7f8fb;
      --fg: #1b1f24;
      --muted: #5b6472;
      --line: #d9dee7;
      --panel: #ffffff;
      --accent: #0f766e;
      --danger: #b42318;
      --warn: #9a6700;
      --code: #f1f3f7;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111318;
        --fg: #f4f6fa;
        --muted: #a6afbd;
        --line: #303746;
        --panel: #191d25;
        --accent: #5eead4;
        --danger: #ffb4a8;
        --warn: #f2cc60;
        --code: #242a35;
      }
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }
    h1, h2, h3 {
      line-height: 1.2;
      margin: 0 0 12px;
    }
    h1 {
      font-size: 30px;
    }
    h2 {
      font-size: 20px;
      margin-top: 30px;
    }
    h3 {
      font-size: 16px;
      margin-top: 18px;
    }
    p {
      margin: 0 0 12px;
    }
    code {
      background: var(--code);
      border-radius: 4px;
      padding: 1px 5px;
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 0.92em;
    }
    pre {
      overflow-x: auto;
      background: var(--code);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
    }
    pre code {
      background: transparent;
      padding: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0 18px;
      background: var(--panel);
    }
    th, td {
      border: 1px solid var(--line);
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-weight: 600;
    }
    .summary {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 18px;
      margin-top: 18px;
    }
    .trust {
      display: inline-block;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 10px;
      color: var(--accent);
      font-weight: 700;
    }
    .trust.refuted {
      color: var(--danger);
    }
    .trust.unverified {
      color: var(--warn);
    }
    .muted {
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main>
    <h1>Theorem Receipt <code>${escapeHtml(receipt.runId)}</code></h1>
    <div class="summary">
      <p><span class="trust ${escapeHtml(receipt.trust)}">${escapeHtml(receipt.trust)}</span></p>
      <p>${escapeHtml(receipt.summary)}</p>
      <p class="muted">Replay: <code>${escapeHtml(receipt.replay)}</code></p>
    </div>

    <h2>Problem</h2>
    <p>${escapeHtml(receipt.problem)}</p>

    ${renderFindingsHtml(receipt)}
    ${renderGraphHtml(receipt.graph.nodes, receipt.graph.edges)}
    ${renderArtifactsHtml(receipt.artifacts)}
  </main>
</body>
</html>
`;
}

function renderNodeMarkdown(node: GraphNode): string {
  return [
    `\`${escapeMarkdownTable(node.id)}\``,
    escapeMarkdownTable(node.kind),
    `\`${escapeMarkdownTable(node.trust)}\``,
    escapeMarkdownTable(node.summary)
  ].join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function renderEdgeMarkdown(edge: EvidenceEdge): string {
  return [
    `\`${escapeMarkdownTable(edge.from)}\``,
    escapeMarkdownTable(edge.label),
    `\`${escapeMarkdownTable(edge.to)}\``
  ].join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function renderArtifactMarkdown(artifact: Artifact): string[] {
  const language = artifact.mimeType === "application/json" ? "json" : "";
  const fence = codeFenceFor(artifact.content);

  return [
    `### ${artifact.id}`,
    "",
    `- Kind: \`${artifact.kind}\``,
    `- MIME: \`${artifact.mimeType}\``,
    "",
    `${fence}${language}`,
    artifact.content,
    fence,
    ""
  ];
}

function renderFindingsHtml(receipt: Receipt): string {
  if (receipt.findings.length === 0) {
    return "";
  }

  return `<h2>Findings</h2>
    <ul>
      ${receipt.findings
        .map((finding) => `<li><code>${escapeHtml(finding.level)}</code>: ${escapeHtml(finding.message)}</li>`)
        .join("\n      ")}
    </ul>`;
}

function renderGraphHtml(nodes: GraphNode[], edges: EvidenceEdge[]): string {
  return `<h2>Evidence Graph</h2>
    <table>
      <thead><tr><th>Node</th><th>Kind</th><th>Trust</th><th>Summary</th></tr></thead>
      <tbody>
        ${nodes
          .map(
            (node) =>
              `<tr><td><code>${escapeHtml(node.id)}</code></td><td>${escapeHtml(node.kind)}</td><td><code>${escapeHtml(node.trust)}</code></td><td>${escapeHtml(node.summary)}</td></tr>`
          )
          .join("\n        ")}
      </tbody>
    </table>

    <h2>Edges</h2>
    <table>
      <thead><tr><th>From</th><th>Relation</th><th>To</th></tr></thead>
      <tbody>
        ${edges
          .map(
            (edge) =>
              `<tr><td><code>${escapeHtml(edge.from)}</code></td><td>${escapeHtml(edge.label)}</td><td><code>${escapeHtml(edge.to)}</code></td></tr>`
          )
          .join("\n        ")}
      </tbody>
    </table>`;
}

function renderArtifactsHtml(artifacts: Artifact[]): string {
  if (artifacts.length === 0) {
    return "";
  }

  return `<h2>Artifacts</h2>
    ${artifacts
      .map(
        (artifact) => `<h3>${escapeHtml(artifact.id)}</h3>
    <p class="muted">Kind: <code>${escapeHtml(artifact.kind)}</code> MIME: <code>${escapeHtml(artifact.mimeType)}</code></p>
    <pre><code>${escapeHtml(artifact.content)}</code></pre>`
      )
      .join("\n    ")}`;
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function codeFenceFor(content: string): string {
  const runs = content.match(/`+/g) ?? [];
  const longest = Math.max(2, ...runs.map((run) => run.length));
  return "`".repeat(longest + 1);
}
