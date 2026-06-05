# earnings 빈-응답 Redis 마커 (#567) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** earnings 데이터가 없는 심볼(ETF/지수/잘못된 심볼)이 매 요청 FMP를 호출하는 영구 cache-miss 루프를, 빈 응답을 Redis 마커(24h TTL)로 캐싱해 staleness window당 최대 1회 호출로 줄인다.

**Architecture:** `entities/earnings-report/api.ts`에 server-only Redis 빈-마커 헬퍼(`isEarningsKnownEmpty`/`markEarningsEmpty`)를 추가하고, `getNextEarningsReport`(api.ts)와 `getEarningsReportComparison`(newsData.ts)의 staleness 게이트에 `&& !(await isEarningsKnownEmpty(symbol))` 가드를 더한다. FMP가 빈 배열을 주면 마커를 set. 데이터 있는 심볼의 24h DB gate는 그대로(behavior 보존). Redis 미설정 시 graceful(마커 무시).

**Tech Stack:** TypeScript, Next.js, Upstash Redis(`getRedisClient`), Vitest(vi.hoisted fake redis), FSD, `@y0ngha/siglens-core`(무변경).

**Worktree:** `/Users/y0ngha/Project/siglens/.claude/worktrees/earnings-empty-marker` (브랜치 `fix/567/earnings-empty-marker`, node_modules `cp -al` 완료). 모든 경로는 이 워크트리 기준. 테스트: `yarn test <경로>`.

**Issue:** #567. **SCOPE:** earnings fetch+캐싱은 siglens 영역(core 무변경).

**커밋 정책 (이 레포 override):** task별 커밋 안 함. 전체 구현 완료 후 `review-agent(Opus 4.8) → mistake-managing-agent → git-agent` 워크플로우(ISSUE_IMPL_FLOW). 각 task는 test→fail→impl→pass까지만.

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `src/entities/earnings-report/api.ts` | 빈-마커 헬퍼 추가 + getNextEarningsReport 가드 | 수정 |
| `src/entities/earnings-report/index.ts` | 헬퍼 barrel export | 수정 |
| `src/entities/earnings-report/__tests__/earningsEmptyMarker.test.ts` | 헬퍼 단위 테스트 | 신규 |
| `src/entities/earnings-report/__tests__/getNextEarningsReport.test.ts` | 마커 케이스 추가 | 수정 |
| `src/app/[symbol]/news/newsData.ts` | getEarningsReportComparison 가드 | 수정 |
| `src/app/[symbol]/news/__tests__/newsData.test.ts` | 마커 케이스 추가 | 수정 |

---

## Task 1: 빈-마커 헬퍼 (`isEarningsKnownEmpty` / `markEarningsEmpty`)

**Files:**
- Modify: `src/entities/earnings-report/api.ts`
- Modify: `src/entities/earnings-report/index.ts`
- Test: `src/entities/earnings-report/__tests__/earningsEmptyMarker.test.ts`

- [ ] **Step 1: Write the failing test**

