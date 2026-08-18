---
name: audit-fix-r4-krcal-overall-degrade
description: audit/fix-r4 R1 approved — KR_CALENDAR_HORIZON extension to 2026-12-31 + /overall generateMetadata degrade gate, both verified correct including live gate execution
metadata:
  type: project
---

`audit/fix-r4` (worktree `/Users/y0ngha/Project/siglens-r4`, base `audit/kr-release`) fixed two
round-4 audit blockers, approved R1 with zero findings after independent verification:

1. **`KR_CALENDAR_HORIZON`** (`src/shared/api/market/sessionSpecFor.ts`) was pinned to the release
   date, so every future date silently fell back to "normal open" — same defect class as the
   pre-fix bug it was meant to close. Extended to `2026-12-31` with 7 gazetted holidays added
   (09-24/25/28 Chuseok+substitute, 10-05 개천절 substitute, 10-09 한글날, 12-25, 12-31 KRX
   year-end close). Verified by independently recomputing weekday-of-year for every gazetted date
   from the `2026-01-01 = Thursday` anchor (confirmed via the "observed" 2026-08-17/03-02/05-05
   entries, which are all internally consistent) — every substitute-holiday assignment checked out
   against Korean substitute-holiday rules. Boundary logic (`date > HORIZON` string comparison)
   correctly treats the horizon date itself as still-covered (holiday lookup wins), confirmed both
   by trace and by a dedicated test (`지평선 안쪽 마지막 날짜는 경고 없이 정상 처리된다`).

2. **`/[symbol]/overall` `generateMetadata`** had no degrade gate for "healthy asset, but no AI
   analysis cached yet" (distinct from the `degraded=true` infra-failure case `getBlockedSymbolMetadata`
   already handled) — cold-ISR KR pages went `index,follow` while the body rendered a placeholder.
   Fix adds `if (!hasOverallProse(snap?.content)) { peek cache; if empty → NOINDEX }`, mirroring
   the body's exact fallback condition. Verified: the peek call uses `staticSymbolCache` with
   identical `unstable_cache` keyParts to the body's own peek call, so it's a genuine cache hit
   within the same request, not a duplicate fetch; peek failures `.catch()` to `null` (never throw
   inside `generateMetadata`); ordering with `getBlockedSymbolMetadata` is safe (degraded case
   returns early before this gate runs). A companion 8th file
   (`src/app/[symbol]/__tests__/symbol-metadata.test.ts`, not in the initial uncommitted diff —
   see [[feedback-check-untracked-files]] class of gap, caught via `git diff base --name-only`
   showing 8 files vs 7 in `git status`) adds a module-level `getSeoSnapshotsStatic` mock fixture
   so its canonical-URL regression tests don't fall into the new noindex path; verified this
   doesn't silently defeat its degraded-noindex assertions because `evaluateSymbolIndexability` is
   separately mocked in that file to ignore `hasSnapshot` and gate on `degraded` alone.

   Test mutations (b)/(c) in `page.test.ts`'s `generateMetadata` describe (the "peek MISS" and
   "peek HIT" indexable-preserved cases) initially looked decorative in a truncated read — see
   [[feedback-read-tool-silent-line-loss]] — but a corrected read showed both carry
   `expect(mockPeekOverall).not.toHaveBeenCalled()` / `toHaveBeenCalledTimes(1)` assertions that
   are genuinely regression-sensitive to the short-circuit and gate-removal mutations respectively,
   even though the final `metadata.robots` value alone would pass against pre-fix code. Judged: not
   decoration, keep as-is.

   Comment-only fixes: `marketSessionDate.ts` JSDoc no longer claims "KRX has no calendar";
   `assetClassification.ts` module header no longer lists `Trust` in heuristic #4 (code already
   excluded it, per the REIT-misclassification reasoning already documented in `FUND_NAME_SUFFIX_WORDS`).

Independently re-ran gates rather than trusting the reported summary: `yarn typecheck` (clean),
`yarn lint` (clean), `oxfmt --check` on all 8 changed files (all formatted), and scoped
`yarn test` across all 8 files (195 + 31 = 226 tests, all green) — including the symbol-metadata
file the author's own gate summary (129 files/1,580 tests) would have covered but wasn't singled
out in the round-4 narrative.
