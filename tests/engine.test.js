import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDiff, analyzeDiff, toMarkdown, limits } from "../src/engine.js";
import { examples } from "../src/examples.js";
const patch = (path, body) =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n${body}`;
test("truncated hunks warn at EOF, file boundaries and hunk boundaries", () => {
  const partial = patch("one.txt", "@@ -1,2 +1,2 @@\n-old\n+new");
  for (const input of [partial, partial + "\n" + patch("two.txt", "@@ -1 +1 @@\n-a\n+b"), partial + "\n@@ -9 +9 @@\n-c\n+d"]) {
    const report = analyzeDiff(input);
    assert.ok(report.warnings.some(w => /incomplete/.test(w)));
    assert.match(toMarkdown(report), /incomplete/);
  }
});
test("complete and empty-range hunks do not warn about truncation", () => {
  for (const body of ["@@ -1 +1 @@\n-old\n+new\n\\ No newline at end of file", "@@ -0,0 +1 @@\n+new", "@@ -1 +0,0 @@\n-old", "@@ -0,0 +0,0 @@"]) {
    assert.deepEqual(parseDiff(patch("one.txt", body)).warnings, []);
  }
});
test("release example reports workflow privileges, destructive SQL, removed tests and manifest context", () => {
  const report = analyzeDiff(examples.release);
  assert.equal(report.summary.files, 4);
  assert.equal(report.summary.counts.high, 3);
  for (const rule of [
    "workflow",
    "workflow-privilege",
    "destructive-sql",
    "deleted-tests",
    "lockfile",
  ])
    assert.ok(report.findings.some((f) => f.rule === rule));
});
test("hunk line numbers stay accurate through removals, additions and context", () => {
  const file = parseDiff(
    patch("app.js", "@@ -10,3 +20,4 @@\n same\n-old\n+new\n+extra\n end"),
  ).files[0];
  assert.deepEqual(
    file.lines.filter((l) => l.kind === "add").map((l) => l.new),
    [21, 22],
  );
  assert.equal(file.additions, 2);
  assert.equal(file.deletions, 1);
});
test("a line beginning with +++ inside a hunk is content, not a file header", () => {
  const file = parseDiff(patch("app.txt", "@@ -1 +1 @@\n-old\n+++value"))
    .files[0];
  assert.equal(file.lines.at(-1).text, "++value");
  assert.equal(file.additions, 1);
});
test("plain unified diffs with consecutive files remain separate", () => {
  const parsed = parseDiff(
    "--- a/one.txt\n+++ b/one.txt\n@@ -1 +1 @@\n-a\n+b\n--- a/two.txt\n+++ b/two.txt\n@@ -1 +1 @@\n-c\n+d",
  );
  assert.deepEqual(
    parsed.files.map((f) => f.path),
    ["one.txt", "two.txt"],
  );
});
test("renames preserve a real a/ directory in rename metadata", () => {
  const file = parseDiff(
    "diff --git a/a/old.js b/a/new.js\nsimilarity index 100%\nrename from a/old.js\nrename to a/new.js",
  ).files[0];
  assert.equal(file.status, "renamed");
  assert.equal(file.path, "a/new.js");
  assert.equal(file.previousPath, "a/old.js");
});
test("quoted filenames with spaces and UTF-8 octal escapes are decoded", () => {
  const file = parseDiff(
    'diff --git "a/caf\\303\\251 file.txt" "b/caf\\303\\251 file.txt"\n--- "a/caf\\303\\251 file.txt"\n+++ "b/caf\\303\\251 file.txt"\n@@ -1 +1 @@\n-a\n+b',
  ).files[0];
  assert.equal(file.path, "café file.txt");
});
test("only added lines trigger credential or SQL rules", () => {
  const report = analyzeDiff(
    patch("query.sql", "@@ -1,2 +1 @@\n-DROP TABLE users;\n SELECT 1;"),
  );
  assert.equal(report.findings.filter((f) => f.severity === "high").length, 0);
});
test("credentials are flagged without exposing their literal in either report format", () => {
  const secret = "aBcD1234zYxW9876pQrS";
  const report = analyzeDiff(
    patch("config.json", `@@ -0,0 +1 @@\n+{"api_key": "${secret}"}`),
  );
  assert.ok(report.findings.some((f) => f.rule === "credential"));
  assert.ok(!JSON.stringify(report).includes(secret));
  assert.ok(!toMarkdown(report).includes(secret));
});
test("obvious placeholders are excluded from the credential heuristic", () => {
  const report = analyzeDiff(
    patch("config.py", '@@ -0,0 +1 @@\n+token = "YOUR_TOKEN_GOES_HERE"'),
  );
  assert.ok(!report.findings.some((f) => f.rule === "credential"));
});
test("test skip and TLS bypass are actionable and classified", () => {
  const report = analyzeDiff(
    patch(
      "tests/test_http.py",
      "@@ -0,0 +1,2 @@\n+@pytest.mark.skip\n+response = get(url, verify=False)",
    ),
  );
  assert.ok(
    report.findings.some(
      (f) => f.rule === "test-scope" && f.severity === "medium",
    ),
  );
  assert.ok(
    report.findings.some((f) => f.rule === "tls" && f.severity === "high"),
  );
});
test("binary changes produce an explicit uninspected-content signal", () => {
  const report = analyzeDiff(
    "diff --git a/photo.png b/photo.png\nBinary files a/photo.png and b/photo.png differ",
  );
  assert.equal(report.files[0].binary, true);
  assert.ok(report.findings.some((f) => f.rule === "binary"));
});
test("small documentation patch has no flags", () => {
  const report = analyzeDiff(examples.small);
  assert.equal(report.summary.level, "clear");
  assert.equal(report.summary.additions, 2);
  assert.equal(report.summary.deletions, 1);
});
test("lockfile in patch suppresses dependency reproducibility prompt", () => {
  const report = analyzeDiff(
    patch("package.json", '@@ -1 +1 @@\n-{"x":"1"}\n+{"x":"2"}') +
      "\n" +
      patch("package-lock.json", "@@ -1 +1 @@\n-1\n+2"),
  );
  assert.ok(!report.findings.some((f) => f.rule === "lockfile"));
});
test("unsupported or empty input fails clearly and size limits are enforced", () => {
  for (const input of ["", "hello", "x".repeat(limits.bytes + 1)])
    assert.throws(() => analyzeDiff(input));
  assert.throws(
    () => parseDiff("diff --git a/a b/a\n".repeat(501)),
    /500-file/,
  );
});
test("Markdown escapes untrusted path markup and does not include raw patch text", () => {
  const report = analyzeDiff(
    patch("src/<img>.js", "@@ -0,0 +1 @@\n+eval(userInput)"),
  );
  const result = toMarkdown(report);
  assert.ok(result.includes("\\<img\\>"));
  assert.ok(!result.includes("eval(userInput)"));
});
test("CRLF input and no-newline markers retain line counts", () => {
  const file = parseDiff(
    patch(
      "a.txt",
      "@@ -1 +1 @@\n-old\n+new\n\\ No newline at end of file",
    ).replace(/\n/g, "\r\n"),
  ).files[0];
  assert.equal(file.additions, 1);
  assert.equal(file.deletions, 1);
});
