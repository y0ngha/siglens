---
name: project-seo-cls-sitemap-polish-r4-pwa-settle-closed
description: fix/seo-cls-sitemap-polish R4 — settlePwaBanner helper verified correct across 5 files; APPROVED, closes the pointerdown-race loop opened in R3
metadata:
  type: project
---

Round 4 of `fix/seo-cls-sitemap-polish` (worktree `siglens-wt-polish`) added a shared
`e2e/support/pwaBanner.ts::settlePwaBanner(page)` to fix R3's finding (PWA banner mounting
on a spec's own first `.tap()`/`.click()` pointerdown, shifting the in-flow header 3rem
mid-gesture). Applied to `header-mobile-nav.spec.ts`, `mobile-input-reachability.spec.ts`,
`mobile-analysis-sheet.spec.ts`, `symbol-tabs.spec.ts`. Verified correct and approved — no
findings.

**Two reusable immunity patterns found while auditing the "deliberately not patched" claims**
(useful for any future first-input-vs-layout-shift race in this repo):
1. **Fixed-position target** — `symbol-chat.spec.ts`'s first input clicks
   `FloatingChatButton`, which is `fixed right-4 bottom-[...]` (verified in
   `src/widgets/chat/FloatingChatButton.tsx`). A banner mounting in-flow at the page top
   cannot move a `fixed` element's screen coordinates, so no settle helper is needed —
   check `className` for `fixed` before assuming a race exists.
2. **Synthetic event decoupling** — `notice-popup.spec.ts`'s `gotoAndReveal()` calls
   `page.evaluate(() => window.dispatchEvent(new Event('pointerdown')))` instead of a
   coordinate-based Playwright action. This is the SAME event both `useDeferredReveal`
   (notice reveal) and `usePwaInstall` (banner trigger) listen for, so it settles the banner
   as a side effect — but because it's a JS-dispatched event with no target coordinate, there
   is no gesture in flight to disrupt; the later `.click()` on "닫기" re-queries a fresh
   bounding box (the modal is also `fixed inset-x-0 bottom-0 z-9999`, doubly safe).

**`test.info()` cross-module verification method**: the helper imports `test` from
`@playwright/test` while specs import an extended `test` from `../support/fixtures`
(`base.extend(...)`). Confirmed via reading `node_modules/playwright/lib/globals.js` that
`currentTestInfo()` is a single module-level `let` variable set by the worker runner —
identical whichever module path resolved `test`, since `@playwright/test` →
`playwright/test` → the same `lib/globals.js` instance (Node module cache). No divergence
risk; safe pattern for any other repo helper that needs `test.info()` outside a spec file.

Independently re-ran all 3 claimed-clean gates rather than trusting the round's report:
`npx tsc --noEmit` clean, `npx oxlint e2e` clean, `npx playwright test --list` → 235/48
(matches). Enumerated every `@webkit`-tagged file + the sole `authed-mobile` file
(`mobile-input-reachability.spec.ts`) independently via grep against `playwright.config.ts`'s
actual project regexes (not the round's prose list) — 7 files total, all accounted for,
no unlisted file left with an in-flow-target first input in a mobile project.
