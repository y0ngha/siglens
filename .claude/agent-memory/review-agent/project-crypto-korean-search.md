---
name: crypto-korean-search-review
description: feat/crypto-korean-search review — crypto Korean-name search mirroring stock/economy patterns; seed-script testability hotspot
metadata:
  type: project
---

feat/crypto-korean-search (crypto epic follow-on): typing a Korean coin name (비트코→BTCUSD) returns crypto results, mirroring stock korean_tickers search + economy indicator-translation seed.

Parts:
- api.ts DrizzleCryptoAssetRepository.search: added `ilike(cryptoAssets.koreanName, like)` to existing or(). searchCryptoAssets lowercases query but lowercase is a no-op on Hangul → Korean ilike works.
- searchTicker.ts Korean branch: Promise.all([searchByKoreanName, searchCryptoAssets]) → deduplicateResults (stock-first) → slice(MAX_SEARCH_RESULTS=10). Early-returns before non-Korean path; no double-fetch. Sound.
- scripts/seed-crypto-korean-names.ts: NEW, mirrors seedIndicatorTranslationsBatch.ts (poll/chunk/resilience) + seed-crypto-assets upsert.

Focus#1 placeholder-name SAFE: processResponses upserts `name: v.symbol` placeholder, but every symbol came FROM crypto_assets WHERE korean_name IS NULL (SELECT then UPSERT), so PK pre-exists → onConflictDoUpdate takes UPDATE path (sets only korean_name+updatedAt, never name). Placeholder cannot leak into a new row barring concurrent DELETE between SELECT/UPSERT (acceptable for one-off seed, documented).

**Review hotspots (recurring testability gap):**
- seed-crypto-korean-names.test.ts REDEFINES extractKoreanName locally (MISTAKES Tests#13.5) instead of importing — because the script runs `run()` unconditionally at module top (no `if (require.main === module)` guard) + logic in non-exported fns. Tests are tautological vs production. processResponses bulk-upsert + placeholder path have ZERO real coverage (MISTAKES Coding#22). **Project precedent contradicts this**: scripts/validate-skills.ts exports validateSkillData + guards entry → validate-skills.test.ts imports & tests it directly. Fix = same pattern (export extract logic, guard run()).
- searchTicker.korean-crypto.test.ts cap test uses toBeLessThanOrEqual(10) — imprecise matcher (MISTAKES Tests#13); count is deterministic (7 stock+6 crypto unique → 10) so should be toBe(10).
- api.test.ts korean_name ilike test only asserts where() called once (can't introspect Drizzle SQL) — weak but acknowledged in comment; acceptable given unit-test limits.
