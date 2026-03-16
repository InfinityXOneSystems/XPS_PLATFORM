"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, execSync } = require("child_process");
const {
  hasConflicts,
  countConflicts,
  resolveConflicts,
} = require("../scripts/auto_resolve_conflicts");

const RESOLVER = path.resolve(
  __dirname,
  "../scripts/auto_resolve_conflicts.js",
);

// ---------------------------------------------------------------------------
// hasConflicts
// ---------------------------------------------------------------------------

test("hasConflicts - returns false for plain text", () => {
  assert.equal(hasConflicts("hello world\nno markers here"), false);
});

test("hasConflicts - returns true when conflict marker present", () => {
  const content = "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch";
  assert.equal(hasConflicts(content), true);
});

test("hasConflicts - returns false for empty string", () => {
  assert.equal(hasConflicts(""), false);
});

test("hasConflicts - returns true for multiple conflict blocks", () => {
  const content =
    "<<<<<<< HEAD\na\n=======\nb\n>>>>>>> br\nstuff\n<<<<<<< HEAD\nc\n=======\nd\n>>>>>>> br2";
  assert.equal(hasConflicts(content), true);
});

// ---------------------------------------------------------------------------
// countConflicts
// ---------------------------------------------------------------------------

test("countConflicts - returns 0 for plain text", () => {
  assert.equal(countConflicts("no markers"), 0);
});

test("countConflicts - returns 1 for a single conflict block", () => {
  const content = "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch";
  assert.equal(countConflicts(content), 1);
});

test("countConflicts - returns 2 for two conflict blocks", () => {
  const content =
    "<<<<<<< HEAD\na\n=======\nb\n>>>>>>> br\n<<<<<<< HEAD\nc\n=======\nd\n>>>>>>> br2";
  assert.equal(countConflicts(content), 2);
});

// ---------------------------------------------------------------------------
// resolveConflicts
// ---------------------------------------------------------------------------

test("resolveConflicts - keeps ours side, drops theirs", () => {
  const content =
    "before\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\nafter";
  const { resolved, count } = resolveConflicts(content);
  assert.equal(count, 1);
  assert.ok(resolved.includes("ours"), "resolved should contain ours");
  assert.ok(!resolved.includes("theirs"), "resolved should not contain theirs");
  assert.ok(resolved.includes("before"), "resolved should contain before");
  assert.ok(resolved.includes("after"), "resolved should contain after");
});

test("resolveConflicts - removes conflict marker lines", () => {
  const content = "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch";
  const { resolved } = resolveConflicts(content);
  assert.ok(!resolved.includes("<<<<<<<"), "should not contain start marker");
  assert.ok(!resolved.includes("======="), "should not contain separator");
  assert.ok(!resolved.includes(">>>>>>>"), "should not contain end marker");
});

test("resolveConflicts - no conflicts returns original content and count 0", () => {
  const content = "line one\nline two\n";
  const { resolved, count } = resolveConflicts(content);
  assert.equal(count, 0);
  assert.equal(resolved, content);
});

test("resolveConflicts - resolves multiple conflict blocks", () => {
  const content =
    "<<<<<<< HEAD\nfirst-ours\n=======\nfirst-theirs\n>>>>>>> br\n" +
    "middle\n" +
    "<<<<<<< HEAD\nsecond-ours\n=======\nsecond-theirs\n>>>>>>> br2";
  const { resolved, count } = resolveConflicts(content);
  assert.equal(count, 2);
  assert.ok(resolved.includes("first-ours"));
  assert.ok(!resolved.includes("first-theirs"));
  assert.ok(resolved.includes("second-ours"));
  assert.ok(!resolved.includes("second-theirs"));
  assert.ok(resolved.includes("middle"));
});

test("resolveConflicts - handles conflict with branch name in marker", () => {
  const content =
    "<<<<<<< HEAD\nhead-line\n=======\nother-line\n>>>>>>> feature/my-branch";
  const { resolved, count } = resolveConflicts(content);
  assert.equal(count, 1);
  assert.ok(resolved.includes("head-line"));
  assert.ok(!resolved.includes("other-line"));
});

