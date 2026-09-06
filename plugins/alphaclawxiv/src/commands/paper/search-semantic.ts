import { Command } from "@oclif/core";
import { printDiscoverPapers } from "../../actions.js";

export default class PaperSearchSemantic extends Command {
  static description = "Search AlphaXiv papers by semantic similarity";

  static strict = false;

  async run(): Promise<void> {
    const query = this.argv.join(" ").trim();
    if (!query) {
      this.error("Missing semantic search query.");
    }
    await printDiscoverPapers(query, "semantic");
  }
}
