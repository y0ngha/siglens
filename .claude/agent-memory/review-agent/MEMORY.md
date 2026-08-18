# Memory Index

## Rules Reference

- [FF Principles](rules-ff.md) — 4 principles (Readability, Predictability, Cohesion, Coupling) condensed for review
- [Conventions](rules-conventions.md) — Coding conventions condensed for review

## Project

- [audit/fix-r4 KRcal + overall degrade gate](project-audit-fix-r4-krcal-overall-degrade.md) — R1 approved: horizon extension math-verified, peek cache-hit verified, 8th file caught via file-count mismatch
- [Coverage-PR review patterns](project-coverage-pr-patterns.md) — test-only coverage PRs: focus on falsifiability not %; next/dynamic mock soundness, weak handler-coverage tests, comment line-refs
- [Crypto assetClass/session threading](project-crypto-assetclass-session.md) — crypto epic: resolveAssetClass/sessionSpecFor/dual-singleton provider; equity=default; hotspots: lossy assetClass→profileId ternary 3x, 4x tab-guard dup, removed-symbol comment drift
- [CDN cache RSC guard dead code](project-cdn-cache-rsc-guard-dead-code.md) — proxy.ts `_rsc` guard unreachable (adapter.js strips param+header pre-middleware); flag any middleware branching on RSC signals, demand prod-build evidence
- [eslint-disable-next-line line mismatch](project-eslint-disable-line-mismatch.md) — disable above deps array doesn't suppress exhaustive-deps (anchors to hook call line); verify round-summary lint claims by re-running eslint yourself
- [market-fg percentile window-slice fix](project-market-fg-percentile-window-slice.md) — siglens-core: O(n²)→window-slice arithmetically identical; for-loop+push mirrors sibling fearGreed/walkForward.ts (approved pattern per MISTAKES 15.5)
- [market-fg spec error-handling mismatch](project-market-fg-spec-error-handling-mismatch.md) — RESOLVED round 4: fetchDailyCloses now throws on 0 usable rows, comment/tests match Promise.all all-or-nothing reality
- [market-fg round 4 deployment-audit fixes](project-market-fg-round4-audit-fixes.md) — proxy fear-greed 301 fix, EOD to-bound, alarm+runbook, generateMetadata degrade, FactorBar h3, E2E fixture — all verified correct
- [position-tab currency fix (audit/fix-currency)](project-position-tab-currency-fix.md) — R1 found sub-$1 "$0" bug (4x dup formatAmount); R2 approved after independent mutation-test + origin/master diff re-verification
- [seo-prewarm rotation-cursor fix (audit/fix-prewarm)](project-seo-prewarm-rotation-mutation-verify.md) — R2 approved after live re-run of author's mutation claims (shadow-model test, 2 deadline-check tests, lock.ts comment vs route.ts); KRX has no holiday calendar at all in this codebase
- [OverallView hasOptions audit (audit/fix-seo)](project-overall-hasoptions-audit-fix-seo.md) — R1/R2/R3 recurred (fail-open default, `?? ''`, 3rd derivation); R4 fixed all via `profileIdForSymbol`, approved w/ 1 stale-comment recommendation
- [audit/fix-seo ROOT_TITLE/SPCX (R6)](project-audit-fix-seo-root-title-spcx.md) — approved: ROOT_FULL_TITLE fixes OG/Twitter brand loss, SPCX purged from SECTOR_STOCKS; both mutation-verified live
- [kr-release audit R2-R3](project-kr-release-audit-round2.md) — R2 found `$`-on-KRW in PositionStatusSummary; R3 verified all fixes, only `isFundShapedName` trust-name regression + long non-findings list
- [fix-tests2 mutation audit](project-fix-tests2-mutation-audit.md) — 6/7 mutations + 2 E2E deletions re-verified live; approved R1. `initialAnalysisFailed={true}` hardcode makes share-flow 'idle' unreachable; SITE_DESCRIPTION embeds "한국" project-wide (JSON-LD tautology trap)

## Feedback

- [Round-1: check untracked files too](feedback-check-untracked-files.md) — `git diff --name-only` misses new `??` files in a worktree; also run `git status -uall`
- [Read tool can silently drop lines on large files](feedback-read-tool-silent-line-loss.md) — no truncation warning; cross-check `wc -l` before concluding content is missing
- [Audit the slice, not the diff list](feedback-audit-enumerate-slice-not-difflist.md) — for "thread X through N call sites" fixes, grep the symptom repo-wide and subtract; the miss is the unlisted file