# Theorem Workbench Parity Ledger

Date: 2026-06-12

This ledger turns "make it better than existing tools" into product gates. Theorem Workbench should not claim superiority by vibe. It should earn it by matching the best tools where they are already excellent, then adding the local-first evidence layer they do not share.

## Naming Decision

Use **Theorem Workbench** as the public product name.

- **Keep:** Theorem Workbench is clear, serious, search-descriptive, and honest about being a working environment rather than an oracle.
- **Avoid:** Do not brand the public product as only "Theorem." It is too generic, competes with theorem-prover terminology, and is weaker for search and trademark distinctiveness.
- **Shorthand:** `theorem` is fine as the CLI command and internal shorthand.
- **Positioning:** "Theorem Workbench" should mean a local-first research IDE for verifiable claims, not a chatbot or black-box answer engine.

## Parity Targets

| Area | Existing leader | Parity bar | Theorem Workbench edge | Next engineering gate |
| --- | --- | --- | --- | --- |
| Computed answers | WolframAlpha / Mathematica | Natural math input, interpreted input, exact/symbolic/numeric answers, plots, assumptions, step summaries. | Receipts, trust labels, replay commands, local privacy, agent logs, explicit uncertainty. | Typed math router: exact arithmetic, symbolic, SMT, proof, units, benchmark, report. |
| Open math | SageMath / SymPy | Broad algebra, calculus, number theory, combinatorics, numerical methods, plotting, package ecosystem. | Adapter-first architecture with evidence profiles instead of pretending one engine is truth. | Engine manifests, version capture, capability probes, golden tests, and fallback explanations. |
| Formal proof | Lean / Coq / Isabelle | Concrete proof objects accepted by a trusted checker. | Strict `proved` label policy and proof-attempt receipts for failed, partial, and accepted artifacts. | Make Lean attempts visible as statement -> attempt -> error -> repair -> accepted chain. |
| Notebooks | JupyterLab | Files, notebooks, code/prose/output, rich media, kernels, extensions, export. | Notebook output becomes evidence with provenance and trust boundaries instead of a free-floating artifact. | Observed notebook-run records with input/output hashes before a full kernel UI. |
| Provenance | DVC / DataLad / MLflow | Dataset/file versioning, pipelines, experiments, metrics, plots, reproducibility. | Claim-level evidence graph with receipts, snapshots, activity log, model context, and reports. | Git-like claim chains: dependencies, versions, diffs, revert, bundle export. |
| Scientific RAG | PaperQA-style literature tools | Local or indexed corpus search, citations, metadata, answer history. | Citations become evidence receipts and cannot upgrade a claim beyond source support. | Citation-span verifier, contradiction checks, DOI metadata, reusable indexes. |
| Lab record | eLabFTW-style notebooks | Identity, timestamps, signatures, export, permissions, protocols. | Computation, proof, RAG, simulation, and agent actions share one local evidence ledger. | Signed finalized reports and reviewer packets with artifact bundles. |
| Agent workflow | Claude / Codex alone | Strong model reasoning, code execution, search, file edits, chat memory. | Agent actions flow through local receipts, safety status, MCP/CLI/API routes, and human-readable review surfaces. | Full frontend parity for every CLI/MCP route with identical artifact contracts. |

## Launch Rule

Theorem Workbench can say it is "stronger" only in the narrow claim it can demonstrate:

> It is stronger than using AI chat alone for serious math or research because it forces claims through replayable local evidence, trust labels, model-context disclosure, validation gaps, and exportable review packets.

It should not claim to beat WolframAlpha, SageMath, Lean, JupyterLab, or PaperQA at their own core job until the matching parity bar is implemented and benchmarked.

## Near-Term Moat

The first hard moat is not breadth. It is the chain:

1. A claim is parsed into a narrow typed statement.
2. The smallest local verifier runs first.
3. Every tool result becomes a receipt.
4. Every model request has an inspectable context packet.
5. Every open gap is visible before the next step.
6. Every final report cites receipts, sources, assumptions, limitations, and replay commands.
7. Agents can operate through CLI/MCP/API while humans can inspect the same state in the app.

That is the missing layer between answer engines, proof assistants, notebooks, and AI agents.

## Sources To Recheck During Public Launch

- WolframAlpha: https://www.wolframalpha.com/about/
- Wolfram: https://www.wolfram.com/mathematica/
- SageMath: https://www.sagemath.org/
- SymPy: https://www.sympy.org/en/index.html
- Lean: https://lean-lang.org/
- JupyterLab: https://jupyterlab.readthedocs.io/en/stable/
- DataLad: https://www.datalad.org/
- DVC: https://dvc.org/doc
- MLflow: https://mlflow.org/docs/latest/
- eLabFTW: https://www.elabftw.net/
- PaperQA: https://github.com/Future-House/paper-qa
