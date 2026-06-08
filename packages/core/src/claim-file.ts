import { createReceipt } from "./receipt.js";
import type { Receipt, TrustLabel } from "./types.js";

const TRUST_LABELS = new Set<TrustLabel>([
  "proved",
  "exact-computed",
  "bounded-numeric",
  "smt-checked",
  "source-cited",
  "cross-checked",
  "unverified",
  "refuted"
]);

const STRICT_PASS_TRUST = new Set<TrustLabel>([
  "proved",
  "exact-computed",
  "bounded-numeric",
  "smt-checked",
  "source-cited",
  "cross-checked"
]);

export interface ClaimBlock {
  filePath: string;
  index: number;
  startLine: number;
  endLine: number;
  problem: string;
  expectTrust?: TrustLabel;
}

export interface ClaimCheck {
  block: ClaimBlock;
  receipt: Receipt;
  passed: boolean;
  message: string;
}

export interface ClaimFileCheck {
  filePath: string;
  total: number;
  passed: number;
  failed: number;
  checks: ClaimCheck[];
}

export function parseClaimBlocks(markdown: string, filePath: string): ClaimBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: ClaimBlock[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    if (!isFenceStart(lines[cursor])) {
      cursor += 1;
      continue;
    }

    const startLine = cursor + 1;
    const body: string[] = [];
    cursor += 1;

    while (cursor < lines.length && !isFenceEnd(lines[cursor])) {
      body.push(lines[cursor]);
      cursor += 1;
    }

    const endLine = cursor < lines.length ? cursor + 1 : lines.length;
    blocks.push(parseClaimBlock(body, filePath, blocks.length + 1, startLine, endLine));
    cursor += 1;
  }

  return blocks;
}

export function checkClaimFile(markdown: string, filePath: string): ClaimFileCheck {
  const checks = parseClaimBlocks(markdown, filePath).map(checkClaimBlock);
  const passed = checks.filter((check) => check.passed).length;

  return {
    filePath,
    total: checks.length,
    passed,
    failed: checks.length - passed,
    checks
  };
}

export function checkClaimBlock(block: ClaimBlock): ClaimCheck {
  const receipt = createReceipt(block.problem);
  const passed = block.expectTrust ? receipt.trust === block.expectTrust : STRICT_PASS_TRUST.has(receipt.trust);
  const message = passed ? passMessage(block, receipt) : failMessage(block, receipt);

  return {
    block,
    receipt,
    passed,
    message
  };
}

function parseClaimBlock(
  body: string[],
  filePath: string,
  index: number,
  startLine: number,
  endLine: number
): ClaimBlock {
  let expectTrust: TrustLabel | undefined;
  const problemLines: string[] = [];

  for (const rawLine of body) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    const expectMatch = /^expect:\s*([a-z-]+)$/i.exec(line);
    if (expectMatch) {
      const label = expectMatch[1] as TrustLabel;
      if (!TRUST_LABELS.has(label)) {
        throw new Error(`${filePath}:${startLine} has unsupported trust label ${JSON.stringify(label)}`);
      }
      expectTrust = label;
      continue;
    }

    problemLines.push(line);
  }

  const problem = problemLines.join(" ").trim();
  if (!problem) {
    throw new Error(`${filePath}:${startLine} has an empty theorem-workbench block`);
  }

  return {
    filePath,
    index,
    startLine,
    endLine,
    problem,
    expectTrust
  };
}

function passMessage(block: ClaimBlock, receipt: Receipt): string {
  if (block.expectTrust) {
    return `expected ${block.expectTrust}, received ${receipt.trust}`;
  }

  return `strict trust accepted: ${receipt.trust}`;
}

function failMessage(block: ClaimBlock, receipt: Receipt): string {
  if (block.expectTrust) {
    return `expected ${block.expectTrust}, received ${receipt.trust}`;
  }

  return `strict trust rejected: ${receipt.trust}`;
}

function isFenceStart(line: string): boolean {
  return /^```(?:theorem-workbench|theorem)\s*$/.test(line.trim());
}

function isFenceEnd(line: string): boolean {
  return /^```\s*$/.test(line.trim());
}
