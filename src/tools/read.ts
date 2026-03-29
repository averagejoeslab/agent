import { readFile } from "node:fs/promises";
import type { Tool } from "../types.js";

export const readTool: Tool = {
  name: "read",
  description: "Read file with line numbers. Supports offset and limit.",
  params: [
    { name: "path", type: "string", description: "File path to read" },
    { name: "offset", type: "string", description: "Start line (0-indexed)", required: false },
    { name: "limit", type: "string", description: "Number of lines to read", required: false },
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
