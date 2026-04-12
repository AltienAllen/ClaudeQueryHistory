# ClaudeQueryHistory

Search your Claude Code session logs for past questions, findings, and decisions. Zero dependencies — just Node.js.

Claude Code stores full conversation history as JSONL files in `~/.claude/projects/`. This tool parses those logs and lets you search across sessions by keyword, date, and message type.

## Installation

### Option A — Run directly (no install)

```bash
node /path/to/ClaudeQueryHistory/index.js <keywords...> [options]
```

### Option B — Global install via npm link

```bash
cd ClaudeQueryHistory
npm link
# now available everywhere:
claude-query-history immigration UK
```

### Option C — Claude Code skill (recommended)

Copy the skill file so Claude can use it automatically:

```bash
# Global (all projects)
cp skills/query-history.md ~/.claude/skills/

# Or per-project
cp skills/query-history.md .claude/skills/
```

Then in any Claude Code session, use `/query-history` or just ask Claude to search your past sessions.

## Usage

```
claude-query-history <keywords...> [options]
claude-query-history list_projects
```

### Search examples

```bash
# Search current project for "immigration" AND "UK"
claude-query-history immigration UK

# Only your questions, from the last week
claude-query-history "download PDF" --type user --since "last week"

# Search with more context (4 messages each side)
claude-query-history caselaw --context 4

# Search a different project
claude-query-history GDPR --project MatterAI

# JSON output for piping
claude-query-history auth --json | jq '.[] | .text'

# List all projects with session logs
claude-query-history list_projects
```

### Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <name>` | `-p` | Search a specific project (substring match) | auto-detect from cwd |
| `--type <user\|assistant\|both>` | `-t` | Filter by message type | `both` |
| `--since <date>` | `-s` | Only messages after this date | — |
| `--before <date>` | `-b` | Only messages before this date | — |
| `--context <n>` | `-C` | Surrounding messages to show | `2` |
| `--limit <n>` | `-n` | Max results to display | `30` |
| `--json` | | Output as JSON | `false` |
| `--help` | `-h` | Show help | |

### Date formats

The `--since` and `--before` flags accept:

- `today`, `yesterday`
- `last week`, `last 2 weeks`
- `last 3 days`, `last month`
- ISO dates: `2026-04-01`

## How it works

1. Discovers JSONL session logs in `~/.claude/projects/<project>/`
2. Parses user and assistant messages (skips tool calls, system messages, attachments)
3. Matches all keywords (AND logic, case-insensitive)
4. Shows matches with surrounding context (the Q&A pair)

## Requirements

- Node.js 18+
- Claude Code session logs (created automatically by Claude Code)

## License

MIT
