# Hum Math Engine Interface

Truth Harness can serve as an external evidence producer for Hum, but it must not become an optimizer, a cloud dependency, or the source of truth for the compiler. Hum owns program semantics. Truth Harness receives exported obligations, attempts local verification, and returns evidence records Hum may attach to its own reports.

The V0 contract is schema-first and intentionally small. It supports only:

- `allocation_freedom`
- `peak_memory_bound`
- `purity_replayability`

Unknown is a valid result. A verifier that honestly says `unknown` is doing useful safety work.

## Integration Boundary

The intended flow is:

1. Hum compiles source into its semantic graph.
2. Hum exports math obligations and existing evidence.
3. Truth Harness verifies those exported obligations locally.
4. Hum records the returned result as evidence.

The CLI bridge can be:

```bash
truth-harness hum verify .hum/obligations.json --out .hum/evidence/
```

Hum should not depend on Truth Harness for correctness. If Truth Harness is missing, unavailable, or returns `unknown`, Hum must preserve the conservative compiler behavior.

## Input Contract

Schema: `schemas/hum.math_obligation.v0.schema.json`

Each obligation contains:

- `source_span`: the source range Hum wants to annotate.
- `obligation_id`: a stable local identifier.
- `graph_node_id`: the Hum semantic graph node this obligation came from.
- `claim_text`: human-readable claim text.
- `normalized_formal_claim`: the verifier-facing normalized claim.
- `assumptions`: explicit facts and model assumptions used by the claim.
- `allowed_effects`: declared effects visible to the verifier.
- `program_shape`: a conservative computation-shape classification.
- `resource_model`: the machine and allocation model used by the claim.
- `confidence_requested`: the level of evidence requested.
- `timeout_budget`: local compute limits.
- `privacy`: local-only execution constraints.

Every field uses snake_case. JSON files should be UTF-8 without BOM and LF line endings.

## Output Contract

Schema: `schemas/hum.math_result.v0.schema.json`

Result statuses are:

- `proved`
- `refuted`
- `unknown`
- `unsupported`
- `timeout`

`proved` requires a proof certificate or independently checkable trace. LLM-generated prose is never proof.

`refuted` should include a counterexample when possible.

`unknown` is appropriate when the exported facts are insufficient, the shape is too broad, or the required checker is not available.

`unsupported` means the obligation is outside V0 scope.

`timeout` means the local budget expired and no stronger result was earned.

## Evidence Classes

Hum and Truth Harness must keep these evidence classes distinct:

- `theorem`: a cited theorem or accepted formal statement.
- `static_proof`: a compiler or verifier proof over exported program facts.
- `checkable_trace`: replayable local steps.
- `counterexample`: a concrete witness that refutes a claim.
- `benchmark`: measured behavior, not a theorem.
- `model_assumption`: an assumption that narrows the model.
- `heuristic`: useful guidance, never proof.
- `none`: no positive evidence.

Benchmarks and heuristics can guide engineering, but they must not be upgraded into proofs.

## Computation Shapes

Truth Harness should classify shapes conservatively:

| Shape | Strong V0 reasoning | Notes |
| --- | --- | --- |
| `streaming_sequential` | High | Good fit for allocation freedom, peak memory, and replayability. |
| `tree_dag_circuit` | High later | Good future fit for block decomposition and recomputation proofs. |
| `oblivious_random_access` | Medium | Requires explicit deterministic access patterns. |
| `arbitrary_random_access` | Low | Degrade unless bounds and invariants are exported. |
| `pointer_mutation_heavy` | Low | Requires aliasing and ownership evidence before strong claims. |
| `io_effectful` | Low | Replayability requires an explicit environment log. |
| `concurrent` | Low | Requires a scheduler model or model checker. |
| `hardware_specific` | Evidence only | Treat performance claims as target-specific measurements. |

## Williams/Cook-Mertz Boundary

Ryan Williams' 2025 time-space result shows that deterministic multitape Turing machines running in time `t` can be simulated in `O(sqrt(t log t))` space. The proof uses reductions to tree evaluation and Cook-Mertz-style space-efficient tree evaluation ideas.

For Hum, this is architectural inspiration for future lowering passes around:

- block decomposition
- tree evaluation
- recomputation instead of caching
- checkpoint placement
- scratch-region sizing
- profile-guided strategy selection

It is not a generic speedup theorem. Truth Harness must never claim that arbitrary Hum programs become faster or smaller because this theorem exists.

Before Hum enables recomputation-oriented lowering, it should emit proof obligations for:

