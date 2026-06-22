import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

export const LEAN_PROJECT_INSPECTION_SCHEMA_VERSION = "truth-harness.lean-project-inspection.v0";

export type LeanProjectReadiness = "ready" | "partial" | "missing";

export interface LeanProjectInspectionInput {
  rootPath: string;
  projectPath?: string;
  maxLeanFiles?: number;
}

export interface LeanProjectInspection {
  schemaVersion: typeof LEAN_PROJECT_INSPECTION_SCHEMA_VERSION;
  inspectedAt: string;
  localOnly: true;
  networkAccess: "none";
  projectPath: string;
  readiness: LeanProjectReadiness;
  files: {
    leanToolchain?: LeanProjectFileSummary;
    lakefileLean?: LeanProjectFileSummary;
    lakefileToml?: LeanProjectFileSummary;
    lakeManifest?: LeanProjectFileSummary;
    leanFiles: {
      total: number;
      sample: LeanProjectFileSummary[];
      truncated: boolean;
    };
  };
  toolchain?: {
    source: string;
    channel: string;
    pinned: boolean;
  };
  mathlib: {
    likelyUsesMathlib: boolean;
    evidence: string[];
  };
  declarations: LeanProjectDeclarationInventory;
  proofSafety: LeanProjectProofSafety;
  trustBoundary: {
    inspectionIsNotProof: true;
    noLeanExecution: true;
    noNetworkAccess: true;
    provedRequiresProofCheckRecord: true;
    proofMarkersBlockProvedTrust: true;
  };
  warnings: string[];
  nextActions: string[];
}

export interface LeanProjectFileSummary {
  path: string;
  byteLength: number;
  sha256: string;
  sha256Scope: "file";
}

export type LeanProjectDeclarationKind = "theorem" | "lemma" | "example" | "def";

export interface LeanProjectDeclaration {
  declarationId: string;
  kind: LeanProjectDeclarationKind;
  name?: string;
  path: string;
  line: number;
  column: number;
  signature: string;
  signatureSha256: string;
  snippet: string;
  sourceSha256: string;
}

export interface LeanProjectDeclarationInventory {
  scannedFiles: number;
  completeProjectScan: boolean;
  total: number;
  byKind: Record<LeanProjectDeclarationKind, number>;
  sample: LeanProjectDeclaration[];
  truncated: boolean;
}

export type LeanProjectProofMarkerKind = "sorry" | "admit" | "axiom" | "constant" | "hole";

export interface LeanProjectProofMarker {
  kind: LeanProjectProofMarkerKind;
  path: string;
  line: number;
  column: number;
  snippet: string;
  declaration?: LeanProjectProofMarkerDeclaration;
  repairTarget: LeanProjectProofMarkerRepairTarget;
  severity: "blocking";
  message: string;
}

export interface LeanProjectProofMarkerRepairTarget {
  repairTargetId: string;
  sourcePath: string;
  sourceSha256: string;
  markerKind: LeanProjectProofMarkerKind;
  markerLine: number;
  markerColumn: number;
  declarationId?: string;
  declarationName?: string;
  declarationSignatureSha256?: string;
  afterEditCommands: string[];
  evidenceRequired: string[];
  boundary: string;
}

export type LeanProjectProofMarkerDeclaration = Pick<
  LeanProjectDeclaration,
  "declarationId" | "kind" | "name" | "path" | "line" | "column" | "signature" | "signatureSha256" | "sourceSha256"
>;

export interface LeanProjectProofSafety {
  scannedFiles: number;
  completeProjectScan: boolean;
  blocksProvedTrust: boolean;
  markers: {
    total: number;
    sample: LeanProjectProofMarker[];
    truncated: boolean;
  };
}

const DEFAULT_MAX_LEAN_FILES = 40;
const DEFAULT_MAX_PROOF_MARKERS = 25;
const DEFAULT_MAX_DECLARATIONS = 40;

const PROOF_MARKER_MESSAGES: Record<LeanProjectProofMarkerKind, string> = {
  sorry: "`sorry` is an unfinished proof placeholder.",
  admit: "`admit` is an unfinished proof placeholder.",
  axiom: "`axiom` introduces a local unproved assumption.",
  constant: "`constant` can introduce a local unchecked assumption.",
  hole: "A Lean metavariable hole such as `?_` or `?goal` is an unfinished proof target."
};

