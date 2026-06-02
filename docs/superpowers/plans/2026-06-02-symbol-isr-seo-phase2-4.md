# [symbol] ISR+SEO — Phase 2~4 (나머지 5라우트 + SEO감사 + 문서화) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1에서 차트 page에 확립한 패턴(축 0 헤더 클라이언트화 + `unstable_cache` 정적화 + Suspense-fallback FactLayer SSR)을 나머지 5라우트(overall/fear-greed/options/fundamental/news)에 적용해 6라우트 전체를 ISR로 정상 캐시하고 SEO를 보존한 뒤, SEO 감사·문서화로 마무리한다.

**Architecture:** ① 각 라우트의 동적 데이터 호출을 범용 정적화 헬퍼(`staticSymbolCache` — `unstable_cache` 래퍼)로 감싼다. ② CSR bailout이 있는 overall은 차트와 동일하게 cached 분석 텍스트를 Suspense fallback으로 SSR 분리한다(나머지 4라우트는 본문 서버 렌더라 데이터 정적화만으로 SSR). ③ news는 본문 `headers()`/`waitUntil` 분석 트리거를 `NewsAiSummary`(클라) 마운트로 이전해 dynamic 강제를 제거한다. ④ 6라우트 실측·테스트 후 `seo-audit` 스킬로 SEO 감사, 마지막에 ISR 설계를 `src/app/CLAUDE.md`에 문서화한다.

**Tech Stack:** Next.js 16.2.0(App Router, ISR, `unstable_cache`), TypeScript, vitest, @upstash/redis, @tanstack/react-query

