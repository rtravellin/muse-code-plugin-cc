#!/usr/bin/env node
// Cross-shell test runner: cmd.exe does not expand globs, and `node --test`
// only accepts glob patterns on newer Node versions, so list the files here.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS_DIR = path.join(ROOT, "tests");

const files = fs
  .readdirSync(TESTS_DIR)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => path.join(TESTS_DIR, name));

const extra = process.argv.slice(2);
const result = spawnSync(process.execPath, ["--test", ...extra, ...files], {
  cwd: ROOT,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
