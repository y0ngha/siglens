---
name: crypto-assetclass-session-threading
description: Crypto epic — assetClass + core MarketSessionSpec threading patterns and review hotspots
metadata:
  type: project
---

Crypto epic (Plan 3) threads `assetClass` ('equity'|'crypto') and core `MarketSessionSpec` through analysis/chat/bars.

Key facts:
- `resolveAssetClass(symbol)` (entities/ticker/lib) = authoritative: getAssetInfo → marketProfileOf → getDescriptor().assetClass; defaults 'equity' for null/legacy.
- `sessionSpecFor(profileId)` (shared/api/market) maps MarketProfileId → core US_EQUITY_SESSION | CRYPTO_SESSION. Takes a **MarketProfileId**, not AssetClass.
- `getCachedMarketDataProvider(session)` keeps TWO singletons (`cached`, `cachedCrypto`) dispatched by **reference equality** on CRYPTO_SESSION (both module-level core constants). Singleton-separation test exists.
- Equity is the default path everywhere (session defaults to US_EQUITY_SESSION) → equity behavior unchanged when session arg omitted.

**Why:** crypto trades 24/7 (always-open) vs equity ET session; affects bars Redis TTL via `computeBarsEffectiveTtl(tf, now, session)` and SSR quantize via `isRegularSessionOpen(session, now)`.

**How to apply (review hotspots for this epic):**
- Recurring smell: action call sites write `sessionSpecFor(assetClass === 'crypto' ? 'crypto' : 'us-equity')` — a lossy assetClass→profileId round-trip duplicated 3x (getBarsAction, submitAnalysisAction, submitOverallAnalysisAction). page.tsx uses the clean `sessionSpecFor(marketProfile)` directly. Prefer resolving profileId once.
- 4 equity-only tab guards (fundamental/financials/congress/options) repeat identical 5-line `getDescriptor(profileIdForGuard).tabs.includes('<tab>')` notFound block → extract helper candidate.
- When the interim Plan-2 `alwaysOpen` boolean + `CRYPTO_BARS_TTL_SECONDS` were removed, a stale JSDoc lingered in CachedMarketDataProvider.test.ts — watch for removed-symbol comment drift (MISTAKES §15.6).

Post-audit hardening branch (fix/crypto-postaudit-hardening) recurring hotspots:
- ISR cold-gen wrappers: `getAssetInfoStatic`/`getBarsStatic` wrap `'use server'` ACTIONS to firewall the client-bundle chain; the new `isCryptoSymbolStatic` wraps a plain server-only lib (`isCryptoSymbol`/cryptoAssetStore, which imports `@/shared/db/client`). Its JSDoc claiming `isCryptoSymbol` is "used inside client-side contexts indirectly" is FALSE — cryptoAssetStore is server-only. `entities/ticker/index.ts` barrel deliberately does NOT re-export api.ts (server-only); only app pages + api.ts import isTabAllowedForSymbol/isCryptoSymbolStatic.
- Session-threading tests: layout.test.tsx mocks `quantizeBarsDataToLastClosed` dropping the 3rd `session` arg and asserts only 2 args → the crypto-vs-equity session-spec wiring (the whole point of the change) goes UNTESTED (MISTAKES Tests #16). Same risk wherever a quantize mock ignores session.
- seo.ts crypto/equity fear-greed DESCRIPTIONS now share one helper (buildSymbolFearGreedDescription) — not byte-dup literals; fine (FG metric asset-neutral). titles/keywords differ.

Post-audit-hardening audit results (fix/crypto-postaudit-hardening, 2026-06):
- FIXED since prior round: lossy assetClass→profileId ternary (all 3 actions now resolveMarketProfile→sessionSpecFor(profile) directly via resolveAssetClass.ts resolveMarketProfile); 4x tab-guard dup (now single-line isTabAllowedForSymbol in entities/ticker/api.ts); layout.test.tsx now captures 3rd session arg + CRYPTO/US_EQUITY assertions; isCryptoSymbolStatic JSDoc no longer makes false client-context claim.
- RESOLVED (round 4, HEAD 130b82fe): options/page.tsx generateMetadata now has isTabAllowedForSymbol('options') guard (L65-67) → crypto options metadata returns NOINDEX, matching body hard-404. Other 3 guard pages (fundamental/financials/congress) correctly DON'T need it: crypto has no FMP profile → getProfileResilient returns profile===null → NOINDEX early-return. Options was the exception because it gates on hasOptions (Yahoo path), not profile. Asymmetry is intentional/correct.
- RESOLVED (round 4): src/app/api/sitemap/crypto/route.ts comment (L36-42) + buildCryptoPopularEntries JSDoc now accurately describe quantized lastmod (6h boundary for chart/fear-greed/overall, 1h-ago rolling for news). No longer copy-pasted false "sliding now" claim.
- Round 4 = CLEAN/approved. Whole branch audited: sessionSpecFor takes MarketProfileId (lossy ternary gone, exhaustive switch+never guard), layout/fear-greed thread session arg, layout.test captures 3rd arg w/ CRYPTO vs US_EQUITY assertions, isCryptoSymbolStatic JSDoc accurate, ticker barrel firewalls api.ts, useChat assetClass test falsifiable (arg index 8).
