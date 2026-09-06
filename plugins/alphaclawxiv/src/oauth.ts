import crypto from "node:crypto";
import http from "node:http";
import { DEFAULT_MCP_URL, DEFAULT_SCOPES, TOKEN_ACCESS_FIELD, TOKEN_REFRESH_FIELD } from "./config.js";
import { saveToken } from "./storage.js";

type OAuthMetadata = {
  resource: string;
  protectedResource: Record<string, unknown>;
  authorizationMetadata: Record<string, string>;
};

type OAuthClient = { client_id: string; [key: string]: unknown };

function randomUrlSafe(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function codeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

async function fetchJson(url: string, options: { method?: string; headers?: Record<string, string>; body?: string | URLSearchParams } = {}): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    body: options.body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`${url} did not return valid JSON.`);
  }
}

async function discoverOAuth(mcpUrl: string): Promise<OAuthMetadata> {
  const resource = mcpUrl;
  const resourceUrl = new URL(resource);
  resourceUrl.pathname = `/.well-known/oauth-protected-resource${resourceUrl.pathname}`;
  const protectedResourceUrl = resourceUrl.href;
  const protectedResource = await fetchJson(protectedResourceUrl);
  const servers = protectedResource.authorization_servers as string[] | undefined;
  const authorizationServer = servers?.[0] || (protectedResource.authorization_server as string | undefined);
  if (!authorizationServer) {
    throw new Error("AlphaXiv protected resource metadata did not include an authorization server.");
  }
  const authUrl = new URL(authorizationServer);
  authUrl.pathname = `${authUrl.pathname.replace(/\/+$/, "")}/.well-known/oauth-authorization-server`;
  const authorizationMetadata = (await fetchJson(authUrl.href)) as Record<string, string>;
  for (const key of ["authorization_endpoint", "token_endpoint", "registration_endpoint"]) {
    if (!authorizationMetadata[key]) {
      throw new Error(`Authorization server metadata is missing ${key}.`);
    }
  }
  return {
    resource: (protectedResource.resource as string | undefined) || resource,
    protectedResource,
    authorizationMetadata,
  };
}

async function registerOAuthClient(metadata: OAuthMetadata, redirectUri: string): Promise<OAuthClient> {
  const body = JSON.stringify({
    client_name: "OpenClaw AlphaXiv OAuth",
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: DEFAULT_SCOPES,
  });
  const client = (await fetchJson(metadata.authorizationMetadata.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  })) as OAuthClient;
  if (!client.client_id) {
    throw new Error("OAuth registration did not return a client_id.");
  }
  return client;
}

function waitForCallback(server: http.Server, expectedState: string, timeoutMs: number): Promise<string> {
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

function listenLocalhost(server: http.Server): Promise<number> {
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

async function exchangeCode(metadata: OAuthMetadata, client: OAuthClient, redirectUri: string, verifier: string, code: string): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: client.client_id,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    resource: metadata.resource,
  });
  const token = await fetchJson(metadata.authorizationMetadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!token.access_token) {
    throw new Error("AlphaXiv token endpoint did not return an access token.");
  }
  return token;
}

export async function loginWithNativeOAuth(options: { mcpUrl?: string; mcpUrlRaw?: string } = {}): Promise<void> {
  const mcpUrl = options.mcpUrl || options.mcpUrlRaw || DEFAULT_MCP_URL;
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
  saveToken(
    {
      [TOKEN_ACCESS_FIELD]: token.access_token,
      [TOKEN_REFRESH_FIELD]: token.refresh_token,
      tokenType: token.token_type || "Bearer",
      expiresAt: typeof token.expires_in === "number" ? Date.now() + token.expires_in * 1000 : undefined,
      scope: token.scope,
      source: "native-oauth",
      mcpUrl,
    },
    { mcpUrl },
  );
  console.log("AlphaXiv auth configured. Restart OpenClaw gateway before using the native AlphaXiv tools.");
}
