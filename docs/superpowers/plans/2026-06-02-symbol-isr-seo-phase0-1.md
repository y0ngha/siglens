# [symbol] ISR+SEO — Phase 0+1 (인프라 + 차트 page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차트 `/[symbol]`을 ISR로 정상 활성화하고(런타임 500/DYNAMIC_SERVER_USAGE 제거), bars 기반 FactLayer를 SSR HTML에 박아 SEO를 보존한다.

**Architecture:** ① 동적 데이터(bars/assetInfo/peek)를 정적화 헬퍼로 감싸 ISR static-safe하게 한다(방식은 Task 1 PoC로 확정). ② FactLayer(`TechnicalFactsSummary`)를 `[symbol]/page.tsx`의 Suspense fallback으로 끌어올려 default-tf 정적화 bars로 **서버 SSR** → 크롤러가 보는 SEO 텍스트가 되고, hydrate 시 인터랙티브 ChartContent로 교체된다(CSR bailout 우회).

**Tech Stack:** Next.js 16.2.0(App Router, ISR, `unstable_cache`), TypeScript, vitest, @upstash/redis

**전제:** PR #545(`getAssetInfoResilient`) 머지 후 그 위에서 진행. `cacheComponents`(PPR)는 비활성 유지(이슈 #439).

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/entities/bars/lib/barsStaticCache.ts` | ISR static-safe bars 정적화 헬퍼(`getBarsStatic`) | Create |
| `src/entities/bars/__tests__/lib/barsStaticCache.test.ts` | 헬퍼 유닛 테스트 | Create |
| `src/app/[symbol]/page.tsx` | default-tf bars 정적화 + Suspense fallback을 FactLayer로 | Modify |
| `src/app/[symbol]/__tests__/page.factlayer.test.tsx` | FactLayer SSR integration 테스트 | Create |
| `docs/superpowers/plans/poc-results.md` | Task 1 PoC 실측 기록 | Create |

---

## Task 1: bars 정적화 방식 PoC (실측 — spike)

**목적:** `unstable_cache`가 내부 redis(`@upstash` no-store)를 ISR static-safe하게 만드는지 실측으로 확정한다. 이 결과가 헬퍼 구현 방식(A/B)을 결정한다.

**Files:**
- Modify(임시): `src/app/[symbol]/page.tsx`
- Create: `docs/superpowers/plans/poc-results.md`

- [ ] **Step 1: page.tsx body의 bars prefetch를 unstable_cache로 임시 래핑**

`src/app/[symbol]/page.tsx`의 `getBarsAction` 호출(prefetchQuery queryFn)을 임시로 아래로 감싼다(PoC 전용, Task 2에서 정식 헬퍼로 대체):

```ts
import { unstable_cache } from 'next/cache';
// ... barsQueryFn 정의 자리에 임시:
const pocCachedBars = unstable_cache(
    (sym: string, tf: string, fmp?: string) => getBarsAction(sym, tf, fmp),
    ['poc-bars'],
    { revalidate: 3600 }
);
```
그리고 prefetchQuery의 queryFn을 `() => pocCachedBars(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol)`로 임시 교체.

- [ ] **Step 2: prod build + start로 ISR 런타임 실측**

Run:
```bash
rm -rf .next && yarn build > /tmp/poc_build.log 2>&1; echo "BUILD=$?"
yarn start > /tmp/poc_start.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/poc_start.log; do sleep 1; done
echo "HTTP: $(curl -s -o /dev/null -w '%{http_code}' --max-time 40 http://localhost:3000/AAPL)"
echo "DYNAMIC_SERVER_USAGE: $(grep -c DYNAMIC_SERVER_USAGE /tmp/poc_start.log)"
curl -sI --max-time 40 http://localhost:3000/AAPL | grep -i "x-nextjs-cache"
pkill -f "next start"
```
Expected (성공 시): `HTTP: 200`, `DYNAMIC_SERVER_USAGE: 0` (또는 bars 관련 0), `x-nextjs-cache: HIT`(또는 재요청 시 HIT).

- [ ] **Step 3: PoC 결과 기록 + 방식 확정**

`docs/superpowers/plans/poc-results.md`에 실측 결과(HTTP/DYNAMIC_SERVER_USAGE/캐시 헤더)와 결론을 적는다:
- **A 채택**(unstable_cache가 정적화 성공): `DYNAMIC_SERVER_USAGE`가 bars 경로에서 사라지고 200 → Task 2는 unstable_cache 기반.
- **B 채택**(여전히 throw): Task 2 헬퍼를 source-direct(`fetch(url, { next: { revalidate }})` — redis 우회, FMP 직접)로 구현.

- [ ] **Step 4: 임시 PoC 코드 제거**

Step 1의 임시 래핑을 되돌린다(page.tsx를 원복). 확인:
```bash
grep -n "pocCachedBars\|poc-bars" "src/app/[symbol]/page.tsx" || echo "임시 코드 제거됨"
```
Expected: `임시 코드 제거됨`

- [ ] **Step 5: 커밋**
```bash
git add docs/superpowers/plans/poc-results.md
git commit -m "docs(poc): bars 정적화 방식(unstable_cache vs source-direct) 실측 결과"
```

---

## Task 2: bars 정적화 헬퍼 `getBarsStatic` (TDD)

**Files:**
- Create: `src/entities/bars/lib/barsStaticCache.ts`
- Test: `src/entities/bars/__tests__/lib/barsStaticCache.test.ts`

> 아래 구현은 Task 1에서 **A(unstable_cache)** 가 확정된 경우. **B** 확정 시 내부를 `fetch(url, { next: { revalidate } })` source-direct로 바꾸되 **함수 시그니처(`getBarsStatic(symbol, timeframe, fmpSymbol?)`: `Promise<BarsData>`)는 동일하게 유지**한다(호출부 불변).

- [ ] **Step 1: 실패 테스트 작성**

`src/entities/bars/__tests__/lib/barsStaticCache.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BarsData } from '@y0ngha/siglens-core';

vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, // identity로 통과 검증
}));
vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn(),
}));

import { getBarsStatic } from '@/entities/bars/lib/barsStaticCache';
import { getBarsAction } from '@/entities/bars/actions';

const mockBars = vi.mocked(getBarsAction);

describe('getBarsStatic', () => {
    beforeEach(() => vi.clearAllMocks());

    it('delegates to getBarsAction with the same args and returns its data', async () => {
        const data = { bars: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }], indicators: {} } as unknown as BarsData;
        mockBars.mockResolvedValue(data);

        const result = await getBarsStatic('AAPL', '1Day', 'AAPL');

        expect(result).toBe(data);
        expect(mockBars).toHaveBeenCalledWith('AAPL', '1Day', 'AAPL');
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/entities/bars/__tests__/lib/barsStaticCache.test.ts`
Expected: FAIL — `getBarsStatic` 모듈 없음.

- [ ] **Step 3: 헬퍼 구현 (A: unstable_cache)**

`src/entities/bars/lib/barsStaticCache.ts`:
```ts
import { unstable_cache } from 'next/cache';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';
import { getBarsAction } from '@/entities/bars/actions';

/**
 * ISR static-safe bars fetch. `getBarsAction`(redis getOrSetCache + FMP)을 Next data
 * cache로 감싸 static generate가 no-store fetch에 막히지 않게 한다. 종목당 캐시이며
 * revalidate=1h로 주기 갱신한다. 호출부는 본 함수만 쓰고 내부 방식(A/B)에는 무관하다.
 */
export function getBarsStatic(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    return unstable_cache(
        () => getBarsAction(symbol, timeframe, fmpSymbol),
        ['bars-static', symbol, timeframe, fmpSymbol ?? ''],
        { revalidate: 3600, tags: [`symbol:${symbol}`] }
    )();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/entities/bars/__tests__/lib/barsStaticCache.test.ts`
Expected: PASS (1).

- [ ] **Step 5: 커밋**
```bash
git add src/entities/bars/lib/barsStaticCache.ts src/entities/bars/__tests__/lib/barsStaticCache.test.ts
git commit -m "feat(bars): add getBarsStatic — ISR static-safe bars cache"
```

---

## Task 3: FactLayer를 Suspense fallback으로 SSR (차트 page)

**Files:**
- Modify: `src/app/[symbol]/page.tsx`

- [ ] **Step 1: default-tf bars 정적화 fetch 추가**

`page.tsx` body에서 기존 `const [{ assetInfo }, skillCounts] = ...` 직후, peek/prefetch와 함께 default-tf bars를 정적화로 가져온다:
```ts
import { getBarsStatic } from '@/entities/bars/lib/barsStaticCache';
// ... assetInfo 확보 후:
const factBars = await getBarsStatic(
    ticker,
    DEFAULT_TIMEFRAME,
    assetInfo.fmpSymbol
).catch((e: unknown) => {
    console.error('[SymbolPage] getBarsStatic failed:', e);
    return null;
});
```

- [ ] **Step 2: Suspense fallback을 FactLayer로 교체**

기존 fallback(`<div aria-hidden ... />`)을, bars가 있으면 FactLayer로 교체한다. `TechnicalFactsSummary`는 서버 렌더 가능한 prop 컴포넌트다.
```tsx
import { TechnicalFactsSummary } from '@/widgets/symbol-page/TechnicalFactsSummary';
// ... Suspense:
<Suspense
    fallback={
        factBars && factBars.bars.length > 0 ? (
            <TechnicalFactsSummary
                symbol={ticker}
                bars={factBars.bars}
                indicators={factBars.indicators}
            />
        ) : (
            <div
                className="bg-secondary-900 flex min-h-0 flex-1 flex-col overflow-hidden"
                aria-hidden="true"
            />
        )
    }
>
    <SymbolPageClient ... />
</Suspense>
```
> 크롤러(JS 미실행)는 fallback의 FactLayer 텍스트를 SSR HTML로 받는다. 사용자는 hydrate 시 인터랙티브 `SymbolPageClient`로 교체된다(default-tf FactLayer는 cold-miss fallback이므로 default-tf로 충분).

- [ ] **Step 3: typecheck + build**

Run: `yarn typecheck` → 0 errors.
Run: `rm -rf .next && yarn build > /tmp/t3_build.log 2>&1; echo "BUILD=$?"` → `BUILD=0`, `[symbol]`이 `●`.

- [ ] **Step 4: 커밋**
```bash
git add "src/app/[symbol]/page.tsx"
git commit -m "feat([symbol]): SSR FactLayer via Suspense fallback (default-tf static bars)"
```

---

## Task 4: assetInfo/peek/skillCounts 정적화 + ISR 무충돌화

**Files:**
- Modify: `src/app/[symbol]/page.tsx`, `src/app/[symbol]/layout.tsx`

- [ ] **Step 1: assetInfo·peek·bars prefetch를 정적화 경로로 통일**

`page.tsx`/`layout.tsx`의 남은 동적 호출을 ISR static-safe하게 정리한다:
- bars prefetch queryFn: `getBarsAction` → `getBarsStatic`(Task 2)로 교체(layout·page 양쪽).
- `peekAnalysisCache`(redis): Task 1 확정 방식으로 정적화하거나(권장: `unstable_cache` 래퍼 `getPeekStatic`), 실패 시 try/catch로 degrade 유지(이미 `.catch(() => null)`). ISR static에서 redis throw가 페이지를 깨지 않도록 **반드시 정적화 또는 안전 degrade**.
- `getAssetInfoResilient`(PR #545): 내부 `getAssetInfoCached`가 redis cache+DB. ISR static-safe하도록 `unstable_cache`로 감싼 `getAssetInfoStatic`을 도입(시그니처 동일), 또는 Task 1 방식과 동일 적용.

> `countSkillFiles`는 `fs.readdir`(빌드 산출물)이라 dynamic data가 아니므로 정적화 불필요(static generate 허용).

(정확한 정적화 대상별 래퍼는 Task 1 PoC 방식 확정 후 동일 패턴으로 추가한다. 각 래퍼는 유닛 테스트를 동반한다 — Task 2 패턴 참고.)

- [ ] **Step 2: 빌드 + 런타임 실측 (핵심 검증)**

Run:
```bash
rm -rf .next && yarn build > /tmp/t4_build.log 2>&1; echo "BUILD=$?"
yarn start > /tmp/t4_start.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/t4_start.log; do sleep 1; done
echo "HTTP: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL)"
echo "DYNAMIC_SERVER_USAGE: $(grep -c DYNAMIC_SERVER_USAGE /tmp/t4_start.log)"
curl -s http://localhost:3000/AAPL | grep -c "기술적 지표 요약"
curl -sI http://localhost:3000/AAPL | grep -i x-nextjs-cache
pkill -f "next start"
```
Expected: `HTTP: 200`, `DYNAMIC_SERVER_USAGE: 0`, `기술적 지표 요약` ≥ 1 (FactLayer SSR), `x-nextjs-cache` 존재.

- [ ] **Step 3: canonical 회귀 가드 통과 확인**

Run: `yarn test src/app/[symbol]/__tests__/symbol-metadata.test.ts`
Expected: PASS (canonical에 `[SYMBOL]` placeholder 없음).

- [ ] **Step 4: 커밋**
```bash
git add "src/app/[symbol]/page.tsx" "src/app/[symbol]/layout.tsx" src/entities
git commit -m "feat([symbol]): static-safe assetInfo/peek/bars for ISR (no DYNAMIC_SERVER_USAGE)"
```

---

## Task 5: 테스트 — Happy + Worst Case + Integration

**Files:**
- Create: `src/app/[symbol]/__tests__/page.factlayer.test.tsx`

- [ ] **Step 1: FactLayer SSR integration 테스트 (Happy + Worst)**

`src/app/[symbol]/__tests__/page.factlayer.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { TechnicalFactsSummary } from '@/widgets/symbol-page/TechnicalFactsSummary';

// getBarsStatic / getAssetInfoResilient / peek 등은 mock (RSC 단위 검증)
vi.mock('@/entities/bars/lib/barsStaticCache', () => ({ getBarsStatic: vi.fn() }));
// ... (page.test.ts의 기존 mock 세트 재사용 — assetInfo/skill/seo/query/navigation)

import { default as SymbolPage } from '@/app/[symbol]/page';
import { getBarsStatic } from '@/entities/bars/lib/barsStaticCache';

const mockBarsStatic = vi.mocked(getBarsStatic);

describe('SymbolPage FactLayer SSR', () => {
    beforeEach(() => vi.clearAllMocks());

    it('Happy: bars 있으면 Suspense fallback에 TechnicalFactsSummary(SSR)를 렌더한다', async () => {
        mockBarsStatic.mockResolvedValue({
            bars: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }],
            indicators: {},
        } as never);

        const tree = await SymbolPage({ params: Promise.resolve({ symbol: 'aapl' }) });
        const fact = findElementByType(tree, TechnicalFactsSummary);

        expect(fact).not.toBeNull();
    });

    it('Worst: bars 빈 결과면 FactLayer 대신 빈 fallback (크래시 없음, 페이지 정상)', async () => {
        mockBarsStatic.mockResolvedValue({ bars: [], indicators: {} } as never);

        const tree = await SymbolPage({ params: Promise.resolve({ symbol: 'aapl' }) });
        const fact = findElementByType(tree, TechnicalFactsSummary);

        expect(fact).toBeNull();
    });

    it('Worst: getBarsStatic 실패(throw)해도 페이지가 깨지지 않는다(null degrade)', async () => {
        mockBarsStatic.mockRejectedValue(new Error('bars infra down'));

        await expect(
            SymbolPage({ params: Promise.resolve({ symbol: 'aapl' }) })
        ).resolves.toBeTruthy();
    });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `yarn test src/app/[symbol]/__tests__/page.factlayer.test.tsx`
Expected: PASS (3).

- [ ] **Step 3: 변경 파일 커버리지 확인 (90%+)**

Run: `yarn test-coverage src/entities/bars/lib/barsStaticCache.ts "src/app/[symbol]/page.tsx" 2>&1 | grep -E "barsStaticCache|page.tsx"`
Expected: 각 변경 파일 Stmts/Branch 90%+ (미달 시 worst-case 테스트 보강).

- [ ] **Step 4: 전체 테스트 회귀 확인**

Run: `yarn test > /tmp/t5_test.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/t5_test.log`
Expected: `EXIT=0`, 전부 통과.

- [ ] **Step 5: 커밋**
```bash
git add "src/app/[symbol]/__tests__/page.factlayer.test.tsx"
git commit -m "test([symbol]): FactLayer SSR happy/worst-case integration"
```

---

## Task 6: E2E + 최종 실측

**Files:** (검증 — E2E 스펙 추가는 Phase 2~에서 6라우트 공통으로. Phase 1은 차트 page 실측 + 기존 E2E가 회귀 없는지 확인.)

- [ ] **Step 1: 차트 page 최종 실측 (필수 통과 조건)**

Run (Task 4 Step 2 재실행):
```bash
rm -rf .next && yarn build && yarn start > /tmp/final.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/final.log; do sleep 1; done
echo "AAPL: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL)"
echo "DSU: $(grep -c DYNAMIC_SERVER_USAGE /tmp/final.log)"
echo "FactLayer: $(curl -s http://localhost:3000/AAPL | grep -c '기술적 지표 요약')"
pkill -f "next start"
```
Expected: `AAPL: 200`, `DSU: 0`, `FactLayer: ≥1`.

- [ ] **Step 2: 기존 E2E 회귀 확인 (차트 관련 스펙)**

Run: `yarn e2e > /tmp/t6_e2e.log 2>&1; echo "E2E=$?"; grep -E "[0-9]+ passed|[0-9]+ failed" /tmp/t6_e2e.log | tail -2`
Expected: 차트 page 관련 스펙이 이전보다 악화되지 않음(이상적으로 500/DYNAMIC_SERVER_USAGE 사라져 개선). 잔여 실패는 Phase 2~(나머지 라우트)에서 처리됨을 기록.

- [ ] **Step 3: 커밋(없음) — Phase 1 완료**

Phase 1은 차트 page ISR+FactLayer SSR을 완성한다. Phase 2(overall→fear-greed→options→fundamental→news)는 본 plan에서 확립한 패턴(`getBarsStatic`류 정적화 헬퍼 + Suspense-fallback FactLayer)을 각 라우트에 적용하는 별도 plan으로 진행한다.

---

## Self-Review (작성자 체크 결과)

- **Spec coverage:** 정적화(Task 1 PoC→2,4) ✓ / FactLayer SSR 분리(Task 3, Suspense fallback) ✓ / ISR 무충돌·500제거(Task 4 실측) ✓ / SEO 무손상 canonical(Task 4 Step 3) ✓ / Happy+Worst(Task 5) ✓ / integration(Task 5) ✓ / 90% 커버리지(Task 5 Step 3) ✓ / 실측(Task 4·6) ✓ / E2E(Task 6) ✓.
- **Placeholder scan:** Task 4 Step 1의 "정적화 대상별 래퍼는 PoC 확정 후 동일 패턴"은 Task 1의 분기 결과에 의존하는 의도된 조건부다(A/B 모두 시그니처 동일 헬퍼로 캡슐화 명시). 그 외 placeholder 없음.
- **Type consistency:** `getBarsStatic(symbol, timeframe, fmpSymbol?): Promise<BarsData>` — Task 2 정의와 Task 3·4 호출부 일치. `TechnicalFactsSummary` props(symbol/bars/indicators)는 실제 시그니처와 일치.
- **리스크:** Task 1 PoC가 A/B를 가른다. B 채택 시 Task 2 내부만 source-direct로 교체(시그니처·호출부 불변).