export async function inspectLeanProject(input: LeanProjectInspectionInput): Promise<LeanProjectInspection> {
  const root = resolve(input.rootPath);
  const projectRoot = resolveUnderRoot(root, input.projectPath ?? ".");
  const projectStat = await stat(projectRoot);
  if (!projectStat.isDirectory()) {
    throw new Error(`Lean project path is not a directory: ${input.projectPath ?? "."}`);
  }

  const maxLeanFiles = Math.max(1, Math.floor(input.maxLeanFiles ?? DEFAULT_MAX_LEAN_FILES));
  const [leanToolchain, lakefileLean, lakefileToml, lakeManifest, leanFiles] = await Promise.all([
    summarizeFileIfPresent(root, join(projectRoot, "lean-toolchain")),
    summarizeFileIfPresent(root, join(projectRoot, "lakefile.lean")),
    summarizeFileIfPresent(root, join(projectRoot, "lakefile.toml")),
    summarizeFileIfPresent(root, join(projectRoot, "lake-manifest.json")),
    collectLeanFiles(root, projectRoot, maxLeanFiles)
  ]);
  const toolchain = leanToolchain ? await readLeanToolchain(projectRoot) : undefined;
  const mathlib = await detectMathlib(projectRoot, {
    lakefileLean: Boolean(lakefileLean),
    lakefileToml: Boolean(lakefileToml),
    lakeManifest: Boolean(lakeManifest)
  });
  const [declarations, proofSafety] = await Promise.all([
    inspectLeanDeclarations(root, leanFiles),
    inspectLeanProofSafety(root, leanFiles)
  ]);
  const hasLakefile = Boolean(lakefileLean || lakefileToml);
  const hasLeanFiles = leanFiles.total > 0;
  const readiness = leanToolchain && hasLakefile && hasLeanFiles ? "ready" : hasLeanFiles || hasLakefile || leanToolchain ? "partial" : "missing";
  const projectPath = toPortablePath(relative(root, projectRoot)) || ".";

  return {
    schemaVersion: LEAN_PROJECT_INSPECTION_SCHEMA_VERSION,
    inspectedAt: new Date().toISOString(),
    localOnly: true,
    networkAccess: "none",
    projectPath,
    readiness,
    files: {
      ...(leanToolchain ? { leanToolchain } : {}),
      ...(lakefileLean ? { lakefileLean } : {}),
      ...(lakefileToml ? { lakefileToml } : {}),
      ...(lakeManifest ? { lakeManifest } : {}),
      leanFiles
    },
    ...(toolchain ? { toolchain } : {}),
    mathlib,
    declarations,
    proofSafety,
    trustBoundary: {
      inspectionIsNotProof: true,
      noLeanExecution: true,
      noNetworkAccess: true,
      provedRequiresProofCheckRecord: true,
      proofMarkersBlockProvedTrust: true
    },
    warnings: buildWarnings({
      readiness,
      leanToolchain: Boolean(leanToolchain),
      hasLakefile,
      hasLeanFiles,
      lakeManifest: Boolean(lakeManifest),
      declarations,
      proofSafety
    }),
    nextActions: buildNextActions({
      readiness,
      leanToolchain: Boolean(leanToolchain),
      hasLakefile,
      hasLeanFiles,
      lakeManifest: Boolean(lakeManifest),
      declarations,
      proofSafety,
      projectPath
    })
  };
}

async function summarizeFileIfPresent(root: string, path: string): Promise<LeanProjectFileSummary | undefined> {
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile()) {
      return undefined;
    }

    return summarizeExistingFile(root, path, fileStat.size);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function summarizeExistingFile(root: string, path: string, byteLength?: number): Promise<LeanProjectFileSummary> {
  const bytes = await readFile(path);
  return {
    path: toPortablePath(relative(root, path)),
    byteLength: byteLength ?? bytes.byteLength,
    sha256: sha256Hex(bytes),
    sha256Scope: "file"
  };
}

