# Truth Harness Provenance Storage Strategy

Date: 2026-06-21

## Goal

Truth Harness needs a storage model that serious researchers and autonomous agents can trust before the project scales into harder math, science, simulation, or engine-grade domains.

The storage goal is not merely "save files." The goal is to make every local artifact inspectable, hashable, replayable where possible, and connected to the claim or validation gate that depends on it.

## Current Source Of Truth

Canonical workspace artifacts are local JSON and sidecar files under `.truth-harness/`.

Examples:

- receipts in `.truth-harness/receipts/`
- claims in `.truth-harness/claims/`
- verifier routes in `.truth-harness/routes/`
- validation plans in `.truth-harness/validation/`
- proof, SMT, CAS, benchmark, notebook, code-run, visual, report, and review records in their manifest-owned directories
- workspace snapshots in `.truth-harness/snapshots/`

These artifacts are the durable evidence layer. They are schema-validated before write where writers support it, written atomically, and meant to be portable across CLI, MCP, web, Docker, and future desktop surfaces.

The SQLite catalog under `.truth-harness/indexes/catalog.db` is a rebuildable index. It exists so humans and agents can search, filter, reverse-cite, and inspect large workspaces quickly. It is not authoritative and must never upgrade trust labels.

The event log under `.truth-harness/events/` is an append-only control-plane tail. It records write order, artifact ids, byte counts, and SHA-256 identity. It helps humans and agents reconstruct what happened, but it is not proof that a mathematical or scientific claim is true.

## What Hashes Prove

Truth Harness currently uses SHA-256 for file identity in artifact refs, event logs, workspace snapshots, report sidecars, credibility bundles, proof/check source records, and other local citations.

A SHA-256 hash proves:

- the bytes of a cited file at the time the hash was recorded
- whether a later local file still matches those bytes
- whether a copied reviewer bundle matches the source workspace files
- whether a saved handoff can be resumed without source drift

A SHA-256 hash does not prove:

- that a claim is mathematically true
- that a proof corresponds to the intended informal statement
- that a simulation matches reality
- that a biomedical, safety, legal, or patent claim is valid
- that an AI-generated explanation is trustworthy

Hashes preserve provenance. Verifiers create evidence. Humans and domain experts still review scope.

## Current Snapshot Boundary

`truth-harness workspace snapshot` writes `truth-harness.workspace-snapshot.v0` records into `.truth-harness/snapshots/`.

Snapshots include local artifact paths, kind, byte length, SHA-256, schema version, artifact id when discoverable, summary counts, privacy metadata, and explicit warnings. They intentionally exclude cache/control-plane directories that would make snapshots noisy or self-referential, such as indexes, events, and snapshots themselves.

Snapshots are used to:

- detect changed, missing, or added evidence after a checkpoint
- anchor workspace revisions and legacy `workspace run-next --write` drift checks
- support credibility bundles and review packets
- help agents avoid acting on stale chat memory

Snapshots are not used to:

- satisfy validation gates by themselves
- upgrade a claim's trust label
- replace claim, route, proof, SMT, CAS, receipt, or source records

## Object Storage Direction

The next storage evolution should be content-addressed artifacts, but it should be introduced underneath the existing evidence model rather than replacing it.

Recommended future shape:

```text
.truth-harness/
  receipts/            canonical evidence records
  claims/              claim ledger records
  routes/              verifier route records
  validation/          validation plans
  snapshots/           workspace snapshot manifests
  objects/
    sha256/
      ab/
        abcdef...      immutable content-addressed blobs
  revisions/
    rev_*.json         immutable research-session/workspace revision manifests
  indexes/
    catalog.db         rebuildable search/index cache
```

The canonical JSON records should continue to cite paths, artifact ids, replay commands, trust labels, and validation boundaries. Object storage would add immutable blob identity for large or shared payloads: plots, rendered proof trees, reviewer bundles, notebook outputs, simulation files, datasets, and future graphics/physics artifacts.

This lets Truth Harness scale without making every consumer parse a giant directory of mutable files.

## Merkle Workspace Manifests

Workspace snapshots already hash file entries. The next stronger form is a Merkle-style manifest:

- every artifact entry has a path, kind, byte length, SHA-256, schema version, artifact id, and optional object ref
- directory or logical group nodes hash their child entries
- the workspace revision hash commits to the exact graph of artifacts at a point in time
- research-session checkpoints can point at revision hashes
- run-next handoffs can require revision verification before execution
- credibility bundles can include a source revision and copied-file verification

This would make long-running agent work feel closer to Git for research artifacts: claims and evidence can branch, supersede, and reconnect without erasing history.

## Lore-Inspired, Not Lore-Dependent

Epic's Lore is relevant because it is a Rust, MIT-licensed, content-addressed version-control system designed for large codebases and binary assets. Its architecture points in the right direction for future Truth Harness workloads: immutable revisions, chunked storage, sparse hydration, scalable object identity, and large artifact handling.

Truth Harness should not depend on Lore by default right now.

Reasons:

- Truth Harness is currently a local evidence/control plane, not a large binary asset VCS.
- Lore is pre-1.0, and its APIs/on-disk formats may change.
- Git should remain the source-control layer for the repo itself.
- The `.truth-harness/` evidence model must stay portable without a server.
- Storage hashes must not be confused with proof or scientific validity.

