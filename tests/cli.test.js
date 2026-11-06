import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("CLI reads an actual patch and emits a parseable JSON report", () => {
  const result = JSON.parse(
    execFileSync(
      process.execPath,
      ["scripts/cli.mjs", "docs/example.diff", "--format", "json"],
      { encoding: "utf8" },
    ),
  );
  assert.equal(result.summary.files, 4);
  assert.equal(result.summary.counts.high, 3);
});
test("CLI accepts stdin and fails on malformed patches", () => {
  const patch = "--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-a\n+b";
  const good = spawnSync(
    process.execPath,
    ["scripts/cli.mjs", "-", "--format", "json"],
    { input: patch, encoding: "utf8" },
  );
  assert.equal(good.status, 0);
  assert.equal(JSON.parse(good.stdout).summary.files, 1);
  const bad = spawnSync(process.execPath, ["scripts/cli.mjs", "-"], {
    input: "not a patch",
    encoding: "utf8",
  });
  assert.equal(bad.status, 1);
  assert.ok(bad.stderr.includes("No unified diff"));
});
test("CLI priority thresholds are opt-in and preserve the complete report", () => {
  const cases = [
    ["query.sql", "DROP TABLE users;", "high", 2],
    ["test.js", "test.only('focused', () => {});", "high", 0],
    ["test.js", "test.only('focused', () => {});", "medium", 2],
    ["app.js", "const x = 1;", "info", 2],
    ["readme.md", "documentation", "info", 0],
  ];
  for (const [path, line, threshold, status] of cases) {
    const result = spawnSync(process.execPath, ["scripts/cli.mjs", "-", "--format", "json", "--fail-on", threshold], {
      input: `--- a/${path}\n+++ b/${path}\n@@ -0,0 +1 @@\n+${line}\n`, encoding: "utf8",
    });
    assert.equal(result.status, status, result.stderr);
    assert.equal(JSON.parse(result.stdout).summary.files, 1);
  }
});
test("CLI rejects misspelled, missing and duplicate options", () => {
  for (const options of [["--fail-on", "critical"], ["--fail-on"], ["--format"], ["--formt", "json"], ["--format", "json", "--format", "markdown"]]) {
    const result = spawnSync(process.execPath, ["scripts/cli.mjs", "docs/example.diff", ...options], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PatchScope:/);
    assert.equal(result.stdout, "");
  }
});
test("Action writes output paths, summaries and reports without requiring a GitHub token", async () => {
  const dir = await mkdtemp(join(tmpdir(), "patchscope-test-"));
  try {
    const output = join(dir, "outputs"),
      summary = join(dir, "summary");
    await writeFile(output, "");
    await writeFile(summary, "");
    execFileSync(process.execPath, ["scripts/action.mjs"], {
      env: {
        ...process.env,
        INPUT_DIFF_FILE: "docs/example.diff",
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      },
      encoding: "utf8",
    });
    const variables = Object.fromEntries(
      (await readFile(output, "utf8"))
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );
    const report = JSON.parse(await readFile(variables["report-json"], "utf8"));
    assert.equal(report.summary.files, 4);
    assert.equal(variables["high-count"], "3");
    assert.ok(
      (await readFile(summary, "utf8")).includes("PatchScope review checklist"),
    );
    await rm(join(variables["report-json"], ".."), {
      recursive: true,
      force: true,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
