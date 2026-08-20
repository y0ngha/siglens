---
name: project-mobile-search-overlay-r4
description: feat/mobile-search-overlay R4 — R3's two findings (missing onNavigate tests, JSDoc overclaim) verified fixed correctly via live mutation testing; new vacuous test found, same root cause as R2's flagged test but a different instance
metadata:
  type: project
---

R3 found that a prior "fix" round claimed to add 3 tests via string-replacement but the
edit silently no-opped (test count was reported off, not re-verified). R4's fix edited
the file directly. Both R3 findings independently re-verified live in this round:

**Fix 1 (missing tests) — confirmed real.** `이동할 때는 onClose가 아니라 onNavigate로 닫는다`
and `보던 종목을 다시 고르면 이동 없이 닫는다` both exist and both fail for the right reason
when mutated: deleting `onNavigate()` from the different-symbol branch fails the first
(`onNavigateMock` called 0 times, expected 1); adding a stray `onNavigate()` to the
same-symbol branch fails the second (`onNavigateMock` called 1 time, expected 0). Both
are assertion failures, not crashes. File restored to original after each mutation and
confirmed identical via diff.

**Fix 2 (JSDoc) — confirmed accurate against dist.** The corrected `## 남아 있는 것`
section's core technical claim (`router.replace`'s `history.replaceState` fires inside
`HistoryUpdater`'s `useInsertionEffect`, after the RSC response resolves, on whatever is
the browser's then-current top-of-history entry — not the entry current when `.replace()`
was called) was re-checked against `node_modules/next/dist/client/components/app-router.js`
`HistoryUpdater` directly in this worktree and matches exactly (same mechanism as
[[reference-nextjs-router-replace-history-race]]). The framing that this is a property of
every `router.replace()` call in the app (not something the overlay introduces) is accurate
— `HistoryUpdater` is a single global mechanism, not specific to this component. No
overcorrection or new wrong claim found.

**New required finding — vacuous test, same class as R2's Tests #20 flag, different
instance.** `선택 후에도 닫기 컨트롤이 비활성화되지 않는다` (asserts
`toBeEnabled()` after a select+click) cannot fail under the actual regression it names.
Verified by reintroducing the literal historical bug — `useTransition` +
`disabled={isNavigating}` on the 취소 button, `router.replace` wrapped in `startTransition`
— and rerunning the suite: all 15 tests, including this one, stayed green. Root cause:
`userEvent.click` awaits internally, and in the jsdom test env a `useTransition` started
by a synchronous mock resolves within that same await, so `isNavigating` is already back
to `false` before the assertion runs — this is the exact mechanism the R2-flagged test's
own in-file comment admitted ("transitions resolve synchronously in this test env").
MISTAKES.md #13 (non-falsifiable assertions) applies directly. Doubly vacuous today since
current `SearchOverlay.tsx` has zero code path that ever sets `disabled` on this button at
all — nothing CAN disable it right now, so the test is also trivially true for an
unrelated reason. Recommended the author either drop it, or make it falsifiable by having
`replaceMock` return a pending/never-resolving promise and asserting `toBeEnabled()`
synchronously without awaiting flush.

**Takeaway for future overlay/dialog PRs in this repo:** "does nothing currently disable
button X" claims made via `toBeEnabled()`/`not.toBeDisabled()` regression guards need a
mutation check before landing — the jsdom + userEvent.click combo tends to flush pending
React transitions started by mocked async functions within the same await, which silently
defeats "still enabled during pending state" assertions. This is now the second occurrence
in this exact file ([[project-mobile-search-overlay-r2]] was the first, opposite polarity).
