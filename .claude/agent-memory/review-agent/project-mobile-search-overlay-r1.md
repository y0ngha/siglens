---
name: project-mobile-search-overlay-r1
description: feat/mobile-search-overlay R1 — cancel/Escape-during-navigation history race found in SearchOverlay's navTargetRef close logic; missing tests for the same fragile branch; hook ordering violation
metadata:
  type: project
---

`feat/mobile-search-overlay` replaces the mobile header's 104px-wide inline
autocomplete (unusable, truncated to `KOSPI 005…`) with an icon trigger +
full-screen overlay. Five prior Opus audits already fixed focus-restore,
aria-label mismatch, bogus `role="listbox"`, stuck-open-on-reselect, and
restored the Enter-to-ticker path. Round 1 of `review-agent` focused on the
one piece of logic explicitly flagged as previously buggy: `SearchOverlay.tsx`'s
`navTargetRef` effect (closes the overlay only when a triggered navigation's
`pathname` doesn't match the target — an earlier version closed on every
transition-end and `close()`'s `history.back()` undid successful navigations).

**Found**: the `navTargetRef` effect itself is correct for the case it
explicitly handles (success vs. failure of *the navigation it's tracking*).
But the explicit close paths (Escape via `useEscapeKey(onClose, isOpen)`, and
the 취소 button's `onClick={onClose}`) are **not gated on `isNavigating`** —
see [[reference-nextjs-router-replace-history-race]] for the confirmed
mechanism: cancelling while a `router.replace()` transition is still in
flight can let the delayed `history.replaceState` (fired once the RSC fetch
resolves) land on the entry the user backed out to, silently teleporting them
to the target symbol after they thought they'd cancelled — the same bug
class this file was written to fix, reached via an unaudited trigger.

Also flagged: zero test coverage for the navTargetRef effect's success/failure
branching itself (despite being called "most delicate...wrong once already"
in the review prompt — testable today since `usePathname` is statically
mocked and never advances, which already simulates the failure branch, but no
test asserts on it), and a hook/handler declaration-order violation (custom
hooks + a `useRef` + two event handlers all declared after `useEffect` calls,
MISTAKES.md #17).

Not yet observed whether the orchestrator's round-2 fix addresses the
cancel-during-navigation race by disabling the close affordance while
`isNavigating`, or another approach — check on next round if this branch
recurs.
