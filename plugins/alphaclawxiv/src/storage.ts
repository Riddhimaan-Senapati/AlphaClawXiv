import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_MCP_URL,
  DEFAULT_SERVER_NAME,
  DEFAULT_TIMEOUT_MS,
  ENV_NAME,
  TOKEN_ACCESS_FIELD,
  TOKEN_REFRESH_FIELD,
} from "./config.js";

function configDir(): string {
  return path.join(os.homedir(), ".openclaw");
}

function pluginStateDir(): string {
  return path.join(configDir(), "alphaxiv");
}

function tokenStorePath(): string {
  return path.join(pluginStateDir(), "oauth.json");
}

function openclawConfigPath(): string {
  return path.join(configDir(), "openclaw.json");
}

function openclawEnvPath(): string {
  return path.join(configDir(), ".env");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file: string, fallback?: unknown): Record<string, unknown> | undefined {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return fallback as Record<string, unknown> | undefined;
  }
}

function writeJson(file: string, value: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function quoteEnvValue(value: string): string {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function updateEnvHeader(accessToken: string): void {
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

function removeEnvHeader(): void {
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

export function ensureMcpConfig(options: { mcpUrl?: string; serverName?: string; connectionTimeoutMs?: number } = {}): void {
  const mcpUrl = options.mcpUrl || DEFAULT_MCP_URL;
  const serverName = options.serverName || DEFAULT_SERVER_NAME;
  const connectionTimeoutMs = Number(options.connectionTimeoutMs || DEFAULT_TIMEOUT_MS);
  const file = openclawConfigPath();
  const cfg = readJson(file, {}) || {};
  cfg.mcp = cfg.mcp && typeof cfg.mcp === "object" ? (cfg.mcp as Record<string, unknown>) : {};
  const mcp = cfg.mcp as Record<string, unknown>;
  mcp.servers = mcp.servers && typeof mcp.servers === "object" ? (mcp.servers as Record<string, unknown>) : {};
  (mcp.servers as Record<string, unknown>)[serverName] = {
    url: mcpUrl,
    transport: "streamable-http",
    connectionTimeoutMs,
    headers: {
      Authorization: "${ALPHAXIV_AUTH_HEADER}",
    },
  };
  ensureDir(configDir());
  fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
}

export function normalizeExpiresAt(token: Record<string, unknown> | undefined): number | undefined {
  const raw = token?.expiresAt;
  if (!raw) {
    return undefined;
  }
  if (typeof raw === "number") {
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function redactTokenInfo(token: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!token) {
    return { available: false };
  }
  const expiresAt = normalizeExpiresAt(token);
  return {
    available: Boolean(token[TOKEN_ACCESS_FIELD]),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    source: token.source || undefined,
    mcpUrl: token.mcpUrl || DEFAULT_MCP_URL,
  };
}

export function saveToken(token: Record<string, unknown>, options: { mcpUrl?: string } = {}): Record<string, unknown> {
  if (!token[TOKEN_ACCESS_FIELD]) {
    throw new Error("No access token was found in the OAuth cache.");
  }
  const stored: Record<string, unknown> = {
    [TOKEN_ACCESS_FIELD]: token[TOKEN_ACCESS_FIELD],
    [TOKEN_REFRESH_FIELD]: token[TOKEN_REFRESH_FIELD],
    tokenType: token.tokenType || "Bearer",
    expiresAt: token.expiresAt,
    scope: token.scope,
    source: token.source || "unknown",
    mcpUrl: options.mcpUrl || token.mcpUrl || DEFAULT_MCP_URL,
    updatedAt: new Date().toISOString(),
  };
  writeJson(tokenStorePath(), stored);
  updateEnvHeader(String(stored[TOKEN_ACCESS_FIELD]));
  return stored;
}

export function loadStoredToken(): Record<string, unknown> | undefined {
  return readJson(tokenStorePath(), undefined);
}

export function readStoredAccessToken(): string {
  const token = loadStoredToken();
  if (!token?.[TOKEN_ACCESS_FIELD]) {
    throw new Error("AlphaXiv is not authenticated. Run `openclaw alphaclawxiv auth login` first.");
  }
  const expiresAt = normalizeExpiresAt(token);
  if (expiresAt && expiresAt <= Date.now() + 60_000) {
    throw new Error("AlphaXiv token is expired or about to expire. Run `openclaw alphaclawxiv auth login` again.");
  }
  return String(token[TOKEN_ACCESS_FIELD]);
}

export function status(options: { serverName?: string; mcpUrl?: string } = {}): void {
  const token = loadStoredToken();
  const info = redactTokenInfo(token);
  const cfg = readJson(openclawConfigPath(), {}) || {};
  const serverName = options.serverName || DEFAULT_SERVER_NAME;
  const mcp = (cfg.mcp as Record<string, unknown> | undefined) || {};
  const servers = (mcp.servers as Record<string, unknown> | undefined) || {};
  const server = servers[serverName] as Record<string, unknown> | undefined;
  const hasMcp = Boolean(server);
  const hasEnv = fs.existsSync(openclawEnvPath()) && /^\s*ALPHAXIV_AUTH_HEADER\s*=/m.test(fs.readFileSync(openclawEnvPath(), "utf8"));
  console.log(
    JSON.stringify(
      {
        token: info,
        nativeToolsConfigured: true,
        openclawEnvConfigured: hasEnv,
        openclawMcpConfigured: hasMcp,
        mcpServerName: serverName,
        mcpUrl: server?.url || options.mcpUrl || DEFAULT_MCP_URL,
      },
      null,
      2,
    ),
  );
}

export function logout(): void {
  const file = tokenStorePath();
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
  removeEnvHeader();
  console.log("AlphaXiv token removed from OpenClaw local state and .env.");
}
