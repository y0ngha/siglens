'use client';

import { useFearGreedFromSymbol } from '@/components/fear-greed/hooks/useFearGreedFromSymbol';
import { FearGreedHeaderChip } from '@/components/symbol-page/FearGreedHeaderChip';

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