`src/entities/earnings-report/__tests__/earningsEmptyMarker.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EARNINGS_EMPTY_MARKER_TTL_SECONDS,
    isEarningsKnownEmpty,
    markEarningsEmpty,
} from '@/entities/earnings-report';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(async (key: string, value: unknown) => {
            store.set(key, value);
        }),
    };
    return { store, fakeRedis };
});
let redisEnabled = true;
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => (redisEnabled ? fakeRedis : null),
}));

beforeEach(() => {
    store.clear();
    redisEnabled = true;
    fakeRedis.get.mockClear();
    fakeRedis.set.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('earnings empty marker', () => {
    it('TTL 상수는 24시간(SECONDS_PER_DAY)', () => {
        expect(EARNINGS_EMPTY_MARKER_TTL_SECONDS).toBe(SECONDS_PER_DAY);
    });

    it('markEarningsEmpty는 earnings:empty:<SYM> 키를 TTL과 함께 set한다 (심볼 대문자화)', async () => {
        await markEarningsEmpty('aapl');
        expect(fakeRedis.set).toHaveBeenCalledWith('earnings:empty:AAPL', 1, {
            ex: SECONDS_PER_DAY,
        });
        expect(store.has('earnings:empty:AAPL')).toBe(true);
    });

    it('isEarningsKnownEmpty는 마커가 있으면 true, 없으면 false (심볼 대문자화)', async () => {
        expect(await isEarningsKnownEmpty('aapl')).toBe(false);
        await markEarningsEmpty('AAPL');
        expect(await isEarningsKnownEmpty('aapl')).toBe(true);
    });

    it('Redis 미설정이면 isEarningsKnownEmpty=false, markEarningsEmpty=no-op (graceful)', async () => {
        redisEnabled = false;
        expect(await isEarningsKnownEmpty('AAPL')).toBe(false);
        await markEarningsEmpty('AAPL');
        expect(store.size).toBe(0);
    });

    it('redis.get throw 시 false로 degrade', async () => {
        fakeRedis.get.mockRejectedValueOnce(new Error('redis down'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(await isEarningsKnownEmpty('AAPL')).toBe(false);
    });

    it('redis.set throw 시 조용히 무시(throw 안 함)', async () => {
        fakeRedis.set.mockRejectedValueOnce(new Error('redis down'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await expect(markEarningsEmpty('AAPL')).resolves.toBeUndefined();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/entities/earnings-report/__tests__/earningsEmptyMarker.test.ts`
Expected: FAIL — `isEarningsKnownEmpty`/`markEarningsEmpty`/`EARNINGS_EMPTY_MARKER_TTL_SECONDS` not exported.

- [ ] **Step 3: Add the helper to api.ts**

In `src/entities/earnings-report/api.ts`, add these imports near the top (after the existing imports; keep `@/` aliases before relative imports):

```ts
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getRedisClient } from '@/shared/cache/redisClient';
```

Then add the helper block right after the `EARNINGS_REPORT_FMP_LIMIT` constant (near the top of the file, before the repository class):

```ts
/**
 * 빈 earnings 응답 마커 TTL. staleness gate(24h)와 동일하게 두어 데이터 유무와 무관하게
 * 심볼당 하루 최대 1회만 FMP를 조회하도록 통일한다.
 */
export const EARNINGS_EMPTY_MARKER_TTL_SECONDS = SECONDS_PER_DAY;

function earningsEmptyMarkerKey(symbol: string): string {
    return `earnings:empty:${symbol.toUpperCase()}`;
}

/**
 * earnings 데이터가 없는 것으로 최근(TTL 내) 확인된 심볼인지 여부.
 *
 * ETF·지수·잘못된 심볼은 FMP가 빈 응답을 주어 `earningsReports` 테이블에 레코드가
 * 생기지 않는다 → `getLatestFetchedAt`이 항상 `null` → staleness가 항상 stale로 판정되어
 * 매 요청 FMP를 호출하는 영구 cache-miss 루프가 발생한다(#567). 이 마커가 있으면 TTL 동안
 * FMP 재호출을 건너뛴다. Redis 미설정/장애 시 `false`로 degrade(기존 동작대로 fetch).
 */
export async function isEarningsKnownEmpty(symbol: string): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(earningsEmptyMarkerKey(symbol))) !== null;
    } catch (error) {
        console.error('[isEarningsKnownEmpty] redis get failed:', error);
        return false;
    }
}

/**
 * 심볼을 "earnings 없음"으로 `EARNINGS_EMPTY_MARKER_TTL_SECONDS` 동안 마킹.
 * Redis 미설정/장애 시 no-op(throw하지 않음).
 */
export async function markEarningsEmpty(symbol: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(earningsEmptyMarkerKey(symbol), 1, {
            ex: EARNINGS_EMPTY_MARKER_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[markEarningsEmpty] redis set failed:', error);
    }
}
```

- [ ] **Step 4: Export from barrel**

In `src/entities/earnings-report/index.ts`, add the three new exports to the `./api` export group (alphabetical-ish, consistent with existing order):

