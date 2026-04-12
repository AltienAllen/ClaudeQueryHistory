#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

// ── Colour helpers (no dependencies) ────────────────────────────────
const tty = process.stdout.isTTY;
const c = (code, text) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);
const dim = (t) => c(2, t);
const bold = (t) => c(1, t);
const cyan = (t) => c(36, t);
const yellow = (t) => c(33, t);
const green = (t) => c(32, t);
const magenta = (t) => c(35, t);
const red = (t) => c(31, t);

// ── Arg parsing (minimal, no deps) ─────────────────────────────────
function parseArgs(argv) {
  const args = {
    keywords: [],
    project: null,
    type: "both", // user | assistant | both
    since: null,
    before: null,
    context: 2,
    json: false,
    listProjects: false,
    limit: 30,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      args.help = true;
    } else if (a === "--project" || a === "-p") {
      args.project = argv[++i];
    } else if (a === "--type" || a === "-t") {
      args.type = argv[++i];
    } else if (a === "--since" || a === "-s") {
      args.since = parseDate(argv[++i]);
    } else if (a === "--before" || a === "-b") {
      args.before = parseDate(argv[++i]);
    } else if (a === "--context" || a === "-C") {
      args.context = parseInt(argv[++i], 10);
    } else if (a === "--limit" || a === "-n") {
      args.limit = parseInt(argv[++i], 10);
    } else if (a === "--json") {
      args.json = true;
    } else if (a === "list_projects" || a === "--list-projects") {
      args.listProjects = true;
    } else if (!a.startsWith("-")) {
      args.keywords.push(a);
    }
    i++;
  }
  return args;
}

