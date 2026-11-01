export const limits = Object.freeze({
  bytes: 2_000_000,
  files: 500,
  lines: 60000,
});
function pathName(raw, stripPrefix = true) {
  let value = raw.trim();
  if (value.startsWith('"')) {
    const end = value.lastIndexOf('"');
    value = value
      .slice(1, end > 0 ? end : undefined)
      .replace(/(?:\\[0-7]{3})+/g, (sequence) =>
        new TextDecoder().decode(
          Uint8Array.from(sequence.match(/[0-7]{3}/g), (oct) =>
            parseInt(oct, 8),
          ),
        ),
      )
      .replace(
        /\\([\\"nt])/g,
        (_, char) => ({ n: "\n", t: "\t" })[char] || char,
      );
  } else value = value.split("\t")[0];
  if (value === "/dev/null") return null;
  return (stripPrefix ? value.replace(/^[ab]\//, "") : value).replace(
    /[\r\n\x00-\x1f]/g,
    " ",
  );
}
export function parseDiff(input) {
  if (typeof input !== "string" || !input.trim())
    throw new Error("Paste a unified Git diff or open a .diff / .patch file.");
  if (new TextEncoder().encode(input).length > limits.bytes)
    throw new Error(
      "This patch exceeds the 2 MB limit. Split it into smaller patches.",
    );
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  if (lines.length > limits.lines)
    throw new Error("This patch exceeds the 60,000-line limit.");
  const files = [];
  let current = null,
    hunk = false,
    oldLine = 0,
    newLine = 0,
    oldRemaining = 0,
    newRemaining = 0,
    incomplete = false;
  const finishHunk = () => {
    if (hunk && (oldRemaining !== 0 || newRemaining !== 0)) incomplete = true;
    hunk = false;
  };
  const start = (path = "untitled") => {
    if (files.length >= limits.files)
      throw new Error("This patch exceeds the 500-file limit.");
    current = {
      path,
      previousPath: null,
      status: "modified",
      binary: false,
      additions: 0,
      deletions: 0,
      lines: [],
      hunks: 0,
    };
    files.push(current);
    hunk = false;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith("diff --git ")) {
      const names = line.slice(11).match(/"(?:\\.|[^"\\])*"|\S+/g) || [];
      finishHunk();
      start(pathName(names[1] || names[0] || "untitled"));
      continue;
    }
    if (
      !hunk &&
      line.startsWith("--- ") &&
      lines[index + 1]?.startsWith("+++ ")
    ) {
      if (!current || current.hunks || current.binary) start();
      const oldPath = pathName(line.slice(4)),
        newPath = pathName(lines[++index].slice(4));
      current.path = newPath || oldPath || current.path;
      current.previousPath = oldPath;
      if (!oldPath) current.status = "added";
      else if (!newPath) current.status = "deleted";
      else if (oldPath !== newPath) current.status = "renamed";
      continue;
    }
    if (!current) continue;
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (header) {
      finishHunk();
      oldLine = Number(header[1]);
      newLine = Number(header[3]);
      oldRemaining = Number(header[2] ?? 1);
      newRemaining = Number(header[4] ?? 1);
      current.hunks++;
      hunk = oldRemaining > 0 || newRemaining > 0;
      current.lines.push({ kind: "hunk", text: line, old: null, new: null });
      continue;
    }
    if (hunk) {
      if (line.startsWith("+")) {
        current.additions++;
        newRemaining--;
        current.lines.push({
          kind: "add",
          text: line.slice(1),
          old: null,
          new: newLine++,
        });
      } else if (line.startsWith("-")) {
        current.deletions++;
        oldRemaining--;
        current.lines.push({
          kind: "remove",
          text: line.slice(1),
          old: oldLine++,
          new: null,
        });
      } else if (line.startsWith(" ")) {
        oldRemaining--;
        newRemaining--;
        current.lines.push({
          kind: "context",
          text: line.slice(1),
          old: oldLine++,
          new: newLine++,
        });
      } else if (line.startsWith("\\ No newline")) continue;
      else finishHunk();
      if (oldRemaining < 0 || newRemaining < 0) incomplete = true;
      if (oldRemaining <= 0 && newRemaining <= 0) finishHunk();
      continue;
    }
    if (line.startsWith("new file mode")) current.status = "added";
    if (line.startsWith("deleted file mode")) current.status = "deleted";
    if (line.startsWith("rename from ")) {
      current.previousPath = pathName(line.slice(12), false);
      current.status = "renamed";
    }
    if (line.startsWith("rename to "))
      current.path = pathName(line.slice(10), false);
    if (/^(Binary files |GIT binary patch)/.test(line)) current.binary = true;
  }
  finishHunk();
  if (!files.length)
    throw new Error(
      "No unified diff found. Try: git diff --no-ext-diff --no-color HEAD",
    );
  const unsupported = files.filter(
    (file) => !file.hunks && !file.binary && file.status === "modified",
  );
  return {
    files,
    warnings: [
      ...(incomplete ? ["Some hunk bodies do not match their declared line counts. The patch may be incomplete."] : []),
      ...(unsupported.length
      ? [
          "Some file sections contain no supported hunks. Their content could not be inspected.",
        ]
      : []),
    ],
  };
}
const isTest = (path) =>
  /(^|\/)(__tests__|tests?|specs?)(\/|$)|(^|\/)(test_[^/]+|[^/]+(?:\.test|\.spec|_test)\.[^/]+)$/i.test(
    path,
  );
const isManifest = (path) =>
  /(^|\/)(package\.json|pyproject\.toml|requirements[^/]*\.txt|go\.mod|Cargo\.toml|pom\.xml|Gemfile)$/i.test(
    path,
  );
const isLock = (path) =>
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|uv\.lock|Pipfile\.lock|go\.sum|Cargo\.lock|Gemfile\.lock)$/i.test(
    path,
  );
