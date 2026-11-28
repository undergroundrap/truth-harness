# Held-Out CS Proof Reuse

This experiment compares a small candidate proof catalog with no candidate
artifacts. It starts after the exploratory automata trial and uses five new,
synthetic cases: two unweighted routing problems, signed exact range queries,
a false lower bound, and a weighted routing claim outside the unit-edge model.
It uses the [fixed Lean pilots](LEAN_PROOF_LANE.md#independent-checker-pilot),
not general workspace proof admission.

## Freeze And Collect

Prepare trusted local images from a clean checkout. Provisioning may download
build dependencies; all plan, scoring, and proof containers run offline.

```sh
docker build --target dev -t truth-harness:cs-proof-reuse-judge .
docker build --platform linux/amd64 -f tools/lean-prefix-check.Dockerfile -t truth-harness:cs-proof-reuse-lean .
PROOF_IMAGE_ID=$(docker image inspect truth-harness:cs-proof-reuse-lean --format '{{.Id}}')
docker run --pull=never --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges truth-harness:cs-proof-reuse-judge node tools/cs-proof-reuse.mjs plan "$PROOF_IMAGE_ID"
```

Keep the plan locally as the preregistration. It binds the exact suite, scorer,
and replay runner hashes, the checker source/dependency-lock bundle, and every
individual prompt hash, plus the exact Lean image ID chosen before any solve.
In PowerShell, use `$PROOF_IMAGE_ID = docker image inspect
truth-harness:cs-proof-reuse-lean --format '{{.Id}}'` on one line.
Planning checks the
frozen expected answers using edge relaxation and direct integer slice sums,
not the proposed proof artifacts. Deliver only the `prompt` text from one plan
row to a fresh agent. Never give the agent the suite, oracle, other rows, or
previous responses. Use the same model and settings, one response per row, no
tools, no retries, and the same 2,048-byte output limit. Randomization across a
larger sample is future work; this fixed experiment is small and paired.

Keep raw outputs, failed attempts, and run notes in the ignored
`.truth-harness/` store. Form a JSON object with schema version
`truth-harness.cs-proof-reuse-trials.v3`, the plan's four top-level SHA-256
fields, `proof_image_id`, and `bindings`. Each binding contains `case_id`, `arm`,
`prompt_sha256`, and `response` (raw response text or `null` if missing).
Do not manually repair malformed agent answers. Keep the run configuration and
the reported failures with the packet. Trial prompts are synthetic; no project
or user data is needed by the solving agents.

## Replay And Interpret

```sh
node tools/cs-proof-reuse-replay.mjs .truth-harness/cs-proof-reuse/plan.json .truth-harness/cs-proof-reuse/trials.json
```

The host command only orchestrates Docker. It pipes data into the read-only
judge image with no mounts, then runs each eligible fixed proof at most once
in a separate network-disabled, read-only Lean container. Use trusted locally
built images; optional third and fourth arguments select judge and Lean images.
Agents cannot supply executable commands, image names or Lean source. The
runner checks the actual exit and receipts against the committed proof sources
and expected comparator configuration. Supply the trusted original local
preregistration as a separate input. The runner resolves and records the
actual image IDs, refuses a different Lean image, and runs by ID. Keep the
pinned Lean image for replay; replacing it requires a new preregistration.
`status: scored` does not attest to a proof:
`proof_replay_status` is `not_requested`, `accepted`, or `incomplete` (exit 1).
A malformed or mismatched packet exits 2. An ordinary
wrong answer does not fail a replay command; it is scored in the report.

The report separates answer correctness, matching model choice, eligibility
and selection of a supplied artifact, accepted instance checks, and successful
reference replay. The model score is a structured applicability decision, not
an evaluation of the quality of an explanation. Replaying the theorem does
not prove the graph conversion, the parser, the agent, or the instance checker.
Claim verdict and scope are independent. A cheaper route can refute the
weighted claim while the unit-edge theorem is inapplicable and no artifact is
selected. A correct reference answer and checked counterexample get answer
credit even when the optional distance-label field is missing or malformed.
The stricter instance check still gates proof requests and rejects numbers
that are not canonical nonnegative integer literals. The weighted case neither admits hop labels
as a certificate nor obtains a general weighted optimality proof.

This is a comparison of the evidence available to a fresh agent under a fixed
packet protocol. The no-tools instruction is procedural isolation, not an
adversarial host sandbox. The evaluator executes replay, not the model. The
control arm can solve cases and submit certificates, but has no supplied Lean
artifact and cannot submit new Lean code in this experiment. A replay advantage
under these constraints is not evidence of better general reasoning or new
theorem discovery. Saved trial responses can be rescored from a clean checkout;
fresh model responses need not reproduce word for word.

The earlier protocol trials and the wording-only scope follow-up are separate
local records. Their results are not changed by this protocol.
