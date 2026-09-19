import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import path from "node:path";

import { makeTempDir, withEnv } from "./helpers.mjs";
import {
  claimJobTerminal,
  generateJobId,
  getConfig,
  isStaleLock,
  listJobs,
  patchJobIfActive,
  resolveStateDir,
  setConfig,
  upsertJob,
  withStateLock,
  writeJobFile
} from "../plugins/muse/scripts/lib/state.mjs";

function seedJob(workspace, overrides = {}) {
  const job = {
    id: generateJobId("run"),
    kind: "task",
    kindLabel: "delegate",
    title: "Muse Code Delegate",
    workspaceRoot: workspace,
    jobClass: "task",
    summary: "seed",
    status: "running",
    phase: "running",
    ...overrides
  };
  writeJobFile(workspace, job.id, job);
  upsertJob(workspace, job);
  return job;
}

test("cancelled wins over a later completion claim", () => {
  const workspace = makeTempDir();
  withEnv({ CLAUDE_PLUGIN_DATA: makeTempDir() }, () => {
    const job = seedJob(workspace);
    const cancel = claimJobTerminal(workspace, job.id, "cancelled", { errorMessage: "Stopped by user." });
    assert.equal(cancel.claimed, true);

    const complete = claimJobTerminal(workspace, job.id, "completed", { summary: "done" });
    assert.equal(complete.claimed, false);
    assert.equal(complete.status, "cancelled");
    assert.equal(listJobs(workspace).find((entry) => entry.id === job.id).status, "cancelled");
  });
});

test("patchJobIfActive is a no-op on terminal jobs and tracks bridge/agent pids", () => {
  const workspace = makeTempDir();
  withEnv({ CLAUDE_PLUGIN_DATA: makeTempDir() }, () => {
    const job = seedJob(workspace);
    const patched = patchJobIfActive(workspace, job.id, { agentPid: 4242, bridgePid: 4343, phase: "editing" });
    assert.equal(patched.patched, true);
    assert.equal(patched.job.agentPid, 4242);
    assert.equal(patched.job.bridgePid, 4343);
    assert.equal(patched.job.pid, 4343);

    claimJobTerminal(workspace, job.id, "completed", {});
    const after = patchJobIfActive(workspace, job.id, { phase: "editing" });
    assert.equal(after.patched, false);
    assert.equal(after.status, "completed");
  });
});

test("withStateLock reclaims a lock left behind by a dead process", () => {
  const workspace = makeTempDir();
  withEnv({ CLAUDE_PLUGIN_DATA: makeTempDir() }, () => {
    const lockPath = path.join(resolveStateDir(workspace), "state.json.lock");
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    // pid 2147483647 is (practically) never alive; the stamp is fresh so only
    // the dead-owner rule can reclaim it.
    fs.writeFileSync(lockPath, `2147483647 ${Date.now()}\n`, "utf8");
    assert.equal(isStaleLock(lockPath, { isAlive: () => false }), true);
    assert.equal(isStaleLock(lockPath, { isAlive: () => true }), false);

    const started = Date.now();
    const result = withStateLock(workspace, () => "ran");
    assert.equal(result, "ran");
    assert.ok(Date.now() - started < 2000, "stale lock must be reclaimed immediately");
    assert.equal(fs.existsSync(lockPath), false);
  });
});

test("isStaleLock treats an old timestamp as stale even for a live pid", () => {
  const lockPath = path.join(makeTempDir(), "state.json.lock");
  fs.writeFileSync(lockPath, `${process.pid} ${Date.now() - 60000}\n`, "utf8");
  assert.equal(isStaleLock(lockPath), true);
  fs.writeFileSync(lockPath, `${process.pid} ${Date.now()}\n`, "utf8");
  assert.equal(isStaleLock(lockPath), false);
});

test("config survives round trips and defaults the review gate to off", () => {
  const workspace = makeTempDir();
  withEnv({ CLAUDE_PLUGIN_DATA: makeTempDir() }, () => {
    assert.equal(getConfig(workspace).stopReviewGate, false);
    setConfig(workspace, "stopReviewGate", true);
    assert.equal(getConfig(workspace).stopReviewGate, true);
  });
});
