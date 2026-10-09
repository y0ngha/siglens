'use client';

import { useQuery } from '@tanstack/react-query';
import { getBarsAction } from '@/entities/bars/actions/getBarsAction';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';
import { BARS_STALE_TIME_MS, QUERY_KEYS } from '@/shared/config/queryConfig';
import { quoteFromBars, type WatchlistQuote } from '../lib/quoteFromBars';

export interface UseWatchlistQuoteResult {
    quote: WatchlistQuote | null;
    /** 요청이 끝났는가(성공·실패 모두). `enabled`가 false면 false. */
    isSettled: boolean;
}

/**
 * 관심종목 행의 현재가·등락률. `PositionHoldingCard`와 같은 봉 쿼리 키를 써 종목 페이지를 먼저
 * 봤다면 캐시를 재사용하고(`fmpSymbol`이 없는 종목에 한해 — 관심종목 행은 `fmpSymbol`을 모르므로
 * KR·일부 지수는 키가 달라 캐시를 공유하지 못하고 서버가 다시 응답한다), `enabled`(뷰포트 진입)일 때만
 * 요청한다 — N-symbol 팬아웃 금지 원칙.
 */
export function useWatchlistQuote(
    symbol: string,
    enabled: boolean
): UseWatchlistQuoteResult {
    const { data, isPending } = useQuery({
        queryKey: QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME),
        queryFn: () => getBarsAction(symbol, DEFAULT_TIMEFRAME),
        enabled,
        staleTime: BARS_STALE_TIME_MS,
    });
    return {
        quote: data ? quoteFromBars(data.bars) : null,
        isSettled: enabled && !isPending,
    };
}
