// Terminal REPL — just renders, knows nothing about the agent internals.
import * as readline from "node:readline";
import type { AgentLoop } from "../agent/loop.js";
import type { ContextWindow } from "../memory/context.js";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};

export async function startRepl(loop: AgentLoop, context: ContextWindow, model: string): Promise<void> {
  console.log(`\n${ANSI.bold}${ANSI.cyan}agentos${ANSI.reset} | ${ANSI.dim}${model}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const contextBar = () => {
    const used = context.getTokenCount();
    const limit = context.getWindowLimit();
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const barWidth = 30;
    const filled = Math.round((pct / 100) * barWidth);
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
    const color = pct > 80 ? ANSI.red : pct > 50 ? "\x1b[33m" : ANSI.green;
    return `${ANSI.dim}ctx ${color}${bar}${ANSI.reset}${ANSI.dim} ${used.toLocaleString()}/${limit.toLocaleString()} tokens (${pct}%)${ANSI.reset}`;
  };

  while (true) {
    console.log(contextBar());
    const input = await new Promise<string>((resolve) => {
      rl.question(`${ANSI.bold}${ANSI.blue}❯${ANSI.reset} `, (answer) => resolve(answer.trim()));
    });

    if (!input) continue;
    if (input === "/q" || input === "exit") break;
    if (input === "/c") {
      loop.clearContext();
      console.log(`${ANSI.green}⏺ Cleared context${ANSI.reset}`);
      continue;
    }

    try {
      let firstDelta = true;
      await loop.run(input, (event) => {
        switch (event.type) {
          case "text_delta":
            if (firstDelta) {
              process.stdout.write(`\n${ANSI.cyan}⏺${ANSI.reset} `);
              firstDelta = false;
            }
            process.stdout.write(event.delta);
            break;
          case "text":
            // Fallback for non-streaming (shouldn't happen now)
            console.log(`\n${ANSI.cyan}⏺${ANSI.reset} ${event.text}`);
            break;
          case "tool_call":
            if (!firstDelta) {
              console.log(); // Newline after streaming text
              firstDelta = true;
            }
            console.log(`\n${ANSI.green}⏺ ${event.name}${ANSI.reset}(${ANSI.dim}${event.preview}${ANSI.reset})`);
            break;
          case "tool_result":
            console.log(`  ${ANSI.dim}⎿  ${event.preview}${ANSI.reset}`);
            break;
          case "error":
            console.log(`\n${ANSI.red}⏺ Error: ${event.message}${ANSI.reset}`);
            break;
        }
      });
    } catch (err) {
      console.log(`\n${ANSI.red}⏺ Error: ${err instanceof Error ? err.message : String(err)}${ANSI.reset}`);
    }

    console.log();
  }

  rl.close();
}