- deterministic execution
- explicit input and state model
- decomposable computation graph
- replayable block semantics
- bounded scratch regions
- no hidden I/O, randomness, volatile reads, or time dependence

## Hash Table Direction

Hash table support is out of V0, but the interface should be ready for it. Future Hum standard-library hash table obligations should separate:

- collision behavior assumptions
- adversarial input model
- probe length bounds
- memory layout invariants
- resize invariants
- deterministic vs randomized hashing
- DoS resistance
- cache behavior evidence
- safety-critical profile restrictions

Expected `O(1)` behavior under random hashing is not a safety proof. Safety-critical profiles should prefer deterministic worst-case guarantees or explicit bounded-failure behavior.

## Non-Goals

Truth Harness must not:

- claim arbitrary programs get faster
- treat an uncheckable proof as proof
- hide assumptions
- require cloud or network access
- collect telemetry
- treat an LLM answer as proof
- merge theorem, benchmark, static proof, model assumption, and heuristic evidence into one vague confidence score

## Contract Validation CLI

The first CLI bridge is contract-only:

```bash
truth-harness hum validate .hum/obligations.json
truth-harness hum validate .hum/result.json --kind result
truth-harness hum validate - --json
cat .hum/obligations.json | truth-harness hum validate --json
```

Inputs are file paths. `-` means stdin. If no input is provided, the command reads stdin. The command does not run solvers, does not infer truth, does not write evidence, and does not contact the network.

Options:

- `--kind auto`: infer from `schema_version`; this is the default.
- `--kind obligation`: validate against the V0 obligation shape.
- `--kind result`: validate against the V0 result shape.
- `--json`: emit stable machine-readable JSON.
- `--allow-unknown-schema-version`: allow a compatible future Hum schema version to be checked against the selected V0 shape. Without this flag, unknown schema versions are rejected.

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | All inputs are valid. |
| `1` | At least one input is schema-invalid or violates Hum honesty rules. |
| `2` | Tool or I/O failure, such as a missing file or unreadable stdin. |

JSON output shape:

```json
{
  "schema_version": "truth-harness.hum_validate.v0",
  "status": "valid",
  "exit_code": 0,
  "summary": {
    "total": 1,
    "valid": 1,
    "invalid": 0,
    "tool_errors": 0
  },
  "inputs": [
    {
      "source": ".hum/obligations.json",
      "kind": "obligation",
      "schema_version": "hum.math_obligation.v0",
      "valid": true,
      "issues": [],
      "warnings": [],
      "summary": ".hum/obligations.json: valid obligation"
    }
  ],
  "privacy": {
    "local_first": true,
    "network_access": "none",
    "cloud_access": "none",
    "telemetry": "none"
  }
}
```

The validator also enforces semantic honesty rules that are intentionally stricter than plain JSON Schema:

- all fields must be snake_case
- `proved` requires a `proof_certificate` or `checkable_trace`
- benchmarks, heuristics, and model assumptions cannot be treated as proof
- assumptions must cite `source_ref`
- LLM proof text is never accepted as proof
- network, cloud, and telemetry metadata are rejected
- UTF-8 BOM is rejected
## V0 Test Fixtures

Fixtures live in `fixtures/hum/`:

- `proved_allocation_free.json`
- `refuted_allocation_free.json`
- `unknown_pointer_heavy.json`
- `result_proved.json`
- `result_refuted.json`
- `result_unknown.json`

These are contract fixtures, not Hum integration fixtures. They let both projects validate JSON shape and honesty rules before building a deeper bridge.
Invalid fixtures live in `fixtures/hum/invalid/`:

- `unsupported_obligation_type.json`
- `proved_without_certificate.json`
- `camel_case_fields.json`
- `benchmark_treated_as_proof.json`
- `hidden_assumptions.json`
- `network_cloud_metadata.json`

## Roadmap

Prototype:

- Check in V0 schemas and fixtures.
- Validate fixtures in Truth Harness CI.
- Add a CLI command that validates Hum obligation/result JSON without executing any checker.

Alpha:

- Add local static checks for allocation freedom, peak memory, and purity over exported Hum semantic graph facts.
- Return `unknown` for pointer-heavy, I/O-heavy, concurrent, or hardware-specific claims unless sufficient evidence is exported.

Safety-critical readiness:

- Require deterministic builds, stable schema versions, replayable certificates, and external review packets.
- Add audited standard-library profiles.

Long term:

- Add verified lowering evidence for selected tree/DAG/circuit-like shapes.
- Add hash table proof suites.
- Add concurrency and hardware-model lanes only with explicit model checkers and target evidence.
