#!/usr/bin/env node
// Build docs/demo-script.json from the raw captures in docs/demo-captures/.
//
// Each capture is the unedited stdout+stderr of one bridge command from a
// single recorded session. This script pairs each capture with the slash
// command a user would have typed and applies exactly three substitutions so
// the demo does not leak a machine: the repository path, the home directory,
// and the login email. Nothing else in the output is changed.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAPTURES = path.join(ROOT, "docs", "demo-captures");
const OUT = path.join(ROOT, "docs", "demo-script.json");

const manifest = JSON.parse(fs.readFileSync(path.join(CAPTURES, "manifest.json"), "utf8"));

function substitute(text) {
  let out = text;
  for (const [from, to] of manifest.substitutions) {
    out = out.split(from).join(to);
  }
  return out;
}

const scenes = manifest.scenes.map((scene) => {
  const raw = fs.readFileSync(path.join(CAPTURES, scene.capture), "utf8").replace(/\r\n/g, "\n").trimEnd();
  return {
    command: scene.command,
    output: substitute(raw),
    hold: scene.hold ?? 3000
  };
});

const script = {
  title: manifest.title,
  description: manifest.description,
  footer: manifest.footer,
  scenes
};

fs.writeFileSync(OUT, `${JSON.stringify(script, null, 2)}\n`, "utf8");
console.log(`wrote ${path.relative(process.cwd(), OUT)} from ${scenes.length} captures`);
