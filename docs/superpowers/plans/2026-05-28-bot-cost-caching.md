# 봇 크롤링 비용 절감 — 데이터 레이어 캐싱 복원 Implementation Plan

> **For agentic workers:** 이 플랜은 두 레포(siglens-core 먼저, siglens 나중)에 걸친다. 각 Task는 test→구현→검증 단위다. **커밋/PR은 프로젝트 CLAUDE.md 흐름(구현 → review-agent → mistake-managing-agent → git-agent)을 따른다 — 작업자가 Task마다 직접 커밋하지 않는다.** 단계는 체크박스(`- [ ]`)로 추적.

**Goal:** 봇 크롤링이 매 요청 유발하던 bars/FMP fundamental/뉴스 외부 호출·DB write를, SEO·품질 저하 없이 cross-request 캐싱/가드로 수렴시킨다.

**Architecture:** PPR(#439로 비활성) 없이 동작하는 데이터 레이어 캐싱. bars는 시장 세션별 동적 TTL(개장 중 60초/장외 다음 개장까지)이라 Redis, fundamentals는 Next Data Cache(`revalidate`), 뉴스는 Redis 플래그(봇 경로만 가드). TTL 정책 함수는 SCOPE상 siglens-core에 신설(분석 캐시 불변), Redis I/O는 siglens(optionsDataCache 패턴).

**Tech Stack:** Next.js 16(App Router), Upstash Redis(`@upstash/redis`), siglens-core(`@y0ngha/siglens-core`), Vitest, FMP, yahoo-finance2.

**스펙:** `docs/superpowers/specs/2026-05-28-bot-cost-caching-design.md`

---

## File Structure

### siglens-core (먼저)
- Modify `src/domain/utils.ts` — ET 세션 헬퍼(`isEtRegularSessionOpen`, `secondsUntilNextEtRegularOpen`) 추가.
- Modify `src/infrastructure/cache/config.ts` — `BARS_OPEN_TTL_SECONDS`, `BARS_OFFHOURS_TTL_CEILING_SECONDS`, `computeBarsEffectiveTtl` 추가.
- Modify `src/index.ts` — `computeBarsEffectiveTtl` public export.
- Modify `src/__tests__/domain/utils.test.ts` — ET 헬퍼 테스트.
- Create/Modify `src/__tests__/infrastructure/cache/config.test.ts` — `computeBarsEffectiveTtl` 테스트.

### siglens (core publish/link 후)
- Create `src/entities/bars/lib/barsDataCache.ts` — bars Redis 캐시(market-data).
- Modify `src/entities/bars/actions/getBarsAction.ts` — 캐시 위임 + 에러 매핑 유지.
- Create `src/entities/bars/__tests__/barsDataCache.test.ts`.
- Modify `src/entities/bars/__tests__/getBarsAction.test.ts` — redis/server-only mock 추가.
- Modify `src/shared/api/fmp/httpClient.ts` — `fmpGet`에 optional `revalidate`.
- Modify `src/shared/api/fmp/fundamentalClient.ts` — 로컬 wrapper로 revalidate 주입(call-site 무변경).
- Create `src/entities/news-article/lib/newsRefreshFlag.ts` — 뉴스 freshness Redis 플래그.
- Modify `src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts` — 봇 경로 가드.
- Modify/Create 관련 테스트.

---

## Part A — siglens-core (작업 디렉토리: `/Users/y0ngha/Project/siglens-core`)

> core는 siglens를 import하지 않는다. ET/DST 계산은 `domain/options/expirationSlots.ts`의 `Intl.DateTimeFormat('en-US',{timeZone:'America/New_York'})` 패턴을 미러링해 자체 수행한다. **기존 `computeEffectiveTtl`/`CACHE_EXPIRY_HOUR_KST`/분석 캐시는 절대 건드리지 않는다.**

### Task A1: ET 세션 헬퍼 (`src/domain/utils.ts`)

**Files:**
- Modify: `src/domain/utils.ts`
- Test: `src/__tests__/domain/utils.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `src/__tests__/domain/utils.test.ts`에 추가 (기존 import에 `isEtRegularSessionOpen`, `secondsUntilNextEtRegularOpen` 추가)

```ts
import {
    isEtRegularSessionOpen,
    secondsUntilNextEtRegularOpen,
} from '@/domain/utils';
import { SECONDS_PER_MINUTE } from '@/domain/constants/time';

describe('isEtRegularSessionOpen', () => {
    it('EDT 평일 정규장 중이면 true (Mon 10:00 ET)', () => {
        expect(isEtRegularSessionOpen(new Date('2026-07-06T14:00:00Z'))).toBe(true);
    });
    it('EST 평일 정규장 중이면 true (Mon 10:00 ET)', () => {
        expect(isEtRegularSessionOpen(new Date('2026-01-05T15:00:00Z'))).toBe(true);
    });
    it('개장 전이면 false (Mon 08:00 ET)', () => {
        expect(isEtRegularSessionOpen(new Date('2026-07-06T12:00:00Z'))).toBe(false);
    });
    it('마감 후면 false (Mon 17:00 ET)', () => {
        expect(isEtRegularSessionOpen(new Date('2026-07-06T21:00:00Z'))).toBe(false);
    });
    it('주말이면 false (Sat 14:00 ET)', () => {
        expect(isEtRegularSessionOpen(new Date('2026-07-04T18:00:00Z'))).toBe(false);
    });
});

describe('secondsUntilNextEtRegularOpen', () => {
    // 09:30 ET 개장. EDT는 13:30 UTC, EST는 14:30 UTC.
    it('EDT 개장 전 → 오늘 개장까지 (Mon 08:00 ET → 90분)', () => {
        expect(secondsUntilNextEtRegularOpen(new Date('2026-07-06T12:00:00Z')))
            .toBe(90 * SECONDS_PER_MINUTE); // 5400
    });
    it('EST 개장 전 → 오늘 개장까지 (Mon 09:00 ET → 30분)', () => {
        expect(secondsUntilNextEtRegularOpen(new Date('2026-01-05T14:00:00Z')))
            .toBe(30 * SECONDS_PER_MINUTE); // 1800
    });
    it('EDT 마감 후 → 다음 평일 개장까지 (Mon 17:00 ET → 16.5h)', () => {
        expect(secondsUntilNextEtRegularOpen(new Date('2026-07-06T21:00:00Z')))
            .toBe(990 * SECONDS_PER_MINUTE); // 59400
    });
    it('토요일 → 월요일 개장까지 (Sat 14:00 ET → 2610분)', () => {
        expect(secondsUntilNextEtRegularOpen(new Date('2026-07-04T18:00:00Z')))
            .toBe(2610 * SECONDS_PER_MINUTE); // 156600
    });
    it('금요일 마감 후 → 월요일 개장까지 (Fri 17:00 ET → 3870분)', () => {
        expect(secondsUntilNextEtRegularOpen(new Date('2026-07-03T21:00:00Z')))
            .toBe(3870 * SECONDS_PER_MINUTE); // 232200
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/__tests__/domain/utils.test.ts`. Expected: FAIL (`isEtRegularSessionOpen is not a function`).

- [ ] **Step 3: 구현** — `src/domain/utils.ts` 하단에 추가

```ts
/** US 정규장 개장 시각 = 09:30 ET → 분 단위(570). */
const ET_REGULAR_OPEN_MINUTES = 9 * 60 + 30;
/** US 정규장 마감 시각 = 16:00 ET → 분 단위(960). */
const ET_REGULAR_CLOSE_MINUTES = 16 * 60;

const ET_SESSION_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

const ET_WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

interface EtSessionParts {
    weekdayIndex: number; // 0=Sun … 6=Sat
    minutesOfDay: number; // 0..1439, ET wall-clock
}

function etSessionParts(now: Date): EtSessionParts {
    const parts = ET_SESSION_FORMATTER.formatToParts(now);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    const weekdayIndex = ET_WEEKDAY_INDEX[get('weekday')] ?? 0;
    // hour12:false는 자정에 '24'를 emit하는 ICU locale가 있어 24→0 정규화.
    const rawHour = Number.parseInt(get('hour'), 10);
    const hour = rawHour === 24 ? 0 : rawHour;
    const minute = Number.parseInt(get('minute'), 10);
    return { weekdayIndex, minutesOfDay: hour * 60 + minute };
}

/** `now`가 US 정규장(평일 09:30–16:00 ET) 중인지. DST-safe. */
export function isEtRegularSessionOpen(now: Date): boolean {
    const { weekdayIndex, minutesOfDay } = etSessionParts(now);
    if (weekdayIndex === 0 || weekdayIndex === 6) return false;
    return (
        minutesOfDay >= ET_REGULAR_OPEN_MINUTES &&
        minutesOfDay < ET_REGULAR_CLOSE_MINUTES
    );
}

/**
 * `now`로부터 다음 정규장 개장(평일 09:30 ET)까지 남은 초. DST-safe.
 *
 * ET wall-clock 분 단위로 계산하므로 분 미만 오차가 있고, DST 전환일(연 2회)에
 * 실제 경과시간과 최대 1h 차이가 날 수 있으나 캐시 TTL 용도라 무해하다.
 * 미 증시 휴장일은 캘린더가 없어 개장으로 간주한다(기존 캐시들과 동일).
 */
export function secondsUntilNextEtRegularOpen(now: Date): number {
    const { weekdayIndex, minutesOfDay } = etSessionParts(now);
    const isWeekday = weekdayIndex >= 1 && weekdayIndex <= 5;

    let dayOffset: number;
    if (isWeekday && minutesOfDay < ET_REGULAR_OPEN_MINUTES) {
        dayOffset = 0; // 오늘 개장이 아직 남음
    } else {
        dayOffset = 1;
        let wd = (weekdayIndex + 1) % 7;
        while (wd === 0 || wd === 6) {
            dayOffset += 1;
            wd = (wd + 1) % 7;
        }
    }

    const minutesUntilOpen =
        dayOffset * 24 * 60 + ET_REGULAR_OPEN_MINUTES - minutesOfDay;
    return minutesUntilOpen * 60;
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/__tests__/domain/utils.test.ts`. Expected: PASS.

### Task A2: `computeBarsEffectiveTtl` (`src/infrastructure/cache/config.ts`)

**Files:**
- Modify: `src/infrastructure/cache/config.ts`
- Test: `src/__tests__/infrastructure/cache/config.test.ts` (없으면 생성)

- [ ] **Step 1: 실패 테스트 작성** — `src/__tests__/infrastructure/cache/config.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
    computeBarsEffectiveTtl,
    BARS_OPEN_TTL_SECONDS,
    BARS_OFFHOURS_TTL_CEILING_SECONDS,
} from '@/infrastructure/cache/config';

describe('computeBarsEffectiveTtl', () => {
    it('개장 중이면 BARS_OPEN_TTL_SECONDS (Mon 10:00 ET)', () => {
        expect(computeBarsEffectiveTtl('1Day', new Date('2026-07-06T14:00:00Z')))
            .toBe(BARS_OPEN_TTL_SECONDS);
    });
    it('개장 중이면 timeframe 무관 동일 (5Min, Mon 10:00 ET)', () => {
        expect(computeBarsEffectiveTtl('5Min', new Date('2026-07-06T14:00:00Z')))
            .toBe(BARS_OPEN_TTL_SECONDS);
    });
    it('장외 + 다음 개장이 24h 이내면 그 시각까지 (Mon 17:00 ET → 59400s)', () => {
        expect(computeBarsEffectiveTtl('1Day', new Date('2026-07-06T21:00:00Z')))
            .toBe(59400);
    });
    it('장외 + 다음 개장이 24h 초과면 24h로 캡 (Sat 14:00 ET)', () => {
        expect(computeBarsEffectiveTtl('1Day', new Date('2026-07-04T18:00:00Z')))
            .toBe(BARS_OFFHOURS_TTL_CEILING_SECONDS);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/__tests__/infrastructure/cache/config.test.ts`. Expected: FAIL (export 없음).

- [ ] **Step 3: 구현** — `src/infrastructure/cache/config.ts`

import 라인 수정:
```ts
import {
    isEtRegularSessionOpen,
    secondsUntilNextEtRegularOpen,
    computeSecondsUntilCacheExpiry,
} from '@/domain/utils';
```
(기존 `computeSecondsUntilCacheExpiry` import에 두 함수 추가)

`computeEffectiveTtl` 정의 **아래**에 추가 (기존 함수는 그대로):
```ts
/** 개장 중 bars 캐시 TTL(초). 마지막 봉이 실시간 형성되나 FMP 시세는 최대 15분 지연이라 1분이면 충분. */
export const BARS_OPEN_TTL_SECONDS = SECONDS_PER_MINUTE;
/** 장외/주말 bars 캐시 TTL 상한(초). 다음 개장까지가 이보다 길면 이 값으로 캡. */
export const BARS_OFFHOURS_TTL_CEILING_SECONDS = SECONDS_PER_DAY;

/**
 * bars(OHLCV+지표) 캐시의 effective TTL(초)을 `now` 기준으로 계산.
 *
 * - 정규장 중: {@link BARS_OPEN_TTL_SECONDS}(60s) — 마지막 봉이 형성 중.
 * - 장외/주말: `min(`{@link BARS_OFFHOURS_TTL_CEILING_SECONDS}`, 다음 개장까지)` —
 *   마감 후 완성된 봉은 다음 개장 전까지 변하지 않으므로 개장 직전 만료.
 *
 * 분석 캐시({@link computeEffectiveTtl}, 마감 경계)와 달리 **개장 경계**를 쓴다.
 * @param timeframe - 봉 해상도(현재 모든 TF 동일 정책, 시그니처 일관성 위해 유지).
 * @param now - 기준 시각(테스트용).
 */
export function computeBarsEffectiveTtl(
    timeframe: Timeframe,
    now: Date
): number {
    void timeframe;
    if (isEtRegularSessionOpen(now)) return BARS_OPEN_TTL_SECONDS;
    return Math.min(
        BARS_OFFHOURS_TTL_CEILING_SECONDS,
        secondsUntilNextEtRegularOpen(now)
    );
}
```

> 주: `timeframe`은 현재 정책상 미사용이나, 향후 TF별 차등 및 호출부 일관성을 위해 시그니처에 유지(`void timeframe`로 unused lint 회피). lint가 `void` 패턴을 막으면 파라미터명을 `_timeframe`으로.

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/__tests__/infrastructure/cache/config.test.ts`. Expected: PASS.

### Task A3: public export (`src/index.ts`)

**Files:**
- Modify: `src/index.ts:278-284` (cache/config export 블록)

- [ ] **Step 1: export 추가** — `from './infrastructure/cache/config'` 블록에 추가:
```ts
    computeBarsEffectiveTtl,
    BARS_OPEN_TTL_SECONDS,
    BARS_OFFHOURS_TTL_CEILING_SECONDS,
```

- [ ] **Step 2: 타입/빌드 확인** — Run: `yarn typecheck && yarn build`. Expected: 성공, `dist/index.d.ts`에 `computeBarsEffectiveTtl` 노출.

- [ ] **Step 3: 전체 core 테스트** — Run: `yarn test`. Expected: PASS (분석 캐시 테스트 포함 무회귀).

### Task A4: core 변경 배포/연결

- [ ] **Step 1:** core 변경을 siglens가 import하려면 publish(GitHub Packages) + siglens 버전 bump, 또는 로컬 테스트용 link 필요. **사용자에게 방식 확인**(production: 버전 bump+publish / 로컬: `yarn link` 또는 `@y0ngha/siglens-core@file:../siglens-core`). 이후 siglens에서 `import { computeBarsEffectiveTtl } from '@y0ngha/siglens-core'`가 resolve되는지 `yarn typecheck`로 확인.

---

## Part B — siglens (작업 디렉토리: `/Users/y0ngha/Project/siglens`, Part A 배포 후)

### Task B1: bars Redis 캐시 모듈 (`barsDataCache.ts`)

**Files:**
- Create: `src/entities/bars/lib/barsDataCache.ts`
- Test: `src/entities/bars/__tests__/barsDataCache.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `optionsDataCache.test.ts` 패턴 미러링

```ts
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

vi.mock('server-only', () => ({}));

const { mockFetch, mockRedisGet, mockRedisSet, mockRedisCtor } = vi.hoisted(() => ({
    mockFetch: vi.fn(),
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
    mockRedisCtor: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    fetchBarsWithIndicators: mockFetch,
    computeBarsEffectiveTtl: vi.fn(() => 60),
}));

vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (opts: unknown) {
        mockRedisCtor(opts);
        return { get: mockRedisGet, set: mockRedisSet };
    }),
}));

vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }));

import type { BarsData } from '@y0ngha/siglens-core';

const sampleBars: BarsData = {
    bars: [{ time: 1, open: 1, high: 2, low: 0, close: 1, volume: 10 }],
    indicators: {} as BarsData['indicators'],
};

async function loadWithEnv(opts: { url?: string; token?: string }) {
    process.env.UPSTASH_REDIS_REST_URL = opts.url ?? '';
    process.env.UPSTASH_REDIS_REST_TOKEN = opts.token ?? '';
    vi.resetModules();
    return import('../lib/barsDataCache');
}

afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe('getCachedBarsWithIndicators', () => {
    beforeEach(() => vi.clearAllMocks());

    it('Redis env 없으면 fetch 직행', async () => {
        mockFetch.mockResolvedValue(sampleBars);
        const mod = await loadWithEnv({});
        const r = await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(mockRedisCtor).not.toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledWith('AAPL', '1Day', undefined);
        expect(r).toEqual(sampleBars);
    });

    it('Redis hit 시 fetch 안 함', async () => {
        mockRedisGet.mockResolvedValue(sampleBars);
        const mod = await loadWithEnv({ url: 'https://x.upstash.io', token: 't' });
        const r = await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(mockRedisGet).toHaveBeenCalledWith('bars:AAPL:1Day');
        expect(mockFetch).not.toHaveBeenCalled();
        expect(r).toEqual(sampleBars);
    });

    it('Redis miss 시 fetch 후 computeBarsEffectiveTtl로 set', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockFetch.mockResolvedValue(sampleBars);
        mockRedisSet.mockResolvedValue('OK');
        const mod = await loadWithEnv({ url: 'https://x.upstash.io', token: 't' });
        await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(mockRedisSet).toHaveBeenCalledWith('bars:AAPL:1Day', sampleBars, { ex: 60 });
    });

    it('fmpSymbol을 키에 포함', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockFetch.mockResolvedValue(sampleBars);
        const mod = await loadWithEnv({ url: 'https://x.upstash.io', token: 't' });
        await mod.getCachedBarsWithIndicators('SPX', '1Day', '^SPX');
        expect(mockRedisGet).toHaveBeenCalledWith('bars:SPX:1Day:^SPX');
    });

    it('빈 봉은 캐시하지 않음', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockFetch.mockResolvedValue({ ...sampleBars, bars: [] });
        const mod = await loadWithEnv({ url: 'https://x.upstash.io', token: 't' });
        await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('Redis get 예외는 흡수하고 fetch fallback', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockRejectedValue(new Error('redis down'));
        mockFetch.mockResolvedValue(sampleBars);
        const mod = await loadWithEnv({ url: 'https://x.upstash.io', token: 't' });
        const r = await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(errSpy).toHaveBeenCalled();
        expect(r).toEqual(sampleBars);
        errSpy.mockRestore();
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/bars/__tests__/barsDataCache.test.ts`. Expected: FAIL (모듈 없음).

- [ ] **Step 3: 구현** — `src/entities/bars/lib/barsDataCache.ts`

```ts
import 'server-only';
import { cache } from 'react';
import { Redis } from '@upstash/redis';
import {
    type BarsData,
    type Timeframe,
    fetchBarsWithIndicators,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';
import { withRetry } from '@/shared/lib/withRetry';
import { BARS_FMP_RETRY } from './barsRetry';

// optionsDataCache.ts와 같은 lazy-singleton 패턴.
let cachedRedis: Redis | null | undefined;

function getRedis(): Redis | null {
    if (cachedRedis !== undefined) return cachedRedis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        cachedRedis = null;
        return null;
    }
    cachedRedis = new Redis({ url, token });
    return cachedRedis;
}

/** fmpSymbol이 OHLCV 결과를 바꾸므로(예: '^SPX' vs 'SPX') 키에 포함. */
function buildBarsKey(symbol: string, timeframe: Timeframe, fmpSymbol?: string): string {
    const suffix = fmpSymbol ? `:${fmpSymbol.toUpperCase()}` : '';
    return `bars:${symbol.toUpperCase()}:${timeframe}${suffix}`;
}

/**
 * OHLCV+지표를 cache→FMP로 가져온다.
 *
 * 캐시 레이어:
 *   1. React.cache — 요청 내 dedup(layout/page가 같은 TF prefetch 시 1회).
 *   2. Upstash Redis — cross-request, 시장 세션별 TTL(core `computeBarsEffectiveTtl`).
 *      봇이 한 종목의 여러 탭을 연속 크롤링해도 fetch가 1회로 수렴.
 *      Redis 미설정 시 graceful fallback으로 FMP 직접 호출.
 *
 * 에러는 캐시하지 않는다(throw가 set 이전에 전파). 빈 봉도 캐시하지 않는다
 * (transient 장애를 TTL 동안 굳히지 않도록 — optionsDataCache의 null-caution과 동일).
 */
export const getCachedBarsWithIndicators = cache(
    async (
        symbol: string,
        timeframe: Timeframe,
        fmpSymbol?: string
    ): Promise<BarsData> => {
        const key = buildBarsKey(symbol, timeframe, fmpSymbol);
        const redis = getRedis();
        if (redis !== null) {
            try {
                const hit = await redis.get<BarsData>(key);
                if (hit !== null) return hit;
            } catch (error) {
                console.error('[barsDataCache] Redis get failed for', key, error);
            }
        }

        const fresh = await withRetry(
            () => fetchBarsWithIndicators(symbol, timeframe, fmpSymbol),
            BARS_FMP_RETRY
        );

        if (fresh.bars.length > 0 && redis !== null) {
            try {
                await redis.set(key, fresh, {
                    ex: computeBarsEffectiveTtl(timeframe, new Date()),
                });
            } catch (error) {
                console.error('[barsDataCache] Redis set failed for', key, error);
            }
        }
        return fresh;
    }
);
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/entities/bars/__tests__/barsDataCache.test.ts`. Expected: PASS.

### Task B2: `getBarsAction.ts` 위임

**Files:**
- Modify: `src/entities/bars/actions/getBarsAction.ts`
- Test: `src/entities/bars/__tests__/getBarsAction.test.ts`

- [ ] **Step 1: 기존 테스트에 mock 추가** — `getBarsAction.test.ts` 최상단(기존 `vi.mock('@/shared/lib/sleep'...)` 위)에 추가:
```ts
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
vi.mock('server-only', () => ({}));
vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(() => ({ get: vi.fn(), set: vi.fn() })),
}));
```
(나머지 기존 테스트 케이스는 그대로 — Redis env 미설정이라 fallback 경로로 `fetchBarsWithIndicators`를 그대로 호출, 위임·재시도·에러 매핑 동작 불변.)

- [ ] **Step 2: 실패/회귀 확인** — Run: `yarn test src/entities/bars/__tests__/getBarsAction.test.ts`. Expected: 일부 FAIL 가능(아직 getBarsAction 미수정 시 import 경로/Redis import로 인한). 다음 Step 후 PASS 목표.

- [ ] **Step 3: 구현** — `getBarsAction.ts` 전체 교체

```ts
'use server';

import { type BarsData, type Timeframe } from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '../lib/barsDataCache';
import {
    getFmpUserFacingMessage,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    try {
        return await getCachedBarsWithIndicators(symbol, timeframe, fmpSymbol);
    } catch (error) {
        logFmpPaymentRequiredError(error);
        const message = getFmpUserFacingMessage(error);
        if (message !== null) {
            throw new Error(message, { cause: error });
        }
        throw error;
    }
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/entities/bars/__tests__/`. Expected: PASS (barsDataCache + getBarsAction 모두).

### Task B3: `fmpGet` revalidate (item 2)

**Files:**
- Modify: `src/shared/api/fmp/httpClient.ts`
- Modify: `src/shared/api/fmp/fundamentalClient.ts`
- Test: 기존 `httpClient`/`fundamentalClient` 테스트(있으면) 갱신, 없으면 httpClient revalidate 단위 테스트 추가.

- [ ] **Step 1: 실패 테스트 작성** — `src/shared/api/fmp/__tests__/httpClient.test.ts` (없으면 생성; 있으면 케이스 추가). `global.fetch`를 mock해 옵션 전달 검증:
```ts
it('revalidate 미지정 시 no-store', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 })
    );
    await fmpGet('profile', { symbol: 'AAPL' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
});
it('revalidate 지정 시 next.revalidate 사용', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 })
    );
    await fmpGet('profile', { symbol: 'AAPL' }, { revalidate: 3600 });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 3600 } });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/shared/api/fmp/__tests__/httpClient.test.ts`. Expected: FAIL.

- [ ] **Step 3: 구현 — httpClient.ts** — `fmpGet` 시그니처/fetch 옵션 수정:
```ts
export async function fmpGet<T>(
    path: string,
    query: Record<string, string> = {},
    opts: { revalidate?: number } = {}
): Promise<T> {
    const { apiKey } = readFmpConfig();
    const params = new URLSearchParams({ ...query, apikey: apiKey });

    return withRetry(async () => {
        const res = await fetch(`${FMP_STABLE_BASE}/${path}?${params.toString()}`, {
            ...(opts.revalidate !== undefined
                ? { next: { revalidate: opts.revalidate } }
                : { cache: 'no-store' }),
            signal: AbortSignal.timeout(FMP_FETCH_TIMEOUT_MS),
        });
        if (!res.ok) {
            const retryAfter = parseRetryAfterSeconds(res.headers.get('Retry-After'));
            const error = new FmpHttpError(path, res.status, retryAfter);
            logFmpPaymentRequiredError(error);
            throw error;
        }
        return (await res.json()) as T;
    }, FMP_TRANSIENT_RETRY);
}
```

- [ ] **Step 4: 구현 — fundamentalClient.ts** — call-site 무변경 위해 import shadowing. 파일 상단 import 수정:
```ts
import { fmpGet as fmpGetRaw } from './httpClient';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/** 펀더멘털 데이터는 장중에도 거의 불변 → 1시간 cross-request 캐시. */
const FMP_FUNDAMENTAL_REVALIDATE_SECONDS = SECONDS_PER_HOUR;

