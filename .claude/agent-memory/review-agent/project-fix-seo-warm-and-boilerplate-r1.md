---
name: project-fix-seo-warm-and-boilerplate-r1
description: fix/seo-warm-and-boilerplate R1 — 3 SEO audit items (deploy warm, sitemap lastmod honesty, FAQ boilerplate) mostly sound; mid-review core version bump anomaly
metadata:
  type: project
---

Branch `fix/seo-warm-and-boilerplate` (worktree `siglens-wt-warm`), round 1. Three items:
deploy-time ISR/CDN warm script, sitemap lastmod honesty (stale news category + economy/backtesting
lastmod source), and FAQPage JSON-LD removal from 6 symbol tabs + plain-prompt advice-framing rewrite
+ `/about` limits copy.

**Verified sound:**
- `buildStaticEntries.ts` diffed against `origin/master` line-by-line: stale-category filter (14-day,
  `<` boundary, missing-data categories kept per explicit "loader failure worse than empty" rule),
  `/economy*` SITE_BUILD_DATE→todayUtc, `/backtesting` SITE_BUILD_DATE→`backtestingDataDate` (derived
  from `deriveBacktestStats(...).periodEnd`, the max `entryDate` — confirmed via source read, not
  memory) — all correct and covered by non-vacuous tests (mock `SITE_BUILD_DATE`, assert exact
  `.getTime()` against real `lastClosedSessionCloseUtc`/day-boundary computations).
- FAQ removal: all 6 symbol tabs (congress/fear-greed/financials/fundamental/options/overall)
  consistently drop `buildFaqJsonLd`/`<JsonLd data={faqJsonLd}>`, keep `<FaqSection>`; `buildFaqJsonLd`
  confirmed still used by home/economy hub pages (not orphaned). New `expectVisibleFaqWithoutJsonLd`
  helper (sibling of `expectFaqSingleSource`) asserts 0 FAQPage blocks + visible FaqSection — genuinely
  falsifiable, all 6 test files wired to it.
- `buildPlainPrompt.ts` v13→v14: comment claims cache key hashes the whole prompt string so version
  bump isn't required for invalidation — verified true by reading `api.ts` `buildCacheKey` (sha256 of
  `basePrompt`, which embeds `PLAIN_RULES`). New advice-framing rule has a genuinely non-vacuous test
  suite, including a cross-check that the rounding example matches `findUnsupportedNumbers`' `Math.round`
  tolerance (not just a substring match).
- `/about/content.ts` + `ABOUT_UPDATED_AT` bumped together (ko+en) per the file's own convention.
- FSD: `app/api/sitemap/static/route.ts` importing `@/entities/backtest-case` barrel is legal (app is
  the top layer). No layer violation.

**Findings raised:**
1. (required) `package.json`/`yarn.lock` show an uncommitted `@y0ngha/siglens-core` 1.9.0→1.10.1 bump
   that appeared **mid-review** (absent from the first `git status`/`git diff origin/master --name-only`,
   present ~20 min later — confirmed via `stat -f "%Sm"`, matches [[feedback-file-can-change-mid-review]]).
   `origin/master` is still pinned at 1.9.0, so this isn't a stale-branch sync artifact. Not mentioned
   anywhere in the 3-item task description. Flagged for the orchestrator to confirm intent before this
   lands in the same commit as the SEO work (Predictability §1: unrelated changes without justification).
2. (recommended) `scripts/warm-isr.sh`'s deploy step has no `timeout-minutes` and no wall-clock cap beyond
   per-request `--max-time 30`; worst case (~19 min if the origin is unresponsive for all 150 URLs) adds
   to the job's `timeout-minutes: 45` budget. `continue-on-error: true` only suppresses the *step's* own
   exit code — it does not exempt the step from the job-level timeout, so a sufficiently slow warm pass
   could still cause GitHub Actions to cancel the whole job (marking an already-successful deploy as
   failed). The job's own comments carefully reason about the ASG-poll 30-min ceiling but don't account
   for this new tail step in that budget.
3. (recommended) `BuildStaticEntriesOptions.backtestingDataDate` JSDoc says the page body is
   `public/backtesting/data.json`, but the actual import (both `page.tsx` and the new `route.ts`) reads
   `src/app/[locale]/backtesting/data.json` — a separate, currently byte-identical duplicate file kept
   in sync by hand. Comment names the wrong literal path (though the conceptual claim — "this is the
   public, deploy-independent dataset" — is defensible).
4. (recommended) No exact 14-day boundary test for `STALE_NEWS_CATEGORY_MS` (only a ~22-day-stale case
   tests the filter). Same shape as the `PLAIN_DESCRIPTION_MIN_LENGTH` boundary gap flagged in
   [[project-seo-live-audit-r1-crypto-overall-gap]].
5. (recommended) `newsUsLastModified` (pre-existing, untouched by this diff) still derives `/news/us`'s
   lastmod from `categoriesInRegion('us')` **unfiltered** by the new staleness gate. Edge case: if the
   only US category with a known `publishedAt` is a stale one (now dropped from the sitemap) while the
   others are `undefined` (loader failure), `/news/us` reports the stale date instead of falling back to
   `todayUtc` the way category-level entries do. Low-probability (needs simultaneous partial loader
   failure), not touched by this diff, but directly adjacent to the reviewed 14-day-threshold interaction.

**Verification method:** read every changed file's live content (not diff hunks), used
`git show origin/master:<path>` + `diff -u` to isolate exactly what `buildStaticEntries.ts` and
`fear-greed/page.tsx` changed versus pre-existing prose/logic, traced `buildCacheKey`/`api.ts` source
to confirm the version-bump-doesn't-matter comment, grepped all 6 symbol-tab pages + tests for FAQ
wiring consistency, `stat -f "%Sm"` on every changed file caught the mid-review package.json/yarn.lock
anomaly.
