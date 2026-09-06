import crypto from "node:crypto";
import { DEFAULT_MCP_URL } from "./config.js";
import { readStoredAccessToken } from "./storage.js";
import type { AgentToolResult, ToolResultContent } from "./sdk-types.js";

type JsonRpcResponse = {
  result?: unknown;
  error?: { message?: string; [key: string]: unknown };
  [key: string]: unknown;
};

export function parseJsonRpcResponse(contentType: string, text: string): JsonRpcResponse {
  if (contentType.includes("text/event-stream")) {
    const messages: JsonRpcResponse[] = [];
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
      messages.push(JSON.parse(data) as JsonRpcResponse);
    }
    const message = messages.find((item) => item && (item.result || item.error)) || messages[messages.length - 1];
    if (!message) {
      throw new Error("AlphaXiv MCP returned an empty event stream.");
    }
    return message;
  }
  try {
    return JSON.parse(text) as JsonRpcResponse;
  } catch {
    throw new Error("AlphaXiv MCP did not return valid JSON.");
  }
}

export async function callAlphaXivMcp(method: string, params: Record<string, unknown>, options: { mcpUrl?: string; timeoutMs?: number } = {}): Promise<unknown> {
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method,
        params,
      }),
      signal: controller.signal,
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
    if ((error as { name?: string })?.name === "AbortError") {
      throw new Error(`AlphaXiv MCP request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAlphaXivTool(name: string, args: Record<string, unknown>): Promise<AgentToolResult<unknown>> {
  const result = await callAlphaXivMcp("tools/call", {
    name,
    arguments: args || {},
  });
  return normalizeToolResult(result);
}

export function normalizeToolResult(result: unknown): AgentToolResult<unknown> {
  const raw = (result ?? {}) as Record<string, unknown>;
  const content: ToolResultContent[] =
    Array.isArray(raw.content) && raw.content.length > 0
      ? (raw.content as ToolResultContent[])
      : [{ type: "text", text: JSON.stringify(raw, null, 2) }];
  return { content, details: raw };
}

export function textFromResult(result: AgentToolResult<unknown>): string[] {
  return result.content
    .filter((item): item is { type: "text"; text: string } => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text);
}

export function printToolResult(result: AgentToolResult<unknown>): void {
  for (const item of result.content) {
    if (item.type === "text" && typeof item.text === "string") {
      console.log(item.text);
    } else if (item) {
      console.log(JSON.stringify(item, null, 2));
    }
  }
}
