import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { SECONDS_PER_QUARTER_DAY } from '@/shared/config/time';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { runWithRenderBudget } from '@/shared/lib/renderBudget';
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';
import { quantizeBarsDataToLastClosed } from '../lib/quantizeBars';
import { toSeedBarsData } from '../lib/seedBars';
import { loadBarsData } from './loadBarsData';

/**
 * 봉이 하나도 없는 결과를 장기 캐시에 넣지 않으려 `unstable_cache` 콜백 안에서 던지는 sentinel
 * (`cacheNonEmpty`·`cacheNonNull`과 같은 방식). **바깥에서 잡아 빈 `BarsData`로 돌려준다** —
 * "provider가 예외를 던짐"(degraded)과 "봉이 정말 0개"(`no-price-data`)는 다른 상태라 호출부가
 * 구분할 수 있어야 한다. 빈 결과를 담아 두는 이유다.
 */
export class EmptyBarsError extends Error {
    constructor(
        symbol: string,
        readonly data: BarsData
    ) {
        super(symbol);
    }
}

/**
 * ISR static-safe 봉 조회. `loadBarsData`(메모리 LRU + provider)를 Next data cache로 감싸 static
 * generate가 no-store fetch에 막히지 않게 한다. 종목당 캐시이며 revalidate=6h 상한으로 주기
 * 갱신한다. 호출부는 본 함수만 쓴다.
 *
 * revalidate=6h 이유: 사용자 신선도는 클라이언트 `useBars` 30초 refetch가 담당하고, 이 값은
 * 차트 탭(`[symbol]/page.tsx`, 6h 선언)의 크롤러 SSR 신선도에 맞춘 것이다.
 *
 * ⚠️ **이 캐시를 읽는 라우트는 6h 이하로 clamp된다.** Next 16.3은 렌더 중 읽힌 모든
 * `unstable_cache`(HIT·MISS 무관)의 revalidate 최솟값으로 라우트 revalidate를 낮춘다
 * (`unstableCacheRevalidateLowering.test.ts`). 6h로 올린다고 12h·24h 서브페이지의 clamp가
 * 풀리지 않는다 — 공유 레이아웃이 이 캐시를 읽는 한 모든 탭이 6h로 내려간다(2026-10 운영 실측:
 * `/AAPL/fundamental`·`/AAPL/news` s-maxage 21600). 그래서 레이아웃·공포·탐욕 탭·포지션 탭은 이 캐시 대신 세션 키 캐시
 * (`sessionBarsStaticCache.ts`, revalidate 24h)를 읽는다. 6h보다 긴 revalidate를 선언한 탭에서
 * 이 함수(`getQuantizedBarsStatic`·`getSeedBarsStatic` 포함)를 부르지 않는다 —
 * `src/__tests__/guards/symbolTabRevalidateClamp.test.ts`가 고정한다.
 * on-demand 무효화는 `revalidateTag('symbol:AAPL')`로 여전히 가능.
 *
 * 전제: 이 정적화는 root layout cookies() 제거(축 0)가 선결돼야 효과가 있다 — PoC에서
 * layout이 전 라우트를 dynamic으로 강제하면 unstable_cache 래핑도 무력하다.
 *
 * symbol은 대문자로 정규화한다 — 호출부가 라우트 param(소문자 'aapl')과 ticker(대문자
 * 'AAPL') 양쪽으로 호출하므로, 정규화하지 않으면 같은 종목이 'AAPL'/'aapl' 두 unstable_cache
 * 엔트리·태그로 분기돼 캐시 중복 + revalidateTag('symbol:AAPL') 무효화 누락이 생긴다.
 * fmpSymbol은 FMP 고유 심볼이라 대소문자를 보존한다.
 *
 * ## 실패·빈 결과를 장기 캐시에 넣지 않는다
 *
 * provider가 일시 장애를 삼키고 **빈 봉**을 resolve하면 그 결과가 6h 동안 캐시에 굳어,
 * 큐레이션 종목이 `no-price-data`로 noindex되는 렌더가 반나절 서빙된다. 그래서 빈 봉이면 콜백
 * 안에서 `EmptyBarsError`를 던져 저장을 건너뛴다(`unstable_cache`는 throw하면 저장하지 않고,
 * stale 엔트리가 있으면 그 값을 돌려준다). 던지는 쪽이 콜백 **안**, 잡는 쪽이 **밖**이어야 한다.
 * 두 경우를 **구분해서** 돌려준다:
 * - **provider 예외** → 그대로 다시 던진다. 호출부의 `.catch(() => null)`이 degraded로 처리하고,
 *   그 탭은 `degraded-with-snapshot` 규칙을 탈 수 있다.
 * - **빈 결과(봉 0개)** → 빈 `BarsData`를 **돌려준다**(null 아님). 호출부가 `hasPriceData === false`
 *   (`no-price-data`, 스냅샷이 있어도 색인 불가)에 도달하고, `degraded-with-snapshot`이 이 판정을
 *   구해 주지 않는다. 장기 캐시에는 들어가지 않으므로 다음 재생성이 다시 읽는다.
 *
 * 큐레이션 종목이 실패하거나 빈 결과면 이 렌더의 revalidate를 300초로 낮춘다
 * (`shortenRevalidateForRuntimeDegrade`, 콜백 바깥에서 불러야 효과가 있다) — 노출 창이 6h 대신
 * 5분이다. 롱테일은 어차피 noindex라 재생성 비용을 쓰지 않는다.
 */
