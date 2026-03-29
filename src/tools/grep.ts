import { readFile } from "node:fs/promises";
import type { Tool } from "../types.js";

export const grepTool: Tool = {
  name: "grep",
  description: "Search files for a regex pattern. Returns matching lines with file path and line number.",
  params: [
    { name: "pat", type: "string", description: "Regex pattern to search for" },
    { name: "path", type: "string", description: "Base directory (default: current dir)", required: false },
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
