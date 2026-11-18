# PatchScope launch resources

A reproducible demonstration and channel-specific drafts for the published Action. All copy is English. External posts and the Awesome Actions PR are drafts, not submissions.

| Resource | Purpose |
| --- | --- |
| [18-second walkthrough](demo.html) | Illustrated diff → actual checklist → CI reporting explanation |
| [MP4 video](patchscope-demo.mp4) | Native upload for LinkedIn |
| [LinkedIn post](linkedin.md) | Outcome, example, limitations and Marketplace link |
| [DEV.to tutorial](tutorial.md) | Complete workflow, installation, outputs and trust boundaries |
| [Copyable workflow](../../examples/workflows/patchscope.yml) | Versioned PR integration with read-only permissions |
| [Show HN draft](show-hn.md) | Usable demo and technical tradeoffs |
| [Awesome Actions proposal](awesome-actions.md) | Entry, PR text and contribution checklist |

## Evidence and media provenance

The walkthrough is a designed illustration, not a screen recording of GitHub or a customer project. Its checklist is generated from `docs/example.diff` by the real CLI. Its final panel describes how the existing Action writes a job summary and report artifacts. Check [the public CI runs](https://github.com/brunnojob/patchscope/actions/workflows/ci.yml) for actual executions of `action-smoke`.

To regenerate the data and video from the repository root, install Python Pillow and FFmpeg, then run:

```sh
node scripts/cli.mjs docs/example.diff --format json > docs/launch/example-report.json
python3 scripts/render-launch-demo.py
```

Python/Pillow and FFmpeg are only media authoring tools, not runtime dependencies of PatchScope. The video has no audio; all explanation is on-screen. [Transcript](transcript.md).

## Publishing order

1. Check the demo and the versioned Action integration.
2. Publish a practical tutorial on DEV.to using `githubactions`, `opensource`, `devops`, `showdev`.
3. Upload the short MP4 to LinkedIn with the post draft.
4. Submit one appropriate Awesome Actions PR after checking for duplicates.
5. Consider Show HN for the complete usable project, following its guidelines.

Use the Marketplace link for Action installation and the Pages link for an immediate browser trial. Keep optional funding links secondary to the tool and its evidence. No audience or engagement outcome is guaranteed.
