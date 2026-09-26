# Memory Index

## Rules Reference

- [FF Principles](rules-ff.md) — 4 principles (Readability, Predictability, Cohesion, Coupling) condensed for review
- [Conventions](rules-conventions.md) — Coding conventions condensed for review

## Feedback

- [File can change mid-review](feedback-file-can-change-mid-review.md) — implementer may still edit while I read; check mtime vs sibling files, re-read+re-test before finalizing findings
- [Cross-repo resolution claims need a consumer check](feedback-cross-repo-resolution-claims-need-consumer-check.md) — when a core-repo fix claims a specific consumer already handles the new contract, grep that consumer's real source before trusting it
- [Round-1: check untracked files too](feedback-check-untracked-files.md) — `git diff --name-only` misses new `??` files in a worktree; also run `git status -uall`
- [Read tool can silently drop lines on large files](feedback-read-tool-silent-line-loss.md) — no truncation warning; cross-check `wc -l` before concluding content is missing
- [Green tsc says nothing about scripts/ or worker/](feedback-scripts-excluded-from-tsc.md) — tsconfig excludes them; core breaking bumps leave write-once callers silently broken
- [Added LIMIT breaks "seed ALL" callers](feedback-limit-added-breaks-seed-all-contract.md) — new `.limit()` on a shared repo read turns backfill scripts into "first N" silently; grep callers, look for "all/전부" in their prose
- [Audit the slice, not the diff list](feedback-audit-enumerate-slice-not-difflist.md) — for "thread X through N call sites" fixes, grep the symptom repo-wide and subtract; the miss is the unlisted file

## Project

