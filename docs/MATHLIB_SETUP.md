# Install The Pinned Mathlib Proof Environment

## One Command

From the repository root, with Node/npm and Docker Desktop's Linux engine available:

```bash
npm run docker:mathlib
```

This uses the existing `mathlib-proof` Docker target, downloads the pinned Lean/Lake
dependencies and compiled Mathlib cache during image construction, and then runs
the Algebra smoke proof with networking disabled. JSON and Markdown proof records
are written to `.truth-harness/proofs/`. Exit zero requires the proof check to pass;
a build failure, missing dependency, or rejected artifact is not an installation
success. Initial provisioning needs network access and several GB of free disk.
It can take substantially longer than a normal test run.

The default Lean and all-engines images do not include Mathlib. Lean is the proof
assistant; Mathlib is a separate library. The scratch-space pilot uses Lean alone;
the PIT experiments use SymPy and rational certificate checking. Those results did
not require an installed Mathlib environment.

## What Is In Git

The repository includes the Lake project, `lean-toolchain`, `lakefile.lean`, and
`lake-manifest.json`, not a vendored Mathlib checkout or compiled cache. The latter
are installed into `truth-harness:mathlib-proof`.

- Lean: `leanprover/lean4:v4.12.0`.
- Mathlib: `809c3fb3b5c8f5d7dace56e200b426187516535a`.
- Transitive Lake dependencies: exact revisions in the committed manifest.

These historical versions are for reproducibility, not a claim of current toolchain
security. No version upgrade is part of this setup. Image construction requires
trust in upstream dependency downloads; the runtime container drops capabilities,
uses the non-root image user, enables no-new-privileges, and has no network access.
Docker isolation is not a guarantee against every malicious proof or compiler bug.

Re-run the setup after pulling changes when you need an image containing the new
sources. The build copies the checked-out repository into the image; it does not
live-mount the source tree at runtime. A cached image is not evidence for newer files.

Lean and Mathlib are provisioned before the full source copy. Ordinary source or
documentation edits therefore reuse those dependency layers while rebuilding the
application and rechecking the proof. Changes to dependency manifests, the base
image, or provisioning instructions can still require expensive downloads. Local
`.lake` directories are excluded from the Docker build context.

## General Moment Lemma

After setup:

```bash
npm run docker:moment
```

This checks `TruthHarnessMathlib/Moments.lean` through the existing Truth Harness
proof-check adapter and writes a scoped receipt. It uses Mathlib's
`Matrix.eq_zero_of_forall_pow_sum_mul_pow_eq_zero` rather than reproving matrix theory.
The file independently restates the rational M1 target and checks its axiom list.
It also checks counterexamples to removing distinctness or reducing the number of
moments. The command does not install dependencies; a missing image fails and should
be resolved by running setup first, not by enabling networking in the proof runtime.

A successful check covers the formal moment lemma and these boundary examples.
The current lightweight declaration parser warns that it cannot locate the
namespace-qualified declaration name. Lean still checks the whole source file,
including the independently restated target; do not treat the receipt metadata
alone as declaration-level statement matching.
It does not establish the separate polynomial specialization M2, a new PIT result,
a practical speedup, or a Hum program property. See [the selected scope](PIT_RESEARCH_SELECTION.md).

## Disk And Troubleshooting

```bash
npm run docker:storage
docker image inspect truth-harness:mathlib-proof --format '{{.Size}}'
```

The image size is logical size, not additional disk consumption; Docker layers can
be shared. Build cache can also consume space. Use the existing storage/cleanup
documentation to inspect before removing anything. Do not put `.lake` or Docker
cache content in Git, run a blanket prune, or reset Docker to fix missing Mathlib.

To deliberately reclaim unused build cache while keeping images, containers,
volumes, and evidence, preview `npm run docker:cleanup -- all-build-cache`, then
add `--confirm-delete` to authorize it. This affects the shared Docker builder,
including other projects' caches, and slows future uncached builds. It does not
remove the installed Mathlib image. Docker's virtual disk may retain allocated
host space after cleanup; reclaimed Docker space is not guaranteed immediate
free space on the host drive.

- Docker unreachable: start Docker Desktop and wait for the Linux engine.
- Download failure during build: inspect the network/proxy error, then rerun setup.
- Mathlib not found during proof checking: confirm setup completed and that you used
  `docker:moment`, not a Lean-only image or an unprovisioned host installation.
- Source was edited after setup: rebuild before relying on a new receipt.
- Nonzero proof exit: inspect the saved stdout/stderr. Keep trust `unverified` until
  the actual proof check passes; do not reinterpret failure as a refutation.
