import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { makeTempDir, runNode } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "bump-version.mjs");

test("check-version passes on the repository manifests", () => {
  const result = runNode([SCRIPT, "--check"], { cwd: ROOT });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /All version metadata matches/);
});

test("bump-version rewrites every manifest in a copy of the repo", () => {
  const copy = makeTempDir();
  for (const file of ["package.json", "plugins/muse/.claude-plugin/plugin.json", ".claude-plugin/marketplace.json"]) {
    fs.mkdirSync(path.dirname(path.join(copy, file)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), path.join(copy, file));
  }
  const result = runNode([SCRIPT, "--root", copy, "1.2.3"], { cwd: ROOT });
  assert.equal(result.status, 0, result.stderr);
  const check = runNode([SCRIPT, "--root", copy, "--check", "1.2.3"], { cwd: ROOT });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(copy, "package.json"), "utf8")).version, "1.2.3");
});
