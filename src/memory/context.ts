// Context window — sliding window over the episodic trace.
// The atomic unit is a TURN: everything from one user message through all
// assistant responses and tool calls until the next user message.
// Turns are never split. Either the whole turn is in the window or it's not.
import { encoding_for_model } from "tiktoken";
import type { Message, EpisodicEvent } from "../types.js";

const tokenizer = encoding_for_model("gpt-4");

/** A turn is a group of messages: user → assistant(+tools) → tool_results → assistant → ... */
interface Turn {
  messages: Message[];
  tokens: number;
}

export class ContextWindow {
  private turns: Turn[] = [];
  private tokenCount = 0;

  constructor(
    /** Max tokens for messages (context window - max output - system prompt - headroom). */
    private windowLimit: number,
  ) {}

  /** Get all messages to send to the LLM (flattened from turns). */
  getMessages(): Message[] {
    return this.turns.flatMap((t) => t.messages);
  }

  /** Current estimated token count. */
  getTokenCount(): number {
    return this.tokenCount;
  }

  /** The window limit in tokens. */
  getWindowLimit(): number {
    return this.windowLimit;
  }

  /** Add a user message — starts a new turn. */
  addUser(content: string): void {
    const msg: Message = { role: "user", content };
    this.turns.push({ messages: [msg], tokens: countTokens(msg) });
    this.tokenCount += countTokens(msg);
    this.evict();
  }

  /** Add an assistant message to the current turn. */
  addAssistant(content: Message["content"]): void {
    const msg: Message = { role: "assistant", content };
    const tokens = countTokens(msg);
    if (this.turns.length === 0) {
      this.turns.push({ messages: [msg], tokens });
    } else {
      const current = this.turns[this.turns.length - 1];
      current.messages.push(msg);
      current.tokens += tokens;
    }
    this.tokenCount += tokens;
    this.evict();
  }

  /** Add tool results to the current turn. */
  addToolResults(results: Array<{ type: "tool_result"; tool_use_id: string; content: string }>): void {
    const msg: Message = { role: "user", content: results as unknown as string };
    const tokens = countTokens(msg);
    if (this.turns.length === 0) {
      this.turns.push({ messages: [msg], tokens });
    } else {
      const current = this.turns[this.turns.length - 1];
      current.messages.push(msg);
      current.tokens += tokens;
    }
    this.tokenCount += tokens;
    this.evict();
  }

  /** Clear the window (episodic trace untouched). */
  clear(): void {
    this.turns = [];
    this.tokenCount = 0;
  }

  /** Hydrate from episodic events — load the tail that fits, turn by turn. */
  hydrateFromEpisodic(events: EpisodicEvent[]): void {
    this.clear();

    // Convert events to turns
    const allTurns = eventsToTurns(events);

    // Walk backwards, adding whole turns until we'd exceed the limit
    const reversed: Turn[] = [];
    let tokens = 0;
    for (let i = allTurns.length - 1; i >= 0; i--) {
      if (tokens + allTurns[i].tokens > this.windowLimit) break;
      reversed.push(allTurns[i]);
      tokens += allTurns[i].tokens;
    }

    this.turns = reversed.reverse();
    this.tokenCount = tokens;
  }

  /** Evict whole turns from the front until under the limit. */
  private evict(): void {
    // Always keep at least the current turn (last one)
    while (this.tokenCount > this.windowLimit && this.turns.length > 1) {
      const oldest = this.turns.shift()!;
      this.tokenCount -= oldest.tokens;
    }
  }
}

/** Count tokens for a message using tiktoken. */
function countTokens(msg: Message): number {
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

/** Convert episodic events into turns. Each turn starts with a user_message. */
function eventsToTurns(events: EpisodicEvent[]): Turn[] {
  const turns: Turn[] = [];
  let currentMessages: Message[] = [];
  let currentTokens = 0;

  // Pending state for building messages from events
  let pendingAssistantBlocks: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }> = [];
  let pendingToolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

  function flushAssistant(): void {
    if (pendingAssistantBlocks.length > 0) {
      const msg: Message = { role: "assistant", content: pendingAssistantBlocks as Message["content"] };
      const tokens = countTokens(msg);
      currentMessages.push(msg);
      currentTokens += tokens;
      pendingAssistantBlocks = [];
    }
    if (pendingToolResults.length > 0) {
      const msg: Message = { role: "user", content: pendingToolResults as unknown as string };
      const tokens = countTokens(msg);
      currentMessages.push(msg);
      currentTokens += tokens;
      pendingToolResults = [];
    }
  }

  function finishTurn(): void {
    flushAssistant();
    if (currentMessages.length > 0) {
      turns.push({ messages: currentMessages, tokens: currentTokens });
      currentMessages = [];
      currentTokens = 0;
    }
  }

  for (const event of events) {
    switch (event.type) {
      case "user_message":
        // New user message = new turn. Finish the previous one.
        finishTurn();
        const userMsg: Message = { role: "user", content: event.content };
        currentMessages.push(userMsg);
        currentTokens += countTokens(userMsg);
        break;

      case "assistant_text":
        // If we have pending tool calls + results, flush them first
        // (this means the LLM responded with text after a tool round)
        if (pendingToolResults.length > 0) {
          flushAssistant();
        }
        pendingAssistantBlocks.push({ type: "text", text: event.content });
        break;

      case "tool_call":
        pendingAssistantBlocks.push({ type: "tool_use", id: event.id, name: event.name, input: event.input });
        break;

      case "tool_result":
        // Flush the assistant message that contains the tool_use blocks
        if (pendingAssistantBlocks.length > 0) {
          const msg: Message = { role: "assistant", content: pendingAssistantBlocks as Message["content"] };
          const tokens = countTokens(msg);
          currentMessages.push(msg);
          currentTokens += tokens;
          pendingAssistantBlocks = [];
        }
        pendingToolResults.push({ type: "tool_result", tool_use_id: event.tool_use_id, content: event.content });
        break;

      case "session_clear":
        // A clear means we discard everything before it
        finishTurn();
        turns.length = 0;
        break;

      case "session_start":
        break;
    }
  }

  // Finish any remaining turn
  finishTurn();

  return turns;
}
