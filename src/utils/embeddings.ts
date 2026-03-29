// Embedding index — manages vector embeddings for semantic search over turns.
// Uses fastembed (ONNX-based, runs locally, no API key needed).
import { EmbeddingModel, FlagEmbedding } from "fastembed";

export interface IndexedTurn {
  /** Index of this turn in the full episodic history. */
  index: number;
  /** Human-readable text representation of the turn. */
  text: string;
  /** Embedding vector. */
  vector: number[];
}

/** Cosine similarity between two vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export class EmbeddingIndex {
  private model: FlagEmbedding | null = null;
  private turns: IndexedTurn[] = [];

  /** Lazily initialize the embedding model (first use). */
  private async getModel(): Promise<FlagEmbedding> {
    if (!this.model) {
      this.model = await FlagEmbedding.init({ model: EmbeddingModel.BGESmallENV15 });
    }
    return this.model;
  }

  /** Number of indexed turns. */
  get size(): number {
    return this.turns.length;
  }

  /** Index a batch of turns. Skips turns that are already indexed. */
  async indexTurns(turns: Array<{ index: number; text: string }>): Promise<void> {
    const existing = new Set(this.turns.map((t) => t.index));
    const newTurns = turns.filter((t) => !existing.has(t.index));
    if (newTurns.length === 0) return;

    const model = await this.getModel();
    const texts = newTurns.map((t) => t.text);
    const vectors: number[][] = [];

    for await (const batch of model.passageEmbed(texts)) {
      vectors.push(...batch);
    }

    for (let i = 0; i < newTurns.length; i++) {
      this.turns.push({
        index: newTurns[i].index,
        text: newTurns[i].text,
        vector: vectors[i],
      });
    }
  }

  /**
   * Search for turns similar to a query.
   * @param query - Semantic search query
   * @param excludeIndices - Turn indices to exclude (e.g., those already in STM)
   * @param topK - Number of results to return
   */
  async search(query: string, excludeIndices: Set<number>, topK: number = 5): Promise<Array<{ index: number; text: string; score: number }>> {
    if (this.turns.length === 0) return [];

    const model = await this.getModel();
    const queryVec = await model.queryEmbed(query);

    const scored = this.turns
      .filter((t) => !excludeIndices.has(t.index))
      .map((t) => ({
        index: t.index,
        text: t.text,
        score: cosineSimilarity(queryVec, t.vector),
      }))
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }
}
