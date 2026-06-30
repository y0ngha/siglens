# FMP Cache Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FMP 호출·egress를 줄인다 — valuation TTL 24h, peer enrich를 페이지(raw)/분석(enriched)으로 분리, EOD 일봉을 불변 과거(long-cache)+최근(live)로 분리.

**Architecture:** siglens I/O 레이어만 변경(`shared/api/fmp/*`, `shared/api/market/*`, `app/[symbol]/fundamental/*`). core(`@y0ngha/siglens-core`)·`FmpFundamentalClient`·`FmpMarketProvider` 무변경. 기존 캐시 패턴(`getOrSetCache` + `React.cache`, poison 방지, graceful fallback) 유지.

**Tech Stack:** TypeScript, Next.js 16, Upstash Redis(`getOrSetCache`), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-30-fmp-cache-optimization-design.md`

---

## File Structure

| File | 책임 | 변경 |
|---|---|---|
| `src/shared/api/fmp/fundamentalClient.ts` | valuation TTL 상수 | Modify (상수 1h→24h) |
| `src/shared/api/fmp/fundamentalProvider.types.ts` | provider 인터페이스 | Modify (소비자 인터페이스에 `getStockPeersRaw` 추가) |
| `src/shared/api/fmp/CachedFundamentalProvider.ts` | Redis 데코레이터 | Modify (`getStockPeersRaw` 구현) |
| `src/shared/api/fmp/getFundamentalDataProvider.ts` | provider 팩토리 | Modify (반환 타입) |
| `src/shared/api/fmp/FakeFundamentalDataProvider.ts` | E2E fake | Modify (`getStockPeersRaw` 구현) |
| `src/app/[symbol]/fundamental/fundamentalData.ts` | 페이지 데이터 위임 | Modify (`getStockPeers`→raw) |
| `src/shared/api/market/mergeBarsByTime.ts` | 순수 병합 함수 | Create |
| `src/shared/api/market/CachedMarketDataProvider.ts` | bars Redis 데코레이터 | Modify (1Day 2-윈도우 분리) |

---

## Task 1: Valuation TTL 1h → 24h

**Files:**
- Modify: `src/shared/api/fmp/fundamentalClient.ts:3,45`
- Test: `src/shared/api/fmp/__tests__/fundamentalClient.test.ts`

- [ ] **Step 1: Write the failing test**

`fundamentalClient.test.ts` 상단 import에 추가하고 테스트를 더한다:

```ts
import { FMP_FUNDAMENTAL_REVALIDATE_SECONDS } from '@/shared/api/fmp/fundamentalClient';
import { SECONDS_PER_DAY } from '@/shared/config/time';

