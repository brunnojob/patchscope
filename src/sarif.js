import { ruleIds } from "./config.js";

const level = { high: "error", medium: "warning", info: "note" };
const uri = (path) => path.split("/").map(encodeURIComponent).join("/");

export function toSarif(report) {
  const result = (finding) => ({
    ruleId: finding.rule,
    ruleIndex: ruleIds.indexOf(finding.rule),
    level: level[finding.severity],
    message: { text: `${finding.title}. ${finding.reason} ${finding.action}` },
    locations: [{ physicalLocation: {
      artifactLocation: { uri: uri(finding.path), uriBaseId: "%SRCROOT%" },
      ...(finding.line ? { region: { startLine: finding.line } } : {}),
    } }],
    ...(finding.justification ? { suppressions: [{
      kind: "external", status: "accepted", justification: finding.justification,
    }] } : {}),
  });
  return {
    $schema: "https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/schemas/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: {
        name: "PatchScope",
        informationUri: "https://github.com/brunnojob/patchscope",
        rules: ruleIds.map((id) => ({ id, shortDescription: { text: `PatchScope ${id} review prompt` } })),
      } },
      invocations: [{ executionSuccessful: true, toolExecutionNotifications: report.warnings.map((text) => ({ level: "warning", message: { text } })) }],
      results: [...report.findings, ...(report.suppressed ?? [])].map(result),
      properties: { scope: report.scope, disabledRules: report.configuration?.disabledRules ?? [] },
    }],
  };
}
