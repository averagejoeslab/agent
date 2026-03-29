import { execSync } from "node:child_process";
import type { Tool } from "../types.js";

export const bashTool: Tool = {
  name: "bash",
  description: "Execute a shell command and return its output. Has a 30 second timeout. Use this for running build commands, git operations, installing packages, or any task that requires shell access. Stderr is returned on failure. For reading files prefer the read tool; for finding files prefer glob; for searching content prefer grep.",
  params: [
    { name: "cmd", type: "string", description: "Shell command to execute (e.g., 'git status', 'npm install', 'ls -la')" },
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
