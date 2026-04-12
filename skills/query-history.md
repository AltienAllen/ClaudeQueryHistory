---
name: query-history
description: Search Claude Code session logs for past questions, findings, and decisions. Use when recalling prior conversation context, decisions, URLs, KB IDs, or any topic from previous sessions.
user-invocable: true
disable-model-invocation: false
allowed-tools: Bash(node *)
argument-hint: <keywords...> [--since yesterday] [--type user] [--project name]
---

# Query Session History

Search past Claude Code session logs for specific topics.

## How to invoke

When the user asks to recall something from a previous session, or you need prior context, run:

```bash
node ~/.claude/skills/query-history/index.js $ARGUMENTS
```

If the tool is installed elsewhere, check these locations in order:
1. `~/.claude/skills/query-history/index.js`
2. The `claude-query-history` command (if npm-linked)
3. The project-local `.claude/skills/query-history/index.js`

## Arguments

Pass keywords and options directly. All keywords must match (AND logic).

**Examples:**

```bash
# Search current project for a topic
node ~/.claude/skills/query-history/index.js immigration UK

# Only user questions from last week
node ~/.claude/skills/query-history/index.js "download PDF" --type user --since "last week"

# Search a different project
node ~/.claude/skills/query-history/index.js auth --project MatterAI

# List all projects with session history
node ~/.claude/skills/query-history/index.js list_projects
```

## Options

- `--project <name>` / `-p` — search a specific project (substring match). Default: auto-detect from cwd
- `--type <user|assistant|both>` / `-t` — filter message type. Default: both
- `--since <date>` / `-s` — only after this date (today, yesterday, last week, last 3 days, 2026-04-01)
- `--before <date>` / `-b` — only before this date
- `--context <n>` / `-C` — surrounding messages to show. Default: 2
- `--limit <n>` / `-n` — max results. Default: 30
- `--json` — machine-readable output

## Interpreting results

Each result shows:
- Timestamp and session ID
- Message type (user question or assistant answer)
- The matched text with keywords highlighted
- Surrounding messages for context (the Q&A pair)

Summarise relevant findings for the user. If there are many results, focus on the most recent or most relevant ones.
