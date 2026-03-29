// System prompt assembly — loads identity, soul, and context to build the final prompt.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface PromptContext {
  cwd: string;
  dataDir: string;
}

/**
 * Build the system prompt by assembling identity, soul, and context.
 * Falls back to default if identity files don't exist.
 */
export async function buildSystemPrompt(ctx: PromptContext): Promise<string> {
  const parts: string[] = [];

  // Try to load SOUL.md (behavioral philosophy)
  const soul = await loadFile(resolve(ctx.dataDir, "SOUL.md"));
  const hasSoul = !!soul;
  if (soul) {
    parts.push(soul);
    parts.push(""); // blank line
  }

  // Try to load IDENTITY.md (presentation)
  const identity = await loadFile(resolve(ctx.dataDir, "IDENTITY.md"));
  if (identity) {
    parts.push("## Your Identity");
    parts.push(identity);
    parts.push(""); // blank line
  }

  // Try to load USER.md (user context)
  const user = await loadFile(resolve(ctx.dataDir, "USER.md"));
  if (user) {
    parts.push("## About the User");
    parts.push(user);
    parts.push(""); // blank line
  }

  // If no identity files exist, use default
  if (parts.length === 0) {
    parts.push("Concise coding assistant.");
  }

  // Instruction to embody the soul (if present)
  if (hasSoul) {
    parts.push("---");
    parts.push("Embody the persona and tone defined in SOUL.md. Avoid stiff, generic replies. Follow its guidance unless higher-priority instructions override it.");
    parts.push(""); // blank line
  }

  // Always append current working directory
  parts.push(`Current working directory: ${ctx.cwd}`);

  return parts.join("\n");
}

/**
 * Load a file if it exists, return undefined otherwise.
 */
async function loadFile(path: string): Promise<string | undefined> {
  try {
    const content = await readFile(path, "utf-8");
    return content.trim();
  } catch {
    return undefined;
  }
}
