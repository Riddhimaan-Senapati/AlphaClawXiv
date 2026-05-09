#!/usr/bin/env node
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ensureMcpConfig,
  logout,
  readStoredAccessToken,
  saveToken,
  status,
  TOKEN_ACCESS_FIELD,
  TOKEN_REFRESH_FIELD
} from "./storage.js";

const DEFAULT_MCP_URL = "https://api.alphaxiv.org/mcp/v1";
const DEFAULT_SERVER_NAME = "alphaxiv";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_SCOPES = "openid profile email offline_access";
const ALPHAXIV_TOOL_DEFINITIONS = [
  {
    name: "discover_papers",
    description: "Discover and rank multiple candidate papers for a research topic.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        keywords: {
          type: "array",
          description: "3-4 concise keyword terms for exact matching.",
          items: { type: "string" }
        },
        question: {
          type: "string",
          description: "Detailed semantic description of the desired papers."
        },
        difficulty: {
          type: "number",
          description: "1-10 estimate of how much retrieval effort the query warrants."
        }
      },
      required: ["keywords", "question", "difficulty"]
    }
  },
  {
    name: "get_paper_content",
    description: "Fetch AlphaXiv paper content by AlphaXiv, arXiv, or paper URL.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        url: {
          type: "string",
          description: "AlphaXiv, arXiv, or paper URL."
        },
        fullText: {
          type: "boolean",
          description: "Whether to include full text when available."
        }
      },
      required: ["url"]
    }
  },
  {
    name: "answer_pdf_queries",
    description: "Return raw filtered PDF page content relevant to one or more questions.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        url: {
          type: "string",
          description: "PDF URL to analyze."
        },
        queries: {
          type: "array",
          description: "Questions to answer about the PDF.",
          items: { type: "string" }
        }
      },
      required: ["url", "queries"]
    }
  },
  {
    name: "read_files_from_github_repository",
    description: "Read files from a GitHub repository for AlphaXiv paper/code analysis.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        githubUrl: {
          type: "string",
          description: "GitHub repository URL."
        },
        path: {
          type: "string",
          description: "File or directory path inside the repository."
        }
      },
      required: ["githubUrl", "path"]
    }
  }
];

function parseJsonRpcResponse(contentType, text) {
  if (contentType.includes("text/event-stream")) {
    const messages = [];
    for (const block of text.split(/\r?\n\r?\n/)) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
        .trim();
      if (!data || data === "[DONE]") {
        continue;
      }
      messages.push(JSON.parse(data));
    }
    const message = messages.find((item) => item && (item.result || item.error)) || messages[messages.length - 1];
    if (!message) {
      throw new Error("AlphaXiv MCP returned an empty event stream.");
    }
    return message;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("AlphaXiv MCP did not return valid JSON.");
  }
}

async function callAlphaXivMcp(method, params, options = {}) {
  const accessToken = readStoredAccessToken();
  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs || 60_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(options.mcpUrl || DEFAULT_MCP_URL, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method,
        params
      }),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`AlphaXiv MCP returned HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    const message = parseJsonRpcResponse(response.headers.get("content-type") || "", text);
    if (message.error) {
      throw new Error(message.error.message || JSON.stringify(message.error));
    }
    return message.result;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`AlphaXiv MCP request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeToolResult(result) {
  const content = Array.isArray(result?.content) && result.content.length > 0
    ? result.content
    : [{ type: "text", text: JSON.stringify(result ?? {}, null, 2) }];
  return {
    content,
    details: result ?? {},
    isError: Boolean(result?.isError)
  };
}

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
  "with"
]);

