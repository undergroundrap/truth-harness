import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("professor evidence reviewer commands", () => {
  it("keeps the strict all-engine reviewer packet wired through npm, compose, and docs", async () => {
    const [packageJson, compose, professorEvidence, dockerProfessor, reviewerDocs] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("docker-compose.yml", "utf8"),
      readFile("tools/professor-evidence.mjs", "utf8"),
      readFile("tools/docker-professor.mjs", "utf8"),
      readFile("docs/DOCKER_REVIEWER_FLOW.md", "utf8")
    ]);
    const scripts = (JSON.parse(packageJson) as { scripts: Record<string, string> }).scripts;

    expect(scripts["docker:professor:all"]).toBe("node tools/docker-professor.mjs --all-engines");
    expect(scripts["docker:reviewer:all"]).toBe("npm run docker:professor:all");

    expect(compose).toContain("professor-evidence-all:");
    expect(compose).toContain("image: truth-harness:all-engines");
    expect(compose).toContain('command: ["npm", "run", "professor:evidence", "--", "--all-engines"]');

    expect(professorEvidence).toContain("const strictAllEngines");
    expect(professorEvidence).toContain('["--require-all-engines"]');
    expect(professorEvidence).toContain('"--require-maxima", "--require-z3", "--require-cvc5", "--require-lean"');

    expect(dockerProfessor).toContain('compose", "build", "all-engines');
    expect(dockerProfessor).toContain("professor-evidence-all");

    expect(reviewerDocs).toContain("npm run docker:reviewer:all");
    expect(reviewerDocs).toContain("Maxima, Z3, cvc5, Lean, and SageMath");
  });
});
