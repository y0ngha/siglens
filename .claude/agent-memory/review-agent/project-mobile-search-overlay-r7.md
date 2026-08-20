---
name: project-mobile-search-overlay-r7
description: feat/mobile-search-overlay R7 — APPROVED. All 3 R6 findings (dead eslint-disable, onChange missing isSubmitRequested reset, stale pushedRef via popstate mid-pending-nav) verified fixed via live mutation testing, zero new findings
metadata:
  type: project
---

Round 7 reviewed only the 4 files touched by the R6 fix pass. All three R6 findings
(see [[project-mobile-search-overlay-r6]]) were re-verified live, not just read:

1. **Dead eslint-disable** — confirmed absent from `SearchOverlay.tsx`; `npx oxlint` on
   both changed files exits 0.
2. **onChange missing `setIsSubmitRequested(false)`** — reverted the reset line via a
   scratch mutation, reran `SearchOverlay.test.tsx -t 무효`; the new test
   ("계속 타이핑하면 보류해 둔 검색 의도가 무효가 된다") failed with
   `onNavigateMock` called with `["TSLA"]` when it shouldn't have been — real fix,
   falsifiable test.
3. **Stale `pushedRef` via popstate during `dismissForNavigation`'s pending window** —
   reverted `handlePopState` to the pre-fix order (`if (!isOpen) return` before
   `pushedRef.current = false`), reran `useSearchOverlay.test.tsx`; the new test
   ("이동 대기 중 뒤로가기가 들어오면 항목 추적을 정리한다") failed
   (`pushState` called 1 time instead of 2) — real fix, falsifiable test.

All three source files were restored via `diff` against pre-mutation backups after each
check; `git status --short` showed only the expected `??` (this branch's files are all
untracked/new — normal for this feature, not a scratch-file leak).

No new findings. Approved, closing the review loop for this feature at round 7.

**Method reinforcement**: continuing the R6 "live mutation, not read-only inspection"
practice for this file family paid off again — both fixes could have been eyeballed as
"looks right" but the actual falsifiability of the *tests* (not just the fix) needed the
revert-rerun-restore cycle to confirm. Recommend this remains the standard method for any
future round touching `SearchOverlay.tsx` / `useSearchOverlay.ts`.
