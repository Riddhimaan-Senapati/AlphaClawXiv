import { Command, Args } from "@oclif/core";
import { printPdfAsk } from "../../actions.js";

export default class PdfAsk extends Command {
  static description = "Ask AlphaXiv questions about a paper via filtered PDF passages";

  static strict = false;

  static args = {
    paper: Args.string({ required: true, description: "Paper to read (arXiv ID, URL, or title)" }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(PdfAsk);
    const question = this.argv.slice(1).join(" ").trim();
    if (!question) {
      this.error("Missing question.");
    }
    await printPdfAsk(args.paper, question);
  }
}
