import { readFile, writeFile } from "node:fs/promises";
import type { Tool } from "../types.js";

export const editTool: Tool = {
  name: "edit",
  description: "Replace old string with new string in a file. Fails if old string not found or appears multiple times (unless all=true).",
  params: [
    { name: "path", type: "string", description: "File path to edit" },
    { name: "old", type: "string", description: "String to find" },
    { name: "new", type: "string", description: "String to replace with" },
    { name: "all", type: "string", description: "Replace all occurrences (true/false)", required: false },
  ],
  async execute(args) {
    const content = await readFile(args.path, "utf-8");
    if (!content.includes(args.old)) return "error: old_string not found";
    const escaped = args.old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (content.match(new RegExp(escaped, "g")) ?? []).length;
    if (args.all !== "true" && count > 1) return `error: old_string appears ${count} times. Use all=true to replace all.`;
    const result = args.all === "true"
      ? content.split(args.old).join(args.new)
      : content.replace(args.old, args.new);
    await writeFile(args.path, result, "utf-8");
    return "ok";
  },
};
