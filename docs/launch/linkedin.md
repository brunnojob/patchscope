# LinkedIn post

Attach `docs/launch/patchscope-demo.mp4` natively. This 18-second illustrated walkthrough uses real fixture output; its CI stage explains the workflow rather than showing a captured GitHub session. Suggested cover: `docs/launch/demo-poster.png`.

## Post

Large pull requests are easier to review when you know where to start.

I built PatchScope to turn Git diffs into actionable review checklists. It highlights supported patterns such as removed tests, broad GitHub Actions permissions and destructive SQL, then explains what matched and what to check next.

The same engine works in your browser, terminal and GitHub Actions. The Action adds a job summary and produces Markdown, JSON and SARIF reports.

No AI keys. No account. No remote patch analysis. Free and open source under MIT.

The video walks through a synthetic diff, its five review prompts and how the reports fit into CI. These are heuristic prompts for human review, not confirmed vulnerabilities or a guarantee that a patch is safe.

Install from GitHub Marketplace:
https://github.com/marketplace/actions/patchscope-diff-review

Try it without installing:
https://brunnojob.github.io/patchscope/

If you review pull requests regularly, which recurring change would you want a checklist rule for?

#GitHubActions #CodeReview #OpenSource #DevOps
