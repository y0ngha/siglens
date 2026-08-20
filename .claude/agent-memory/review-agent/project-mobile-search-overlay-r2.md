---
name: project-mobile-search-overlay-r2
description: feat/mobile-search-overlay R2 — canClose fix only closes JS-mediated escape/cancel path; native popstate (Android back/iOS swipe) and unbounded isNavigating remain unaddressed; one new test is vacuous (Tests #20)
metadata:
  type: project
---

R1's `canClose = !isNavigating` fix (gates `useEscapeKey` + disables 취소) correctly
closes the JS-mediated race: `onClose()` → `history.back()` racing a still-in-flight
`router.replace()`'s delayed `HistoryUpdater.replaceState`. R2 re-scrutinized whether
this actually closes the race class or just narrows the trigger surface. It narrows it.

**Two unaddressed triggers of the identical mechanism, both required in R2:**

1. **`popstate` bypasses `canClose` entirely.** Android hardware back / iOS edge-swipe
   fire a native `popstate` — no `onClose()` call, so `canClose`/`disabled` never enter
   the picture. `useSearchOverlay.ts`'s `handlePopState` (feature-agnostic by design —
   "검색 로직은 전혀 모른다") has zero awareness of `isNavigating`/`navTargetRef` living in
   `SearchOverlay.tsx`. When the browser back-navigates mid-flight, the entry the user
   backed out to is exactly the "whatever is current when the late replaceState lands"
   entry the file's own JSDoc warns about — see [[reference-nextjs-router-replace-history-race]].
   No code path currently threads pending-navigation state into the popstate handler to
   self-correct (e.g., re-`router.replace()` back to the pre-interrupt pathname once the
   stale transition settles).

2. **No ceiling on `isNavigating`.** The failure-detection effect (`SearchOverlay.tsx`
   ~L116-124) is the *only* escape once `canClose` goes false, and it is gated on
   `isNavigating` transitioning to `false`. If the RSC fetch stalls/hangs with no
   timeout (no `AbortSignal.timeout` anywhere in this chain — Next's router.replace
   inside `startTransition` keeps `isPending` true for the real network round-trip, not
   just local state), `isNavigating` can stay `true` indefinitely: Escape is gated off,
   취소 stays `disabled`, and the only rescue effect never runs → full-screen modal
   keyboard trap, WCAG 2.1.2. No fallback timer exists.

**Vacuous test found (matches MISTAKES.md Tests #20 verbatim):** `'이동 중에는 취소가
비활성화된다'` (SearchOverlay.test.tsx ~L156) never asserts `.toBeDisabled()`, never
clicks 취소, and never checks `onClose`/`history.back()` wasn't invoked — it only
re-checks `replaceMock` was called (already covered by the sibling replace test) and
that the cancel button exists in the DOM. The in-file comment admits transitions
resolve synchronously in this test env and explicitly chooses not to assert disabled
state as a workaround — but then doesn't substitute a real assertion for the claim
either. Reverting the entire `canClose`/`disabled` fix would still leave this test
green. Rename or rewrite (e.g. control `replaceMock` to return a pending/never-resolving
promise to keep `isNavigating` true long enough to assert `toBeDisabled()`, or assert
`onClose`/`history.back` was never called across a cancel-click during the window).

**Confirmed correct, not flagged:** `DIRECT_TICKER_RE` (`^[A-Z0-9][A-Z0-9.-]{0,11}$`)
checked against the repo's actual canonical shapes in `shared/config/ticker.ts`
(`TICKER_RE`, `SYMBOL_EDGE_RE`, `KR_SYMBOL_RE`) and live fixture data
(`shared/config/crypto-categories.ts`, `dashboard-tickers.ts`) — accepts `AAPL`,
`BRK.B`, `005930.KS` (9 chars, fits the 12-char cap), `BTCUSD`, `1000SATSUSD` (11
chars); rejects anything containing `/` (path traversal) since the regex is a full
anchored match. No gaps found. Hook-ordering exception also confirmed correct: `const
canClose` sits between the data-hooks group and `useEscapeKey`/`useFocusTrap` — matches
MISTAKES.md #17's documented "derived const between hooks OK when custom hook is last
and consumes it" exemption, not a violation. `useFocusTrap`'s `FOCUSABLE_SELECTOR` uses
`button:not([disabled])`, so the disabled 취소 button creates no Tab-trap dead end
(native HTML disabled semantics already remove it from tab order).
