// Episodic store — append-only JSONL trace. Everything that happens, forever.
import { appendFile, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { EpisodicEvent } from "../types.js";

export class EpisodicStore {
  constructor(private filePath: string) {}

  /** Append one event to the trace. */
  async append(event: EpisodicEvent): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, JSON.stringify(event) + "\n");
  }

  /** Read all events from the trace. */
  async readAll(): Promise<EpisodicEvent[]> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      return content
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as EpisodicEvent);
    } catch {
      return [];
    }
  }
}
