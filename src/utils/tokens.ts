// Shared tokenizer — single instance, used everywhere.
import { encoding_for_model } from "tiktoken";
import type { Message } from "../types.js";

// GPT-4 encoding as proxy for Claude (~90-95% accurate).
const tokenizer = encoding_for_model("gpt-4");

/** Count tokens in a string. */
export function countStringTokens(text: string): number {
  return tokenizer.encode(text).length;
}

/** Count tokens for a full Message (handles string and content block arrays). */
export function countMessageTokens(msg: Message): number {
  if (typeof msg.content === "string") {
    return tokenizer.encode(msg.content).length;
  }

  let total = 0;
  for (const block of msg.content) {
    if (block.type === "text") {
      total += tokenizer.encode(block.text).length;
    } else if (block.type === "tool_use") {
      total += tokenizer.encode(block.name).length;
      total += tokenizer.encode(JSON.stringify(block.input)).length;
      total += 10; // structure overhead
    } else if (block.type === "tool_result") {
      total += tokenizer.encode(block.content).length;
      total += 10; // structure overhead
    }
  }
  return total;
}
