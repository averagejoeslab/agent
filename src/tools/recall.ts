// Recall tool — semantic search over episodic memory turns not in short-term memory.
// Uses fastembed for local embeddings (no API key needed).
import type { Tool } from "../types.js";
import type { EmbeddingIndex } from "../utils/embeddings.js";
import type { ContextWindow } from "../memory/context.js";
import type { EpisodicStore } from "../memory/episodic.js";

export interface RecallToolDeps {
  embeddingIndex: EmbeddingIndex;
  context: ContextWindow;
  episodic: EpisodicStore;
}

export function createRecallTool(deps: RecallToolDeps): Tool {
  return {
    name: "recall",
    description: "Search episodic memory for past conversation turns that are no longer in the current context window. Uses semantic similarity to find relevant history. Use this when you need to remember something from earlier in the conversation that may have been evicted from short-term memory. Returns the most relevant past turns ranked by similarity.",
    params: [
      { name: "query", type: "string", description: "Semantic search query describing what you want to recall (e.g., 'the user's preferred coding style', 'earlier discussion about database schema')" },
      { name: "count", type: "string", description: "Number of results to return (default: 5)", required: false },
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

// Re-export ContextWindow for the static method
export { ContextWindow } from "../memory/context.js";
