// Turn serialization — converts turns to plain text for embedding.
import type { Message } from "../types.js";

/** Convert a list of messages (one turn) into a plain text string for embedding. */
export function turnToText(messages: Message[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      parts.push(`${msg.role}: ${msg.content}`);
    } else {
      for (const block of msg.content) {
        if (block.type === "text") {
          parts.push(`${msg.role}: ${block.text}`);
        } else if (block.type === "tool_use") {
          parts.push(`tool_call: ${block.name}(${JSON.stringify(block.input)})`);
        } else if (block.type === "tool_result") {
          // Keep tool results short — they can be huge
          const content = block.content.length > 500
            ? block.content.slice(0, 500) + "..."
            : block.content;
          parts.push(`tool_result: ${content}`);
        }
      }
    }
  }

  return parts.join("\n");
}
