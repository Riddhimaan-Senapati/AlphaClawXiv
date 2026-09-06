import { Type } from "typebox";
import { registerCli } from "./cli-forward.js";
import { DEFAULT_MCP_URL, DEFAULT_SERVER_NAME, DEFAULT_TIMEOUT_MS } from "./config.js";
import { definePluginEntry } from "./sdk-types.js";
import { tools, toolOptions } from "./tool-definitions.js";

const plugin = definePluginEntry({
  id: "alphaclawxiv",
  name: "AlphaClawXiv",
  description:
    "Native OpenClaw OAuth, full AlphaXiv MCP research, researcher, and library tools, PDF analysis, and repository-reading tools.",
  configSchema: Type.Object(
    {
      mcpUrl: Type.String({ default: DEFAULT_MCP_URL }),
      serverName: Type.String({ default: DEFAULT_SERVER_NAME }),
      connectionTimeoutMs: Type.Number({ minimum: 1, default: DEFAULT_TIMEOUT_MS }),
    },
    { additionalProperties: false },
  ),
  register(api) {
    if (typeof api.on === "function") {
      api.on("before_prompt_build", async () => ({
        appendSystemContext: [
          "AlphaClawXiv is installed for AlphaXiv research workflows.",
          "On Codex-harness OpenClaw agent runs, use the local CLI when native AlphaXiv tools are not visible as model tools:",
          "- openclaw alphaclawxiv paper search \"<query>\"",
          "- openclaw alphaclawxiv paper content \"<url>\"",
          "- openclaw alphaclawxiv pdf ask \"<paper>\" \"<question>\"",
          "- openclaw alphaclawxiv repo read \"<github-url>\" \"<path>\"",
          "Do not search the filesystem for AlphaClawXiv before using it; run the command directly.",
          "Prefer these commands over web search for paper discovery, PDF-grounded answers, and paper implementation repository reads.",
        ].join("\n"),
      }));
    }
    if (typeof api.registerTool === "function") {
      for (const tool of tools) {
        api.registerTool(tool, toolOptions[tool.name]);
      }
    }
    if (typeof api.registerCli === "function") {
      api.registerCli(registerCli, {
        descriptors: [
          {
            name: "alphaclawxiv",
            description: "Manage AlphaClawXiv OAuth and native AlphaXiv tools",
            hasSubcommands: true,
          },
          {
            name: "alphaxiv",
            description: "Manage AlphaClawXiv OAuth and native AlphaXiv tools",
            hasSubcommands: true,
          },
        ],
      });
    }
  },
});

export default plugin;
