'use client';

import { useFearGreedFromSymbol } from '@/components/fear-greed/hooks/useFearGreedFromSymbol';
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
    const { snapshot } = useFearGreedFromSymbol({ symbol, fmpSymbol });
    return <FearGreedCard snapshot={snapshot} />;
}
