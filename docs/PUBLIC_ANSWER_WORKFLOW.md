# Public Answer Workflow

Updated: 2026-07-03

This workflow is for turning a solved, refuted, or bounded public math prompt into a shareable answer without pretending Truth Harness is magic. The goal is not to spam forums. The goal is to make every public answer traceable: source, assumptions, verifier boundary, receipts, replay commands, and limitations.

Use this when a researcher, teacher, agent, or maintainer wants to answer a public problem and link back to a reproducible evidence packet.

The normal test suite checks every packet under `docs/public-answers/` for source metadata, review status, trust labels, replay commands, and boundary language.

## Posting Rule

Post only when all of these are true:

1. The source URL is stable and cited.
2. The answer is your own work or a legitimate response to an open problem thread.
3. The packet says whether the result is `exact-computed`, `cross-checked`, `refuted`, `smt-checked`, `proved`, or `unverified`.
4. Every trust label is earned by a replayable local receipt, benchmark, proof-check, SMT check, CAS check, or explicit boundary.
5. The answer includes the checker boundary and does not claim more than the strongest evidence supports.

Do not post:

- answers to active homework or exams,
- unsupported AI-generated explanations,
- medical, legal, financial, safety, or patent conclusions as if the software validated them,
- `proved` claims unless an accepted proof checker minted that label,
- forum comments that are only self-promotion.

## Answer Packet Fields

Every public answer packet should include:

- `source`: public URL, title, author/site if known, and access date.
- `question`: the original problem statement or a faithful paraphrase.
- `normalized claim`: the exact claim Truth Harness checked.
- `answer`: the human-readable answer.
- `trust label`: the strongest label earned.
- `evidence`: receipt ids, benchmark suite ids, CAS/SMT/proof records, report refs, and near-miss refutations.
- `replay`: commands that reproduce the result.
- `boundary`: what the verifier did and did not check.
- `review status`: `draft`, `self-reviewed`, `external-review-needed`, `corrected`, or `withdrawn`.
- `posting status`: `not-posted`, `posted`, `superseded`, or `do-not-post`.

## Recommended Commands

```bash
npm run docker:public-catalog
npm run docker:public-probes
npm run docker:public-symbolic
truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json --handoff
```

For a single symbolic identity:

```bash
npm run docker:cli -- cas check -- --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write
truth-harness verify "For real x, sin(x)^2 + cos(x)^2 = 1." --write --json
```

The Docker commands are the preferred public credibility path. Native commands are acceptable for iteration, but public answer packets should say whether Docker replay passed.

## Review Ladder

Use the lowest honest status:

| Status | Meaning |
| --- | --- |
| `draft` | Packet is being assembled. Do not post externally. |
| `self-reviewed` | Maintainer reviewed source, replay, trust label, and boundary. Okay for low-risk educational answers. |
| `external-review-needed` | The claim is advanced, broad, medical/scientific, safety-relevant, or theorem-level. Do not present as final. |
| `corrected` | A previous public packet or answer was corrected. Link the correction. |
| `withdrawn` | The packet should no longer be cited. Explain why. |

## Answer Template

```markdown
# Public Answer: <short title>

Date: YYYY-MM-DD
Status: draft
Posting status: not-posted
Review status: self-reviewed

## Source

- URL:
- Title:
- Accessed:

## Question

<Original problem or faithful paraphrase.>

## Normalized Claim

<Exact claim routed through Truth Harness.>

## Answer

<Human-readable answer.>

## Evidence

- Trust label:
- Receipt refs:
- Benchmark suite:
- Near-miss refutation:

## Replay

    <commands>

## Boundary

<What was checked, what was not checked, and what would upgrade the label.>

## Public Reply Draft

<Short answer suitable for a forum, classroom, or issue thread.>
```

## Why This Matters

Truth Harness should earn trust by being useful and modest at the same time. A public answer packet is not marketing copy. It is a receipt-backed artifact that lets someone else rerun the work, inspect the boundary, and decide whether the result is strong enough for their use.
