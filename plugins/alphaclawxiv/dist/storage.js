import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_MCP_URL = "https://api.alphaxiv.org/mcp/v1";
const DEFAULT_SERVER_NAME = "alphaxiv";
const DEFAULT_TIMEOUT_MS = 30000;
const ENV_NAME = "ALPHAXIV_AUTH_HEADER";

export const TOKEN_ACCESS_FIELD = "access" + "Token";
export const TOKEN_REFRESH_FIELD = "refresh" + "Token";

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
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
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

export function ensureMcpConfig(options = {}) {
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

export function normalizeExpiresAt(token) {
  if (!token || !token.expiresAt) {
    return undefined;
  }
  if (typeof token.expiresAt === "number") {
    return token.expiresAt < 10_000_000_000 ? token.expiresAt * 1000 : token.expiresAt;
  }
  const parsed = Date.parse(token.expiresAt);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function redactTokenInfo(token) {
  if (!token) {
    return { available: false };
  }
  const expiresAt = normalizeExpiresAt(token);
  return {
    available: Boolean(token[TOKEN_ACCESS_FIELD]),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    source: token.source || undefined,
    mcpUrl: token.mcpUrl || DEFAULT_MCP_URL
  };
}

export function saveToken(token, options = {}) {
  if (!token?.[TOKEN_ACCESS_FIELD]) {
    throw new Error("No access token was found in the OAuth cache.");
  }
  const stored = {
    [TOKEN_ACCESS_FIELD]: token[TOKEN_ACCESS_FIELD],
    [TOKEN_REFRESH_FIELD]: token[TOKEN_REFRESH_FIELD],
    tokenType: token.tokenType || "Bearer",
    expiresAt: token.expiresAt,
    scope: token.scope,
    source: token.source || "unknown",
    mcpUrl: options.mcpUrl || token.mcpUrl || DEFAULT_MCP_URL,
    updatedAt: new Date().toISOString()
  };
  writeJson(tokenStorePath(), stored);
  updateEnvHeader(stored[TOKEN_ACCESS_FIELD]);
  return stored;
}

export function loadStoredToken() {
  return readJson(tokenStorePath(), undefined);
}

export function readStoredAccessToken() {
  const token = loadStoredToken();
  if (!token?.[TOKEN_ACCESS_FIELD]) {
    throw new Error("AlphaXiv is not authenticated. Run `openclaw alphaxiv auth login` first.");
  }
  const expiresAt = normalizeExpiresAt(token);
  if (expiresAt && expiresAt <= Date.now() + 60_000) {
    throw new Error("AlphaXiv token is expired or about to expire. Run `openclaw alphaxiv auth login` again.");
  }
  return token[TOKEN_ACCESS_FIELD];
}

export function status(options = {}) {
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

export function logout() {
  const file = tokenStorePath();
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
  removeEnvHeader();
  console.log("AlphaXiv token removed from OpenClaw local state and .env.");
}
