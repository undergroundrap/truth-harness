# Trust Labels

Date: 2026-06-10

Theorem Workbench trust labels describe what local evidence currently supports. They are not confidence vibes, model opinions, or marketing claims.

## Labels

| Label | Meaning | Boundary |
| --- | --- | --- |
| `proved` | Accepted by Lean or another accepted proof-checking backend. | Do not mint this from a homemade checker, CAS output, notebook output, RAG hit, simulation, or model answer. |
| `exact-computed` | Exact arithmetic, exact symbolic computation, or a narrow deterministic local check produced a replayable result. | This can support a narrow claim, but it is not a proof-checker-backed proof. |
| `bounded-numeric` | A numeric result is bounded by explicit interval/error assumptions. | The true value must be inside the stated bound under the stated assumptions; it is not a physical or scientific validation. |
| `smt-checked` | Z3 checked a concrete SMT-LIB artifact and returned a replayable `sat` or `unsat` result, with solver identity and output recorded. | This is solver evidence for the encoded constraints, not a Lean-style proof, not proof of the informal problem statement, and not evidence beyond the encoding. |
| `dimension-checked` | Local dimensional analysis found consistent units/dimensions. | This checks units, not whether the equation or model is physically true. |
| `source-cited` | Local retrieval found cited source material relevant to the claim. | Retrieval is not entailment; humans or stronger checks must decide whether the source actually supports the claim. |
| `cross-checked` | Multiple independent trusted tools agree on a normalized result. | For symbolic CAS today, this requires a concrete independent Maxima agreement record in addition to the SymPy result. It is still not proof-checker-backed proof. |
| `unverified` | The claim is unsupported, out of scope, or only partially checked. | This is a valid outcome and should be preserved instead of hidden. |
| `refuted` | A counterexample, contradiction, mismatch, failed check, or solver model invalidates the claim under the stated assumptions. | Refutations should include the counterexample or failing evidence whenever possible. |

## Current MVP Policy

The local modular parity checker emits `exact-computed`, not `proved`. It can attach a certificate showing the two residue classes modulo 2, but `proved` is reserved for accepted proof-checking backends such as Lean.

`theorem proof backends` and the MCP `theorem_proof_backends` tool report local proof-checker availability without network access. A successful Lean version probe means this machine may be able to check Lean proof artifacts; it does not prove any theorem, and it never mints a `proved` receipt by itself.

`theorem proof check <file>` and the MCP `theorem_proof_check` tool run a concrete local Lean source file through Lean when the backend is available. Use `--write` or MCP `write: true` to store a local `theorem.proof-check.v0` JSON record plus Markdown report under `.theorem-workbench/proofs/`; `theorem proof list` and `theorem_proof_list` expose those paths for audits and agent follow-up. Only `status: accepted` produces `trust: proved` and `proofCheckerBacked: true`. Missing Lean, execution errors, syntax errors, incomplete proofs, and rejected proof attempts remain `unverified`; they do not refute the theorem by themselves.

Route obligations and claim-ledger evidence promotion parse proof-check, CAS-check, and SMT-check records strictly before trusting them. A hand-written or malformed JSON file that merely says `trust: proved`, `trust: cross-checked`, or `trust: smt-checked` is unresolved evidence, not proof, independent verification, or solver evidence.

Verifier routes are work orders, not proof objects. Claim-ledger promotion only treats a `route:` evidence ref as finalization-supporting evidence when the route readiness gate says it is ready for a narrow claim. If a route still has open obligations, the claim keeps the route attached as `unverified` evidence and copies the route readiness blocker into the claim finalization boundary.

`theorem smt backends` and the MCP `theorem_smt_backends` tool report local Z3 availability without network access. A successful Z3 version probe means this machine may be able to check SMT-LIB artifacts; it does not check any constraint file and never mints `smt-checked` by itself.

`theorem smt check <file>` and the MCP `theorem_smt_check` tool run a concrete local SMT-LIB source file through Z3 when the backend is available. Use `--write` or MCP `write: true` to store a local `theorem.smt-check.v0` JSON record plus Markdown report under `.theorem-workbench/smt/`; `theorem smt list` and `theorem_smt_list` expose those paths for audits and agent follow-up. Only `status: sat` or `status: unsat` produces `trust: smt-checked`. Missing Z3, execution errors, `unknown`, and unrecognized solver output remain `unverified`.

`theorem smt solve --int x --constraint "x > 0"` and the MCP `theorem_smt_solve` tool generate SMT-LIB from explicit structured integer constraints and store the generated `.smt2` file locally before checking it. This is not broad natural-language translation; humans and agents must review the generated SMT-LIB and its assumptions.

When a satisfiable SMT check includes `(get-model)`, Theorem Workbench may parse Z3 `define-fun` bindings into structured JSON. Parsed model bindings are a convenience for review, replay, and follow-up constraints; the raw solver stdout remains part of the record, and the binding list is still only evidence about the encoded SMT-LIB artifact.

Every receipt includes an `evidenceProfile` with the evidence kind, backend ids, backend roles, versions when available, inputs, outputs, replayability, proof-checker status, and limitations. Agents should read this field before relying on a trust label.

Symbolic CAS receipts use SymPy as the primary local symbolic adapter. When Maxima is available through `THEOREM_MAXIMA` or `maxima`, Theorem also runs an independent symbolic equality check and may upgrade a symbolic result to `cross-checked` only when Maxima agrees. Missing Maxima, unparseable output, execution errors, or disagreement do not upgrade trust; a disagreement leaves the symbolic claim `unverified` until resolved by a stronger checker or human review.

Receipt JSON is runtime-validated before replay, rendering, evidence audits, and discovery packages use it. Invalid or legacy receipt files must be treated as unresolved evidence, not downgraded-but-trusted claims.

Workspace validation scans receipts for schema failures, non-local-first privacy metadata, missing backend records, and `proved` labels without accepted proof-checker metadata. It also checks known workspace JSON records, including proof-check, SMT-check, and code-run records, against their checked-in JSON Schema contracts, expected artifact ids, resolvable local evidence refs, and approval/disclosure linkage before agents rely on sent or received external-context records.

CAS output, notebook output, code-run stdout/stderr, simulations, RAG hits, and hosted model responses are evidence artifacts. They are not truth by themselves. A code-run record proves only that a local direct process was launched and captured under the recorded command, cwd, timeout, environment boundary, output limit, sandbox measurement, and execution-policy decision. Native host code-run records must say `networkAccess: unknown`; the Docker no-network profile may say `networkAccess: none` only when the runtime measures the Theorem container marker, a container runtime marker, loopback-only networking, and no default route. Workflows that require isolation should set `requireSandbox` and accept a fail-closed result when no sandbox provider is available. MCP agents cannot request unsandboxed code execution unless the server operator enables both `THEOREM_ALLOW_CODE_RUN=1` and `THEOREM_ALLOW_UNSANDBOXED_CODE_RUN=1`.

Exact arithmetic receipts include deterministic trace artifacts with every local rational-arithmetic step plus middle-school, high-school, college, and expert explanation views. Those explanations are teaching aids derived from the machine trace; if a natural-language explanation ever conflicts with the trace, the trace is authoritative.

Biomedical, safety, regulatory, patent, and scientific discovery claims require explicit validation gates and human expert review before stronger language is allowed.
