# market 페이지 ISR 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/market` 페이지를 dynamic(SSR)에서 ISR로 전환하되, 3계층 캐시(Redis→React cache→Next ISR)를 `[symbol]`과 정렬하고 SEO/E2E를 무손상으로 유지한다.

**Architecture:** `[symbol]` ISR 4축 규약을 정적 라우트 `/market`에 매핑한다. summary/sector signals를 `unstable_cache`로 정적화(축 1), searchParams를 클라 `useSearchParams`로 이전(축 2), `revalidate=3600` 리터럴 추가(축 3). briefing·봇판정은 side-effect라 클라 전용 action으로 분리하고, cached briefing은 core `peekBriefingCache`로 SSR seed한다.

**Tech Stack:** Next.js 16(App Router, ISR), `unstable_cache`, `@upstash/redis`(`getOrSetCache`), `@tanstack/react-query`, `@y0ngha/siglens-core`, vitest, Playwright.

**스펙:** `docs/superpowers/specs/2026-06-04-market-isr-design.md` (SHA d268fa57)

**작업 worktree (2개 레포):**
| 레포 | worktree | 브랜치 |
|---|---|---|
| siglens-core | `/Users/y0ngha/Project/siglens-core/.claude/worktrees/market-briefing-peek` | `worktree-market-briefing-peek` |
| siglens | `/Users/y0ngha/Project/siglens/.claude/worktrees/market-isr` | `worktree-market-isr` |

> **경로 규약:** 이하 모든 siglens 파일 경로는 siglens worktree 기준 상대경로다. siglens-core 작업(Phase 1)만 siglens-core worktree에서 수행한다.

---

## Phase 0: 환경 준비

### Task 0.1: 두 worktree node_modules 준비 (`cp -al` 하드링크)

**근거:** `docs/qa/QA_ENV_SETUP.md` §5 — node_modules symlink 금지(Turbopack 거부 + dual-React 실패). `cp -al` 하드링크 후 잔여 `node_modules/node_modules` 제거.

- [ ] **Step 1: siglens worktree node_modules 하드링크**

```bash
cd /Users/y0ngha/Project/siglens
cp -al node_modules .claude/worktrees/market-isr/node_modules
rm -rf .claude/worktrees/market-isr/node_modules/node_modules
```

- [ ] **Step 2: siglens-core worktree node_modules 하드링크**

```bash
cd /Users/y0ngha/Project/siglens-core
cp -al node_modules .claude/worktrees/market-briefing-peek/node_modules
rm -rf .claude/worktrees/market-briefing-peek/node_modules/node_modules
```

- [ ] **Step 3: 빌드 가능 확인 (siglens worktree typecheck)**

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/market-isr
yarn typecheck > /tmp/tc-baseline.log 2>&1; echo "EXIT=$?"
```
Expected: EXIT=0 (master 기준이라 깨끗해야 함). 실패 시 하드링크/잔여 node_modules 점검.

---

## Phase 1: siglens-core — `peekBriefingCache` (스펙 A-1)

> **수행 위치:** `/Users/y0ngha/Project/siglens-core/.claude/worktrees/market-briefing-peek`
> 이 Phase 산출물(dist)은 Phase 2 끝에서 siglens node_modules로 덮어쓴다.

### Task 1.1: `hashBriefingInput`을 공유 모듈로 추출

**Files:**
- Create: `src/application/market/briefingInputHash.ts`
- Modify: `src/application/market/submitBriefing.ts` (private `hashBriefingInput` 제거 → import)
- Test: `src/__tests__/application/market/briefingInputHash.test.ts`

**근거:** `peekBriefingCache`가 `submitBriefing`과 **동일 캐시 키**를 만들어야 HIT한다. 현재 `hashBriefingInput`은 `submitBriefing.ts` private 함수라 공유 불가 → 추출.

- [ ] **Step 1: 추출 모듈 작성** (submitBriefing.ts의 기존 함수를 그대로 이동)

`src/application/market/briefingInputHash.ts`:
```ts
import type { MarketIndexData, MarketSectorData } from '@/domain/types';
import { hashAnalysisInput } from '@/infrastructure/hash/analysisInput';

/**
 * Derive a short deterministic hash of the index/sector values driving the
 * briefing prompt. Identity + quote values (`price`, `changesPercentage`) only —
 * the fields that change intra-hour. Order-independent (sorted by identifier).
 * Shared by submitBriefing (write key) and peekBriefingCache (read key) so both
 * resolve to the SAME cache entry.
 */
export function hashBriefingInput(
    indices: readonly MarketIndexData[],
    sectors: readonly MarketSectorData[]
): string {
    const sortedIndices = indices
        .map(i => ({
            fmpSymbol: i.fmpSymbol,
            price: i.price,
            changesPercentage: i.changesPercentage,
        }))
        .toSorted((a, b) => a.fmpSymbol.localeCompare(b.fmpSymbol));
    const sortedSectors = sectors
        .map(s => ({
            symbol: s.symbol,
            price: s.price,
            changesPercentage: s.changesPercentage,
        }))
        .toSorted((a, b) => a.symbol.localeCompare(b.symbol));
    return hashAnalysisInput(
        JSON.stringify({ indices: sortedIndices, sectors: sortedSectors })
    );
}
```

- [ ] **Step 2: `submitBriefing.ts`에서 private 함수 삭제 + import**

`submitBriefing.ts`: `function hashBriefingInput(...) {...}` 블록 전체 삭제, 상단에 추가:
```ts
import { hashBriefingInput } from './briefingInputHash';
```
(호출부 `const inputHash = hashBriefingInput(data.indices, data.sectors);`는 그대로.)

- [ ] **Step 3: 테스트 — Happy + Worst**

`briefingInputHash.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashBriefingInput } from '@/application/market/briefingInputHash';

const idx = (fmpSymbol: string, price: number, ch: number) =>
    ({ fmpSymbol, price, changesPercentage: ch }) as any;
const sec = (symbol: string, price: number, ch: number) =>
    ({ symbol, price, changesPercentage: ch }) as any;

