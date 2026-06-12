# Theorem Workbench Competitive Research

Date: 2026-06-12

## Summary

Theorem Workbench should not try to be a prettier WolframAlpha or another chat app. The serious opportunity is a local-first verification workbench that lets humans and agents route claims through reproducible engines, receipts, citations, proof checks, simulations, and replayable reports.

The market already has excellent pieces:

- WolframAlpha: computed answers from curated knowledge and algorithms.
- JupyterLab: notebooks, files, terminals, outputs, and extensible scientific workspaces.
- SageMath and SymPy: open symbolic/numeric math engines we should integrate instead of replacing.
- Lean and Mathlib: formal proof checking and a growing digital foundation for mathematics.
- DataLad, DVC, MLflow, REANA, Renku: provenance, datasets, experiment tracking, pipelines, reusable analyses.
- eLabFTW: electronic lab notebook discipline, timestamps, signatures, permissions, and export.
- PaperQA2 and adjacent scientific RAG tools: literature retrieval with cited answers.

No obvious product combines all of these into a local-first, agent-operable, receipt-first research IDE where every AI action, computation, citation, proof attempt, and report section has a replayable trail. That is the wedge.

## Landscape

| Tool class | What exists | What to borrow | What Theorem Workbench must add |
| --- | --- | --- | --- |
| Computational answer engines | WolframAlpha frames itself as a system for making knowledge computable and answering free-form queries with built-in data, algorithms, and methods. | Natural input, clear interpreted-input display, step/result summaries, broad domain coverage. | Local-first projects, open receipts, agent trace logs, proof/simulation provenance, and no black-box truth claims. |
| Open math systems | SageMath is GPL software that combines many open-source math packages behind a Python-based interface. SymPy is a Python symbolic math library that can be embedded in apps. | Use engines through adapters: exact arithmetic, symbolic algebra, plots, number theory, optimization, units, differential equations. | A trust layer that records which engine ran, what input was used, what version/config ran, and whether a result is proof, computation, heuristic, or conjecture. |
| Formal proof ecosystems | Lean is an open-source programming language and proof assistant for formally verified code; Mathlib is building a digital foundation for math with documentation and AI-assisted contribution goals. | Treat formal proof checkers as high-trust gates; preserve proof objects and checker output. | A workflow that helps non-experts move from informal claim to typed statement to failed attempts to accepted proof without pretending every computation is a theorem. |
| Notebook/workspace IDEs | JupyterLab is an extensible notebook authoring and editing environment where notebooks combine code, prose, visualization, and controls. | Files, notebooks, kernels, terminals, export, command palette, extension architecture, workspace ergonomics. | Unified evidence ledger, agent runbook, trust labels, receipt graph, replay, model-context packet transparency, and lane-specific review protocols. |
| Provenance/data platforms | DataLad tracks data, structure, reproducibility, collaboration, provenance, and large files. DVC focuses on data/model versioning, pipelines, metrics, plots, and experiments. | Git-like project history, dataset/file versioning, large artifact pointers, pipeline DAGs, diffable experiments. | Human-friendly receipt UX, model privacy disclosures, math/proof/simulation engines, and publishable research packets. |
| Reproducible analysis platforms | REANA describes, runs, preserves, and reuses analyses with workflow engines, containers, and scalable backends. Renku connects data, code, compute, and people. | Containerized replay, workflow manifests, cloud/local execution targets, reproducible output bundles. | Local-first default, direct agent controls, claim-level trust status, per-step receipts, and approachable review surfaces. |
| Lab notebooks | eLabFTW supports experiments/protocols, search, collaboration, signatures, timestamps, FAIR exports, permissions, and open formats. | Research identity, timestamps, signatures, exportable lab records, permission boundaries. | Computational verification and AI-context receipts built into the record rather than bolted on after the fact. |
| Scientific RAG | PaperQA2 targets high-accuracy RAG over scientific documents with cited answers, metadata awareness, CLI usage, reusable indexes, and manifest files. | Local corpora, source manifests, citation spans, literature metadata, answer history search. | Require citations to become evidence receipts, distinguish source support from experimental proof, and route claims into math/proof/simulation gates. |

## Product Thesis

Theorem Workbench is the verification IDE for AI-assisted research.

The app should feel like Codex for serious research, but the primary unit is not a chat message. The primary unit is a claim with receipts:

- claim
- assumptions
- lane protocol
- evidence profile
- exact inputs
- engine outputs
- source citations
- proof/simulation status
- model context disclosed
- replay commands
- unresolved gaps
- final report sections

This turns Claude, Codex, local models, and future frontier systems into workers inside a reproducible research harness instead of opaque answer machines.

The unique layer is the claim ledger. Theorem should not claim that its first-party engines are better than specialized CAS, proof assistants, notebooks, or RAG systems. The claim is stronger and more defensible: Theorem coordinates those engines into local claim records with dependencies, supersession, trust labels, verifier ladders, and reportable evidence trails that agents can query through CLI/MCP.

See [PARITY_LEDGER.md](PARITY_LEDGER.md) for the current scored parity targets, launch rule, and naming decision. The short version: keep **Theorem Workbench** as the public name, use `theorem` as the CLI shorthand, and do not claim the product beats specialized tools until the matching parity gate is implemented and benchmarked.

## Differentiators

1. Local-first by default: projects, papers, receipts, notebooks, RAG indexes, reports, and replay logs live on the user's machine unless explicitly exported.
2. Receipt-first UX: every result carries provenance, limitations, trust labels, and replay commands.
3. Engine adapters, not reinvention: call SymPy, Sage, Lean, SMT solvers, CAS tools, Python/R/Julia notebooks, simulators, and workflow engines through typed backends.
4. Agent-operable and human-readable: CLI/API/MCP coverage mirrors the front end; agents can work for hours while humans see exactly what happened.
5. Lane-specific protocols: math, physics, biology, chemistry, hardware, finance, policy, writing, and code should each have distinct evidence standards while sharing the same receipt model.
6. Publishable outputs: every session can become a reviewer packet with sources, artifacts, limitations, signatures, and enough replay data for peer review.

## What To Adapt Immediately

1. JupyterLab-style workspace ergonomics: files, notebooks, terminal/task panes, command palette, searchable sessions, and compact panels.
2. DataLad/DVC-style project history: versioned project folder, artifact manifest, large-file strategy, diffs, rollback, and provenance graph.
3. PaperQA-style local corpus indexes: manifest files, metadata, citations, answer history, and reusable indexes.
4. eLabFTW-style identity and signatures: researcher name, timestamps, signed finalized reports, export formats, and audit log.
5. REANA-style execution manifests: container/image, command, inputs, outputs, environment, and replay target for every code/simulation run.
6. Lean/Sage/SymPy adapters: make them first-class engines with strict trust labels and regression fixtures.

## What Not To Do

- Do not market this as "AI that discovers truth." Market it as infrastructure for checking, falsifying, reproducing, and documenting claims.
- Do not hand-roll symbolic math, proof checking, or literature retrieval when strong engines exist.
- Do not let model text upgrade a claim's trust level without an engine receipt.
- Do not hide privacy behavior. A model-context packet must show exactly what left the machine.
- Do not treat medicine, patents, finance, or safety-critical domains as solved because the app produced a polished report.

## Near-Term Build Priorities

1. Fix the code execution threat model before any demo: no unsandboxed agent-reachable execution, no false network receipts.
2. Make the front end a complete CLI mirror: every CLI action should have a front-end route and every front-end action should emit the same receipt.
3. Make math excellent first: exact arithmetic, symbolic algebra, units, assumptions, CAS cross-checks, SMT checks, Lean proofs, and regression suites.
4. Build the project ledger: project folder, claim records, receipts, artifacts, notes, model-context packets, activity log, and report exports.
5. Add source/RAG lane: local paper ingestion, citation receipts, source manifests, quote boundaries, contradiction checks, and literature review reports.
6. Add replay/export: session playback, full activity download, report markdown/PDF, artifact bundle, and reviewer checklist.

## Sources

- WolframAlpha About: https://www.wolframalpha.com/about/
- JupyterLab documentation: https://jupyterlab.readthedocs.io/en/stable/
- SageMath: https://www.sagemath.org/
- SymPy: https://www.sympy.org/en/index.html
- Lean: https://lean-lang.org/
- Mathlib Initiative: https://mathlib-initiative.org/
- DataLad: https://www.datalad.org/
- DVC docs: https://doc.dvc.org/
- MLflow docs: https://mlflow.org/docs/latest/index.html
- REANA: https://www.reana.io/
- Renku docs: https://docs.renkulab.io/en/latest/
- eLabFTW: https://www.elabftw.net/
- PaperQA2: https://github.com/Future-House/paper-qa