export async function getBarsStatic(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    const ticker = symbol.toUpperCase();
    try {
        return await unstable_cache(
            async () => {
                // 렌더 예산: FMP가 느리면 짧게 실패해 degrade한다(`renderBudget.ts`).
                const data = await runWithRenderBudget(() =>
                    loadBarsData(ticker, timeframe, fmpSymbol)
                );
                if (data.bars.length === 0)
                    throw new EmptyBarsError(ticker, data);
                return data;
            },
            // `-v2`: 값에 공포·탐욕용 5년 일봉(`fearGreedBars`)이 들어 있다. 이 필드가 없는 항목을
            // 읽으면 서버 점수가 2년 기준으로 돌아가므로 키 버전으로 분리한다.
            ['bars-static-v2', ticker, timeframe, fmpSymbol ?? ''],
            { revalidate: SECONDS_PER_QUARTER_DAY, tags: [`symbol:${ticker}`] }
        )();
    } catch (error) {
        // Next 제어 흐름은 degrade가 아니다.
        if (isDynamicServerError(error)) throw error;
        if (isCuratedSymbol(ticker)) await shortenRevalidateForRuntimeDegrade();
        // 빈 결과는 "장애"가 아니라 "봉 0개"다 — 빈 데이터를 돌려 호출부가 no-price-data로 판정한다.
        if (error instanceof EmptyBarsError) return error.data;
        throw error;
    }
}

/**
 * `getBarsStatic` + `quantizeBarsDataToLastClosed`를 요청 단위로 **한 번만** 수행한다.
 * `/[symbol]` 트리에서 bars를 seed하는 호출부는 모두 이 함수를 써야 한다.
 *
 * ## 왜 필요한가 — RSC 페이로드에 지표가 두 벌 실리는 문제
 *
 * layout(`SymbolLayoutChrome`)과 page가 각각 같은 쿼리 키로 `setQueryData` → `dehydrate`
 * 한다. Flight 직렬화기는 **동일 객체 참조**일 때만 두 번째 등장을
 * `"$2d:props:state:queries:1:state:data:bars"` 같은 참조로 접는다. 접히지 않으면
 * 지표 한 벌(약 507KB)이 통째로 더 실린다. (레이아웃은 이제 봉을 읽지 않는다 — 헤더 칩은
 * 세션 키 캐시를 쓴다. 지금 이 메모가 접는 것은 차트 탭의 `generateMetadata`·본문·seed 호출이다.)
 *
 * 참조가 갈리는 지점이 둘이었다:
 * 1. `loadBarsData`가 `roundIndicators`로 매 호출 새 `indicators`를 만든다(v0.53.3).
 * 2. `quantizeBarsDataToLastClosed`가 **정규장 중이고 마지막 봉이 현재 세션 날짜의 봉일 때**
 *    새 객체를 할당한다(`quantizeBars.ts` — 장 마감이거나 오늘 봉이 아직 없으면 입력을 그대로
 *    통과시킨다). 크립토는 24/7이라 오늘 봉이 있는 한 상시 해당.
 *
 * 그래서 v0.53.3 이전에도 **장중·크립토에서는 이미 두 벌**이었고, 장 마감에만 한 벌이었다.
 * 이 함수가 두 단계를 함께 감싸 요청 스코프에서 접으므로, 세션 상태·자산군과 무관하게
 * 항상 한 벌이 된다.
 *
 * ⚠️ 인자는 전부 원시값이어야 하고(`React.cache`는 인자를 `Object.is`로 키잉한다),
 * 호출부는 **대문자 ticker**로 통일해 넘긴다 — `'aapl'`과 `'AAPL'`이 갈리면 접기가 깨진다.
 * `now`를 인자로 받지 않는 것도 같은 이유다(매 호출 다른 `Date`는 키를 무조건 깨뜨린다).
 */
export const getQuantizedBarsStatic = cache(
    async (
        ticker: string,
        timeframe: Timeframe,
        marketProfile: MarketProfileId,
        fmpSymbol?: string
    ): Promise<BarsData> => {
        const data = await getBarsStatic(ticker, timeframe, fmpSymbol);
        return quantizeBarsDataToLastClosed(
            data,
            new Date(),
            sessionSpecFor(marketProfile)
        );
    }
);

/**
 * `getQuantizedBarsStatic`의 **RSC seed 전용** 축소판(`toSeedBarsData`). 축소 규칙과 안전 근거는
 * 그 함수 JSDoc을 본다.
 *
 * `React.cache`로 감싸는 이유는 `getQuantizedBarsStatic`과 같다 — layout과 page가 각각 호출해도
 * **같은 객체 참조**를 받아야 Flight 직렬화기가 두 번째 등장을 접는다. 호출부에서 매번 새로 객체를
 * 만들면 접기가 깨져 축소분이 두 벌 실린다.
 */
export const getSeedBarsStatic = cache(
    async (
        ticker: string,
        timeframe: Timeframe,
        marketProfile: MarketProfileId,
        fmpSymbol?: string
    ): Promise<BarsData> =>
        toSeedBarsData(
            await getQuantizedBarsStatic(
                ticker,
                timeframe,
                marketProfile,
                fmpSymbol
            )
        )
);
