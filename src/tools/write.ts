import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Tool } from "../types.js";

export const writeTool: Tool = {
  name: "write",
  description: "Create or overwrite a file with the provided content. If the file already exists it will be completely replaced. If the file does not exist it will be created. Parent directories are created automatically. Use this for creating new files; prefer the edit tool for modifying existing files.",
  params: [
    { name: "path", type: "string", description: "File path to write (relative to cwd or absolute)" },
    { name: "content", type: "string", description: "Complete file content to write" },
  ],
  async execute(args) {
    await mkdir(dirname(args.path), { recursive: true });
    await writeFile(args.path, args.content, "utf-8");
    return "ok";
  },
};
