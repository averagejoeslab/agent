import { NodeHtmlMarkdown } from "node-html-markdown";
import { encoding_for_model } from "tiktoken";
import type { Tool } from "../types.js";

const tokenizer = encoding_for_model("gpt-4");

export const webFetchTool: Tool = {
  name: "web_fetch",
  description: "Fetch a URL and return its content. HTML is converted to markdown. Content is automatically summarized if too long.",
  params: [
    { name: "url", type: "string", description: "URL to fetch" },
  ],
  async execute(args, context) {
    try {
      const res = await fetch(args.url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
      });

      if (!res.ok) {
        return `error: HTTP ${res.status}`;
      }

      const contentType = res.headers.get("content-type") ?? "";
      let text: string;

      if (contentType.includes("text/html")) {
        // Convert HTML to markdown for better readability
        const html = await res.text();
        text = NodeHtmlMarkdown.translate(html);
      } else {
        // Plain text or other formats
        text = await res.text();
      }

      // If provider is available and content is too long, summarize it
      if (context?.provider && context?.contextWindow) {
        const tokenCount = tokenizer.encode(text).length;
        // Use 1/4 of context window as max for fetched content
        const maxContentTokens = Math.floor(context.contextWindow / 4);

        if (tokenCount > maxContentTokens) {
          // Truncate to fit in context, leaving room for prompt
          const truncateToChars = Math.floor(maxContentTokens * 3.5); // rough char estimate
          const truncated = text.slice(0, truncateToChars);

          try {
            // Ask LLM to summarize
            const result = await context.provider.call(
              [{ role: "user", content: `Summarize the following content concisely, preserving key information:\n\n${truncated}` }],
              "You are a concise content summarizer. Extract and preserve the most important information.",
              Math.min(4096, context.maxTokens ?? 4096)
            );

            const summary = result.content.find(b => b.type === "text")?.text || "[Summary unavailable]";
            return `[Content summarized due to length - original: ${tokenCount} tokens]\n\n${summary}`;
          } catch (err) {
            // If summarization fails, fall back to truncation
            return `${truncated}\n\n[Content truncated - original was ${text.length} characters. Summarization failed: ${err instanceof Error ? err.message : String(err)}]`;
          }
        }
      }

      return text;
    } catch (err) {
      return `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
