import { readFile } from "node:fs/promises";
import type { Tool } from "../types.js";

export const readTool: Tool = {
  name: "read",
  description: "Read a file's contents and return them with line numbers. Output format is `   1| line content`. Use offset and limit to read specific sections of large files instead of loading the entire file. Returns an error if the file does not exist.",
  params: [
    { name: "path", type: "string", description: "File path to read (relative to cwd or absolute)" },
    { name: "offset", type: "string", description: "Line number to start from (0-indexed). Use to skip to a specific section.", required: false },
    { name: "limit", type: "string", description: "Maximum number of lines to return. Use to avoid reading entire large files.", required: false },
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