```ts
export {
    DrizzleEarningsReportsRepository,
    EARNINGS_EMPTY_MARKER_TTL_SECONDS,
    EARNINGS_REPORT_FMP_LIMIT,
    dedupeEarningsReportInputs,
    getNextEarningsReport,
    isEarningsKnownEmpty,
    markEarningsEmpty,
    toComparisonItems,
    type EarningsReportUpsertInput,
} from './api';
```

(Keep the existing `./lib/isEarningsReportStale` export group unchanged.)

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/entities/earnings-report/__tests__/earningsEmptyMarker.test.ts`
Expected: PASS (6 tests).

---

## Task 2: `getNextEarningsReport`에 마커 가드 통합

**Files:**
- Modify: `src/entities/earnings-report/api.ts` (getNextEarningsReport)
- Test: `src/entities/earnings-report/__tests__/getNextEarningsReport.test.ts`

- [ ] **Step 1: Add failing tests**

In `src/entities/earnings-report/__tests__/getNextEarningsReport.test.ts`, the existing suite mocks `getFundamentalDataProvider` and spies `DrizzleEarningsReportsRepository.prototype`. Add a `getRedisClient` mock so the marker helpers are controllable, then add three test cases.

First, add this mock near the other `vi.mock` calls at the top of the file:

```ts
const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(async (key: string, value: unknown) => {
            store.set(key, value);
        }),
    };
    return { store, fakeRedis };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => fakeRedis,
}));
```

In the existing `beforeEach`, add `store.clear();` as the first line so markers don't leak between tests.

Then add these three `it` blocks inside the `describe('getNextEarningsReport', ...)`:

```ts
    it('빈 마커가 있으면 stale이어도 FMP를 호출하지 않는다 (cache-miss 루프 방지)', async () => {
        store.set('earnings:empty:XLK', 1); // 마커 존재
        getLatestFetchedAt.mockResolvedValue(null); // stale
        getNextForSymbol.mockResolvedValue(null);

        const result = await getNextEarningsReport('XLK', fakeDb);

        expect(result).toBeNull();
        expect(mockGetEarningsReports).not.toHaveBeenCalled();
        expect(upsertMany).not.toHaveBeenCalled();
    });

    it('FMP가 빈 응답을 주면 빈 마커를 set한다', async () => {
        getLatestFetchedAt.mockResolvedValue(null); // stale, 마커 없음
        mockGetEarningsReports.mockResolvedValue([]); // 빈 응답
        getNextForSymbol.mockResolvedValue(null);

        await getNextEarningsReport('XLK', fakeDb);

        expect(mockGetEarningsReports).toHaveBeenCalledWith(
            'XLK',
            EARNINGS_REPORT_FMP_LIMIT
        );
        expect(store.has('earnings:empty:XLK')).toBe(true);
    });

    it('FMP가 데이터를 주면 빈 마커를 set하지 않는다', async () => {
        getLatestFetchedAt.mockResolvedValue(null); // stale, 마커 없음
        mockGetEarningsReports.mockResolvedValue([
            {
                symbol: 'AAPL',
                earningsDate: '2026-07-30',
                epsActual: null,
                epsEstimated: 1.86,
                revenueActual: null,
                revenueEstimated: 107_618_800_000,
                lastUpdated: '2026-05-10',
                rawPayload: {},
            },
        ]);
        getNextForSymbol.mockResolvedValue(nextEarnings);

        await getNextEarningsReport('AAPL', fakeDb);

        expect(store.has('earnings:empty:AAPL')).toBe(false);
    });
```

> Note: `EARNINGS_REPORT_FMP_LIMIT` is already imported in this file from prior work. If not, add it to the `@/entities/earnings-report` import.

- [ ] **Step 2: Run test to verify the marker-guard test fails**

Run: `yarn test src/entities/earnings-report/__tests__/getNextEarningsReport.test.ts -t "빈 마커가 있으면"`
Expected: FAIL — current code calls FMP even when the marker exists.

- [ ] **Step 3: Add the guard to getNextEarningsReport**

In `src/entities/earnings-report/api.ts`, modify the staleness gate. Change:

```ts
    if (isEarningsReportStale(fetchedAt, Date.now())) {
        try {
            const client = getFundamentalDataProvider();
            const reports = await client.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
        } catch (err) {
            // Best-effort: analysis proceeds without earnings context if FMP fails.
            // 로깅은 남겨 운영자가 FMP 키 만료/타임아웃 등 장애를 감지할 수 있게 한다.
            console.warn('[getNextEarningsReport] FMP refresh failed:', err);
        }
    }
