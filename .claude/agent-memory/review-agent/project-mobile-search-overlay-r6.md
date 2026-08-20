---
name: project-mobile-search-overlay-r6
description: feat/mobile-search-overlay R6 (5-audit fix pass) — 3 required findings, all live-reproduced not theorized: dead eslint-disable, missing onChange reset lets unrequested navigation fire, stale pushedRef via popstate mid-pending-navigation causes wrong history.back()
metadata:
  type: project
---

Round 6 reviewed the audit-fix pass (product/React/a11y/SEO/test-falsifiability, 5 parallel
Opus audits). Gate/body split in SearchOverlay.tsx is correct (zero hooks in the outer gate,
`SearchOverlayBody` unmounts fully when closed — no hooks-order risk). Focus was the
deferred-submit state machine and the new `dismissForNavigation(): boolean` history contract.

**Finding 1 — dead `eslint-disable-next-line react-hooks/exhaustive-deps`.** In
`SearchOverlay.tsx`'s deferred-submit effect, removing the disable comment and running
`npx oxlint` on the file directly produces `EXIT:0` — the suppression does nothing. The
sibling effect in `useAutocomplete.ts` (same `Ref.current(...)` pattern, same deps array) has
no disable comment and needs none, confirming refs don't require exhaustive-deps coverage here.
Doubly wrong per [[project-eslint-disable-line-mismatch]] class of finding: CONVENTIONS.md/
MISTAKES.md #13 forbid `eslint-disable` outright regardless, so this is required either way.

**Finding 2 — missing `setIsSubmitRequested(false)` in `SearchOverlay.tsx`'s input `onChange`
lets navigation fire that the user never requested.** `useAutocomplete.ts`'s `handleChange`
explicitly resets the pending-submit flag on every keystroke with a JSDoc explaining exactly
why ("계속 타이핑하면 앞서 남긴 검색 의도는 무효다 — 그대로 두면 새 질의가 결착되는 순간
사용자가 요청하지 않은 이동이 일어난다"). `SearchOverlay.tsx`'s `onChange={e =>
setQuery(e.target.value)}` does not carry the same reset — the two "same rule, shared via
`resolveSubmitTarget`" call sites diverged. Reproduced live: press Enter on `appl` before
debounce settles (`isSubmitRequested=true`), then clear the field and type `tsla` *without*
pressing Enter again, then let debounce settle for `tsla` — `onNavigate` fires with `TSLA`.
Scratch test at `src/features/ticker-search/__tests__/scratch_SearchOverlay_bug.test.tsx`
(deleted after confirming failure) reproduced this in one shot.

**Finding 3 — `dismissForNavigation()` leaves `pushedRef` stale when a `popstate` interrupts a
still-pending `router.replace`, causing a wrong extra `history.back()` on the next close.**
`dismissForNavigation()` intentionally does NOT reset `pushedRef` (by design, to let a
reopen-during-pending-nav reuse the entry — this part is correct and tested). But the
`popstate` handler gates on `if (!isOpen) return`, and `dismissForNavigation()` already set
`isOpen=false` synchronously before `router.replace` resolves. So a hardware-back/swipe
`popstate` arriving in that 2-3s async window (LAX RTT, per this file's own docs) is silently
ignored — `pushedRef` is never cleared even though the browser just popped our entry. Because
`router.replace('/${symbol}')` was targeting the *current* URL (unchanged, since the pushed
history-marker entry never changes the URL string — see `useSearchOverlay.ts`'s "왜 히스토리를
쓰는가" JSDoc), `usePathname()` never fires again either, so the `[pathname]` effect that would
otherwise self-heal `pushedRef` never runs. Net effect: the next `open()` skips `pushState`
(believes an entry still exists), and the next `close()` calls `history.back()` against an
entry that's already gone, sending the user one page further back than intended. Reproduced
live with a scratch `useSearchOverlay.test.tsx` addition: `open() → dismissForNavigation() →
dispatch popstate → open()` — `pushState` call count stays at 1 (expected 2). This is a fresh
gap in this round's *new* `dismissForNavigation` boolean-contract logic, not a regression of
prior rounds' fixes — the author's own comment considers "reopen during pending nav" but not
"popstate during pending nav" as a distinct interrupting case.

**Method note for future rounds on this file:** both Finding 2 and Finding 3 were confirmed by
writing throwaway scratch test files (using the same mock/harness patterns as the real test
files), running them with `yarn test --run`, observing the failure, then deleting the scratch
file and confirming `git status` shows no stray files. Do this before flagging a state-machine
"could navigate/could skip navigate" claim in this feature — the deferred-submit + history
machinery here is subtle enough that reading alone risks both false positives and false
negatives (see [[project-mobile-search-overlay-r4]]'s vacuous-test precedent, same file family).