describe('hashBriefingInput', () => {
    it('(Happy) 같은 입력은 같은 해시', () => {
        const a = hashBriefingInput([idx('^GSPC', 1, 0.1)], [sec('XLK', 2, 0.2)]);
        const b = hashBriefingInput([idx('^GSPC', 1, 0.1)], [sec('XLK', 2, 0.2)]);
        expect(a).toBe(b);
        expect(a).toMatch(/^[0-9a-f]{16}$/);
    });
    it('(Happy) 배열 순서 무관 — 정렬로 동일 해시', () => {
        const a = hashBriefingInput([], [sec('XLK', 1, 0), sec('XLF', 2, 0)]);
        const b = hashBriefingInput([], [sec('XLF', 2, 0), sec('XLK', 1, 0)]);
        expect(a).toBe(b);
    });
    it('(Worst) price 변동 시 해시 변경', () => {
        const a = hashBriefingInput([], [sec('XLK', 1, 0)]);
        const b = hashBriefingInput([], [sec('XLK', 9, 0)]);
        expect(a).not.toBe(b);
    });
    it('(Worst) 빈 입력도 결정적 해시', () => {
        expect(hashBriefingInput([], [])).toBe(hashBriefingInput([], []));
    });
});
```

- [ ] **Step 4: 테스트 + 기존 submitBriefing 테스트 회귀 확인**

```bash
yarn test src/__tests__/application/market/briefingInputHash.test.ts src/__tests__/application/market/submitBriefing.test.ts
```
Expected: PASS (submitBriefing은 동작 불변 — 동일 함수 이동만).

- [ ] **Step 5: Commit**

```bash
git add src/application/market/briefingInputHash.ts src/application/market/submitBriefing.ts src/__tests__/application/market/briefingInputHash.test.ts
git commit -m "refactor(briefing): extract hashBriefingInput for peek/submit key sharing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.2: `peekBriefingCache` 신설 + export

**Files:**
- Create: `src/application/market/peekBriefingCache.ts`
- Modify: `src/index.ts` (export 추가)
- Test: `src/__tests__/application/market/peekBriefingCache.test.ts`

**근거:** `peekAnalysisCache`의 briefing 버전. side-effect 없는 읽기 전용 cached 조회.

- [ ] **Step 1: 구현** (peekAnalysisCache + submitBriefing cached 분기 패턴)

`src/application/market/peekBriefingCache.ts`:
```ts
import { normalizeMarketBriefing } from '@/domain/analysis/normalizeMarketBriefing';
import { ISO_DATE_HOUR_PREFIX_LENGTH } from '@/domain/constants/format';
import type { MarketBriefingResponse, MarketSummaryData } from '@/domain/types';
import {
    BRIEFING_MODEL_ID,
    buildBriefingCacheKey,
} from '@/infrastructure/cache/config';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import type { CachedBriefingData } from '@/infrastructure/cache/types';
import { hashBriefingInput } from './briefingInputHash';

/**
 * Read a cached market briefing WITHOUT submitting a job (read-only twin of
 * {@link submitBriefing}'s `cached` branch). Reuses the EXACT same cache key
 * (date+hour + model + input hash) and `normalizeMarketBriefing` path, but omits
 * the worker dispatch entirely. Zero side effects.
 *
 * For SSR: an RSC surfaces a cached briefing in initial HTML at zero cost; a
 * cold cache (no provider / miss / read error) resolves to `null` so the client
 * can trigger generation through the normal submit path.
 *
 * @param data - Market summary input (indices + sector ETFs).
 * @param modelId - Briefing model id; defaults to BRIEFING_MODEL_ID (the same
 *   default submitBriefing writes under) so an un-modelled peek reads the same key.
 * @returns Normalized briefing on a hit, or `null` on miss/cold/error.
 */
export async function peekBriefingCache(
    data: MarketSummaryData,
    modelId: string = BRIEFING_MODEL_ID
): Promise<MarketBriefingResponse | null> {
    const cache = createCacheProvider();
    if (cache === null) return null;

    const now = new Date();
    const dateHour = now.toISOString().slice(0, ISO_DATE_HOUR_PREFIX_LENGTH);
    const inputHash = hashBriefingInput(data.indices, data.sectors);
    const cacheKey = buildBriefingCacheKey(dateHour, modelId, inputHash);

    const cached = await cache
        .get<CachedBriefingData>(cacheKey)
        .catch((error: unknown) => {
            console.error('[Peek] Briefing cache read failed:', error);
            return null;
        });
    if (cached == null) return null;

    try {
        return normalizeMarketBriefing(cached.briefing);
    } catch (error) {
        console.error('[Peek] Briefing cache payload invalid:', error);
        return null;
    }
}
```

- [ ] **Step 2: `src/index.ts`에 export 추가** (Tier 1 Market analysis 블록, `peekAnalysisCache` 다음 줄)

```ts
export { peekBriefingCache } from './application/market/peekBriefingCache';
```

- [ ] **Step 3: 테스트 — Happy + Worst** (cache provider mock)

`peekBriefingCache.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
vi.mock('@/infrastructure/cache/redis', () => ({
    createCacheProvider: () => providerOverride,
}));
let providerOverride: { get: typeof getMock } | null = { get: getMock };

vi.mock('@/domain/analysis/normalizeMarketBriefing', () => ({
    normalizeMarketBriefing: (b: unknown) => ({ normalized: b }) as any,
}));

import { peekBriefingCache } from '@/application/market/peekBriefingCache';

const summary = { indices: [], sectors: [] } as any;

beforeEach(() => {
    getMock.mockReset();
    providerOverride = { get: getMock };
});

describe('peekBriefingCache', () => {
    it('(Happy) cache HIT → normalized briefing', async () => {
        getMock.mockResolvedValue({ briefing: { raw: 1 }, generatedAt: 'x' });
        const r = await peekBriefingCache(summary);
        expect(r).toEqual({ normalized: { raw: 1 } });
    });
    it('(Worst) cache MISS(null) → null', async () => {
        getMock.mockResolvedValue(null);
        expect(await peekBriefingCache(summary)).toBeNull();
    });
    it('(Worst) provider 부재 → null, get 미호출', async () => {
        providerOverride = null;
        expect(await peekBriefingCache(summary)).toBeNull();
        expect(getMock).not.toHaveBeenCalled();
    });
    it('(Worst) get throw → null (degrade)', async () => {
        getMock.mockRejectedValue(new Error('redis down'));
        expect(await peekBriefingCache(summary)).toBeNull();
    });
    it('(Worst) normalize throw → null', async () => {
        getMock.mockResolvedValue({ briefing: 'corrupt' });
        const { normalizeMarketBriefing } = await import(
            '@/domain/analysis/normalizeMarketBriefing'
        );
        (normalizeMarketBriefing as any).mockImplementationOnce(() => {
            throw new Error('bad json');
        });
        expect(await peekBriefingCache(summary)).toBeNull();
    });
});
```

> 검증 시 실제 mock 경로/방식은 core의 기존 `peekAnalysisCache.test.ts` 스타일에 맞춘다(provider DI mock). 위는 의도를 보여주는 골격 — core 테스트 컨벤션으로 정렬.

- [ ] **Step 4: 테스트 실행 + 커버리지**

```bash
yarn test src/__tests__/application/market/peekBriefingCache.test.ts --coverage
```
Expected: PASS, peekBriefingCache.ts 라인/브랜치 ≥90%.

- [ ] **Step 5: Commit**

