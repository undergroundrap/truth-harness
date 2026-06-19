# Local Workspace Maintenance

Truth Harness stores private project data under `.truth-harness/` by default. Maintenance commands are intentionally conservative: they operate only on manifest-known directories inside that folder, and cleanup is a dry run unless deletion is explicitly confirmed.

## Repair

```bash
npm run workspace:status
npm run cli -- workspace repair
npm run workspace:repair-artifacts:preview
npm run workspace:repair-artifacts
npm run workspace:validate
npm run workspace:events
npm run workspace:ui-review:pass
```

`workspace repair` restores missing private directories and manifest defaults. `workspace repair-artifacts` repairs known legacy JSON metadata drift, such as older verifier-route manifest fields or prompt-derived visual refs that should be manual context instead of receipt evidence. It never reruns a verifier and never upgrades a trust label.

Use preview mode before changing artifact JSON:

```bash
npm run workspace:repair-artifacts:preview
node apps/cli/dist/index.js workspace repair-artifacts . --preview
```

## Cleanup

```bash
npm run workspace:archive
npm run workspace:archives
npm run workspace:restore-preview -- archive_20260615T000500000Z
npm run cli -- workspace archive . --target evidence --reason "before fresh start"
npm run cli -- workspace restore-archive archive_20260615T000500000Z . --target receipts
npm run cli -- workspace restore-archive archive_20260615T000500000Z . --target receipts --confirm-restore
npm run cli -- workspace restore-archive archive_20260615T000500000Z . --target receipts --confirm-restore --overwrite
npm run workspace:clean
npm run cli -- workspace clean . --target scratch
npm run cli -- workspace clean . --target generated --confirm-delete
```

Use `workspace archive` before destructive cleanup. It copies selected manifest-known `.truth-harness` directories into `.truth-harness/archives/<archive-id>/` and writes an `archive-manifest.json` with targets, copied directories, file counts, byte counts, per-file SHA-256 hashes, and the reason. Archives are local backups for maintenance and handoff safety; they are not off-machine backups and should still be committed, exported, or copied elsewhere if the work is important.

Use `workspace archives` to list local archives. Damaged archive manifests are listed as damaged instead of disappearing. Use `workspace restore-archive` to preview copying files from an archive back into live workspace directories. Restore is dry-run by default; `--confirm-restore` is required to write files. Restore verifies archive file hashes before copying, copies archive files back, and does not delete live files that are not present in the archive. If a live file changed after the archive was created, restore reports a conflict and refuses to overwrite it unless `--overwrite` is also passed.

The default `workspace clean` target is `scratch`, which previews clearing rebuildable caches and generated health files:

- `.truth-harness/indexes`
- `.truth-harness/validation`
- `.truth-harness/snapshots`

Additional targets:

- `generated`: scratch data plus generated events, findings, artifacts, visuals, and benchmark outputs.
- `evidence`: durable receipts, claims, routes, proof/SMT/CAS records, sessions, disclosures, reviews, and other research evidence.
- `all`: every manifest-known data directory under `.truth-harness`, while preserving `.truth-harness/project.json`.
- Any explicit directory name such as `receipts`, `claims`, `routes`, `visuals`, or `model-contexts`.

Deletion requires `--confirm-delete`. Without it, Truth Harness prints the files and bytes that would be cleared and exits without changing the workspace.

## Safety Boundary

Cleanup does not accept arbitrary filesystem paths. Targets are resolved from the local workspace manifest and must stay under `.truth-harness/`. Index lock files are preserved so cleanup does not disturb active workspace operations.

Archive, restore, and cleanup commands use the same target vocabulary. Archive and restore output is structured JSON with `--json`, so an agent can cite the archive manifest, hash verification state, and conflict list before requesting any destructive cleanup or overwrite.

## Docker Storage

Workspace cleanup does not remove Docker images, Docker build cache, or Docker Desktop's `docker_data.vhdx`.

Use the Docker reviewer helpers for that separate layer:

```bash
npm run docker:storage
npm run docker:cleanup -- heavy-images
npm run docker:cleanup -- heavy-images --confirm-delete
npm run docker:cleanup -- build-cache
npm run docker:cleanup -- build-cache --confirm-delete
```

See [DOCKER_REVIEWER_FLOW.md](DOCKER_REVIEWER_FLOW.md) for the Docker-first reviewer flow and the storage boundary between `.truth-harness` artifacts and heavyweight engine images.
