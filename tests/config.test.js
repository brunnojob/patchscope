import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeDiff, toMarkdown } from "../src/engine.js";
import { validateConfig, ruleIds } from "../src/config.js";
import { toSarif } from "../src/sarif.js";
import { examples } from "../src/examples.js";

test("severity overrides change ordering, counts and overall level", () => {
  const report = analyzeDiff(examples.release, { rules: { "destructive-sql": "info", "deleted-tests": "off", "workflow-privilege": "medium" } });
  assert.equal(report.summary.counts.high, 0);
  assert.equal(report.summary.level, "medium");
  assert.equal(report.findings.at(-1).rule, "destructive-sql");
  assert.ok(!report.findings.some((f) => f.rule === "deleted-tests"));
  assert.deepEqual(report.configuration.disabledRules, ["deleted-tests"]);
  assert.match(toMarkdown(report), /Disabled rules: deleted-tests/);
});

test("suppression requires exact rule and path; optional line narrows the match", () => {
  const entry = { rule: "destructive-sql", path: "src/db/migrate.sql", line: 1, reason: " Disposable fixture database; reviewed in issue 42. " };
  const report = analyzeDiff(examples.release, { suppressions: [entry] });
  assert.equal(report.summary.suppressed, 1);
  assert.equal(report.summary.findings, 4);
  assert.equal(report.summary.counts.high, 2);
  assert.equal(report.suppressed[0].justification, entry.reason.trim());
  assert.match(toMarkdown(report), /Suppressed prompts/);
  for (const change of [{ path: "migrate.sql" }, { path: "src/db/*.sql" }, { line: 2 }, { rule: "tls" }]) {
    assert.equal(analyzeDiff(examples.release, { suppressions: [{ ...entry, ...change }] }).suppressed.length, 0);
  }
  const { line, ...fileScope } = entry;
  assert.equal(analyzeDiff(examples.release, { suppressions: [fileScope] }).suppressed.length, 1);
});

test("configuration validation catches misspellings and invalid suppressions", () => {
  for (const config of [null, [], { rules: null }, { suppressions: null }, { rule: {} }, { rules: [] }, { rules: { typo: "off" } }, { rules: { tls: "critical" } }, { suppressions: {} },
    ...[{ rule: "tls", path: "a.js", reason: " " }, { rule: "typo", path: "a.js", reason: "fixture" },
      { rule: "tls", path: "", reason: "fixture" }, { rule: "tls", path: "a.js", line: 0, reason: "fixture" },
      { rule: "tls", path: "a.js", line: 1.5, reason: "fixture" }, { rule: "tls", path: "a.js", reason: "x".repeat(501) },
      { rule: "tls", path: "a.js", reason: "fixture", extra: true }].map((entry) => ({ suppressions: [entry] }))]) {
    assert.throws(() => validateConfig(config));
  }
});

test("default configuration is deterministic and does not mutate caller configuration", () => {
  const config = { rules: { tls: "off" }, suppressions: [] };
  const original = JSON.stringify(config);
  analyzeDiff(examples.release, config);
  assert.equal(JSON.stringify(config), original);
  assert.deepEqual(analyzeDiff(examples.release), analyzeDiff(examples.release, {}));
  for (const f of analyzeDiff(examples.release).findings) assert.ok(ruleIds.includes(f.rule));
});

test("SARIF encodes paths, maps priorities and retains explained suppressions without source", () => {
  const secret = "aBcD1234zYxW9876pQrS";
  const patch = `--- a/config #%.json\n+++ b/config #%.json\n@@ -0,0 +1 @@\n+{"token":"${secret}"}\n`;
  const report = analyzeDiff(patch, { suppressions: [{ rule: "credential", path: "config #%.json", reason: "<fixture> [reviewed]" }] });
  const sarif = toSarif(report);
  assert.equal(sarif.version, "2.1.0");
  const result = sarif.runs[0].results[0];
  assert.equal(result.level, "error");
  assert.equal(result.ruleId, "credential");
  assert.equal(sarif.runs[0].tool.driver.rules[result.ruleIndex].id, result.ruleId);
  assert.equal(result.locations[0].physicalLocation.artifactLocation.uri, "config%20%23%25.json");
  assert.equal(result.locations[0].physicalLocation.region.startLine, 1);
  assert.deepEqual(result.suppressions, [{ kind: "external", status: "accepted", justification: "<fixture> [reviewed]" }]);
  assert.ok(!JSON.stringify(sarif).includes(secret));
  assert.match(toMarkdown(report), /\\<fixture\\>/);
});

test("SARIF supports file-level prompts, warnings and empty reports", () => {
  const report = analyzeDiff(examples.release);
  const sarif = toSarif(report);
  assert.ok(sarif.runs[0].results.some((r) => !r.locations[0].physicalLocation.region));
  assert.ok(sarif.runs[0].results.some((r) => r.level === "warning"));
  assert.deepEqual(toSarif(analyzeDiff(examples.small)).runs[0].results, []);
  const unsupported = toSarif(analyzeDiff("diff --git a/a b/a\nindex 123..456 100644"));
  assert.equal(unsupported.runs[0].invocations[0].toolExecutionNotifications.length, 1);
});