async function collectLeanFiles(
  root: string,
  projectRoot: string,
  maxLeanFiles: number
): Promise<LeanProjectInspection["files"]["leanFiles"]> {
  const sample: LeanProjectFileSummary[] = [];
  let total = 0;

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > 5) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === ".lake" || entry.name === "node_modules" || entry.name === ".truth-harness") {
        continue;
      }

      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path, depth + 1);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".lean") || entry.name === "lakefile.lean") {
        continue;
      }

      total += 1;
      if (sample.length < maxLeanFiles) {
        const fileStat = await stat(path);
        sample.push(await summarizeExistingFile(root, path, fileStat.size));
      }
    }
  }

  await walk(projectRoot, 0);

  return {
    total,
    sample: sample.sort((left, right) => left.path.localeCompare(right.path)),
    truncated: total > sample.length
  };
}

async function readLeanToolchain(projectRoot: string): Promise<LeanProjectInspection["toolchain"] | undefined> {
  const raw = (await readFile(join(projectRoot, "lean-toolchain"), "utf8")).trim();
  if (!raw) {
    return undefined;
  }

  return {
    source: "lean-toolchain",
    channel: raw,
    pinned: !/^(?:stable|nightly)$/u.test(raw)
  };
}

async function detectMathlib(
  projectRoot: string,
  files: { lakefileLean: boolean; lakefileToml: boolean; lakeManifest: boolean }
): Promise<LeanProjectInspection["mathlib"]> {
  const evidence: string[] = [];
  for (const file of ["lakefile.lean", "lakefile.toml", "lake-manifest.json"]) {
    if ((file === "lakefile.lean" && !files.lakefileLean) || (file === "lakefile.toml" && !files.lakefileToml) || (file === "lake-manifest.json" && !files.lakeManifest)) {
      continue;
    }

    const text = await readFile(join(projectRoot, file), "utf8");
    if (/\bmathlib\b/iu.test(text)) {
      evidence.push(file);
    }
  }

  return {
    likelyUsesMathlib: evidence.length > 0,
    evidence
  };
}

async function inspectLeanProofSafety(
  root: string,
  leanFiles: LeanProjectInspection["files"]["leanFiles"]
): Promise<LeanProjectProofSafety> {
  let total = 0;
  const sample: LeanProjectProofMarker[] = [];

  for (const file of leanFiles.sample) {
    const sourceText = await readFile(resolve(root, file.path), "utf8");
    const markers = findLeanProofMarkers(sourceText, file.path);
    total += markers.length;

    for (const marker of markers) {
      if (sample.length < DEFAULT_MAX_PROOF_MARKERS) {
        sample.push(marker);
      }
    }
  }

  return {
    scannedFiles: leanFiles.sample.length,
    completeProjectScan: !leanFiles.truncated,
    blocksProvedTrust: total > 0,
    markers: {
      total,
      sample,
      truncated: total > sample.length
    }
  };
}

async function inspectLeanDeclarations(
  root: string,
  leanFiles: LeanProjectInspection["files"]["leanFiles"]
): Promise<LeanProjectDeclarationInventory> {
  const byKind: Record<LeanProjectDeclarationKind, number> = {
    theorem: 0,
    lemma: 0,
    example: 0,
    def: 0
  };
  const sample: LeanProjectDeclaration[] = [];
  let total = 0;

  for (const file of leanFiles.sample) {
    const sourceText = await readFile(resolve(root, file.path), "utf8");
    const declarations = findLeanDeclarations(sourceText, file.path);
    for (const declaration of declarations) {
      total += 1;
      byKind[declaration.kind] += 1;
      if (sample.length < DEFAULT_MAX_DECLARATIONS) {
        sample.push(declaration);
      }
    }
  }

  return {
    scannedFiles: leanFiles.sample.length,
    completeProjectScan: !leanFiles.truncated,
    total,
    byKind,
    sample,
    truncated: total > sample.length
  };
}

