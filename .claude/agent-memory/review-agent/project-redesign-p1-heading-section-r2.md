---
name: project-redesign-p1-heading-section-r2
description: redesign/p1-dark-tokens R2 — HEADING_SECTION rollout to 4 shared shells, approved; R2 CTA-h2 fix also approved
metadata:
  type: project
---

Round 2 of `redesign/p1-dark-tokens` fixed R1's one recommended finding (hardcoded h2 literal
instead of `HEADING_SECTION` in `SnapshotSummarySection.tsx`) and, while doing so, swept the same
colorless-heading bug (`text-lg font-semibold tracking-tight` with no color class, inheriting
`body { color: var(--color-secondary-50) }` from `src/app/globals.css`) into 3 more shared shells:
`OverallFactualFallback.tsx`, `AiSummaryErrorSection.tsx`, `AiSummarySkeleton.tsx`.

**Non-obvious finding while reviewing:** the diff for all 4 files also silently carried an
unrelated-looking `rounded-xl` → `rounded-lg` change that the round-2 summary text never
mentioned. Initially looked like undisclosed scope creep. Turned out to be a legitimate,
self-consistent "FIX 4" design-token unification (67-site dominant pattern vs. 5-site minority) —
confirmed by: (1) the JSDoc in `SnapshotSummarySection.tsx` itself was updated in the same diff
hunk to say `rounded-lg` instead of `rounded-xl`, (2) an existing regression test
(`SnapshotSummarySection.test.tsx` "제품 우세 카드 셸 패턴을 사용한다(FIX 4)") already asserts
`rounded-lg`, not `rounded-xl`, (3) `grep -rl rounded-xl src` after the change returns zero hits
outside `surfaceStyles.ts` (an unrelated token). Lesson: when a diff for an in-scope file contains
more than what the round summary claims, check the file's own comments/tests before flagging it as
undisclosed — a coordinated, documented, test-covered change across all touched shells is not a
defect even if the human's changelog undersold it.

Verified this round: `cn('mb-2', HEADING_SECTION)` / `cn('mb-4', HEADING_SECTION)` drop nothing
under twMerge (spot-checked live with node — margin-bottom never conflicts with font-size/weight/
tracking/color utility groups). All 4 imports are standalone top-level lines, not inside an existing
multi-line `import { ... }` block. `shared/ui` importing `shared/lib` is the explicitly-allowed
same-layer exception. `tsc --noEmit` and `oxlint` both clean on these 4 files; 37/37 tests across
the 4 corresponding test files pass live. Approved, round 2, zero findings.

**R2 second finding (separate sub-round on `OverallTriggerCta.tsx`):** R1 flagged the CTA h2 at
`text-2xl` tying with the page h1 (24px, only ~1.07:1 colour delta — imperceptible). Fix accepted
was the full override removal: `cn(HEADING_SECTION, 'text-balance')` → 18px, same as the other 12
h2 on `/[symbol]/overall`. Rejected `text-xl` alternative (would've been a 3rd h2 size on the same
route, reintroducing the drift this wave removes). Re-verified: `HEADING_SECTION` and `cn` both
used (no unused import), no new size/colour tie with the card's subtitle (`text-sm
text-secondary-400`), button label (`text-sm`/`text-secondary-50`|`text-white`), or disabled hint
(`text-xs text-secondary-500`) — every other text node in the card is a different size and/or
color. `secondary-100` (#ecedf0) on `secondary-800` (#101014) bg is high-contrast, same token as
the dominant h2 pattern elsewhere. 6/6 component tests pass, tsc clean. Approved, zero findings.