**전제:** **Phase 0+1 완료**(`docs/superpowers/plans/2026-06-02-symbol-isr-seo-phase0-1.md`) — 축 0(AuthSessionHeaderClient), `getBarsStatic`, **`getAssetInfoStatic`(getAssetInfoResilient inner 정적화 — 전역)**, 차트 page FactLayer SSR이 머지된 상태. `cacheComponents`(PPR)는 비활성 유지(이슈 #439). 축 0과 assetInfo 정적화가 전역이라 Phase 2 라우트들은 `getAssetInfoResilient`를 그대로 호출하고(이미 static-safe) **각 라우트 고유 데이터(peek/bars/options/profile/news)만 정적화**한다.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/shared/cache/staticSymbolCache.ts` | 범용 per-symbol ISR 정적화 헬퍼 | Create |
| `src/shared/cache/__tests__/staticSymbolCache.test.ts` | 헬퍼 유닛 테스트 | Create |
| `src/app/[symbol]/overall/page.tsx` | peekOverall 정적화 + 종합 분석 FactLayer SSR 분리 | Modify |
| `src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx` | overall FactLayer SSR 테스트 | Create |
| `src/app/[symbol]/fear-greed/page.tsx` | bars(layout 경유) 정적화 확인 | Modify |
| `src/app/[symbol]/options/page.tsx` | hasOptions/snapshot 정적화 | Modify |
| `src/entities/options-chain/lib/optionsDataCache.ts` | 정적화 래퍼 적용처 확인 | (read) |
| `src/app/[symbol]/fundamental/page.tsx` | profile/metrics/ratios/... 정적화(섹션 call-site) | Modify |
| `src/app/[symbol]/news/page.tsx` | newsList/grades/earnings 정적화 + headers()/waitUntil 제거 | Modify |
| `src/widgets/news/NewsAiSummary.tsx` | 분석 트리거(ensureNewsCardsAnalyzedAction) 클라 마운트로 이전 | Modify |
| `src/widgets/news/__tests__/NewsAiSummary.test.tsx` | 클라 트리거 테스트 | Modify/Create |
| `src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts` | upsert 직후 `revalidateTag('news:${symbol}')` 추가 | Modify |
| `src/app/CLAUDE.md` | ISR 4축 규약 문서화(Phase 4) | Modify |

---

## Task 1: 범용 정적화 헬퍼 `staticSymbolCache` (TDD)

**목적:** Phase 1의 `getBarsStatic`(bars 전용)을 일반화해, 여러 라우트의 per-symbol 동적 호출을 동일 규약(revalidate 1h + `symbol:` tag)으로 정적화한다.

**Files:**
- Create: `src/shared/cache/staticSymbolCache.ts`, `src/shared/cache/__tests__/staticSymbolCache.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/shared/cache/__tests__/staticSymbolCache.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const unstableCacheSpy = vi.fn();
vi.mock('next/cache', () => ({
    // unstable_cache(fn, keyParts, opts) → returns a function that calls fn.
    unstable_cache: (fn: () => unknown, keyParts: string[], opts: unknown) => {
        unstableCacheSpy(keyParts, opts);
        return fn;
    },
}));

import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';

describe('staticSymbolCache', () => {
    beforeEach(() => unstableCacheSpy.mockClear());

    it('fetcher 결과를 반환하고 keyParts/revalidate/symbol 태그를 unstable_cache에 전달한다', async () => {
        const result = await staticSymbolCache(
            ['fundamental:profile', 'AAPL'],
            'AAPL',
            () => Promise.resolve({ ok: true })
        );
        expect(result).toEqual({ ok: true });
        expect(unstableCacheSpy).toHaveBeenCalledWith(
            ['fundamental:profile', 'AAPL'],
            { revalidate: 3600, tags: ['symbol:AAPL'] }
        );
    });

    it('extraTags를 symbol 태그 뒤에 덧붙인다(news:${symbol} 그룹 무효화용)', async () => {
        await staticSymbolCache(
            ['news:list', 'AAPL'],
            'AAPL',
            () => Promise.resolve([]),
            ['news:AAPL']
        );
        expect(unstableCacheSpy).toHaveBeenCalledWith(
            ['news:list', 'AAPL'],
            { revalidate: 3600, tags: ['symbol:AAPL', 'news:AAPL'] }
        );
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/shared/cache/__tests__/staticSymbolCache.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 헬퍼 구현**

`src/shared/cache/staticSymbolCache.ts`:
```ts
import { unstable_cache } from 'next/cache';

/** ISR revalidate 주기(1h). route segment config 리터럴(3600)과 동일 의미. */
const SYMBOL_REVALIDATE_SECONDS = 3600;

/**
 * per-symbol 동적 호출(redis getOrSetCache / DB / FMP)을 Next data cache로 감싸 ISR
 * static generate가 no-store fetch에 막히지 않게 한다. 종목당 캐시이며 revalidate=1h,
 * `symbol:${SYMBOL}` 태그로 on-demand 무효화를 지원한다.
 *
 * 전제: root layout cookies() 제거(축 0)가 선결돼야 효과가 있다 — PoC에서 layout이
 * 전 라우트를 dynamic으로 강제하면 unstable_cache 래핑도 무력했다(phase0-1 plan Task 1).
 *
 * keyParts는 호출 결과를 유일하게 식별해야 한다(symbol + 추가 인자 모두 포함). fetcher는
 * 인자 없는 closure로 넘긴다(키잉은 keyParts가 담당).
 *
 * extraTags: `symbol:${symbol}`(전체 무효화) 외에 그룹 무효화용 태그를 추가한다. 예: news는
 * `news:${symbol}`을 달아, fresh 뉴스 ingestion 후 news만 골라 revalidateTag할 수 있게 한다
 * (bars/peek/profile 캐시는 보존).
 */
export function staticSymbolCache<R>(
    keyParts: readonly string[],
    symbol: string,
    fetcher: () => Promise<R>,
    extraTags: readonly string[] = []
): Promise<R> {
    return unstable_cache(fetcher, [...keyParts], {
        revalidate: SYMBOL_REVALIDATE_SECONDS,
        tags: [`symbol:${symbol}`, ...extraTags],
    })();
}
```
> `unstable_cache(fn, keyParts, options)` 시그니처대로 fetcher를 1번 인자로 넘긴다. Step 1 테스트의 `unstableCacheSpy(keyParts, opts)` mock과 일치한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/shared/cache/__tests__/staticSymbolCache.test.ts`
Expected: PASS (1).

- [ ] **Step 5: 커밋**
```bash
git add src/shared/cache/staticSymbolCache.ts src/shared/cache/__tests__/staticSymbolCache.test.ts
git commit -m "feat(cache): add staticSymbolCache — generic per-symbol ISR cache wrapper"
```

---

## Task 2: overall 라우트 — peekOverall 정적화 + 종합 분석 FactLayer SSR

**배경:** overall은 `OverallContent`(클라)가 `useTimeframeFromUrl`(→useSearchParams)로 **CSR bailout**한다. 따라서 cached 종합 분석(`peekOverallAnalysisCache`)이 OverallContent 안에 있으면 SSR HTML에 안 박힌다(차트와 동일 문제). → cached 분석을 Suspense fallback으로 SSR 분리한다.

**Files:**
- Modify: `src/app/[symbol]/overall/page.tsx`
- Create: `src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx`

- [ ] **Step 1: peekOverall 정적화**

`overall/page.tsx`의 `peekOverallAnalysisCache(...)` 호출(line ~114)을 `staticSymbolCache`로 감싼다:
```ts
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
// ... 기존 .catch degrade 유지:
const cachedOverall = await staticSymbolCache(
    ['peek:overall', upper, GEMINI_2_5_FLASH_LITE_MODEL],
    upper,
    () =>
        peekOverallAnalysisCache(
            upper,
            assetInfo.name,
            DEFAULT_TIMEFRAME,
            GEMINI_2_5_FLASH_LITE_MODEL
        )
).catch((error: unknown) => {
    console.error('[OverallPage] peekOverallAnalysisCache failed:', error);
    return null;
});
```
> 키에 `assetInfo.name`은 넣지 않는다 — companyName은 symbol에 종속(1:1)이라 `upper`로 충분하고, name 변동 시 symbol tag 무효화로 갱신된다.

- [ ] **Step 2: 종합 분석 텍스트를 Suspense fallback으로 SSR 분리**

`OverallContent`를 감싼 `<Suspense>`(line ~237)의 fallback을, cached 분석이 있으면 크롤 가능한 요약 텍스트로 교체한다. 분석 요약을 렌더하는 서버 컴포넌트가 필요하다. 기존에 분석 결론을 텍스트로 보여주는 prop 컴포넌트가 있으면 재사용하고, 없으면 `OverallContent`가 쓰는 분석 결론 필드(conclusion/scenario 등)를 sr-friendly하게 노출하는 경량 서버 컴포넌트 `OverallFactsSummary`를 만든다:

`src/widgets/overall/OverallFactsSummary.tsx` (서버 렌더 prop 컴포넌트):
```tsx
import type { OverallAnalysisResult } from '@y0ngha/siglens-core';

interface OverallFactsSummaryProps {
    symbol: string;
    analysis: OverallAnalysisResult;
}

/**
 * 종합 분석의 결정적 텍스트를 크롤 가능한 SSR HTML로 노출한다(OverallContent가
 * useSearchParams로 CSR bailout하므로 fallback 경로로 SEO 텍스트를 박는다). 차트의
 * TechnicalFactsSummary와 동일 역할 — 차트가 시각화하는 결론을 텍스트로 노출(클로킹 아님).
 */
export function OverallFactsSummary({ symbol, analysis }: OverallFactsSummaryProps) {
    return (
        <section aria-label={`${symbol} 종합 분석 요약`} className="space-y-2">
            <h2 className="sr-only">{symbol} AI 종합 분석 결론</h2>
            {/* analysis의 실제 필드명에 맞춰 결론/시나리오/위험요인 텍스트를 노출.
                정확한 필드는 OverallAnalysisResult 타입 + OverallContent 렌더 코드 참조. */}
            <p>{analysis.conclusion}</p>
        </section>
    );
}
```
> **구현 시 확정**: `OverallAnalysisResult`의 실제 필드(결론/강세·약세 시나리오/위험요인)를 `OverallContent` 렌더 코드에서 확인해 1:1로 노출한다. `analysis.conclusion`은 예시 — 실제 필드명으로 교체.

그리고 fallback 교체:
```tsx
import { OverallFactsSummary } from '@/widgets/overall/OverallFactsSummary';
// ... Suspense:
<Suspense
    fallback={
        cachedOverall ? (
            <OverallFactsSummary symbol={upper} analysis={cachedOverall} />
        ) : (
            <div className="space-y-6" aria-hidden="true">
                {/* 기존 skeleton 유지 */}
            </div>
        )
    }
>
    <OverallContent ... />
</Suspense>
```

- [ ] **Step 3: FactLayer SSR 테스트 (Happy + Worst)**

`src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx` (Phase 1 page.factlayer 패턴 복제):
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { OverallFactsSummary } from '@/widgets/overall/OverallFactsSummary';

vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(),
}));
// ... overall/page.test의 기존 mock(assetInfo/seo/navigation) 재사용

