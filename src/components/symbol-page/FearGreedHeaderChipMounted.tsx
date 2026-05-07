'use client';

import { useBars } from '@/components/symbol-page/hooks/useBars';
import { useFearGreed } from '@/components/fear-greed/hooks/useFearGreed';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
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
    const { bars, indicators } = useBars({
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        fmpSymbol,
    });
    const { snapshot } = useFearGreed({
        bars,
        buySellVolume: indicators.buySellVolume,
    });
    return <FearGreedHeaderChip snapshot={snapshot} />;
}
