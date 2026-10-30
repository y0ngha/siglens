'use client';

import { useQuery } from '@tanstack/react-query';
import type { Bar, Timeframe } from '@y0ngha/siglens-core';
import { BARS_STALE_TIME_MS, QUERY_KEYS } from '@/shared/config/queryConfig';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { useHumanInteracted } from '@/shared/hooks/useHumanInteracted';
import { getExtendedBarsAction } from '../actions/getExtendedBarsAction';
import { isExtendedBarsFetchEnabled } from '../lib/extendedBarsGate';

/** `useExtendedBars` 입력 — 차트 컨테이너가 심볼·타임프레임·시장·토글 상태를 그대로 넘긴다. */
interface UseExtendedBarsOptions {
    symbol: string;
    timeframe: Timeframe;
    marketProfile: MarketProfileId;
    /** 사용자가 시간외 표시를 켜 두었는가(`siglens.chart.extendedHours`, 기본 켜짐). */
    toggledOn: boolean;
}

/**
 * 프리·애프터마켓 봉(정규장 밖 봉만). 조회하지 않을 때·값이 없을 때는 `null`이다 — 호출부는 그 경우
 * 정규장 봉만 그린다(기존 동작 그대로).
 *
 * 갱신 규약은 정규장 봉(`useBars`)과 같다: staleTime `BARS_STALE_TIME_MS`, 폴링 없음, 포커스·
 * 마운트 시 stale이면 재조회. 서버 캐시(`extendedBarsCache.ts`)의 확장 tail TTL이
 * staleTime보다 길거나 같아 더 자주 물어도 같은 값을 받는다.
 * 표시 보조 값이라 실패를 재시도로 증폭하지 않는다(`retry: false`).
 */
export function useExtendedBars({
    symbol,
    timeframe,
    marketProfile,
    toggledOn,
}: UseExtendedBarsOptions): Bar[] | null {
    const humanInteracted = useHumanInteracted();
    const gate = { marketProfile, timeframe, toggledOn };
    const { data } = useQuery({
        queryKey: QUERY_KEYS.extendedBars(symbol, timeframe),
        queryFn: ({ queryKey: [, qSymbol, qTimeframe] }) =>
            getExtendedBarsAction(qSymbol, qTimeframe),
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
