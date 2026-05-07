'use client';

import { useBars } from '@/components/symbol-page/hooks/useBars';
import { useFearGreed } from '@/components/symbol-page/hooks/useFearGreed';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { FearGreedCard } from '@/components/symbol-page/FearGreedCard';

interface FearGreedCardMountedProps {
    symbol: string;
    fmpSymbol?: string;
}

/** Always fetches 1Day bars per spec §2 (timeframe 일봉 고정), regardless of the chart's selected timeframe. */
export function FearGreedCardMounted({
    symbol,
    fmpSymbol,
}: FearGreedCardMountedProps) {
    const { bars, indicators } = useBars({
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        fmpSymbol,
    });
    const { snapshot } = useFearGreed({
        bars,
        buySellVolume: indicators.buySellVolume,
    });
    return <FearGreedCard snapshot={snapshot} />;
}
