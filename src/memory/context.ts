// Context window — sliding window over the episodic trace.
// Converts episodic events into API messages that fit in the model's context window.
// No compaction, no summarization. Old turns just slide off the left edge.
import { encoding_for_model } from "tiktoken";
import type { Message, EpisodicEvent } from "../types.js";

// Initialize tokenizer once (expensive operation)
// Using gpt-4 encoding as proxy for Claude (close enough, ~90-95% accurate)
const tokenizer = encoding_for_model("gpt-4");

export class ContextWindow {
  private messages: Message[] = [];
  private tokenCount = 0;

  constructor(
    /** Max tokens for messages (context window - max output - system prompt - headroom). */
    private windowLimit: number,
  ) {}

  /** Get messages to send to the LLM. */
  getMessages(): Message[] {
    return this.messages;
  }

  /** Current estimated token count. */
  getTokenCount(): number {
    return this.tokenCount;
  }

  /** The window limit in tokens. */
  getWindowLimit(): number {
    return this.windowLimit;
  }

  /** Add a user message. */
  addUser(content: string): void {
    const msg: Message = { role: "user", content };
    this.push(msg);
  }

  /** Add an assistant message (full content blocks from API response). */
  addAssistant(content: Message["content"]): void {
    const msg: Message = { role: "assistant", content };
    this.push(msg);
  }

  /** Add tool results as a user message (API format). */
  addToolResults(results: Array<{ type: "tool_result"; tool_use_id: string; content: string }>): void {
    const msg: Message = { role: "user", content: results as unknown as string };
    this.push(msg);
  }

  /** Clear the window (but episodic trace is untouched). */
  clear(): void {
    this.messages = [];
    this.tokenCount = 0;
  }

  /** Hydrate from episodic events — load the tail that fits in the window. */
  hydrateFromEpisodic(events: EpisodicEvent[]): void {
    this.clear();

    // Convert events to messages, then take the tail that fits
    const allMessages = eventsToMessages(events);

    // Walk backwards from the end, adding messages until we'd exceed the limit
    const reversed: Message[] = [];
    let tokens = 0;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(allMessages[i]);
      if (tokens + msgTokens > this.windowLimit) break;
      reversed.push(allMessages[i]);
      tokens += msgTokens;
    }

    this.messages = reversed.reverse();
    this.tokenCount = tokens;
  }

  private push(msg: Message): void {
    const tokens = estimateTokens(msg);
    this.messages.push(msg);
    this.tokenCount += tokens;
    this.evict();
  }

  /** Drop oldest turn pairs from the front until we're under the limit. */
  private evict(): void {
    while (this.tokenCount > this.windowLimit && this.messages.length > 2) {
      // Always evict in pairs (user + assistant) to keep conversation coherent.
      // If first message is user and second is assistant, drop both.
      // Otherwise drop one at a time.
      const first = this.messages[0];
      const second = this.messages[1];

      if (first.role === "user" && second?.role === "assistant") {
        this.tokenCount -= estimateTokens(first) + estimateTokens(second);
        this.messages.splice(0, 2);
      } else {
        this.tokenCount -= estimateTokens(first);
        this.messages.shift();
      }
    }
  }
}

/** Count tokens for a message using tiktoken (accurate). */
function estimateTokens(msg: Message): number {
  if (typeof msg.content === "string") {
    return tokenizer.encode(msg.content).length;
  }
  
  let total = 0;
  for (const block of msg.content) {
    if (block.type === "text") {
      total += tokenizer.encode(block.text).length;
    } else if (block.type === "tool_use") {
      // Count tool name + serialized input
      total += tokenizer.encode(block.name).length;
      total += tokenizer.encode(JSON.stringify(block.input)).length;
      // Add overhead for tool_use structure (~10 tokens)
      total += 10;
    } else if (block.type === "tool_result") {
      total += tokenizer.encode(block.content).length;
      // Add overhead for tool_result structure (~10 tokens)
      total += 10;
    }
  }
  return total;
}

/** Convert episodic events back into API messages. */
function eventsToMessages(events: EpisodicEvent[]): Message[] {
  const messages: Message[] = [];
  let pendingToolCalls: Array<{ type: "tool_use"; id: string; name: string; input: Record<string, unknown> }> = [];
  let pendingToolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];
  let pendingText = "";

  for (const event of events) {
    switch (event.type) {
      case "user_message":
        flush();
        messages.push({ role: "user", content: event.content });
        break;

      case "assistant_text":
        // If we have pending tool calls, flush them as an assistant message first
        if (pendingToolCalls.length > 0) {
          messages.push({ role: "assistant", content: [...pendingToolCalls] });
          // Flush tool results as user message
          if (pendingToolResults.length > 0) {
            messages.push({ role: "user", content: pendingToolResults as unknown as string });
            pendingToolResults = [];
          }
          pendingToolCalls = [];
        }
        pendingText = event.content;
        break;

      case "tool_call":
        if (pendingText) {
          pendingToolCalls.push({ type: "text" as never, text: pendingText } as never);
          pendingText = "";
        }
        pendingToolCalls.push({ type: "tool_use", id: event.id, name: event.name, input: event.input });
        break;

      case "tool_result":
        pendingToolResults.push({ type: "tool_result", tool_use_id: event.tool_use_id, content: event.content });
        break;

      case "session_start":
      case "session_clear":
        // These don't produce messages
        break;
    }
  }

  flush();
  return messages;

  function flush(): void {
    if (pendingToolCalls.length > 0) {
      messages.push({ role: "assistant", content: [...pendingToolCalls] });
      if (pendingToolResults.length > 0) {
        messages.push({ role: "user", content: pendingToolResults as unknown as string });
        pendingToolResults = [];
      }
      pendingToolCalls = [];
    }
    if (pendingText) {
      messages.push({ role: "assistant", content: pendingText });
      pendingText = "";
    }
    if (pendingToolResults.length > 0) {
      messages.push({ role: "user", content: pendingToolResults as unknown as string });
      pendingToolResults = [];
    }
  }
}
