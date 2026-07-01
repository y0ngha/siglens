# EOD Cache Redesign (Anchored 2-tier) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EOD 일봉 캐시 키에서 rolling 날짜를 제거(심볼-앵커)하고 history를 겹침-기반 full-refetch-on-stale로 캐싱해, 자정 키롤·반복 크롤 재fetch로 인한 EOD 호출/egress 폭증을 제거한다.

**Architecture:** `CachedMarketDataProvider`의 1Day 분리 경로를 앵커드 2-tier로 재작성 — `bars:eodhist:<SYM>`(불변 과거, 30d TTL, `getOrSetCache`의 새 `isFresh` 인자로 recent 윈도우와의 겹침 staleness 판정 → stale 시 full 재fetch) + `bars:eodrecent:<SYM>`(오늘봉 포함 최근 윈도우, 세션 TTL). 두 tier를 `mergeBarsByTime`로 병합 후 `options.from`으로 슬라이스. core·`FmpMarketProvider` 무변경.

**Tech Stack:** TypeScript, Next.js 16, Upstash Redis(`getOrSetCache`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-01-eod-cache-redesign-design.md`

---

## File Structure

| File | 책임 | 변경 |
|---|---|---|
| `src/shared/cache/getOrSetCache.ts` | read-through Redis 캐시 | Modify (선택적 `isFresh` 인자) |
| `src/shared/api/market/CachedMarketDataProvider.ts` | bars/quote Redis 데코레이터 | Modify (`getCachedDailyBars` 앵커드 2-tier 재작성 + `sliceFrom` 헬퍼) |
| `src/shared/api/market/mergeBarsByTime.ts` | 순수 병합 | 재사용(무변경) |

---

## Task 1: `getOrSetCache`에 선택적 `isFresh` 인자 추가

캐시 hit이어도 `isFresh(data)===false`면 miss처럼 취급(refetch+set). 기존 호출부는 기본값(항상 fresh)이라 무영향.

**Files:**
- Modify: `src/shared/cache/getOrSetCache.ts`
- Test: `src/shared/cache/__tests__/getOrSetCache.test.ts`

- [ ] **Step 1: Write the failing test**

`getOrSetCache.test.ts`에 추가(기존 fakeRedis mock 패턴 사용 — 없으면 이 파일 상단의 `vi.mock('@/shared/cache/redisClient')` 패턴을 따른다):

```ts
it('treats a cache hit as miss when isFresh returns false (refetch + set)', async () => {
    // 사전: 캐시에 stale 값 저장
    store.set('k', { data: 'stale' });
    const fetcher = vi.fn(async () => 'fresh');

    const result = await getOrSetCache(
        'k',
        60,
        fetcher,
        () => true, // shouldCache
        value => value === 'fresh' // isFresh: 'stale'은 false
    );

    expect(result).toBe('fresh');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.get('k')).toEqual({ data: 'fresh' });
});

it('returns a cache hit unchanged when isFresh is omitted (default always-fresh)', async () => {
    store.set('k', { data: 'cached' });
    const fetcher = vi.fn(async () => 'fresh');

    const result = await getOrSetCache('k', 60, fetcher);

    expect(result).toBe('cached');
    expect(fetcher).not.toHaveBeenCalled();
});
```

> 기존 테스트 파일의 fakeRedis 헬퍼 변수명(`store` 등)에 맞춰 조정. 없으면 `CachedFundamentalProvider.test.ts`의 `vi.hoisted` fakeRedis 패턴을 복제.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/cache/__tests__/getOrSetCache.test.ts`
Expected: FAIL — `getOrSetCache` 5번째 인자 미지원(첫 테스트에서 stale 반환).

- [ ] **Step 3: Add the `isFresh` param**

`getOrSetCache.ts`의 시그니처와 hit 분기를 수정:

