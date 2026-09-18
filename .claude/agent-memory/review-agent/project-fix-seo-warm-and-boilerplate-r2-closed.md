---
name: project-fix-seo-warm-and-boilerplate-r2-closed
description: fix/seo-warm-and-boilerplate R2 — CLOSED, approved. All 5 R1 findings (core bump justification, warm-step timeout, JSDoc path, 14-day boundary test, /news/us stale-filter) verified fixed via live checks
metadata:
  type: project
---

Round 2, scoped to `modified_files`: `.github/workflows/deploy.yml`, `src/entities/sitemap-entry/lib/buildStaticEntries.ts`,
`src/entities/sitemap-entry/__tests__/buildStaticEntries.test.ts`, `package.json`/`yarn.lock`.
All 5 [[project-fix-seo-warm-and-boilerplate-r1]] findings verified fixed, no new findings. Approved, loop closes.

**Verified live (not just read):**
1. Core bump 1.9.0→1.10.1 — `yarn tsc --noEmit` EXIT:0, `yarn vitest run src/entities/sitemap-entry` 108/108 pass.
   `git diff origin/master -- yarn.lock` shows the checksum/version delta is scoped to exactly
   `@y0ngha/siglens-core` (no unrelated dependency drift). Installed `node_modules/@y0ngha/siglens-core`
   `package.json` confirms version 1.10.1; grepped `dist/domain/analysis/systemPrompt.js` and found the
   literal "Descriptive, not prescriptive" fifth CORE PRINCIPLE text the orchestrator's justification
   claimed — this is real, not an asserted-but-unverified claim. `package.json`/`yarn.lock` mtimes
   (07:55) predate the other 3 modified files (08:08), so the bump was stable before this round's other
   edits, not still being iterated on mid-review ([[feedback-file-can-change-mid-review]] check).
2. `deploy.yml` warm step now has `timeout-minutes: 8` + comment computing the ~19min worst case and
   citing the job's `continue-on-error` != timeout-exemption distinction. Cross-checked the arithmetic:
   job timeout 45min − ASG poll ceiling 30min − build/push 5~7min ≈ 8min remaining budget, so the chosen
   cap of 8 isn't arbitrary — it's the leftover slice (comment doesn't spell this out explicitly, judged
   too trivial to flag).
3. `BuildStaticEntriesOptions.backtestingDataDate` JSDoc now names `src/app/[locale]/backtesting/data.json`
   (the file the code actually imports) and notes the hand-kept `public/` duplicate — matches reality.
4. `it.each` boundary test added: exactly 14 days (excluded, `<` comparison) and 14 days minus 1 second
   (included) — math re-verified against `STALE_NEWS_CATEGORY_MS = 14 * MS_PER_DAY` and the filter's
   strict `<` operator.
5. `/news/us` now derives lastmod from `freshUsCategories` (`categoriesInRegion('us')` intersected with
   `newsCategories`, i.e. only categories that survived the staleness filter) instead of raw
   `categoriesInRegion('us')`. No dedicated regression test for the exact edge case named in R1 (stale-only
   known category + others undefined), but the fix is structurally correct by construction (intersection
   with the already-filtered set) — judged sufficient without demanding a new test for a recommended-level
   finding.

**Verification method:** read all 3 non-lockfile modified files fully, ran `yarn tsc`+scoped vitest live,
diffed `yarn.lock`/`package.json` against `origin/master`, inspected the actually-installed core package's
compiled `dist/` output to confirm the prompt-principle claim rather than trusting the round-1 prose.
