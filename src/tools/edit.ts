import { readFile, writeFile } from "node:fs/promises";
import type { Tool } from "../types.js";

export const editTool: Tool = {
  name: "edit",
  description: "Make targeted edits to an existing file by replacing a specific string. The old string must match exactly (including whitespace and indentation). If the old string appears multiple times, the edit will fail unless all=true is set. This is safer than write for modifying existing files because it only changes the targeted section. Returns an error if the old string is not found.",
  params: [
    { name: "path", type: "string", description: "File path to edit (relative to cwd or absolute)" },
    { name: "old", type: "string", description: "Exact string to find in the file. Must match precisely including whitespace." },
    { name: "new", type: "string", description: "Replacement string. Can be empty to delete the old string." },
    { name: "all", type: "string", description: "Set to 'true' to replace all occurrences. Default replaces only the first and fails if multiple matches exist.", required: false },
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
