import { Command, Args } from "@oclif/core";
import { printRepoRead } from "../../actions.js";

export default class RepoRead extends Command {
  static description = "Read files from a GitHub repository";

  static args = {
    "github-url": Args.string({ required: true, description: "GitHub repository URL" }),
    path: Args.string({ required: true, description: "File or directory path" }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(RepoRead);
    await printRepoRead(args["github-url"], args.path);
  }
}
