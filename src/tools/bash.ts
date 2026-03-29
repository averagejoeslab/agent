import { execSync } from "node:child_process";
import type { Tool } from "../types.js";

export const bashTool: Tool = {
  name: "bash",
  description: "Execute a shell command and return its output. 30 second timeout. Use for git operations, running builds, installing packages, or tasks requiring shell access. Stderr is returned on failure. Do NOT use this to read files (use read), find files (use glob), search content (use grep), or search the web (use web_search) — use the dedicated tools instead.",
  params: [
    { name: "cmd", type: "string", description: "Shell command to execute. Examples: 'git status', 'bun install', 'bun run build', 'git log --oneline -10', 'cat package.json | head -20'" },
  ],
  async execute(args) {
    try {
      return execSync(args.cmd, { encoding: "utf-8", timeout: 30_000 }).trim() || "(empty)";
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string };
      return (e.stdout || e.stderr || String(err)).trim();
    }
  },
};