// ── Date parsing with friendly names ────────────────────────────────
function parseDate(input) {
  if (!input) return null;
  const now = new Date();
  const lower = input.toLowerCase();

  if (lower === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (lower === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const weekMatch = lower.match(/^last\s*(\d+)?\s*weeks?$/);
  if (weekMatch) {
    const n = parseInt(weekMatch[1] || "1", 10);
    const d = new Date(now);
    d.setDate(d.getDate() - n * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const dayMatch = lower.match(/^last\s*(\d+)\s*days?$/);
  if (dayMatch) {
    const n = parseInt(dayMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const monthMatch = lower.match(/^last\s*(\d+)?\s*months?$/);
  if (monthMatch) {
    const n = parseInt(monthMatch[1] || "1", 10);
    const d = new Date(now);
    d.setMonth(d.getMonth() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // Try ISO date
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed;

  console.error(red(`Could not parse date: "${input}"`));
  console.error(
    dim(
      "  Try: today, yesterday, last week, last 3 days, last 2 weeks, 2026-04-01"
    )
  );
  process.exit(1);
}

// ── Discover session logs ───────────────────────────────────────────
function getProjectsBase() {
  return join(homedir(), ".claude", "projects");
}

function listProjects() {
  const base = getProjectsBase();
  if (!existsSync(base)) return [];

  const projects = [];
  for (const dir of readdirSync(base)) {
    const dp = join(base, dir);
    if (!statSync(dp).isDirectory()) continue;
    const sessions = readdirSync(dp).filter((f) => f.endsWith(".jsonl"));
    if (sessions.length === 0) continue;

    const totalSize = sessions.reduce(
      (sum, f) => sum + statSync(join(dp, f)).size,
      0
    );
    projects.push({
      dirName: dir,
      friendlyName: dir.replace(/^[A-Za-z]--/, "").replace(/--/g, " > ").replace(/-/g, "/"),
      sessions: sessions.length,
      sizeMB: (totalSize / 1024 / 1024).toFixed(1),
    });
  }
  return projects.sort((a, b) => b.sessions - a.sessions);
}

function resolveProjectDir(projectFilter) {
  const base = getProjectsBase();
  if (!projectFilter) {
    // Auto-detect from cwd
    const cwd = process.cwd().replace(/\\/g, "/").replace(/^\/([a-z])\//, (_, l) => `${l.toUpperCase()}:\\`).replace(/\//g, "\\");
    const cwdKey = cwd.replaceAll("\\", "-").replace(":", "");
    const dirs = existsSync(base) ? readdirSync(base) : [];
    const match = dirs.find((d) => d === cwdKey || d.toLowerCase() === cwdKey.toLowerCase());
    if (match) return [join(base, match)];
    // Fallback: partial match
    const partial = dirs.filter(
      (d) => d.toLowerCase().includes(basename(cwd).toLowerCase())
    );
    if (partial.length > 0) return partial.map((d) => join(base, d));
    console.error(
      yellow(
        "Could not auto-detect project. Use --project or run list_projects."
      )
    );
    process.exit(1);
  }

  // Match by substring
  const dirs = existsSync(base) ? readdirSync(base) : [];
  const matches = dirs.filter((d) =>
    d.toLowerCase().includes(projectFilter.toLowerCase())
  );
  if (matches.length === 0) {
    console.error(red(`No project matching "${projectFilter}".`));
    console.error(dim("Run with list_projects to see available projects."));
    process.exit(1);
  }
  return matches.map((d) => join(base, d));
}

// ── Parse session file ──────────────────────────────────────────────
function parseSession(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const messages = [];

  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    if (obj.type !== "user" && obj.type !== "assistant") continue;

    let text = "";
    const content = obj.message?.content;
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      text = content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n");
    }

    // Skip system-reminder-only messages and empty messages
    if (!text || text.trim().length === 0) continue;
    // Strip system-reminder tags for cleaner output
    const cleaned = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
    if (cleaned.length === 0) continue;
    // Skip task notification noise
    if (cleaned.startsWith("<task-notification>")) continue;

    messages.push({
      type: obj.type,
      text: cleaned,
      timestamp: obj.timestamp ? new Date(obj.timestamp) : null,
      sessionId: basename(filePath, ".jsonl"),
      uuid: obj.uuid,
    });
  }

  return messages;
}

// ── Search ──────────────────────────────────────────────────────────
function searchMessages(messages, keywords, opts) {
  const patterns = keywords.map((k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  const results = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Type filter
    if (opts.type === "user" && msg.type !== "user") continue;
    if (opts.type === "assistant" && msg.type !== "assistant") continue;

    // Date filters
    if (opts.since && msg.timestamp && msg.timestamp < opts.since) continue;
    if (opts.before && msg.timestamp && msg.timestamp > opts.before) continue;

    // Keyword match — all keywords must match
    const matchesAll = patterns.every((p) => p.test(msg.text));
    if (!matchesAll) continue;

    // Gather context window
    const ctxStart = Math.max(0, i - opts.context);
    const ctxEnd = Math.min(messages.length - 1, i + opts.context);
    const contextMsgs = [];
    for (let j = ctxStart; j <= ctxEnd; j++) {
      contextMsgs.push({
        ...messages[j],
        isMatch: j === i,
      });
    }

    results.push({
      match: msg,
      context: contextMsgs,
      index: i,
    });
  }

  return results;
}

// ── Output formatters ───────────────────────────────────────────────
function truncate(text, maxLen = 300) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function formatTimestamp(ts) {
  if (!ts) return "unknown";
  const now = new Date();
  const diff = now - ts;
  const days = Math.floor(diff / 86400000);
  const dateStr = ts.toISOString().slice(0, 10);
  const timeStr = ts.toISOString().slice(11, 16);
  if (days === 0) return `today ${timeStr}`;
  if (days === 1) return `yesterday ${timeStr}`;
  if (days < 7) return `${days} days ago (${dateStr})`;
  return dateStr;
}

function highlightKeywords(text, keywords) {
  if (!tty) return text;
  let result = text;
  for (const kw of keywords) {
    const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    result = result.replace(regex, `\x1b[43m\x1b[30m$1\x1b[0m`);
  }
  return result;
}

function printResults(results, keywords, opts) {
  if (results.length === 0) {
    console.log(yellow("No matches found."));
    return;
  }

  console.log(
    dim(`\n${results.length} match${results.length === 1 ? "" : "es"} found\n`)
  );

  const limited = results.slice(0, opts.limit);
  for (const r of limited) {
    const ts = formatTimestamp(r.match.timestamp);
    const sid = r.match.sessionId.slice(0, 8);
    const typeLabel =
      r.match.type === "user" ? green("user") : cyan("assistant");

    console.log(
      `${dim("──")} ${bold(ts)} ${dim("session:" + sid)} ${typeLabel}`
    );

    for (const cm of r.context) {
      const prefix = cm.isMatch ? magenta("▸ ") : dim("  ");
      const label =
        cm.type === "user" ? green("Q: ") : cyan("A: ");
      const body = cm.isMatch
        ? highlightKeywords(truncate(cm.text), keywords)
        : dim(truncate(cm.text, 150));
      console.log(`${prefix}${label}${body}`);
    }
    console.log("");
  }

  if (results.length > opts.limit) {
    console.log(
      dim(
        `  ... ${results.length - opts.limit} more results. Use --limit ${results.length} to see all.`
      )
    );
  }
}

function printResultsJson(results) {
  const output = results.map((r) => ({
    timestamp: r.match.timestamp?.toISOString() || null,
    sessionId: r.match.sessionId,
    type: r.match.type,
    text: r.match.text,
    context: r.context.map((cm) => ({
      type: cm.type,
      text: cm.text,
      isMatch: cm.isMatch,
      timestamp: cm.timestamp?.toISOString() || null,
    })),
  }));
  console.log(JSON.stringify(output, null, 2));
}

// ── Help ────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`
${bold("query-sessions")} — Search Claude Code session logs

${bold("USAGE")}
  node index.js <keywords...> [options]
  node index.js list_projects

${bold("EXAMPLES")}
  node index.js immigration UK          Search current project for "immigration" AND "UK"
  node index.js MatterAI --since yesterday
  node index.js "download PDF" --type user   Only search user messages
  node index.js caselaw --since "last week" --context 4
  node index.js list_projects            List all projects with session logs
  node index.js GDPR --project MatterAI  Search a different project

${bold("OPTIONS")}
  ${cyan("list_projects")}              List all available projects
  ${cyan("-p, --project <name>")}       Search a specific project (substring match)
                              Default: auto-detect from current directory
  ${cyan("-t, --type <user|assistant|both>")}
                              Filter by message type (default: both)
  ${cyan("-s, --since <date>")}         Only messages after this date
                              Accepts: today, yesterday, last week,
                              last 3 days, last 2 weeks, 2026-04-01
  ${cyan("-b, --before <date>")}        Only messages before this date
  ${cyan("-C, --context <n>")}          Show n surrounding messages (default: 2)
  ${cyan("-n, --limit <n>")}            Max results to display (default: 30)
  ${cyan("--json")}                     Output as JSON
  ${cyan("-h, --help")}                 Show this help
`);
}

// ── Main ────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.listProjects) {
    const projects = listProjects();
    if (projects.length === 0) {
      console.log(yellow("No session logs found."));
      process.exit(0);
    }
    console.log(bold("\nAvailable projects:\n"));
    for (const p of projects) {
      console.log(
        `  ${cyan(p.friendlyName)}  ${dim(`(${p.sessions} sessions, ${p.sizeMB} MB)`)}`
      );
      console.log(`    ${dim("dir: " + p.dirName)}`);
    }
    console.log("");
    process.exit(0);
  }

  if (args.keywords.length === 0) {
    console.error(red("No search keywords provided."));
    console.error(dim('  Usage: node index.js <keywords...> [options]'));
    console.error(dim('  Run with --help for full usage.'));
    process.exit(1);
  }

  // Resolve project directories
  const projectDirs = resolveProjectDir(args.project);

  // Load and parse all sessions
  let allMessages = [];
  let sessionCount = 0;
  for (const dir of projectDirs) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    for (const f of files) {
      const msgs = parseSession(join(dir, f));
      allMessages.push(...msgs);
      sessionCount++;
    }
  }

  // Sort by timestamp
  allMessages.sort((a, b) => {
    if (!a.timestamp) return -1;
    if (!b.timestamp) return 1;
    return a.timestamp - b.timestamp;
  });

  console.log(
    dim(
      `Searched ${sessionCount} session${sessionCount === 1 ? "" : "s"} (${allMessages.length} messages)`
    )
  );

  // Search
  const results = searchMessages(allMessages, args.keywords, {
    type: args.type,
    since: args.since,
    before: args.before,
    context: args.context,
  });

  // Output
  if (args.json) {
    printResultsJson(results);
  } else {
    printResults(results, args.keywords, { limit: args.limit });
  }
}

main();