Closed loops (approved, kept for pattern recall only — see file for detail):
- [market-fear-greed crypto signDisplay R2 closed](project-market-fear-greed-crypto-signdisplay-r2-closed.md) — signDisplay unsigned-for-share fix mutation-checked, closed
- [audit/fix-r4 KRcal+overall degrade](project-audit-fix-r4-krcal-overall-degrade.md) — 8th file caught via file-count mismatch
- [Coverage-PR patterns](project-coverage-pr-patterns.md) — test-only PRs: judge falsifiability not %
- [Crypto assetClass/session](project-crypto-assetclass-session.md) — lossy assetClass→profileId ternary hotspot
- [CDN RSC guard dead code](project-cdn-cache-rsc-guard-dead-code.md) — proxy.ts `_rsc` guard unreachable, demand prod-build evidence
- [eslint-disable line mismatch](project-eslint-disable-line-mismatch.md) — verify round-summary lint claims yourself
- [market-fg fixes](project-market-fg-percentile-window-slice.md) — window-slice O(n²) fix; see also -spec-error-handling-mismatch.md, -round4-audit-fixes.md
- [position-tab currency](project-position-tab-currency-fix.md) — sub-$1 "$0" bug, 4x dup formatAmount
- [seo-perf-bars-seed](project-seo-perf-bars-seed-r2-closed.md) — R1 found 0-coverage+stale comment; R2 closed via mutation re-test
- [seo-prewarm rotation-cursor](project-seo-prewarm-rotation-mutation-verify.md) — shadow-model mutation test; KRX has no holiday calendar in this codebase
- [OverallView hasOptions](project-overall-hasoptions-audit-fix-seo.md) — same bug recurred R1-R3 (fail-open/`?? ''`/3rd derivation), R4 fixed via profileIdForSymbol
- [ROOT_TITLE/SPCX](project-audit-fix-seo-root-title-spcx.md) — OG/Twitter brand loss + stale SECTOR_STOCKS entry
- [kr-release currency](project-kr-release-audit-round2.md) — `$`-on-KRW bug; `isFundShapedName` trust-name regression
- [asset-class-nav R5](project-asset-class-nav-r5.md) — spread-inherited fixture = unfalsifiable assertion trap
- [prompt-region-context R6](project-prompt-region-context-r6.md) — green-suite traps: wrong-describe dup, vacuous not.toContain
- [core briefing-context](project-core-048-briefing-context.md) — verify claims in core dist, not just siglens src/
- [fix-tests2 mutation audit](project-fix-tests2-mutation-audit.md) — hardcoded prop makes a UI state unreachable
- [aws-cost memStore R2](project-perf-aws-cost-memstore-fix.md) — order-of-check-vs-mutation bug
- [fear-greed seed-helper](project-fear-greed-page-seed-helper-fix.md) — pass-by-reference SSR-output-unchanged claim, mutation-verified
- [i18n-multilingual epic R1-R6](project-i18n-multilingual-r6.md) — recurring locale-loss bug class across 6 rounds (nav Link, history.replaceState, Server Action redirect(), post-signup exact-match) — R6 closed via useAppPathname consolidation + repo-wide sweep; earlier-round files hold each variant's detail
- [mobile-search-overlay R3](project-mobile-search-overlay-r3.md) — onNavigate zero test coverage, JSDoc overclaim vs Next source
- [seo-internal-links relatedSymbols R4-R6](project-seo-internal-links-relatedsymbols-r6.md) — DSU-rethrow mutation-verified; untracked file needs `git status` not `git diff`
- [canonical-korean-names R2-R4](project-canonical-korean-names-r4-closed.md) — missed 3rd consumer (searchByKoreanName); closed after live mutation re-test
- [related-visibility-footer R2](project-related-visibility-footer-r2.md) — soft-404 + SECTOR_ETFS claims mutation-verified
- [redesign/p1-dark-tokens](project-redesign-p1-toggle-contrast-r7-closed.md) — multi-round epic (heading sweep, fear-greed coercion, toggle contrast); toggle-contrast R6 found latent NaN vacuous-pass, R7 closed it
- [visitor-metrics privacy v3 R2](project-visitor-metrics-privacy-v3-r2.md) — effective-date gate + 4-locale seed verified
- [share-plain-language R1-R2](project-share-plain-language-r2-closed.md) — contentHash must include new field (chartBars precedent)
- [sitemap-position-tab R1](project-fix-position-sitemap-r1.md) — approved, no stale hardcoded counts
- [seo index-footprint-recovery R1](project-seo-index-footprint-recovery-r1.md) — reverts a bad PR; caught doc (SITEMAP_SCOPE.md) still recommending the undone mistake
- [seo-meta-description-markdown R1](project-seo-meta-description-markdown-r1.md) — latent `*`/`_` false-pair regex corruption
- [seo-live-audit R1 crypto/overall](project-seo-live-audit-r1-crypto-overall-gap.md) — buildCryptoPopularEntries not wired to new prose gate
- [seo-warm-and-boilerplate R1-R2](project-fix-seo-warm-and-boilerplate-r2-closed.md) — uncommitted mid-review core bump caught; closed after full re-verify
- [seo-cls-sitemap-polish R2, R4](project-seo-cls-sitemap-polish-r4-pwa-settle-closed.md) — e2e asserted a deleted timer; R4 closed via settlePwaBanner
- [agent-analyst-voice prompt R1](project-agent-analyst-voice-prompt-r1.md) — missing PUBLIC_API.md changelog row
- [ai-chat-sidebar-ux R2](project-ai-chat-sidebar-r2-suspense-promise.md) — unawaited-Promise/use() SSR fix, approved
- [ai-guest-brand/cookie-polish](project-ai-guest-cookie-polish-r1.md) — guest chat blocked by pinned core version (turnsPerDay.free=0→10 after bump)
- [analysis-plain orphan-recovery R1](project-analysis-plain-orphan-recovery-r1.md) — cache-write-in-attempt() fix verified exactly-once; prewarm benefit is really just the longer deadline, not cache reuse (6/7 tabs never re-read the key)
- [core-1.0.4 prompt-currency R4](project-core-1.0.4-prompt-currency-plain-language-r4.md) — closed guardPlainText length-floor comment drift
- [deepseek-stall-gemini-fallback R1-R2](project-deepseek-stall-gemini-fallback-r2-closed.md) — usage attribution wrong after fallback; closed, new gap noted (news digest missing providerFallback)
- [seo-a-symbol-gates R1](project-fix-seo-a-symbol-gates-r1.md) — 11-item overhaul, gate/body predicate parity across 3 gates
- [seo-c-backtesting R1](project-fix-seo-c-backtesting-r1.md) — JSDoc mischaracterized aiWinRate composition vs generator source
- [seo-e-ua-neutral R1](project-fix-seo-e-ua-neutral-r1.md) — UA branch removal math-verified
- [seo-f-freshness-ux R1](project-fix-seo-f-freshness-ux-r1.md) — sitemap lastmod + soft-404→404 + i18n parity
- [groundnumbers PR#205 R4](project-groundnumbers-pr205-r4-closed.md) — closed
- [i18n-locale-switcher R1](project-i18n-locale-switcher-visibility-r1.md) — flag flip, ai-host non-issue
- [offline-build R2](project-offline-build-r2-closed.md) — closed
- [prompt-numeric-audit R3](project-prompt-numeric-audit-r3-closed.md) — closed
- [prompt-precision-currency R2](project-prompt-precision-currency-r2-currency-thread-gap.md) — core fixed but siglens consumer doesn't thread currency yet
- [seo-d-news-category R1](project-seo-d-news-category-r1.md) — hashes.json orphan confirmed pre-existing
- [seo-duplicate-titles R1-R2](project-seo-duplicate-titles-r2-closed.md) — tab-threading across 9+17 sites; closed via real-catalog test
- [siglens-core agent-tool-routing R1](project-siglens-core-agent-tool-routing-r1.md) — Korean-unit tool-number fix, 63/63 green
- [trader alerts-topic reroute](project-trader-alerts-topic-reroute.md) — provision.sh → shared siglens-alerts topic

- [feat/agent-precomputed-data R1](project-agent-precomputed-data-r1.md) — UTC-midnight daily bars break bar-count staleness; core Fib labels are `50.0%`; weekly HTF dead at 500 daily bars
- [feat/agent-precomputed-data R2](project-agent-precomputed-data-r2.md) — source fixes right, tests vacuous: fixed dates vs 7-day hard cap (KR test fails 2026-09-24), tz tests at instants where local==UTC date
- [feat/agent-precomputed-data R3](project-agent-precomputed-data-r3.md) — 2 real-clock staleness tests outside frozen block fail 01–04Z; MessageList `{ px }` repeat-height untested
- [feat/agent-precomputed-data R4](project-agent-precomputed-data-r4.md) — R3 fixes mutation-verified; recommended only: wrong getQuote-failure contract JSDoc, localDate dup, orphan comment
- [feat/agent-precomputed-data R5](project-agent-precomputed-data-r5.md) — R4 closed; zonedDate pasted between zoneOffsetMs and its JSDoc; getFundamentals' new quote bypasses quoteWithTimeout
- [feat/agent-precomputed-data R6](project-agent-precomputed-data-r6.md) — R5 closed; only nit: quote comment claims "every other agent-tool quote" bounded, get_quote is raw
- [feat/agent-precomputed-data R7](project-agent-precomputed-data-r7.md) — approved; comment nit closed, sibling claims grep-verified
- [feat/agent-range-windows-ma50 R3](project-agent-range-windows-ma50-r3.md) — MA50_PERIOD decoupled from CONFLUENCE_TREND_MA_PERIOD, same-value-but-different-purpose constants, approved
- [core precomputed-prompt-data R1](project-core-precomputed-prompt-data-r1.md) — date-only Math.round off-by-one, NaN%p sector spread, keyPrices/geometry prompt contradictions; mutation-in-scratch-copy technique
- [core precomputed-prompt-data R2](project-core-precomputed-prompt-data-r2.md) — raw-vs-printed target mismatch, 8dp conservative, PUBLIC_API claims nonexistent PivotPoint export
- [core precomputed-prompt-data R3](project-core-precomputed-prompt-data-r3.md) — R2 fixed; PUBLIC_API "index.client only PivotTables" now false; negative measured targets; uniform-high fixture can't pin rim span
- [core precomputed-prompt-data R4](project-core-precomputed-prompt-data-r4.md) — R3 mutation-verified; LlmStrikeOpenInterest undocumented in both barrels; rim bounds pinned only 2 bars out
- [core precomputed-prompt-data R5](project-core-precomputed-prompt-data-r5.md) — R4 fixes mutation-verified; recommended only: n=0 target boundary untested, changelog stops at round 2
- [core precomputed-prompt-data R6](project-core-precomputed-prompt-data-r6.md) — approved; n>=0 + all-or-nothing mutations killed; scratch copy needs `./node_modules/.bin/vitest` not yarn
- [trader precomputed-core-1.11 R1](project-trader-precomputed-core-1.11-r1.md) — single-row fixture = unfalsifiable "latest past row" fallback; old-vs-new core d.ts diff via main checkout node_modules
- [trader precomputed-core-1.11 R2](project-trader-precomputed-core-1.11-r2.md) — approved; 4 fallback mutations killed; trader scratch-copy mutation recipe
- [trader core-1.11.1 bump R1](project-trader-core-1.11.1-bump-r1.md) — approved; pure version bump, riskReward-text prepend-condition change confirmed inert for trader
- [trader core-1.17-pullback R1](project-trader-core-1.17-pullback-r1.md) — approved; evaluatePullback unused, entryRecommendation semantics-only change inert, skills resync forward-diverges (not lost)
- [trader daily-mr R3](project-trader-daily-mr-r3.md) — 3-agent parallel fix round, interactions all verified correct; only stale idempotency-key comment + silent-done edge case
- [trader daily-mr R4 closed](project-trader-daily-mr-r4-closed.md) — approved; both R3 nits fixed, JSDoc grep-matched, mutation-shaped test added
- [feat/agent-adaptive-depth R2](project-core-agent-adaptive-depth-r2.md) — approved; null-confluence Plain-level fallback + PUBLIC_API row, mutation-verified
- [feat/hub-ai-prewarm R2-R4 closed](project-hub-ai-prewarm-r2.md) — R3 reorder broke durationMs (dropped hub-phase time), R4 fixed via independent batchStartedAt, sim-clock mutation-verified
- [feat/ai-about-page R1-R2 closed](project-ai-about-page-r1-r2.md) — tRaw helper name avoids extract.mjs regex miss; key-set-equality flatten script; R2 saw unlisted unstaged files
- [feat/symbol-chat-to-ai-host R1](project-symbol-chat-to-ai-host-r1-share-regression.md) — hideView removal killed Share button on 5 snapshot-gated tabs (useRegisterShareable ran pre-guard, hidden); rest of removal clean
- [prewarm-no-news-starvation R2](project-prewarm-no-news-starvation-r2.md) — 7 mutations killed; survivors: QUOTE_MAX_AGE_MS widening, gate-before-busy-check ordering
- [prewarm-no-news-starvation R3](project-prewarm-no-news-starvation-r3.md) — core 1.14.0 no_news abstention verified in dist; all R2 fixes mutation-killed; 6 stale pre-1.14.0 comments remain
- [core overall-optional-news-axis R4](project-core-overall-optional-news-axis-r4.md) — approved; R1-R3 defects were all doc-vs-source drift; snapshot key named an unexercised branch

- [fix/set-state-in-effect R1](project-set-state-in-effect-r1.md) — source correct; firedNavRef/explicitTab/server-snapshot unpinned (mutation-verified); useEffectEvent does NOT escape oxlint 1.79 rule
- [fix/set-state-in-effect R2](project-set-state-in-effect-r2.md) — all R1 survivors killed; hydrate:true renderHook pins server snapshot; nits only
- [fix/set-state-in-effect R3](project-set-state-in-effect-r3.md) — approved; locale-flip test mutation-verified, MISTAKES #10 consistent
- [chat-news-enrich-invalidate R3](project-chat-news-enrich-invalidate-r3.md) — sync LLM enrich inside get_news's 30s core tool timeout (no stall watchdog on Gemini); STALE_FRESHNESS_DETAIL_LIMIT/stalePriceCount mutations survive

## Reference

- [hashes.json misc-namespace gap](reference-hashes-json-misc-namespace-gap.md) — hand-authored i18n keys (e.g. liveCrossRef) were never tracked in hashes.json; not a new-PR defect unless key already had an entry
- [agent-require-refetch R2](project-agent-require-refetch-r2.md) — PUBLIC_API changelog row closed, toolChoice/reconciledLevels claims verified in source
