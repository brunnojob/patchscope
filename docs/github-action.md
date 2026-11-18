# PatchScope GitHub Action

[Marketplace listing](https://github.com/marketplace/actions/patchscope-diff-review) · [Complete workflow](../README.md#github-actions) · [Security](../SECURITY.md)

## Installation

Use `brunnojob/patchscope@v2.0.1` with a `diff-file` input pointing to a UTF-8 unified diff created by an earlier step. For production, pin a reviewed full commit SHA. The Action uses `actions/setup-node@v4` to provide Node.js 22, so no separate Node setup is required. It runs the tool from its own action directory, not the project being reviewed.

The workflow requires Git history to generate a PR diff. Use `actions/checkout` with `fetch-depth: 0`, generate `git diff --no-ext-diff --no-color "$BASE_SHA...$HEAD_SHA" > review.diff` with SHAs supplied through environment variables, then invoke the Action. The README includes a complete copyable example.

## Inputs

| Input | Default | Contract |
| --- | --- | --- |
| `diff-file` | Required | Path to an existing unified diff; relative paths use the job working directory |
| `config-file` | Unset | Explicit JSON rule settings and explained suppressions; configuration is never auto-discovered |
| `summary` | `true` | Set `false` to skip the GitHub job summary |

## Outputs

| Output | Meaning |
| --- | --- |
| `report-json` | Absolute path to the structured JSON report |
| `report-markdown` | Absolute path to the Markdown checklist |
| `report-sarif` | Absolute path to the SARIF 2.1.0 report |
| `high-count` | Active high-priority review prompts |
| `suppressed-count` | Prompts suppressed with a documented reason |

Reports are stored in a temporary directory for the current job. Use `actions/upload-artifact` to retain them after the job. Uploading SARIF to GitHub code scanning is a separate step with its own availability and permission requirements.

## Permissions and behavior

The Action does not require a GitHub API token, post PR comments or modify project files. The complete checkout example needs only `contents: read`. Fork PRs can use the same reporting workflow without write permissions. It makes no model calls or remote patch uploads; runner setup may download Node.js and GitHub stores summaries/artifacts when the workflow requests them.

Findings are advisory: a successful analysis exits zero even if high-priority prompts exist. Invalid configuration, missing input or oversized/malformed patches fail the step. For an explicit blocking policy, use the CLI's `--fail-on` option as documented in the README; the Action itself exposes no threshold input.

## Troubleshooting

- **Missing diff:** create the file before the Action and check the working directory.
- **Unknown merge base:** fetch the relevant base/head commits and full history before generating the diff.
- **Empty report:** inspect whether the diff is empty or no built-in rule matched. This does not prove safety.
- **Input limits:** supported input is capped at 2 MB, 500 file sections and 60,000 lines. Combined merge diffs are unsupported.
- **Unexpected manifest/test prompt:** heuristics see the patch, not unchanged files or full workspace configuration. Review the evidence and document justified exceptions.

## Help and support

[Report a sanitized bug](https://github.com/brunnojob/patchscope/issues) or [contribute a fixture](../CONTRIBUTING.md). Contributions through [Stripe](https://donate.stripe.com/6oU8wQg9k9Hb8809CrfQI01) are optional; the Action remains free and MIT licensed.
