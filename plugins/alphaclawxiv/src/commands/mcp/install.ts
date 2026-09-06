import { Command, Flags } from "@oclif/core";
import { DEFAULT_MCP_URL, DEFAULT_SERVER_NAME, DEFAULT_TIMEOUT_MS } from "../../config.js";
import { ensureMcpConfig } from "../../storage.js";

export default class McpInstall extends Command {
  static description = "Install the optional generic AlphaXiv MCP config into OpenClaw";

  static flags = {
    "mcp-url": Flags.string({ default: DEFAULT_MCP_URL, description: "AlphaXiv MCP URL" }),
    "server-name": Flags.string({ default: DEFAULT_SERVER_NAME, description: "OpenClaw MCP server name" }),
    "timeout-ms": Flags.integer({ default: DEFAULT_TIMEOUT_MS, description: "OpenClaw MCP connection timeout" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(McpInstall);
    ensureMcpConfig({
      mcpUrl: flags["mcp-url"],
      serverName: flags["server-name"],
      connectionTimeoutMs: flags["timeout-ms"],
    });
    this.log("AlphaXiv generic MCP config installed in OpenClaw config. Native tools are preferred on current OpenClaw builds.");
  }
}
