import { readFile } from "node:fs/promises";
import { analyzeDiff, toMarkdown, limits } from "../src/engine.js";
import { toSarif } from "../src/sarif.js";
import { loadConfig } from "./config.mjs";
const args = process.argv.slice(2);
if (!args.length || args.includes("--help")) {
  console.log(
    "Usage: node scripts/cli.mjs <patch.diff|-> [--format markdown|json|sarif] [--config config.json] [--fail-on high|medium|info]\nReads stdin when the path is -. Does not access the network. Configuration is loaded only when explicitly supplied.\nExit codes: 0 completed; 1 invalid input/options; 2 requested priority threshold matched.",
  );
  process.exit(args.length ? 0 : 1);
}
try {
  let format = "markdown", failOn = null, configPath = null;
  const seen = new Set();
  if (args[0].startsWith("--")) throw new Error("Provide a patch path or - before options.");
  for (let index = 1; index < args.length; index++) {
    const option = args[index];
    if (!["--format", "--fail-on", "--config"].includes(option))
      throw new Error(`Unknown option: ${option}`);
    if (seen.has(option)) throw new Error(`Duplicate option: ${option}`);
    seen.add(option);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${option}.`);
    if (option === "--format") format = value;
    else if (option === "--config") configPath = value;
    else failOn = value;
  }
  if (!["markdown", "json", "sarif"].includes(format))
    throw new Error("Format must be markdown, json or sarif.");
  if (failOn !== null && !["high", "medium", "info"].includes(failOn))
    throw new Error("Priority must be high, medium or info.");
  let patch;
  if (args[0] === "-") {
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > limits.bytes) throw new Error("Patch exceeds 2 MB.");
      chunks.push(chunk);
    }
    patch = Buffer.concat(chunks).toString("utf8");
  } else {
    const { stat } = await import("node:fs/promises");
    if ((await stat(args[0])).size > limits.bytes)
      throw new Error("Patch exceeds 2 MB.");
    patch = await readFile(args[0], "utf8");
  }
  const report = analyzeDiff(patch, await loadConfig(configPath));
  console.log(
    format === "markdown" ? toMarkdown(report) : JSON.stringify(format === "sarif" ? toSarif(report) : report, null, 2),
  );
  const priority = { high: 0, medium: 1, info: 2 };
  if (failOn && report.findings.some((finding) => priority[finding.severity] <= priority[failOn]))
    process.exitCode = 2;
} catch (error) {
  console.error(`PatchScope: ${error.message}`);
  process.exitCode = 1;
}
