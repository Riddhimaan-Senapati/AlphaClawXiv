import { Command, Args, Flags } from "@oclif/core";
import { printPaperContent } from "../../actions.js";

export default class PaperContent extends Command {
  static description = "Fetch paper content";

  static args = {
    url: Args.string({ required: true, description: "AlphaXiv, arXiv, or paper URL" }),
  };

  static flags = {
    "full-text": Flags.boolean({ default: false, description: "Request full text when available" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PaperContent);
    await printPaperContent(args.url, flags["full-text"]);
  }
}