import { default as OverallPage } from '@/app/[symbol]/overall/page';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';

const mockStatic = vi.mocked(staticSymbolCache);

describe('OverallPage FactLayer SSR', () => {
    beforeEach(() => vi.clearAllMocks());

    it('Happy: cached 종합 분석 있으면 fallback에 OverallFactsSummary(SSR) 렌더', async () => {
        mockStatic.mockResolvedValue({ conclusion: '강세 우위' } as never);
        const tree = await OverallPage({ params: Promise.resolve({ symbol: 'aapl' }) });
        expect(findElementByType(tree, OverallFactsSummary)).not.toBeNull();
    });

    it('Worst: peek MISS(null)면 OverallFactsSummary 미렌더(크래시 없음, 페이지 정상)', async () => {
        mockStatic.mockResolvedValue(null as never);
        const tree = await OverallPage({ params: Promise.resolve({ symbol: 'aapl' }) });
        expect(findElementByType(tree, OverallFactsSummary)).toBeNull();
    });
});
```

- [ ] **Step 4: 테스트 + typecheck**

Run: `yarn test src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx` → PASS.
Run: `yarn typecheck 2>&1 | tail -5` → 0 errors.

- [ ] **Step 5: 커밋**
```bash
git add "src/app/[symbol]/overall/page.tsx" src/widgets/overall/OverallFactsSummary.tsx "src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx"
git commit -m "feat(overall): static peekOverall + SSR overall facts via Suspense fallback"
```

---

## Task 3: fear-greed 라우트 — bars 정적화

**배경:** fear-greed는 CSR bailout 없음(위젯에 useSearchParams 없음). 본문에서 `getBarsAction`을 `prefetchQuery`로 호출(line ~173). bars만 정적화하면 ISR static-safe.

**Files:**
- Modify: `src/app/[symbol]/fear-greed/page.tsx`

- [ ] **Step 1: bars prefetch를 getBarsStatic으로 교체**

`fear-greed/page.tsx`의 `prefetchQuery` queryFn(line ~179)을 Phase 1의 `getBarsStatic`으로 교체:
```ts
import { getBarsStatic } from '@/entities/bars/lib/barsStaticCache';
// ... prefetchQuery:
await queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
    queryFn: () =>
        getBarsStatic(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
});
```

- [ ] **Step 2: 빌드 + 런타임 실측**

Run:
```bash
rm -rf .next && yarn build > /tmp/fg_build.log 2>&1; echo "BUILD=$?"
grep -E "/\[symbol\]/fear-greed" /tmp/fg_build.log
yarn start > /tmp/fg_start.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/fg_start.log; do sleep 1; done
echo "HTTP: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL/fear-greed)"
echo "DSU: $(grep -c DYNAMIC_SERVER_USAGE /tmp/fg_start.log)"
curl -s http://localhost:3000/AAPL/fear-greed | grep -c "공포 탐욕 지수 개요"
pkill -f "next start"
```
Expected: `HTTP: 200`, `DSU: 0`, sr-only 개요 ≥ 1(SSR).

- [ ] **Step 3: canonical 회귀 가드(존재 시) + 커밋**

Run(있으면): `yarn test src/app/[symbol]/__tests__/symbol-metadata.test.ts` → PASS.
```bash
git add "src/app/[symbol]/fear-greed/page.tsx"
git commit -m "feat(fear-greed): static bars prefetch for ISR"
```

---

## Task 4: options 라우트 — hasOptions/snapshot 정적화

**배경:** options는 CSR bailout 없음. 본문에서 `hasOptionsMarket`/`fetchOptionsSnapshot`(`optionsDataCache.ts`)을 await(line ~100~110). 둘 다 정적화.

**Files:**
- Modify: `src/app/[symbol]/options/page.tsx`

- [ ] **Step 1: hasOptions/snapshot을 staticSymbolCache로 감싸기**

`options/page.tsx` 본문(default export)과 generateMetadata의 `hasOptionsMarket`/`fetchOptionsSnapshot` 호출을 정적화:
```ts
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
// 본문:
const [{ assetInfo }, hasOptions] = await Promise.all([
    getAssetInfoResilient(upper),
    staticSymbolCache(['options:has', upper], upper, () => hasOptionsMarket(upper)),
]);
// ...
const snapshot = await staticSymbolCache(
    ['options:snapshot', upper],
    upper,
    () => fetchOptionsSnapshot(upper)
);
```
> generateMetadata의 `hasOptionsMarket(upper)`도 동일하게 감싼다(동일 key라 캐시 공유 → round-trip 절약).

- [ ] **Step 2: 빌드 + 런타임 실측**

Run:
```bash
rm -rf .next && yarn build > /tmp/opt_build.log 2>&1; echo "BUILD=$?"
yarn start > /tmp/opt_start.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/opt_start.log; do sleep 1; done
echo "HTTP: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL/options)"
echo "DSU: $(grep -c DYNAMIC_SERVER_USAGE /tmp/opt_start.log)"
curl -s http://localhost:3000/AAPL/options | grep -c "옵션 분석 개요"
pkill -f "next start"
```
Expected: `HTTP: 200`, `DSU: 0`, sr-only 개요 ≥ 1.
> 옵션 없는 종목(예: 일부 ETF) 실측도 1건: `…/Ixxxx/options`가 `OptionsEmptyState`로 200 + 깨지지 않음.

- [ ] **Step 3: 커밋**
```bash
git add "src/app/[symbol]/options/page.tsx"
git commit -m "feat(options): static hasOptions/snapshot for ISR"
```

---

## Task 5: fundamental 라우트 — profile/metrics/ratios/... 정적화

**배경:** fundamental은 CSR bailout 없음. 섹션 서버 컴포넌트(ProfileSection 등)가 각자 `getProfile`/`getKeyMetricsTtm`/... (`fundamentalData.ts`, redis getOrSetCache)를 await한다. notFound는 `getProfile` 결과 null이 결정(assetInfo 아님 — 정적화 후 유지). 각 섹션 call-site를 `staticSymbolCache`로 감싼다.

**Files:**
- Modify: `src/app/[symbol]/fundamental/page.tsx`

- [ ] **Step 1: notFound 가드용 profile 정적화**

본문(default export)의 `getProfile(upper)`(Promise.all, line ~277)을 정적화:
```ts
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
const [profile, { assetInfo }] = await Promise.all([
    staticSymbolCache(['fundamental:profile', upper], upper, () => getProfile(upper)),
    getAssetInfoResilient(upper),
]);
if (profile === null) notFound();   // 정적화 후에도 profile-기반 notFound 유지
```
> `getProfile`은 `React.cache`로 per-request memo되므로 ProfileSection 내부의 재호출도 동일 요청에서 dedupe된다. 정적화는 cross-request ISR 레이어를 추가하는 것.

- [ ] **Step 2: 각 섹션 call-site 정적화**

ProfileSection/ValuationSection/PeersSection/ProfitabilitySection/GrowthSection/FinancialHealthSection/FutureDirectionSection/ProfileDescriptionSection의 데이터 호출을 각각 `staticSymbolCache`로 감싼다. 키 prefix는 `fundamental:<fn>`. 예:
```ts
// ProfileSection
const profile = await staticSymbolCache(['fundamental:profile', symbol], symbol, () => getProfile(symbol));
// ValuationSection
const metrics = await staticSymbolCache(['fundamental:metrics', symbol], symbol, () => getKeyMetricsTtm(symbol));
// PeersSection
const peers = await staticSymbolCache(['fundamental:peers', symbol], symbol, () => getStockPeers(symbol));
// ProfitabilitySection
const ratios = await staticSymbolCache(['fundamental:ratios', symbol], symbol, () => getRatiosTtm(symbol));
// GrowthSection
const growth = await staticSymbolCache(['fundamental:growth', symbol], symbol, () => getIncomeStatementGrowth(symbol));
// ProfileDescriptionSection
const descriptionKo = await staticSymbolCache(['fundamental:desc-ko', symbol], symbol, () => getProfileDescriptionKo(symbol));
// FinancialHealthSection (Promise.all 각 항목)
const [ratios, scores, cashFlow] = await Promise.all([
    staticSymbolCache(['fundamental:ratios', symbol], symbol, () => getRatiosTtm(symbol)),
    staticSymbolCache(['fundamental:scores', symbol], symbol, () => getFinancialScores(symbol)),
    staticSymbolCache(['fundamental:cashflow', symbol], symbol, () => getCashFlowStatement(symbol)),
]);
// FutureDirectionSection (Promise.all 각 항목)
const [estimates, grades, ptConsensus, ptSummary] = await Promise.all([
    staticSymbolCache(['fundamental:estimates', symbol], symbol, () => getAnalystEstimates(symbol)),
    staticSymbolCache(['fundamental:grades-consensus', symbol], symbol, () => getGradesConsensus(symbol)),
    staticSymbolCache(['fundamental:pt-consensus', symbol], symbol, () => getPriceTargetConsensus(symbol)),
    staticSymbolCache(['fundamental:pt-summary', symbol], symbol, () => getPriceTargetSummary(symbol)),
]);
```
> 섹션 try/catch(FMP payment 메시지)는 그대로 둔다 — `staticSymbolCache`는 fetcher가 throw하면 캐싱하지 않고 전파하므로 기존 에러 처리가 유지된다.

- [ ] **Step 3: 빌드 + 런타임 실측 (서버 섹션 SSR 확인)**

Run:
```bash
rm -rf .next && yarn build > /tmp/fund_build.log 2>&1; echo "BUILD=$?"
yarn start > /tmp/fund_start.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/fund_start.log; do sleep 1; done
echo "HTTP: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL/fundamental)"
echo "DSU: $(grep -c DYNAMIC_SERVER_USAGE /tmp/fund_start.log)"
curl -s http://localhost:3000/AAPL/fundamental | grep -c "펀더멘털 분석 개요"
pkill -f "next start"
```
Expected: `HTTP: 200`, `DSU: 0`, sr-only 개요 ≥ 1. 섹션 콘텐츠(시가총액/PER 등 텍스트)도 SSR HTML에 존재(서버 async 컴포넌트라 stream됨).

- [ ] **Step 4: 커밋**
```bash
git add "src/app/[symbol]/fundamental/page.tsx"
git commit -m "feat(fundamental): static-fy profile/metrics/ratios/... section fetches for ISR"
```

---

## Task 6: news 라우트 — 데이터 정적화 + headers()/waitUntil 제거(클라 트리거 이전)

**배경:** news는 본문에서 `await headers()`(isBot)로 `skipAnalysis`를 정하고 `waitUntil(ensureNewsCardsAnalyzedAction(...))`로 분석을 트리거한다. `headers()`가 라우트를 dynamic으로 강제한다. → 분석 트리거를 `NewsAiSummary`(이미 'use client') 마운트로 이전(bot은 JS 미실행이라 자연 skip). 데이터(`getNewsList`/`getGradeEvents`/`getEarningsReportComparison`)는 정적화.

**Files:**
- Modify: `src/app/[symbol]/news/page.tsx`, `src/widgets/news/NewsAiSummary.tsx`
- Modify/Create: `src/widgets/news/__tests__/NewsAiSummary.test.tsx`

- [ ] **Step 1: 본문에서 headers()/isBot/waitUntil 제거**

`news/page.tsx`에서 아래를 삭제한다(line ~166~179):
```ts
// 삭제:
const requestHeaders = await headers();
const skipAnalysis = isBot(requestHeaders);
waitUntil(ensureNewsCardsAnalyzedAction(upper, { skipAnalysis }).catch(...));
```
그리고 `import { headers } from 'next/headers';`, `import { isBot } from '@/shared/api/isBot';`, `import { waitUntil } from '@vercel/functions';`, `import { ensureNewsCardsAnalyzedAction } from '@/entities/news-article/actions';` 중 본문에서 더 안 쓰는 것을 제거.

- [ ] **Step 2: 분석 트리거를 NewsAiSummary 마운트로 이전**

`NewsAiSummary`('use client')가 마운트 시 `ensureNewsCardsAnalyzedAction(symbol)`을 한 번 호출하도록 추가한다(chart `useAnalysis` 패턴). bot은 JS 미실행 → 트리거 안 됨 → `skipAnalysis` 불필요:
```tsx
// NewsAiSummary 내부, 기존 hook들 옆:
import { useEffect, useRef } from 'react';
import { ensureNewsCardsAnalyzedAction } from '@/entities/news-article/actions';
// ...
const triggeredRef = useRef(false);
useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    void ensureNewsCardsAnalyzedAction(symbol).catch((e: unknown) => {
        console.error('[NewsAiSummary] ensureNewsCardsAnalyzedAction failed:', e);
    });
}, [symbol]);
```
> `ensureNewsCardsAnalyzedAction`은 'use server' 액션이라 클라에서 호출 가능. `skipAnalysis` 옵션은 생략(default false=실제 사용자). StrictMode 이중 마운트는 `triggeredRef`로 가드.

- [ ] **Step 3: news 데이터 정적화 + getNewsList dedupe**

본문의 `getNewsList(upper)`(JSON-LD/hasEnrichedNews용, line ~242)와 섹션의 데이터 호출을 정적화. `getNewsList`는 `React.cache`라 동일 요청 내 본문+NewsListSection 호출이 이미 dedupe되지만, 정적화는 cross-request ISR 레이어 추가:
모든 news 데이터 호출은 `news:${symbol}` 그룹 태그(4번째 인자)를 달아 on-demand 무효화 대상으로 만든다:
```ts
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
// 본문:
const newsItems = await staticSymbolCache(['news:list', upper], upper, () => getNewsList(upper), [`news:${upper}`]);
// NewsListSection:
const items = await staticSymbolCache(['news:list', symbol], symbol, () => getNewsList(symbol), [`news:${symbol}`]);  // 동일 key → 공유
// AnalystActionsSection:
const events = await staticSymbolCache(['news:grades', symbol], symbol, () => getGradeEvents(symbol), [`news:${symbol}`]);
// EventCalendarSection:
const earningsReports = await staticSymbolCache(['news:earnings', symbol, today], symbol, () => getEarningsReportComparison(symbol, today), [`news:${symbol}`]);
```
> 섹션 try/catch(FMP 메시지)는 유지. `getEarningsReportComparison`는 내부에서 DB write(refresh)를 할 수 있어 정적화 캐시 HIT 시 write를 건너뛸 수 있다 — 이는 revalidate 주기(1h) + on-demand 무효화(Step 3.5)로 갱신되므로 허용(실측에서 earnings 섹션 정상 렌더 확인).

- [ ] **Step 3.5: ingestion 직후 on-demand 무효화 (`revalidateTag`)**

`ensureNewsCardsAnalyzedAction`이 fresh 뉴스를 DB upsert한 직후(`await markFetched(symbol);` 다음 줄, line ~131)에 해당 종목 news ISR 캐시를 무효화한다:
```ts
import { revalidateTag } from 'next/cache';
// ... await markFetched(symbol); 직후:
// fresh 뉴스가 DB에 반영됐으니 news ISR 캐시(news:${symbol} 그룹)를 무효화한다.
// → 다음 요청부터 news 리스트/JSON-LD가 fresh. bars/peek/profile 캐시는 보존.
revalidateTag(`news:${symbol.toUpperCase()}`);
```
> `symbol.toUpperCase()`로 정규화 — 정적화 호출부의 태그(`news:${upper}`)와 대소문자 일치시킨다(라우트는 `upper`/`symbol`이 이미 대문자 정규화). `revalidateTag`는 'use server' 액션 안에서 호출 가능하며, 클라(NewsAiSummary) 트리거 경로에서도 정상 동작한다. 분석(sentiment) 부착은 이후 단계라 리스트/JSON-LD(SEO 핵심)가 우선 갱신되고, sentiment는 다음 revalidate 주기에 반영된다.

- [ ] **Step 4: NewsAiSummary 클라 트리거 테스트**

`src/widgets/news/__tests__/NewsAiSummary.test.tsx`(기존 있으면 보강):
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/entities/news-article/actions', () => ({
    ensureNewsCardsAnalyzedAction: vi.fn().mockResolvedValue(undefined),
}));
// ... NewsAiSummary가 쓰는 다른 hook/provider mock

import { NewsAiSummary } from '@/widgets/news/NewsAiSummary';
import { ensureNewsCardsAnalyzedAction } from '@/entities/news-article/actions';

describe('NewsAiSummary mount trigger', () => {
    beforeEach(() => vi.clearAllMocks());

    it('마운트 시 ensureNewsCardsAnalyzedAction을 symbol로 1회 호출한다', () => {
        render(<NewsAiSummary symbol="AAPL" companyName="Apple" hasEnrichedNews={false} />);
        expect(ensureNewsCardsAnalyzedAction).toHaveBeenCalledWith('AAPL');
        expect(ensureNewsCardsAnalyzedAction).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 5: 빌드 + 런타임 실측 (headers() 제거 확인)**

Run:
```bash
rm -rf .next && yarn build > /tmp/news_build.log 2>&1; echo "BUILD=$?"
grep -E "/\[symbol\]/news" /tmp/news_build.log   # ● (SSG) 기대 — ƒ 아님
yarn start > /tmp/news_start.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/news_start.log; do sleep 1; done
echo "HTTP: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL/news)"
echo "DSU: $(grep -c DYNAMIC_SERVER_USAGE /tmp/news_start.log)"
curl -s http://localhost:3000/AAPL/news | grep -c "뉴스 분석 개요"
pkill -f "next start"
```
Expected: `BUILD=0`, news가 `ƒ` 아님(headers() 제거됨), `HTTP: 200`, `DSU: 0`, sr-only 개요 ≥ 1, newsListJsonLd(`ItemList`) SSR.

- [ ] **Step 6: 테스트 + 커밋**

Run: `yarn test src/widgets/news/__tests__/NewsAiSummary.test.tsx` → PASS.
```bash
git add "src/app/[symbol]/news/page.tsx" src/widgets/news/NewsAiSummary.tsx "src/widgets/news/__tests__/NewsAiSummary.test.tsx" src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts
git commit -m "feat(news): static-fy news data + client analysis trigger + on-demand revalidateTag (remove headers() ISR blocker)"
```

---

## Task 7: 6라우트 통합 실측 + 테스트 회귀 + 커버리지

**Files:** (검증)

- [ ] **Step 1: 6라우트 전체 prod 실측 (필수 통과)**

Run:
```bash
rm -rf .next && yarn build > /tmp/all_build.log 2>&1; echo "BUILD=$?"
grep -E "/\[symbol\]" /tmp/all_build.log    # 6라우트 모두 ● (SSG) 기대
yarn start > /tmp/all_start.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/all_start.log; do sleep 1; done
for p in "" /overall /fear-greed /options /fundamental /news; do
  echo "AAPL$p: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL$p)"
