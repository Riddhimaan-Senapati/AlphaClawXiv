import { Command, Flags } from "@oclif/core";
import { DEFAULT_MCP_URL } from "../../config.js";
import { loginWithNativeOAuth } from "../../oauth.js";

export default class AuthLogin extends Command {
  static description = "Print an AlphaXiv OAuth URL and configure native AlphaXiv tool auth after browser login";

  static flags = {
    "mcp-url": Flags.string({ default: DEFAULT_MCP_URL, description: "AlphaXiv MCP URL" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthLogin);
    await loginWithNativeOAuth({ mcpUrl: flags["mcp-url"] });
  }
}
