---
name: project-mobile-search-overlay-r3
description: feat/mobile-search-overlay R3 — design reversal removed pending-nav UI entirely (fixes all 3 R2 findings), but dismissForNavigation/onNavigate has zero test coverage and JSDoc overclaims the HistoryUpdater race is fully eliminated
metadata:
  type: project
---

R3 replaced R1/R2's `useTransition`/`isNavigating`/`canClose`/`navTargetRef`
mechanism entirely with `dismissForNavigation()` (clears `pushedRef`/`triggerRef`
without touching history, closes overlay synchronously before `router.replace()`
fires). Verified via grep across all 4 modified files: zero occurrences of
`useTransition`, `isNavigating`, `navTargetRef`, `canClose` remain (only one
JSDoc mention of the old design for context). This genuinely fixes all three
R2 required findings — no more pending window means no WCAG 2.1.2 trap, no
`popstate`-bypasses-guard race (there's no guard left to bypass), no vacuous
test (the test itself was deleted).

**Two required findings in R3, both mutation-verified live:**

1. **`onNavigate`/`dismissForNavigation` has zero test coverage anywhere.**
   Round summary claimed 3 new tests including one asserting "onNavigate called,
   onClose NOT called" — none of these exist verbatim in
   `SearchOverlay.test.tsx`; grepped `onNavigateMock` — only ever passed as a
   prop / cleared in `beforeEach`, never asserted against. Also grepped
   `dismissForNavigation` in `useSearchOverlay.test.tsx` — zero hits. Mutation
   test (edit → run → revert, confirmed clean via `diff`): deleting the
   `onNavigate()` call from the different-symbol branch of `handleSelect`
   (SearchOverlay.tsx ~L127) — all 13 tests green. Adding a stray `onNavigate()`
   call to the same-symbol branch (~L124) — all 13 tests still green. The
   entire redesign's safety argument rests on `onNavigate` being called on
   exactly one branch; that branching is completely unguarded by tests.

2. **JSDoc overclaims "셋 다 사라진다" (all three problems disappear).**
   Verified against the actual Next 16.2.12 source in this worktree
   (`node_modules/next/dist/client/components/app-router.js` L38-67,
   `HistoryUpdater`): `router.replace()`'s `window.history.replaceState` is NOT
   synchronous — it fires inside a `useInsertionEffect` only once the RSC fetch
   resolves, and mutates whatever is the browser's *then-current* top history
   entry, not the entry current when `.replace()` was called (matches
   [[reference-nextjs-router-replace-history-race]], now confirmed live against
   this exact Next version rather than trusted from memory). Because native
   hardware back / iOS edge-swipe is uninterceptable by JS (same fact as R2
   finding #1), it can still fire during the window between
   `onNavigate()`+`router.replace()` and the fetch resolving — the late
   `replaceState` then silently completes the navigation onto whatever page the
   user backed into, even though they tried to cancel. This is the same
   underlying consequence as R2's bug #3, just no longer visible as a "stuck
   modal" (the modal is already gone, so the user has no on-screen cue anything
   is in flight — arguably harder to diagnose than the old trap). The orchestrator's
   own round summary describes an accurate qualifier ("residual race identical
   to any router.replace elsewhere in the app, not something this modal
   introduces") but that sentence does not actually appear anywhere in the
   shipped code (grepped both files) — only the stronger, inaccurate "disappears
   entirely" claim ships. Flagged as required per MISTAKES.md 15.6 (inaccurate
   WHY comment is worse than none) — this is a documentation-only fix, not a
   demand to solve an unfixable Next.js quirk; hardware back cannot be guarded
   by any component-level code, so no functional fix exists or should be
   requested.

**Confirmed correct, not flagged:**
- Same-symbol path (`onClose()` → `history.back()`): single, correctly-scoped
  unwind. `history.back()` pops the entry we pushed (same URL as current, since
  no `url` arg was passed to `pushState` per the hook's own JSDoc), landing back
  on the pre-existing entry with an identical URL — `usePathname()` doesn't
  change, so the hook's `[pathname]` effect does not refire and double-unwind.
- "Stare at old page during LAX RTT" is not flagged as a UX regression:
  `src/app/[symbol]/loading.tsx` exists, so Next's Suspense boundary shows a
  loading fallback during the transition rather than a frozen blank/old page;
  matches the JSDoc's claim that this behaves like any other link navigation
  in the app.
- No layer-dependency, hook-ordering, or import violations found across the 4
  files.

Mutation-test method: `cp` the file to scratchpad before editing, `sed -i ''`
to apply the mutation, `yarn vitest run <file>`, then `cp` the backup back and
`diff` to confirm a byte-identical restore before finishing.
