import type { Tool } from "../types.js";

export const webSearchTool: Tool = {
  name: "web_search",
  description: "Search the web via DuckDuckGo. No API key required. Returns title, URL, and snippet for each result. Use this to discover URLs, find documentation, or research topics. Always follow up with web_fetch to get the actual page content — snippets alone are rarely sufficient. Do NOT use bash to search the web.",
  params: [
    { name: "query", type: "string", description: "Search query. Examples: 'typescript satisfies keyword', 'bun sqlite api docs', 'anthropic claude tool use', 'react server components tutorial'" },
    { name: "count", type: "string", description: "Results to return (default: 5, max: 20). Use 10+ for broad research, 3-5 for targeted lookups.", required: false },
  ],
  async execute(args) {
    const query = encodeURIComponent(args.query);
    const count = Math.min(Math.max(parseInt(args.count ?? "5", 10), 1), 20);

    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
      });

      const html = await res.text();
      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Extract links
      const linkRe = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(html)) !== null && results.length < count) {
        const title = m[2].replace(/<[^>]+>/g, "").trim();
        let url = m[1];
        const uddg = url.match(/uddg=([^&]+)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
        results.push({ title, url, snippet: "" });
      }

      // Extract snippets
      let i = 0;
      while ((m = snippetRe.exec(html)) !== null && i < results.length) {
        results[i].snippet = m[1].replace(/<[^>]+>/g, "").trim();
        i++;
      }

      if (results.length === 0) {
        return `No results for "${args.query}"`;
      }

      return results
        .map((r, idx) => `${idx + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join("\n\n");
    } catch (err) {
      return `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
