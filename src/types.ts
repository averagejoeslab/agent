// Shared interfaces for the entire agent.

/** A single message in the conversation. */
export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

/** A content block from the API response. */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

/** An event in the episodic trace. */
export type EpisodicEvent =
  | { ts: number; type: "session_start"; model: string; cwd: string }
  | { ts: number; type: "user_message"; content: string }
  | { ts: number; type: "assistant_text"; content: string }
  | { ts: number; type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
  | { ts: number; type: "tool_result"; tool_use_id: string; content: string }
  | { ts: number; type: "session_clear" };

/** Tool definition for the API. */
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/** What the agent loop emits to the UI. */
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; name: string; preview: string }
  | { type: "tool_result"; name: string; preview: string }
  | { type: "error"; message: string }
  | { type: "done" };

/** Provider interface — how we talk to the LLM. */
export interface Provider {
  stream(
    messages: Message[],
    system: string,
    tools: ToolSchema[],
    onDelta: (delta: string) => void
  ): Promise<{ content: ContentBlock[]; stop_reason: string }>;
}

/** Tool interface — what a tool looks like. */
export interface Tool {
  name: string;
  description: string;
  params: ToolParam[];
  execute(args: Record<string, string>): Promise<string>;
}

export interface ToolParam {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}
