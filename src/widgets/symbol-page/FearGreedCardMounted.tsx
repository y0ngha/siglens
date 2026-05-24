'use client';

import { useFearGreedFromSymbol } from '@/widgets/fear-greed';
import { FearGreedCard } from './FearGreedCard';

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
