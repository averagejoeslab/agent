#!/usr/bin/env bun
import { webFetchTool } from "./src/tools/web_fetch.js";
import { AnthropicProvider } from "./src/provider/anthropic.js";
import { encoding_for_model } from "tiktoken";

const tokenizer = encoding_for_model("gpt-4");
const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const provider = new AnthropicProvider("claude-sonnet-4-5-20250929", API_KEY, 16384);

console.log("=== Testing Optimized web_fetch ===\n");

// Test 1: Short content (should pass through)
console.log("Test 1: Short content (example.com)");
const short = await webFetchTool.execute(
  { url: "https://example.com" },
  { provider, maxTokens: 16384, contextWindow: 200000 }
);
console.log("Length:", short.length, "chars");
console.log("Tokens:", tokenizer.encode(short).length);
console.log("Summarized?", short.includes("[Content summarized") ? "YES" : "NO");

// Test 2: Long content (should summarize)
console.log("\n\nTest 2: Long content (Wikipedia AI)");
const long = await webFetchTool.execute(
  { url: "https://en.wikipedia.org/wiki/Artificial_intelligence" },
  { provider, maxTokens: 16384, contextWindow: 200000 }
);
console.log("Result length:", long.length, "chars");
console.log("Result tokens:", tokenizer.encode(long).length);
console.log("Summarized?", long.includes("[Content summarized") ? "YES" : "NO");
console.log("\nFirst 500 chars of result:");
console.log(long.slice(0, 500));

// Calculate efficiency
console.log("\n\n=== Efficiency Analysis ===");
console.log("Context window: 200,000 tokens");
console.log("Max for summarization:", (200000 - 4096 - 1000), "tokens");
console.log("Summary output limit: 4,096 tokens");
console.log("Expected summary tokens: ~2,000-4,000 tokens");