done
echo "DSU total: $(grep -c DYNAMIC_SERVER_USAGE /tmp/all_start.log)"
pkill -f "next start"
```
Expected: 6라우트 빌드 `●`, 전부 `200`, `DSU total: 0`.

- [ ] **Step 2: 전체 테스트 회귀 + 변경 파일 커버리지**

Run: `yarn test > /tmp/all_test.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/all_test.log` → `EXIT=0`.
Run: `yarn test-coverage 2>&1 | grep -E "staticSymbolCache|overall/page|fundamental/page|news/page|options/page|fear-greed/page|OverallFactsSummary|NewsAiSummary"`
Expected: 변경 파일 90%+ (미달 시 worst-case 테스트 보강).

- [ ] **Step 3: 기존 E2E 회귀 확인**

Run: `yarn e2e > /tmp/all_e2e.log 2>&1; echo "E2E=$?"; grep -E "[0-9]+ passed|[0-9]+ failed" /tmp/all_e2e.log | tail -2`
Expected: 이전(ISR 도입 전) 대비 악화 없음, 이상적으로 500/DSU 폭주 제거로 17 실패 해소 + 속도 회복.

- [ ] **Step 4: 커밋(없음) — Phase 2 완료**

---

## Task 8: Phase 3 — `seo-audit` 스킬로 6라우트 SEO 감사 + 수정

**배경:** FactLayer/분석 SSR 전환으로 크롤 가능 콘텐츠·h 위계·구조화 데이터·canonical 표면이 바뀌었다. 6라우트 전체를 감사한다.

- [ ] **Step 1: prod build+start 후 각 라우트 HTML 확보**

Run:
```bash
rm -rf .next && yarn build && yarn start > /tmp/seo_start.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/seo_start.log; do sleep 1; done
for p in "" /overall /fear-greed /options /fundamental /news; do
  curl -s "http://localhost:3000/AAPL$p" > "/tmp/seo_AAPL${p//\//_}.html"
