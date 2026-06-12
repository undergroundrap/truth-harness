# Open Source And Commercial Strategy

Date: 2026-06-08

## Ambition Check

The vision is not silly. It is just too large to market directly at the start.

The credible wedge is:

> Proof receipts for AI-generated math.

The long-term company vision is:

> A trust layer for agentic technical reasoning across math, physics, code, simulations, and eventually regulated science.

That second sentence is big enough to support a venture-scale outcome. It also has to be earned in order:

1. Math receipts.
2. Formal proof and CAS adapters.
3. Physics/unit/simulation verification.
4. Code/spec/program verification.
5. Reproducible scientific workflows.
6. Biology/medicine only after strict domain-specific safety, citation, provenance, and human-review controls exist.

## Why Open Source First

Open source is the right first move because Theorem Workbench needs trust more than secrecy.

Open-source core:

- Receipt schema.
- Evidence graph.
- CLI.
- Benchmark format.
- Local deterministic adapters.
- MCP server.
- Basic SymPy/Z3/proof adapters, starting with a local modular parity checker and reserving `proved` for Lean or another accepted proof checker.

Commercial layer later:

- Hosted benchmark dashboards.
- Team artifact storage.
- Private corpus/RAG connectors.
- Enterprise policy controls.
- Reproducible cloud workers.
- Compliance/audit exports.
- Managed solver infrastructure.

This keeps the trust-critical layer inspectable while leaving room for a business.

## License Preference

The preferred public license is **GNU Affero General Public License v3.0** (`AGPL-3.0-only` unless the owner explicitly chooses `AGPL-3.0-or-later`). AGPL fits Theorem Workbench better than MIT if the goal is open research infrastructure with commercial upside, because hosted forks and network services must preserve source availability for their users.

Do not change the checked-in `LICENSE` file until the exact owner attribution format is confirmed. The public release should use a standard AGPL license text plus normal attribution files, not a custom license clause.

Recommended attribution structure:

- `LICENSE`: unmodified AGPL-3.0 text.
- `NOTICE`: product name, copyright owner line, attribution request, project website, and trademark/brand note.
- `AUTHORS.md`: owner/founder and contributor attribution.
- UI/About and generated reports: "Theorem Workbench by <owner name>" plus the license identifier.
- `package.json`: `"license": "AGPL-3.0-only"` after the license migration.

Avoid adding extra attribution restrictions directly to the license unless a lawyer reviews them. Extra restrictions can make an otherwise standard open-source license harder to adopt and easier to misunderstand. Standard AGPL already requires preservation of copyright notices and license notices; `NOTICE` and UI/report attribution give the brand credit without creating a custom license trap.

## Release Posture

The repo can be open-source in principle while staying private during the prototype stage. Do not rush a public launch just because the license path is decided. Public visibility should be earned by credibility gates, not excitement.

Recommended posture:

1. **Private prototype now.** Keep the repo private while the UI, math lane, safety story, install path, and first demos are still changing quickly. Share screenshots or private demos only with people who understand it is not production research infrastructure yet.
2. **Closed alpha next.** Invite a small group of math, CS, scientific-computing, and AI-agent users. Give them a narrow test script: install, verify a few claims, inspect receipts, export a report, and tell us what made them distrust the system.
3. **Public technical preview.** Open-source the trust-critical core once the launch gates below pass. Call it a technical preview, not a finished product.
4. **Commercial layer later.** Sell hosted/team/private-research features only after the open core has credibility. The website can collect interest and design partners before it sells subscriptions.

## Public Launch Gates

Do not publicly promote the repo until these are true:

- One-command local setup works on a clean machine or Docker path.
- `npm run check` and `npm run proof:launch` pass from a fresh clone.
- The web app clearly shows safety status, trust labels, replay commands, limitations, and export paths.
- The math lane has enough demos to be taken seriously: exact arithmetic, counterexample, symbolic, units, SMT/proof readiness, benchmark run, and report export.
- `proved` is reserved for accepted proof-checker output.
- No code-run path can claim `networkAccess: none` without measured sandbox evidence.
- README explains exactly what the tool does and does not prove.
- `SECURITY.md`, `TRUST_LABELS.md`, `PARITY_LEDGER.md`, and Docker docs are current.
- The project has issue templates for bug reports, trust-label bugs, adapter requests, and security reports.
- The license migration is complete: `LICENSE`, `NOTICE`, `AUTHORS.md`, package metadata, docs, and app/report attribution all agree.

## Website Strategy

Use the website before launch, but sell the mission and collect serious users rather than selling a fragile prototype.

Good website CTA before public launch:

- "Join the private alpha."
- "Submit a math/AI verification failure."
- "Request a research workflow demo."
- "Follow the open-source launch."

Avoid before the product is ready:

