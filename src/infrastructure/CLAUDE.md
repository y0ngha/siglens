# Infrastructure Layer Rules

## Core Principle

Handles communication with external systems (Alpaca API, AI Providers).
Define interfaces (`types.ts`) **before** implementation.

> **Note:** Email (shared/email, entities/email-token) and Skills (entities/skill) have been
> migrated out of infrastructure in Phase 2.

**Dependency:** `→ see docs/ARCHITECTURE.md` for full layer dependency rules.

---

## Function Rules

- Always use `export function` (named function declaration)
- No `export default` or arrow function exports
- Classes allowed only for special cases (e.g., Providers)

---

## Module Structure

### market/ (Alpaca API)

`→ see docs/API.md` for full Alpaca API spec.

### ai/ (AI Provider)

- Supports multiple AI providers (Claude, Gemini, etc.)
- Interchangeable via common interface (`AIProvider`)
- Provider selected by `AI_PROVIDER` env var (`createAIProvider()` in factory.ts)

### market/barsApi.ts

- Fetches bars from Alpaca, then calls domain indicator functions
- `infrastructure → domain` import is allowed by dependency rules
- Used by `getBarsAction.ts` Server Action

### cache/ (Redis Cache Provider)

- `types.ts` — `CacheProvider` interface (`get`, `set`, `delete`)
- `config.ts` — `ANALYSIS_CACHE_TTL` (per-timeframe TTL constants) + `buildAnalysisCacheKey()`
- `redis.ts` — `createCacheProvider()` factory using Upstash Redis
  - Returns `null` when env vars are missing (graceful degradation)
  - Reads with readonly token if `UPSTASH_REDIS_REST_READONLY_TOKEN` is set; falls back to master token
  - Write operations always use master token (`UPSTASH_REDIS_REST_TOKEN`)
- Used by `analyzeAction.ts` for AI analysis result caching