export function analyzeDiff(input) {
  const parsed = parseDiff(input),
    findings = [];
  const emit = (rule, severity, file, line, title, reason, action) =>
    findings.push({
      id: `finding-${findings.length + 1}`,
      rule,
      severity,
      path: file.path,
      line,
      title,
      reason,
      action,
    });
  for (const file of parsed.files) {
    const additions = file.lines.filter((line) => line.kind === "add");
    if (file.binary)
      emit(
        "binary",
        "info",
        file,
        null,
        "Binary content needs a separate review",
        "The patch does not contain readable content for this file.",
        "Open the original asset and check its source, size and intended use.",
      );
    if (file.status === "deleted" && isTest(file.path))
      emit(
        "deleted-tests",
        "high",
        file,
        null,
        "A test file was removed",
        "Removing tests can hide a regression or reduce coverage.",
        "Check whether equivalent tests were moved or replaced.",
      );
    if (
      /(^|\/)\.env(?:\.[^/]+)?$/.test(file.path) &&
      !/example|sample|template/.test(file.path) &&
      file.additions
    )
      emit(
        "environment",
        "high",
        file,
        null,
        "An environment file has new content",
        "Environment files can contain deployment-specific or private values.",
        "Confirm that this file belongs in version control and inspect every new value.",
      );
    if (file.additions + file.deletions >= 400)
      emit(
        "large-file",
        "medium",
        file,
        null,
        "Large change in one file",
        "At least 400 added or removed lines increase the review surface.",
        "Separate mechanical changes from behavior changes, or review the file in smaller passes.",
      );
    if (/^\.github\/workflows\//.test(file.path) && file.additions)
      emit(
        "workflow",
        "medium",
        file,
        null,
        "GitHub Actions behavior changed",
        "Workflow changes can alter what executes and which credentials it receives.",
        "Review triggers, permissions, action pinning and handling of untrusted pull requests.",
      );
    const seen = new Set();
    for (const line of additions) {
      const text = line.text;
      if (/^\s*(?:#|\/\/|\*)/.test(text)) continue;
      const addOnce = (rule, severity, title, reason, action) => {
        if (seen.has(rule)) return;
        seen.add(rule);
        emit(rule, severity, file, line.new, title, reason, action);
      };
      if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(text))
        addOnce(
          "private-key",
          "high",
          "Private-key material may be present",
          "An added line matches a private-key header. The value is omitted from reports.",
          "Verify the source. If a real key was exposed, remove it and rotate it through your provider.",
        );
      const credential =
        /\b(?:api[_-]?key|secret|token|password)\b["']?\s*[:=]\s*["']([^"'\s]{16,})["']/i.exec(
          text,
        );
      if (
        credential &&
        !/example|sample|placeholder|changeme|your[_-]|^x+$|^0+$|^test/i.test(
          credential[1],
        )
      )
        addOnce(
          "credential",
          "high",
          "A credential-like assignment was added",
          "A named credential field contains a long literal. This heuristic cannot establish whether it is a real secret.",
          "Replace real credentials with a secret reference. Verify and rotate any exposed value.",
        );
      if (
        /\b(?:drop\s+(?:table|database|schema)|truncate\s+(?:table\s+)?[a-z_])/i.test(
          text,
        )
      )
        addOnce(
          "destructive-sql",
          "high",
          "Potentially destructive SQL",
          "An added line contains a DROP or TRUNCATE operation.",
          "Confirm target environment, backups, migration sequencing and a recovery plan.",
        );
      if (
        /\b(?:it|test|describe)\.(?:skip|only)\s*\(|@pytest\.mark\.skip/.test(
          text,
        )
      )
        addOnce(
          "test-scope",
          "medium",
          "Test execution scope changed",
          "An added skip or exclusive-test marker can change which tests run.",
          "Remove temporary focus markers and explain any intentional skips.",
        );
      if (
        /^\s*permissions\s*:\s*write-all\b/.test(text) ||
        /^\s*pull_request_target\s*:/.test(text)
      )
        addOnce(
          "workflow-privilege",
          "high",
          "Review this workflow privilege boundary",
          "An added line uses broad write permissions or pull_request_target.",
          "Use the minimum token permissions and keep untrusted code away from privileged execution.",
        );
      if (
        /\b(?:rejectUnauthorized\s*:\s*false|verify\s*=\s*False|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0)/.test(
          text,
        )
      )
        addOnce(
          "tls",
          "high",
          "Certificate verification may be disabled",
          "An added line matches a known TLS-verification bypass pattern.",
          "Keep verification enabled and fix the trust or certificate configuration.",
        );
      if (/\b(?:eval|exec)\s*\(/.test(text) && !isTest(file.path))
        addOnce(
          "dynamic-code",
          "medium",
          "Dynamic code execution was added",
          "The added line calls eval or exec; context determines whether it is unsafe.",
          "Trace input provenance and prefer a parser or structured operation where possible.",
        );
    }
  }
  const manifests = parsed.files.filter(
    (file) => isManifest(file.path) && file.additions + file.deletions,
  );
  if (manifests.length && !parsed.files.some((file) => isLock(file.path)))
    emit(
      "lockfile",
      "medium",
      manifests[0],
      null,
      "Check dependency reproducibility",
      "A dependency manifest changed, but no recognized lockfile is present in this patch. Some ecosystems do not require one.",
      "Confirm the project’s dependency policy and regenerate the lockfile if applicable.",
    );
  const runtime = parsed.files.filter(
    (file) =>
      /\.(?:[cm]?[jt]sx?|py|go|rs|java|rb|cs|php)$/.test(file.path) &&
      !isTest(file.path) &&
      file.additions + file.deletions,
  );
  if (
    runtime.length &&
    !parsed.files.some(
      (file) => isTest(file.path) && file.additions + file.deletions,
    )
  )
    emit(
      "test-coverage",
      "info",
      runtime[0],
      null,
      "Confirm behavior is covered",
      "Source code changed, but this patch contains no changed test files. Existing tests may already cover it.",
      "Run the relevant suite and add a regression test when behavior changes.",
    );
  const order = { high: 0, medium: 1, info: 2 };
  findings.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] || a.path.localeCompare(b.path),
  );
  const counts = { high: 0, medium: 0, info: 0 };
  for (const finding of findings) counts[finding.severity]++;
  const files = parsed.files.map(({ lines, ...file }) => file);
  return {
    version: 1,
    summary: {
      files: files.length,
      additions: files.reduce((s, f) => s + f.additions, 0),
      deletions: files.reduce((s, f) => s + f.deletions, 0),
      findings: findings.length,
      level: counts.high
        ? "high"
        : counts.medium
          ? "medium"
          : counts.info
            ? "info"
            : "clear",
      counts,
    },
    findings,
    files,
    warnings: parsed.warnings,
    scope:
      "Heuristic diff triage. Not a security audit or proof that a change is safe.",
  };
}
const markdown = (value) =>
  String(value)
    .replace(/[\r\n]/g, " ")
    .replace(/([\\`*_{}\[\]<>|])/g, "\\$1");
export function toMarkdown(report) {
  const { summary } = report;
  return [
    "# PatchScope review checklist",
    "",
    `**${summary.files} files · +${summary.additions} / -${summary.deletions} · ${summary.findings} review prompts**`,
    "",
    report.scope,
    "",
    ...report.warnings.map((w) => `> ${w}`),
    ...report.findings.flatMap((f) => [
      `## ${f.severity.toUpperCase()} · ${f.title}`,
      "",
      `File: ${markdown(f.path)}${f.line ? ` · new line ${f.line}` : ""}`,
      "",
      f.reason,
      "",
      `- [ ] ${f.action}`,
      "",
    ]),
    ...(report.findings.length
      ? []
      : [
          "No heuristic flags matched. Review and test the patch normally.",
          "",
        ]),
    "---",
    "Generated locally with [PatchScope](https://brunnojob.github.io/patchscope/) by [brunnodev](https://brunnodev.store).",
    "",
  ].join("\n");
}
