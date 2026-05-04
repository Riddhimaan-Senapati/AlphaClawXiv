#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_MCP_URL = "https://api.alphaxiv.org/mcp/v1";
const DEFAULT_SERVER_NAME = "alphaxiv";
const DEFAULT_TIMEOUT_MS = 30000;
const ENV_NAME = "ALPHAXIV_AUTH_HEADER";
const DEFAULT_SCOPES = "openid profile email offline_access";
const ALPHAXIV_TOOL_DEFINITIONS = [
  {
    name: "paper_search",
    description: "Search AlphaXiv for papers relevant to a natural-language query.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "Natural-language search query."
        }
      },
      required: ["query"]
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

function configDir() {
  return path.join(os.homedir(), ".openclaw");
}

function pluginStateDir() {
  return path.join(configDir(), "alphaxiv");
}

function tokenStorePath() {
  return path.join(pluginStateDir(), "oauth.json");
}

function openclawConfigPath() {
  return path.join(configDir(), "openclaw.json");
}

function openclawEnvPath() {
  return path.join(configDir(), ".env");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function quoteEnvValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function updateEnvHeader(accessToken) {
  ensureDir(configDir());
  const file = openclawEnvPath();
  const headerValue = `Bearer ${accessToken}`;
  const line = `${ENV_NAME}=${quoteEnvValue(headerValue)}`;
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const lines = existing.split(/\r?\n/);
  let replaced = false;
  const next = lines.map((current) => {
    if (/^\s*ALPHAXIV_AUTH_HEADER\s*=/.test(current)) {
      replaced = true;
      return line;
    }
    return current;
  });
  if (!replaced) {
    if (next.length > 0 && next[next.length - 1] !== "") {
      next.push("");
    }
    next.push(line);
  }
  fs.writeFileSync(file, `${next.filter((item, index) => item !== "" || index < next.length - 1).join(os.EOL)}${os.EOL}`, { mode: 0o600 });
}

function removeEnvHeader() {
  const file = openclawEnvPath();
  if (!fs.existsSync(file)) {
    return;
  }
  const existing = fs.readFileSync(file, "utf8");
  const next = existing
    .split(/\r?\n/)
    .filter((line) => !/^\s*ALPHAXIV_AUTH_HEADER\s*=/.test(line))
    .join(os.EOL);
  fs.writeFileSync(file, next.endsWith(os.EOL) || next.length === 0 ? next : `${next}${os.EOL}`);
}

function ensureMcpConfig(options = {}) {
  const mcpUrl = options.mcpUrl || DEFAULT_MCP_URL;
  const serverName = options.serverName || DEFAULT_SERVER_NAME;
  const connectionTimeoutMs = Number(options.connectionTimeoutMs || DEFAULT_TIMEOUT_MS);
  const file = openclawConfigPath();
  const cfg = readJson(file, {});
  cfg.mcp = cfg.mcp && typeof cfg.mcp === "object" ? cfg.mcp : {};
  cfg.mcp.servers = cfg.mcp.servers && typeof cfg.mcp.servers === "object" ? cfg.mcp.servers : {};
  cfg.mcp.servers[serverName] = {
    url: mcpUrl,
    transport: "streamable-http",
    connectionTimeoutMs,
    headers: {
      Authorization: "${ALPHAXIV_AUTH_HEADER}"
    }
  };
  ensureDir(configDir());
  fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
}

function redactTokenInfo(token) {
  if (!token) {
    return { available: false };
  }
  const expiresAt = normalizeExpiresAt(token);
  return {
    available: Boolean(token.accessToken),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    source: token.source || undefined,
    mcpUrl: token.mcpUrl || DEFAULT_MCP_URL
  };
}

function normalizeExpiresAt(token) {
  if (!token || !token.expiresAt) {
    return undefined;
  }
  if (typeof token.expiresAt === "number") {
    return token.expiresAt < 10_000_000_000 ? token.expiresAt * 1000 : token.expiresAt;
  }
  const parsed = Date.parse(token.expiresAt);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function saveToken(token, options = {}) {
  if (!token?.accessToken) {
    throw new Error("No access token was found in the OAuth cache.");
  }
  const stored = {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    tokenType: token.tokenType || "Bearer",
    expiresAt: token.expiresAt,
    scope: token.scope,
    source: token.source || "unknown",
    mcpUrl: options.mcpUrl || token.mcpUrl || DEFAULT_MCP_URL,
    updatedAt: new Date().toISOString()
  };
  writeJson(tokenStorePath(), stored);
  updateEnvHeader(stored.accessToken);
  return stored;
}

function loadStoredToken() {
  return readJson(tokenStorePath(), undefined);
}

function readStoredAccessToken() {
  const token = loadStoredToken();
  if (!token?.accessToken) {
    throw new Error("AlphaXiv is not authenticated. Run `openclaw alphaxiv auth login` first.");
  }
  const expiresAt = normalizeExpiresAt(token);
  if (expiresAt && expiresAt <= Date.now() + 60_000) {
    throw new Error("AlphaXiv token is expired or about to expire. Run `openclaw alphaxiv auth login` again.");
  }
  return token.accessToken;
}

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
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: token.token_type || "Bearer",
    expiresAt: typeof token.expires_in === "number" ? Date.now() + token.expires_in * 1000 : undefined,
    scope: token.scope,
    source: "native-oauth",
    mcpUrl
  }, options);
  console.log("AlphaXiv auth configured. Restart OpenClaw gateway before using the native AlphaXiv tools.");
}

function status(options = {}) {
  const token = loadStoredToken();
  const info = redactTokenInfo(token);
  const cfg = readJson(openclawConfigPath(), {});
  const serverName = options.serverName || DEFAULT_SERVER_NAME;
  const hasMcp = Boolean(cfg?.mcp?.servers?.[serverName]);
  const hasEnv = fs.existsSync(openclawEnvPath()) && /^\s*ALPHAXIV_AUTH_HEADER\s*=/m.test(fs.readFileSync(openclawEnvPath(), "utf8"));
  console.log(JSON.stringify({
    token: info,
    nativeToolsConfigured: true,
    openclawEnvConfigured: hasEnv,
    openclawMcpConfigured: hasMcp,
    mcpServerName: serverName,
    mcpUrl: cfg?.mcp?.servers?.[serverName]?.url || options.mcpUrl || DEFAULT_MCP_URL
  }, null, 2));
}

function logout() {
  const file = tokenStorePath();
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
  removeEnvHeader();
  console.log("AlphaXiv token removed from OpenClaw local state and .env.");
}

function printUsage() {
  console.log(`Usage:
  alphaclawxiv auth login [--mcp-url <url>] [--server-name <name>] [--timeout-ms <ms>]
  alphaclawxiv auth status [--server-name <name>]
  alphaclawxiv auth logout
  alphaclawxiv paper search <query>
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
    printToolResult(await callAlphaXivTool("paper_search", { query }));
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
    printToolResult(await callAlphaXivTool("answer_pdf_queries", { url, queries: [query] }));
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
    .description("Search AlphaXiv papers")
    .argument("<query...>", "Search query")
    .action(async (queryParts) => {
      printToolResult(await callAlphaXivTool("paper_search", { query: queryParts.join(" ") }));
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
      printToolResult(await callAlphaXivTool("answer_pdf_queries", {
        url,
        queries: [questionParts.join(" ")]
      }));
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
  description: "Native OpenClaw OAuth, paper search, PDF passage retrieval, and repository-reading tools for AlphaXiv.",
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