function extractDiscoverKeywords(query) {
  const normalized = String(query || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const words = normalized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !DISCOVER_STOPWORDS.has(word));
  const ranked = [];
  const seen = new Set();
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

function buildDiscoverPapersArgs(query, mode = "default") {
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
  return {
    keywords,
    question: text,
    difficulty
  };
}

async function callAlphaXivTool(name, args) {
  const result = await callAlphaXivMcp("tools/call", {
    name,
    arguments: args || {}
  });
  return normalizeToolResult(result);
}

function printToolResult(result) {
  for (const item of result.content || []) {
    if (item?.type === "text" && typeof item.text === "string") {
      console.log(item.text);
    } else if (item) {
      console.log(JSON.stringify(item, null, 2));
    }
  }
}

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizePassageText(text) {
  return decodeXmlEntities(text)
    .replace(/([A-Za-z])-\n([A-Za-z])/g, "$1$2")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePaperPagesFromText(text) {
  const matches = Array.from(String(text || "").matchAll(/<page\s+num="([^"]+)">([\s\S]*?)<\/page>/g));
  return matches.map((match) => ({
    page: match[1],
    text: normalizePassageText(match[2])
  })).filter((item) => item.text);
}

function sentenceScore(sentence, question) {
  const normalizedSentence = sentence.toLowerCase();
  const normalizedQuestion = question.toLowerCase();
  const keywords = normalizedQuestion
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !new Set([
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
      "main"
    ]).has(word));
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

function looksLikeCleanSummarySentence(sentence) {
  const trimmed = sentence.trim();
  if (trimmed.length < 50 || trimmed.length > 420) {
    return false;
  }
  if (!/^[A-Z("]/.test(trimmed)) {
    return false;
  }
  if (/^[a-z]/.test(trimmed)) {
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

function extractCandidateSentences(pages, question) {
  const candidates = [];
  for (const page of pages) {
    const sentences = page.text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(looksLikeCleanSummarySentence);
    for (const sentence of sentences) {
      const score = sentenceScore(sentence, question);
      if (score > 0) {
        candidates.push({
          page: page.page,
          sentence,
          score
        });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function uniqueTopSentences(candidates, limit = 3) {
  const selected = [];
  const seen = new Set();
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

function formatPdfAskSummary(result, question) {
  const textParts = (result.content || [])
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text);
  const pages = textParts.flatMap(parsePaperPagesFromText);
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

function printPdfAskResult(result, question) {
  const summary = formatPdfAskSummary(result, question);
  if (summary) {
    console.log(summary);
    return;
  }
  printToolResult(result);
}

function createAlphaXivTool(definition) {
  return {
    ...definition,
    async execute(firstArg, secondArg) {
      const params = secondArg && typeof secondArg === "object" ? secondArg : firstArg;
      return callAlphaXivTool(definition.name, params || {});
    }
  };
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function randomUrlSafe(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function codeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${url} did not return valid JSON.`);
  }
}

function originFromUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  return `${parsed.protocol}//${parsed.host}`;
}

async function discoverOAuth(mcpUrl) {
  const resource = originFromUrl(mcpUrl);
  const protectedResourceMetadataUrl = new URL("/.well-known/oauth-protected-resource", resource).href;
  const protectedResource = await fetchJson(protectedResourceMetadataUrl);
  const authorizationServer = protectedResource.authorization_servers?.[0] || protectedResource.authorization_server;
  if (!authorizationServer) {
    throw new Error("AlphaXiv protected resource metadata did not include an authorization server.");
  }
  const authMetadataUrl = new URL("/.well-known/oauth-authorization-server", authorizationServer).href;
  const authorizationMetadata = await fetchJson(authMetadataUrl);
  for (const key of ["authorization_endpoint", "token_endpoint", "registration_endpoint"]) {
    if (!authorizationMetadata[key]) {
      throw new Error(`Authorization server metadata is missing ${key}.`);
    }
  }
  return {
    resource: protectedResource.resource || resource,
    protectedResource,
    authorizationMetadata
  };
}

async function registerOAuthClient(metadata, redirectUri) {
  const body = {
    client_name: "OpenClaw AlphaXiv OAuth",
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: DEFAULT_SCOPES
  };
  const client = await fetchJson(metadata.authorizationMetadata.registration_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!client.client_id) {
    throw new Error("OAuth registration did not return a client_id.");
  }
  return client;
}

function waitForCallback(server, expectedState, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for AlphaXiv OAuth callback."));
    }, timeoutMs);

    server.on("request", (req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (error) {
        clearTimeout(timer);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("AlphaXiv OAuth failed. You can close this tab.");
        server.close();
        reject(new Error(`AlphaXiv OAuth failed: ${error}`));
        return;
      }
      if (!code || state !== expectedState) {
        clearTimeout(timer);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid AlphaXiv OAuth callback. You can close this tab.");
        server.close();
        reject(new Error("Invalid AlphaXiv OAuth callback state."));
        return;
      }
      clearTimeout(timer);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!doctype html><title>AlphaXiv OAuth</title><h1>AlphaXiv OAuth complete</h1><p>You can close this tab and return to OpenClaw.</p>");
      server.close();
      resolve(code);
    });
  });
}

function listenLocalhost(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not bind a local OAuth callback port."));
        return;
      }
      resolve(address.port);
    });
  });
}

async function exchangeCode(metadata, client, redirectUri, verifier, code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: client.client_id,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    resource: metadata.resource
  });
  const token = await fetchJson(metadata.authorizationMetadata.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!token.access_token) {
    throw new Error("AlphaXiv token endpoint did not return an access token.");
  }
  return token;
}

async function loginWithNativeOAuth(options = {}) {
  const mcpUrl = options.mcpUrl || DEFAULT_MCP_URL;
  const metadata = await discoverOAuth(mcpUrl);
  const server = http.createServer();
  const port = await listenLocalhost(server);
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const client = await registerOAuthClient(metadata, redirectUri);
  const verifier = randomUrlSafe(48);
  const state = randomUrlSafe(24);
  const authorizationUrl = new URL(metadata.authorizationMetadata.authorization_endpoint);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", client.client_id);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", DEFAULT_SCOPES);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge(verifier));
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set("resource", metadata.resource);

  console.log("Open this AlphaXiv OAuth URL in your browser and complete login:");
  console.log(authorizationUrl.href);
  const code = await waitForCallback(server, state, 10 * 60 * 1000);
  const token = await exchangeCode(metadata, client, redirectUri, verifier, code);
  saveToken({
    [TOKEN_ACCESS_FIELD]: token.access_token,
    [TOKEN_REFRESH_FIELD]: token.refresh_token,
    tokenType: token.token_type || "Bearer",
    expiresAt: typeof token.expires_in === "number" ? Date.now() + token.expires_in * 1000 : undefined,
    scope: token.scope,
    source: "native-oauth",
    mcpUrl
  }, options);
  console.log("AlphaXiv auth configured. Restart OpenClaw gateway before using the native AlphaXiv tools.");
}

