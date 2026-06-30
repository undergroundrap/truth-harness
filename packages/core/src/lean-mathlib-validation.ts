import { inspectLeanProject, type LeanProjectInspection, type LeanProjectTheoremCorpusFamilySummary } from "./lean-project.js";
import {
  addResearchSessionCheckpoint,
  writeResearchSession,
  type ResearchSession,
  type ResearchSessionWriteResult
} from "./research-session.js";
import { writeValidationPlan, type ValidationPlanWriteResult } from "./validation-plan.js";

export interface LeanMathlibValidationHarnessInput {
  rootPath: string;
  projectPath: string;
  title?: string;
  now?: string;
  maxLeanFiles?: number;
}

export interface LeanMathlibValidationTarget {
  familyId: string;
  familyTitle: string;
  lane: string;
  declarationName: string;
  sourcePath: string;
  signatureSha256: string;
}

export interface LeanMathlibValidationPlanResult extends LeanMathlibValidationTarget {
  validationPlan: ValidationPlanWriteResult;
}

export interface LeanMathlibValidationHarnessWriteResult {
  inspection: LeanProjectInspection;
  session: ResearchSession;
  sessionJsonPath: string;
  sessionMarkdownPath: string;
  sessionMarkdown: string;
  validationPlans: LeanMathlibValidationPlanResult[];
  familyCount: number;
  declarationCount: number;
  warnings: string[];
}

export async function writeLeanMathlibValidationHarness(
  input: LeanMathlibValidationHarnessInput
): Promise<LeanMathlibValidationHarnessWriteResult> {
  const inspection = await inspectLeanProject({
    rootPath: input.rootPath,
    projectPath: input.projectPath,
    maxLeanFiles: input.maxLeanFiles ?? 100
  });
  const targets = leanMathlibValidationTargets(inspection);
  const corpus = inspection.theoremCorpus;
  if (!corpus) {
    throw new Error(`Lean project ${input.projectPath} has no theorem-corpus.json.`);
  }

  const title = input.title ?? `${corpus.title ?? "Mathlib theorem corpus"} validation harness`;
  const sessionResult = await writeResearchSession({
    rootPath: input.rootPath,
    title,
    objective: `Close validation-plan-backed Lean/mathlib proof gates for ${targets.length} template-ready declaration${targets.length === 1 ? "" : "s"} in ${inspection.projectPath}.`,
    domains: ["math"],
    evidenceRefs: [
      {
        kind: "artifact",
        ref: corpus.path,
        summary: `Theorem corpus ${corpus.corpusId ?? "unknown-corpus"} inspected as planning input only; it is not proof evidence.`
      }
    ],
    tasks: targets.map(
      (target) => `Close Lean proof-check gate for ${target.familyId}/${target.declarationName}.`
    ),
    now: input.now
  });

  const validationPlans: LeanMathlibValidationPlanResult[] = [];
  for (const target of targets) {
    const claim = leanMathlibDeclarationValidationClaim({
      projectPath: inspection.projectPath,
      sourcePath: target.sourcePath,
      declarationName: target.declarationName
    });
    const validationPlan = await writeValidationPlan({
      rootPath: input.rootPath,
      title: `${target.familyTitle}: ${target.declarationName}`,
      claim,
      objective:
        `Attach an accepted, project-aware Lean proof-check record for ${target.declarationName} before this mathlib family can support a proved claim.`,
      domains: ["math"],
      evidenceRefs: [
        {
          kind: "session",
          ref: sessionResult.session.sessionId,
          summary: "Mathlib validation harness session that owns this theorem-family proof gate."
        },
        {
          kind: "artifact",
          ref: corpus.path,
          summary: `Theorem corpus ${corpus.corpusId ?? "unknown-corpus"} declares family ${target.familyId}.`
        },
        {
          kind: "artifact",
          ref: target.sourcePath,
          summary: `Lean source containing ${target.declarationName}; signature SHA-256 ${target.signatureSha256}.`
        }
      ],
      now: input.now
    });
    validationPlans.push({ ...target, validationPlan });
  }

  const linkedSession = await addResearchSessionCheckpoint({
    rootPath: input.rootPath,
    sessionRef: sessionResult.session.sessionId,
    summary: "Created linked validation plans for the mathlib theorem-family scaffold.",
    evidenceRefs: validationPlans.map((target) => ({
      kind: "validation" as const,
      ref: target.validationPlan.plan.planId,
      summary: `Validation proof gate for ${target.familyId}/${target.declarationName}.`
    })),
    decisions: [
      "Each mathlib family must close its own proof gate with scoped Lean proof-check evidence before it can support a proved claim.",
      "The theorem corpus and static inspection are planning evidence only; they never upgrade trust labels."
    ],
    nextChecks: validationPlans.map(
      (target) => `Run workspace run-next to attack ${target.familyId}/${target.declarationName}.`
    ),
    now: input.now
  });

  return {
    inspection,
    session: linkedSession.session,
    sessionJsonPath: linkedSession.jsonPath,
    sessionMarkdownPath: linkedSession.markdownPath,
    sessionMarkdown: linkedSession.markdown,
    validationPlans,
    familyCount: new Set(targets.map((target) => target.familyId)).size,
    declarationCount: targets.length,
    warnings: [
      "This harness writes validation plans only; it does not run Lean or mint proof evidence.",
      "A whole-file proof receipt without a matching statement boundary does not close family-scoped validation gates."
    ]
  };
}

