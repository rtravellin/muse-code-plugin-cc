import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureAbsolutePath } from "./fs.mjs";

export const TRANSCRIPT_PATH_ENV = "MUSE_CC_TRANSCRIPT_PATH";
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");
const DEFAULT_MAX_TRANSCRIPT_CHARS = 200 * 1024;

function resolveUserPath(cwd, value) {
  if (value === "~") {
    return os.homedir();
  }
  if (String(value).startsWith("~/")) {
    return path.join(os.homedir(), String(value).slice(2));
  }
  return ensureAbsolutePath(cwd, value);
}

export function resolveClaudeSessionPath(cwd, options = {}) {
  const requestedPath = options.source || process.env[TRANSCRIPT_PATH_ENV];
  if (!requestedPath) {
    throw new Error("Could not identify the current Claude transcript. Retry with --source <path-to-claude-jsonl>.");
  }

  const sourcePath = resolveUserPath(cwd, requestedPath);
  if (path.extname(sourcePath) !== ".jsonl") {
    throw new Error(`Claude session source must be a JSONL file: ${sourcePath}`);
  }

  let source;
  try {
    source = fs.realpathSync(sourcePath);
  } catch {
    throw new Error(`Claude session file not found: ${sourcePath}`);
  }
  let projects;
  try {
    projects = fs.realpathSync(CLAUDE_PROJECTS_DIR);
  } catch {
    throw new Error(`Muse can import Claude sessions only from ${CLAUDE_PROJECTS_DIR}, which does not exist: ${source}`);
  }
  const relative = path.relative(projects, source);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Muse can import Claude sessions only from ${CLAUDE_PROJECTS_DIR}: ${source}`);
  }
  return source;
}

function stripSystemReminders(text) {
  return String(text ?? "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .trim();
}

function summarizeToolUse(block) {
  const name = block?.name ?? "tool";
  const input = block?.input && typeof block.input === "object" ? block.input : {};
  const hint =
    input.command ?? input.file_path ?? input.path ?? input.pattern ?? input.query ?? input.description ?? "";
  const detail = String(hint ?? "").replace(/\s+/g, " ").trim();
  return detail ? `[used ${name}: ${detail.slice(0, 160)}]` : `[used ${name}]`;
}

function summarizeToolResult(block) {
  const content = block?.content;
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((entry) => entry && entry.type === "text" && typeof entry.text === "string")
      .map((entry) => entry.text)
      .join("\n");
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return block?.is_error ? "[tool result: error]" : "";
  }
  return `[tool result: ${normalized.slice(0, 240)}${normalized.length > 240 ? "..." : ""}]`;
}

function renderContentBlocks(content) {
  if (typeof content === "string") {
    return stripSystemReminders(content);
  }
  if (!Array.isArray(content)) {
    return "";
  }
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    if (block.type === "text" && typeof block.text === "string") {
      const text = stripSystemReminders(block.text);
      if (text) {
        parts.push(text);
      }
    } else if (block.type === "tool_use") {
      parts.push(summarizeToolUse(block));
    } else if (block.type === "tool_result") {
      const summary = summarizeToolResult(block);
      if (summary) {
        parts.push(summary);
      }
    }
    // thinking / redacted blocks are intentionally dropped.
  }
  return parts.join("\n");
}

/**
 * Convert a Claude Code transcript (JSONL) into a compact Markdown conversation
 * that Muse can absorb as context. Tool traffic is reduced to one-line notes.
 */
export function buildTranscriptMarkdown(sourcePath, options = {}) {
  const maxChars = Math.max(1024, Number(options.maxChars) || DEFAULT_MAX_TRANSCRIPT_CHARS);
  const raw = fs.readFileSync(sourcePath, "utf8");
  const turns = [];
  let sessionId = null;
  let cwd = null;

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== "user" && entry?.type !== "assistant") {
      continue;
    }
    if (entry.isSidechain) {
      continue;
    }
    sessionId = sessionId ?? entry.sessionId ?? null;
    cwd = cwd ?? entry.cwd ?? null;
    const body = renderContentBlocks(entry.message?.content);
    if (!body) {
      continue;
    }
    turns.push({ role: entry.type === "user" ? "User" : "Claude", body });
  }

  if (turns.length === 0) {
    throw new Error(`No conversation turns found in Claude transcript: ${sourcePath}`);
  }

  const rendered = turns.map((turn) => `### ${turn.role}\n\n${turn.body}`);
  let markdown = rendered.join("\n\n");
  let truncated = false;
  if (markdown.length > maxChars) {
    // Keep the most recent context; older turns are the least useful to resume from.
    const kept = [];
    let total = 0;
    for (let index = rendered.length - 1; index >= 0; index -= 1) {
      const chunk = rendered[index];
      if (total + chunk.length + 2 > maxChars && kept.length > 0) {
        break;
      }
      kept.unshift(chunk);
      total += chunk.length + 2;
    }
    markdown = `_(earlier turns omitted to fit the transfer budget)_\n\n${kept.join("\n\n")}`;
    truncated = true;
  }

  return {
    markdown,
    turnCount: turns.length,
    truncated,
    claudeSessionId: sessionId,
    cwd
  };
}
