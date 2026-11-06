export const ruleIds = Object.freeze([
  "binary", "deleted-tests", "environment", "large-file", "workflow",
  "private-key", "credential", "destructive-sql", "test-scope",
  "workflow-privilege", "tls", "dynamic-code", "lockfile", "test-coverage",
]);

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, allowed, label) => {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new Error(`Unknown ${label} field: ${key}`);
};

export function validateConfig(config = {}) {
  if (!object(config)) throw new Error("Configuration must be a JSON object.");
  keys(config, ["rules", "suppressions"], "configuration");
  const rules = config.rules === undefined ? {} : config.rules;
  const suppressions = config.suppressions === undefined ? [] : config.suppressions;
  if (!object(rules)) throw new Error("rules must be an object.");
  for (const [rule, severity] of Object.entries(rules)) {
    if (!ruleIds.includes(rule)) throw new Error(`Unknown rule: ${rule}`);
    if (!["high", "medium", "info", "off"].includes(severity))
      throw new Error(`Invalid severity for ${rule}; use high, medium, info or off.`);
  }
  if (!Array.isArray(suppressions) || suppressions.length > 1000)
    throw new Error("suppressions must be an array with at most 1,000 entries.");
  for (const suppression of suppressions) {
    if (!object(suppression)) throw new Error("Each suppression must be an object.");
    keys(suppression, ["rule", "path", "line", "reason"], "suppression");
    if (!ruleIds.includes(suppression.rule)) throw new Error(`Unknown suppression rule: ${suppression.rule}`);
    if (typeof suppression.path !== "string" || !suppression.path.trim())
      throw new Error("A suppression requires an exact patch path.");
    if (suppression.line !== undefined && (!Number.isSafeInteger(suppression.line) || suppression.line < 1))
      throw new Error("A suppression line must be a positive integer.");
    if (typeof suppression.reason !== "string" || !suppression.reason.trim() || suppression.reason.length > 500)
      throw new Error("A suppression requires a non-empty reason of at most 500 characters.");
  }
  return { rules: { ...rules }, suppressions: suppressions.map((entry) => ({ ...entry, reason: entry.reason.trim() })) };
}

export function configureFindings(findings, config) {
  const active = [], suppressed = [];
  for (const original of findings) {
    const setting = config.rules[original.rule];
    if (setting === "off") continue;
    const finding = { ...original, severity: setting ?? original.severity };
    const suppression = config.suppressions.find((entry) =>
      entry.rule === finding.rule && entry.path === finding.path &&
      (entry.line === undefined || entry.line === finding.line),
    );
    if (suppression) suppressed.push({ ...finding, justification: suppression.reason });
    else active.push(finding);
  }
  return { active, suppressed };
}
