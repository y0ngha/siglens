> ⚠️ **정정(2026-08-21): 아래 서술은 틀렸다.** Next 16.2.12는 `popstate`를 `ACTION_RESTORE`로
> 처리하면서 진행 중인 내비게이션을 `discarded`로 표시하고(`app-router-instance.js`), 폐기된
> 액션은 `setState`에 도달하지 않아 `HistoryUpdater`도 실행되지 않는다. 즉 응답 대기 중
> 뒤로 가도 늦게 온 응답이 그 자리를 덮지 않는다. 원문은 `HistoryUpdater`만 보고 액션 큐의
> discard 의미론을 확인하지 않은 결과다. **이 경합을 근거로 대기 중 닫기 가드를 되살리지 말 것.**

---
name: reference-nextjs-router-replace-history-race
description: Next.js App Router's history.replaceState for a pending router.replace() lands on whatever entry is CURRENT when the RSC fetch resolves, not the entry that was current when replace() was called — history.back() in between causes silent mis-navigation
metadata:
  type: reference
---

Source: `node_modules/next/dist/client/components/app-router.js`, `HistoryUpdater`
(`useInsertionEffect`, keyed on `appRouterState`). When `router.replace(url)` is
called, Next does NOT call `window.history.replaceState` synchronously — it fires
only later, inside this effect, once the navigation's RSC fetch resolves and the
router's internal state commits. At that point it calls
`window.history.replaceState(historyState, '', canonicalUrl)` on whatever is the
browser's *then-current* top-of-history entry — it does not remember which entry
was current at the moment `.replace()` was originally invoked.

**The race**: any UI that (a) triggers `router.replace()` wrapped in
`startTransition`, and (b) also has a same-tick-independent "close/cancel"
affordance that calls `history.back()` (e.g. dismissing a modal/overlay that
pushed a history marker on open), can produce this sequence:

1. User selects target inside overlay → `startTransition(() => router.replace('/AAPL'))` fires; RSC fetch in flight (real latency, e.g. mobile RTT).
2. User backs out via Escape/cancel before the fetch resolves → `history.back()` moves the browser to the entry *before* the overlay's marker (e.g. back to the original page).
3. The pending fetch resolves; `HistoryUpdater`'s effect fires and calls `replaceState` on whatever is now the *current* entry — i.e. the page the user just manually went back to — silently rewriting its URL/state to the target, and the visible page swaps to the target content even though the user explicitly cancelled.

`popstate` is not fired by `replaceState`, so there's no natural hook to detect
this after the fact — it must be prevented by not allowing the cancel/close path
to fire while a `router.replace`/`push` transition (`isPending` from
`useTransition`) is still in flight.

Found while reviewing [[project-mobile-search-overlay-r1]] — `SearchOverlay`'s
Escape/취소 button called `onClose` (→ `history.back()`) unconditionally,
regardless of `isNavigating`. Relevant to any future overlay/modal that combines
"push a history marker on open, `history.back()` on close" with a
`router.replace()`-triggered navigation as one of its close paths (e.g.
`HeaderMobileMenu`-style patterns) — check whether the close affordance is
disabled/guarded while a transition from that same component is pending.
