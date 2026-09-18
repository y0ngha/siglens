---
name: project-seo-cls-sitemap-polish-r2-e2e-fallback-gap
description: fix/seo-cls-sitemap-polish R2 — pwa-trigger removal verified clean in src/, but e2e/specs/pwa-install.spec.ts still depends on the deleted PWA_BANNER_FALLBACK_DELAY_MS fallback timer
metadata:
  type: project
---

Round 2 of `fix/seo-cls-sitemap-polish` (worktree `siglens-wt-polish`) removed the entire
`siglens:pwa-trigger` analysis-complete trigger from `usePwaInstall.ts`/`ChartContent.tsx`
(deleted `shared/lib/pwaEvents.ts` + test) to fix a CLS regression — banner now shows only on
first `pointerdown`/`keydown`. Verified clean: zero dangling `pwaEvents`/`PWA_TRIGGER_EVENT`
references anywhere in `src/`, both ChartContent test files have no lingering
`vi.mock('@/shared/lib/pwaEvents', …)`.

**Missed by both rounds**: `e2e/specs/pwa-install.spec.ts` (0 diff vs origin/master, never
touched by this PR) opens with a comment block asserting the banner "auto-shows via a short
fallback timer (`PWA_BANNER_FALLBACK_DELAY_MS`) so no synthetic event is needed," then does
`page.goto('/')` → `expect(installButton).toBeVisible()` with **no simulated tap at all**.
`PWA_BANNER_FALLBACK_DELAY_MS` (a `setTimeout(100ms)` fallback that used to co-exist with the
trigger event on `origin/master`) was removed as part of this PR's core CLS fix — confirmed via
`git show origin/master:src/features/pwa-install/hooks/usePwaInstall.ts`, which still has
`timerRef` + the exported constant; the working tree has neither. Grepping the repo confirms
zero remaining definitions of that constant, only this one stale comment reference.

**Why it wasn't caught**: `yarn typecheck` passes (comment, not code), `oxlint` doesn't parse
prose, and the "scoped tests" gate is Vitest — Playwright specs are never in that scope.
Nothing in the normal fix-round gate touches `e2e/`.

**Verdict**: flagged as REQUIRED in R2 despite the file being outside the round's
`modified_files` list — the round's own key question ("any dangling reference?") points
straight at it, and `.github/workflows/e2e.yml` runs the `webkit` project (which is where this
spec's `@webkit` test lives) in CI, so this is a real, verifiable CI break, not speculative.

See [[feedback-file-can-change-mid-review]] for the mtime-check method used to confirm no file
was edited mid-session before finalizing.
