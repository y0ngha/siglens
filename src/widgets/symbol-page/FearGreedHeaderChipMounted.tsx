'use client';

import { useFearGreedFromSymbol } from '@/widgets/fear-greed';
import { FearGreedHeaderChip } from './FearGreedHeaderChip';

interface FearGreedHeaderChipMountedProps {
    symbol: string;
    fmpSymbol?: string;
}

/**
 * Mounts on every /[symbol]/* route header. Always uses 1Day bars (fearGreed
 * is daily-only by spec) regardless of the user's chart timeframe.
 */
export function FearGreedHeaderChipMounted({
    symbol,
    fmpSymbol,
}: FearGreedHeaderChipMountedProps) {
    const { snapshot } = useFearGreedFromSymbol({ symbol, fmpSymbol });
    return <FearGreedHeaderChip snapshot={snapshot} />;
}
