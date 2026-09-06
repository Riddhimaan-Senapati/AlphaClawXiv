import { Command } from "@oclif/core";
import { printDiscoverPapers } from "../../actions.js";

export default class PaperSearch extends Command {
  static description = "Search AlphaXiv papers with agentic retrieval";

  static strict = false;

  async run(): Promise<void> {
    const query = this.argv.join(" ").trim();
    if (!query) {
      this.error("Missing search query.");
    }
    await printDiscoverPapers(query, "agentic");
  }
}
