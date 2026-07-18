'use client';

import { useSymbolHolding } from '@/features/portfolio-holding';
import { computePosition } from '../lib/positionGeometry';
import { PositionBuilding } from './PositionBuilding';
import { PositionCard } from './PositionCard';
import { PositionCta } from './PositionCta';

interface PositionTabMemberContentProps {
    symbol: string;
    low52w: number | null;
    high52w: number | null;
    lastClose: number | null;
}

function PositionSkeleton() {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="position-loading"
            className="border-secondary-700 bg-secondary-800/40 flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border p-6"
        >
            <span className="sr-only">내 위치를 불러오는 중이에요</span>
            <div
                aria-hidden="true"
                className="bg-secondary-700 h-40 w-40 animate-pulse rounded"
            />
        </div>
    );
}

function DataInsufficientNote() {
    return (
        <p
            data-testid="position-data-insufficient"
            className="text-secondary-400 border-secondary-700 rounded-lg border border-dashed p-4 text-sm"
        >
            데이터가 부족해 내 위치를 표시할 수 없어요. 가격 범위나 평단 정보를
            다시 확인해 주세요.
        </p>
    );
}

/**
 * Lazy-loaded, member-only inner content for the `[symbol]/position` tab.
 * `PositionTabContent` gates mounting this component on a resolved, present
 * member — only that audience ever fires `useSymbolHolding` (the holdings
 * query) or downloads this chunk. Mirrors the deleted `PositionSection`'s
 * holding-presence gate, extended with a graceful `computePosition` null
 * fallback (design §에러/엣지).
 */
export function PositionTabMemberContent({
    symbol,
    low52w,
    high52w,
    lastClose,
}: PositionTabMemberContentProps) {
    const { holding, isLoading, isError } = useSymbolHolding(symbol);

    if (isLoading) return <PositionSkeleton />;

    // 보유 없음(정상) + 조회 실패(degrade) 모두 CTA로 수렴 — 어느 쪽도 렌더를 깨지 않는다.
    if (isError || holding === null) {
        return <PositionCta low52w={low52w} high52w={high52w} />;
    }

    if (low52w === null || high52w === null || lastClose === null) {
        return <DataInsufficientNote />;
    }

    const avg = Number(holding.averagePrice);
    const model = computePosition({
        low52w,
        high52w,
        current: lastClose,
        avg,
    });

    if (model === null) {
        return <DataInsufficientNote />;
    }

    return (
        <div
            data-testid="position-member-content"
            className="flex flex-col gap-6 sm:flex-row sm:items-start"
        >
            <PositionBuilding
                symbol={symbol}
                model={model}
                low52w={low52w}
                high52w={high52w}
                current={lastClose}
                avg={avg}
                className="sm:w-1/2"
            />
            <div className="sm:flex-1">
                <PositionCard
                    symbol={symbol}
                    model={model}
                    low52w={low52w}
                    high52w={high52w}
                    current={lastClose}
                    avg={avg}
                />
            </div>
        </div>
    );
}
