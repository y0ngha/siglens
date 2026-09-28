---
name: symbol-chat-to-ai-host-r1-share-regression
description: R1 of siglens-chat-to-ai's feat/symbol-chat-to-ai-host — hideView removal killed Share button for 5 snapshot-gated tabs
metadata:
  type: project
---

Repo: `siglens-chat-to-ai` worktree, branch `feat/symbol-chat-to-ai-host`. Spec:
`docs/superpowers/specs/2026-09-20-symbol-chat-to-ai-host-design.md`. Removes the
siglens.io symbol-page chatbot entirely; the floating button becomes a plain link to
`ai.siglens.io` (`AskAiFab`, new `src/widgets/ask-ai-fab`). Also removes the `hideView`
hidden-mount pattern from news/fundamental/financials/congress/options pages (XOR gate:
when the SEO snapshot prose is renderable, don't mount the client AI widget at all).

**R1 finding (required):** the spec's stated reason for `hideView` existing was solely
`usePublishSymbolChat` (keep chat context fresh) — but the actual widget code
(`FundamentalAiSummary`, `FinancialsAiSummary`, `CongressTrendSummary`, `NewsAiSummary`,
`OptionsAiAnalysis`) called `useRegisterShareable` **before** the `if (hideView) return
null` guard, i.e. hidden-mounted widgets still registered with
`ShareableAnalysisContext` so the header's `ShareButton` worked even while showing the
SSR snapshot prose. Fully unmounting the widget (rather than hiding it) means
`useRegisterShareable`'s cleanup fires `register(null)` on unmount and never
re-registers, so `useShareFlow` reads `status: 'unavailable'` and the Share button
silently shows the "unavailable" notice whenever the snapshot exists — which, per the
whole point of pre-warming, is the common/steady-state case. Confirmed no fallback
registers share data from the SSR snapshot itself (`ShareableAnalysisContext` has zero
other producers; grepped `useRegisterShareable` call sites). No test covers this
(snapshot-page tests don't assert share status). Affects all 5 tabs identically —
verified same `hideView`-before-registration ordering existed pre-PR in all 5 widgets,
and the same post-PR `{showXProse ? snapshot : <ErrorBoundary><Widget/></ErrorBoundary>}`
ternary in all 5 page.tsx files.

Also flagged (recommended): stale `SymbolLayoutFloatingChat` key left in an unrelated,
untouched `layout.test.tsx`'s `vi.mock('.../SymbolLayoutClient', ...)` factory — that
named export no longer exists on the real module (layout.tsx now defines its own local
`SymbolFloatingChat`). Harmless (unused mock property, not imported), but orphaned by
this PR's removal of `SymbolLayoutFloatingChat`.

Everything else in this PR was clean on read: `fallbackAnalysis` move (`entities/
chat-message` → `entities/analysis`) verified correct in all 4 locale files + all
importers repointed to the barrel + zero grep hits on the old path/key; `AskAiFab`
position/z-index/JSDoc claims (`z-60`, `SearchOverlay`'s `z-70`) verified byte-for-byte
against `git show HEAD:src/widgets/chat/FloatingChatButton.tsx`; `hashes.json`/
`manualKeys.json`/`clientKeys.json`/`skips.json` have zero leftover chat references;
`getOrCreateGuestId`, `getLlmProvider`, `FakeChatProvider`, `DisplayMessage`,
`ContextSwitchMessage`, `migrateChatModel`, `buildChatState`, `usePublishSymbolChat`,
`SymbolChatContext` all fully gone with zero residual imports; docs (ARCHITECTURE,
SCOPE, CONVENTIONS, API.md, product-marketing-context, CLAUDE.md) all updated
consistently, including a legit `GEMINI_CHAT_FREE_API_KEY` → `DEEPSEEK_CHAT_API_KEY`
correction in API.md (the former was long-dead, only ever referenced in
`docs/superpowers/plans/*` historical docs).
