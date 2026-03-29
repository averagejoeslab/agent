#!/usr/bin/env bun
// agentos — entry point. Wires provider, tools, memory, agent loop, and REPL.
import { resolve } from "node:path";
import { AnthropicProvider } from "./provider/anthropic.js";
import { ToolRegistry } from "./tools/base.js";
import { readTool } from "./tools/read.js";
import { writeTool } from "./tools/write.js";
import { editTool } from "./tools/edit.js";
import { globTool } from "./tools/glob.js";
import { grepTool } from "./tools/grep.js";
import { bashTool } from "./tools/bash.js";
import { webSearchTool } from "./tools/web_search.js";
import { webFetchTool } from "./tools/web_fetch.js";
import { EpisodicStore } from "./memory/episodic.js";
import { ContextWindow } from "./memory/context.js";
import { AgentLoop } from "./agent/loop.js";
import { startRepl } from "./ui/repl.js";
import { buildSystemPrompt } from "./prompt.js";

// ── Config ──────────────────────────────────────────────────────────────

const MODEL = process.env.MODEL ?? "claude-opus-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS ?? "16384", 10);
const CONTEXT_WINDOW = parseInt(process.env.CONTEXT_WINDOW ?? "1000000", 10); // 1M tokens
const DATA_DIR = resolve(process.env.DATA_DIR ?? ".agent_data");

if (!API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable required");
  process.exit(1);
}

// ── Wire everything ─────────────────────────────────────────────────────

// Provider
const provider = new AnthropicProvider(MODEL, API_KEY, MAX_TOKENS);

// Tools
const registry = new ToolRegistry();
registry.register(readTool);
registry.register(writeTool);
registry.register(editTool);
registry.register(globTool);
registry.register(grepTool);
registry.register(bashTool);
registry.register(webSearchTool);
registry.register(webFetchTool);

// Memory
const episodic = new EpisodicStore(resolve(DATA_DIR, "trace.jsonl"));
const headroom = 5000; // safety buffer for system prompt + overhead
const windowLimit = CONTEXT_WINDOW - MAX_TOKENS - headroom;
const context = new ContextWindow(windowLimit);

// Hydrate context from episodic trace (resume previous session)
const events = await episodic.readAll();
if (events.length > 0) {
  context.hydrateFromEpisodic(events);
  console.error(`Resumed ${events.length} events from episodic trace`);
}

// Record session start
await episodic.append({ ts: Date.now(), type: "session_start", model: MODEL, cwd: process.cwd() });

// Build system prompt with available tools
const systemPrompt = buildSystemPrompt({
  cwd: process.cwd(),
  tools: registry.all(),
});

// Agent loop
const loop = new AgentLoop(provider, registry, context, episodic, systemPrompt);

// Start REPL
await startRepl(loop, context, MODEL);
