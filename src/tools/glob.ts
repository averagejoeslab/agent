import type { Tool } from "../types.js";

export const globTool: Tool = {
  name: "glob",
  description: "Find files matching a glob pattern.",
  params: [
    { name: "pat", type: "string", description: "Glob pattern (e.g., '**/*.ts')" },
    { name: "path", type: "string", description: "Base directory (default: current dir)", required: false },
  ],
  async execute(args) {
    const files: string[] = [];
    for await (const file of new Bun.Glob(`${args.path ?? "."}/${args.pat}`).scan()) {
      files.push(file);
    }
    return files.join("\n") || "none";
  },
};
