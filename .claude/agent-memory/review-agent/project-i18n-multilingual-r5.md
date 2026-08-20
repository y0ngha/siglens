---
name: project-i18n-multilingual-r5
description: feat/i18n-multilingual R5 findings (relayed by orchestrator, not independently reviewed this session) — SymbolTabs/NoticePopup/usePageContextLabel path-matching broke on locale-prefixed pathname; fixed via new useAppPathname.ts consolidation
metadata:
  type: project
---

R5 findings as relayed by the orchestrator at the start of R6 (this agent instance did not independently perform R5 — recorded here only to keep the round chain unbroken for future sessions; see [[project-i18n-multilingual-r6]] for the independently-verified follow-up).

Three more consumers of the same locale-prefix-in-path-comparison bug class (started [[project-i18n-multilingual-r1]] finding #5, continued through R2-R4): `SymbolTabs.tsx` (tab href exact-match), `NoticePopup.tsx` (`notices.path_pattern` matching), `usePageContextLabel.ts` (`derivePageContextLabel`'s anchored `^/SYMBOL(/sub)?$` regex) all fed raw locale-prefixed `usePathname()` into logic expecting bare paths — silently disabling active-tab highlighting, path-scoped notices, and chat page-context label for en/ja/zh.

Fix: new `src/shared/i18n/useAppPathname.ts` (locale-stripped pathname, JSDoc states comparison-vs-navigation rule) applied to those 3 plus `HeaderNav.tsx`/`HeaderMobileMenu.tsx` (previously inlined `splitLocalePath(usePathname())`). New audit test `useAppPathname.test.ts` — explicit allowlist of files permitted to import raw `usePathname` directly, fails on any new unlisted consumer. Also fixed `usePageContextLabel.test.ts`'s mock, which reimplemented the anchored regex as a more-lenient `.includes()`, structurally masking the bug (same class as R4's `resolvePostSignupDestination` mock-reimplements-the-bug finding).
