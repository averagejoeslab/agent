// System prompt assembly.
import type { Tool } from "./types.js";

export interface PromptContext {
  cwd: string;
  tools: Tool[];
}

/**
 * Build the system prompt with available tools listed.
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
      parts.push(`### ${tool.name}`);
      parts.push(tool.description);
      
      if (tool.params.length > 0) {
        parts.push("");
        parts.push("Parameters:");
        for (const param of tool.params) {
          const required = param.required !== false ? " (required)" : " (optional)";
          const desc = param.description ? ` - ${param.description}` : "";
          parts.push(`- **${param.name}** (${param.type})${required}${desc}`);
        }
      }
      
      parts.push("");
    }
  }

  return parts.join("\n");
}