```

to:

```ts
    if (
        isEarningsReportStale(fetchedAt, Date.now()) &&
        !(await isEarningsKnownEmpty(symbol))
    ) {
        try {
            const client = getFundamentalDataProvider();
            const reports = await client.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
            // FMP가 빈 응답(데이터 없는 심볼)을 주면 TTL 동안 재호출을 막는다(#567).
            if (reports.length === 0) await markEarningsEmpty(symbol);
        } catch (err) {
            // Best-effort: analysis proceeds without earnings context if FMP fails.
            // 로깅은 남겨 운영자가 FMP 키 만료/타임아웃 등 장애를 감지할 수 있게 한다.
            console.warn('[getNextEarningsReport] FMP refresh failed:', err);
        }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/entities/earnings-report/__tests__/getNextEarningsReport.test.ts`
Expected: PASS (9 tests — 6 existing + 3 new).

---

## Task 3: `getEarningsReportComparison`(newsData)에 마커 가드 통합

**Files:**
- Modify: `src/app/[symbol]/news/newsData.ts`
- Test: `src/app/[symbol]/news/__tests__/newsData.test.ts`

- [ ] **Step 1: Add failing tests**

In `src/app/[symbol]/news/__tests__/newsData.test.ts`, the suite mocks `@/entities/earnings-report` via `importOriginal` and mocks `@/shared/cache/getOrSetCache`. Add a `getRedisClient` mock so markers are controllable.

Add near the other `vi.mock` calls:

```ts
const { markerStore, fakeRedis } = vi.hoisted(() => {
    const markerStore = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            markerStore.has(key) ? markerStore.get(key) : null
        ),
        set: vi.fn(async (key: string, value: unknown) => {
            markerStore.set(key, value);
        }),
    };
    return { markerStore, fakeRedis };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => fakeRedis,
}));
```

In the top-level `beforeEach` of `describe('getEarningsReportComparison 함수는', ...)`, add `markerStore.clear();` as the first line.

Add a new describe block after the existing `describe('DB 캐시가 만료됐을 때 (stale)', ...)`:

```ts
    describe('빈-응답 마커 (#567)', () => {
        it('빈 마커가 있으면 stale이어도 FMP를 호출하지 않고 기존 비교 데이터를 반환한다', async () => {
            markerStore.set('earnings:empty:XLK', 1);
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetComparisonItems.mockResolvedValue([COMPARISON_ITEM]);

            await expect(
                getEarningsReportComparison('XLK', '2026-05-10')
            ).resolves.toEqual([COMPARISON_ITEM]);

            expect(mockGetEarningsReports).not.toHaveBeenCalled();
            expect(mockUpsertMany).not.toHaveBeenCalled();
        });

        it('FMP가 빈 응답을 주면 빈 마커를 set한다', async () => {
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetComparisonItems.mockResolvedValue([]);
            mockGetEarningsReports.mockResolvedValue([]); // 빈 응답

            await getEarningsReportComparison('XLK', '2026-05-10');

            expect(mockGetEarningsReports).toHaveBeenCalledWith(
                'XLK',
                EARNINGS_REPORT_FMP_LIMIT
            );
            expect(markerStore.has('earnings:empty:XLK')).toBe(true);
        });
    });