The right approach is a future optional backend:

```ts
interface ProvenanceStore {
  putArtifact(input: StoredArtifactInput): Promise<StoredArtifactRef>;
  getArtifact(ref: StoredArtifactRef): Promise<Uint8Array>;
  writeRevision(input: WorkspaceRevisionInput): Promise<WorkspaceRevisionRef>;
  readRevision(ref: WorkspaceRevisionRef): Promise<WorkspaceRevision>;
  listRefs(query: ProvenanceQuery): Promise<StoredArtifactRef[]>;
}
```

First implementation: local filesystem plus SHA-256.

Future implementation: optional Lore-backed or Lore-inspired content store for huge datasets, rendered visuals, simulation traces, robotics assets, and multi-user labs.

## Trust Boundary

Provenance storage must obey these rules:

1. Canonical JSON artifacts remain authoritative until a specific migration is designed and reviewed.
2. Indexes, event logs, and object stores are support systems, not proof systems.
3. Hash-backed citation is required for serious handoffs, but a hash never upgrades trust.
4. A snapshot proves drift status only for the recorded artifact set.
5. A revision manifest must record privacy metadata and disclosure boundaries.
6. Large binary payloads should be content-addressed, not duplicated across every report.
7. Vault plaintext must never be indexed or exposed in object-store metadata.
8. Remote storage, hosted model calls, or multi-user services must be explicit opt-in surfaces with disclosure records.
9. Agents should act from recorded run-next packets, validation gates, and revision manifests instead of chat memory.
10. Every migration must preserve replayability or record exactly what became non-replayable.

## Phased Plan

### Phase 0: Current State

Already implemented:

- canonical local JSON artifacts
- workspace snapshots with SHA-256 entries
- hash-backed local artifact refs
- append-only event lines for artifact writes
- rebuildable SQLite catalog with reverse citation lookup
- credibility bundles with copied-file hash verification
- run-next handoffs with source revision verification plus source snapshot drift checks

### Phase 1: Make Storage Policy Visible

Document the storage boundary in README, agent docs, and reviewer docs. A professor, engineer, or agent should be able to answer:

- What is the source of truth?
- What is cache?
- What does a hash prove?
- What can be safely deleted and rebuilt?
- What must be preserved for review?

### Phase 2: Content-Addressed Artifact Store

Add a local `.truth-harness/objects/sha256/` store for large generated or imported artifacts.

Keep canonical JSON records as the control plane. They should point at object refs and include byte length, hash, MIME type, renderer/engine, replay command, privacy metadata, and trust boundary.

### Phase 3: Workspace Revision Manifests

Initial immutable `truth-harness.workspace-revision.v0` manifests now commit to a fresh source snapshot, the source snapshot file hash, selected local artifact hashes, parent revision refs, session refs, validation-plan refs, and claim refs.

Use revisions for:

- autonomous agent resume points
- reviewer packets
- report provenance
- long-running proof attempts
- simulation and graphics-engine experiments

Current commands:

```bash
truth-harness workspace revision . --title "Checkpoint before agent handoff" --reason "Stable evidence state before the next proof blocker"
truth-harness workspace revisions
truth-harness workspace show-revision <rev_id>
truth-harness workspace verify-revision <rev_id>
```

Revision verification checks snapshot-file identity and workspace drift. It intentionally ignores added revision manifests because version history growth is normal, but changed or missing evidence artifacts still fail closed. A revision is a resume/review anchor, not a truth label.

`workspace run-next --write` now creates a fresh revision before writing the handoff JSON/Markdown, then embeds both `sourceRevision` and `sourceSnapshot` metadata in the packet. `workspace run-nexts --verify-snapshots`, `workspace show-run-next --verify-snapshot`, MCP run-next list/show verification, and the web handoff verifier prefer the source revision when present. Verification ignores only expected handoff files and revision-history manifests added after the snapshot; any real evidence drift still forces `resumeDecision.status: "rerun-run-next"`.

### Phase 4: Pluggable Provenance Backends

Hide storage behind a small backend interface. Keep the local filesystem backend as default. Evaluate Lore or a Lore-inspired backend only when Truth Harness has real large-artifact pressure: datasets, notebooks, rendered visual trees, simulation traces, robotics assets, or multi-user lab sync.

### Phase 5: Research-Grade Branching

Let claims, validation plans, and research sessions reference workspace revisions so users can branch an investigation, supersede bad work, compare proof attempts, and publish a report that cites exactly which local evidence state produced it.

## Why This Matters

The moat is not just connecting Lean, Z3, Maxima, SageMath, and future engines. The moat is making their outputs durable, local, inspectable, and impossible to confuse with AI vibes.

Truth Harness should become the layer where:

- engines compute or verify,
- receipts record,
- claims depend,
- snapshots preserve,
- revisions branch,
- reports cite,
- agents resume,
- humans audit.

That is the path from today's verified math workbench to future high-stakes scientific, simulation, robotics, and graphics-engine research without weakening the trust boundary.

## References

- Epic Games Lore repository: https://github.com/EpicGames/lore
- Lore system design documentation: https://epicgames.github.io/lore/explanation/system-design/
- Lore FAQ: https://epicgames.github.io/lore/faq/
