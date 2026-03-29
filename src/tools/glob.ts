import type { Tool } from "../types.js";

export const globTool: Tool = {
  name: "glob",
  description: "Find files matching a glob pattern. Use this to discover project structure or locate files by extension. Returns one file path per line. Common patterns: '**/*.ts' for all TypeScript files, 'src/**' for all files in src, '**/*.test.*' for test files. Returns 'none' if no files match.",
  params: [
    { name: "pat", type: "string", description: "Glob pattern to match (e.g., '**/*.ts', 'src/**/*.json')" },
    { name: "path", type: "string", description: "Base directory to search from (default: current working directory)", required: false },
  ],
  async execute(args) {
    const files: string[] = [];
    for await (const file of new Bun.Glob(`${args.path ?? "."}/${args.pat}`).scan()) {
      files.push(file);
    }
    return files.join("\n") || "none";
  },
};
