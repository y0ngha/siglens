'use client';

/**
 * "내 위치" 탭의 회원 본문 — 이 종목 보유를 조회해 빌딩과 수치 카드를 그리고, 보유가 없거나 조회가
 * 실패하면 CTA로, 범위를 만들 수 없으면 데이터 부족 안내로 돌린다.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { useTranslations } from 'next-intl';
import { useSymbolHolding } from '@/features/portfolio-holding/hooks/useSymbolHolding';
import { computePosition } from '../utils/positionGeometry';
import { PositionBuilding } from './PositionBuilding';
import { PositionCard } from './PositionCard';
import { PositionCta } from './PositionCta';

interface PositionTabMemberContentProps {
    symbol: string;
    low52w: number | null;
    high52w: number | null;
    lastClose: number | null;
    /** 5개 가격대별 최근 거래량 비중(%) — optional. PositionBuilding으로 그대로 전달만 한다. */
    volumeByBand?: readonly number[] | null;
}

/** 보유 조회 중 자리 — 결과와 같은 최소 높이를 잡는다. */
function PositionSkeleton() {
    const t = useTranslations('widgets.portfolio-position');
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="position-loading"
            className={cn(
                SURFACE_CARD,
                'flex min-h-[280px] flex-col items-center justify-center gap-2 p-6'
            )}
        >
            <span className="sr-only">
                {t('PositionTabMemberContent.0b16bc')}
            </span>
            <div
                aria-hidden="true"
                className="h-40 w-40 animate-pulse rounded bg-secondary-700"
            />
        </div>
    );
}

/** 범위·평단으로 위치를 계산할 수 없을 때의 안내. */
function DataInsufficientNote() {
    const t = useTranslations('widgets.portfolio-position');
    return (
        <p
            data-testid="position-data-insufficient"
            className="rounded-lg border border-dashed border-secondary-700 p-4 text-sm text-secondary-400"
        >
            {t('PositionTabMemberContent.9990b5')}
        </p>
    );
}

/**
 * Lazy-loaded, member-only inner content for the `[symbol]/position` tab.
 * `PositionTabContent` gates mounting this component on a resolved, present
 * member — only that audience ever fires `useSymbolHolding` (the holdings
 * query) or downloads this chunk. Mirrors the deleted `PositionSection`'s
 * holding-presence gate, extended with a graceful `computePosition` null
 * fallback.
 */
export function PositionTabMemberContent({
    symbol,
    low52w,
    high52w,
    lastClose,
    volumeByBand,
}: PositionTabMemberContentProps) {
    const { holding, isLoading, isError } = useSymbolHolding(symbol);

    if (isLoading) return <PositionSkeleton />;

    // 보유 없음(정상) + 조회 실패(degrade) 모두 CTA로 수렴 — 어느 쪽도 렌더를 깨지 않는다.
    if (isError || holding === null) {
        return (
            <PositionCta
                symbol={symbol}
                low52w={low52w}
                high52w={high52w}
                lastClose={lastClose}
                volumeByBand={volumeByBand}
            />
        );
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
                volumeByBand={volumeByBand}
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