function fmpGet<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    return fmpGetRaw<T>(path, query, { revalidate: FMP_FUNDAMENTAL_REVALIDATE_SECONDS });
}
```
(기존 `import { fmpGet } from './httpClient';`를 위 형태로 교체. 파일 내 모든 `fmpGet<...>(...)` 호출은 자동으로 wrapper 경유 → revalidate 적용. `fmpNewsClient.ts`는 변경 없음 → no-store 유지.)

- [ ] **Step 5: 통과 확인** — Run: `yarn test src/shared/api/fmp/`. Expected: PASS.

### Task B4: 뉴스 freshness 플래그 (`newsRefreshFlag.ts`)

**Files:**
- Create: `src/entities/news-article/lib/newsRefreshFlag.ts`
- Test: `src/entities/news-article/__tests__/newsRefreshFlag.test.ts`

- [ ] **Step 1: 실패 테스트 작성**
```ts
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
vi.mock('server-only', () => ({}));

const { mockGet, mockSet, mockCtor } = vi.hoisted(() => ({
    mockGet: vi.fn(), mockSet: vi.fn(), mockCtor: vi.fn(),
}));
vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (o: unknown) {
        mockCtor(o); return { get: mockGet, set: mockSet };
    }),
}));

async function loadWithEnv(opts: { url?: string; token?: string }) {
    process.env.UPSTASH_REDIS_REST_URL = opts.url ?? '';
    process.env.UPSTASH_REDIS_REST_TOKEN = opts.token ?? '';
    vi.resetModules();
    return import('../lib/newsRefreshFlag');
}
afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe('newsRefreshFlag', () => {
    beforeEach(() => vi.clearAllMocks());
    it('Redis 없으면 isRecentlyFetched=false, markFetched noop', async () => {
        const mod = await loadWithEnv({});
        expect(await mod.isRecentlyFetched('AAPL')).toBe(false);
        await mod.markFetched('AAPL');
        expect(mockCtor).not.toHaveBeenCalled();
    });
    it('플래그 있으면 isRecentlyFetched=true', async () => {
        mockGet.mockResolvedValue('1');
        const mod = await loadWithEnv({ url: 'https://x.upstash.io', token: 't' });
        expect(await mod.isRecentlyFetched('AAPL')).toBe(true);
        expect(mockGet).toHaveBeenCalledWith('news:refresh:AAPL');
    });
    it('markFetched는 TTL과 함께 set', async () => {
        mockSet.mockResolvedValue('OK');
        const mod = await loadWithEnv({ url: 'https://x.upstash.io', token: 't' });
        await mod.markFetched('AAPL');
        expect(mockSet).toHaveBeenCalledWith(
            'news:refresh:AAPL', '1', { ex: mod.NEWS_REFRESH_FLAG_TTL_SECONDS }
        );
    });
    it('Redis get 예외는 흡수하고 false', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockGet.mockRejectedValue(new Error('down'));
        const mod = await loadWithEnv({ url: 'https://x.upstash.io', token: 't' });
        expect(await mod.isRecentlyFetched('AAPL')).toBe(false);
        errSpy.mockRestore();
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/news-article/__tests__/newsRefreshFlag.test.ts`. Expected: FAIL.

- [ ] **Step 3: 구현** — `src/entities/news-article/lib/newsRefreshFlag.ts`
```ts
import 'server-only';
import { Redis } from '@upstash/redis';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';

/** 뉴스 refresh 플래그 TTL — 이 시간 내 재크롤링(봇)은 FMP fetch+upsert를 스킵. */
export const NEWS_REFRESH_FLAG_TTL_SECONDS = 10 * SECONDS_PER_MINUTE;

let cachedRedis: Redis | null | undefined;
function getRedis(): Redis | null {
    if (cachedRedis !== undefined) return cachedRedis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) { cachedRedis = null; return null; }
    cachedRedis = new Redis({ url, token });
    return cachedRedis;
}

function buildKey(symbol: string): string {
    return `news:refresh:${symbol.toUpperCase()}`;
}

/** 최근(TTL 내) 이 symbol의 뉴스를 fetch했는지. Redis 미설정/장애 시 false(=항상 fetch). */
export async function isRecentlyFetched(symbol: string): Promise<boolean> {
    const redis = getRedis();
    if (redis === null) return false;
    try {
        return (await redis.get(buildKey(symbol))) !== null;
    } catch (error) {
        console.error('[newsRefreshFlag] get failed', error);
        return false;
    }
}

/** 이 symbol을 "최근 fetch함"으로 표시. Redis 미설정/장애 시 noop. */
export async function markFetched(symbol: string): Promise<void> {
    const redis = getRedis();
    if (redis === null) return;
    try {
        await redis.set(buildKey(symbol), '1', { ex: NEWS_REFRESH_FLAG_TTL_SECONDS });
    } catch (error) {
        console.error('[newsRefreshFlag] set failed', error);
    }
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/entities/news-article/__tests__/newsRefreshFlag.test.ts`. Expected: PASS.

### Task B5: 뉴스 액션에 봇 가드 적용

**Files:**
- Modify: `src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts`
- Test: `src/entities/news-article/__tests__/ensureNewsCardsAnalyzedAction.test.ts` (있으면 갱신, 없으면 생성)

- [ ] **Step 1: 실패 테스트 작성/갱신** — `newsRefreshFlag`와 `FmpNewsClient`, repo를 mock해 검증:
  - 봇(`skipAnalysis:true`) + `isRecentlyFetched=true` → `fetchNewsForPeriod` 미호출, `upsertNewsItem` 미호출, 즉시 return.
  - 봇 + `isRecentlyFetched=false` → fetch + upsert 호출, `markFetched` 호출.
  - 사람(`skipAnalysis` 미지정) → `isRecentlyFetched` 무관하게 fetch + upsert(가드 미적용), `markFetched` 호출.
```ts
vi.mock('../lib/newsRefreshFlag', () => ({
    isRecentlyFetched: vi.fn(),
    markFetched: vi.fn(),
}));
// FmpNewsClient.fetchNewsForPeriod, DrizzleNewsRepository.upsertNewsItem 등 mock는
// 기존 테스트 패턴을 따른다.
import { isRecentlyFetched, markFetched } from '../lib/newsRefreshFlag';

it('봇 + 최근 fetch됨 → FMP/upsert 스킵', async () => {
    (isRecentlyFetched as Mock).mockResolvedValue(true);
    await ensureNewsCardsAnalyzedAction('AAPL', { skipAnalysis: true });
    expect(mockFetchNewsForPeriod).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
});
it('봇 + 미fetch → fetch+upsert+markFetched', async () => {
    (isRecentlyFetched as Mock).mockResolvedValue(false);
    mockFetchNewsForPeriod.mockResolvedValue([/* 1 item */]);
    await ensureNewsCardsAnalyzedAction('AAPL', { skipAnalysis: true });
    expect(mockFetchNewsForPeriod).toHaveBeenCalled();
    expect(markFetched).toHaveBeenCalledWith('AAPL');
});
it('사람 → 가드 무시하고 항상 fetch', async () => {
    (isRecentlyFetched as Mock).mockResolvedValue(true);
    mockFetchNewsForPeriod.mockResolvedValue([/* 1 item */]);
    await ensureNewsCardsAnalyzedAction('AAPL');
    expect(mockFetchNewsForPeriod).toHaveBeenCalled();
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test .../ensureNewsCardsAnalyzedAction.test.ts`. Expected: FAIL.

- [ ] **Step 3: 구현** — 액션 수정. import 추가:
```ts
import { isRecentlyFetched, markFetched } from '../lib/newsRefreshFlag';
```
함수 본문 변경 — 맨 앞에 봇 가드, upsert 성공 후 markFetched:
```ts
export async function ensureNewsCardsAnalyzedAction(
    symbol: string,
    options?: { skipAnalysis?: boolean }
): Promise<void> {
    // 봇 경로만 가드: 최근 TTL 내 fetch했으면 FMP fetch + N건 DB upsert를 스킵한다.
    // 봇은 DB의 기존 뉴스를 그대로 읽으므로 SEO 무해. 사람 경로는 항상 fresh.
    if (options?.skipAnalysis && (await isRecentlyFetched(symbol))) {
        return;
    }

    const newsClient = new FmpNewsClient();
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);

    const fresh = await newsClient
        .fetchNewsForPeriod(symbol, NEWS_LOOKBACK_MS)
        .catch((err: unknown) => {
            /* 기존 에러 처리 유지 */
            logFmpPaymentRequiredError(err);
            if (getFmpUserFacingMessage(err) === null && !isFmpPaymentRequiredError(err)) {
                console.error('[ensureNewsCardsAnalyzedAction] FMP fetch failed:', err);
            }
            return null;
        });
    if (fresh === null) return;

    /* 기존 upsert + majority-failure 체크 블록 그대로 */

    // fetch+upsert 성공 → 플래그 warm(봇/사람 무관). 다음 봇 크롤링이 스킵된다.
    await markFetched(symbol);

    if (fresh.length === 0) return;
    if (options?.skipAnalysis) return;

    /* 기존 analyze 블록 그대로 */
}
```
(주: `markFetched`는 majority-failure `throw` 이후·`fresh.length===0` 체크 이전에 둔다. throw 시엔 호출되지 않아 장애 상태를 flag로 굳히지 않는다.)

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/entities/news-article/`. Expected: PASS.

### Task B6: 전체 검증

- [ ] **Step 1:** Run `yarn typecheck`. Expected: 에러 없음.
- [ ] **Step 2:** Run `yarn lint`. Expected: 통과.
- [ ] **Step 3:** Run `yarn test`. Expected: 전체 PASS, 커버리지 회귀 없음.
- [ ] **Step 4:** (가능 시) `yarn dev` 후 봇 UA로 `/AAPL`, `/AAPL/fundamental`, `/AAPL/news`를 연속 요청해 Redis 캐시 히트 / FMP 호출 감소를 콘솔/네트워크로 관찰.

---

## 커밋 / PR (프로젝트 흐름)

작업자는 Task마다 커밋하지 않는다. Part A 완료 후 core 레포에서, Part B 완료 후 siglens 레포에서 각각:
구현 완료 → **review-agent** → (findings 수정) → **mistake-managing-agent** → **git-agent**(커밋·PR). 두 레포는 별도 PR이며 core가 먼저 머지·publish된 뒤 siglens PR이 새 버전을 가리킨다(SCOPE §5).

## Self-Review 결과 (스펙 대비)
- 스펙 §5.1 ET 헬퍼 → A1. §5.2 computeBarsEffectiveTtl → A2. §5.3 export/테스트 → A3.
- §6.1 barsDataCache → B1. §6.2 getBarsAction → B2. §6.3 fmpGet/fundamental → B3. §6.4 뉴스 봇 가드 → B4+B5. §6.5 테스트 → 각 Task에 동봉. §7 워크플로 → A4 + 커밋 섹션.
- 타입/이름 일관성: `computeBarsEffectiveTtl`, `getCachedBarsWithIndicators`, `isRecentlyFetched`/`markFetched`, 키 `bars:<SYM>:<TF>[:<FMP>]` / `news:refresh:<SYM>` — Task 간 일치 확인.
- 비-목표(휴장일 캘린더/라우트 ISR/market summary/사람 뉴스 캐싱/분석 캐시 변경) 미포함 확인.
