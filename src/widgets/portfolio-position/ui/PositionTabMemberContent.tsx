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
                // `sm:max-w-[N]` + `sm:w-auto`(원래 코드)는 데스크톱에서 의도한 만큼
                // 커지지 않는다: svg가 `w-full`(퍼센티지)만 갖고 명시 width/height 속성이
                // 없어서, flex row에서 이 wrapper의 shrink-to-fit 계산이 svg의 UA 기본
                // intrinsic 크기(300×150 CSS px, 퍼센티지는 intrinsic 크기에 기여 못함)로
                // 수렴해버려 max-w-[320px]를 걸어도 실측 300px에서 멈췄다(실증:
                // getBoundingClientRect). `w-auto`+`max-w-*` 대신 명시적 `w-*`로 폭을
                // 고정해 이 순환 의존을 끊는다 — sm(640~1023, 태블릿) 340px, lg(1024+,
                // 진짜 데스크톱) 440px. PositionBuilding의 svg도 동일 브레이크포인트로
                // max-width를 맞춰야 한다(그렇지 않으면 svg 자체의 280px 캡이 병목이 된다).
                className="sm:w-[340px] sm:shrink-0 lg:w-[440px]"
            />
            <div className="sm:min-w-0 sm:flex-1">
                <PositionCard
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
