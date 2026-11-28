# Local Proof Dependencies

A proof search can start with an exact Lean declaration rather than a file
name. This local catalog lists candidate proofs, verifies the saved bytes
for the selected dependency closure, and orders the prerequisites for replay.
It does not run a proof checker or confer proof trust.

## Catalog Format

Put `proof-dependencies.json` beside its artifacts, for example in a local
`.truth-harness/experiments/` folder. Use UTF-8 without a BOM.

- `schema_version`: `truth-harness.proof-dependencies.v0`.
- `lean_version`: the shared Lean version, such as `4.36.0`. This is metadata,
  not a probe of the active toolchain.
- `records`: up to 64 records. Each has a unique `id`, an exact, case-sensitive
  Lean `declaration`, and `requires`, an array of up to 16 prerequisite IDs
  in this catalog. Use ASCII-qualified declaration names in this version.
- `challenge`, `solution`, and `receipt`: each record has all three fields.
  Each contains a `file` basename and lower-case `sha256` of the exact file
  bytes. Challenge and solution are separate `.lean` files. A receipt is a
  `.json` file. Paths outside the folder, subfolders, and symlinked artifacts
  are not accepted.

Use a stable local directory. Each file, including the catalog, is capped at
64 KiB. Lookup rejects repeated JSON fields, cycles, missing IDs, duplicate
dependency edges, and conflicting file citations. A challenge digest identifies those exact
source bytes. It does not identify every equivalent formal statement.

## Lookup

From the repository after `npm ci` (or inside the project's Docker image):

```sh
node tools/proof-dependencies.mjs find .truth-harness/experiments/prefix-reuse-handoff adjacent_range_sum
```

Pass `--challenge-sha256 <sha256>` to constrain the match to a pinned reference
statement. The command always emits JSON, with schema
`truth-harness.proof-dependency-lookup.v0`:

| Status | Exit | Meaning |
| --- | ---: | --- |
| `found` | 0 | One match. Its closure matches every saved artifact hash. `replay_order` lists prerequisites before dependents, once each. `fresh_replay_required` is true. |
| `not-found` | 1 | No exact match. |
| `ambiguous` | 1 | Multiple matches. The response lists their IDs and challenge digests, without picking a winner. |
| `invalid` | 2 | Bad arguments, invalid catalog or graph, or a missing, changed or unreadable artifact in the selected closure. |

Lookup will not parse a receipt's trust fields, authenticate the catalog
author, attest unrelated artifacts, infer dependencies from Lean source, or
execute a catalog-provided command. A saved receipt can be wrong or stale
even when its bytes match. Before citing a result as proved, use a trusted,
independently configured replay to check the exact challenge and actual
proof dependencies. This catalog does not feed general proof admission.
