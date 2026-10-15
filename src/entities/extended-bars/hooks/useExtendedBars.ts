'use client';

import { useQuery } from '@tanstack/react-query';
import type { Bar, Timeframe } from '@y0ngha/siglens-core';
import { getExtendedBarsAction } from '@/entities/extended-bars/actions/getExtendedBarsAction';
import { BARS_STALE_TIME_MS, QUERY_KEYS } from '@/shared/config/queryConfig';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { useHumanInteracted } from '@/shared/hooks/useHumanInteracted';
import { isExtendedBarTimeframe } from '@/shared/api/market/extendedBarsSession';

interface UseExtendedBarsOptions {
    symbol: string;
    timeframe: Timeframe;
    fmpSymbol?: string;
    marketProfile: MarketProfileId;
    /** 사용자가 시간외 표시를 켜 두었는가(`siglens.chart.extendedHours`, 기본 켜짐). */
    toggledOn: boolean;
}

interface ExtendedBarsGate {
    marketProfile: MarketProfileId;
    timeframe: Timeframe;
    toggledOn: boolean;
    humanInteracted: boolean;
}

/**
 * 확장 봉을 **조회해도 되는가**. 모두 만족해야 한다(하나라도 아니면 Server Action을 부르지 않는다).
 *
 * - 미국 주식(us-equity)만 — 크립토는 24/7이라 세션이 없고, 한국 주식은 소스(yahoo)가 다르다.
 * - 인트라데이만 — 일봉 엔드포인트는 `extended`를 무시한다.
 * - 토글이 켜져 있다.
 * - `humanInteracted` — 이 탭에서 신뢰 입력이 있었다. 렌더만 하고 떠나는 크롤러가 인트라데이
 *   URL(`?timeframe=5Min`)을 열어도 확장 봉 요청은 나가지 않는다(FMP 대역폭 보호; 정규장 봉은
 *   기존 경로가 그대로 받는다). 타임프레임 버튼·키보드·터치는 모두 신뢰 입력이라 사람이 쓰는 흐름은
 *   막히지 않는다. SSR·ISR은 이 훅이 돌지 않는다(`useQuery`는 서버에서 fetch하지 않는다).
 */
export function isExtendedBarsFetchEnabled({
    marketProfile,
    timeframe,
    toggledOn,
    humanInteracted,
}: ExtendedBarsGate): boolean {
    return (
        marketProfile === 'us-equity' &&
        isExtendedBarTimeframe(timeframe) &&
        toggledOn &&
        humanInteracted
    );
}

/**
 * 프리·애프터마켓 봉(정규장 밖 봉만). 조회하지 않을 때·값이 없을 때는 `null`이다 — 호출부는 그 경우
 * 정규장 봉만 그린다(기존 동작 그대로).
 *
 * 갱신 규약은 정규장 봉(`useBars`)과 같다: staleTime `BARS_STALE_TIME_MS`(30초), 폴링 없음, 포커스·
 * 마운트 시 stale이면 재조회. 서버 캐시의 tail TTL이 60초라 더 자주 물어도 같은 값을 받는다.
 * 표시 보조 값이라 실패를 재시도로 증폭하지 않는다(`retry: false`).
 */
export function useExtendedBars({
    symbol,
    timeframe,
    fmpSymbol,
    marketProfile,
    toggledOn,
}: UseExtendedBarsOptions): Bar[] | null {
    const humanInteracted = useHumanInteracted();
    const gate = { marketProfile, timeframe, toggledOn };
    const { data } = useQuery({
        queryKey: QUERY_KEYS.extendedBars(symbol, timeframe, fmpSymbol),
        queryFn: ({ queryKey: [, qSymbol, qTimeframe, qFmpSymbol] }) =>
            getExtendedBarsAction(qSymbol, qTimeframe, qFmpSymbol),
        enabled: isExtendedBarsFetchEnabled({ ...gate, humanInteracted }),
        staleTime: BARS_STALE_TIME_MS,
        retry: false,
    });
    // 비활성 쿼리도 캐시에 남은 값은 돌려준다 — 토글을 끄거나 일봉으로 옮겼을 때 옛 확장 봉이
    // 남지 않게 입력 자격(상호작용 제외)으로 다시 거른다.
    return isExtendedBarsFetchEnabled({ ...gate, humanInteracted: true })
        ? (data ?? null)
        : null;
}
