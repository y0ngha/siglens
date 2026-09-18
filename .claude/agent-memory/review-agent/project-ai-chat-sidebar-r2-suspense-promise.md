---
name: project-ai-chat-sidebar-r2-suspense-promise
description: fix/ai-chat-sidebar-ux R2 — plain-mode empty panel fix + unrecognized-action reload + suggestions-as-unawaited-Promise/use() SSR fix, all approved
metadata:
  type: project
---

R2 of fix/ai-chat-sidebar-ux, all 3 independent bug fixes verified correct, approved with zero findings.

1. `PlainAnalysisSwitch.tsx`: one-line guard `if (!showPlain || hideToggle) return;` before setting
   `document.documentElement.dataset.analysisView = 'plain'`. Root cause was real: the chart-tab SSR
   snapshot section (`hideToggle=true`) was raising the same root flag the live `AnalysisPanel`'s
   switch raises, and CSS hides `[data-snapshot-prose]` whenever that flag is set — so when the live
   widget had no narrative yet, the flag went up with nothing left to show. Fix + new test both correct.

2. `src/shared/lib/reloadOnVersionSkew.ts` (new) + wired into `providers.tsx` QueryCache/MutationCache
   `onError` + `AuthSessionHeaderClient.tsx`. Wraps real Next 16.2.12 API
   `unstable_isUnrecognizedActionError` (confirmed via `node_modules/next/dist/.../unrecognized-action-error.d.ts`
   — `(error: unknown) => error is UnrecognizedActionError`). `shared/lib` importing `next/navigation`
   is NOT an oxlint violation — `.oxlintrc.json`'s `shared/**` restriction only blocks importing upper
   FSD layers or deep-importing another slice's internal folders, not framework packages. sessionStorage
   guard (60s window) correctly prevents reload loops during mixed-version rollout; verified the
   window is anchored to the last *successful reload* time, not last attempt — matches test expectations
   exactly. `retry: (failureCount, error) => !isVersionSkewError(error) && failureCount < 1` preserves
   the old `retry: 1` behavior for ordinary errors while skipping the pointless retry for a build
   mismatch. `providers.test.tsx` mocks QueryCache/MutationCache as empty classes so it never actually
   exercises the onError wiring — low-value gap, not flagged (the reload logic itself is thoroughly
   unit-tested in isolation, and the wiring is a one-line pass-through).

3. `src/app/ai/[locale]/page.tsx` + `EmptyState.tsx` + `ChatShell.tsx`: suggestions promise now created
   unawaited (`loadSuggestions(...).catch(() => null)`, no `await`) and passed as a raw `Promise` prop
   from a Server Component down through `ChatShell` ('use client') to `EmptyState`, resolved via
   `use()` inside `<Suspense fallback={<SuggestionCardsSkeleton>}>`. This is valid Next 16 RSC pattern
   (promise-as-client-prop). `EmptyState`/`PendingSuggestionCards` have no own `'use client'` directive
   but don't need one — they're only ever imported through `ChatShell.tsx`, which already has the
   directive, so they're client-bundled transitively; verified via grep that nothing outside
   `agent-chat` imports `EmptyState` directly. `[locale]/loading.tsx` deletion verified matches the
   stated bug (removed the `ChatSkeleton` fallback that hid the whole page body from non-JS crawlers)
   and `c/[id]/loading.tsx` was confirmed still present (kept intentionally per task description, not
   an inconsistent leftover).

See also [[feedback-cross-repo-resolution-claims-need-consumer-check]] for the general verify-before-trust
pattern used here (confirmed the Next API signature actually exists before trusting the implementer's claim).
