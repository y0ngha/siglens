import type { QueryClient } from '@tanstack/react-query';
import type { BarsData } from '@y0ngha/siglens-core';

import { getSeedBarsStatic } from '@/entities/bars/lib/barsStaticCache';
import { buildTechnicalFacts } from '@/entities/bars/lib/technicalFacts';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { MS_PER_SECOND } from '@/shared/config/time';

/**
 * 차트 탭의 기술적 사실 요약을 그릴 수 있는가 — 메타데이터 색인 게이트(`hasPriceData`)와 본문의 크롤용
 * 영구 사본이 **같은 술어**를 쓴다(CONVENTIONS.md#CP-2).
 *
 * `bars.length > 0`이 아니라 `buildTechnicalFacts`로 판정한다. 그 헬퍼는 등락률 분모로 직전 봉이 필요해
 * 봉 2개 미만이면 `null`이고, 그러면 본문 요약이 통째로 빠져 페이지가 제목만 남는다 — 봉 1개짜리
 * 상장폐지 종목이 색인되던 이유다.
 */
export function hasTechnicalFacts(bars: BarsData): boolean {
    return buildTechnicalFacts(bars.bars, bars.indicators) !== null;
}

interface SeedChartBarsInput {
    /** 대문자 티커 — 레이아웃·메타데이터와 같은 인자라 요청 스코프 메모가 접힌다. */
    readonly ticker: string;
    /** URL 세그먼트 원문 — 시드 키는 클라 훅이 읽는 값과 같아야 한다. */
    readonly segment: string;
    readonly marketProfile: MarketProfileId;
    readonly fmpSymbol: string | undefined;
    /** 이 렌더가 읽은 quantize 봉. `null`(조회 실패)이면 시드하지 않는다. */
    readonly quantizedBars: BarsData | null;
}

/**
 * 차트 탭 기본 타임프레임 봉을 React Query에 시드하고, 실제로 시드했는지 돌려준다(`hasBarsSeed`).
 *
 * - 조회 실패(`null`)는 시드하지 않는다. `null`을 `setQueryData`에 넣으면 null "success"가 캐시에
 *   박혀 클라 훅이 `data.bars`를 null에서 읽다 깨지고, stale 트리거도 아니라 재조회도 안 된다. 시드가
 *   없으면 클라 `useBars`가 라이브로 받는다. 시드 여부를 클라에 알리는 이유는 차트가 서버에서도
 *   렌더되기 때문이다 — 시드 없이 SSR하면 서버 렌더가 봉 Server Action을 부른다.
 * - `updatedAt`은 마지막 완료 봉의 시각(초 → 밀리초)으로 고정한다(AP-2). 기본값 `Date.now()`는 같은
 *   봉이어도 재생성마다 HTML을 바꿔 ISR write를 낳는다.
 * - 시드에는 축소판(`getSeedBarsStatic`)을 넣는다 — 클라 첫 페인트는 rsi·macd·buySellVolume만 읽는다.
 *   같은 quantize 결과를 재사용하므로 추가 조회는 없다. 축소 단계도 런타임 shape가 어긋나면 throw할 수
 *   있어 fail-open으로 감싼다.
 */
export async function seedChartBars(
    queryClient: QueryClient,
    {
        ticker,
        segment,
        marketProfile,
        fmpSymbol,
        quantizedBars,
    }: SeedChartBarsInput
): Promise<boolean> {
    if (quantizedBars === null) return false;
    const seedBars = await getSeedBarsStatic(
        ticker,
        DEFAULT_TIMEFRAME,
        marketProfile,
        fmpSymbol
    ).catch((e: unknown) => {
        console.error('[SymbolPage] getSeedBarsStatic failed:', e);
        return null;
    });
    if (seedBars === null) return false;
    const lastBarSec = quantizedBars.bars.at(-1)?.time ?? 0;
    queryClient.setQueryData(
        QUERY_KEYS.bars(segment, DEFAULT_TIMEFRAME, fmpSymbol),
        seedBars,
        { updatedAt: lastBarSec * MS_PER_SECOND }
    );
    return true;
}
