import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Tool } from "../types.js";

export const writeTool: Tool = {
  name: "write",
  description: "Write content to file. Creates parent directories if needed.",
  params: [
    { name: "path", type: "string", description: "File path to write" },
    { name: "content", type: "string", description: "Content to write" },
  ],
  async execute(args) {
    await mkdir(dirname(args.path), { recursive: true });
    await writeFile(args.path, args.content, "utf-8");
    return "ok";
  },
};
