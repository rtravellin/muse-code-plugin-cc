import test from "node:test";
import assert from "node:assert/strict";

import { binaryAvailable, formatCommandFailure, terminateProcessTree } from "../plugins/muse/scripts/lib/process.mjs";

test("binaryAvailable reports missing binaries without throwing", () => {
  const status = binaryAvailable("definitely-not-a-real-binary-muse-cc", ["--version"]);
  assert.equal(status.available, false);
});

test("terminateProcessTree uses taskkill on win32 and process groups elsewhere", () => {
  const calls = [];
  const win = terminateProcessTree(1234, {
    platform: "win32",
    runCommandImpl: (command, args) => {
      calls.push([command, ...args]);
      return { status: 0, stdout: "", stderr: "", error: null, command, args };
    }
  });
  assert.equal(win.delivered, true);
  assert.equal(win.method, "taskkill");
  assert.deepEqual(calls[0], ["taskkill", "/PID", "1234", "/T", "/F"]);

  const signals = [];
  let alive = true;
  const posix = terminateProcessTree(999, {
    platform: "linux",
    killImpl: (pid, signal) => {
      signals.push([pid, signal]);
      if (signal === "SIGTERM") {
        alive = false;
      }
    },
    isAliveImpl: () => alive,
    graceMs: 10
  });
  assert.equal(posix.delivered, true);
  assert.ok(signals.some(([pid]) => pid === -999));
});

test("terminateProcessTree treats a partial taskkill as delivered when the root pid is gone", () => {
  const partial = {
    status: 128,
    stdout: "",
    stderr: "ERROR: The process with PID 2 (child process of PID 1) could not be terminated.\nReason: The operation attempted is not supported.",
    error: null,
    command: "taskkill",
    args: ["/PID", "1", "/T", "/F"]
  };
  const dead = terminateProcessTree(1, {
    platform: "win32",
    runCommandImpl: () => partial,
    isAliveImpl: () => false,
    graceMs: 10
  });
  assert.equal(dead.delivered, true);
  assert.equal(dead.method, "taskkill-partial");

  let alive = true;
  const finished = terminateProcessTree(1, {
    platform: "win32",
    runCommandImpl: () => partial,
    isAliveImpl: () => alive,
    killImpl: () => {
      alive = false;
    },
    graceMs: 10
  });
  assert.equal(finished.delivered, true);
  assert.equal(finished.method, "taskkill-partial+kill");
});

test("formatCommandFailure summarizes exit and stderr", () => {
  const text = formatCommandFailure({ command: "git", args: ["status"], status: 128, signal: null, stderr: "fatal: nope", stdout: "" });
  assert.equal(text, "git status: exit=128: fatal: nope");
});