done
# start는 감사 중 유지, 완료 후 pkill
```

- [ ] **Step 2: seo-audit 스킬 실행(라우트별)**

각 라우트(`/AAPL`, `/AAPL/overall`, `/AAPL/fear-greed`, `/AAPL/options`, `/AAPL/fundamental`, `/AAPL/news`)에 대해 `seo-audit` 스킬을 호출해 감사한다. 점검 항목: 단일 h1 + h 위계, title/description/canonical, JSON-LD 유효성(WebPage/FAQ/Article/ItemList/Breadcrumb), 크롤 가능 본문 텍스트(FactLayer/섹션 SSR), noindex 정합(invalid ticker/degraded), robots/sitemap.
> seo-audit 스킬 미가용 시: `docs/SCOPE.md`/CLAUDE.md의 SEO 가이드와 `symbol-metadata.test`로 대체 점검.

- [ ] **Step 3: 발견 이슈 수정 + 검증**

감사 발견 항목을 수정하고, 각 수정은 해당 라우트 실측(SSR HTML 재확인) + Happy/Worst 테스트로 검증한다. `pkill -f "next start"`로 정리.

- [ ] **Step 4: 커밋**
```bash
git add -A
git commit -m "fix(seo): address seo-audit findings across [symbol] 6 routes after ISR/SSR migration"
```

---

## Task 9: Phase 4 — ISR 설계 문서화 (`src/app/CLAUDE.md`)

- [ ] **Step 1: ISR/Route Segment Config 섹션에 4축 규약 추가**

`src/app/CLAUDE.md`의 "ISR / Route Segment Config" 섹션에 아래를 추가한다:

```markdown
### ISR 4축 규약 (`[symbol]` ISR+SEO, 2026-06-02)

