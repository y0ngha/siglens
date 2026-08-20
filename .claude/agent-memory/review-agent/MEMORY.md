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
- [asset-class-nav R5 closing check](project-asset-class-nav-r5.md) — spread-inherited fixture = unfalsifiable assertion; seed-loop dual exit + exitCode; `/market/kr` 0.9 is derived, not literal
- [prompt-region-context R6](project-prompt-region-context-r6.md) — green-suite traps: surviving duplicate under wrong describe, forward-scanning few-shot helper, vacuous not.toContain; scratchpad vitest recipe
- [core 0.48.0 briefing-context wiring](project-core-048-briefing-context.md) — verified in core dist: hash folds context, prompt (not hash) drops `price:0`, sectors come from sectorEtfs only; miss was outside src/
- [fix-tests2 mutation audit](project-fix-tests2-mutation-audit.md) — 6/7 mutations + 2 E2E deletions re-verified live; approved R1. `initialAnalysisFailed={true}` hardcode makes share-flow 'idle' unreachable; SITE_DESCRIPTION embeds "한국" project-wide (JSON-LD tautology trap)
- [rsc-flight-fear-greed R3 tailAligned](project-rsc-flight-fear-greed-r3-tailaligned.md) — approved: seriesDataUtils left→tail alignment math-verified all shapes, 3 changed test assertions confirmed real fixes not laundering, computeFearGreedIndex core-source-verified bars+buySellVolume only
- [rsc-flight-fear-greed R6 client-error](project-rsc-flight-fear-greed-r6-clienterror.md) — stripQueryStrings O(n²) unbounded before length-cap (reachable via unhandledrejection); mutation-test method confirmed ESM namespace-import spy + module-load-time env const are real, not tautological
- [perf/aws-cost-reduction memStore fix (R2)](project-perf-aws-cost-memstore-fix.md) — approved: MAX_ENTRY_BYTES check moved before delete/budget mutation, as-cast guarantee comment added; cache-handler/shared-cache tests use flat describe+module-level beforeEach by convention, don't flag
- [perf/rsc-flight-fear-greed seed-helper fix (R1)](project-fear-greed-page-seed-helper-fix.md) — approved: getSeedBarsStatic passes bars/buySellVolume through by reference so SSR output unchanged; mutation-verified live (8/14 red on revert, 14/14 green restored), tsc+oxlint EXIT:0 captured directly
- [feat/i18n-multilingual R1](project-i18n-multilingual-r1.md) — 9x locale-invariant canonical (explicit arg bypasses self-ref auto-derive), setRequestLocale only in root layout, extract.mjs --apply can emit undefined-`t` code, scripts/i18n gitignored, nav usePathname locale-prefix mismatch
- [feat/i18n-multilingual R2](project-i18n-multilingual-r2.md) — all 8 R1 findings verified fixed; new miss: header nav `<Link>` hrefs still unprefixed (plain next/link) so clicking drops locale to ko silently, fix only touched usePathname not Link
- [feat/i18n-multilingual R3](project-i18n-multilingual-r3.md) — LocaleLink fix verified airtight (52 files, 0 raw next/link). New: window.history.replaceState locale-loss in useTimeframeChange.ts; whole unaddressed class of hardcoded-unprefixed redirect() in 7+ Server Action files (logout/delete-account/oauth/password-reset/api-key)
- [feat/i18n-multilingual R4](project-i18n-multilingual-r4.md) — R3's 2 findings verified fixed correctly (15 redirect() sites, window.history). New: resolvePostSignupDestination's `next==='/'`  exact-match breaks post-signup onboarding redirect for en/ja/zh (localized next is `/en` not `/`); test mocks reimplement the same bug so it's invisible
- [feat/i18n-multilingual R5](project-i18n-multilingual-r5.md) — relayed only: SymbolTabs/NoticePopup/usePageContextLabel path-compare broke on prefix; fixed via new useAppPathname.ts + allowlist audit test
- [feat/i18n-multilingual R6 — APPROVED, closes epic](project-i18n-multilingual-r6.md) — verified useAppPathname consolidation + all 6 allowlist entries + audit-test soundness (import-line-based, not module-aware) + repo-wide locale-loss sweep, zero findings

## Feedback

- [Round-1: check untracked files too](feedback-check-untracked-files.md) — `git diff --name-only` misses new `??` files in a worktree; also run `git status -uall`
- [Read tool can silently drop lines on large files](feedback-read-tool-silent-line-loss.md) — no truncation warning; cross-check `wc -l` before concluding content is missing
- [Green tsc says nothing about scripts/ or worker/](feedback-scripts-excluded-from-tsc.md) — tsconfig excludes them; core breaking bumps leave write-once callers silently broken
- [Added LIMIT breaks "seed ALL" callers](feedback-limit-added-breaks-seed-all-contract.md) — new `.limit()` on a shared repo read turns backfill scripts into "first N" silently; grep callers, look for "all/전부" in their prose
- [Audit the slice, not the diff list](feedback-audit-enumerate-slice-not-difflist.md) — for "thread X through N call sites" fixes, grep the symptom repo-wide and subtract; the miss is the unlisted file

## Reference

- [Next.js router.replace + history.back() race](reference-nextjs-router-replace-history-race.md) — delayed replaceState lands on whatever entry is current when the RSC fetch resolves, not the one current at call time; cancel-during-transition can silently mis-navigate

## Project (round updates)

- [mobile-search-overlay R1](project-mobile-search-overlay-r1.md) — navTargetRef effect itself correct, but Escape/취소 close isn't gated on isNavigating → history race; zero tests for the fragile branch; hook ordering violation
- [mobile-search-overlay R2](project-mobile-search-overlay-r2.md) — canClose fix narrows but doesn't close the race: popstate (OS back/swipe) bypasses it entirely, isNavigating has no timeout ceiling (keyboard trap risk); 1 new test vacuous (Tests #20); DIRECT_TICKER_RE + hook-order exception confirmed correct
- [mobile-search-overlay R4](project-mobile-search-overlay-r4.md) — R3's onNavigate tests + JSDoc fix both re-verified live (mutation + next dist source check); new vacuous toBeEnabled() test found, same root cause as R2's, 2nd occurrence in this file
- [mobile-search-overlay R6](project-mobile-search-overlay-r6.md) — gate/body split correct; 3 required findings live-reproduced via scratch tests: dead eslint-disable, onChange missing isSubmitRequested reset (unrequested nav), stale pushedRef via popstate mid-replace (wrong history.back())
- [mobile-search-overlay R7 — APPROVED, closes loop](project-mobile-search-overlay-r7.md) — all 3 R6 findings re-verified fixed via live mutation-revert-rerun on the 4 modified files; zero new findings