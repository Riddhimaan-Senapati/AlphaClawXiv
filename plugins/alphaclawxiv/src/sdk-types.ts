import type { Static, TSchema } from "typebox";

export type TextBlock = { type: "text"; text: string };
export type ImageBlock = { type: "image"; [key: string]: unknown };
export type ToolResultContent = TextBlock | ImageBlock;

export type AgentToolResult<T> = {
  content: ToolResultContent[];
  details: T;
  progress?: { text: string };
  terminate?: boolean;
};

export type AgentToolUpdateCallback<T = unknown> = (partial: AgentToolResult<T>) => void;

export type AgentToolExecute<TParams extends TSchema> = (
  toolCallId: string,
  params: Static<TParams>,
  signal?: AbortSignal,
  onUpdate?: AgentToolUpdateCallback<unknown>,
) => Promise<AgentToolResult<unknown>>;

export type PluginToolDefinition<TParams extends TSchema = TSchema> = {
  name: string;
  label: string;
  description: string;
  parameters: TParams;
  outputSchema?: TSchema;
  optional?: boolean;
  execute: AgentToolExecute<TParams>;
};

export type AnyAgentTool = PluginToolDefinition;

export type OpenClawPluginToolOptions = {
  name?: string;
  names?: string[];
  optional?: boolean;
};

export type OpenClawPluginCliCommandDescriptor = {
  name: string;
  description: string;
  hasSubcommands: boolean;
};

export type OpenClawPluginCliRegistrationOptions = {
  parentPath?: readonly string[];
  commands?: readonly string[];
  descriptors?: readonly OpenClawPluginCliCommandDescriptor[];
};

export type OpenClawPluginCliContext = {
  program: {
    command(name: string, opts?: Record<string, unknown>): any;
    [key: string]: unknown;
  };
  parentPath: readonly string[];
  config: Record<string, unknown>;
  workspaceDir?: string;
  logger: { warn(message: string): void; error(message: string): void };
};

export type OpenClawPluginHookResult = {
  systemPrompt?: string;
  prependContext?: string;
  appendContext?: string;
  prependSystemContext?: string;
  appendSystemContext?: string;
  toolsAllow?: string[];
};

export type BeforePromptBuildEvent = {
  prompt?: unknown;
  session?: unknown;
  [key: string]: unknown;
};

export type OpenClawPluginCliRegistrar = (ctx: OpenClawPluginCliContext) => void | Promise<void>;

export type OpenClawPluginApi = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source?: string;
  rootDir?: string;
  registerTool(tool: AnyAgentTool, opts?: OpenClawPluginToolOptions): void;
  registerHook(
    events: string | string[],
    handler: (event: BeforePromptBuildEvent) => OpenClawPluginHookResult | void | Promise<OpenClawPluginHookResult | void>,
    opts?: Record<string, unknown>,
  ): void;
  on?(
    event: string,
    handler: (event: BeforePromptBuildEvent) => OpenClawPluginHookResult | void | Promise<OpenClawPluginHookResult | void>,
    opts?: Record<string, unknown>,
  ): void;
  registerCli(registrar: OpenClawPluginCliRegistrar, opts?: OpenClawPluginCliRegistrationOptions): void;
  logger?: { warn(message: string): void; error(message: string): void; [key: string]: unknown };
  [key: string]: unknown;
};

export type OpenClawPluginDefinition = {
  id: string;
  name: string;
  description?: string;
  kind?: string;
  configSchema?: TSchema;
  register(api: OpenClawPluginApi): void;
};

export function definePluginEntry<T extends OpenClawPluginDefinition>(definition: T): T {
  return definition;
}
