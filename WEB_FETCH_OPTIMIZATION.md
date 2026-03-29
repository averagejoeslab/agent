# web_fetch Tool - LLM Summarization Optimization

## Overview

The `web_fetch` tool uses an **inner LLM call** to intelligently summarize web content that exceeds a reasonable size for the main agent to process.

## Key Optimization: Maximum Content Processing

### The Formula

```
Max Content Tokens = Context Window - System Prompt - Summary Output - Safety Margin
                   = 200,000 - ~30 - 8,192 - 1,000
                   = ~190,778 tokens of content
```

This means we can process up to **~190k tokens** (~760k characters) of web content in a single summarization call!

### Token Budget Breakdown

| Component | Tokens | Purpose |
|-----------|--------|---------|
| **Context Window** | 200,000 | Total available (Claude Sonnet 4) |
| **System Prompt** | ~30 | "You are a content summarizer..." |
| **Input Content** | ~190,778 | **Maximum web content** |
| **Summary Output** | 8,192 | Space for comprehensive summary |
| **Safety Margin** | 1,000 | Buffer for edge cases |

---

## How It Works

### 1. Fetch & Convert
```typescript
// Fetch URL
const res = await fetch(url);

// Convert HTML → Markdown
if (contentType.includes("text/html")) {
  text = NodeHtmlMarkdown.translate(html);
}
```

### 2. Check Size
```typescript
const tokenCount = tokenizer.encode(text).length;
const reasonableMaxTokens = 10000; // Threshold for summarization
```

**Decision:**
- **< 10k tokens**: Return content as-is (no summarization needed)
- **> 10k tokens**: Summarize via LLM

### 3. Calculate Max Processing
```typescript
const maxContentTokens = contextWindow 
  - systemPromptTokens 
  - summaryOutputTokens (8,192)
  - safetyMargin (1,000);
```

### 4. Truncate if Needed
```typescript
if (tokenCount > maxContentTokens) {
  // Truncate to fit (1 token ≈ 4 chars)
  const maxChars = maxContentTokens * 4;
  contentToSummarize = text.slice(0, maxChars);
}
```

### 5. Single LLM Call (No History)
```typescript
const result = await provider.call(
  [{ 
    role: "user", 
    content: `Provide a comprehensive summary...\n\n${contentToSummarize}` 
  }],
  "You are a content summarizer. Provide comprehensive summary...",
  8192  // Max output tokens for summary
);
```

**Key Points:**
- ✅ **Single message** - No conversation history
- ✅ **Comprehensive prompt** - Asks for detailed summary
- ✅ **Large output budget** - 8,192 tokens for thorough summary
- ✅ **No streaming** - Uses `call()` not `stream()`

### 6. Return Summary
```typescript
return `[Content summarized - original: ${tokenCount} tokens]\n\n${summary}`;
```

---

## Real-World Examples

### Example 1: Short Page (example.com)
**Original:** 33 tokens  
**Action:** Pass through unchanged  
**Result:** 33 tokens (full content)

### Example 2: Medium Article (~15k tokens)
**Original:** 15,000 tokens  
**Action:** Summarize  
**Input to LLM:** 15,000 tokens (full content)  
**Result:** ~2,000-4,000 tokens (comprehensive summary)

### Example 3: Wikipedia Article (~170k tokens)
**Original:** 169,015 tokens  
**Action:** Truncate to 190k limit, then summarize  
**Input to LLM:** ~190,000 tokens (truncated)  
**Result:** ~2,000-6,000 tokens (comprehensive summary)

### Example 4: Massive Documentation (~500k tokens)
**Original:** 500,000 tokens  
**Action:** Truncate to 190k limit, then summarize  
**Input to LLM:** ~190,000 tokens (first ~76% of content)  
**Result:** ~2,000-6,000 tokens (summary of first portion)

---

## Why This Design?

### Problem
- Web pages can be **massive** (100k-500k+ tokens)
- Would overwhelm main agent's context
- Expensive, slow, wasteful

### Solution
- **Maximize processing**: Use almost entire context window
- **Single call**: No history overhead
- **Comprehensive output**: 8k tokens for detailed summary
- **Intelligent truncation**: Keep as much as possible

### Benefits
✅ Processes **up to 190k tokens** (~760k chars) in one call  
✅ Returns **comprehensive 2k-8k token summaries**  
✅ No context pollution for main agent  
✅ Automatic - works transparently  
✅ Smart threshold (10k tokens) avoids unnecessary calls  

---

## Efficiency Comparison

### Before (Simple Truncation)
```
500k token page → Truncate to 50k → Return 50k tokens
                                     ❌ Main agent overloaded
```

### After (LLM Summarization)
```
500k token page → Truncate to 190k → Summarize to 4k → Return 4k tokens
                                                        ✅ Main agent happy
```

**Savings:** 46k tokens saved in main agent context!

---

## Token Cost Analysis

### Per Summarization Call
- **Input:** ~190k tokens max
- **Output:** ~4k tokens average
- **Total:** ~194k tokens per call

### Cost Example (Claude Sonnet 4 pricing)
- Input: 190k × $3/MTok = $0.57
- Output: 4k × $15/MTok = $0.06
- **Total: ~$0.63 per large page**

**Worth it?** Yes! 
- Preserves semantic meaning
- Saves main agent context
- Better than naive truncation

---

## Key Optimizations

### 1. No History Management
```typescript
// Just one message - no conversation history
[{ role: "user", content: "Summarize..." }]
```

### 2. Maximum Content Budget
```typescript
// Use almost entire context window
maxContent = 200k - 30 - 8k - 1k = ~190k
```

### 3. Generous Output Space
```typescript
// 8,192 tokens for comprehensive summary
summaryOutputTokens = 8192
```

### 4. Smart Threshold
```typescript
// Only summarize if > 10k tokens
if (tokenCount > 10000) { summarize() }
```

### 5. Graceful Fallback
```typescript
catch (err) {
  // If summarization fails, return truncated content
  return truncated + "[Summarization failed]";
}
```

---

## Future Enhancements

### Potential Improvements

1. **Chunked Processing**
   - For 500k+ token pages
   - Split into chunks, summarize each, combine
   - Would handle arbitrarily large content

2. **Quality Tiers**
   - Fast summary (4k output)
   - Detailed summary (8k output - current)
   - Comprehensive summary (16k output)

3. **Caching**
   - Cache summaries by URL
   - Avoid re-processing same pages

4. **Multi-Model**
   - Use cheaper model for summarization
   - Main agent uses premium model

---

## Code Location

**File:** `src/tools/web_fetch.ts`

**Key Functions:**
- `execute()` - Main tool logic
- `provider.call()` - Inner LLM call for summarization

**Dependencies:**
- `node-html-markdown` - HTML → Markdown conversion
- `tiktoken` - Accurate token counting
- `AnthropicProvider.call()` - Non-streaming LLM call

---

## Summary

The `web_fetch` tool is **token-aware and intelligent**:

- ✅ Processes up to **190k tokens** of content
- ✅ Returns **2-8k token comprehensive summaries**
- ✅ Single LLM call, no history overhead
- ✅ Automatic, transparent to user
- ✅ Graceful fallbacks on errors
- ✅ Smart threshold avoids unnecessary calls

This makes it suitable for processing **any web content** while keeping the main agent's context clean and efficient!
