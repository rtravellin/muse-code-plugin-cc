import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { makeTempDir } from "./helpers.mjs";
import { buildTranscriptMarkdown } from "../plugins/muse/scripts/lib/claude-session-transfer.mjs";

function writeTranscript(lines) {
  const file = path.join(makeTempDir(), "session.jsonl");
  fs.writeFileSync(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8");
  return file;
}

test("buildTranscriptMarkdown keeps user/assistant text, drops thinking, summarizes tools", () => {
  const file = writeTranscript([
    { type: "queue-operation" },
    { type: "user", sessionId: "s1", cwd: "/repo", message: { role: "user", content: "<system-reminder>hidden</system-reminder>\nFix the bug" } },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "private reasoning" },
          { type: "text", text: "On it." },
          { type: "tool_use", name: "Bash", input: { command: "npm test" } }
        ]
      }
    },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", content: [{ type: "text", text: "3 passing" }] }] } },
    { type: "assistant", isSidechain: true, message: { role: "assistant", content: [{ type: "text", text: "sidechain noise" }] } }
  ]);

  const result = buildTranscriptMarkdown(file);
  assert.equal(result.turnCount, 3);
  assert.equal(result.claudeSessionId, "s1");
  assert.equal(result.cwd, "/repo");
  assert.match(result.markdown, /### User\n\nFix the bug/);
  assert.match(result.markdown, /### Claude\n\nOn it\.\n\[used Bash: npm test\]/);
  assert.match(result.markdown, /\[tool result: 3 passing\]/);
  assert.doesNotMatch(result.markdown, /hidden|private reasoning|sidechain noise/);
  assert.equal(result.truncated, false);
});

test("buildTranscriptMarkdown trims the oldest turns past the budget", () => {
  const lines = [];
  for (let index = 0; index < 20; index += 1) {
    lines.push({ type: "user", message: { role: "user", content: `turn ${index} ${"x".repeat(200)}` } });
  }
  const result = buildTranscriptMarkdown(writeTranscript(lines), { maxChars: 1024 });
  assert.equal(result.truncated, true);
  assert.match(result.markdown, /earlier turns omitted/);
  assert.match(result.markdown, /turn 19/);
  assert.doesNotMatch(result.markdown, /turn 0 /);
});

test("buildTranscriptMarkdown rejects transcripts without turns", () => {
  assert.throws(() => buildTranscriptMarkdown(writeTranscript([{ type: "system" }])), /No conversation turns/);
});
