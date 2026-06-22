import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("professor evidence reviewer commands", () => {
  it("keeps the strict all-engine reviewer packet wired through npm, compose, and docs", async () => {
    const [packageJson, compose, professorEvidence, dockerProfessor, hardMathClosure, reviewerDocs] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("docker-compose.yml", "utf8"),
      readFile("tools/professor-evidence.mjs", "utf8"),
      readFile("tools/docker-professor.mjs", "utf8"),
      readFile("tools/hard-math-closure.mjs", "utf8"),
      readFile("docs/DOCKER_REVIEWER_FLOW.md", "utf8")
    ]);
    const scripts = (JSON.parse(packageJson) as { scripts: Record<string, string> }).scripts;

    expect(scripts["docker:professor:all"]).toBe("node tools/docker-professor.mjs --all-engines");
    expect(scripts["docker:reviewer:all"]).toBe("npm run docker:professor:all");
    expect(Object.entries(scripts).filter(([, command]) => command.includes("npm run cli --"))).toEqual([]);
    expect(scripts["docker:sandbox"]).toContain("node apps/cli/dist/index.js code sandbox-status --json");
    expect(scripts["proof:lean-fixture"]).toContain("node apps/cli/dist/index.js proof project");

    expect(compose).toContain("professor-evidence-all:");
    expect(compose).toContain("image: truth-harness:all-engines");
    expect(compose).toContain('command: ["npm", "run", "professor:evidence", "--", "--all-engines"]');

    expect(professorEvidence).toContain("const strictAllEngines");
    expect(professorEvidence).toContain('["--require-all-engines"]');
    expect(professorEvidence).toContain('"--require-maxima", "--require-z3", "--require-cvc5", "--require-lean"');
    expect(professorEvidence).toContain('"tools/hard-math-closure.mjs"');
    expect(professorEvidence).toContain('"exact-fraction-lemma"');
    expect(professorEvidence).toContain('"symbolic-cas-closure-fixture"');
    expect(professorEvidence).toContain('"smt-bounded-closure-fixture"');
    expect(professorEvidence).toContain('"exact-computed"');
    expect(professorEvidence).toContain('"cross-checked"');
    expect(professorEvidence).toContain('"smt-checked"');
    const verifyBundleStep = professorEvidence.slice(professorEvidence.indexOf('"verify-credibility-bundle"'));
    expect(verifyBundleStep).toContain('"verify-credibility-bundle"');
    expect(verifyBundleStep).toContain('"--write"');
    expect(verifyBundleStep.indexOf('"--write"')).toBeLessThan(verifyBundleStep.indexOf('"--fail-on-bundle-change"'));
    expect(verifyBundleStep.indexOf('"--fail-on-bundle-change"')).toBeLessThan(
      verifyBundleStep.indexOf('"--fail-on-source-drift"')
    );

    expect(dockerProfessor).toContain('compose", "build", "all-engines');
    expect(dockerProfessor).toContain("professor-evidence-all");
    expect(dockerProfessor).toContain("professor and closure evidence");

    expect(hardMathClosure).toContain("process.env.TRUTH_HARNESS_MAXIMA");
    expect(hardMathClosure).toContain("process.env.TRUTH_HARNESS_Z3");

    expect(reviewerDocs).toContain("npm run docker:reviewer:all");
    expect(reviewerDocs).toContain("Maxima, Z3, cvc5, Lean, and SageMath");
    expect(reviewerDocs).toContain("exact/symbolic/SMT hard-math closure evidence");
  });
});
