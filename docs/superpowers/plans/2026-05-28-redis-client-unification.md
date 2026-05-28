# Redis Client Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize all Upstash Redis client construction (currently duplicated across 5 entity files) into one `shared/cache/redisClient.ts` module, with the 5 consumers importing it.

**Architecture:** New `shared/cache/redisClient.ts` reads `UPSTASH_REDIS_REST_*` env once and exposes `getRedisClient(): Redis | null` (singleton writer, null when unconfigured) and `getRedisReaderWriter(): { writer, reader } | null` (readonly-token aware, shares the writer instance). Each consumer drops its local env-read + `new Redis(...)` and imports from the shared module; all domain logic (keys, TTLs, store interfaces, graceful-null handling) is unchanged.

**Tech Stack:** TypeScript, `@upstash/redis`, vitest, Next.js (FSD layers). Spec: `docs/superpowers/specs/2026-05-28-redis-client-unification-design.md`. Worktree: `/Users/y0ngha/Project/siglens-redis-unification` (branch `refactor/redis-client-unification`).

**Working directory for all tasks:** `/Users/y0ngha/Project/siglens-redis-unification`. Commands: `yarn test <path>`, `yarn typecheck`, `yarn lint`, `yarn build`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/shared/cache/redisClient.ts` | **create** | The single Upstash Redis client factory (writer singleton + reader/writer pair) |
| `src/shared/cache/__tests__/redisClient.test.ts` | **create** | Unit tests for the factory |
| `src/entities/options-chain/lib/optionsDataCache.ts` | modify | use `getRedisClient()` |
| `src/entities/news-article/lib/newsRefreshFlag.ts` | modify | use `getRedisClient()` |
| `src/entities/bars/lib/barsDataCache.ts` | modify | use `getRedisClient()` |
| `src/entities/oauth-account/lib/pendingOAuthSignupStore.ts` | modify | use `getRedisClient()` |
| `src/entities/email-token/api.ts` | modify | use `getRedisReaderWriter()` + delegate reset |

**Test note (applies to every consumer task):** The existing consumer tests mock `@upstash/redis` (the `Redis` class) and control `process.env.UPSTASH_REDIS_REST_*`, often via `vi.resetModules()` + dynamic import (e.g. `optionsDataCache.test.ts`'s `loadWithEnv`). After migration, the consumer calls `getRedisClient()` from the shared module, which still does `new Redis(...)` against the mocked class reading the same env. `vi.resetModules()` resets the shared module's singleton too. **So these tests should pass unchanged.** Run each consumer's existing test after the source edit; only if a test directly asserted the local `getRedis` internals (it should not) adapt it minimally. Do NOT weaken assertions.

---

## Task 1: Create the shared Redis client module

**Files:**
- Create: `src/shared/cache/redisClient.ts`
- Create: `src/shared/cache/__tests__/redisClient.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/shared/cache/__tests__/redisClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedisConstructor } = vi.hoisted(() => ({
    mockRedisConstructor: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (opts: unknown) {
        mockRedisConstructor(opts);
        return { __opts: opts };
    }),
}));

import {
    getRedisClient,
    getRedisReaderWriter,
    __resetRedisClientForTests,
} from '@/shared/cache/redisClient';

const URL = 'https://test.upstash.io';
const TOKEN = 'writer-token';
const RO = 'readonly-token';

beforeEach(() => {
    __resetRedisClientForTests();
    mockRedisConstructor.mockClear();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
});

describe('getRedisClient', () => {
    it('env 미설정 시 null을 반환하고 Redis를 생성하지 않는다', () => {
        expect(getRedisClient()).toBeNull();
        expect(mockRedisConstructor).not.toHaveBeenCalled();
    });

    it('env 설정 시 반복 호출이 동일 인스턴스를 반환한다(싱글톤)', () => {
        process.env.UPSTASH_REDIS_REST_URL = URL;
        process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
        const a = getRedisClient();
        const b = getRedisClient();
        expect(a).not.toBeNull();
        expect(a).toBe(b);
        expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
        expect(mockRedisConstructor).toHaveBeenCalledWith({ url: URL, token: TOKEN });
    });
});

