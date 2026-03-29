# How Cline (Claude Code) Documents Its Tools

Based on research from Cline documentation, GitHub repository, and community resources.

## Overview

Cline uses **XML-formatted tool definitions** in its system prompt, which is different from AgentOS's JSON schema approach. The tools are defined in a highly structured, self-documenting format.

## Tool Definition Format

Based on research findings, Cline uses an XML-like format for tool definitions:

```xml
<read_file>
  <path>File path here</path>
</read_file>

<write_to_file>
  Description: Request to write content to a file at the specified path. 
  If the file exists, it will be overwritten with the provided content. 
  If the file doesn't exist, it will be created. This tool will 
  automatically create any directories needed to write the file.
  
  Parameters:
  - path: File path
  - content: Content to write
</write_to_file>
```

## Key Architecture Components

### 1. Tool Registration System

From `src/core/prompts/system-prompt/tools/README.md`:
- Automatic tool collection and registration
- Tools organized by variants (different model families may get different tool sets)
- Central `ClineToolSet` provider

### 2. System Prompt Assembly

From research:
- Different prompt variants per model family (Claude, GPT, Devstral, etc.)
- Tools section is assembled dynamically
- Snapshot testing for prompt consistency
- Located in: `src/core/prompts/system-prompt/`

### 3. Tool Categories

Cline organizes tools into categories:

**File Operations:**
- `write_to_file` - Create or overwrite files
- `read_file` - Read file contents
- `replace_in_file` - Make targeted edits
- `search_files` - Search files by pattern

**Terminal:**
- `execute_command` - Run shell commands with approval

**Browser:**
- Browser automation tools for web interaction

**Workspace:**
- IDE/workspace integration tools

**MCP (Model Context Protocol):**
- Dynamic tool loading from MCP servers
- Marketplace for community tools

## Key Differences from AgentOS

### Cline Approach:
```xml
## write_to_file
Description: Request to write content to a file at the specified path.
If the file exists, it will be overwritten with the provided content.

Parameters:
- path (string, required): File path to write
- content (string, required): Content to write to file

Usage:
<write_to_file>
  <path>/path/to/file.ts</path>
  <content>...</content>
</write_to_file>
```

### AgentOS Approach:
```markdown
### write
Write content to file. Creates parent directories if needed.

Parameters:
- **path** (string) (required) - File path to write
- **content** (string) (required) - Content to write
```

## What We Can Learn

### 1. **Verbose Descriptions**
Cline's tool descriptions are very detailed:
- Explains what happens in different scenarios
- States side effects explicitly
- Provides usage examples

### 2. **XML vs Markdown**
Cline uses XML format which:
- Shows exact calling syntax
- Makes parameter structure explicit
- Easier for models to parse (especially XML-trained models)

### 3. **Model-Specific Variants**
Cline has different tool definitions per model family:
- `anthropic_claude_sonnet_4-basic.snap`
- `cline_devstral-basic.snap`
- `openai_gpt-basic.snap`

This allows optimization per model's strengths.

### 4. **Tool Categorization**
Tools are grouped by function:
```
File Operations:
  - write_to_file
  - read_file
  - replace_in_file

Terminal Operations:
  - execute_command

Browser Operations:
  - launch_browser
  - navigate
```

### 5. **Dynamic Tool Loading**
Via MCP (Model Context Protocol):
- Tools can be added at runtime
- Community-contributed tools
- Server-based architecture

## Implementation in Cline

### File Structure:
```
src/core/prompts/system-prompt/
  ├── tools/
  │   ├── README.md          # Tool registration docs
  │   ├── file-operations.ts
  │   ├── terminal.ts
  │   ├── browser.ts
  │   └── mcp.ts
  ├── __tests__/
  │   └── __snapshots__/     # Prompt snapshots per model
  └── index.ts               # Main prompt assembly
```

### Testing Strategy:
- Snapshot tests for every model variant
- Ensures prompt consistency
- Catches unintended changes
- Examples: `anthropic_claude_sonnet_4-basic.snap`

## Recommendations for AgentOS

### Keep Current Approach
AgentOS's current self-documenting tool system is good:
- Clean, readable markdown format
- Single source of truth
- Easy to maintain

### Potential Improvements:

1. **Add Usage Examples** (Optional)
```markdown
### write
Write content to file. Creates parent directories if needed.

Parameters:
- **path** (string) (required) - File path to write
- **content** (string) (required) - Content to write

Example:
  write(path: "src/new-file.ts", content: "export const x = 1;")
```

2. **More Verbose Descriptions** (Optional)
```markdown
### write
Write content to a file at the specified path. If the file exists, 
it will be overwritten. If it doesn't exist, it will be created. 
Parent directories are automatically created if needed.
```

3. **Tool Categories in Prompt**
```markdown
## File Operations

### read
...

### write
...

## Web Operations

### web_search
...
```

4. **Snapshot Testing**
Add tests to ensure system prompt stays consistent.

## Conclusion

**Cline's approach**: XML-based, verbose, model-specific variants, extensive testing

**AgentOS's approach**: Markdown-based, concise, model-agnostic, self-documenting

Both are valid! AgentOS's current approach is cleaner and simpler. Cline's is more enterprise-grade with extensive testing and model optimization.

The key insight: **Tools should carry enough context for the model to use them correctly without external documentation.**

AgentOS already does this well. The main enhancement could be adding optional usage examples if tools become complex.

---

## Sources
- Cline GitHub: https://github.com/cline/cline
- System Prompt Directory: `src/core/prompts/system-prompt/`
- Tool Registration: `src/core/prompts/system-prompt/tools/`
- DeepWiki Documentation: https://deepwiki.com/cline/cline/
- Community discussions and tool usage patterns