```

> `EARNINGS_REPORT_FMP_LIMIT` must be imported. Update the `@/entities/earnings-report` import in this test file to include it:
> ```ts
> import { EARNINGS_REPORT_FMP_LIMIT, EARNINGS_REPORT_STALE_MS } from '@/entities/earnings-report';
> ```
> (`EARNINGS_REPORT_STALE_MS` is already imported from prior work; add `EARNINGS_REPORT_FMP_LIMIT` alongside it.)

- [ ] **Step 2: Run test to verify the marker-guard test fails**

Run: `yarn test "src/app/[symbol]/news/__tests__/newsData.test.ts" -t "빈 마커가 있으면"`
Expected: FAIL — current code calls FMP even when the marker exists.

- [ ] **Step 3: Add the guard to getEarningsReportComparison**

In `src/app/[symbol]/news/newsData.ts`:

(a) Add `isEarningsKnownEmpty` and `markEarningsEmpty` to the existing `@/entities/earnings-report` import:

```ts
import {
    DrizzleEarningsReportsRepository,
    isEarningsKnownEmpty,
    isEarningsReportStale,
    markEarningsEmpty,
} from '@/entities/earnings-report';
```

(b) Modify the staleness gate. Change:

```ts
    if (isEarningsReportStale(fetchedAt, Date.now())) {
        try {
            const reports = await fundamentalClient.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
        } catch (error: unknown) {
```

to:

```ts
    if (
        isEarningsReportStale(fetchedAt, Date.now()) &&
        !(await isEarningsKnownEmpty(symbol))
    ) {
        try {
            const reports = await fundamentalClient.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
            // FMP가 빈 응답(데이터 없는 심볼)을 주면 TTL 동안 재호출을 막는다(#567).
            if (reports.length === 0) await markEarningsEmpty(symbol);
        } catch (error: unknown) {
```

(The rest of the catch block and the `return repo.getComparisonItems(symbol, today)` / `return comparisonItems` lines stay unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test "src/app/[symbol]/news/__tests__/newsData.test.ts"`
Expected: PASS (existing + 2 new).

---

## Task 4: 전체 검증

**Files:** 없음(검증 전용)

- [ ] **Step 1: 변경 영역 테스트**

Run: `yarn test src/entities/earnings-report "src/app/[symbol]/news"`
Expected: 전부 PASS.

- [ ] **Step 2: 전체 스위트**

Run: `yarn test`
Expected: 전부 PASS (회귀 0).

- [ ] **Step 3: 린트**

Run: `yarn lint`
Expected: 0 errors. (`entities/earnings-report/api.ts` → `@/shared/cache/redisClient`, `@/shared/config/time` import 허용. `app` → `@/entities/earnings-report` barrel 허용.)

- [ ] **Step 4: 빌드**

Run: `yarn build > /tmp/build_567.log 2>&1; echo "EXIT=$?"; tail -15 /tmp/build_567.log`
Expected: EXIT=0.

- [ ] **Step 5: 워크플로우 진입 (커밋은 직접 하지 않음)**

구현·검증 완료. ISSUE_IMPL_FLOW: `review-agent`(Opus 4.8로 spawn) → findings 수정 → 재리뷰 → `mistake-managing-agent` → `git-agent`(커밋·PR, Closes #567). plan 문서도 git-agent가 함께 커밋.

---

## Self-Review (작성자 점검)

- **Spec 커버리지**: 헬퍼(상수/key/is/mark) → Task 1. getNextEarningsReport 가드+마커 → Task 2. getEarningsReportComparison 가드+마커 → Task 3. "데이터 없는 심볼 2회 조회 시 FMP 1회"는 Task 2/3의 "마커 있으면 skip" + "빈 응답 시 set" 조합으로 입증. 전체 검증 → Task 4. ✅
- **Placeholder 스캔**: 모든 code 스텝에 실제 코드. ✅
- **타입/명칭 일관성**: `isEarningsKnownEmpty`, `markEarningsEmpty`, `EARNINGS_EMPTY_MARKER_TTL_SECONDS`, `earningsEmptyMarkerKey`, 키 `earnings:empty:<SYM>` — 전 task 일치. `getRedisClient`/`SECONDS_PER_DAY` 실제 export와 일치. ✅
- **graceful**: Redis null → is=false/mark=no-op (Task 1 test 커버). ✅
- **behavior 보존**: 데이터 있는 심볼은 마커 set 안 함(Task 2 3번째 test) → 기존 24h gate 유지. ✅
