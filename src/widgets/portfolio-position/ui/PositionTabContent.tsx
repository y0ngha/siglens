'use client';

import dynamic from 'next/dynamic';
import { useCurrentUser } from '@/entities/auth';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { PositionCta } from './PositionCta';

// Code-split: PositionTabMemberContent pulls in useSymbolHolding (the holdings
// query) plus the building/geometry/card code, which only a present, hydrated
// member should ever download. Because this component gates BEFORE rendering
// PositionTabMemberContent, a guest never mounts the lazy component, so the
// chunk is never requested and getPortfolioHoldingsAction is never fired.
// Mirrors the deleted PositionSectionMounted's `next/dynamic({ ssr: false })` split.
const PositionTabMemberContent = dynamic(
    () =>
        import('./PositionTabMemberContent').then(
            m => m.PositionTabMemberContent
        ),
    { ssr: false }
);

interface PositionTabContentProps {
    symbol: string;
    low52w: number | null;
    high52w: number | null;
    lastClose: number | null;
    /** 5개 가격대별 최근 거래량 비중(%) — optional, 서버가 집계 못하면 null/undefined.
     * PositionBuilding의 층 hover에만 쓰인다(design §volume-by-price). */
    volumeByBand?: readonly number[] | null;
}

function PositionAuthSkeleton() {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="position-auth-loading"
            className="border-secondary-700 bg-secondary-800/40 h-40 animate-pulse rounded-xl border"
        >
            <span className="sr-only">내 위치를 불러오는 중이에요</span>
        </div>
    );
}

/**
 * Member-presence gate for the `[symbol]/position` "내 위치" tab. Rendering
 * before hydration risks an SSR/CSR text mismatch (the login check is
 * client-only), so we render nothing at all until `useHydrated()` flips —
 * mirrors PortfolioChip/PositionSectionMounted's discipline. Once hydrated:
 * a still-loading login check shows a fixed-size skeleton (no CLS); a guest
 * gets the CTA directly (no lazy import, no holdings query ever fired); only
 * a resolved, present member ever mounts the lazy `PositionTabMemberContent`
 * chunk, which is the only place `useSymbolHolding` lives.
 */
export function PositionTabContent({
    symbol,
    low52w,
    high52w,
    lastClose,
    volumeByBand,
}: PositionTabContentProps) {
    const isHydrated = useHydrated();
    const { data: user, isLoading } = useCurrentUser();

    if (!isHydrated) return null;
    if (isLoading) return <PositionAuthSkeleton />;

    if (!user) {
        return <PositionCta low52w={low52w} high52w={high52w} />;
    }

    return (
        <PositionTabMemberContent
            symbol={symbol}
            low52w={low52w}
            high52w={high52w}
            lastClose={lastClose}
            volumeByBand={volumeByBand}
        />
    );
}
