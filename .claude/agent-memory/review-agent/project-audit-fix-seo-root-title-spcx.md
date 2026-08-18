---
name: project-audit-fix-seo-root-title-spcx
description: audit/fix-seo — ROOT_TITLE brand-suffix strip broke OG/Twitter (R5), SPCX leaked into dashboard-tickers SECTOR_STOCKS (R5); R6 approved both fixes after mutation-verification
metadata:
  type: project
---

Branch `audit/fix-seo` (same branch as [[project-overall-hasoptions-audit-fix-seo]], different
sub-issue). Root cause: stripping the `| Siglens` brand suffix from `ROOT_TITLE` (done for
SERP width budget, `SEO_TITLE_MAX_WIDTH=55`) also stripped it from `layout.tsx`'s
`openGraph.title`/`twitter.title`, which had inherited `ROOT_TITLE` — but social cards
(Kakao/Slack/Twitter/Facebook unfurls) have no width constraint and *should* show the brand,
mirroring the existing `fullTitle`/`MARKET_FULL_TITLE`/`ECONOMY_FULL_TITLE` split pattern used
by all 12 other SEO builders in `src/shared/lib/seo.ts`.

**Round 5 (prior reviewer) found**: (1) OG/Twitter losing brand exposure — no test caught it
since nothing asserted those fields before. (2) `SPCX` (a SPAC/new-issue ETF, not the actual
unlisted SpaceX) present in `dashboard-tickers.ts`'s `SECTOR_STOCKS` SPACE sector — a second
consumer beyond `popular-tickers.ts` (fixed in an earlier round), rendering a real crawler-visible
`<Link href="/SPCX">` via `/market`'s `SectorFactsSummary`.

**Round 6 (this reviewer, approved)**: verified both fixes hold —
1. New `ROOT_FULL_TITLE = \`${ROOT_TITLE} | ${SITE_NAME}\`` in `seo.ts`, consumed only by
   `layout.tsx`'s `openGraph.title`/`twitter.title`. `title.default` still uses bare `ROOT_TITLE`
   (byte-identical to pre-R5 value — confirmed via direct width/string computation, 55 width units).
   Mutation-verified: reverting both OG/Twitter fields back to `ROOT_TITLE` in `layout.tsx` and
   running `yarn test src/app/__tests__/layout.test.ts` fails exactly the 2 new tests (confirmed
   live, not just re-reading the diff).
2. `SPCX` removed from `SECTOR_STOCKS` SPACE sector (7→6 members: RKLB/ASTS/LUNR/RDW/PL/SPCE),
   comment + test wording updated to "6개" and matches reality. Mutation-verified: re-adding a
   fake SPCX entry fails both the exact-membership test and the explicit not-toContain regression
   guard (confirmed live). Exhaustively grepped `SPCX` repo-wide — every remaining hit is a comment
   or a regression-guard test description (`popular-tickers.ts`, `dashboard-tickers.ts`,
   `assetClassification.test.ts` — the last one legitimately tests that an arbitrary SPCX *symbol
   page visit* still classifies correctly as `fund`, which is unrelated to the dashboard-tickers
   membership list). No live/functional occurrence remains in any consumer.
   No hardcoded min-membership or batching rule exists on `SECTOR_STOCKS`/`SIGNAL_SECTORS`
   (`sectorSignalsCache.ts` only checks `.stocks.length > 0` globally) — dropping to 6 is safe.

**Recommended-only item, judged acceptable**: `ROOT_TITLE` sits at exactly `SEO_TITLE_MAX_WIDTH`
(55), zero margin, unlike the 12 `composeSymbolTitle`-driven templates which have a dynamic 3-tier
fallback. Author left it as-is with a comment: the safety net is `seo.rootCopy.test.ts`'s width
assertion, which references the `SEO_TITLE_MAX_WIDTH` *constant* (not a hardcoded `55`), so any
future edit that regresses the budget fails loudly. Verified this test genuinely does that (reads
`SEO_TITLE_MAX_WIDTH` symbolically). Also verified the R5 "0 vs 3-5 slack" framing is imprecise —
sibling templates are only *guaranteed* `≤ SEO_TITLE_MAX_WIDTH` by their clamp, not guaranteed
sub-55; they can land at exactly 55 too. Given a real, live-verified regression test exists and
shortening further risks truncating the core headline keyword, this is a defensible judgment call,
not a required fix — did not re-raise it.

**How to apply**: for future `audit/fix-seo` rounds touching `ROOT_TITLE`/`ROOT_FULL_TITLE` or
`SECTOR_STOCKS`, re-run these two mutation checks live rather than trusting the round summary —
both are cheap (`yarn test <one file>`, seconds) and this round's summary claims matched reality
exactly, but that should still be independently confirmed each round per
[[feedback-check-untracked-files]]-style skepticism of self-reported gates.
