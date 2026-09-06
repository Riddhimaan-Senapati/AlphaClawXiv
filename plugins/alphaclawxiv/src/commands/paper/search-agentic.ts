import { Command } from "@oclif/core";
import { printDiscoverPapers } from "../../actions.js";

export default class PaperSearchAgentic extends Command {
  static description = "Search AlphaXiv papers with multi-turn agentic retrieval";

  static strict = false;

  async run(): Promise<void> {
    const query = this.argv.join(" ").trim();
    if (!query) {
      this.error("Missing agentic search query.");
    }
    await printDiscoverPapers(query, "agentic");
  }
}