PPR(`cacheComponents`) 비활성 상태에서 동적 세그먼트를 ISR로 정상 캐시하려면 4가지를 모두 지켜야 한다:

1. **(축 0) 공유 셸에서 `cookies()`/`headers()` 금지.** root layout 등 모든 라우트가
   공유하는 셸이 `cookies()`/`headers()`를 직접 호출하면(Suspense 안이라도) PPR-off에선
   전 라우트가 dynamic으로 강제돼 ISR이 깨진다. 인증 헤더는 클라이언트화(hint 쿠키
   `document.cookie` + `currentUserAction`)로 처리한다 — `AuthSessionHeaderClient` 참조.
   라우트 본문의 `headers()`(예: 봇 판정)도 같은 이유로 제거하고 클라 트리거로 이전한다
   (news `NewsAiSummary` 참조).
2. **(축 1) 동적 데이터(redis/DB/FMP)는 `staticSymbolCache`로 정적화.** `@upstash/redis`
   HTTP는 no-store fetch라 static generate가 `DYNAMIC_SERVER_USAGE`를 throw한다.
   `unstable_cache`(= `staticSymbolCache`, revalidate 1h + `symbol:` tag)로 감싸야 ISR이
   데이터를 HTML에 박고 정적 캐시한다. (단 축 0이 선결돼야 효과가 있다.) 신선도가 민감한
   라우트(news)는 `news:${symbol}` 그룹 태그를 추가로 달고, 데이터 변경(뉴스 ingestion) 직후
   `revalidateTag('news:${symbol}')`로 **on-demand 무효화**해 1h를 기다리지 않고 갱신한다.
