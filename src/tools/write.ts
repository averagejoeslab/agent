import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Tool } from "../types.js";

export const writeTool: Tool = {
  name: "write",
  description: "Create or overwrite a file with the provided content. If the file already exists it will be completely replaced — do NOT use this to make small changes to existing files, use the edit tool instead. If the file does not exist it will be created. Parent directories are created automatically.",
  params: [
    { name: "path", type: "string", description: "Absolute file path to write (e.g., '/Users/dev/project/src/newfile.ts'). Relative paths are resolved from cwd." },
    { name: "content", type: "string", description: "Complete file content to write. Must be the entire file — this replaces the file wholesale." },
  ],
  async execute(args) {
    await mkdir(dirname(args.path), { recursive: true });
    await writeFile(args.path, args.content, "utf-8");
    return "ok";
  },
};
