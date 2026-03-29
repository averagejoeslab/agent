// System prompt assembly — builds the system prompt from context and tool registry.
// Tool descriptions here give the agent high-level awareness of its capabilities.
// The API tool schema (sent separately) provides the structured definition for tool calling.
import type { Tool } from "./types.js";

export interface PromptContext {
  cwd: string;
  tools: Tool[];
}

/**
 * Build the system prompt.
 *
 * Design decisions:
 * - Tool descriptions are included so the agent understands its full capability set.
 * - Parameters are omitted here because the API tool schema already provides them
 *   with exact types and required/optional markers for the tool-calling mechanism.
 * - This avoids duplication and drift between system prompt and schema.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const parts: string[] = [];

  parts.push("Concise coding assistant.");
  parts.push("");
  parts.push(`cwd: ${ctx.cwd}`);

  if (ctx.tools.length > 0) {
    parts.push("");
    parts.push("## Available Tools");
    parts.push("");

    for (const tool of ctx.tools) {
      parts.push(`- **${tool.name}** — ${tool.description}`);
    }

    parts.push("");
    parts.push("When making function calls using tools that accept array or object parameters ensure those are structured using JSON.");
    parts.push("If you intend to call multiple tools and there are no dependencies between the calls, make all of the independent calls in the same turn, otherwise you MUST wait for previous calls to finish first to determine the dependent values (do NOT use placeholders or guess missing parameters).");
  }

  return parts.join("\n");
}