function printUsage() {
  console.log(`Usage:
  alphaclawxiv auth login [--mcp-url <url>] [--server-name <name>] [--timeout-ms <ms>]
  alphaclawxiv auth status [--server-name <name>]
  alphaclawxiv auth logout
  alphaclawxiv paper search <query>
  alphaclawxiv paper search-semantic <query>
  alphaclawxiv paper search-keyword <query>
  alphaclawxiv paper search-agentic <query>
  alphaclawxiv paper content <url> [--full-text]
  alphaclawxiv pdf ask <url> <question...>
  alphaclawxiv repo read <github-url> <path>
  alphaclawxiv mcp install [--mcp-url <url>] [--server-name <name>] [--timeout-ms <ms>]

Alias:
  alphaxiv ...
`);
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--mcp-url") {
      options.mcpUrl = argv[++i];
    } else if (item === "--server-name") {
      options.serverName = argv[++i];
    } else if (item === "--timeout-ms") {
      options.connectionTimeoutMs = Number(argv[++i]);
    } else if (item === "--full-text") {
      options.fullText = true;
    } else if (item === "--help" || item === "-h") {
      options.help = true;
    } else {
      positional.push(item);
    }
  }
  return { positional, options };
}

async function runStandalone(argv = process.argv.slice(2)) {
  const args = argv[0] === "alphaclawxiv" || argv[0] === "alphaxiv" ? argv.slice(1) : argv;
  const { positional, options } = parseArgs(args);
  if (options.help || positional.length === 0) {
    printUsage();
    return;
  }
  const [group, command] = positional;
  if (group === "auth" && command === "login") {
    await loginWithNativeOAuth(options);
    return;
  }
  if (group === "auth" && command === "status") {
    status(options);
    return;
  }
  if (group === "auth" && command === "logout") {
    logout();
    return;
  }
  if (group === "paper" && command === "search") {
    const query = positional.slice(2).join(" ").trim();
    if (!query) {
      throw new Error("Missing search query.");
    }
    printToolResult(await callAlphaXivTool("discover_papers", buildDiscoverPapersArgs(query, "agentic")));
    return;
  }
  if (group === "paper" && command === "search-semantic") {
    const query = positional.slice(2).join(" ").trim();
    if (!query) {
      throw new Error("Missing semantic search query.");
    }
    printToolResult(await callAlphaXivTool("discover_papers", buildDiscoverPapersArgs(query, "semantic")));
    return;
  }
  if (group === "paper" && command === "search-keyword") {
    const query = positional.slice(2).join(" ").trim();
    if (!query) {
      throw new Error("Missing keyword search query.");
    }
    printToolResult(await callAlphaXivTool("discover_papers", buildDiscoverPapersArgs(query, "keyword")));
    return;
  }
  if (group === "paper" && command === "search-agentic") {
    const query = positional.slice(2).join(" ").trim();
    if (!query) {
      throw new Error("Missing agentic search query.");
    }
    printToolResult(await callAlphaXivTool("discover_papers", buildDiscoverPapersArgs(query, "agentic")));
    return;
  }
  if (group === "paper" && command === "content") {
    const url = positional[2];
    if (!url) {
      throw new Error("Missing paper URL.");
    }
    printToolResult(await callAlphaXivTool("get_paper_content", { url, fullText: Boolean(options.fullText) }));
    return;
  }
  if (group === "pdf" && command === "ask") {
    const url = positional[2];
    const query = positional.slice(3).join(" ").trim();
    if (!url || !query) {
      throw new Error("Usage: alphaxiv pdf ask <url> <question...>");
    }
    printPdfAskResult(await callAlphaXivTool("answer_pdf_queries", { url, queries: [query] }), query);
    return;
  }
  if (group === "repo" && command === "read") {
    const githubUrl = positional[2];
    const repoPath = positional[3];
    if (!githubUrl || !repoPath) {
      throw new Error("Usage: alphaxiv repo read <github-url> <path>");
    }
    printToolResult(await callAlphaXivTool("read_files_from_github_repository", { githubUrl, path: repoPath }));
    return;
  }
  if (group === "mcp" && command === "install") {
    ensureMcpConfig(options);
    console.log("AlphaXiv generic MCP config installed in OpenClaw config. Native tools are preferred on current OpenClaw builds.");
    return;
  }
  printUsage();
  process.exitCode = 1;
}

