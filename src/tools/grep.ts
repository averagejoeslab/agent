import { readFile } from "node:fs/promises";
import type { Tool } from "../types.js";

export const grepTool: Tool = {
  name: "grep",
  description: "Search across all files for lines matching a regex pattern. Returns results as 'file:line:content'. Skips node_modules and .git. Capped at 50 matches. Use this to find function definitions, symbol usages, or patterns across a codebase. For searching within a single known file use the read tool. For finding files by name/extension use glob instead.",
  params: [
    { name: "pat", type: "string", description: "JavaScript regex to search for. Examples: 'export.*function' (exported functions), 'TODO|FIXME' (code notes), 'import.*from.*react' (react imports), 'class\\s+\\w+' (class definitions)" },
    { name: "path", type: "string", description: "Base directory to search from. Defaults to cwd. Narrow scope for faster results, e.g., 'src' to search only under src/.", required: false },
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