- Paid subscriptions.
- Big medical, finance, patent, or "solve the world's hardest problems" claims.
- A public download that makes first-time users fight prototype rough edges.
- Comparison claims that say it beats WolframAlpha, Sage, Lean, Jupyter, or PaperQA without a measured parity gate.

## Open Core Boundary

Keep open:

- Schemas and receipt contracts.
- CLI/MCP/API surface.
- Local evidence graph and validation rules.
- Trust label policy.
- Local adapters and benchmark suites.
- Frontend workbench shell for local use.

Reserve for commercial products later:

- Hosted collaboration and team dashboards.
- Managed private receipt vaults.
- Enterprise policy/audit controls.
- Hosted solver workers and reproducible execution pools.
- Private corpus connectors and compliance exports.
- Support, onboarding, and custom adapter work.

The line should feel fair: the open core must be genuinely useful and auditable by itself. The commercial layer should sell convenience, scale, collaboration, and support.

## Acquisition Logic

The acquisition story is plausible if Theorem Workbench becomes infrastructure that a larger AI, cloud, scientific-computing, or developer-tools company would rather buy than rebuild.

Signals that make it valuable:

- Developers use it to verify AI-generated math/code claims.
- Benchmarks become referenced by model/tool builders.
- The receipt schema becomes a lightweight standard.
- Claude/Codex users install the MCP server.
- Researchers submit benchmark tasks and adapters.
- The project becomes known for catching high-profile AI math failures.
- Enterprise users ask for private receipts, policy controls, and hosted replay.

Do not build for "Google might acquire this." Build so that Google, OpenAI, Anthropic, Anaconda, Cloudflare, Wolfram, GitHub, or a scientific-computing company sees a working trust layer with community gravity.

## Market Evidence

Recent acquisitions support the pattern:

- Cloudflare acquired VoidZero, the open-source company behind Vite/Vitest/Rolldown/Oxc, and said those tools would remain open, vendor-neutral, and community-driven while strengthening AI-native developer workflows.
- Anaconda acquired Outerbounds, built around the open-source Metaflow orchestration framework, to add governed AI/ML workflows, reproducibility, trusted environments, and production-grade agentic workflows.
- Hacker News Show HN guidance favors concrete things users can actually try, not landing pages, lists, or vaporware.

For the technical thesis, current research also supports this direction:

- DeepMind's AI co-mathematician frames the frontier as a stateful workbench for literature search, computation, theorem proving, uncertainty tracking, and native mathematical artifacts.
- A 2026 ICML paper on minimal theorem-proving agents argues that simple open-source agentic baselines can be useful for systematic comparison across theorem-prover architectures.
- A 2026 program-verification paper reports strong results from compiler-in-the-loop agentic proving, pointing toward code verification as a natural next domain after math.

## Million-Dollar Path

Do not try to become a millionaire through vibes. Try to create compounding proof of value.

Phase 1: Public credibility

- 25-100 benchmark tasks.
- Receipt replay.
- HN launch.
- Feedback from Lean/math/CAS/scientific-computing communities.
- Public examples of AI math hallucinations caught by Theorem Workbench.

Phase 2: Agent-native adoption

- MCP server.
- Claude/Codex setup guide.
- GitHub Action for checking math claims in Markdown/notebooks.
- Model/tool comparison reports.

Phase 3: Scientific and engineering usefulness

- SymPy local adapter is live; add Sage for broader CAS coverage.
- Lean adapter.
- Z3/cvc5 adapter.
- Units and dimensional analysis.
- Reproducible simulation receipts.

Phase 4: Commercial pull

- Hosted private receipt vault.
- Team dashboards.
- Private benchmarks.
- Enterprise audit trails.
- SLA-backed solver workers.
- Consulting/design partners in AI labs, research groups, edtech, quant, robotics, aerospace, or scientific software.

## Red Lines

These protect the brand:

- No medical claims without human expert review, source provenance, and regulatory-aware disclaimers.
- No "proved" label without a proof checker.
- No "safe" label for simulations without uncertainty and model-validity boundaries.
- No hidden LLM-as-judge truth decisions.
- No benchmark leaderboard that rewards answer fluency over replayable evidence.

## Sources

- [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.en.html)
- [Open Source Definition](https://opensource.org/osd)
- [Cloudflare acquires VoidZero](https://www.itpro.com/business/acquisition/cloudflare-snaps-up-voidzero-to-expand-ai-native-developer-tools)
- [Anaconda acquires Outerbounds](https://www.crn.com/news/ai/2026/anaconda-extends-ai-native-application-development-with-acquisition)
- [Hacker News Show HN guidelines](https://news.ycombinator.com/showhn.html)
- [AI co-mathematician](https://arxiv.org/abs/2605.06651)
- [A Minimal Agent for Automated Theorem Proving](https://arxiv.org/abs/2602.24273)
- [Agentic Proving for Program Verification](https://arxiv.org/abs/2605.23772)