function registerCli({ program }) {
  const root = program
    .command("alphaclawxiv")
    .alias("alphaxiv")
    .description("Manage AlphaClawXiv OAuth and native AlphaXiv tools");

  const auth = root.command("auth").description("Manage AlphaXiv OAuth");

  auth
    .command("login")
    .description("Print an AlphaXiv OAuth URL and configure native AlphaXiv tool auth after browser login")
    .option("--mcp-url <url>", "AlphaXiv MCP URL", DEFAULT_MCP_URL)
    .option("--server-name <name>", "OpenClaw MCP server name", DEFAULT_SERVER_NAME)
    .option("--timeout-ms <ms>", "OpenClaw MCP connection timeout", `${DEFAULT_TIMEOUT_MS}`)
    .action(async (opts) => {
      await loginWithNativeOAuth({
        mcpUrl: opts.mcpUrl,
        serverName: opts.serverName,
        connectionTimeoutMs: Number(opts.timeoutMs)
      });
    });

  auth
    .command("status")
    .description("Show AlphaXiv auth status without printing tokens")
    .option("--server-name <name>", "OpenClaw MCP server name", DEFAULT_SERVER_NAME)
    .action((opts) => {
      status({ serverName: opts.serverName });
    });

  auth
    .command("logout")
    .description("Remove AlphaXiv token from OpenClaw local state")
    .action(() => {
      logout();
    });

  const paper = root.command("paper").description("Use AlphaXiv paper tools");
  paper
    .command("search")
    .description("Search AlphaXiv papers with agentic retrieval")
    .argument("<query...>", "Search query")
    .action(async (queryParts) => {
      printToolResult(await callAlphaXivTool("discover_papers", buildDiscoverPapersArgs(queryParts.join(" "), "agentic")));
    });

  paper
    .command("search-semantic")
    .description("Search AlphaXiv papers by semantic similarity")
    .argument("<query...>", "Detailed semantic search query")
    .action(async (queryParts) => {
      printToolResult(await callAlphaXivTool("discover_papers", buildDiscoverPapersArgs(queryParts.join(" "), "semantic")));
    });

  paper
    .command("search-keyword")
    .description("Search AlphaXiv papers by keyword or full-text match")
    .argument("<query...>", "Keyword-oriented search query")
    .action(async (queryParts) => {
      printToolResult(await callAlphaXivTool("discover_papers", buildDiscoverPapersArgs(queryParts.join(" "), "keyword")));
    });

  paper
    .command("search-agentic")
    .description("Search AlphaXiv papers with multi-turn agentic retrieval")
    .argument("<query...>", "Research question or topic")
    .action(async (queryParts) => {
      printToolResult(await callAlphaXivTool("discover_papers", buildDiscoverPapersArgs(queryParts.join(" "), "agentic")));
    });

  paper
    .command("content")
    .description("Fetch paper content")
    .argument("<url>", "AlphaXiv, arXiv, or paper URL")
    .option("--full-text", "Request full text when available", false)
    .action(async (url, opts) => {
      printToolResult(await callAlphaXivTool("get_paper_content", {
        url,
        fullText: Boolean(opts.fullText)
      }));
    });

  const pdf = root.command("pdf").description("Retrieve PDF passages for questions");
  pdf
    .command("ask")
    .description("Ask AlphaXiv questions about a PDF URL")
    .argument("<url>", "PDF URL")
    .argument("<question...>", "Question to ask")
    .action(async (url, questionParts) => {
      const question = questionParts.join(" ");
      printPdfAskResult(await callAlphaXivTool("answer_pdf_queries", {
        url,
        queries: [question]
      }), question);
    });

  const repo = root.command("repo").description("Read paper implementation repositories");
  repo
    .command("read")
    .description("Read files from a GitHub repository")
    .argument("<github-url>", "GitHub repository URL")
    .argument("<path>", "File or directory path")
    .action(async (githubUrl, repoPath) => {
      printToolResult(await callAlphaXivTool("read_files_from_github_repository", {
        githubUrl,
        path: repoPath
      }));
    });

  const mcp = root.command("mcp").description("Manage AlphaXiv MCP config");
  mcp
    .command("install")
    .description("Install optional generic AlphaXiv MCP config into OpenClaw")
    .option("--mcp-url <url>", "AlphaXiv MCP URL", DEFAULT_MCP_URL)
    .option("--server-name <name>", "OpenClaw MCP server name", DEFAULT_SERVER_NAME)
    .option("--timeout-ms <ms>", "OpenClaw MCP connection timeout", `${DEFAULT_TIMEOUT_MS}`)
    .action((opts) => {
      ensureMcpConfig({
        mcpUrl: opts.mcpUrl,
        serverName: opts.serverName,
        connectionTimeoutMs: Number(opts.timeoutMs)
      });
      console.log("AlphaXiv generic MCP config installed in OpenClaw config. Native tools are preferred on current OpenClaw builds.");
    });
}

const plugin = {
  id: "alphaclawxiv",
  name: "AlphaClawXiv",
  description: "Native OpenClaw OAuth, full AlphaXiv MCP paper retrieval tools, PDF analysis, and repository-reading tools.",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      mcpUrl: { type: "string", default: DEFAULT_MCP_URL },
      serverName: { type: "string", default: DEFAULT_SERVER_NAME },
      connectionTimeoutMs: { type: "number", minimum: 1, default: DEFAULT_TIMEOUT_MS }
    }
  },
  register(api) {
    if (typeof api.registerTool === "function") {
      for (const definition of ALPHAXIV_TOOL_DEFINITIONS) {
        api.registerTool(createAlphaXivTool(definition));
      }
    }
    if (typeof api.registerCli === "function") {
      api.registerCli(registerCli, {
        descriptors: [
          {
            name: "alphaxiv",
            description: "Manage AlphaClawXiv OAuth and native AlphaXiv tools",
            hasSubcommands: true
          },
          {
            name: "alphaclawxiv",
            description: "Manage AlphaClawXiv OAuth and native AlphaXiv tools",
            hasSubcommands: true
          }
        ]
      });
    }
  }
};

export default plugin;

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  runStandalone().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
