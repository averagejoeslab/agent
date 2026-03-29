import { NodeHtmlMarkdown } from "node-html-markdown";
import type { Tool } from "../types.js";

export const webFetchTool: Tool = {
  name: "web_fetch",
  description: "Fetch a URL and return its content. HTML is converted to markdown for readability.",
  params: [
    { name: "url", type: "string", description: "URL to fetch" },
  ],
  async execute(args) {
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

      // Truncate if too long (keep first 50k characters)
      if (text.length > 50000) {
        text = text.slice(0, 50000) + "\n\n[Content truncated - original was " + text.length + " characters]";
      }

      return text;
    } catch (err) {
      return `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
