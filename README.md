# agentos

Autonomous agent runtime with persistent episodic memory and streaming responses. Built on Bun + TypeScript.

## Architecture

```
src/
├── index.ts              # Entry point — wires everything
├── types.ts              # Shared interfaces
├── provider/
│   └── anthropic.ts      # Anthropic Claude API with SSE streaming
├── agent/
│   └── loop.ts           # ReAct loop (reusable, UI-agnostic)
├── tools/
│   ├── base.ts           # Tool interface + ToolRegistry
│   ├── read.ts           # Read file with line numbers
│   ├── write.ts          # Write/create file
│   ├── edit.ts           # Find & replace in file
│   ├── glob.ts           # Find files by pattern
│   ├── grep.ts           # Search files by regex
│   └── bash.ts           # Run shell commands
├── memory/
│   ├── episodic.ts       # Append-only JSONL trace — everything forever
│   └── context.ts        # Sliding window over episodic — what the LLM sees
└── ui/
    └── repl.ts           # Terminal REPL with context usage bar
```

## Memory model

**Episodic trace** (`.agent_data/trace.jsonl`) — append-only log of every event. Never deleted. Grows forever.

**Context window** — sliding window over the tail of the episodic trace. Sized to fit within the model's context window after reserving space for output tokens and overhead. Old turns slide off the left edge as new turns are added. No compaction, no summarization. On restart, the context is hydrated from the trace (loads the most recent messages that fit).

**Token counting** — Uses `tiktoken` (GPT-4 encoding) for accurate token estimation (~90-95% accurate for Claude). Much better than naive char/4 estimation.

**Streaming responses** — Text streams token-by-token via Server-Sent Events (SSE) for responsive real-time output. Complete responses are still logged to episodic trace.

```
episodic trace (all time)
[t1] [t2] [t3] [t4] [t5] [t6] [t7] [t8] [t9] [t10]
                          ╰── context window ──╯
                              what the LLM sees
```

## Installation

```bash
# Install dependencies
bun install

# Set your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Run

```bash
bun src/index.ts
```

## Configuration

All via environment variables (or `.env` file):

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | Anthropic API key |
| `MODEL` | `claude-sonnet-4-5-20250929` | Model ID |
| `MAX_TOKENS` | `16384` | Max output tokens per response |
| `CONTEXT_WINDOW` | `200000` | Model's total context window in tokens |
| `DATA_DIR` | `.agent_data` | Directory for episodic trace |

**Note:** Available context for messages = `CONTEXT_WINDOW - MAX_TOKENS - 5000` (headroom for system prompt and overhead)

## REPL commands

| Command | What it does |
|---|---|
| `/c` | Clear context window (trace untouched) |
| `/q` or `exit` | Quit |

## Tools

| Tool | Description |
|---|---|
| `read` | Read file with line numbers, optional offset/limit |
| `write` | Write/create file, creates parent dirs |
| `edit` | Find & replace in file, optional replace-all |
| `glob` | Find files by glob pattern |
| `grep` | Search files by regex, returns matches with line numbers |
| `bash` | Run shell command (30s timeout) |
| `web_search` | Search the web via DuckDuckGo (no API key required) |
| `web_fetch` | Fetch URL content, converts HTML to markdown |

## Features

- ✅ **Persistent memory** — Full conversation history in append-only trace
- ✅ **Session resumption** — Picks up where you left off across restarts
- ✅ **Streaming responses** — Real-time token-by-token output
- ✅ **Accurate token counting** — tiktoken-based estimation (~90-95% accurate)
- ✅ **Automatic context management** — Sliding window with smart eviction
- ✅ **File system tools** — Read, write, edit, glob, grep
- ✅ **Shell execution** — Run bash commands with 30s timeout
- ✅ **Progress bar** — Visual context usage indicator

## Dependencies

- **Bun** — JavaScript runtime (tested on 1.3.9+)
- **tiktoken** — Accurate token counting
- **Anthropic API** — Claude models