export function leanMathlibDeclarationValidationClaim(input: {
  projectPath: string;
  sourcePath: string;
  declarationName: string;
}): string {
  return `Lean mathlib declaration ${input.declarationName} in project ${input.projectPath} source ${input.sourcePath}`;
}

function leanMathlibValidationTargets(inspection: LeanProjectInspection): LeanMathlibValidationTarget[] {
  const corpus = inspection.theoremCorpus;
  if (!corpus) {
    throw new Error(`Lean project ${inspection.projectPath} has no theorem-corpus.json.`);
  }
  if (!corpus.valid) {
    const issues = corpus.issues.slice(0, 3).map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Lean theorem corpus ${corpus.path} is invalid${issues ? `: ${issues}` : "."}`);
  }
  if (!corpus.declarationCoverage?.complete) {
    throw new Error(`Lean theorem corpus ${corpus.path} does not have complete template-ready declaration coverage.`);
  }
  if (corpus.declarationCoverage.templateReadyDeclarations !== corpus.declarationCoverage.matched.length) {
    throw new Error(
      `Lean theorem corpus ${corpus.path} has ${corpus.declarationCoverage.templateReadyDeclarations} template-ready declaration targets, but only ${corpus.declarationCoverage.matched.length} matched declarations were materialized for planning.`
    );
  }
  if (inspection.files.leanFiles.truncated || !inspection.declarations.completeProjectScan) {
    throw new Error(`Lean project ${inspection.projectPath} scan is truncated; refusing to seed proof gates from partial source inventory.`);
  }
  if (inspection.proofSafety.blocksProvedTrust) {
    throw new Error(`Lean project ${inspection.projectPath} has proof-safety markers; fix them before seeding proof gates.`);
  }

  const familiesById = new Map<string, LeanProjectTheoremCorpusFamilySummary>();
  for (const family of corpus.families.sample) {
    familiesById.set(family.familyId, family);
  }

  const targets = corpus.declarationCoverage.matched.map((match) => {
    const family = familiesById.get(match.familyId);
    return {
      familyId: match.familyId,
      familyTitle: family?.title ?? match.familyId,
      lane: family?.lane ?? "mathlib",
      declarationName: match.declarationName,
      sourcePath: match.path,
      signatureSha256: match.signatureSha256
    };
  });

  if (targets.length === 0) {
    throw new Error(`Lean theorem corpus ${corpus.path} has no template-ready declarations to validate.`);
  }

  return targets;
}