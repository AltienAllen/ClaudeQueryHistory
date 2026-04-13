# ClaudeQueryHistory

Search Claude Code session logs for past questions, findings, and decisions. Zero dependencies — just Node.js.

Claude Code stores full conversation history as JSONL files in `~/.claude/projects/`. This tool searches those logs by keyword, date, and message type.

## Quick start

```bash
git clone https://github.com/AltienAllen/ClaudeQueryHistory.git
cd ClaudeQueryHistory
bash install.sh
```

That's it. The `/query-history` slash command is now available in **all** Claude Code sessions on this machine.

## Install options

### Global skill (recommended — works in all sessions)

```bash
bash install.sh
```

Copies `index.js` and `SKILL.md` to `~/.claude/skills/query-history/`. Every Claude Code session will see the `/query-history` skill automatically.

### Per-project skill (only one project)

```bash
bash install.sh --local
```

Copies to `.claude/skills/query-history/` in the current directory.

### Run directly (no skill install)

**Git Bash / WSL / macOS / Linux:**
```bash
node ~/.claude/skills/query-history/index.js immigration UK
```

**Windows CMD:**
```cmd
node %USERPROFILE%\.claude\skills\query-history\index.js immigration UK
```

**Windows PowerShell:**
```powershell
node $env:USERPROFILE\.claude\skills\query-history\index.js immigration UK
```

### Install on another machine

```bash
git clone https://github.com/AltienAllen/ClaudeQueryHistory.git
cd ClaudeQueryHistory
bash install.sh
```

## Usage

```
node index.js <keywords...> [options]
node index.js list_projects
```

Keywords are matched with AND logic (all must appear, case-insensitive).

## Examples

```bash
# Search current project for "immigration" AND "UK"
node index.js immigration UK

# Only your questions, from the last week
node index.js "download PDF" --type user --since "last week"

# Search with more context (4 messages each side)
node index.js caselaw --context 4

# Search a different project
node index.js GDPR --project MatterAI

# JSON output for piping
node index.js auth --json

# List all projects with session logs
node index.js list_projects
```

## Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <name>` | `-p` | Target project (substring match) | auto-detect from cwd |
| `--type <user\|assistant\|both>` | `-t` | Filter by message type | `both` |
| `--since <date>` | `-s` | Only messages after this date | — |
| `--before <date>` | `-b` | Only messages before this date | — |
| `--context <n>` | `-C` | Surrounding messages to show | `2` |
| `--limit <n>` | `-n` | Max results to display | `30` |
| `--json` | | Output as JSON | — |
| `--help` | `-h` | Show help | — |

### Date formats

`--since` and `--before` accept: `today`, `yesterday`, `last week`, `last 2 weeks`, `last 3 days`, `last month`, or ISO dates like `2026-04-01`.

## Example output

```
Searched 3 sessions (783 messages)

8 matches found

── yesterday 21:25 session:1badde8a user
  A: Committed: dd6a3a6 — 3,044 files, 1.4M insertions.
▸ Q: Now I think we want to import immigration law in the UK...
  A: Excellent API. Here's the picture:

── yesterday 21:37 session:1badde8a assistant
  A: 25/25 fetched, zero failures. Let me verify the inventory:
▸ A: 25 documents, all complete — JSON + MD + PDF, zero missing.
  A: Bootstrap confirmed complete. Want me to set up the KB columns?
```

Each match shows the matched message highlighted, with surrounding messages for context.

## Companion tool

[ClaudeSessionAnalyser](https://github.com/AltienAllen/ClaudeSessionAnalyser) compresses session logs into structured views (conversation trees, correction analysis, error reports, file hotspots). This tool searches; that tool compresses. Install both:

```bash
git clone https://github.com/AltienAllen/ClaudeQueryHistory.git
cd ClaudeQueryHistory && bash install.sh && cd ..

git clone https://github.com/AltienAllen/ClaudeSessionAnalyser.git
cd ClaudeSessionAnalyser && bash install.sh && cd ..
```

## How it works

1. Discovers JSONL session logs in `~/.claude/projects/<project>/`
2. Parses user and assistant messages (skips tool calls, system messages, attachments)
3. Matches all keywords (AND logic, case-insensitive)
4. Shows matches with surrounding context (the Q&A pair)

## Requirements

- Node.js 18+
- Claude Code (session logs are created automatically)

## License

MIT
