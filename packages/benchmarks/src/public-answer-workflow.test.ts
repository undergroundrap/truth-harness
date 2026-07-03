import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const workflowPath = resolve(root, "docs/PUBLIC_ANSWER_WORKFLOW.md");
const answersDir = resolve(root, "docs/public-answers");
const answerIndexPath = resolve(answersDir, "README.md");

const allowedStatuses = new Set(["draft", "self-reviewed", "external-review-needed", "corrected", "withdrawn"]);
const allowedPostingStatuses = new Set(["not-posted", "posted", "superseded", "do-not-post"]);

function publicAnswerPacketFiles(): string[] {
  return readdirSync(answersDir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .map((name) => resolve(answersDir, name))
    .sort();
}

function readRequiredField(markdown: string, field: string): string {
  const match = markdown.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  expect(match, `${field} field is required`).not.toBeNull();
  return match?.[1]?.trim() ?? "";
}

describe("public answer workflow", () => {
  it("documents the posting guardrails before answers leave the repo", () => {
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("Do not post:");
    expect(workflow).toContain("answers to active homework or exams");
    expect(workflow).toContain("`proved` claims unless an accepted proof checker minted that label");
    expect(workflow).toContain("The Docker commands are the preferred public credibility path");
    expect(workflow).toContain("Every public answer packet should include:");
  });

  it("keeps every public answer packet source-linked, replayable, and boundary-labeled", () => {
    expect(existsSync(answersDir)).toBe(true);
    expect(existsSync(answerIndexPath)).toBe(true);

    const index = readFileSync(answerIndexPath, "utf8");
    const packets = publicAnswerPacketFiles();
    expect(packets.length).toBeGreaterThan(0);

    for (const packetPath of packets) {
      const packetName = basename(packetPath);
      const markdown = readFileSync(packetPath, "utf8");

      expect(index, `${packetName} must be listed in docs/public-answers/README.md`).toContain(packetName);
      expect(markdown, `${packetName} needs a public answer title`).toMatch(/^# Public Answer: .+/m);
      expect(markdown, `${packetName} needs source section`).toContain("## Source");
      expect(markdown, `${packetName} needs question section`).toContain("## Question");
      expect(markdown, `${packetName} needs normalized claim section`).toContain("## Normalized Claim");
      expect(markdown, `${packetName} needs answer section`).toContain("## Answer");
      expect(markdown, `${packetName} needs evidence section`).toContain("## Evidence");
      expect(markdown, `${packetName} needs replay section`).toContain("## Replay");
      expect(markdown, `${packetName} needs boundary section`).toContain("## Boundary");
      expect(markdown, `${packetName} needs public reply draft`).toContain("## Public Reply Draft");

      const status = readRequiredField(markdown, "Status");
      const reviewStatus = readRequiredField(markdown, "Review status");
      const postingStatus = readRequiredField(markdown, "Posting status");
      expect(allowedStatuses.has(status), `${packetName} has unsupported Status ${status}`).toBe(true);
      expect(allowedStatuses.has(reviewStatus), `${packetName} has unsupported Review status ${reviewStatus}`).toBe(true);
      expect(allowedPostingStatuses.has(postingStatus), `${packetName} has unsupported Posting status ${postingStatus}`).toBe(true);

      expect(markdown, `${packetName} needs a source URL`).toMatch(/^- URL: https?:\/\//m);
      expect(markdown, `${packetName} needs an access date`).toMatch(/^- Accessed: \d{4}-\d{2}-\d{2}$/m);
      expect(markdown, `${packetName} must name a trust label`).toMatch(/trust label/i);
      expect(markdown, `${packetName} must cite evidence artifacts or suites`).toMatch(/Benchmark suite:|Receipt refs:|Proof record:|SMT record:|CAS record:/i);
      expect(markdown, `${packetName} needs a replay command fence`).toMatch(/```bash[\s\S]*?(npm run|truth-harness)[\s\S]*?```/);
      expect(markdown, `${packetName} must not list proved as a trust label unless proof evidence is present`).not.toMatch(/^- Trust label[^:\n]*:\s*`proved`/im);
      if (/CAS|Maxima|SymPy/i.test(markdown)) {
        expect(markdown, `${packetName} must say CAS evidence is not a formal proof`).toMatch(/not `proved`|does not claim a formal theorem proof/i);
      }
    }
  });
});