# Theorem Workbench Credibility And Growth Strategy

Date: 2026-06-08

## Product Promise

Theorem Workbench should not present itself as an AI oracle. The credible promise is:

> Turn AI math into auditable proof, computation, citation, replay, and benchmark artifacts.

That is still huge. It means Claude, Codex, and other agents can explore, calculate, formalize, refute, cite, explain, and replay math without the user having to trust model vibes.

The public subtitle should be:

> Verified Math for AI Agents

## Why This Can Be Serious

The serious version is not "an LLM that solves everything." It is a workbench that coordinates existing trusted systems:

- Proof assistants for certainty when formal proof is possible.
- CAS and exact arithmetic for symbolic computation.
- SMT solvers and finite counterexample search for refutation.
- Rigorous numerics for bounded numerical claims.
- RAG with citation spans for literature and definitions.
- Benchmarks that measure the whole pipeline, including failures.

DeepMind's 2026 AI co-mathematician paper points in the same direction: a stateful workbench for iterative mathematical workflows, including literature search, computational exploration, theorem proving, theory building, uncertainty tracking, and failed hypothesis tracking. Theorem Workbench should be the open, agent-native, proof-receipt version of that idea.

## Respect Contract

What we can say:

- "Auditable math for AI agents."
- "Proof receipts for AI-generated math."
- "A benchmark harness for verified reasoning workflows."
- "A workbench for exploring, checking, refuting, and teaching math."
- "Native CLI/MCP integration for Claude, Codex, and local agents."

What we should not say until earned:

- "Solves any math problem."
- "Discovers new mathematics automatically."
- "A truth oracle."
- "A better WolframAlpha."
- "Solves the world's problems."

The aspirational sentence is:

> Theorem Workbench helps researchers and learners turn mathematical ideas into replayable evidence trails.

## Minimum Credibility Bar

If we want real mathematicians and physicists to take it seriously, the system needs these rules from day one:

1. Every final answer has a trust label.
2. `proved` only means a proof checker accepted it.
3. `exact-computed` only means exact arithmetic or symbolic computation produced a replayable result.
4. `bounded-numeric` only means the output includes precision, interval/error bounds, and assumptions.
5. `dimension-checked` only means physical dimensions/units are consistent, not that the model is true.
6. `source-cited` only means retrieved source spans directly support the claim.
7. `unverified` is a first-class outcome, not an embarrassment.
8. False claims must be benchmarked, not hidden.
9. Failed proof attempts should be inspectable because they teach the next move.
10. Long runs must checkpoint and replay.
11. The benchmark suite must punish fluent wrong answers harder than humble uncertainty.

For physics, add these requirements before claiming physics competence:

- Unit and dimensional analysis on every physical formula.
- Explicit coordinate systems, sign conventions, and domains.
- Constants with source/version metadata.
- Numerical methods with tolerance, stability notes, and residual checks.
- Independent cross-checks when a result matters.

## Viral Wedges

The viral version should spread because it is useful and legible, not because it overpromises.

1. Paste any AI math answer and get a proof receipt.
2. Shareable theorem cards: claim, trust label, replay command, evidence graph, and counterexample if false.
3. "AI math hallucination audit" posts that test popular models on tricky but fair problems.
4. A public `false-claims-100` benchmark where models lose points for confident nonsense.
5. A GitHub Action that checks Markdown, notebooks, or docs for replayable math claims.
6. A Claude/Codex MCP demo where the agent asks Theorem Workbench to verify its own subclaims.
7. A verified lesson mode where students can click each step and see the tool/proof behind it.

The first launch headline should be something like:

> I built a proof-receipt machine for AI math answers.

That is concrete, memorable, and defensible.

## First Serious Demos

Demo 1: Hallucination receipt

- Input: a plausible but false theorem.
- Output: `refuted`, with a counterexample and replay command.
- Why it matters: shows we are not just beautifying answers.

Demo 2: Exact computation receipt

