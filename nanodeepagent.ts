#!/usr/bin/env bun
/**
 * nanodeepagent - minimal deep agent in TypeScript
 */
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import * as readline from "node:readline";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};

// --- Tool implementations ---
const TOOLS: Record<string, { desc: string; params: string[]; fn: (args: any) => Promise<string> | string }> = {
  read: {
    desc: "Read file with line numbers",
    params: ["path"],
    fn: async (args) => {
      const lines = (await readFile(args.path, "utf-8")).split("\n");
      const start = args.offset ?? 0;
      const end = start + (args.limit ?? lines.length);
      return lines.slice(start, end).map((line, i) => `${String(start + i + 1).padStart(4)}| ${line}`).join("\n");
    },
  },
  write: {
    desc: "Write content to file",
    params: ["path", "content"],
    fn: async (args) => {
      await writeFile(args.path, args.content, "utf-8");
      return "ok";
    },
  },
  edit: {
    desc: "Replace old with new in file",
    params: ["path", "old", "new"],
    fn: async (args) => {
      const content = await readFile(args.path, "utf-8");
      if (!content.includes(args.old)) return "error: old_string not found";
      const escaped = args.old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const count = (content.match(new RegExp(escaped, "g")) ?? []).length;
      if (!args.all && count > 1) return `error: old_string appears ${count} times`;
      const result = args.all ? content.split(args.old).join(args.new) : content.replace(args.old, args.new);
      await writeFile(args.path, result, "utf-8");
      return "ok";
    },
  },
  glob: {
    desc: "Find files by pattern",
    params: ["pat"],
    fn: async (args) => {
      const files: string[] = [];
      for await (const file of new Bun.Glob(`${args.path ?? "."}/${args.pat}`).scan()) {
        files.push(file);
      }
      return files.join("\n") || "none";
    },
  },
  grep: {
    desc: "Search files for regex",
    params: ["pat"],
    fn: async (args) => {
      const pattern = new RegExp(args.pat);
      const hits: string[] = [];
      for await (const file of new Bun.Glob(`${args.path ?? "."}/**`).scan()) {
        if (file.includes("node_modules")) continue;
        try {
          const content = await readFile(file, "utf-8");
          content.split("\n").forEach((line, i) => {
            if (pattern.test(line)) hits.push(`${file}:${i + 1}:${line.trim()}`);
          });
        } catch {}
      }
      return hits.slice(0, 50).join("\n") || "none";
    },
  },
  bash: {
    desc: "Run shell command",
    params: ["cmd"],
    fn: (args) => {
      try {
        return execSync(args.cmd, { encoding: "utf-8", timeout: 30000 }).trim() || "(empty)";
      } catch (err: any) {
        return (err.stdout || err.stderr || String(err)).trim();
      }
    },
  },
};

// --- API ---
function buildToolSchema() {
  return Object.entries(TOOLS).map(([name, { desc, params }]) => ({
    name,
    description: desc,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(params.map((p) => [p, { type: "string" }])),
      required: params,
    },
  }));
}

async function callAPI(messages: any[], systemPrompt: string) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools: buildToolSchema(),
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// --- Main ---
async function main() {
  console.log(`
${ANSI.bold}${ANSI.cyan}
 ███╗   ██╗ █████╗ ███╗   ██╗ ██████╗
 ████╗  ██║██╔══██╗████╗  ██║██╔═══██╗
 ██╔██╗ ██║███████║██╔██╗ ██║██║   ██║
 ██║╚██╗██║██╔══██║██║╚██╗██║██║   ██║
 ██║ ╚████║██║  ██║██║ ╚████║╚██████╔╝
 ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝
 ██████╗ ███████╗███████╗██████╗  █████╗  ██████╗ ███████╗███╗   ██╗████████╗
 ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
 ██║  ██║█████╗  █████╗  ██████╔╝███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║
 ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║
 ██████╔╝███████╗███████╗██║     ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║
 ╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝
${ANSI.reset}
${ANSI.dim}Deep Agent${ANSI.reset} | ${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}
`);

  const messages: any[] = [];
  const systemPrompt = `Concise coding assistant. cwd: ${process.cwd()}`;
  const separator = () => console.log(`${ANSI.dim}${"─".repeat(80)}${ANSI.reset}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    separator();
    const input = await new Promise<string>((resolve) => {
      rl.question(`${ANSI.bold}${ANSI.blue}❯${ANSI.reset} `, (answer) => resolve(answer.trim()));
    });
    separator();
    if (!input) continue;
    if (input === "/q" || input === "exit") break;
    if (input === "/c") {
      messages.length = 0;
      console.log(`${ANSI.green}⏺ Cleared conversation${ANSI.reset}`);
      continue;
    }
    messages.push({ role: "user", content: input });

    // Agentic loop
    while (true) {
      const response = await callAPI(messages, systemPrompt);
      const toolResults: any[] = [];
      for (const block of response.content) {
        if (block.type === "text") {
          console.log(`\n${ANSI.cyan}⏺${ANSI.reset} ${block.text}`);
        } else if (block.type === "tool_use") {
          const preview = String(Object.values(block.input)[0] ?? "").slice(0, 50);
          console.log(`\n${ANSI.green}⏺ ${block.name}${ANSI.reset}(${ANSI.dim}${preview}${ANSI.reset})`);
          const tool = TOOLS[block.name];
          const result = tool ? await tool.fn(block.input) : `error: unknown tool ${block.name}`;
          const lines = result.split("\n");
          const resultPreview = lines[0].slice(0, 60) + (lines.length > 1 ? ` +${lines.length - 1} lines` : "");
          console.log(`  ${ANSI.dim}⎿  ${resultPreview}${ANSI.reset}`);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }
      messages.push({ role: "assistant", content: response.content });
      if (toolResults.length === 0) break;
      messages.push({ role: "user", content: toolResults });
    }
    console.log();
  }
  rl.close();
}

main().catch((e) => { console.error(`${ANSI.red}Fatal: ${e}${ANSI.reset}`); process.exit(1); });