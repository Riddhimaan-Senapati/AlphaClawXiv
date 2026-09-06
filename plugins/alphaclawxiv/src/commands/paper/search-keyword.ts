import { Command } from "@oclif/core";
import { printDiscoverPapers } from "../../actions.js";

export default class PaperSearchKeyword extends Command {
  static description = "Search AlphaXiv papers by keyword or full-text match";

  static strict = false;

  async run(): Promise<void> {
    const query = this.argv.join(" ").trim();
    if (!query) {
      this.error("Missing keyword search query.");
    }
    await printDiscoverPapers(query, "keyword");
  }
}