3. **(축 2) `useSearchParams` CSR bailout 밖으로 SEO 콘텐츠 분리.** `useSearchParams`(예:
   timeframe)를 쓰는 클라 위젯은 SSR HTML이 비므로, 크롤 가능 텍스트(FactLayer)는
   Suspense fallback에 서버 컴포넌트로 박는다(`TechnicalFactsSummary`/`OverallFactsSummary`).
4. **(축 3) `generateStaticParams=[]` + `revalidate=3600`(리터럴) 유지.**

> ⚠️ 빌드 output의 `●`(SSG) 표시 ≠ 런타임 동작. 반드시 `prod build && start` 후
> 런타임 로그의 `DYNAMIC_SERVER_USAGE` 0 + `x-nextjs-cache`로 실측 검증한다.
> (설계: `docs/superpowers/specs/2026-06-02-symbol-isr-seo-design.md`)
```

또한 "Next.js 16 Notes"/"cacheComponents 비활성" Note 옆에 "축 0(공유 셸 cookies 금지)"을 교차 참조로 한 줄 추가.

- [ ] **Step 2: 커밋**
```bash
git add src/app/CLAUDE.md
git commit -m "docs(app): document [symbol] ISR 4-axis convention (cookies/static/CSR-bailout/segment-config)"
```

---

## Self-Review (작성자 체크 결과)

- **Spec coverage:** overall(Task 2: peek 정적화 + FactLayer SSR) ✓ / fear-greed(Task 3) ✓ / options(Task 4) ✓ / fundamental(Task 5, profile-notFound 유지) ✓ / news(Task 6, headers() 제거 + 클라 트리거 + 데이터 정적화) ✓ / 6라우트 실측·테스트·커버리지(Task 7) ✓ / seo-audit(Task 8) ✓ / 문서화(Task 9) ✓.
- **Placeholder scan:** Task 2의 `OverallFactsSummary`는 `OverallAnalysisResult` 실제 필드 확인 후 노출(구현 시 확정 명시 — 타입 기반이라 placeholder 아님). Task 1 Step 3은 폐기 블록을 명시 표기하고 정확 구현 블록을 제공. 그 외 placeholder 없음.
- **Type consistency:** `staticSymbolCache(keyParts, symbol, fetcher): Promise<R>` — Task 1 정의와 Task 2·4·5·6 호출부 일치. `getBarsStatic`(Phase 1) 재사용(Task 3) 시그니처 일치.
- **순서/전제:** Phase 0+1(축 0 + getBarsStatic + 차트 FactLayer) 완료가 전제. Task 1(헬퍼) → 라우트별 → 통합 실측 → SEO감사 → 문서 순. 라우트 간 독립이라 Task 2~6는 병렬화 가능(워크트리). 단 Task 1(헬퍼)은 선행.
- **리스크:** ① fundamental의 12개 fetch 정적화 후 섹션 throw가 static gen을 깨는지 — Task 5 Step 3 실측(DSU 0)으로 게이트. ② news `getEarningsReportComparison`의 DB write가 캐시 HIT 시 skip되는 부작용 — revalidate 1h로 갱신, 실측에서 earnings 섹션 정상 확인. ③ overall FactLayer 필드 매핑 — 구현 시 `OverallAnalysisResult` 타입으로 확정.
```
