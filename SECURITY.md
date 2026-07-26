# Security Policy

Siglens runs a live production service at [siglens.io](https://siglens.io) that holds user accounts, OAuth tokens, and user-supplied LLM API keys. Vulnerability reports are genuinely welcome.

## Reporting a vulnerability

**Please do not open a public issue, discussion, or pull request for a security problem.** A public report exposes the flaw to everyone before it can be fixed.

Report privately through GitHub Security Advisories:

**→ [Report a vulnerability](https://github.com/y0ngha/siglens/security/advisories/new)**

That creates a private thread visible only to the maintainer. If the link is unavailable to you for any reason, open a normal issue titled `Security contact request` containing **no technical details**, and a private channel will be arranged.

### What to include

The more of this you can provide, the faster it gets fixed:

- What the vulnerability lets an attacker do, and how severe you judge it
- Steps to reproduce — request/response pairs, affected URLs, or a short script
- The affected surface: a page route, an API route, a server action, or a dependency
- Whether you tested against production (`siglens.io`) or a local build
- Any commit, release tag, or timestamp you observed it at

## What to expect

This is maintained by one person, so timelines are best-effort rather than contractual:

| Stage | Target |
|---|---|
| Acknowledgement of your report | Within 3 days |
| Initial assessment and severity call | Within 7 days |
| Fix deployed for a confirmed high-severity issue | As quickly as a fix can be validated and rolled out |

Fixes ship through the normal tag-driven deploy pipeline. You will be credited in the advisory unless you ask not to be.

## Scope

**In scope**

- The production service at `siglens.io` and its API routes
- This repository's source code and its build/deploy configuration
- Authentication and session handling, OAuth flows, and email token flows
- Encryption at rest for OAuth tokens and user-supplied LLM API keys
- Access control between accounts — for example, one user reaching another user's holdings, analyses, or stored keys
- Server-side injection, SSRF, or secret exposure through server actions, route handlers, or the cron endpoint

**Out of scope**

- Denial of service, volumetric traffic, or load testing against production
- Automated scanner output submitted without a demonstrated impact
- Missing rate limits or missing security headers with no concrete exploit path
- Social engineering, phishing, or physical attacks against the maintainer or users
- Vulnerabilities in third-party services Siglens depends on (FMP, Upstash, Neon, Resend, Cloudflare, AWS, or the AI model providers) — please report those to the vendor
- The correctness or profitability of AI analysis output. Siglens is analysis-only and provides no order execution; a report you disagree with is not a security issue
- Anything that requires an already-compromised user device or browser extension

## Testing guidelines

Good-faith research is welcome under these conditions:

- Test only against accounts you own. Do not access, modify, or retain another person's data
- Stop as soon as you have confirmed a vulnerability — do not pivot deeper into the system
- Do not run destructive actions, mass automated scanning, or load generation against production
- Do not exfiltrate data. If you encounter personal data incidentally, stop and say so in your report
- Give a reasonable window for a fix before publishing anything

Reports that follow these guidelines will not be pursued as license violations or unauthorized access.

## Supported versions

Only the currently deployed release is supported. Siglens is a continuously deployed service with no maintained release branches, so fixes land on `master` and ship in the next `v*` tag rather than being backported.

## A note on secrets

`.env.example` documents the shape of every required key but contains no values. If you believe a real credential has been committed to this repository or exposed in a build artifact, treat it as a high-severity report and use the private channel above.
