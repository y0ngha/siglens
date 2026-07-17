'use client';

import dynamic from 'next/dynamic';
import { useCurrentUser } from '@/entities/auth';
import { useHydrated } from '@/shared/hooks/useHydrated';

interface PositionSectionMountedProps {
    symbol: string;
    low52w: number;
    high52w: number;
    lastClose: number;
}

// Code-split: PositionSection pulls in useSymbolHolding (the holdings query)
// plus the gauge/geometry/card code, which only a present, hydrated member
// should ever download. Because this component gates BEFORE rendering
// PositionSection below, a guest (or a not-yet-hydrated paint) never mounts
// the lazy component, so the chunk is never requested and
// getPortfolioHoldingsAction is never fired. Mirrors PortfolioChip's
// PortfolioChipPopover split.
const PositionSection = dynamic(
    () => import('./PositionSection').then(m => m.PositionSection),
    { ssr: false }
);

/**
 * Light presence gate for "내 위치": hydrated + a present member only. Kept
 * free of `useSymbolHolding` itself (that lives in the lazy-loaded
 * PositionSection) so every hydrated GUEST — the common case — never fires
 * the holdings query and never downloads the gauge bundle. Mirrors
 * PortfolioChipMounted's null-until-hydrated discipline (client-only query,
 * no SSR/hydration mismatch) with an explicit `useCurrentUser` gate as
 * belt-and-suspenders.
 */
export function PositionSectionMounted({
    symbol,
    low52w,
    high52w,
    lastClose,
}: PositionSectionMountedProps) {
    const isHydrated = useHydrated();
    const { data: user } = useCurrentUser();

    if (!isHydrated) return null;
    if (!user) return null;

    return (
        <PositionSection
            symbol={symbol}
            low52w={low52w}
            high52w={high52w}
            lastClose={lastClose}
        />
    );
}
