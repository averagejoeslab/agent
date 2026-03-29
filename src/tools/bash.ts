import { execSync } from "node:child_process";
import type { Tool } from "../types.js";

export const bashTool: Tool = {
  name: "bash",
  description: "Run a shell command. 30 second timeout.",
  params: [
    { name: "cmd", type: "string", description: "Shell command to execute" },
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