describe('FMP_FUNDAMENTAL_REVALIDATE_SECONDS', () => {
    it('is 24h (SECONDS_PER_DAY) — fundamentals are quarterly; aligns with statements/congress', () => {
        expect(FMP_FUNDAMENTAL_REVALIDATE_SECONDS).toBe(SECONDS_PER_DAY);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/api/fmp/__tests__/fundamentalClient.test.ts`
Expected: FAIL — `expected 3600 to be 86400`.

- [ ] **Step 3: Change the constant**

`fundamentalClient.ts` line 3, import `SECONDS_PER_DAY` instead of `SECONDS_PER_HOUR` (확인: `SECONDS_PER_HOUR`는 이 파일에서 line 45에서만 사용됨):

```ts
import { SECONDS_PER_DAY } from '@/shared/config/time';
```

line 45:

```ts
export const FMP_FUNDAMENTAL_REVALIDATE_SECONDS = SECONDS_PER_DAY;
```

JSDoc(line 40-44)의 "1시간 freshness 창" 문구를 "24시간 freshness 창(분기 단위 재무 + statements/congress 정합)"으로 갱신.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/api/fmp/__tests__/fundamentalClient.test.ts`
Expected: PASS. 기존 다른 단언이 `3600`을 기대했다면 함께 `SECONDS_PER_DAY`로 수정.

- [ ] **Step 5: tsc + commit**

```bash
yarn tsc --noEmit
git add src/shared/api/fmp/fundamentalClient.ts src/shared/api/fmp/__tests__/fundamentalClient.test.ts
git commit -m "perf(fmp): extend fundamental cache TTL 1h -> 24h"
```

---

## Task 2: `getStockPeersRaw` (interface + Cached impl + Fake)

페이지 전용 raw peer 메서드. 소비자 인터페이스에만 추가하고 inner(raw client) 계약은 불변으로 둔다(FmpFundamentalClient 무변경).

**Files:**
- Modify: `src/shared/api/fmp/fundamentalProvider.types.ts`
- Modify: `src/shared/api/fmp/CachedFundamentalProvider.ts`
- Modify: `src/shared/api/fmp/getFundamentalDataProvider.ts`
- Modify: `src/shared/api/fmp/FakeFundamentalDataProvider.ts`
- Test: `src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts`, `src/shared/api/fmp/__tests__/FakeFundamentalDataProvider.test.ts`

- [ ] **Step 1: Write the failing test (Cached raw = no enrich)**

`CachedFundamentalProvider.test.ts`에 추가. 이 파일의 기존 `makeInner`/`fakeRedis` 헬퍼를 그대로 사용한다(`getStockPeersRaw`는 inner에 없음 — 데코레이터가 `inner.getStockPeers`를 호출):

```ts
it('getStockPeersRaw caches raw peers WITHOUT enrich (no getKeyMetricsTtm calls)', async () => {
    resetSharedState();
    const inner = makeInner({
        getStockPeers: vi.fn(async () => [
            { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 3e12 },
        ]),
        getKeyMetricsTtm: vi.fn(async () => ({
            peRatioTTM: 10,
            priceToSalesRatioTTM: 3,
            pbRatioTTM: null,
            pegRatioTTM: null,
            enterpriseValueOverEBITDATTM: null,
            epsTTM: null,
        })),
    });
    const provider = new CachedFundamentalProvider(inner);

    const peers = await provider.getStockPeersRaw('AAPL');

    expect(peers).toEqual([
        { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 3e12 },
    ]);
    // enrich가 일어나지 않아야 한다(per/psr fan-out 제거)
    expect(inner.getKeyMetricsTtm).not.toHaveBeenCalled();
    // raw 목록은 별도 키로 캐싱
    expect(store.has('fundamental:peers-raw:AAPL')).toBe(true);

    // 2번째 호출은 캐시 hit → inner.getStockPeers 추가 호출 없음
    await provider.getStockPeersRaw('AAPL');
    expect(inner.getStockPeers).toHaveBeenCalledTimes(1);
});
```

`FakeFundamentalDataProvider.test.ts`에 추가:

```ts
it('getStockPeersRaw returns [] (deterministic E2E fixture)', async () => {
    const provider = new FakeFundamentalDataProvider();
    await expect(provider.getStockPeersRaw('AAPL')).resolves.toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts src/shared/api/fmp/__tests__/FakeFundamentalDataProvider.test.ts`
Expected: FAIL — `getStockPeersRaw` does not exist (타입 에러 또는 런타임 undefined).

- [ ] **Step 3a: Add consumer interface in `fundamentalProvider.types.ts`**

`FundamentalProvider`(inner/raw surface)는 **그대로 두고**, 소비자용 확장 인터페이스를 추가한다:

```ts
import type {
    FundamentalDataProvider,
    FundamentalPeerInput,
} from '@y0ngha/siglens-core';
import type { FmpEarningsReportItem } from './fundamentalClient';

// (기존 FundamentalProvider 인터페이스는 변경 없음 — inner/raw client 계약)

/**
 * 소비자(페이지·팩토리)가 받는 표면. `FundamentalProvider`에 페이지 전용 raw peer
 * 조회를 더한다. raw peer(symbol/companyName/marketCap)는 PeersTable이 렌더하는
 * 전부이며 per/psr enrich가 필요 없다 — enriched `getStockPeers`는 FactLayer(분석)
 * 전용으로 유지된다. `CachedFundamentalProvider`가 이 표면을 구현하고,
 * `FakeFundamentalDataProvider`(E2E)도 만족한다.
 */
export interface FundamentalProviderWithRawPeers extends FundamentalProvider {
    getStockPeersRaw(symbol: string): Promise<FundamentalPeerInput[]>;
}
```

- [ ] **Step 3b: Implement in `CachedFundamentalProvider.ts`**

클래스 선언을 `implements FundamentalProviderWithRawPeers`로 바꾸고(import 추가), `getStockPeers`(enriched) 바로 아래에 추가한다. **constructor inner 타입은 `FundamentalProvider` 그대로**(inner는 raw `getStockPeers`만 제공):

```ts
import type {
    FundamentalProvider,
    FundamentalProviderWithRawPeers,
} from './fundamentalProvider.types';

export class CachedFundamentalProvider
    implements FundamentalProviderWithRawPeers
{
    constructor(private readonly inner: FundamentalProvider) {}
    // ...기존 메서드 유지(enriched getStockPeers 포함)...

    /**
     * 페이지 전용 raw peer 목록(symbol/companyName/marketCap). per/psr enrich 없음 →
     * peer당 valuation fan-out 제거. PeersTable은 이 3개 필드만 렌더한다. enriched
     * `getStockPeers`는 FactLayer(분석 프롬프트) 전용으로 그대로 둔다.
     */
    getStockPeersRaw = cache(
        (symbol: string): Promise<FundamentalPeerInput[]> =>
            getOrSetCache(`fundamental:peers-raw:${sym(symbol)}`, TTL, () =>
                this.inner.getStockPeers(symbol)
            )
    );
}
```

- [ ] **Step 3c: Update factory return type in `getFundamentalDataProvider.ts`**

```ts
import type { FundamentalProviderWithRawPeers } from './fundamentalProvider.types';
export type { FundamentalProviderWithRawPeers } from './fundamentalProvider.types';

export const getFundamentalDataProvider: () => FundamentalProviderWithRawPeers =
    createE2EGatedSingleton(
        () => new CachedFundamentalProvider(new FmpFundamentalClient()),
        () => {
            const { FakeFundamentalDataProvider } =
                require('./FakeFundamentalDataProvider') as typeof import('./FakeFundamentalDataProvider');
            return new FakeFundamentalDataProvider();
        }
    );
```

- [ ] **Step 3d: Implement in `FakeFundamentalDataProvider.ts`**

`getStockPeers` 바로 아래에 추가(import는 이미 `FundamentalPeerInput` 존재):

```ts
async getStockPeersRaw(_symbol: string): Promise<FundamentalPeerInput[]> {
    return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts src/shared/api/fmp/__tests__/FakeFundamentalDataProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: tsc + commit**

```bash
yarn tsc --noEmit
git add src/shared/api/fmp/fundamentalProvider.types.ts src/shared/api/fmp/CachedFundamentalProvider.ts src/shared/api/fmp/getFundamentalDataProvider.ts src/shared/api/fmp/FakeFundamentalDataProvider.ts src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts src/shared/api/fmp/__tests__/FakeFundamentalDataProvider.test.ts
git commit -m "feat(fmp): add getStockPeersRaw (un-enriched, page-only peer list)"
```

---

## Task 3: 페이지 peer를 raw로 전환

페이지 `PeersSection`이 쓰는 `fundamentalData.getStockPeers`를 raw 위임으로 바꾼다. enriched `getStockPeers`(core 포트)는 분석 경로 전용으로 남는다.

**Files:**
- Modify: `src/app/[symbol]/fundamental/fundamentalData.ts:68-70`
- Test: `src/app/[symbol]/fundamental/__tests__/fundamentalData.delegation.test.ts`

- [ ] **Step 1: Write the failing test**

`fundamentalData.delegation.test.ts`에 추가(이 파일의 기존 provider mock 패턴을 따른다 — `getFundamentalDataProvider`를 mock해 `getStockPeersRaw`/`getStockPeers` spy를 노출):

```ts
it('getStockPeers (page) delegates to provider.getStockPeersRaw (no enrich), not enriched getStockPeers', async () => {
    const { getStockPeers } = await import(
        '@/app/[symbol]/fundamental/fundamentalData'
    );
    await getStockPeers('AAPL');
    expect(mockProvider.getStockPeersRaw).toHaveBeenCalledWith('AAPL');
    expect(mockProvider.getStockPeers).not.toHaveBeenCalled();
});
```

> 기존 파일의 mock 변수명(`mockProvider` 등)에 맞춰 조정한다. mock provider 객체에 `getStockPeersRaw: vi.fn(async () => [])`를 추가해야 한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/app/[symbol]/fundamental/__tests__/fundamentalData.delegation.test.ts`
Expected: FAIL — 현재 `getStockPeers`가 `provider.getStockPeers`(enriched)를 호출.

- [ ] **Step 3: Switch delegation in `fundamentalData.ts`**

line 67-70:

```ts
// 페이지 PeersTable은 티커·회사명·시총만 렌더하므로 per/psr enrich가 불필요하다 →
// raw 경로로 위임해 peer valuation fan-out을 제거한다. enriched getStockPeers는
// FactLayer(분석 프롬프트) 전용으로 남는다.
export const getStockPeers = (
    symbol: string
): Promise<FundamentalPeerInput[]> =>
    fundamentalClient.getStockPeersRaw(symbol);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/app/[symbol]/fundamental/__tests__/fundamentalData.delegation.test.ts`
Expected: PASS.

- [ ] **Step 5: tsc + commit**

```bash
yarn tsc --noEmit
git add src/app/[symbol]/fundamental/fundamentalData.ts src/app/[symbol]/fundamental/__tests__/fundamentalData.delegation.test.ts
git commit -m "perf(fundamental): page peers use raw (un-enriched) list, drop per/psr fan-out"
```

---

## Task 4: `mergeBarsByTime` 순수 함수

**Files:**
- Create: `src/shared/api/market/mergeBarsByTime.ts`
- Test: `src/shared/api/market/__tests__/mergeBarsByTime.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';
import { mergeBarsByTime } from '@/shared/api/market/mergeBarsByTime';

const bar = (time: number, close: number): Bar => ({
    time,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
});

describe('mergeBarsByTime', () => {
    it('concatenates disjoint ranges in ascending time order', () => {
        const result = mergeBarsByTime([bar(1, 10), bar(2, 11)], [bar(3, 12)]);
        expect(result.map(b => b.time)).toEqual([1, 2, 3]);
    });

    it('dedups overlapping times, preferring recent', () => {
        const result = mergeBarsByTime(
            [bar(1, 10), bar(2, 11)],
            [bar(2, 99), bar(3, 12)]
        );
        expect(result.map(b => [b.time, b.close])).toEqual([
            [1, 10],
            [2, 99], // recent wins
            [3, 12],
        ]);
    });

    it('sorts unsorted inputs by time', () => {
        const result = mergeBarsByTime([bar(3, 12), bar(1, 10)], [bar(2, 11)]);
        expect(result.map(b => b.time)).toEqual([1, 2, 3]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/api/market/__tests__/mergeBarsByTime.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { Bar } from '@y0ngha/siglens-core';

/**
 * 두 Bar 배열을 time 기준 오름차순으로 병합·중복제거한다. 같은 time이 양쪽에 있으면
 * `recent` 값을 우선한다(live 갱신분이 long-cache된 과거 값을 덮어쓰도록). EOD 캐시
 * 분리에서 과거(long-cache) 윈도우와 최근(live) 윈도우를 합쳐 단일 연속 시리즈를
 * 복원하는 데 쓴다 — 결과는 단일 `getBars(from=now-730d)`와 동일 집합이어야 한다.
 */
export function mergeBarsByTime(historical: Bar[], recent: Bar[]): Bar[] {
    const byTime = new Map<number, Bar>();
    for (const b of historical) byTime.set(b.time, b);
    for (const b of recent) byTime.set(b.time, b); // recent wins on overlap
    return [...byTime.values()].sort((a, b) => a.time - b.time);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/api/market/__tests__/mergeBarsByTime.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add src/shared/api/market/mergeBarsByTime.ts src/shared/api/market/__tests__/mergeBarsByTime.test.ts
git commit -m "feat(market): add mergeBarsByTime pure helper for EOD cache split"
```

---

## Task 5: EOD 캐시 분리 (`CachedMarketDataProvider` 1Day 2-윈도우)

1Day & `before===undefined`일 때만 과거(long-cache)+최근(live)로 분리. 나머지 경로 불변. core 포트 `getBars`만 날짜 윈도우 달리해 호출 → `FmpMarketProvider` 무변경.

**Files:**
- Modify: `src/shared/api/market/CachedMarketDataProvider.ts`
- Test: `src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts`

- [ ] **Step 1: Write the failing test**

`CachedMarketDataProvider.test.ts`에 추가(기존 fakeRedis mock 패턴 사용; 없으면 `CachedFundamentalProvider.test.ts`의 `vi.hoisted` fakeRedis 패턴 복제). `vi.setSystemTime`으로 `now` 고정:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bar, GetBarsOptions } from '@y0ngha/siglens-core';
import { CachedMarketDataProvider } from '@/shared/api/market/CachedMarketDataProvider';

const bar = (time: number): Bar => ({
    time,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
});

describe('CachedMarketDataProvider — 1Day EOD split', () => {
    beforeEach(() => {
        resetSharedState(); // fakeRedis store clear
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('splits 1Day into historical(before set) + recent(from set) and merges', async () => {
        const getBars = vi.fn(async (o: GetBarsOptions) =>
            o.before !== undefined ? [bar(1), bar(2)] : [bar(2), bar(3)]
        );
        const provider = new CachedMarketDataProvider({
            getBars,
            getQuote: vi.fn(async () => null),
        });
        const opts: GetBarsOptions = {
            symbol: 'AAPL',
            timeframe: '1Day',
            from: '2024-06-30',
        };

        const result = await provider.getBars(opts);

        // 두 윈도우 호출: 하나는 before(과거), 하나는 from override(최근)
        const calls = getBars.mock.calls.map(c => c[0]);
        expect(calls.some(c => c.before !== undefined)).toBe(true);
        expect(calls.some(c => c.before === undefined && c.from !== '2024-06-30')).toBe(true);
        // merge + dedup(시간 2 중복 → 1개), 오름차순
        expect(result.map(b => b.time)).toEqual([1, 2, 3]);
    });

    it('serves historical window from long cache on the 2nd call (same day)', async () => {
        const getBars = vi.fn(async (o: GetBarsOptions) =>
            o.before !== undefined ? [bar(1)] : [bar(2)]
        );
        const provider = new CachedMarketDataProvider({
            getBars,
            getQuote: vi.fn(async () => null),
        });
        const opts: GetBarsOptions = { symbol: 'AAPL', timeframe: '1Day', from: '2024-06-30' };

        await provider.getBars(opts);
        await provider.getBars(opts);

        const histCalls = getBars.mock.calls.filter(c => c[0].before !== undefined);
        expect(histCalls).toHaveLength(1); // 과거 윈도우는 long-cache hit
    });

    it('leaves non-1Day timeframes on the single-key path', async () => {
        const getBars = vi.fn(async () => [bar(1)]);
        const provider = new CachedMarketDataProvider({
            getBars,
            getQuote: vi.fn(async () => null),
        });
        await provider.getBars({ symbol: 'AAPL', timeframe: '5Min', from: '2026-06-20' });
        expect(getBars).toHaveBeenCalledTimes(1);
        expect(getBars.mock.calls[0][0].before).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts`
Expected: FAIL — 현재 `getBars`는 단일 `bars:raw` 경로라 윈도우 분리/2회 호출 없음.

- [ ] **Step 3: Implement the split**

`CachedMarketDataProvider.ts` 상단 import·상수·헬퍼 추가:

```ts
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { mergeBarsByTime } from './mergeBarsByTime';

/** 과거(불변) 윈도우 종료점: 오늘 − 7일. 최근 윈도우와 겹쳐 주말·공휴일 갭 방지. */
const EOD_HIST_TO_DAYS = 7;
/** 최근(live) 윈도우 시작점: 오늘 − 10일(약 3일 overlap → dedup). */
const EOD_RECENT_FROM_DAYS = 10;
/** 과거 윈도우 long TTL. 키가 날짜로 self-versioning하므로 intraday 커버 + 여유. */
const EOD_HIST_TTL_SECONDS = SECONDS_PER_DAY * 2;

function isoDateDaysAgo(now: Date, days: number): string {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
}
```

`getBars`를 분기로 교체하고 private 메서드 추가:

```ts
getBars = (options: GetBarsOptions): Promise<Bar[]> => {
    // 1Day 라이브 뷰(before 미지정)만 과거(long)+최근(live) 분리. 인트라데이·과거
    // 페이지네이션(before 지정)은 기존 단일 60s 경로 유지.
    if (options.timeframe === '1Day' && options.before === undefined) {
        return this.getCachedDailyBars(options);
    }
    return getOrSetCache(
        buildBarsRawKey(options),
        this.ttl(options.timeframe),
        () => this.inner.getBars(options),
        bars => bars.length > 0
    );
};

/**
 * 1Day 일봉을 불변 과거(long-cache)와 최근(live)로 나눠 fetch 후 병합한다.
 * 과거 윈도우는 `before=오늘−7d`로 한정해 오늘 봉을 포함하지 않으므로(=불변)
 * long TTL로 캐싱하고, 매일 키(`from`·`histTo` 날짜)가 self-versioning된다.
 * 최근 윈도우(`from=오늘−10d`)는 작은 EOD(~10행)+오늘 봉(quote)을 기존 세션 TTL
 * (장중 60s)로 가져온다. 두 윈도우는 약 3일 겹쳐 주말·공휴일 갭을 막고
 * `mergeBarsByTime`가 중복(time)을 최근 우선으로 제거한다. 결과는 단일
 * `getBars(from)`와 동일 집합이다.
 */
private async getCachedDailyBars(options: GetBarsOptions): Promise<Bar[]> {
    const now = new Date();
    const histTo = isoDateDaysAgo(now, EOD_HIST_TO_DAYS);
    const recentFrom = isoDateDaysAgo(now, EOD_RECENT_FROM_DAYS);
    const symbolKey = options.symbol.toUpperCase();
    const [historical, recent] = await Promise.all([
        getOrSetCache(
            `bars:eodhist:${symbolKey}:${options.from ?? ''}:${histTo}`,
            EOD_HIST_TTL_SECONDS,
            () => this.inner.getBars({ ...options, before: histTo }),
            bars => bars.length > 0
        ),
        getOrSetCache(
            `bars:eodrecent:${symbolKey}:${recentFrom}`,
            this.ttl('1Day'),
            () => this.inner.getBars({ ...options, from: recentFrom }),
            bars => bars.length > 0
        ),
    ]);
    return mergeBarsByTime(historical, recent);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: tsc + scoped tests + commit**

```bash
yarn tsc --noEmit
yarn test src/shared/api/market src/shared/api/fmp
git add src/shared/api/market/CachedMarketDataProvider.ts src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts
git commit -m "perf(market): split 1Day EOD into immutable-history(long) + recent(live) caches"
```

---

## Task 6: 전체 게이트 + 정리

- [ ] **Step 1: scoped lint + tsc**

Run: `yarn lint src/shared/api/fmp src/shared/api/market src/app/[symbol]/fundamental && yarn tsc --noEmit`
Expected: 통과. (전체 build·e2e는 pre-push 훅이, 교차영향은 CI가 담당.)

- [ ] **Step 2: 영향 테스트 스위트**

Run: `yarn test src/shared/api/fmp src/shared/api/market src/app/[symbol]/fundamental`
Expected: 전부 PASS.

---

## Self-Review (spec 대조)

| spec 요구 | 구현 task |
|---|---|
| 변경1: valuation TTL 1h→24h(단일 상수) | Task 1 |
| 변경2: `getStockPeersRaw` 인터페이스/Cached/Fake | Task 2 |
| 변경2: 페이지 raw 위임, 분석 enriched 유지 | Task 3 |
| 변경3: 1Day 2-윈도우(과거 long / 최근 live) + merge | Task 4(merge) + Task 5 |
| FactLayer per/psr 보존(회귀 금지) | Task 3 (enriched `getStockPeers` 미변경 — 분석 경로 유지) |
| core/`FmpFundamentalClient`/`FmpMarketProvider` 무변경 | Task 2(inner 계약 불변)·Task 5(포트 getBars만 사용) |
| 에러/캐시 계약 보존(poison 방지·graceful·shouldCache) | Task 2·5 (`getOrSetCache` 그대로, `bars.length>0` 가드 유지) |
| 테스트(각 변경) | Task 1·2·3·4·5 |
| 비목표(SWR·empty-marker·배치) 미포함 | 계획에 없음 — 의도적 제외 |

**Placeholder scan:** 없음(모든 코드 블록 실제 코드).
**Type consistency:** `getStockPeersRaw`(types/Cached/Fake/page), `FundamentalProviderWithRawPeers`(types/factory), `mergeBarsByTime`(Task4 정의 ↔ Task5 사용), `isoDateDaysAgo`/상수(Task5 내부) — 일치.
