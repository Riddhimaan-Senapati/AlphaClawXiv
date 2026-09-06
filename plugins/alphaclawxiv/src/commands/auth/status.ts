import { Command, Flags } from "@oclif/core";
import { DEFAULT_SERVER_NAME } from "../../config.js";
import { status } from "../../storage.js";

export default class AuthStatus extends Command {
  static description = "Show AlphaXiv auth status without printing tokens";

  static flags = {
    "server-name": Flags.string({ default: DEFAULT_SERVER_NAME, description: "OpenClaw MCP server name" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthStatus);
    status({ serverName: flags["server-name"] });
  }
}
