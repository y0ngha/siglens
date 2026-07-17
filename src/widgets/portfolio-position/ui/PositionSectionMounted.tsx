'use client';

import { useCurrentUser } from '@/entities/auth';
import { useSymbolHolding } from '@/features/portfolio-holding/hooks/useSymbolHolding';
import { computePosition } from '../lib/positionGeometry';
import { PositionCard } from './PositionCard';

interface PositionSectionMountedProps {
    symbol: string;
    low52w: number;
    high52w: number;
    lastClose: number;
}

/**
 * Presence-gates "내 위치" on: hydrated + a present member + a holding for
 * this symbol + a geometrically valid 52-week range. Mirrors
 * PortfolioChipMounted's null-until-hydrated discipline (client-only query,
 * no SSR/hydration mismatch) with an explicit `useCurrentUser` gate as
 * belt-and-suspenders. Guests, members without a holding, and a degenerate
 * range (bars still loading / FMP degraded) all render nothing — this is a
 * presentation-only widget, never an error state.
 */
export function PositionSectionMounted({
    symbol,
    low52w,
    high52w,
    lastClose,
}: PositionSectionMountedProps) {
    const { data: user } = useCurrentUser();
    const { holding, isHydrated } = useSymbolHolding(symbol);

    if (!isHydrated) return null;
    if (!user) return null;
    if (holding === null) return null;

    const model = computePosition({
        low52w,
        high52w,
        current: lastClose,
        avg: Number(holding.averagePrice),
    });
    if (model === null) return null;

    return (
        <PositionCard
            symbol={symbol}
            model={model}
            low52w={low52w}
            high52w={high52w}
            current={lastClose}
            avg={Number(holding.averagePrice)}
        />
    );
}
