import type { Tool } from "../types.js";

export const globTool: Tool = {
  name: "glob",
  description: "Find files matching a glob pattern. Use this to discover project structure or locate files by extension. Returns one file path per line. Returns 'none' if no files match. Common patterns: '**/*.ts' (all TypeScript), 'src/**' (all files under src/), '**/*.test.*' (test files), '**/index.*' (index files). Prefer this over bash+find for file discovery.",
  params: [
    { name: "pat", type: "string", description: "Glob pattern to match. Examples: '**/*.ts', 'src/**/*.json', '**/*.test.ts', 'src/**/index.*'" },
    { name: "path", type: "string", description: "Base directory to search from. Defaults to current working directory. Use to narrow scope, e.g., 'src' to search only under src/.", required: false },
  ],
  async execute(args) {
    const files: string[] = [];
    for await (const file of new Bun.Glob(`${args.path ?? "."}/${args.pat}`).scan()) {
      files.push(file);
    }
    return files.join("\n") || "none";
  },
};