```ts
export async function getOrSetCache<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true,
    isFresh: (value: T) => boolean = () => true
): Promise<T> {
    const redis = getRedisClient();
    if (redis !== null) {
        try {
            const hit = await redis.get<unknown>(key);
            if (isCacheEnvelope<T>(hit) && isFresh(hit.data)) return hit.data;
        } catch (error) {
            console.error(`[getOrSetCache] get failed: ${key}`, error);
        }
    }

    const fresh = await fetcher();

    if (redis !== null && shouldCache(fresh)) {
        try {
            await redis.set(key, { data: fresh }, { ex: ttlSeconds });
        } catch (error) {
            console.error(`[getOrSetCache] set failed: ${key}`, error);
        }
    }
    return fresh;
}
```

함수 JSDoc에 한 줄 추가: `isFresh(value)`가 false면 envelope hit도 miss로 취급해 refetch한다(기본값 항상 fresh — 기존 호출부 무영향). staleness를 캐시 값으로 판정하는 호출부(예: EOD history 겹침)를 위한 가드.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/cache/__tests__/getOrSetCache.test.ts`
Expected: PASS (기존 테스트도 전부 통과 — 기본값 무영향).

- [ ] **Step 5: tsc + commit**

```bash
yarn tsc --noEmit
git add src/shared/cache/getOrSetCache.ts src/shared/cache/__tests__/getOrSetCache.test.ts
git commit -m "feat(cache): add optional isFresh predicate to getOrSetCache"
```

---

## Task 2: `getCachedDailyBars` 앵커드 2-tier 재작성

**Files:**
- Modify: `src/shared/api/market/CachedMarketDataProvider.ts`
- Test: `src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts`

- [ ] **Step 1: Write the failing tests**

기존 `1Day EOD split` describe 블록의 테스트들을 앵커드 설계에 맞게 **교체**한다(기존 fakeRedis `store`/`resetSharedState` + `vi.setSystemTime` + `bar()` 헬퍼 재사용). 핵심 케이스:

```ts
describe('CachedMarketDataProvider — 1Day anchored 2-tier', () => {
    beforeEach(() => {
        resetSharedState();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    const longOpts: GetBarsOptions = {
        symbol: 'AAPL',
        timeframe: '1Day',
        from: '2024-06-30',
    };

    it('uses date-free anchored keys (bars:eodhist:<SYM>, bars:eodrecent:<SYM>)', async () => {
        const getBars = vi.fn(async (o: GetBarsOptions) =>
            o.before !== undefined ? [bar(1)] : [bar(2)]
        );
        const provider = new CachedMarketDataProvider({ getBars, getQuote: vi.fn(async () => null) });
        await provider.getBars(longOpts);
        expect(store.has('bars:eodhist:AAPL')).toBe(true);
        expect(store.has('bars:eodrecent:AAPL')).toBe(true);
        // 날짜 세그먼트가 키에 없어야 함
        expect([...store.keys()].some(k => /bars:eodhist:AAPL:\d/.test(k))).toBe(false);
    });

    it('history is NOT refetched across a day boundary when still fresh (anchored key, overlap holds)', async () => {
        // history fetch(before=histTo)는 recentFrom 이후를 커버하는 봉을 반환하도록 구성
        const histBarTime = Math.floor(Date.parse('2026-06-25T00:00:00Z') / 1000); // recentFrom(2026-06-20) 이후 → fresh
        const getBars = vi.fn(async (o: GetBarsOptions) =>
            o.before !== undefined ? [{ ...bar(histBarTime), time: histBarTime }] : [bar(9)]
        );
        const provider = new CachedMarketDataProvider({ getBars, getQuote: vi.fn(async () => null) });

        await provider.getBars(longOpts); // day 1: history fetched once
        const histCallsDay1 = getBars.mock.calls.filter(c => c[0].before !== undefined).length;

        vi.setSystemTime(new Date('2026-07-01T15:00:00Z')); // 하루 경과
        await provider.getBars({ ...longOpts, from: '2024-07-01' });
        const histCallsTotal = getBars.mock.calls.filter(c => c[0].before !== undefined).length;

        expect(histCallsDay1).toBe(1);
        expect(histCallsTotal).toBe(1); // 자정 넘겨도 재fetch 없음(fresh)
    });

    it('history IS refetched when cached newest falls behind recentFrom (stale, overlap lost)', async () => {
        // history fetch가 recentFrom 이전(오래된) 봉만 반환 → isFresh=false → 매번 재fetch
        const staleTime = Math.floor(Date.parse('2026-06-01T00:00:00Z') / 1000); // recentFrom(2026-06-20) 이전
        const getBars = vi.fn(async (o: GetBarsOptions) =>
            o.before !== undefined ? [{ ...bar(staleTime), time: staleTime }] : [bar(9)]
        );
        const provider = new CachedMarketDataProvider({ getBars, getQuote: vi.fn(async () => null) });

        await provider.getBars(longOpts);
        await provider.getBars(longOpts);
        const histCalls = getBars.mock.calls.filter(c => c[0].before !== undefined).length;
        expect(histCalls).toBe(2); // stale → 재fetch
    });

    it('merges history + recent and slices to options.from', async () => {
        const inRange = Math.floor(Date.parse('2025-01-01T00:00:00Z') / 1000);
        const tooOld = Math.floor(Date.parse('2020-01-01T00:00:00Z') / 1000); // from(2024-06-30) 이전 → 슬라이스로 제거
        const recentT = Math.floor(Date.parse('2026-06-29T00:00:00Z') / 1000);
        const getBars = vi.fn(async (o: GetBarsOptions) =>
            o.before !== undefined
                ? [{ ...bar(tooOld), time: tooOld }, { ...bar(inRange), time: inRange }]
                : [{ ...bar(recentT), time: recentT }]
        );
        const provider = new CachedMarketDataProvider({ getBars, getQuote: vi.fn(async () => null) });
        const result = await provider.getBars(longOpts);
        const times = result.map(b => b.time);
        expect(times).toContain(inRange);
        expect(times).toContain(recentT);
        expect(times).not.toContain(tooOld); // options.from 이전은 슬라이스
        expect(times).toEqual([...times].sort((a, b) => a - b)); // 오름차순
    });

    it('cold symbol = 2 fetches (history + recent); repeat within session = 0', async () => {
        const freshHist = Math.floor(Date.parse('2026-06-25T00:00:00Z') / 1000);
        const getBars = vi.fn(async (o: GetBarsOptions) =>
            o.before !== undefined ? [{ ...bar(freshHist), time: freshHist }] : [bar(9)]
        );
        const provider = new CachedMarketDataProvider({ getBars, getQuote: vi.fn(async () => null) });
        await provider.getBars(longOpts);
        expect(getBars).toHaveBeenCalledTimes(2);
        await provider.getBars(longOpts); // 재접근
        expect(getBars).toHaveBeenCalledTimes(2); // 둘 다 캐시 hit → 추가 0
    });

    it('1Day with before set → single-key path (no anchored split)', async () => {
        const getBars = vi.fn(async () => [bar(1)]);
        const provider = new CachedMarketDataProvider({ getBars, getQuote: vi.fn(async () => null) });
        await provider.getBars({ symbol: 'AAPL', timeframe: '1Day', from: '2024-01-01', before: '2026-06-20' });
        expect(getBars).toHaveBeenCalledTimes(1);
        expect([...store.keys()].some(k => k.startsWith('bars:eodhist'))).toBe(false);
        expect(store.has('bars:raw:AAPL:1Day:2024-01-01:2026-06-20:')).toBe(true);
    });

    it('short lookback (from within recent window) → single-key path', async () => {
        const getBars = vi.fn(async () => [bar(1)]);
        const provider = new CachedMarketDataProvider({ getBars, getQuote: vi.fn(async () => null) });
        await provider.getBars({ symbol: 'AAPL', timeframe: '1Day', from: '2026-06-27' }); // recentFrom(2026-06-20) 이후
        expect([...store.keys()].some(k => k.startsWith('bars:eodhist'))).toBe(false);
        expect([...store.keys()].some(k => k.startsWith('bars:raw'))).toBe(true);
    });

    it('non-1Day stays on single-key path', async () => {
        const getBars = vi.fn(async () => [bar(1)]);
        const provider = new CachedMarketDataProvider({ getBars, getQuote: vi.fn(async () => null) });
        await provider.getBars({ symbol: 'AAPL', timeframe: '5Min', from: '2026-06-20' });
        expect(getBars).toHaveBeenCalledTimes(1);
        expect([...store.keys()].some(k => k.startsWith('bars:eod'))).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts`
Expected: FAIL — 현재 구현은 날짜-포함 키(`bars:eodhist:AAPL:<from>:<histTo>`)라 앵커 키/자정-불변/슬라이스 단언이 깨짐.

- [ ] **Step 3: Rewrite `getCachedDailyBars` + add `sliceFrom`**

`CachedMarketDataProvider.ts`에서 상수는 유지하되 `EOD_HIST_TTL_SECONDS`를 30일로 변경하고, `sliceFrom` 헬퍼를 추가한 뒤 `getCachedDailyBars`를 교체한다:

```ts
/** 과거(불변) 윈도우 종료점: 오늘 − EOD_HIST_TO_DAYS일. recent와 겹쳐 갭 방지. */
const EOD_HIST_TO_DAYS = 7;
/** 최근(live) 윈도우 시작점: 오늘 − EOD_RECENT_FROM_DAYS일. */
const EOD_RECENT_FROM_DAYS = 10;
/** 과거 history long TTL(30일). 갱신은 TTL이 아니라 recent와의 겹침 staleness가 주도. */
const EOD_HIST_TTL_SECONDS = SECONDS_PER_DAY * 30;

function isoDateDaysAgo(now: Date, days: number): string {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD(또는 ISO) 날짜를 UTC 자정 unix초로 변환(Bar.time과 동일 규약). */
function utcMidnightSeconds(dateStr: string): number {
    return Math.floor(Date.parse(dateStr.slice(0, 10) + 'T00:00:00Z') / 1000);
}

/** `from` 이후(포함) 봉만 남긴다 — 단일 `getBars(from)`와 동일 집합 보장. */
function sliceFrom(bars: Bar[], from: string | undefined): Bar[] {
    if (from === undefined) return bars;
    const threshold = utcMidnightSeconds(from);
    return bars.filter(b => b.time >= threshold);
}
```

`getCachedDailyBars` 본문(JSDoc 포함) 교체:

```ts
/**
 * 요청 윈도우가 최근 overlap 구간보다 앞에서 시작함을 전제로 한다(isLongDailyWindow
 * 가드 통과 후 진입). 짧은 lookback은 getBars를 통해 단일 경로로 라우팅된다.
 *
 * 1Day 일봉을 불변 과거(history, 날짜-없는 앵커 키 `bars:eodhist:<SYM>`)와 최근(live,
 * `bars:eodrecent:<SYM>`)으로 나눠 병렬 fetch 후 병합한다. 캐시 키에 날짜를 넣지 않아
 * UTC 자정 롤로 인한 전체 재fetch가 없다.
 *
 * history는 `before=오늘−EOD_HIST_TO_DAYS`로 오늘을 제외(불변)해 long TTL로 캐싱하고,
 * `isFresh`(캐시된 최신 봉이 recentFrom 이후 = recent 윈도우와 겹침)로 staleness를 판정한다
 * — 겹침이 유지되면 재fetch 0, 겹침이 사라지면(=cached newest < recentFrom) full 재fetch.
 * recent는 `from=오늘−EOD_RECENT_FROM_DAYS`(오늘 봉을 quote로 append)를 세션 TTL로 가져와
 * 오늘/최근 신선도를 담당한다. 두 윈도우의 (EOD_RECENT_FROM_DAYS − EOD_HIST_TO_DAYS)일
 * 겹침을 `mergeBarsByTime`가 recent 우선으로 dedup하고, `sliceFrom`가 options.from으로
 * 잘라 단일 `getBars(from)`와 동일 집합을 만든다.
 *
 * 앵커 키에서 from을 뺄 수 있는 근거: 모든 long-1Day 호출부가 core
 * TIMEFRAME_LOOKBACK_DAYS['1Day'] 단일 lookback을 공유한다(짧은 lookback은 가드가
 * 단일 경로로 분기). core lookback 변경 시 이 전제도 함께 갱신할 것.
 */
private async getCachedDailyBars(options: GetBarsOptions): Promise<Bar[]> {
    const now = new Date();
    const histTo = isoDateDaysAgo(now, EOD_HIST_TO_DAYS);
    const recentFrom = isoDateDaysAgo(now, EOD_RECENT_FROM_DAYS);
    const recentFromThreshold = utcMidnightSeconds(recentFrom);
    const symbolKey = options.symbol.toUpperCase();

    const [history, recent] = await Promise.all([
        getOrSetCache(
            `bars:eodhist:${symbolKey}`,
            EOD_HIST_TTL_SECONDS,
            () => this.inner.getBars({ ...options, before: histTo }),
            bars => bars.length > 0,
            bars =>
                bars.length > 0 &&
                bars[bars.length - 1]!.time >= recentFromThreshold
        ),
        getOrSetCache(
            `bars:eodrecent:${symbolKey}`,
            this.ttl('1Day'),
            () => this.inner.getBars({ ...options, from: recentFrom }),
            bars => bars.length > 0
        ),
    ]);

    return sliceFrom(mergeBarsByTime(history, recent), options.from);
}
```

`isLongDailyWindow`/`getBars` 분기/`buildBarsRawKey`/`getQuote`는 현행 유지. (`isLongDailyWindow`의 recentFrom 계산도 그대로.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: tsc + scoped tests + commit**

```bash
yarn tsc --noEmit
yarn test src/shared/api/market src/shared/cache
git add src/shared/api/market/CachedMarketDataProvider.ts src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts
git commit -m "perf(market): anchored 2-tier EOD cache (date-free keys, overlap staleness)"
```

---

## Task 3: 통합 게이트

- [ ] **Step 1: tsc + lint (직접 exit 캡처)**

Run:
```bash
yarn tsc --noEmit; echo "tsc=$?"
yarn lint src/shared/api/market src/shared/cache; echo "lint=$?"
```
Expected: tsc=0, lint=0.

- [ ] **Step 2: 영향 스위트**

Run: `yarn test src/shared/api/market src/shared/cache`
Expected: 전부 PASS. (전체 build·e2e는 pre-push, 교차영향은 CI 담당.)

---

## Self-Review (spec 대조)

| spec 요구 | 구현 task |
|---|---|
| getOrSetCache `isFresh` 인자 | Task 1 |
| 앵커 키 `bars:eodhist:<SYM>`/`bars:eodrecent:<SYM>`(날짜 없음) | Task 2 |
| history full-refetch-on-stale(겹침 `newest>=recentFrom`) | Task 2 (isFresh 술어) |
| recent 세션 TTL(오늘봉 quote append) | Task 2 (`this.ttl('1Day')`, `from: recentFrom`) |
| merge + `sliceFrom(options.from)` | Task 2 |
| Promise.all 병렬 | Task 2 |
| history TTL 30d | Task 2 (`EOD_HIST_TTL_SECONDS`) |
| 가드(1Day+before/짧은 lookback/인트라데이 → 단일 경로) | Task 2 (현행 유지, 테스트로 가드) |
| core/FmpMarketProvider 무변경 | 두 task 모두 미변경 |
| 에러/캐시 계약 보존 | Task 1/2 (`getOrSetCache` 그대로, shouldCache/graceful) |
| 테스트(앵커키·staleness·recent TTL·merge·cold/repeat·guard·isFresh) | Task 1·2 |

**Placeholder scan:** 없음(모든 코드 블록 실제 코드).
**Type consistency:** `isFresh`(Task1 정의 ↔ Task2 사용), `sliceFrom`/`utcMidnightSeconds`/`recentFromThreshold`(Task2 내부 일치), `EOD_HIST_TTL_SECONDS`=30d, 키 문자열 `bars:eodhist:<SYM>`/`bars:eodrecent:<SYM>` 일치.
