---
name: prompt-precision-currency-r2-currency-thread-gap
description: siglens-core fix/prompt-precision-currency R2 — core-side resolution correct, but siglens consumer doesn't actually thread currency yet
metadata:
  type: project
---

R1 findings 1-2 (legacy overloads always USD, never symbol-derived) were resolved with a
documented intentional contract (JSDoc + tests) — correct and approved on the core side.

But R2 asked "name a concrete consumer that would break" and one exists: in the sibling
**siglens** repo (not siglens-core), neither `src/entities/chat-message/actions/chatAction.ts`
(`requestChatCompletion` call) nor `src/entities/news-article/actions/submitNewsAnalysisAction.ts`
(`runNewsAnalysis` call) pass the new optional `currency` field — both derive `assetClass` via
`resolveAssetClass(symbol)` → `getDescriptor(profile).assetClass`, discarding the
`.priceFormat.currency` sitting right next to it (`currencyForSymbol(symbol)` helper already
exists in `src/shared/config/marketProfile/registry.ts` for exactly this). Result: once this
core version is adopted, KRX-symbol chat/news will silently render "U.S. equity" framing
instead of "Korean equity" — a real regression from the v1.0.2 symbol-derived behavior, contrary
to the round-1 resolution's claim that "the only consumer already passes it."

This is a cross-repo integration gap, not a defect in the core PR's own files — treated as a
required finding anyway per the reviewer's explicit brief. Also confirmed via mutation testing
that the new `confluenceSection.test.ts` "no floor" regression test is real (reintroducing a
full-bar-range floor via edit correctly turned it red: 13.33 → 10.00), not vacuous.

**How to apply:** when a core PR's resolution claims "the only consumer already does X", verify
against the actual consumer's current source in the sibling repo (grep the real call site), not
just the PR's own tests/JSDoc — resolutions can be true-in-core and false-in-practice
simultaneously. See [[feedback-cross-repo-resolution-claims-need-consumer-check]].
