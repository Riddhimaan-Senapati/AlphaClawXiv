import { Command } from "@oclif/core";
import { logout } from "../../storage.js";

export default class AuthLogout extends Command {
  static description = "Remove AlphaXiv token from OpenClaw local state";

  async run(): Promise<void> {
    logout();
  }
}
