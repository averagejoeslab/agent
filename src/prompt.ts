// System prompt assembly.

export interface PromptContext {
  cwd: string;
}

/**
 * Build the system prompt.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  return `Concise coding assistant. cwd: ${ctx.cwd}`;
}
