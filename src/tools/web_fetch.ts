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
        
        // Determine if summarization is needed
        // We want to keep content under a reasonable size for the main agent
        const reasonableMaxTokens = 10000; // Keep summaries digestible for main agent
        
        if (tokenCount > reasonableMaxTokens) {
          try {
            // Calculate optimal content size for summarization
            // Formula: contextWindow - systemPromptTokens - maxOutputTokens - safety margin
            const systemPrompt = "You are a content summarizer. Provide a comprehensive summary that preserves all key information, main points, and important details.";
            const systemPromptTokens = tokenizer.encode(systemPrompt).length;
            const summaryOutputTokens = 8192; // More space for comprehensive summary
            const safetyMargin = 1000;
            
            const maxContentTokensForSummarization = context.contextWindow - systemPromptTokens - summaryOutputTokens - safetyMargin;
            
            // Truncate content to fit if needed
            let contentToSummarize = text;
            if (tokenCount > maxContentTokensForSummarization) {
              // Convert tokens to approximate character count (1 token ≈ 4 chars)
              const maxChars = maxContentTokensForSummarization * 4;
              contentToSummarize = text.slice(0, maxChars);
            }

            // Single LLM call to summarize - no history needed
            const result = await context.provider.call(
              [{ role: "user", content: `Provide a comprehensive summary of the following content. Preserve all key information, main points, important details, and structure:\n\n${contentToSummarize}` }],
              systemPrompt,
              summaryOutputTokens
            );

            const summary = result.content.find(b => b.type === "text")?.text || "[Summary unavailable]";
            return `[Content summarized - original: ${tokenCount.toLocaleString()} tokens]\n\n${summary}`;
          } catch (err) {
            // If summarization fails, fall back to truncation
            const fallbackChars = reasonableMaxTokens * 4;
            const truncated = text.slice(0, fallbackChars);
            return `${truncated}\n\n[Content truncated - original was ${tokenCount.toLocaleString()} tokens. Summarization failed: ${err instanceof Error ? err.message : String(err)}]`;
          }
        }
      }

      return text;
    } catch (err) {
      return `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
