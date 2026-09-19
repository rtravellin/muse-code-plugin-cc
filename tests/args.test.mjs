import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs, splitRawArgumentString } from "../plugins/muse/scripts/lib/args.mjs";

test("parseArgs separates value options, boolean options, and positionals", () => {
  const parsed = parseArgs(["--model", "muse-spark-1.3", "--write", "fix", "the", "bug"], {
    valueOptions: ["model"],
    booleanOptions: ["write"]
  });
  assert.equal(parsed.options.model, "muse-spark-1.3");
  assert.equal(parsed.options.write, true);
  assert.deepEqual(parsed.positionals, ["fix", "the", "bug"]);
});

test("parseArgs supports --key=value and warns on unknown options", () => {
  const parsed = parseArgs(["--effort=high", "--bogus", "text"], {
    valueOptions: ["effort"],
    unknownMode: "warn"
  });
  assert.equal(parsed.options.effort, "high");
  assert.deepEqual(parsed.unknown, ["--bogus"]);
  assert.deepEqual(parsed.positionals, ["text"]);
});

test("parseArgs throws on a missing value", () => {
  assert.throws(() => parseArgs(["--model"], { valueOptions: ["model"] }), /Missing value/);
});

test("splitRawArgumentString honours quotes and escapes", () => {
  assert.deepEqual(splitRawArgumentString(`--base main "fix the auth" it\\'s`), ["--base", "main", "fix the auth", "it's"]);
  assert.deepEqual(splitRawArgumentString("   "), []);
});
