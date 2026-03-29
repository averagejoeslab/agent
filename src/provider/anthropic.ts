// Anthropic provider — talks to the Claude API with streaming support.
import type { Provider, Message, ContentBlock, ToolSchema } from "../types.js";

const API_URL = "https://api.anthropic.com/v1/messages";

export class AnthropicProvider implements Provider {
  constructor(
    private model: string,
    private apiKey: string,
    private maxTokens: number = 16384,
  ) {}

  async stream(
    messages: Message[],
    system: string,
    tools: ToolSchema[],
    onDelta: (delta: string) => void
  ): Promise<{ content: ContentBlock[]; stop_reason: string }> {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        messages,
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API error ${response.status}: ${body}`);
    }

    // Parse SSE stream
    const content: ContentBlock[] = [];
    const textBlocks: Map<number, string> = new Map();
    const toolBlocks: Map<number, { id: string; name: string; input: string }> = new Map();
    let stopReason = "end_turn";

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (!reader) throw new Error("No response body");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          if (event.type === "content_block_start") {
            const block = event.content_block;
            if (block.type === "text") {
              textBlocks.set(event.index, "");
            } else if (block.type === "tool_use") {
              toolBlocks.set(event.index, { id: block.id, name: block.name, input: "" });
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              const text = event.delta.text;
              const current = textBlocks.get(event.index) || "";
              textBlocks.set(event.index, current + text);
              onDelta(text); // Stream to UI
            } else if (event.delta.type === "input_json_delta") {
              const current = toolBlocks.get(event.index);
              if (current) {
                current.input += event.delta.partial_json;
              }
            }
          } else if (event.type === "message_delta") {
            if (event.delta.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
          }
        } catch (e) {
          // Ignore parse errors for partial JSON
        }
      }
    }

    // Build final content blocks
    for (const [index, text] of textBlocks) {
      content[index] = { type: "text", text };
    }
    for (const [index, tool] of toolBlocks) {
      content[index] = {
        type: "tool_use",
        id: tool.id,
        name: tool.name,
        input: JSON.parse(tool.input),
      };
    }

    return { content: content.filter(Boolean), stop_reason: stopReason };
  }
}
