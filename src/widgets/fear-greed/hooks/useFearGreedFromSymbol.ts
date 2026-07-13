'use client';

import { useBars } from '@/entities/bars/hooks/useBars';
import { useFearGreed, type UseFearGreedResult } from './useFearGreed';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';

interface UseFearGreedFromSymbolInput {
    symbol: string;
    fmpSymbol?: string;
}

/**
 * Symbol 단위로 fear & greed snapshot + history를 산출하는 shared hook.
 * 일봉 고정(spec §2) — 사용자가 chart에서 다른 timeframe을 골라도 fearGreed는
 * 항상 1Day bars 기반. fear & greed 데이터를 소비하는 여러 UI가
 * 공통으로 이 훅을 사용한다.
 */
export function useFearGreedFromSymbol({
    symbol,
    fmpSymbol,
}: UseFearGreedFromSymbolInput): UseFearGreedResult {
    const { bars, indicators } = useBars({
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        fmpSymbol,
    });
    return useFearGreed({
        bars,
        buySellVolume: indicators.buySellVolume,
    });
}
