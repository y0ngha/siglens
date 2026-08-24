# Memory Index

## Rules Reference

- [FF Principles](rules-ff.md) — 4 principles (Readability, Predictability, Cohesion, Coupling) condensed for review
- [Conventions](rules-conventions.md) — Coding conventions condensed for review

## Feedback

- [File can change mid-review](feedback-file-can-change-mid-review.md) — implementer may still edit while I read; check mtime vs sibling files, re-read+re-test before finalizing findings

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
- [feat/mobile-search-overlay R3 — dismissForNavigation gap](project-mobile-search-overlay-r3.md) — pending-nav UI removal genuinely fixes R2's 3 findings; but onNavigate has zero test coverage (mutation-verified) + JSDoc overclaims HistoryUpdater race eliminated (verified live against Next 16.2.12 source)
- [seo-internal-links relatedSymbols.ts R4 — APPROVED, closes loop](project-seo-internal-links-relatedsymbols-r4.md) — themePeersOf JSDoc relocated correctly, stale phrases now {@link}-referenced; file is untracked so `git diff master --` shows nothing, check `git status`
- [seo-internal-links RelatedSymbols.tsx R5](project-seo-internal-links-relatedsymbols-r5.md) — new async server component swallows rethrown DYNAMIC_SERVER_USAGE (sole outlier of 20+ getAssetInfoResilient callers); Suspense-shell timing is recommended only
- [seo-internal-links RelatedSymbols.tsx R6 — APPROVED, closes loop](project-seo-internal-links-relatedsymbols-r6.md) — DSU rethrow mutation-verified live; Suspense-decline judged sound (streaming byte-order ≠ resolution completeness, rebuts R5's own assumption)
- [canonical-korean-names R2 — searchByKoreanName gap](project-canonical-korean-names-r2-searchbykorean-gap.md) — getKoreanNames fix verified via mutation; missed 3rd consumer of korean_tickers (searchByKoreanName), and "always truthy" broke unmapped-filter self-heal in searchTicker.ts
- [canonical-korean-names R3 — choke-point verified, 2 recommended](project-canonical-korean-names-r3-choke-point.md) — loader-level withCanonical confirmed complete via grep+live mutation; DB-fetch branch of loadAllEntries untested (mutation survives), getKoreanNames still double-applies override
- [canonical-korean-names R4 — CLOSED, approved](project-canonical-korean-names-r4-closed.md) — both R3 recommended findings verified fixed via live mutation re-test; loop ends

## Feedback

- [Round-1: check untracked files too](feedback-check-untracked-files.md) — `git diff --name-only` misses new `??` files in a worktree; also run `git status -uall`
- [Read tool can silently drop lines on large files](feedback-read-tool-silent-line-loss.md) — no truncation warning; cross-check `wc -l` before concluding content is missing
- [Green tsc says nothing about scripts/ or worker/](feedback-scripts-excluded-from-tsc.md) — tsconfig excludes them; core breaking bumps leave write-once callers silently broken
- [Added LIMIT breaks "seed ALL" callers](feedback-limit-added-breaks-seed-all-contract.md) — new `.limit()` on a shared repo read turns backfill scripts into "first N" silently; grep callers, look for "all/전부" in their prose
- [Audit the slice, not the diff list](feedback-audit-enumerate-slice-not-difflist.md) — for "thread X through N call sites" fixes, grep the symptom repo-wide and subtract; the miss is the unlisted file