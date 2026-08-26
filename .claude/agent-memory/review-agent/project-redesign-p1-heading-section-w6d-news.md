---
name: project-redesign-p1-heading-section-w6d-news
description: redesign/p1-dark-tokens W6d (/[symbol]/news heading unification) R1 — found colorless h3 the sweep missed in an already-touched file
metadata:
  type: project
---

W6d unified 8 `<h2>` sites on `/[symbol]/news` to `HEADING_SECTION` (across
`page.tsx`, `NewsFactsSummary.tsx`, `NewsAiSummary.tsx`, `AnalystActions.tsx`,
`EventCalendar.tsx`, `NewsList.tsx`) and the `NewsCardShell.tsx` article h3 to
`HEADING_SUBSECTION` (preserving the sec-100→sec-200 dimming from an earlier
fix so the card headline stays one step below its own h2). h4 sub-labels
(본문/요약) went `font-semibold`→`font-medium` in `NewsList.tsx` +
`MarketNewsCard.tsx` so they no longer outweigh the h3 above them.

**R1 finding (required):** `NewsAiSummary.tsx:136` and `:160` — two `<h3
className="mb-2 text-sm font-semibold">` (핵심 이벤트 / 다가오는 주요 일정)
have no color class. They inherit `body { color: var(--color-secondary-50)
}` (`src/app/globals.css:456`), the brightest tier — brighter than their own
sibling h2 ("뉴스 AI 종합 분석", now correctly `HEADING_SECTION` =
`text-secondary-100`) two lines above in the same file. This is the *exact*
bug class this whole wave targets (colorless `font-semibold` heading
silently inheriting body's brightest color), on the audited route, inside a
file the diff was already editing for its own h2 sites. Contrast itself
does NOT fail AA (inheriting the brightest color always passes contrast —
the defect is hierarchy inversion, not contrast), so an automated
contrast-sweep claim of "0 failures across N elements" does not catch this
class of bug. Sibling `MarketNewsDigest.tsx:83,109` (different route,
untouched by this diff) uses the identical `text-sm font-semibold` h3
pattern but correctly keeps `text-secondary-100` — proof this is a missed
site, not an unstyled-by-design convention.

Verified clean otherwise: `twMerge` drops nothing across all 4 `cn(...)`
compositions touched (`cn('mb-2', HEADING_SECTION)`, `cn('mb-3',
HEADING_SECTION)`, `cn(HEADING_SUBSECTION, 'leading-snug text-balance
wrap-break-word', pending && 'opacity-80')` both pending states) — spot
checked live with `node -e` against the repo's installed
`tailwind-merge@3.5.0`. 8/8 h2 sites in the 8 modified files correctly use
the token; no test asserts `font-semibold` on the 본문/요약 h4 labels (grep
found none); `yarn test --run` on the 8 files' test suites = 324/324 green;
`tsc --noEmit` and scoped `oxlint` both clean. FSD: all new imports are
`shared/lib/typographyStyles` + `shared/lib/cn`, importable from every
layer — no violation.

Lesson: when a wave's own bug-report ("colorless font-semibold heading")
appears at a DIFFERENT heading level (h3, not h2) inside a file the diff is
already touching, grep the whole touched file for the same raw pattern
(`font-semibold` / `font-medium` with no adjacent `text-secondary-*` or
token) rather than trusting the PR description's site count.