- Input: a symbolic integral, recurrence, or algebraic identity.
- Output: normalized problem, exact CAS output, independent check, explanation.
- Why it matters: useful immediately for students and engineers.

Demo 3: Conservative local-check receipt

- Input: `for all integers n, n^2+n is even`.
- Output: an `exact-computed` receipt with a local modular parity certificate over `n mod 2`, plus a finding that this is not proof-checker-backed.
- Why it matters: shows the trust policy is real before the full Lean adapter lands. The system refuses to call a homemade checker `proved`.

Demo 4: Physics sanity receipt

- Input: a dimensional formula or unit conversion with hidden mistakes.
- Output: unit analysis, corrected formula or refutation, assumptions.
- Why it matters: physicists care deeply about assumptions and units.

Demo 5: Bounded numeric receipt

- Input: `bound x^2 + 2*x + 1 for x in [0, 2]`.
- Output: `bounded-numeric`, conservative interval output, and assumptions.
- Why it matters: bridges from pure math into simulations and engineering calculations without pretending the bound is tighter than it is.

Demo 6: Benchmark report

- Input: same suite run through different model/tool profiles.
- Output: trust accuracy, refutation rate, proof success, replay stability, cost, latency.
- Why it matters: turns the project into infrastructure, not a toy.

## Community Strategy

Earn trust by being useful to existing communities:

- Cite prior art prominently.
- Integrate Lean, Mathlib, SageMath, SymPy, Z3, cvc5, and rigorous numeric tools instead of rebuilding them.
- Open-source the benchmark format and seed suites.
- Publish failures and limitations.
- Make adapters small enough for experts to review.
- Accept "this is not verified" as a product win when that is the truth.
- Contribute fixes or docs upstream when integrations reveal issues.

The first expert-facing post should avoid hype. A better structure:

1. What problem Theorem Workbench solves.
2. What it refuses to claim.
3. How trust labels work.
4. How to replay a result.
5. Where it fails today.
6. How mathematicians/physicists can break it.

## World Problem Path

The route to real impact is not "ask AI to solve the world." It is reducing the cost of trustworthy technical reasoning.

High-value wedges:

- Education: verified step-by-step math learning from arithmetic to proof.
- Engineering: unit-safe calculations, formula checks, and technical documentation audits.
- Research: theorem search, failed-hypothesis tracking, proof attempt replay, literature-grounded notes.
- AI evaluation: benchmarking agents on proof, refutation, exactness, and citation grounding.
- Scientific software: reproducible calculation receipts attached to docs, notebooks, and papers.

If the workbench makes thousands of small technical claims easier to check, the compounding effect is real.

## Build Implications

Before coding, lock these product decisions:

- The evidence graph is the core product.
- Benchmarking is first-class, not a later feature.
- MCP is an adapter surface, not the whole identity.
- The CLI must be excellent because it is the shared spine for humans, agents, tests, and CI.
- The web app should inspect evidence, not just chat.
- The default posture is counterexample-first for universal claims.
- Every feature must support replay, diff, or export.

## Sources

- [AI co-mathematician: Accelerating mathematicians with agentic AI](https://arxiv.org/abs/2605.06651)
- [Lean programming language and proof assistant](https://lean-lang.org/)
- [Lean community and Mathlib](https://leanprover-community.github.io/)
- [LeanDojo: Theorem Proving with Retrieval-Augmented Language Models](https://arxiv.org/abs/2306.15626)
- [ProofGrader and ProofBench](https://proofgrader.github.io/)
- [SageMath](https://www.sagemath.org/)
- [SymPy](https://www.sympy.org/)
- [WolframAlpha APIs](https://products.wolframalpha.com/api)
- [Model Context Protocol server concepts](https://modelcontextprotocol.io/docs/learn/server-concepts)
- [Arb rigorous ball arithmetic](https://arblib.org/index.html)
- [SymPy unit systems](https://docs.sympy.org/latest/modules/physics/units/index.html)
