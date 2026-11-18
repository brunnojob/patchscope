# Review risky pull request changes without AI keys

Tags for DEV.to: `githubactions`, `opensource`, `devops`, `showdev`.

A pull request can pass its tests while still removing coverage, widening workflow permissions or introducing destructive SQL. PatchScope reads the Git diff and turns supported patterns into a checklist for the person reviewing the change.

It is a deterministic, MIT-licensed tool. It needs no account, model subscription or AI API key. These checks are heuristics: a prompt is a reason to inspect a change, not proof of a vulnerability. An empty report does not establish safety.

## Try the sample first

Open [the browser demo](https://brunnojob.github.io/patchscope/) and choose **Explore the example**. No signup is required. The bundled synthetic diff changes four files and produces five prompts: workflow privileges, destructive SQL, removed tests, workflow behavior and dependency reproducibility.

Prefer the terminal? With Node.js 22+ and Git:

```sh
git clone https://github.com/brunnojob/patchscope.git
cd patchscope
node scripts/cli.mjs docs/example.diff --format markdown
node scripts/cli.mjs docs/example.diff --format json
node scripts/cli.mjs docs/example.diff --format sarif
```

## Add a complete pull request workflow

Save this as `.github/workflows/patchscope.yml` in the repository you want to review. The same file is available [for direct copying](../../examples/workflows/patchscope.yml).

```yaml
name: PatchScope PR review
on:
  pull_request:
permissions:
  contents: read
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - name: Create pull request diff
        shell: bash
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: git diff --no-ext-diff --no-color "$BASE_SHA...$HEAD_SHA" > "$RUNNER_TEMP/patchscope.diff"
      - name: Build review checklist
        id: review
        uses: brunnojob/patchscope@v2.0.1
        with:
          diff-file: ${{ runner.temp }}/patchscope.diff
      - name: Keep review reports
        uses: actions/upload-artifact@v4
        with:
          name: patchscope-review
          retention-days: 7
          path: |
            ${{ steps.review.outputs.report-markdown }}
            ${{ steps.review.outputs.report-json }}
            ${{ steps.review.outputs.report-sarif }}
```

The three-dot comparison finds changes since the merge base of the target and PR head commits. Full Git history makes that comparison available. SHAs are passed through environment variables instead of interpolating user-controlled titles or branch names into shell code. The diff lives in the runner temporary directory so it does not overwrite a project file.

The workflow uses `pull_request` with read-only repository permissions. It checks out files but does not install project dependencies or execute PR source. It does not need a personal access token or PR write access, including for forks. Node.js setup may download the runtime; the tool does not submit the patch to a model or remote analysis service.

The example uses a release tag for readability. Pin reviewed full commit SHAs for this and other third-party Actions in production.

## Find the result

1. Open a pull request that changes supported text files.
2. Open the **PatchScope PR review** workflow run.
3. Read the checklist in the job summary.
4. Download `patchscope-review` from the run's artifacts for Markdown, JSON and SARIF.

The sample has three high-priority and two medium-priority prompts. Real changes can produce different counts or no prompts. Reports omit raw patch lines and detected credential values, but filenames and supplied suppression reasons may still be sensitive. Artifact retention is seven days in this example.

[Recorded CI runs](https://github.com/brunnojob/patchscope/actions/workflows/ci.yml) include an `action-smoke` job that runs the Action on the bundled fixture. The [short illustrated walkthrough](demo.html) is rendered from actual local tool output; it is not a recording of the GitHub website.

## Decide what should block a merge

The Action is advisory: findings do not fail the job. Bad input or invalid configuration does. A green job means analysis completed, not that a patch is safe. For an explicit severity gate, the CLI offers `--fail-on high`; it exits 2 when the threshold matches and still prints the report. The Action has no `fail-on` input.

Rule priorities and explained suppressions can be supplied with `config-file`. If your policy influences review decisions, load it from a trusted source rather than accepting policy changes from an untrusted PR. See [the Action reference](../github-action.md) and [configuration documentation](../../README.md#configure-rules-and-explain-exceptions).

## What this does not cover

PatchScope does not execute tests, parse complete applications with an AST, inspect binary contents or replace secret scanning. Its test and dependency prompts describe the diff, including what it cannot see in unchanged files. Input is bounded to 2 MB, 500 file sections and 60,000 lines.

[Install from GitHub Marketplace](https://github.com/marketplace/actions/patchscope-diff-review) · [Source](https://github.com/brunnojob/patchscope) · [Report a sanitized edge case](https://github.com/brunnojob/patchscope/issues)
