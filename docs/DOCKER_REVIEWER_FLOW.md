# Docker Reviewer Flow

Truth Harness uses Docker as the default credibility path for reviewer-facing engine evidence. The goal is to let a professor, auditor, or agent run the same no-network checks without depending on the host machine having Maxima, Z3, cvc5, Lean, or SageMath installed.

## Commands

```bash
npm run reviewer:status
npm run docker:reviewer
npm run docker:storage
npm run docker:cleanup -- heavy-images
npm run docker:cleanup -- heavy-images --confirm-delete
npm run docker:cleanup -- build-cache
npm run docker:cleanup -- build-cache --confirm-delete
```

`npm run reviewer:status` runs the local release audit and then prints Docker storage posture.

`npm run docker:reviewer` is an alias for `npm run docker:professor`. It builds the pinned Lean reviewer image when needed, then writes no-network engine evidence, adversarial benchmark evidence, a credibility pack, and a verified reviewer bundle.

`npm run docker:storage` is read-only. It reports local `.truth-harness` size, Docker Desktop storage, Docker's own `system df` summary when available, Truth Harness images, and cleanup commands.

`npm run docker:cleanup` is preview-only by default. It requires `--confirm-delete` before it removes anything.

## Storage Reality

Normal native tests do not create gigabytes of Truth Harness data. The local `.truth-harness` workspace usually stays small unless you intentionally generate large archives, visuals, notebooks, or bundles.

The large storage cost comes from Docker:

- `truth-harness:dev` is the default Maxima/Z3/cvc5 image.
- `truth-harness:lean-proof` adds the pinned Lean toolchain.
- `truth-harness:sage-math` adds SageMath, which is large.
- `truth-harness:all-engines` combines the heavy SageMath and Lean gates.
- Docker build cache can grow into many GB after repeated image builds.

On Docker Desktop for Windows, this storage lives mostly in `docker_data.vhdx`. Docker may reclaim image/cache space internally before Windows shows the VHDX file shrinking. A Docker Desktop restart or WSL compaction may be needed before the host filesystem reports the space back.

## Cleanup Targets

```bash
npm run docker:cleanup -- heavy-images
```

Previews removal of optional heavy Truth Harness reviewer images:

- `truth-harness:all-engines`
- `truth-harness:sage-math`
- `truth-harness:lean-proof`
- `truth-harness:verify`

It intentionally keeps `truth-harness:dev`, because the local Docker web and default compose workflows use it.

```bash
npm run docker:cleanup -- build-cache
```

Previews removal of unused Docker build cache older than 24 hours.

```bash
npm run docker:cleanup -- all-build-cache
```

Previews removal of all unused Docker build cache. This can reclaim more space, but rebuilding heavy reviewer images will be slower.

```bash
npm run docker:cleanup -- dangling
```

Previews removal of dangling untagged images.

## Safety Boundary

Docker cleanup is separate from workspace cleanup.

- Use `npm run workspace:clean` to preview deletion of local `.truth-harness` data.
- Use `npm run docker:cleanup` to preview deletion of Docker images or build cache.

Neither command deletes data without an explicit confirmation flag. Docker cleanup never upgrades or downgrades trust labels; it only affects whether future reviewer checks need to rebuild images before rerunning.
