import { callAlphaXivTool, printToolResult } from "./mcp.js";
import { printPdfAskResult } from "./pdf.js";
import type { AgentToolResult } from "./sdk-types.js";

const DISCOVER_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "latest",
  "of",
  "on",
  "or",
  "the",
  "their",
  "this",
  "to",
  "using",
  "what",
  "with",
]);

export function extractDiscoverKeywords(query: string): string[] {
  const normalized = String(query || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const words = normalized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !DISCOVER_STOPWORDS.has(word));
  const ranked: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    if (seen.has(word)) {
      continue;
    }
    seen.add(word);
    ranked.push(word);
    if (ranked.length >= 4) {
      break;
    }
  }
  return ranked.length > 0 ? ranked : ["research", "papers"];
}

export function buildDiscoverPapersArgs(query: string, mode: "default" | "semantic" | "keyword" | "agentic" = "default"): Record<string, unknown> {
  const text = String(query || "").trim();
  const keywords = extractDiscoverKeywords(text);
  let difficulty = 5;
  if (mode === "semantic") {
    difficulty = 6;
  } else if (mode === "agentic") {
    difficulty = 8;
  } else if (mode === "keyword") {
    difficulty = 4;
  }
  return { keywords, question: text, difficulty };
}

export async function runTool(name: string, args: Record<string, unknown>): Promise<AgentToolResult<unknown>> {
  return callAlphaXivTool(name, args || {});
}

export type DiscoverMode = "default" | "semantic" | "keyword" | "agentic";

export async function runDiscoverPapers(query: string, mode: DiscoverMode = "default"): Promise<AgentToolResult<unknown>> {
  return runTool("discover_papers", buildDiscoverPapersArgs(query, mode));
}

export async function runPaperContent(url: string, fullText = false): Promise<AgentToolResult<unknown>> {
  return runTool("get_paper_content", { url, fullText: Boolean(fullText) });
}

export async function runPdfAsk(paper: string, question: string): Promise<AgentToolResult<unknown>> {
  return runTool("answer_pdf_queries", { paper, queries: [question] });
}

export async function runRepoRead(githubUrl: string, repoPath: string): Promise<AgentToolResult<unknown>> {
  return runTool("read_files_from_github_repository", { githubUrl, path: repoPath });
}

export async function printDiscoverPapers(query: string, mode: DiscoverMode = "default") {
  printToolResult(await runDiscoverPapers(query, mode));
}

export async function printPaperContent(url: string, fullText = false) {
  printToolResult(await runPaperContent(url, fullText));
}

export async function printPdfAsk(paper: string, question: string) {
  printPdfAskResult(await runPdfAsk(paper, question), question);
}

export async function printRepoRead(githubUrl: string, repoPath: string) {
  printToolResult(await runRepoRead(githubUrl, repoPath));
}
