# Memory Index

## Rules Reference

- [FF Principles](rules-ff.md) — 4 principles (Readability, Predictability, Cohesion, Coupling) condensed for review
- [Conventions](rules-conventions.md) — Coding conventions condensed for review

## Project

- [Coverage-PR review patterns](project-coverage-pr-patterns.md) — test-only coverage PRs: focus on falsifiability not %; next/dynamic mock soundness, weak handler-coverage tests, comment line-refs
- [Crypto assetClass/session threading](project-crypto-assetclass-session.md) — crypto epic: resolveAssetClass/sessionSpecFor/dual-singleton provider; equity=default; hotspots: lossy assetClass→profileId ternary 3x, 4x tab-guard dup, removed-symbol comment drift
- [CDN cache RSC guard dead code](project-cdn-cache-rsc-guard-dead-code.md) — proxy.ts `_rsc` guard unreachable (adapter.js strips param+header pre-middleware); flag any middleware branching on RSC signals, demand prod-build evidence
- [eslint-disable-next-line line mismatch](project-eslint-disable-line-mismatch.md) — disable above deps array doesn't suppress exhaustive-deps (anchors to hook call line); verify round-summary lint claims by re-running eslint yourself
- [market-fg percentile window-slice fix](project-market-fg-percentile-window-slice.md) — siglens-core: O(n²)→window-slice arithmetically identical; for-loop+push mirrors sibling fearGreed/walkForward.ts (approved pattern per MISTAKES 15.5)
- [market-fg spec error-handling mismatch](project-market-fg-spec-error-handling-mismatch.md) — RESOLVED round 4: fetchDailyCloses now throws on 0 usable rows, comment/tests match Promise.all all-or-nothing reality
- [market-fg round 4 deployment-audit fixes](project-market-fg-round4-audit-fixes.md) — proxy fear-greed 301 fix, EOD to-bound, alarm+runbook, generateMetadata degrade, FactorBar h3, E2E fixture — all verified correct

## Feedback

No active feedback entries.