import { readFile, writeFile } from "node:fs/promises";
import type { Tool } from "../types.js";

export const editTool: Tool = {
  name: "edit",
  description: "Make targeted edits to an existing file by replacing a specific string. Safer than write for modifying existing files. The old string must match exactly — copy it directly from the file using the read tool first to avoid whitespace or indentation errors. Returns an error if old string is not found or appears multiple times (unless all='true').",
  params: [
    { name: "path", type: "string", description: "Absolute file path to edit (e.g., '/Users/dev/project/src/index.ts'). Relative paths are resolved from cwd." },
    { name: "old", type: "string", description: "Exact string to replace. Must match character-for-character including all whitespace and indentation. Use the read tool first to copy the exact string." },
    { name: "new", type: "string", description: "Replacement string. Use empty string to delete old. Must preserve surrounding code's indentation and style." },
    { name: "all", type: "string", description: "Set to 'true' to replace all occurrences. Omit or set 'false' to replace only the first (fails if multiple matches found).", required: false },
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