```bash
git add src/application/market/peekBriefingCache.ts src/index.ts src/__tests__/application/market/peekBriefingCache.test.ts
git commit -m "feat(briefing): add read-only peekBriefingCache for SSR seed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.3: core build → siglens worktree node_modules 덮어쓰기

**근거:** publish 병목 우회(스펙 결정 ①). siglens가 `peekBriefingCache`를 import하려면 dist가 필요.

- [ ] **Step 1: core 빌드** (파이프 없이 exit code 캡처)

```bash
cd /Users/y0ngha/Project/siglens-core/.claude/worktrees/market-briefing-peek
yarn build > /tmp/core-build.log 2>&1; echo "EXIT=$?"
```
Expected: EXIT=0. `dist/application/market/peekBriefingCache.js` + `.d.ts` 생성 확인:
```bash
ls dist/application/market/peekBriefingCache.*
grep peekBriefingCache dist/index.d.ts
```

- [ ] **Step 2: siglens worktree node_modules에 dist 덮어쓰기**

```bash
rm -rf /Users/y0ngha/Project/siglens/.claude/worktrees/market-isr/node_modules/@y0ngha/siglens-core/dist
cp -R dist /Users/y0ngha/Project/siglens/.claude/worktrees/market-isr/node_modules/@y0ngha/siglens-core/dist
# package.json도 함께 (export map 변경 가능성 대비)
cp package.json /Users/y0ngha/Project/siglens/.claude/worktrees/market-isr/node_modules/@y0ngha/siglens-core/package.json
```

- [ ] **Step 3: siglens에서 import 해석 확인**

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/market-isr
node -e "console.log(typeof require('@y0ngha/siglens-core').peekBriefingCache)"
```
Expected: `function`.

> ⚠️ **메모리 규약:** core 정식 publish는 사용자가 추후 수행. 이 덮어쓰기는 개발/검증용. siglens PR 머지 전 core PR이 publish되어야 CI가 통과한다(plan 말미 핸드오프 노트 참조).

---

## Phase 2: siglens 데이터 레이어 (스펙 A-2, A-3)

> 이후 모든 작업: `/Users/y0ngha/Project/siglens/.claude/worktrees/market-isr`

### Task 2.1: sector signals Redis 계층 — `getCachedSectorSignals` (A-3)

**Files:**
- Create: `src/entities/sector-signal/lib/sectorSignalsCache.ts`
- Modify: `src/entities/sector-signal/actions/getSectorSignalsAction.ts`
- Test: `src/entities/sector-signal/__tests__/sectorSignalsCache.test.ts`

**근거:** `marketSummaryCache.ts` 패턴 복제 — `[symbol]` bars와 동일 3계층 정렬.

- [ ] **Step 1: 구현** (marketSummaryCache.ts 미러)

`src/entities/sector-signal/lib/sectorSignalsCache.ts`:
```ts
import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    type DashboardTimeframe,
    type MarketDataProvider,
    type SectorSignalsResult,
    type Timeframe,
    getSectorSignals,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';

/** sector signals도 bars 일봉 TTL 정책을 재사용 — timeframe과 무관한 placeholder. */
const SIGNALS_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/**
 * 섹터 신호를 cache→provider로 가져온다. marketSummaryCache와 동일 3계층:
 *   1. React.cache — 요청 내 dedup.
 *   2. Upstash Redis — cross-request, `computeBarsEffectiveTtl`(장중 1분 / 장외 동적).
 * stocks가 빈 결과(전면 실패)는 캐시하지 않는다 — transient 장애를 TTL 동안 굳히지 않도록.
 * 키는 timeframe별로 분리(`sector-signals:{tf}`).
 */
export const getCachedSectorSignals = cache(
    async (
        provider: MarketDataProvider,
        timeframe: DashboardTimeframe
    ): Promise<SectorSignalsResult> =>
        getOrSetCache(
            `sector-signals:${timeframe}`,
            computeBarsEffectiveTtl(SIGNALS_TTL_TIMEFRAME, new Date()),
            () => getSectorSignals(provider, timeframe),
            result => result.stocks.length > 0
        )
);
```

- [ ] **Step 2: `getSectorSignalsAction`이 캐시 헬퍼 사용하도록 변경**

`getSectorSignalsAction.ts`: `getSectorSignals(getMarketDataProvider(), timeframe)` 호출을 교체.
```ts
import { getCachedSectorSignals } from '../lib/sectorSignalsCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
// ...
return await getCachedSectorSignals(
    getMarketDataProvider(),
    timeframe ?? DEFAULT_DASHBOARD_TIMEFRAME
);
```
(기존 `getSectorSignals` import 제거. catch degrade 블록 유지.)

- [ ] **Step 3: 테스트 — Happy + Worst** (`getOrSetCache` mock)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getOrSet = vi.fn();
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache: (...a: any[]) => getOrSet(...a) }));
vi.mock('@y0ngha/siglens-core', async (orig) => ({
    ...(await orig() as object),
    getSectorSignals: vi.fn(async () => ({ computedAt: 'x', stocks: [{ id: 1 }] })),
    computeBarsEffectiveTtl: () => 60,
}));
import { getCachedSectorSignals } from '@/entities/sector-signal/lib/sectorSignalsCache';

beforeEach(() => getOrSet.mockReset());

describe('getCachedSectorSignals', () => {
    it('(Happy) key=sector-signals:{tf}, ttl, fetcher, guard 전달', async () => {
        getOrSet.mockImplementation((_k, _ttl, fetcher) => fetcher());
        const r = await getCachedSectorSignals({} as any, '1Day' as any);
        expect(getOrSet).toHaveBeenCalledWith('sector-signals:1Day', 60, expect.any(Function), expect.any(Function));
        expect(r.stocks).toHaveLength(1);
    });
    it('(Worst) guard: 빈 stocks → 캐시 안 함 (shouldCache=false)', async () => {
        getOrSet.mockImplementation((_k, _ttl, _f, guard) => {
            expect(guard({ stocks: [] })).toBe(false);
            expect(guard({ stocks: [{}] })).toBe(true);
            return { computedAt: 'x', stocks: [] };
        });
        await getCachedSectorSignals({} as any, '1Week' as any);
        expect(getOrSet).toHaveBeenCalledWith('sector-signals:1Week', 60, expect.any(Function), expect.any(Function));
    });
});
```
Worst 추가: getSectorSignalsAction이 throw 시 `{computedAt, stocks: []}` degrade (기존 테스트 유지/확장).

- [ ] **Step 4: 테스트 + 커버리지**

```bash
yarn test src/entities/sector-signal --coverage
```
Expected: PASS, 신규 파일 ≥90%.

- [ ] **Step 5: Commit**

```bash
git add src/entities/sector-signal/
git commit -m "feat(sector-signal): add redis cache layer (align 3-tier with [symbol] bars)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.2: 정적화 헬퍼 3종 (A-2)

