<div align="center">

<img src="docs/icon.svg" width="64" alt="PatchScope">

# PatchScope

### Big diff? Know where to look.

**Turn a Git patch into an actionable review checklist — in your browser, terminal or GitHub Actions.**

[Try the live demo](https://brunnojob.github.io/patchscope/) · [CLI quick start](#cli-quick-start) · [GitHub Actions](#github-actions) · [Contribute a rule](CONTRIBUTING.md)

![Validation](https://github.com/brunnojob/patchscope/actions/workflows/ci.yml/badge.svg)

</div>

![PatchScope review map with five prompts and a file diff](docs/preview.jpg)

---

Reviewing a change is easier when you know where to start. PatchScope reads a unified diff and highlights concrete reasons to take a closer look: removed tests, broad workflow permissions, destructive SQL, dependency changes and more.

Every prompt explains **what matched, why it matters and what to check next**. The same dependency-free engine powers the web app, CLI and reusable GitHub Action.

**No API keys. No model calls. No code uploads. No account.**

## Try it in 30 seconds

1. Open **[PatchScope](https://brunnojob.github.io/patchscope/)**.
2. Click **Explore the example**, or paste `git diff --no-ext-diff --no-color HEAD` output.
3. Filter prompts, inspect changed lines and export a Markdown checklist for your pull request.

The bundled example has **4 changed files and 5 review prompts**. Also try the skipped-test example or a documentation-only patch with no matched rules.

## From patch to review plan

A release patch changes a workflow, drops a SQL table, removes tests and updates a dependency manifest. PatchScope turns those changes into a prioritized checklist:

```text
4 files · 5 review prompts
HIGH    Review this workflow privilege boundary
HIGH    Potentially destructive SQL
HIGH    A test file was removed
MEDIUM  GitHub Actions behavior changed
MEDIUM  Check dependency reproducibility
```

Each prompt includes its file, a line number when available, the reason it matched and a concrete action. Export the checklist to your PR, then use the diff viewer to inspect the context. Run `npm run demo` to reproduce this example locally.

## Choose your workflow

| Where you review | Start here | Result |
| --- | --- | --- |
| Browser | [Open the workspace](https://brunnojob.github.io/patchscope/) | Interactive file map, filters and checklist |
| Terminal | Pipe `git diff` into the CLI | Markdown or JSON on stdout |
| CI | Add the composite Action | Job summary and downloadable reports |
| CI with an explicit threshold | CLI `--fail-on high` | Full report plus exit code `2` for high-priority prompts |

## What it catches

| Signal | Review prompt |
| --- | --- |
| Private-key headers or credential-like literals | Verify values and replace real credentials with secret references |
| `permissions: write-all` or `pull_request_target` | Review the workflow privilege boundary |
| `DROP` or `TRUNCATE` SQL | Confirm environment, backups and recovery |
| Deleted test files | Confirm replacement coverage |
| Skipped or exclusive test markers | Check which tests actually run |
| Known TLS verification bypass patterns | Restore certificate verification |
| Dynamic `eval` / `exec` calls | Trace input and execution context |
| Dependency manifest without a compatible same-directory lockfile in the patch | Check the project’s dependency policy |
| Source changes without changed tests | Confirm existing coverage or add a regression test |
| Binary changes or large file changes | Make space for a separate review |

These are **heuristics, not a security audit**. A match can be intentional; no matches do not establish safety. Dependency and test prompts describe the patch, not the whole repository. There is no invented risk percentage or claim that the tool understands an entire application.

## Browser workspace

Paste or drop a patch, explore files with old/new line numbers, filter severity and check off review actions. Copy Markdown or download Markdown/JSON. `Ctrl+Enter` / `Command+Enter` analyzes; **Clear** removes the patch and results from memory.

Patches stay in page memory. The app uses no localStorage, analytics, third-party fonts or remote processing. Reports contain file names, metrics and prompts, **not raw source lines or detected credential values**. File names can themselves be sensitive: inspect reports before sharing. GitHub Pages applies its own infrastructure privacy policies.

Limits: **2 MB, 500 file sections and 60,000 input lines**. The file preview displays at most 1,500 lines; the engine analyzes all supported lines within those limits.

## CLI quick start

Requires Node.js 22+. No `npm install` needed.

```sh
git clone https://github.com/brunnojob/patchscope.git
cd patchscope
npm run demo
node scripts/cli.mjs docs/example.diff --format json
```

Review your own patch:

```sh
git diff --no-ext-diff --no-color HEAD > change.diff
node /path/to/patchscope/scripts/cli.mjs change.diff --format markdown > review.md
```

Or use stdin:

```sh
git diff --no-ext-diff --no-color HEAD | node /path/to/patchscope/scripts/cli.mjs - --format json
```

By default, findings do not fail the command. For a review workflow that needs an explicit priority threshold:

```sh
node scripts/cli.mjs change.diff --format json --fail-on high > review.json
```

The full report is still written to stdout. `high` matches high-priority prompts; `medium` includes high and medium; `info` includes every prompt. Treat a threshold match as a request for human review, not proof of a vulnerability.

| Exit code | Meaning |
| --- | --- |
| `0` | Analysis completed and no requested threshold matched |
| `1` | Invalid options, missing file, malformed or oversized input |
| `2` | A prompt met the explicitly requested `--fail-on` threshold |

Use `--help` for options. Without `--fail-on`, analysis exits `0` even when prompts are found.

## GitHub Actions

The composite action accepts an existing patch, writes a job summary and creates report files. It does not post comments, request an API token, contact an AI service or modify the repository.

```yaml
name: Patch review
on: pull_request
permissions:
  contents: read
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Create review patch
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: git diff --no-ext-diff --no-color "$BASE_SHA...$HEAD_SHA" > review.diff
      - uses: brunnojob/patchscope@main
        id: scope
        with:
          diff-file: review.diff
      - uses: actions/upload-artifact@v4
        with:
          name: patchscope-review
          path: |
            ${{ steps.scope.outputs.report-json }}
            ${{ steps.scope.outputs.report-markdown }}
```

Use `@main` for a first experiment. In production, pin this and other third-party actions to reviewed full commit SHAs. The composite action declares `actions/setup-node@v4` to provide Node.js 22.

| Input / output | Meaning |
| --- | --- |
| `diff-file` | Required path to an existing unified diff |
| `summary` | `true` by default; `false` disables the job summary |
| `report-json` | Output path to the JSON report |
| `report-markdown` | Output path to the Markdown report |
| `high-count` | Output count of high-priority heuristic prompts |

Action summaries and artifacts follow your repository’s access and retention settings. Browser code is not uploaded; your configured workflow can publish its report.

## Why this exists

PatchScope is a small review tool you can inspect, run locally and adapt without an account, backend or model subscription. It helps prepare the human review instead of assigning an opaque score.

If it saves you review time, **[a star helps others find it](https://github.com/brunnojob/patchscope)**. A reproducible edge case or carefully scoped rule is just as useful.

## Development

```sh
npm run dev
npm run check
npm test
```

Open `http://localhost:4173`. ES modules need HTTP; opening the HTML with `file://` is unsupported.

| Module | Responsibility |
| --- | --- |
| `src/engine.js` | Diff parsing, heuristics and Markdown generation |
| `src/app.js` | Browser interactions and downloads |
| `src/examples.js` | Synthetic offline examples |
| `scripts/cli.mjs` | File/stdin CLI |
| `scripts/action.mjs` | Job summary and report outputs |
| `action.yml` | Reusable composite action |
| `tests/` | Parser, rules, report privacy, CLI and Action integration |

Tests cover quoted/UTF-8 names, renames, line numbers, binary changes, deleted tests, placeholder credentials, escaping, limits, stdin and actual output files. CI runs on Linux/Windows with Node.js 22/24 and smoke-tests the composite action.

## Dependency checks in monorepos

A lockfile only suppresses a manifest prompt when it belongs to a compatible ecosystem and is in the same directory. Changing `apps/api/package-lock.json` does not hide a prompt for `apps/web/package.json`; changing `go.sum` does not cover an npm manifest. npm shrinkwrap, pnpm, Yarn and Bun lockfile names are recognized alongside the existing Python, Go, Rust and Ruby formats.

Shared workspace lockfiles can live above a package. PatchScope does not read workspace configuration or unchanged files, so it keeps the prompt and asks you to confirm the workspace policy. A prompt does not mean a lockfile is missing from your repository.

## Limits and next steps

Recognizes unified text diffs and basic Git file metadata. Combined merge diffs, AST analysis, full secret scanning and whole-repository context are outside this version. Comments, multiline constructs, unusual languages and test-file naming conventions can produce false negatives. Binary content is not inspected.

Planned: configurable rules, suppression explanations, additional parser fixtures and SARIF export. These are not implemented yet.

## Credits and license

Created by **[brunnodev](https://brunnodev.store)** on **[brunnojob](https://github.com/brunnojob)**. MIT licensed; see [LICENSE](LICENSE).
