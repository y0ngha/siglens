---
name: project-overall-hasoptions-audit-fix-seo
description: audit/fix-seo — OverallView.hasOptions recurred 2 rounds; round 3 made it required + still had a fail-open fallback and a 3rd independent tabs-derivation; round 4 fixed both, approved
metadata:
  type: project
---

Branch `audit/fix-seo` (SEO audit, base commit `3a7e0ed8`). Root defect: `OverallView`
rendered an empty "옵션 시장" (Options market) section for kr-equity symbols because
`assetClass` alone (equity/crypto binary) can't distinguish kr-equity (no options tab)
from us-equity (has options tab) — see `KR_EQUITY_DESCRIPTOR.tabs` vs `US_EQUITY_DESCRIPTOR.tabs`
in `src/shared/config/marketProfile/`.

**Round 1**: fixed `OverallContent` → `OverallView` call site (page.tsx derives
`hasOptions = getDescriptor(marketProfile).tabs.includes('options')`), left `OverallView.hasOptions`
optional with a `true` default "for callers without marketProfile info."

**Round 2** (this reviewer's prior round): found the *default* itself was the bug — a second
call site (`kindPanelRegistry.tsx`'s `overall` panel, used by `/share/[id]`) silently absorbed
the `true` default and re-showed the phantom section for kr-equity shares.

**Round 3**: made `OverallView.hasOptions` required (compile-time enforcement — no more silent
absorption), and had `kindPanelRegistry.tsx` derive it via `!isKrEquitySymbol(symbol ?? '')`.
Verified sound overall (mutation test: hardcoding `hasOptions={true}` at the registry causes
exactly 1 test to fail, the kr-equity case). But two residual concerns raised in review:

1. The `symbol ?? ''` fallback still resolves to `hasOptions: true` when `symbol` is absent
   (`isKrEquitySymbol('')` is false → `!false` = true) — the *same* fail-open direction that
   caused rounds 1 and 2. Currently unreachable (the sole production caller, `app/share/[id]/page.tsx`,
   always passes `symbol`), but the test explicitly labels this "safe default" when it's actually
   the unsafe direction relative to the whole point of the fix. [[rules-conventions]]
2. This makes a **third** independent derivation of "does this market have an options tab" in
   the codebase: `overall/page.tsx:341` and `OverallFactualFallback.tsx:30` both use
   `getDescriptor(marketProfile).tabs.includes('options')` (the canonical registry source of
   truth), while `kindPanelRegistry.tsx` uses a standalone `isKrEquitySymbol` heuristic. They
   agree today only because exactly 2 equity profiles exist (kr/us) and `isKrEquitySymbol`
   exhaustively partitions them — matches the MISTAKES.md §6.6 "duplicated capability claim,
   no single source of truth" and §0.9 "non-exhaustive binary check over a 3-member domain"
   shape, even though it's currently gated safely by `isEquity &&` for the crypto case.

**Round 4 (approved, only a recommended finding)**: both round-3 concerns genuinely fixed —
1. `symbol ?? ''` replaced with `symbol !== undefined && getDescriptor(profileIdForSymbol(symbol)).tabs.includes('options')`
   — absent symbol now correctly yields `false`. Test flipped and comment now states the real
   asymmetry ("hiding is cheaper when the fact is unknown").
2. New `profileIdForSymbol(symbol)` in `registry.ts` centralizes the `isKrEquitySymbol(s) ? 'kr-equity' : DEFAULT_MARKET_PROFILE`
   ternary (used to be duplicated inline in `currencyForSymbol` and about to be duplicated a 3rd
   time in the registry). `currencyForSymbol` now calls it — confirmed byte-identical behavior
   (same ternary, just extracted), tests unchanged and still pass. The registry's `overall` entry
   now also routes through it (`getDescriptor(profileIdForSymbol(symbol)).tabs.includes('options')`)
   instead of calling `isKrEquitySymbol` directly.
   Its JSDoc explicitly warns it can't resolve crypto (falls to us-equity) and must not be used
   where us-equity/crypto values diverge — verified true for `tabs` (`CRYPTO_DESCRIPTOR.tabs` has
   no `'options'`, `US_EQUITY_DESCRIPTOR.tabs` does), but the registry call site is safe anyway
   because `OverallView` ANDs `hasOptions` with `isEquity` (`isEquity && hasOptions`), so a
   crypto-symbol misclassification never surfaces. `overall/page.tsx`/`OverallFactualFallback`
   still derive the profile id via `marketProfileOf(assetInfo)` (has the real `AssetInfo`, so
   correctly resolves crypto) rather than `profileIdForSymbol` — this is a legitimate, documented
   difference (share panel only has a symbol string, no `AssetInfo`), not a reintroduction of the
   3rd-derivation problem: the `getDescriptor(...).tabs.includes('options')` check itself is now
   the single shared mechanism; only the profile-id *input* differs by necessity.

Only finding this round: `ShareKindPanel.test.tsx`'s describe-block comment (~line 178) still says
the registry derives `hasOptions` "via `isKrEquitySymbol`" — stale, the implementation deliberately
routes through `profileIdForSymbol` + `getDescriptor(...).tabs` instead (that's the whole point of
fix #2 above). MISTAKES.md §15.6 (comments must match code reality) pattern — recommended, not
required, since it's test-only prose with no functional effect. [[rules-mistakes-comments]]

**How to apply**: this branch's `hasOptions` defect chain is now closed (3 rounds fixing the same
root cause: don't fail-open an unknown options-tab fact to `true`). If this exact shape
(`getDescriptor(...).tabs.includes(...)`, `profileIdForSymbol`) shows up being reimplemented
independently elsewhere later, that's the recurring MISTAKES.md §6.6 pattern again.
