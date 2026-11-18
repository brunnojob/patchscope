# Show HN submission draft

## Title

Show HN: PatchScope – local Git diff review checklists without AI keys

## Submission URL

https://brunnojob.github.io/patchscope/

## First comment

I built PatchScope to make large diffs easier to approach during human review. It reads a unified diff and generates prompts for patterns such as removed tests, broad workflow permissions, destructive SQL and dependency changes.

The browser demo is usable without signup: click Explore the example. The same dependency-free engine is available as a Node.js CLI and GitHub Action, with Markdown, JSON and SARIF reports. Rule severities and explained suppressions can be configured through an explicit JSON policy in the CLI/Action.

The design trades semantic understanding for an inspectable deterministic tool that can run locally. Prompts are heuristics, not confirmed vulnerabilities. It cannot infer coverage, inspect unchanged workspace configuration or prove a patch is safe. The README documents false-positive and input limits.

Source: https://github.com/brunnojob/patchscope
Action: https://github.com/marketplace/actions/patchscope-diff-review

I would appreciate small sanitized diffs where a rule is noisy or misses a useful review prompt.

## Before submitting

- Read https://news.ycombinator.com/showhn.html and the general HN guidelines again.
- Search HN for earlier PatchScope submissions. Submit the usable project, not just the 2.0.1 announcement; avoid duplicate launches.
- Keep the browser demo working and be available to discuss implementation and tradeoffs.
- Do not request coordinated votes, comments or donations.

Status: prepared in this repository; not posted to HN.
