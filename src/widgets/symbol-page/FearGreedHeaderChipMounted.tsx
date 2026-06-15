'use client';

import { useFearGreedFromSymbol } from '@/widgets/fear-greed';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { FearGreedHeaderChip } from './FearGreedHeaderChip';

interface FearGreedHeaderChipMountedProps {
    symbol: string;
    fmpSymbol?: string;
}

/**
 * Mounts on every /[symbol]/* route header. Always uses 1Day bars (fearGreed
 * is daily-only by spec) regardless of the user's chart timeframe.
 *
 * Hydration: the snapshot is derived from `useBars` (useSuspenseQuery), whose
 * client-resolved value can differ from the SSR seed (short staleTime → the
 * dehydrated bars vs the client's refetched bars), yielding a different
 * label/score. Rendering that during hydration trips a text mismatch (React
 * #418, observed app-wide on every symbol header). So we render a stable
 * skeleton until hydrated and show the real chip only afterward — SSR and the
 * first client render are then identical.
 */
export function FearGreedHeaderChipMounted({
    symbol,
    fmpSymbol,
}: FearGreedHeaderChipMountedProps) {
    const isHydrated = useHydrated();
    const { snapshot } = useFearGreedFromSymbol({ symbol, fmpSymbol });
    if (!isHydrated) {
        return (
            <span
                className="bg-secondary-700/40 inline-flex h-5 w-16 animate-pulse rounded"
                aria-hidden="true"
            />
        );
    }
    return <FearGreedHeaderChip snapshot={snapshot} />;
}