test("resolveConflicts - preserves lines outside conflict blocks", () => {
  const content = "top\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> b\nbottom";
  const { resolved } = resolveConflicts(content);
  assert.ok(resolved.includes("top"), "top line should be present");
  assert.ok(resolved.includes("bottom"), "bottom line should be present");
});

// ---------------------------------------------------------------------------
// CLI integration – execFileSync
// ---------------------------------------------------------------------------

function writeTmp(content) {
  const tmp = path.join(os.tmpdir(), `xps-conflict-test-${Date.now()}.txt`);
  fs.writeFileSync(tmp, content, "utf-8");
  return tmp;
}

test("resolver: resolves a single conflict and writes result", () => {
  const content =
    "start\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\nend";
  const tmp = writeTmp(content);
  try {
    execFileSync(process.execPath, [RESOLVER, tmp], { encoding: "utf-8" });
    const result = fs.readFileSync(tmp, "utf-8");
    assert.ok(
      result.includes("ours"),
      "file should contain ours after resolution",
    );
    assert.ok(!result.includes("theirs"), "file should not contain theirs");
    assert.ok(
      !result.includes("<<<<<<<"),
      "conflict markers should be removed",
    );
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("resolver: exits 0 for file with conflicts that were resolved", () => {
  const content = "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> b";
  const tmp = writeTmp(content);
  try {
    const result = execFileSync(process.execPath, [RESOLVER, tmp], {
      encoding: "utf-8",
    });
    assert.ok(typeof result === "string");
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("resolver: prints resolved content in dry-run mode", () => {
  const content = "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch";
  const tmp = writeTmp(content);
  try {
    const stdout = execFileSync(
      process.execPath,
      [RESOLVER, tmp, "--dry-run"],
      { encoding: "utf-8" },
    );
    assert.ok(stdout.includes("ours"), "stdout should contain ours");
    assert.ok(!stdout.includes("theirs"), "stdout should not contain theirs");
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("resolver: dry-run does not modify files", () => {
  const content = "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch";
  const tmp = writeTmp(content);
  try {
    execFileSync(process.execPath, [RESOLVER, tmp, "--dry-run"], {
      encoding: "utf-8",
    });
    const after = fs.readFileSync(tmp, "utf-8");
    assert.equal(
      after,
      content,
      "file content must be unchanged after dry-run",
    );
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("resolver: resolves multiple conflicts in one file", () => {
  const content =
    "<<<<<<< HEAD\nours-first\n=======\ntheirs-first\n>>>>>>> br\nmiddle\n<<<<<<< HEAD\nours-second\n=======\ntheirs-second\n>>>>>>> br2";
  const tmp = writeTmp(content);
  try {
    execFileSync(process.execPath, [RESOLVER, tmp], { encoding: "utf-8" });
    const result = fs.readFileSync(tmp, "utf-8");
    assert.ok(result.includes("ours-first"));
    assert.ok(!result.includes("theirs-first"));
    assert.ok(result.includes("ours-second"));
    assert.ok(!result.includes("theirs-second"));
    assert.ok(result.includes("middle"));
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("resolver: clean file with no conflicts exits 0", () => {
  const content = "no conflict markers here\njust plain text\n";
  const tmp = writeTmp(content);
  try {
    execFileSync(process.execPath, [RESOLVER, tmp], {
      encoding: "utf-8",
    });
    const after = fs.readFileSync(tmp, "utf-8");
    assert.equal(after, content, "clean file must be unchanged");
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("resolver: resolves JSON file with conflict markers", () => {
  const content =
    '{\n<<<<<<< HEAD\n  "name": "ours"\n=======\n  "name": "theirs"\n>>>>>>> branch\n}';
  const tmp = writeTmp(content);
  try {
    execFileSync(process.execPath, [RESOLVER, tmp], { encoding: "utf-8" });
    const result = fs.readFileSync(tmp, "utf-8");
    assert.ok(result.includes('"name": "ours"'));
    assert.ok(!result.includes('"name": "theirs"'));
  } finally {
    fs.unlinkSync(tmp);
  }
});