**Files:**
- Create: `src/entities/market-summary/lib/marketSummaryStaticCache.ts`
- Create: `src/entities/sector-signal/lib/sectorSignalsStaticCache.ts`
- Create: `src/entities/market-summary/lib/briefingStaticCache.ts`
- Test: 각 `__tests__/*.test.ts`

**근거:** `barsStaticCache.ts` 패턴 — `unstable_cache` + `revalidate=SECONDS_PER_HOUR` + `market-summary` tag.

- [ ] **Step 1: marketSummaryStaticCache 구현**

```ts
import { unstable_cache } from 'next/cache';
import type { MarketSummaryData } from '@y0ngha/siglens-core';
import { getCachedMarketSummary } from './marketSummaryCache';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * ISR static-safe market summary. getCachedMarketSummary(redis getOrSetCache)를
 * Next data cache로 감싸 static generate가 no-store fetch에 막히지 않게 한다.
 * revalidate=1h, `market-summary` tag. RSC prefetch 전용(클라는 client action).
 */
export function getMarketSummaryStatic(): Promise<MarketSummaryData> {
    return unstable_cache(
        () => getCachedMarketSummary(getMarketDataProvider()),
        ['market-summary-static'],
        { revalidate: SECONDS_PER_HOUR, tags: ['market-summary'] }
    )();
}
```

- [ ] **Step 2: sectorSignalsStaticCache 구현**

```ts
import { unstable_cache } from 'next/cache';
import type { DashboardTimeframe, SectorSignalsResult } from '@y0ngha/siglens-core';
import { getCachedSectorSignals } from './sectorSignalsCache';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/** ISR static-safe sector signals. timeframe별 캐시. revalidate=1h, market-summary tag. */
export function getSectorSignalsStatic(
    timeframe: DashboardTimeframe
): Promise<SectorSignalsResult> {
    return unstable_cache(
        () => getCachedSectorSignals(getMarketDataProvider(), timeframe),
        ['sector-signals-static', timeframe],
        { revalidate: SECONDS_PER_HOUR, tags: ['market-summary'] }
    )();
}
```

- [ ] **Step 3: briefingStaticCache 구현**

```ts
import { unstable_cache } from 'next/cache';
import {
    type MarketBriefingResponse,
    type MarketSummaryData,
    peekBriefingCache,
} from '@y0ngha/siglens-core';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * ISR static-safe peek of the cached briefing. core peekBriefingCache(읽기전용)를
 * Next data cache로 감싼다. 키는 date-hour(매시 자연 무효화)로 충분 — 같은 시간대면
 * 같은 cached briefing. revalidate=1h, market-summary tag.
 */
export function peekBriefingStatic(
    summary: MarketSummaryData,
    dateHour: string
): Promise<MarketBriefingResponse | null> {
    return unstable_cache(
        () => peekBriefingCache(summary),
        ['briefing-peek-static', dateHour],
        { revalidate: SECONDS_PER_HOUR, tags: ['market-summary'] }
    )();
}
```
> `dateHour`는 호출부(page.tsx)에서 `new Date().toISOString().slice(0,13)`로 만들어 키에 넣는다 — summary 전체를 키로 쓰는 hash 비용을 피하고 시간대 단위로 캐시.

- [ ] **Step 4: 테스트 3종 — Happy + Worst** (`unstable_cache` mock = passthrough)

각 테스트 공통 mock:
```ts
vi.mock('next/cache', () => ({
    unstable_cache: (fn: Function, _keys: unknown, opts: unknown) => {
        (globalThis as any).__lastOpts = opts;
        return fn;
    },
}));
```
케이스:
- (Happy) underlying 호출·반환 전달, `__lastOpts` = `{revalidate: 3600, tags:['market-summary']}`.
- (Worst) underlying throw → 전파(호출부 `.catch` 책임), null 반환(briefing miss) 정상 통과.

```bash
yarn test src/entities/market-summary/lib/__tests__ src/entities/sector-signal/lib/__tests__ --coverage
```
Expected: PASS, 3종 ≥90%.

- [ ] **Step 5: Commit**

```bash
git add src/entities/market-summary/lib/marketSummaryStaticCache.ts src/entities/market-summary/lib/briefingStaticCache.ts src/entities/sector-signal/lib/sectorSignalsStaticCache.ts src/entities/*/lib/__tests__/
git commit -m "feat(market): add unstable_cache static helpers (summary/sector/briefing)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3: Server Action 분리 (스펙 B-1, B-4)

### Task 3.1: 타입 분리 — `MarketSummaryActionResult` 단순화 + briefing 타입

**Files:**
- Modify: `src/shared/lib/types.ts` (`MarketSummaryActionResult` union)

**근거:** summary와 briefing 경로 분리에 맞춰 타입 정리. 인터페이스 먼저(스펙 Task Execution Rule 2).

- [ ] **Step 1: 타입 교체**

`types.ts`:
```ts
/** summary 전용 결과 — briefing/botBlocked은 별도 경로(MarketBriefingActionResult). */
export type MarketSummaryActionResult =
    | { summary: MarketSummaryData }
    | { ok: false; error: string };

/** briefing 클라 경로 결과 — 봇 차단 또는 submit/cached. */
export type MarketBriefingActionResult =
    | { briefing: SubmitBriefingResult; botBlocked: false }
    | { briefing: null; botBlocked: true }
    | { ok: false; error: string };
```

- [ ] **Step 2: typecheck (소비처 컴파일 에러 목록 확인)**

```bash
yarn typecheck 2>&1 | grep -i "marketSummaryActionResult\|briefing\|botBlocked" | head
```
Expected: useMarketSummary/MarketSummaryPanel 등에서 에러 — 후속 Task에서 해소. (이 Task는 타입만, 커밋은 Task 4 이후 묶음 가능하나 여기선 단독 커밋 생략하고 Task 3.2와 함께.)

### Task 3.2: `getMarketSummaryClientAction` + `submitMarketBriefingAction`

**Files:**
- Create: `src/entities/market-summary/actions/getMarketSummaryClientAction.ts`
- Create: `src/entities/market-summary/actions/submitMarketBriefingAction.ts`
- Modify: `src/entities/market-summary/actions.ts` (barrel re-export)
- Delete: `src/entities/market-summary/actions/getMarketSummaryAction.ts`
- Test: 각 `__tests__/*.test.ts`

- [ ] **Step 1: `getMarketSummaryClientAction` 구현** (E2E seam 보존 — 스펙 B-4 원칙 2)

```ts
'use server';

import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { isE2E } from '@/shared/api/e2eEnv';
import { cookies } from 'next/headers';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '../lib/marketSummaryCache';

/**
 * 클라(useMarketSummary) 전용 summary fetch. RSC prefetch는 getMarketSummaryStatic
 * (정적)을 쓰고, 클라는 이 action으로 redis 실시간 값을 받는다. E2E force-partial
 * 쿠키 seam을 여기에 유지한다(정적 경로는 쿠키를 못 읽으므로). 라우트 렌더가 아닌
 * 클라 호출이라 cookies() 사용이 ISR을 깨지 않는다.
 */
