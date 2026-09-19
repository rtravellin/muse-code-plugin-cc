#!/usr/bin/env node
// Render docs/demo.svg: an animated terminal (SMIL, no JS) that "types" the
// commands from docs/demo-script.json and reveals each captured output.
// GitHub renders animated SVGs in READMEs, so this needs no video tooling.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "docs", "demo-script.json");
const OUT = path.join(ROOT, "docs", "demo.svg");

const COLS = 100;
const ROWS = 34;
const CHAR_W = 8.4;
const LINE_H = 19;
const PAD = 14;
const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const TYPE_MS = 140;
const TYPE_CHUNK = 4; // characters per typing frame; keeps the SVG small
const HOLD_MS = 2800;
const OUTPUT_MS = 350;

const theme = {
  bg: "#0d1117",
  chrome: "#161b22",
  text: "#e6edf3",
  dim: "#8b949e",
  prompt: "#7ee787",
  cmd: "#79c0ff",
  accent: "#d2a8ff",
  ok: "#3fb950",
  warn: "#d29922"
};

function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrap(line) {
  const out = [];
  let rest = String(line);
  while (rest.length > COLS) {
    out.push(rest.slice(0, COLS));
    rest = rest.slice(COLS);
  }
  out.push(rest);
  return out;
}

function colorFor(line) {
  if (/^# /.test(line)) return theme.accent;
  if (/^(Status: ready|✔|Stopped |Fixed )/.test(line)) return theme.ok;
  if (/^(Verdict|Worktree|Branch|Muse session ID|Resume in Muse):/.test(line)) return theme.accent;
  if (/^\[muse-cc\]/.test(line)) return theme.dim;
  if (/^- \[(critical|high)\]/.test(line)) return theme.warn;
  return theme.text;
}

const script = JSON.parse(fs.readFileSync(SCRIPT, "utf8"));
const W = COLS * CHAR_W + PAD * 2;
const H = ROWS * LINE_H + PAD * 2 + 28;

// Build a flat list of visible lines with the time each appears, scrolling the
// viewport once the screen fills. Each scene = one typed command + output.
const events = []; // { t, lines: [{text, color, prompt}] } snapshots
let t = 400;
let buffer = [];

function snapshot(atMs) {
  events.push({ t: atMs, lines: buffer.slice(-ROWS) });
}

for (const scene of script.scenes) {
  const cmd = scene.command;
  // typing animation: reveal one char at a time on the prompt line
  for (let i = TYPE_CHUNK; i < cmd.length + TYPE_CHUNK; i += TYPE_CHUNK) {
    const partial = cmd.slice(0, Math.min(i, cmd.length));
    const lines = buffer.concat([{ text: partial, prompt: true }]);
    events.push({ t, lines: lines.slice(-ROWS) });
    t += TYPE_MS;
  }
  buffer.push({ text: cmd, prompt: true });
  snapshot(t);
  t += 500;
  const outputLines = scene.output.split("\n").flatMap(wrap);
  const chunk = Math.max(1, Math.ceil(outputLines.length / 12));
  for (let i = 0; i < outputLines.length; i += chunk) {
    for (const line of outputLines.slice(i, i + chunk)) {
      buffer.push({ text: line, color: colorFor(line) });
    }
    snapshot(t);
    t += OUTPUT_MS;
  }
  buffer.push({ text: "" });
  t += scene.hold ?? HOLD_MS;
}
const TOTAL = t + 1500;

// Emit one <g> per snapshot, shown only during its interval via SMIL.
const frames = events.map((event, index) => {
  const begin = (event.t / 1000).toFixed(3);
  const end = ((events[index + 1]?.t ?? TOTAL) / 1000).toFixed(3);
  const texts = event.lines
    .map((line, row) => {
      const y = PAD + 28 + (row + 1) * LINE_H - 5;
      if (line.prompt) {
        return `<text x="${PAD}" y="${y}"><tspan fill="${theme.prompt}">❯ </tspan><tspan fill="${theme.cmd}">${esc(line.text)}</tspan></text>`;
      }
      return `<text x="${PAD}" y="${y}" fill="${line.color ?? theme.text}">${esc(line.text)}</text>`;
    })
    .join("");
  return `<g opacity="0"><set attributeName="opacity" to="1" begin="${begin}s" end="${end}s" fill="freeze"/><set attributeName="opacity" to="0" begin="${end}s" fill="freeze"/>${texts}</g>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" font-size="13">
<title>${esc(script.title)}</title>
<desc>${esc(script.description)}</desc>
<rect width="${W}" height="${H}" rx="10" fill="${theme.bg}"/>
<rect width="${W}" height="28" rx="10" fill="${theme.chrome}"/>
<rect y="14" width="${W}" height="14" fill="${theme.chrome}"/>
<circle cx="18" cy="14" r="5" fill="#ff5f57"/><circle cx="36" cy="14" r="5" fill="#febc2e"/><circle cx="54" cy="14" r="5" fill="#28c840"/>
<text x="${W / 2}" y="18" text-anchor="middle" fill="${theme.dim}" font-size="12">${esc(script.title)}</text>
<g style="white-space:pre" xml:space="preserve">${frames.join("\n")}</g>
<text x="${W - PAD}" y="${H - 6}" text-anchor="end" fill="${theme.dim}" font-size="10">${esc(script.footer ?? "")}</text>
</svg>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg, "utf8");
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(Buffer.byteLength(svg) / 1024).toFixed(0)} KB, ${events.length} frames, ${(TOTAL / 1000).toFixed(1)}s)`);
