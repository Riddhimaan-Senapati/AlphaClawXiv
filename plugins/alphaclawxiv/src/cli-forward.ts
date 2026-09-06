import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OpenClawPluginCliContext } from "./sdk-types.js";

const ALIASES = new Set(["alphaclawxiv", "alphaxiv"]);
const PLUGIN_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function forwardedArgv(): string[] {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => ALIASES.has(arg));
  return index >= 0 ? args.slice(index + 1) : [];
}

export function registerCli(ctx: OpenClawPluginCliContext): void {
  ctx.program
    .command("alphaclawxiv")
    .alias("alphaxiv")
    .description("Manage AlphaClawXiv OAuth and native AlphaXiv tools")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .passThroughOptions()
    .action(async () => {
      const { execute } = await import("@oclif/core");
      await execute({ args: forwardedArgv(), dir: PLUGIN_ROOT });
    });
}