export async function getMarketSummaryClientAction(): Promise<MarketSummaryActionResult> {
    try {
        const summary = await getCachedMarketSummary(getMarketDataProvider());
        if (isE2E()) {
            const stub = await import('@/shared/api/e2eMarketStub');
            const forcePartial = (await cookies()).get(
                stub.E2E_FORCE_MARKET_PARTIAL_COOKIE
            );
            return {
                summary: forcePartial
                    ? stub.e2eForceMarketPartial(summary)
                    : summary,
            };
        }
        return { summary };
    } catch (e) {
        console.error('[getMarketSummaryClientAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
```

- [ ] **Step 2: `submitMarketBriefingAction` 구현** (봇판정 + submit — 스펙 B-1)

```ts
'use server';

import type { MarketBriefingActionResult } from '@/shared/lib/types';
import { isBot } from '@/shared/api/isBot';
import { submitBriefing } from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '../lib/marketSummaryCache';

/**
 * briefing 클라 트리거. 봇이면 차단(job 미제출), 아니면 submitBriefing(내부에서
 * summary 재조회 — redis HIT). cached/submitted 결과를 반환. headers()는 클라 호출
 * 경로라 ISR과 무관.
 */
export async function submitMarketBriefingAction(): Promise<MarketBriefingActionResult> {
    try {
        const requestHeaders = await headers();
        if (isBot(requestHeaders)) {
            return { briefing: null, botBlocked: true };
        }
        const summary = await getCachedMarketSummary(getMarketDataProvider());
        const briefing = await submitBriefing(summary);
        return { briefing, botBlocked: false };
    } catch (e) {
        console.error('[submitMarketBriefingAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
```

- [ ] **Step 3: barrel 정리 + 기존 action 삭제**

`actions.ts`: `getMarketSummaryAction` re-export 제거, 두 신규 action re-export 추가:
```ts
export { getMarketSummaryClientAction } from './actions/getMarketSummaryClientAction';
export { submitMarketBriefingAction } from './actions/submitMarketBriefingAction';
```
```bash
git rm src/entities/market-summary/actions/getMarketSummaryAction.ts
```

- [ ] **Step 4: 테스트 — Happy + Worst**

`getMarketSummaryClientAction.test.ts`:
- (Happy) 비-E2E → `{summary}`.
- (Worst) E2E + force-partial 쿠키 → 첫 섹터 price 0.
- (Worst) E2E + 쿠키 없음 → 원본 summary.
- (Worst) getCachedMarketSummary throw → `{ok:false, error:'server_error'}`.

`submitMarketBriefingAction.test.ts`:
- (Happy) 비봇 → submitBriefing 결과(`{briefing, botBlocked:false}`).
- (Worst) isBot=true → `{briefing:null, botBlocked:true}`, submitBriefing 미호출.
- (Worst) submitBriefing throw → `{ok:false, error}`.

(mock: `next/headers`, `isBot`, `@y0ngha/siglens-core` submitBriefing, `getCachedMarketSummary`.)

```bash
yarn test src/entities/market-summary/actions --coverage
```
Expected: PASS, ≥90%.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/types.ts src/entities/market-summary/actions.ts src/entities/market-summary/actions/ 
git commit -m "feat(market): split summary(static client) / briefing(bot+submit) actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4: 클라 데이터 흐름 (스펙 B-2, B-3)

### Task 4.1: `useMarketSummary` 수정 (summary-only + E2E staleTime)

**Files:**
- Modify: `src/widgets/dashboard/hooks/useMarketSummary.ts`
- Test: `src/widgets/dashboard/hooks/__tests__/useMarketSummary.test.ts(x)`

- [ ] **Step 1: 구현 변경**

`useMarketSummary.ts`:
- `queryFn` → `getMarketSummaryClientAction`.
- 반환 union(`UseMarketSummaryReturn`)에서 `briefing` 제거.
- `hasSummary` 가드를 새 타입(`{summary} | {ok:false}`)에 맞춤.
- E2E seam(스펙 B-4 원칙 3): E2E 모드에서 seed 무시하고 즉시 refetch.
```ts
import { isE2EClient } from '@/shared/api/e2eClientEnv'; // 신규: NEXT_PUBLIC_E2E 기반
// ...
const e2e = isE2EClient();
const { data, isPending } = useQuery({
    queryKey: QUERY_KEYS.marketSummary(),
    queryFn: getMarketSummaryClientAction,
    enabled: isHydrated,
    staleTime: e2e ? 0 : MARKET_SUMMARY_STALE_TIME_MS,
    refetchOnMount: e2e ? 'always' : undefined,
});
```

- [ ] **Step 2: E2E 클라 플래그 헬퍼 신설** (`src/shared/api/e2eClientEnv.ts`)

```ts
/** 클라 번들에서 E2E 모드 감지 — NEXT_PUBLIC_E2E_TEST는 빌드 타임 인라인된다. */
export function isE2EClient(): boolean {
    return process.env.NEXT_PUBLIC_E2E_TEST === '1';
}
```
> `NEXT_PUBLIC_E2E_TEST`를 `.env.e2e`에 추가(E2E build에서만 '1'). prod build엔 없음 → false.

- [ ] **Step 3: 테스트 — Happy + Worst**
- (Happy) seed 데이터로 sectorMap/indices 산출.
- (Worst) `{ok:false}` → hasSummary false, 빈 sectorMap.
- (Worst) 0-price summary → `hasMissingQuotes` true.
- (Worst-E2E) `isE2EClient`=true 시 staleTime 0 적용(쿼리 옵션 검증).

- [ ] **Step 4 & 5: 테스트 + Commit**

```bash
yarn test src/widgets/dashboard/hooks/__tests__/useMarketSummary
git add src/widgets/dashboard/hooks/useMarketSummary.ts src/shared/api/e2eClientEnv.ts src/widgets/dashboard/hooks/__tests__/
git commit -m "feat(market): useMarketSummary summary-only + E2E refetch seam

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4.2: `useSectorSignals(tf)` 신설 + `useSectorSignalState` 연동

**Files:**
- Create: `src/widgets/dashboard/hooks/useSectorSignals.ts`
- Modify: `src/widgets/dashboard/hooks/useSectorSignalState.ts`
- Modify: `src/widgets/dashboard/SectorSignalPanel.tsx` (data props 제거)
- Create: `src/entities/sector-signal/actions/getSectorSignalsClientAction.ts` (클라 queryFn — E2E seam 필요 시 동일 원칙)
- Test: `__tests__/useSectorSignals.test.tsx`, `useSectorSignalState.test.ts(x)`

- [ ] **Step 1: 클라 action + QUERY_KEYS 추가**

`queryConfig.ts` QUERY_KEYS에 추가:
```ts
sectorSignals: (timeframe: string) => ['sector-signals', timeframe] as const,
```
`getSectorSignalsClientAction.ts`: 기존 `getSectorSignalsAction`를 클라 queryFn으로 재사용(이미 redis 캐시 경유). 별도 신설 대신 `getSectorSignalsAction`을 그대로 queryFn으로 써도 됨 — E2E sector seam이 없으면 신설 불필요. (E2E force-partial은 summary 한정이므로 sector는 기존 action 재사용.)

- [ ] **Step 2: `useSectorSignals` 구현**

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import type { DashboardTimeframe, SectorSignalsResult } from '@y0ngha/siglens-core';
import { getSectorSignalsAction } from '@/entities/sector-signal/actions';
import { QUERY_KEYS, MARKET_SUMMARY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';

export function useSectorSignals(
    timeframe: DashboardTimeframe,
    initialData?: SectorSignalsResult
): SectorSignalsResult {
    const isHydrated = useHydrated();
    const { data } = useQuery({
        queryKey: QUERY_KEYS.sectorSignals(timeframe),
        queryFn: () => getSectorSignalsAction(timeframe),
        enabled: isHydrated,
        staleTime: MARKET_SUMMARY_STALE_TIME_MS,
        initialData: timeframe === initialData?.timeframe ? initialData : undefined,
    });
    return data ?? { computedAt: '', stocks: [] };
}
```
> `initialData`는 default tf prefetch seed 연결용(선택). `SectorSignalsResult`에 timeframe 필드가 없으면 default 여부를 부모가 판정해 넘긴다 — 구현 시 실제 타입 확인 후 조정.

- [ ] **Step 3: `useSectorSignalState` 리팩토링** (`data` props → 내부 `useSectorSignals`)

`useSectorSignalState.ts`: `UseSectorSignalStateOptions`에서 `data` 제거, 내부에서:
```ts
const data = useSectorSignals(activeTimeframe);
const filtered = useMemo(() => filterStrictAnticipation(data.stocks), [data.stocks]);
```
나머지(activeSector 필터, quadrants, updateUrl) 동일. **activeTimeframe이 이제 데이터 fetch를 구동** → tf 전환이 클라에서 정상 동작.

- [ ] **Step 4: `SectorSignalPanel` props 변경**

`SectorSignalPanel.tsx`: `data` prop 제거, `useSectorSignalState({ initialSector, initialTimeframe })`.

- [ ] **Step 5: 테스트 — Happy + Worst**
- (Happy) default tf seed 렌더, tf 변경 시 `getSectorSignalsAction(newTf)` 호출.
- (Worst) 잘못된 tf → default fallback(상위에서 검증), fetch 실패 → 빈 stocks.
- (Worst) activeSector 변경 → 클라 필터만(추가 fetch 없음).

```bash
yarn test src/widgets/dashboard/hooks/__tests__/useSectorSignals src/widgets/dashboard/hooks/__tests__/useSectorSignalState --coverage
git add src/widgets/dashboard/ src/entities/sector-signal/ src/shared/config/queryConfig.ts
git commit -m "feat(market): useSectorSignals client hook — tf switch via React Query

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4.3: `useMarketBriefing` 신설 + `MarketSummaryPanel` 분리 소비

**Files:**
- Create: `src/widgets/dashboard/hooks/useMarketBriefing.ts`
- Modify: `src/widgets/dashboard/MarketSummaryPanel.tsx`
- Test: `__tests__/useMarketBriefing.test.tsx`

- [ ] **Step 1: `useMarketBriefing` 구현** (마운트 후 submit, peek seed 초기값)

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import type { MarketBriefingResponse, SubmitBriefingResult } from '@y0ngha/siglens-core';
import { submitMarketBriefingAction } from '@/entities/market-summary/actions';
import { useHydrated } from '@/shared/hooks/useHydrated';

export interface UseMarketBriefingReturn {
    /** BriefingRegion input — undefined=미정, null=봇, cached/submitted=정상. */
    input: SubmitBriefingResult | null | undefined;
}

/**
 * 마운트 후 submitMarketBriefingAction을 호출해 briefing을 트리거한다. peekSeed가
 * 있으면 초기 표시에 쓰고, action 결과로 교체한다. 봇이면 null(BotBlockedNotice).
 */
export function useMarketBriefing(
    peekSeed?: MarketBriefingResponse | null
): UseMarketBriefingReturn {
    const isHydrated = useHydrated();
    const { data } = useQuery({
        queryKey: ['market-briefing'],
        queryFn: submitMarketBriefingAction,
        enabled: isHydrated,
        staleTime: Infinity,
    });

    if (!data) {
        // hydration 전: peek seed가 있으면 cached처럼 노출, 없으면 undefined(렌더 안 함)
        return {
            input: peekSeed
                ? { status: 'cached', briefing: peekSeed, generatedAt: '' }
                : undefined,
        };
    }
    if ('ok' in data) return { input: undefined };
    if (data.botBlocked) return { input: null };
    return { input: data.briefing };
}
```

- [ ] **Step 2: `MarketSummaryPanel` 분리 소비**

`MarketSummaryPanel.tsx`:
- `useMarketSummary()`에서 `briefing` 분리 제거.
- `useMarketBriefing(peekSeed)` 추가 — `peekSeed`는 props로 받음(page가 `peekBriefingStatic`으로 seed).
- `<BriefingRegion input={briefing} />` → `<BriefingRegion input={useMarketBriefing(peekSeed).input} />`.
- `MarketSummaryPanel`에 `peekSeed?: MarketBriefingResponse | null` prop 추가.

- [ ] **Step 3: 테스트 — Happy + Worst**
- (Happy) peekSeed 있음 → 초기 input cached, action done 후 교체.
- (Worst) botBlocked → input null.
- (Worst) action `{ok:false}` → input undefined(렌더 안 함).
- (Worst) peekSeed null + 미hydrated → undefined.

```bash
yarn test src/widgets/dashboard/hooks/__tests__/useMarketBriefing src/widgets/dashboard/__tests__ --coverage
git add src/widgets/dashboard/
git commit -m "feat(market): useMarketBriefing — client briefing trigger + peek seed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 5: SEO 축2 + route config (스펙 C-1, C-2)

### Task 5.1: `SectorFactsSummary` 서버컴포넌트 (축 2 SEO)

**Files:**
- Create: `src/widgets/dashboard/SectorFactsSummary.tsx`
- Create: `src/widgets/dashboard/utils/sectorFacts.ts` (순수 변환)
- Modify: `src/widgets/dashboard/index.ts` (barrel export — 컴포넌트만)
- Test: `__tests__/SectorFactsSummary.test.tsx`, `utils/__tests__/sectorFacts.test.ts`

**근거:** `TechnicalFactsSummary` 패턴 — CSR bailout 밖 SSR 크롤 텍스트.

- [ ] **Step 1: 순수 변환 `sectorFacts.ts`** (signals → 크롤 텍스트 구조)

```ts
import type { SectorSignalsResult } from '@y0ngha/siglens-core';

export interface SectorFact {
    sectorSymbol: string;
    bullishCount: number;
    bearishCount: number;
    topSymbols: readonly string[];
}

/** default 섹터의 신호를 요약 텍스트용 구조로 변환. 빈 입력 → 빈 배열. */
export function buildSectorFacts(data: SectorSignalsResult): readonly SectorFact[] {
    // stocks를 sectorSymbol별 그룹 → bullish/bearish 카운트 + 대표 심볼 추출
    // (실제 SectorStock 필드는 구현 시 타입 확인)
    // ...
}
```

- [ ] **Step 2: 서버컴포넌트** (`'use client'` 없음 — 서버 렌더)

```tsx
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { buildSectorFacts } from './utils/sectorFacts';

interface SectorFactsSummaryProps {
    data: SectorSignalsResult;
}

/**
 * SectorSignalPanel(useSearchParams CSR bailout) 대신 SSR HTML에 박히는 섹터 신호
 * 요약. 크롤러가 JS 없이 섹터별 상승/하락 신호 텍스트를 받게 한다. hydration 시
 * 인터랙티브 패널로 교체(텍스트 동일 — cloaking 아님).
 */
export function SectorFactsSummary({ data }: SectorFactsSummaryProps) {
    const facts = buildSectorFacts(data);
    if (facts.length === 0) return null;
    return (
        <section aria-label="섹터별 신호 요약" className="...">
            {/* h2 + dl/ul로 섹터별 신호 텍스트 — TechnicalFactsSummary 톤 일치 */}
        </section>
    );
}
```

- [ ] **Step 3: barrel export** (`index.ts`에 `SectorFactsSummary`만 — 헬퍼는 deep import)

```ts
export { SectorFactsSummary } from './SectorFactsSummary';
```

- [ ] **Step 4: 테스트 — Happy + Worst**
- (Happy) signals 있음 → 섹터별 카운트/심볼 텍스트 렌더.
- (Worst) 빈 stocks → `null` 반환(렌더 안 함).
- `sectorFacts` 순수함수: (Happy) 그룹·카운트 정확, (Worst) 빈 입력 → 빈 배열.

```bash
yarn test src/widgets/dashboard/__tests__/SectorFactsSummary src/widgets/dashboard/utils/__tests__/sectorFacts --coverage
git add src/widgets/dashboard/SectorFactsSummary.tsx src/widgets/dashboard/utils/ src/widgets/dashboard/index.ts src/widgets/dashboard/__tests__/
git commit -m "feat(market): SectorFactsSummary server component for SSR SEO (axis 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5.2: `page.tsx` ISR 전환 (축 2·3)

**Files:**
- Modify: `src/app/market/page.tsx`
- Test: `src/app/market/__tests__/page.test.tsx` (신설/확장)

- [ ] **Step 1: route config + searchParams 제거 + 정적 prefetch + peek seed**

`page.tsx` 핵심 변경:
```ts
export const revalidate = 3600; // 1h — ISR (리터럴 강제, MISTAKES §15 예외)
```
- `MarketContent`에서 `searchParams` props/`await searchParams`/`isDashboardTimeframe`/sector 파싱 **전부 제거**.
- prefetch를 정적 헬퍼로:
```ts
import { getMarketSummaryStatic } from '@/entities/market-summary/lib/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/lib/sectorSignalsStaticCache';
import { peekBriefingStatic } from '@/entities/market-summary/lib/briefingStaticCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';

// MarketContent (async, searchParams 없음):
const dateHour = new Date().toISOString().slice(0, 13);
const summary = await getMarketSummaryStatic();
const sectorData = await getSectorSignalsStatic(DEFAULT_DASHBOARD_TIMEFRAME);
const peekSeed = await peekBriefingStatic(summary, dateHour).catch(() => null);

const queryClient = new QueryClient();
queryClient.setQueryData(QUERY_KEYS.marketSummary(), { summary });
queryClient.setQueryData(QUERY_KEYS.sectorSignals(DEFAULT_DASHBOARD_TIMEFRAME), sectorData);
```
- `MarketSummaryPanel`에 `peekSeed` 전달, fallback에 `SectorFactsSummary data={sectorData}`.
- `SectorSignalPanel`은 `initialSector`/`initialTimeframe`을 default 상수로 고정(SIGNAL_SECTORS[0], DEFAULT_DASHBOARD_TIMEFRAME), `data` prop 제거됨.
- `MarketPage`(default export): searchParams props 제거. JsonLd 유지.

- [ ] **Step 2: 테스트 — Happy + Worst**
- (Happy) `revalidate === 3600` export, prefetch seed 설정, searchParams 미참조.
- (Worst) `getMarketSummaryStatic` 실패 → MarketSummaryPanel skeleton/notice 경로.
- (Worst) peekBriefingStatic null → BriefingRegion이 클라 트리거로 폴백.

```bash
yarn test src/app/market --coverage
git add src/app/market/
git commit -m "feat(market): enable ISR (revalidate=3600, static prefetch, drop searchParams)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5.3: 축 0 확인 (정적 import lint)

- [ ] **Step 1: RSC 경로에 동적 API 없음 확인**

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/market-isr
grep -rn "cookies()\|headers()" src/app/market/ src/entities/market-summary/lib/ src/entities/sector-signal/lib/
```
Expected: **출력 없음** (cookies/headers는 client action에만). 있으면 정적 경로로 누출된 것 → 제거.

- [ ] **Step 2: lint + typecheck 전체**

```bash
yarn lint && yarn typecheck > /tmp/tc-final.log 2>&1; echo "EXIT=$?"
```
Expected: EXIT=0.

---

## Phase 6: 단위 테스트 커버리지 게이트

### Task 6.1: 전체 변경면 커버리지 ≥90% 확인

- [ ] **Step 1: 변경 파일 커버리지 측정**

```bash
yarn test-coverage 2>&1 | tee /tmp/cov.log
```
신규/수정 파일(아래)이 모두 라인·브랜치 ≥90%인지 확인. 미달 시 Worst Case 케이스 보강:
- `peekBriefingCache`, `briefingInputHash`, `sectorSignalsCache`, 정적화 헬퍼 3종, 두 action, `useMarketSummary`, `useSectorSignals`, `useSectorSignalState`, `useMarketBriefing`, `SectorFactsSummary`, `sectorFacts`, `page.tsx`.

- [ ] **Step 2: 미달 파일 테스트 보강 후 재측정** (반복)

- [ ] **Step 3: Commit (테스트 보강분)**

```bash
git add -A && git commit -m "test(market): raise changed-surface coverage to 90%+ (happy+worst)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 7: QA · 실증 검증 (`docs/qa/` 준수)

> ⚠️ `src/app/CLAUDE.md`: 빌드 output의 `●`(SSG) ≠ 런타임 동작. 반드시 prod build && start 후 런타임으로 실증.

### Task 7.1: QA 환경 셋업 (`QA_ENV_SETUP.md`)

- [ ] **Step 1: docker 백엔드 기동**

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/market-isr
yarn e2e:up    # postgres + redis + SRH
```

- [ ] **Step 2: 워크트리 `.env.local` 준비** (docker DB 연결, 끝나면 원복 — §7 체크리스트)

### Task 7.2: ISR Build + Curl 실증 (`EMPIRICAL_VERIFICATION.md`)

- [ ] **Step 1: prod build (E2E env로 docker 연결, 파이프 없이 exit code)**

```bash
E2E_TEST=1 yarn build > /tmp/market-build.log 2>&1; echo "EXIT=$?"
grep -E "/market|Route|●|ƒ" /tmp/market-build.log | grep market
```
Expected: EXIT=0, `/market`이 ISR/`●`(SSG)로 표시.

- [ ] **Step 2: start + curl 헤더 (2회차 HIT)**

```bash
yarn start -p 4300 &
sleep 5
curl -sI http://localhost:4300/market | grep -i "x-nextjs-cache"   # 1회차 (MISS/STALE 가능)
curl -sI http://localhost:4300/market | grep -i "x-nextjs-cache"   # 2회차
```
Expected: 2회차 `x-nextjs-cache: HIT`.

- [ ] **Step 3: 런타임 DYNAMIC_SERVER_USAGE 0 확인**

```bash
grep -c "DYNAMIC_SERVER_USAGE" /tmp/market-build.log
# start 로그도 확인 (별도 캡처)
```
Expected: 0.

- [ ] **Step 4: timeframe 딥링크 클라 동작 확인**

```bash
curl -s "http://localhost:4300/market?timeframe=1Week" | grep -o "섹터별 신호 요약"  # SectorFactsSummary SSR 텍스트(default tf) 존재
```
Expected: 텍스트 존재(딥링크여도 SSR은 default tf seed).

### Task 7.3: SEO QA — curl + chrome (사용자 강조)

- [ ] **Step 1: curl로 SSR HTML SEO 콘텐츠 실측** (JS 미실행 크롤러 시뮬)

```bash
curl -s http://localhost:4300/market > /tmp/market.html
grep -o "섹터별 신호 요약" /tmp/market.html          # ① SectorFactsSummary 텍스트
grep -o "<title>[^<]*</title>" /tmp/market.html       # ② title
grep -o 'rel="canonical" href="[^"]*"' /tmp/market.html  # ⑤ canonical=/market
grep -c "application/ld+json" /tmp/market.html        # ③ JSON-LD (WebPage/Breadcrumb/ItemList = 3)
grep -o "<h1[^>]*>[^<]*</h1>" /tmp/market.html         # ④ h1
grep -c "noindex" /tmp/market.html                    # noindex 없어야 함 = 0
```
Expected: ① 텍스트 존재, ② title 정상, ③ 3개, ④ h1 존재, ⑤ canonical `/market`, noindex 0.

- [ ] **Step 2: chrome 도구로 렌더 후 검증** (claude-in-chrome MCP)

```
- mcp__claude-in-chrome__navigate → http://localhost:4300/market
- read_console_messages: 에러 0 확인
- 메타/JSON-LD 구조 정상, 가격·섹터신호·briefing 렌더 확인
- ?sector=XLK / ?timeframe=1Week 변형: canonical이 /market로 유지되는지(get_page_text + head 확인)
```
Expected: 콘솔 에러 0, canonical 통합, SEO 구조 무손상.

### Task 7.4: 멀티환경 + E2E (`MULTI_ENV_TESTING.md` · `E2E.md`)

- [ ] **Step 1: market E2E 스펙 (force-partial 무손상)**

```bash
yarn e2e --grep market   # 또는 해당 스펙 파일 지정
```
Expected: PASS — "데이터 일부 로드 실패" 안내가 force-partial 쿠키로 결정적 렌더(E2E seam 4원칙 동작).

- [ ] **Step 2: Playwright webkit(Safari)/모바일 스모크** (가격·섹터·tf 전환)

- [ ] **Step 3: 환경 원복 (`QA_ENV_SETUP.md` §7)**

```bash
# .env.local 원복, prod 서버 종료, docker down, 시드 정리
pkill -9 -f "next start" 2>/dev/null
yarn e2e:down
cp /Users/y0ngha/Project/siglens/.env.local /Users/y0ngha/Project/siglens/.claude/worktrees/market-isr/.env.local
```

---

## Phase 8: 마무리

### Task 8.1: 전체 게이트 + 핸드오프

- [ ] **Step 1: pre-push 동등 게이트 로컬 실행** (`--no-verify` 금지)

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/market-isr
yarn format:check && yarn lint && yarn typecheck && yarn test
```
Expected: 전부 통과.

- [ ] **Step 2: core publish 의존성 핸드오프 노트**

siglens PR 머지 전 **siglens-core PR(`worktree-market-briefing-peek`, `peekBriefingCache`)이 먼저 publish**되어야 CI가 `@y0ngha/siglens-core`의 새 export를 받는다. core publish는 **사용자가 직접 수행**(메모리 규약). plan 실행자는 core PR 생성까지만, publish 대기.

- [ ] **Step 3: 리뷰 → 커밋/PR은 CLAUDE.md 워크플로우 따름** (review-agent → mistake-managing-agent → git-agent)

---

## Self-Review (작성자 체크 결과)

**Spec coverage:**
- A-1 peekBriefingCache → Phase 1 ✅ / A-2 정적화 3종 → Task 2.2 ✅ / A-3 sector redis → Task 2.1 ✅
- B-1 action 분리 → Task 3.2 ✅ / B-2 훅 3종 → Phase 4 ✅ / B-3 소비처 → Task 4.1·4.3 ✅ / B-4 E2E seam → Task 3.2·4.1 ✅
- C-1 SectorFactsSummary → Task 5.1 ✅ / C-2 route config → Task 5.2 ✅ / C-3 축0 → Task 5.3 ✅
- 검증(QA/ISR/SEO/E2E) → Phase 7 ✅ / 커버리지 90% → Phase 6 ✅ / worktree → Phase 0·1.3 ✅

**구현 시 타입 확인 필요 지점**(plan에 명시): `SectorSignalsResult.timeframe` 필드 유무(useSectorSignals initialData), `SectorStock` 필드(sectorFacts), peekBriefing 모델 인자(`BRIEFING_MODEL_ID` 기본).

**0-price 리스크(스펙 A 리스크):** 기본은 redis 가드 의존 + 클라 실시간 덮기. 실증(7.2)에서 0-price stale이 관찰되면 `getMarketSummaryStatic` 콜백에 throw 가드 추가(후속).
