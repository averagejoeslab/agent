// Recall tool — semantic search over episodic memory turns not in short-term memory.
// Uses fastembed for local embeddings (no API key needed).
import type { Tool } from "../types.js";
import type { EmbeddingIndex } from "../utils/embeddings.js";
import { ContextWindow } from "../memory/context.js";
import type { EpisodicStore } from "../memory/episodic.js";

export interface RecallToolDeps {
  embeddingIndex: EmbeddingIndex;
  context: ContextWindow;
  episodic: EpisodicStore;
}

export function createRecallTool(deps: RecallToolDeps): Tool {
  return {
    name: "recall",
    description: "Search past conversation history that has been evicted from the current context window. You MUST use this tool before saying you don't know or asking the user to repeat themselves if the information needed to answer their prompt is not visible in the current conversation. If the user references something discussed earlier but you don't see it in context, use this tool. The search is semantic — describe what you're looking for in natural language. Returns the most relevant past turns ranked by similarity score.",
    params: [
      { name: "query", type: "string", description: "Natural language description of what to recall. Be specific for better results. Examples: 'user preferred coding style and formatting rules', 'earlier discussion about PostgreSQL database schema', 'API key or credentials the user mentioned', 'error message or bug we were debugging'" },
      { name: "count", type: "string", description: "Number of past turns to return (default: 5). Use 3 for targeted recall, 10 for broad research over past conversation.", required: false },
    ],
    async execute(args) {
      const count = parseInt(args.count ?? "5", 10);

      // Re-index any new turns from the episodic trace
      const events = await deps.episodic.readAll();
      const allTurns = ContextWindow.turnsFromEvents(events);
      await deps.embeddingIndex.indexTurns(allTurns);

      // Get the set of turn indices currently in short-term memory
      const activeIndices = deps.context.getActiveTurnIndices();

      if (deps.embeddingIndex.size === 0) {
        return "No episodic memory to search.";
      }

      if (deps.embeddingIndex.size <= activeIndices.size) {
        return "All turns are currently in short-term memory. Nothing to recall.";
      }

      // Search for turns similar to the query, excluding those in STM
      const results = await deps.embeddingIndex.search(args.query, activeIndices, count);

      if (results.length === 0) {
        return `No relevant past turns found for: "${args.query}"`;
      }

      // Format results
      const formatted = results.map((r, i) => {
        return `--- Turn ${r.index} (similarity: ${r.score.toFixed(3)}) ---\n${r.text}`;
      });

      return `Found ${results.length} relevant past turns:\n\n${formatted.join("\n\n")}`;
    },
  };
}

