// Agent loop — the ReAct cycle. Reusable, UI-agnostic.
// Think → act → observe → repeat until no more tool calls.
import type { Provider, AgentEvent, ToolContext } from "../types.js";
import type { ToolRegistry } from "../tools/base.js";
import type { ContextWindow } from "../memory/context.js";
import type { EpisodicStore } from "../memory/episodic.js";

export interface AgentLoopConfig {
  provider: Provider;
  registry: ToolRegistry;
  context: ContextWindow;
  episodic: EpisodicStore;
  systemPrompt: string;
  contextWindow: number;
}

export class AgentLoop {
  private provider: Provider;
  private registry: ToolRegistry;
  private context: ContextWindow;
  private episodic: EpisodicStore;
  private systemPrompt: string;
  private toolContext: ToolContext;

  constructor(config: AgentLoopConfig) {
    this.provider = config.provider;
    this.registry = config.registry;
    this.context = config.context;
    this.episodic = config.episodic;
    this.systemPrompt = config.systemPrompt;

    // Build once, reuse for every tool call
    this.toolContext = {
      provider: config.provider,
      contextWindow: config.contextWindow,
    };
  }

  /** Run one user turn through the full agentic loop. */
  async run(input: string, onEvent: (event: AgentEvent) => void): Promise<void> {
    // Record + add to context
    await this.episodic.append({ ts: Date.now(), type: "user_message", content: input });
    this.context.addUser(input);

    // ReAct loop — keep calling the LLM until no more tool calls
    while (true) {
      const response = await this.provider.stream(
        this.context.getMessages(),
        this.systemPrompt,
        this.registry.buildSchema(),
        (delta) => onEvent({ type: "text_delta", delta })
      );

      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

      for (const block of response.content) {
        if (block.type === "text") {
          await this.episodic.append({ ts: Date.now(), type: "assistant_text", content: block.text });
        } else if (block.type === "tool_use") {
          const preview = String(Object.values(block.input)[0] ?? "").slice(0, 50);
          onEvent({ type: "tool_call", name: block.name, preview });

          await this.episodic.append({
            ts: Date.now(), type: "tool_call",
            id: block.id, name: block.name, input: block.input,
          });

          // Execute the tool
          const tool = this.registry.get(block.name);
          let result: string;
          if (!tool) {
            result = `error: unknown tool "${block.name}"`;
          } else {
            try {
              result = await tool.execute(block.input as Record<string, string>, this.toolContext);
            } catch (err) {
              result = `error: ${err instanceof Error ? err.message : String(err)}`;
            }
          }

          await this.episodic.append({ ts: Date.now(), type: "tool_result", tool_use_id: block.id, content: result });

          const lines = result.split("\n");
          const resultPreview = lines[0].slice(0, 60) + (lines.length > 1 ? ` +${lines.length - 1} lines` : "");
          onEvent({ type: "tool_result", name: block.name, preview: resultPreview });

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }

      // Add assistant response to context
      this.context.addAssistant(response.content);

      // If no tool calls, the turn is done
      if (toolResults.length === 0) {
        onEvent({ type: "done" });
        break;
      }

      // Add tool results to context and loop
      this.context.addToolResults(toolResults);
    }
  }

  /** Clear the context window (episodic trace is untouched). */
  clearContext(): void {
    this.episodic.append({ ts: Date.now(), type: "session_clear" });
    this.context.clear();
  }
}