export function findLeanDeclarations(sourceText: string, path: string): LeanProjectDeclaration[] {
  const masked = maskLeanCommentsAndStrings(sourceText);
  const rawLines = sourceText.split(/\r\n|\n|\r/u);
  const maskedLines = masked.split(/\r\n|\n|\r/u);
  const sourceSha256 = sha256Hex(sourceText);
  const declarations: LeanProjectDeclaration[] = [];

  for (let index = 0; index < maskedLines.length; index += 1) {
    const maskedLine = maskedLines[index] ?? "";
    const theoremLike = maskedLine.match(/^\s*(?:private\s+|protected\s+)?(theorem|lemma|def)\s+([A-Za-z_][A-Za-z0-9_'.]*)\b/u);
    const exampleLike = theoremLike ? undefined : maskedLine.match(/^\s*example\b/u);
    if (!theoremLike && !exampleLike) {
      continue;
    }

    const rawLine = rawLines[index] ?? "";
    const kind = (theoremLike?.[1] ?? "example") as LeanProjectDeclarationKind;
    const name = theoremLike?.[2];
    const column = (theoremLike ? theoremLike.index ?? 0 : exampleLike?.index ?? 0) + 1;
    const snippet = normalizeLeanSnippet(rawLine);
    const signature = declarationSignature(snippet);
    declarations.push({
      declarationId: leanDeclarationId({ path, kind, name, signature }),
      kind,
      ...(name ? { name } : {}),
      path,
      line: index + 1,
      column,
      signature,
      signatureSha256: sha256Hex(signature),
      snippet,
      sourceSha256
    });
  }

  return declarations;
}

function leanDeclarationId(input: {
  path: string;
  kind: LeanProjectDeclarationKind;
  name?: string;
  signature: string;
}): string {
  return `decl_${sha256Hex(`${input.path}\n${input.kind}\n${input.name ?? ""}\n${input.signature}`).slice(0, 16)}`;
}

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./:@=+-]+$/u.test(value) ? value : JSON.stringify(value);
}

function normalizeLeanSnippet(line: string): string {
  const normalized = line.trim().replace(/\s+/gu, " ");
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function declarationSignature(snippet: string): string {
  const [beforeProof] = snippet.split(":=");
  const signature = beforeProof?.trim() ?? snippet;
  return signature.length > 180 ? `${signature.slice(0, 177)}...` : signature;
}

export function findLeanProofMarkers(sourceText: string, path: string): LeanProjectProofMarker[] {
  const masked = maskLeanCommentsAndStrings(sourceText);
  const lines = sourceText.split(/\r\n|\n|\r/u);
  const declarations = findLeanDeclarations(sourceText, path);
  const markers: LeanProjectProofMarker[] = [];
  const pattern = /\b(sorry|admit|axiom|constant)\b/gu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(masked)) !== null) {
    const kind = match[1] as LeanProjectProofMarkerKind;
    markers.push(leanProofMarker(sourceText, lines, declarations, path, kind, match.index));
  }

  const holePattern = /(^|[^\w'])\?[_A-Za-z][A-Za-z0-9_'.]*/gmu;
  while ((match = holePattern.exec(masked)) !== null) {
    const markerIndex = match.index + (match[1]?.length ?? 0);
    markers.push(leanProofMarker(sourceText, lines, declarations, path, "hole", markerIndex));
  }

  return markers.sort((left, right) => left.line - right.line || left.column - right.column || left.kind.localeCompare(right.kind));
}

function leanProofMarker(
  sourceText: string,
  lines: string[],
  declarations: LeanProjectDeclaration[],
  path: string,
  kind: LeanProjectProofMarkerKind,
  index: number
): LeanProjectProofMarker {
  const location = lineColumnAt(sourceText, index);
  const rawSnippet = lines[location.line - 1]?.trim().replace(/\s+/gu, " ") ?? "";
  const declaration = kind === "axiom" || kind === "constant" ? undefined : declarationForMarker(declarations, location);
  const sourceSha256 = sha256Hex(sourceText);
  return {
    kind,
    path,
    line: location.line,
    column: location.column,
    snippet: rawSnippet.length > 160 ? `${rawSnippet.slice(0, 157)}...` : rawSnippet,
    ...(declaration ? { declaration } : {}),
    repairTarget: leanProofMarkerRepairTarget({
      path,
      sourceSha256,
      kind,
      location,
      snippet: rawSnippet,
      declaration
    }),
    severity: "blocking",
    message: PROOF_MARKER_MESSAGES[kind]
  };
}

function leanProofMarkerRepairTarget(input: {
  path: string;
  sourceSha256: string;
  kind: LeanProjectProofMarkerKind;
  location: { line: number; column: number };
  snippet: string;
  declaration?: LeanProjectProofMarkerDeclaration;
}): LeanProjectProofMarkerRepairTarget {
  const declarationArg = input.declaration?.name ? ` --declaration ${quoteCommandArg(input.declaration.name)}` : "";
  const proofCheckCommand = `truth-harness proof check ${quoteCommandArg(input.path)}${declarationArg} --write`;
  const targetHash = sha256Hex(
    [
      input.path,
      input.sourceSha256,
      input.kind,
      String(input.location.line),
      String(input.location.column),
      input.snippet,
      input.declaration?.declarationId ?? "",
      input.declaration?.signatureSha256 ?? ""
    ].join("\n")
  );

  return {
    repairTargetId: `lpr_${targetHash.slice(0, 16)}`,
    sourcePath: input.path,
    sourceSha256: input.sourceSha256,
    markerKind: input.kind,
    markerLine: input.location.line,
    markerColumn: input.location.column,
    ...(input.declaration
      ? {
          declarationId: input.declaration.declarationId,
          ...(input.declaration.name ? { declarationName: input.declaration.name } : {}),
          declarationSignatureSha256: input.declaration.signatureSha256
        }
      : {}),
    afterEditCommands: [
      proofCheckCommand,
      "Rerun the original `truth-harness proof project <project> --json` scan and confirm this repair target is gone."
    ],
    evidenceRequired: [
      "edited workspace-local .lean source",
      "proof-safety scan with this marker absent",
      "accepted proof-check record before using the source as proved evidence"
    ],
    boundary: "This repair target is a local planning aid. It does not prove the declaration, and it must not upgrade trust until a later accepted proof-check record exists."
  };
}

function declarationForMarker(
  declarations: LeanProjectDeclaration[],
  location: { line: number; column: number }
): LeanProjectProofMarkerDeclaration | undefined {
  const declaration = declarations
    .filter(
      (candidate) =>
        candidate.line < location.line || (candidate.line === location.line && candidate.column <= location.column)
    )
    .at(-1);
  if (!declaration) {
    return undefined;
  }

  return {
    declarationId: declaration.declarationId,
    kind: declaration.kind,
    ...(declaration.name ? { name: declaration.name } : {}),
    path: declaration.path,
    line: declaration.line,
    column: declaration.column,
    signature: declaration.signature,
    signatureSha256: declaration.signatureSha256,
    sourceSha256: declaration.sourceSha256
  };
}

function maskLeanCommentsAndStrings(sourceText: string): string {
  const chars = sourceText.split("");
  let index = 0;

  while (index < sourceText.length) {
    if (sourceText.startsWith("--", index)) {
      index = maskLineComment(chars, sourceText, index);
      continue;
    }

    if (sourceText.startsWith("/-", index)) {
      index = maskBlockComment(chars, sourceText, index);
      continue;
    }

    if (sourceText[index] === "\"") {
      index = maskStringLiteral(chars, sourceText, index);
      continue;
    }

    index += 1;
  }

  return chars.join("");
}

function maskLineComment(chars: string[], sourceText: string, start: number): number {
  let index = start;
  while (index < sourceText.length && sourceText[index] !== "\n" && sourceText[index] !== "\r") {
    chars[index] = " ";
    index += 1;
  }

  return index;
}

function maskBlockComment(chars: string[], sourceText: string, start: number): number {
  let index = start;
  let depth = 0;

  while (index < sourceText.length) {
    if (sourceText.startsWith("/-", index)) {
      depth += 1;
      chars[index] = " ";
      chars[index + 1] = " ";
      index += 2;
      continue;
    }

    if (sourceText.startsWith("-/", index)) {
      chars[index] = " ";
      chars[index + 1] = " ";
      index += 2;
      depth -= 1;
      if (depth <= 0) {
        return index;
      }
      continue;
    }

    if (sourceText[index] !== "\n" && sourceText[index] !== "\r") {
      chars[index] = " ";
    }
    index += 1;
  }

  return index;
}

function maskStringLiteral(chars: string[], sourceText: string, start: number): number {
  let index = start;
  while (index < sourceText.length) {
    const char = sourceText[index];
    if (char !== "\n" && char !== "\r") {
      chars[index] = " ";
    }

    if (char === "\\" && index + 1 < sourceText.length) {
      index += 1;
      if (sourceText[index] !== "\n" && sourceText[index] !== "\r") {
        chars[index] = " ";
      }
    } else if (char === "\"" && index > start) {
      index += 1;
      return index;
    }

    index += 1;
  }

  return index;
}

function lineColumnAt(text: string, index: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;

  for (let cursor = 0; cursor < index; cursor += 1) {
    const char = text[cursor];
    if (char === "\n") {
      line += 1;
      lineStart = cursor + 1;
    }
  }

  return {
    line,
    column: index - lineStart + 1
  };
}

function buildWarnings(input: {
  readiness: LeanProjectReadiness;
  leanToolchain: boolean;
  hasLakefile: boolean;
  hasLeanFiles: boolean;
  lakeManifest: boolean;
  declarations: LeanProjectDeclarationInventory;
  proofSafety: LeanProjectProofSafety;
}): string[] {
  const warnings = [
    "Lean project inspection reads local files only; it does not run Lean, Lake, or network commands.",
    "This inspection cannot support a `proved` label. Only a proof-check record accepted by Lean can do that."
  ];

  if (!input.leanToolchain) {
    warnings.push("No lean-toolchain file found. Reproducible proof work should pin the Lean toolchain.");
  }
  if (!input.hasLakefile) {
    warnings.push("No lakefile.lean or lakefile.toml found. Multi-file Lean/mathlib work should use Lake project metadata.");
  }
  if (!input.hasLeanFiles) {
    warnings.push("No .lean files were found in the inspected project path.");
  }
  if (input.hasLeanFiles && input.declarations.total === 0) {
    warnings.push("No theorem, lemma, example, or def declarations were found in sampled Lean files. Add named formalization targets before reviewer handoff.");
  }
  if (input.hasLakefile && !input.lakeManifest) {
    warnings.push("No lake-manifest.json found. Dependency revisions may be unresolved until Lake writes a manifest.");
  }
  if (!input.proofSafety.completeProjectScan) {
    warnings.push("Proof-marker scan was truncated with the Lean file sample. Increase --max-lean-files before claiming the whole project is free of unfinished proof markers.");
  }
  if (input.proofSafety.markers.total > 0) {
    warnings.push(`Found ${input.proofSafety.markers.total} blocking Lean proof marker(s). Remove or justify them before any affected source can support \`proved\`.`);
  }

  return warnings;
}

function buildNextActions(input: {
  readiness: LeanProjectReadiness;
  leanToolchain: boolean;
  hasLakefile: boolean;
  hasLeanFiles: boolean;
  lakeManifest: boolean;
  declarations: LeanProjectDeclarationInventory;
  proofSafety: LeanProjectProofSafety;
  projectPath: string;
}): string[] {
  const actions: string[] = [];
  const firstMarker = input.proofSafety.markers.sample[0];
  if (firstMarker) {
    actions.push(`Resolve blocking Lean marker ${firstMarker.kind} at ${firstMarker.path}:${firstMarker.line}:${firstMarker.column}, then rerun \`truth-harness proof project ${input.projectPath} --json\`.`);
    actions.push("Do not use an affected Lean source for `proved` trust until `sorry`, `admit`, Lean metavariable holes, local `axiom`, and local `constant` markers are gone.");
  }
  if (!input.leanToolchain) {
    actions.push("Add a lean-toolchain file pinned to the intended Lean release before claiming reproducible proof environment readiness.");
  }
  if (!input.hasLakefile) {
    actions.push("Add lakefile.lean or lakefile.toml when the proof lane moves beyond single-file Lean checks.");
  }
  if (!input.hasLeanFiles) {
    actions.push("Add at least one workspace-local .lean proof artifact, then run `truth-harness proof check <file> --write`.");
  }
  if (input.hasLeanFiles && input.declarations.total === 0) {
    actions.push("Add named theorem or lemma declarations so agents and reviewers can target exact formal statements.");
  }
  if (input.hasLakefile && !input.lakeManifest) {
    actions.push("Generate and review lake-manifest.json in a controlled environment before relying on dependency revisions.");
  }
  if (input.readiness === "ready") {
    actions.push("Run `truth-harness proof check <workspace-local.lean> --write` for the concrete statement that should support `proved`.");
  }

  return actions;
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace root: ${path}`);
  }

  return target;
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}
