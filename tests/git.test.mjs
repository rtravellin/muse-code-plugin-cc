import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { commitFile, git, initGitRepo, makeTempDir } from "./helpers.mjs";
import { collectReviewContext, listWorktrees, resolveReviewTarget } from "../plugins/muse/scripts/lib/git.mjs";

test("listWorktrees reports the main checkout and added worktrees with their branches", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  commitFile(repo, "a.txt", "a\n", "init");
  const before = listWorktrees(repo);
  assert.equal(before.length, 1);
  assert.equal(before[0].branch, "main");

  const extra = path.join(repo, ".muse", "worktrees", "wt-1");
  git(repo, ["worktree", "add", "-b", "muse/session-test", extra, "main"]);
  const after = listWorktrees(repo);
  const added = after.find((entry) => entry.branch === "muse/session-test");
  assert.ok(added, JSON.stringify(after));
  // git reports canonical paths (macOS /private/var, Windows long names, which
  // only realpathSync.native expands from 8.3 forms like RUNNER~1).
  assert.equal(fs.realpathSync.native(added.path).toLowerCase(), fs.realpathSync.native(extra).toLowerCase());
});

test("resolveReviewTarget picks the working tree when dirty and the default branch otherwise", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  commitFile(repo, "a.txt", "a\n", "init");

  const clean = resolveReviewTarget(repo, {});
  assert.equal(clean.mode, "branch");
  assert.equal(clean.baseRef, "main");

  fs.writeFileSync(path.join(repo, "a.txt"), "b\n");
  const dirty = resolveReviewTarget(repo, {});
  assert.equal(dirty.mode, "working-tree");

  const explicit = resolveReviewTarget(repo, { base: "main" });
  assert.equal(explicit.mode, "branch");
  assert.equal(explicit.explicit, true);

  assert.throws(() => resolveReviewTarget(repo, { scope: "staged" }), /Unsupported review scope/);
});

test("collectReviewContext inlines small diffs and falls back to a file list for large ones", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  commitFile(repo, "a.txt", "a\n", "init");
  fs.writeFileSync(path.join(repo, "a.txt"), "changed\n");
  fs.writeFileSync(path.join(repo, "new.txt"), "brand new\n");

  const inline = collectReviewContext(repo, resolveReviewTarget(repo, {}));
  assert.equal(inline.inputMode, "inline-diff");
  assert.match(inline.content, /## Unstaged Diff/);
  assert.match(inline.content, /brand new/);
  assert.equal(inline.fileCount, 2);

  const summary = collectReviewContext(repo, resolveReviewTarget(repo, {}), { maxInlineFiles: 1 });
  assert.equal(summary.inputMode, "self-collect");
  assert.match(summary.content, /## Changed Files/);
  assert.match(summary.collectionGuidance, /file-reading tools/);
});

test("collectReviewContext handles branch comparisons", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  commitFile(repo, "a.txt", "a\n", "init");
  git(repo, ["checkout", "-q", "-b", "feature"]);
  commitFile(repo, "b.txt", "b\n", "feature work");

  const context = collectReviewContext(repo, resolveReviewTarget(repo, { base: "main" }));
  assert.equal(context.mode, "branch");
  assert.match(context.content, /## Commit Log/);
  assert.match(context.content, /feature work/);
  assert.deepEqual(context.changedFiles, ["b.txt"]);
});
