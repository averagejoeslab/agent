import { readFile } from "node:fs/promises";
import type { Tool } from "../types.js";

export const readTool: Tool = {
  name: "read",
  description: "Read a file's contents and return them with line numbers. Output format is `   1| line content`. Use offset and limit to read specific sections of large files instead of loading the entire file. Returns an error if the file does not exist. For large files, prefer reading in chunks (e.g., offset=0 limit=100, then offset=100 limit=100) rather than loading the entire file at once.",
  params: [
    { name: "path", type: "string", description: "Absolute file path to read (e.g., '/Users/dev/project/src/index.ts'). Relative paths are resolved from cwd." },
    { name: "offset", type: "string", description: "Line number to start from (0-indexed). Example: offset='50' starts reading from line 51. Defaults to 0.", required: false },
    { name: "limit", type: "string", description: "Maximum number of lines to return. Example: limit='100' returns at most 100 lines. Use to avoid reading entire large files.", required: false },
  ],
  async execute(args) {
    const lines = (await readFile(args.path, "utf-8")).split("\n");
    const start = parseInt(args.offset ?? "0", 10) || 0;
    const end = start + (parseInt(args.limit ?? String(lines.length), 10) || lines.length);
    return lines
      .slice(start, end)
      .map((line, i) => `${String(start + i + 1).padStart(4)}| ${line}`)
      .join("\n");
  },
};
