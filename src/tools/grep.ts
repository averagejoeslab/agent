import { readFile } from "node:fs/promises";
import type { Tool } from "../types.js";

export const grepTool: Tool = {
  name: "grep",
  description: "Search across all files for lines matching a regex pattern. Returns results in the format 'file:line:content'. Skips node_modules and .git directories. Results are capped at 50 matches. Use this to find usages, definitions, or patterns across a codebase. For searching within a single known file, use the read tool instead.",
  params: [
    { name: "pat", type: "string", description: "JavaScript regex pattern to search for (e.g., 'function\\s+main', 'TODO', 'import.*from')" },
    { name: "path", type: "string", description: "Base directory to search from (default: current working directory)", required: false },
  ],
  async execute(args) {
    const pattern = new RegExp(args.pat);
    const hits: string[] = [];
    for await (const file of new Bun.Glob(`${args.path ?? "."}/**`).scan()) {
      if (file.includes("node_modules") || file.includes(".git")) continue;
      try {
        const content = await readFile(file, "utf-8");
        content.split("\n").forEach((line, i) => {
          if (pattern.test(line)) hits.push(`${file}:${i + 1}:${line.trim()}`);
        });
      } catch {}
    }
    return hits.slice(0, 50).join("\n") || "none";
  },
};
