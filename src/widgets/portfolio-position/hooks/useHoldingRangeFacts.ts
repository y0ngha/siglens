'use client';

/**
 * 보유 카드 한 장의 가격 범위 사실 — 그 종목의 기본 타임프레임 봉을 받아 최근 고/저·종가를 뽑는다.
 * 심볼 페이지의 `useBars`와 같은 쿼리 키를 써서, 먼저 다녀간 종목은 캐시를 그대로 쓴다.
 */
import { useQuery } from '@tanstack/react-query';
import { getBarsAction } from '@/entities/bars/actions/getBarsAction';
import { buildTechnicalFacts } from '@/entities/bars/lib/technicalFacts';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';
import { BARS_STALE_TIME_MS, QUERY_KEYS } from '@/shared/config/queryConfig';

interface HoldingRangeFacts {
    low52w: number;
    high52w: number;
    lastClose: number;
}

interface UseHoldingRangeFactsReturn {
    /** 봉이 없거나 범위를 만들 수 없으면 null. */
    facts: HoldingRangeFacts | null;
    isLoading: boolean;
    isError: boolean;
}

/**
 * `enabled`가 거짓이면 받지 않는다 — 카드가 화면에 들어오기 전, 그리고 평단이 잘못돼 어차피 그릴 수
 * 없을 때. `useBars`(suspense)를 쓰지 않는 이유: 카드마다 지연 로딩하고 실패를 카드 단위로 흡수해야 한다.
 */
export function useHoldingRangeFacts(
    symbol: string,
    fmpSymbol: string | undefined,
    enabled: boolean
): UseHoldingRangeFactsReturn {
    const { data, isLoading, isError } = useQuery({
        queryKey: QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, fmpSymbol),
        queryFn: () => getBarsAction(symbol, DEFAULT_TIMEFRAME, fmpSymbol),
        enabled,
        staleTime: BARS_STALE_TIME_MS,
    });
    const technical = data
        ? buildTechnicalFacts(data.bars, data.indicators)
        : null;
    return {
        facts:
            technical === null
                ? null
                : {
                      low52w: technical.low52w,
                      high52w: technical.high52w,
                      lastClose: technical.lastClose,
                  },
        isLoading,
        isError,
    };
}