describe('getRedisReaderWriter', () => {
    it('env 미설정 시 null', () => {
        expect(getRedisReaderWriter()).toBeNull();
    });

    it('readonly token 미설정 시 reader === writer 이고 writer === getRedisClient()', () => {
        process.env.UPSTASH_REDIS_REST_URL = URL;
        process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
        const pair = getRedisReaderWriter();
        expect(pair).not.toBeNull();
        expect(pair!.reader).toBe(pair!.writer);
        expect(pair!.writer).toBe(getRedisClient());
        expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
    });

    it('readonly token 설정 시 reader는 별도 인스턴스(readonly 토큰)', () => {
        process.env.UPSTASH_REDIS_REST_URL = URL;
        process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
        process.env.UPSTASH_REDIS_REST_READONLY_TOKEN = RO;
        const pair = getRedisReaderWriter();
        expect(pair!.reader).not.toBe(pair!.writer);
        expect(pair!.writer).toBe(getRedisClient());
        expect(mockRedisConstructor).toHaveBeenCalledTimes(2);
        expect(mockRedisConstructor).toHaveBeenNthCalledWith(1, { url: URL, token: TOKEN });
        expect(mockRedisConstructor).toHaveBeenNthCalledWith(2, { url: URL, token: RO });
    });

    it('빈 문자열 readonly token은 미설정으로 취급한다(reader === writer)', () => {
        process.env.UPSTASH_REDIS_REST_URL = URL;
        process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
        process.env.UPSTASH_REDIS_REST_READONLY_TOKEN = '';
        const pair = getRedisReaderWriter();
        expect(pair!.reader).toBe(pair!.writer);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/shared/cache/__tests__/redisClient.test.ts`
Expected: FAIL — module `@/shared/cache/redisClient` does not exist.

- [ ] **Step 3: Implement `src/shared/cache/redisClient.ts`**

```ts
import { Redis } from '@upstash/redis';

interface UpstashEnv {
    url: string;
    token: string;
    /** Read-only token; null when the env var is unset or empty (no separate reader created). */
    readonlyToken: string | null;
}

// undefined = not yet initialized; null = env not configured (graceful fallback).
let cachedWriter: Redis | null | undefined;
let cachedReader: Redis | null | undefined;

function readUpstashEnv(): UpstashEnv | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    // Treat empty string as "unset" so a literal empty env var doesn't create a reader.
    const raw = process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
    const readonlyToken = raw === undefined || raw === '' ? null : raw;
    return { url, token, readonlyToken };
}

/**
 * The app's shared Upstash Redis writer client (singleton).
 *
 * Returns `null` when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are
 * not set, so callers can degrade gracefully (cache miss / direct fetch) in
 * environments without Redis (local dev, tests).
 */
export function getRedisClient(): Redis | null {
    if (cachedWriter !== undefined) return cachedWriter;
    const env = readUpstashEnv();
    cachedWriter = env ? new Redis({ url: env.url, token: env.token }) : null;
    return cachedWriter;
}

/**
 * Writer + reader pair (singleton). When `UPSTASH_REDIS_REST_READONLY_TOKEN` is
 * set, `reader` uses the read-only token; otherwise `reader === writer`. The
 * `writer` is the same instance returned by {@link getRedisClient}. Returns
 * `null` when Redis env is not configured.
 */
export function getRedisReaderWriter(): { writer: Redis; reader: Redis } | null {
    const writer = getRedisClient();
    if (writer === null) return null;
    if (cachedReader === undefined) {
        // writer is non-null here, so readUpstashEnv() is also non-null.
        const env = readUpstashEnv()!;
        cachedReader =
            env.readonlyToken !== null
                ? new Redis({ url: env.url, token: env.readonlyToken })
                : writer;
    }
    return { writer, reader: cachedReader };
}

/** @internal Reset the cached singletons between test runs. */
export function __resetRedisClientForTests(): void {
    cachedWriter = undefined;
    cachedReader = undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/shared/cache/__tests__/redisClient.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `yarn typecheck`
Expected: exit 0 (the new module compiles; consumers not yet changed).

- [ ] **Step 6: Commit**

```bash
git add src/shared/cache/redisClient.ts src/shared/cache/__tests__/redisClient.test.ts
git commit -m "feat: add shared Upstash Redis client (getRedisClient + getRedisReaderWriter)"
```

## Task 2: Migrate `optionsDataCache.ts`

**Files:**
- Modify: `src/entities/options-chain/lib/optionsDataCache.ts`
- Test: `src/entities/options-chain/__tests__/optionsDataCache.test.ts`

- [ ] **Step 1: Replace the local `getRedis` with the shared client**

In `src/entities/options-chain/lib/optionsDataCache.ts`:
- Remove `import { Redis } from '@upstash/redis';` (line 3).
- Add `import { getRedisClient } from '@/shared/cache/redisClient';` (with the other imports).
- Delete the `// tokenStore.ts / ... lazy-singleton 패턴.` comment, the `let cachedRedis: ...` declaration, and the entire `function getRedis(): Redis | null { ... }` block (lines ~41-55).
- In `hasOptionsMarket` and `fetchOptionsSnapshot`, replace each `const redis = getRedis();` with `const redis = getRedisClient();` (2 call sites).

- [ ] **Step 2: Run the existing test**

Run: `yarn test src/entities/options-chain/__tests__/optionsDataCache.test.ts`
Expected: PASS unchanged. (`loadWithEnv` uses `vi.resetModules()` + dynamic import, which resets the shared singleton; `@upstash/redis` is mocked; `mockRedisConstructor` is still invoked through `getRedisClient`.) If a case fails purely because it asserted the old local-singleton timing, adjust the test's reset to also call `__resetRedisClientForTests` from `@/shared/cache/redisClient` — but first confirm whether `vi.resetModules()` already covers it (it should).

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/entities/options-chain/lib/optionsDataCache.ts
git commit -m "refactor: use shared getRedisClient in optionsDataCache"
```

## Task 3: Migrate `newsRefreshFlag.ts`

**Files:**
- Modify: `src/entities/news-article/lib/newsRefreshFlag.ts`
- Test: `src/entities/news-article/__tests__/newsRefreshFlag.test.ts`

- [ ] **Step 1: Replace the local `getRedis`**

In `src/entities/news-article/lib/newsRefreshFlag.ts`:
- Remove `import { Redis } from '@upstash/redis';` (line 2).
- Add `import { getRedisClient } from '@/shared/cache/redisClient';`.
- Delete `let cachedRedis: Redis | null | undefined;` and the `function getRedis(): Redis | null { ... }` block (lines ~8-19).
- In `isRecentlyFetched` and `markFetched`, replace `const redis = getRedis();` with `const redis = getRedisClient();` (2 sites).

- [ ] **Step 2: Run the existing test**

Run: `yarn test src/entities/news-article/__tests__/newsRefreshFlag.test.ts`
Expected: PASS unchanged (same reasoning as Task 2). If the test resets via module reload, it already covers the shared singleton; otherwise add `__resetRedisClientForTests()` in its `beforeEach`.

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/entities/news-article/lib/newsRefreshFlag.ts
git commit -m "refactor: use shared getRedisClient in newsRefreshFlag"
```

## Task 4: Migrate `barsDataCache.ts`

**Files:**
- Modify: `src/entities/bars/lib/barsDataCache.ts`
- Test: `src/entities/bars/__tests__/barsDataCache.test.ts`

- [ ] **Step 1: Replace the local `getRedis`**

In `src/entities/bars/lib/barsDataCache.ts`:
- Remove `import { Redis } from '@upstash/redis';` (line 3).
- Add `import { getRedisClient } from '@/shared/cache/redisClient';`.
- Delete the `// Redis 미설정 환경 ... lazy 초기화로 지연한다.` comment, `let cachedRedis: ...`, and the `function getRedis(): Redis | null { ... }` block (lines ~12-25).
- In `getCachedBarsWithIndicators`, replace `const redis = getRedis();` with `const redis = getRedisClient();` (1 site, ~line 57).
- Leave the `MarketDataProvider` / `fetchBarsWithIndicators` / TTL logic untouched.

- [ ] **Step 2: Run the existing test**

Run: `yarn test src/entities/bars/__tests__/barsDataCache.test.ts`
Expected: PASS unchanged.

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/entities/bars/lib/barsDataCache.ts
git commit -m "refactor: use shared getRedisClient in barsDataCache"
```

## Task 5: Migrate `pendingOAuthSignupStore.ts`

**Files:**
- Modify: `src/entities/oauth-account/lib/pendingOAuthSignupStore.ts`
- Test: `src/entities/oauth-account/__tests__/lib/pendingOAuthSignupStore.test.ts`

- [ ] **Step 1: Use the shared client in the env factory**

In `src/entities/oauth-account/lib/pendingOAuthSignupStore.ts`:
- Remove `import { Redis } from '@upstash/redis';` (line 2) **only if** `Redis` is not referenced elsewhere in the file. NOTE: `createPendingOAuthSignupStore(client: Redis)` (the injection entrypoint) uses the `Redis` type in its signature — if so, change that import to a type-only import: `import type { Redis } from '@upstash/redis';`.
- Add `import { getRedisClient } from '@/shared/cache/redisClient';`.
- Replace the body of `createPendingOAuthSignupStoreFromEnv()` (lines ~76-82):
```ts
export function createPendingOAuthSignupStoreFromEnv(): PendingOAuthSignupStore | null {
    const client = getRedisClient();
    if (client === null) return null;
    return createPendingOAuthSignupStore(client);
}
```
- Leave `createPendingOAuthSignupStore(client: Redis)` and the store interface unchanged.

- [ ] **Step 2: Run the existing test**

Run: `yarn test src/entities/oauth-account/__tests__/lib/pendingOAuthSignupStore.test.ts`
Expected: PASS. The store tests inject a fake client into `createPendingOAuthSignupStore` directly; the `FromEnv` test controls env + mocks `@upstash/redis`. If the `FromEnv` test relied on `new Redis` per call, it now goes through the shared singleton — assertions on the returned store still hold; if it asserted constructor-call counts across env toggles, add `__resetRedisClientForTests()` between toggles.

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/entities/oauth-account/lib/pendingOAuthSignupStore.ts
git commit -m "refactor: use shared getRedisClient in pendingOAuthSignupStore"
```

## Task 6: Migrate `email-token/api.ts` (reader/writer)

**Files:**
- Modify: `src/entities/email-token/api.ts`
- Test: `src/entities/email-token/__tests__/api.test.ts`

- [ ] **Step 1: Replace the local pair logic with the shared reader/writer**

In `src/entities/email-token/api.ts`:
- Remove `import { Redis } from '@upstash/redis';` (line 1).
- Add `import { getRedisReaderWriter, __resetRedisClientForTests } from '@/shared/cache/redisClient';`.
- Delete the `UpstashConfig` interface (lines ~41-46), the `RedisPair` interface (~48-51), the `cachedRedisPair` / `cachedConfigKey` vars (~53-54), `readUpstashConfig()` (~56-66), and `getRedisPair()` (~82-102).
- Change `__resetEmailTokenStoreCacheForTests` to delegate to the shared reset (keep the exported name — the test imports it):
```ts
/** Test-only reset of the cached Redis client. Delegates to the shared module. */
export function __resetEmailTokenStoreCacheForTests(): void {
    __resetRedisClientForTests();
}
```
- Change `createEmailTokenStore()` to use the shared pair:
```ts
export function createEmailTokenStore(): EmailTokenStore | null {
    const pair = getRedisReaderWriter();
    if (pair === null) return null;
    const { writer, reader } = pair;

    return {
        // ...existing set/get/delete/consume bodies unchanged
    };
}
```
Keep `EmailTokenStore`, `EmailTokenPurpose`, `EmailTokenValue`, `KEY_PREFIX`, `buildEmailTokenKey`, and the `set/get/delete/consume` method bodies exactly as they are.

- [ ] **Step 2: Run the existing test**

Run: `yarn test src/entities/email-token/__tests__/api.test.ts`
Expected: PASS. The test mocks `@upstash/redis` and calls `__resetEmailTokenStoreCacheForTests()` (which now resets the shared singleton). The writer/reader split behavior is preserved by `getRedisReaderWriter`. If the test set `UPSTASH_REDIS_REST_READONLY_TOKEN` to assert reader-token usage, those assertions still hold (the shared module reads the same var). Adjust only if a test reached into the deleted `readUpstashConfig`/`getRedisPair` internals directly (it should only use the public `createEmailTokenStore` + env + the reset).

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/entities/email-token/api.ts
git commit -m "refactor: use shared getRedisReaderWriter in email-token store"
```

## Task 7: Full verification

- [ ] **Step 1: Confirm no stray local Redis construction remains**

Run: `git grep -n "new Redis(" src` and `git grep -n "from '@upstash/redis'" src`
Expected: the ONLY `new Redis(` is in `src/shared/cache/redisClient.ts`. The ONLY runtime `import { Redis }` is in `redisClient.ts`; any other `@upstash/redis` import is `import type { Redis }` (e.g. pendingOAuthSignupStore's signature). No consumer reads `process.env.UPSTASH_REDIS_REST_*` directly anymore: `git grep -n "UPSTASH_REDIS_REST" src` should match only `redisClient.ts` (+ test files).

- [ ] **Step 2: Typecheck, lint, full test, build**

Run: `yarn typecheck && yarn lint && yarn test && yarn build`
Expected: all PASS. (`build` runs `next build`; if `DATABASE_URL`/secrets are absent in the environment, run `yarn build:local` instead, or skip the build step and rely on typecheck+test — note this to the user.)

- [ ] **Step 3: Commit (if any verification fixups)**

```bash
git add -A
git commit -m "chore: redis client unification verification fixups"
```

---

## Self-Review

**Spec coverage:**
- Spec §3 (shared module API: getRedisClient + getRedisReaderWriter + __resetRedisClientForTests, null fallback, writer sharing) → Task 1. Spec §4 migrations (5 consumers) → Tasks 2–6 (options/news/bars/oauth/email respectively). Spec §6 tests (new redisClient test + consumer test pass-through) → Task 1 step 1 + each consumer task step 2. Spec §5 (preserve domain logic, non-goals) → each task leaves keys/TTL/store interfaces untouched. Spec §7 (oauth singleton change, email reset delegation) → Task 5 + Task 6 step 1. No spec requirement left without a task.

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step shows the real edit; every run step gives a command + expected result. The build step names a concrete fallback (`build:local`) for the env-missing case rather than leaving it vague.

**Type/name consistency:** `getRedisClient` / `getRedisReaderWriter` / `__resetRedisClientForTests` used identically in Task 1 (definition + test) and Tasks 2–6 (consumers). `{ writer, reader }` shape consistent between Task 1 and Task 6. `__resetEmailTokenStoreCacheForTests` retained as a delegating wrapper (Task 6) so its test import keeps working. Env var names (`UPSTASH_REDIS_REST_URL`/`_TOKEN`/`_READONLY_TOKEN`) consistent across Task 1 and Task 7's grep.
