'use client';

import { useSymbolHolding } from '@/features/portfolio-holding/hooks/useSymbolHolding';
import { computePosition } from '../lib/positionGeometry';
import { PositionCard } from './PositionCard';

interface PositionSectionProps {
    symbol: string;
    low52w: number;
    high52w: number;
    lastClose: number;
}

/**
 * Presence-gates "내 위치" on: a holding for this symbol + a geometrically
 * valid range. Lazy-loaded via PositionSectionMounted's `next/dynamic`
 * import — only a hydrated, present member ever mounts this component, so
 * `useSymbolHolding`'s holdings query only ever fires for that audience.
 * Guests, members without a holding, and a degenerate range (bars still
 * loading / FMP degraded) all render nothing — this is a presentation-only
 * widget, never an error state.
 */
export function PositionSection({
    symbol,
    low52w,
    high52w,
    lastClose,
}: PositionSectionProps) {
    const { holding } = useSymbolHolding(symbol);
    if (!holding) return null;

    const avg = Number(holding.averagePrice);

    const model = computePosition({
        low52w,
        high52w,
        current: lastClose,
        avg,
    });
    if (!model) return null;

    return (
        <PositionCard
            symbol={symbol}
            model={model}
            low52w={low52w}
            high52w={high52w}
            current={lastClose}
            avg={avg}
        />
    );
}
