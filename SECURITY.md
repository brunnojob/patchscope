# Security policy

## Supported version

Use the latest v2 release. Security fixes target the latest release; older tags are immutable snapshots and do not receive backports.

## Reporting a vulnerability

Do not open a public issue containing credentials, private patches or exploit details. Email **contato@brunnodev.store** with the affected version, a minimal synthetic reproduction and the expected impact. Never include live secrets or proprietary code. Public issues are appropriate for ordinary bugs with sanitized examples.

## Trust boundaries

PatchScope parses a supplied diff using bounded heuristics. It does not execute patch content, prove vulnerabilities, replace a secret scanner or establish that a change is safe. Reports omit raw source lines and detected credential values, but filenames and configured suppression reasons can still contain sensitive information.

The browser analyzes patches locally. The Action writes reports and an optional job summary within GitHub Actions; sharing and retention follow the consuming workflow. Optional contributions open Stripe or Buy Me a Coffee separately.

Run pull-request analysis with `pull_request` and read-only permissions. Do not run untrusted code through `pull_request_target`. If configuration affects review policy, use a trusted configuration file. Pin reviewed Action commit SHAs in production.
