// Tool registry — holds all tools, builds API schema.
import type { Tool, ToolSchema } from "../types.js";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  all(): Tool[] {
    return [...this.tools.values()];
  }

  /** Build the tool schema array for the API. */
  buildSchema(): ToolSchema[] {
    return this.all().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object" as const,
        properties: Object.fromEntries(
          tool.params.map((p) => [p.name, { type: p.type, description: p.description }]),
        ),
        required: tool.params.filter((p) => p.required !== false).map((p) => p.name),
      },
    }));
  }
}
