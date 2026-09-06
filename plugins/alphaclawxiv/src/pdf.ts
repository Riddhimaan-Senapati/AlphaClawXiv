import { printToolResult, textFromResult } from "./mcp.js";
import type { AgentToolResult } from "./sdk-types.js";

const QUESTION_STOPWORDS = new Set([
  "what",
  "which",
  "when",
  "where",
  "why",
  "how",
  "does",
  "this",
  "that",
  "with",
  "from",
  "into",
  "about",
  "main",
]);

export function decodeXmlEntities(text: string): string {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function normalizePassageText(text: string): string {
  return decodeXmlEntities(text)
    .replace(/([A-Za-z])-\n([A-Za-z])/g, "$1$2")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type PaperPage = { page: string; text: string };

export function parsePaperPagesFromText(text: string): PaperPage[] {
  const matches = Array.from(String(text || "").matchAll(/<page\s+num="([^"]+)">([\s\S]*?)<\/page>/g));
  return matches
    .map((match) => ({ page: match[1], text: normalizePassageText(match[2]) }))
    .filter((item) => item.text);
}

function sentenceScore(sentence: string, question: string): number {
  const normalizedSentence = sentence.toLowerCase();
  const normalizedQuestion = question.toLowerCase();
  const keywords = normalizedQuestion
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !QUESTION_STOPWORDS.has(word));
  let score = 0;
  for (const keyword of keywords) {
    if (normalizedSentence.includes(keyword)) {
      score += 2;
    }
  }
  if (/main contribution|contribution|key contribution|primary contribution/.test(normalizedQuestion)) {
    if (/\b(this paper|this survey|the study|this work|we present|we propose|we introduce|aims to|organizes|highlights)\b/.test(normalizedSentence)) {
      score += 6;
    }
    if (/\babstract\b/.test(normalizedSentence)) {
      score += 1;
    }
  }
  if (normalizedSentence.length > 60 && normalizedSentence.length < 420) {
    score += 1;
  }
  return score;
}

function looksLikeCleanSummarySentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (trimmed.length < 50 || trimmed.length > 420) {
    return false;
  }
  if (!/^[A-Z("]/.test(trimmed)) {
    return false;
  }
  if (!/[.!?]$/.test(trimmed)) {
    return false;
  }
  if (/\b[a-z]{1,2} [A-Z][a-z]+/.test(trimmed.slice(0, 20))) {
    return false;
  }
  return true;
}

type Candidate = { page: string; sentence: string; score: number };

function extractCandidateSentences(pages: PaperPage[], question: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const page of pages) {
    const sentences = page.text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(looksLikeCleanSummarySentence);
    for (const sentence of sentences) {
      const score = sentenceScore(sentence, question);
      if (score > 0) {
        candidates.push({ page: page.page, sentence, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function uniqueTopSentences(candidates: Candidate[], limit = 3): Candidate[] {
  const selected: Candidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.sentence.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    selected.push(candidate);
    if (selected.length >= limit) {
      break;
    }
  }
  return selected;
}

export function formatPdfAskSummary(result: AgentToolResult<unknown>, question: string): string | null {
  const pages = textFromResult(result).flatMap(parsePaperPagesFromText);
  if (pages.length === 0) {
    return null;
  }
  const top = uniqueTopSentences(extractCandidateSentences(pages, question));
  if (top.length === 0) {
    return null;
  }
  const answer = top.slice(0, 2).map((item) => item.sentence).join(" ");
  const supportingPages = [...new Set(top.map((item) => item.page))].join(", ");
  return `Answer: ${answer}\n\nSupporting pages: ${supportingPages}`;
}

export function printPdfAskResult(result: AgentToolResult<unknown>, question: string): void {
  const summary = formatPdfAskSummary(result, question);
  if (summary) {
    console.log(summary);
    return;
  }
  printToolResult(result);
}
