'use client';

/**
 * 보유 카드 본문 — 평단 확인 안내, 로딩 자리, 받기 실패 안내, 결과(빌딩 + 숫자 표) 중 하나.
 */
import { useTranslations } from 'next-intl';
import type { HoldingRangeFacts } from '../../hooks/useHoldingRangeFacts';
import type { PositionModel } from '../../utils/positionGeometry';
import { PositionBuilding } from '../PositionBuilding';
import { HoldingCardDegraded } from './HoldingCardDegraded';
import { HoldingCardFigures } from './HoldingCardFigures';
import { HoldingCardSkeleton } from './HoldingCardSkeleton';

interface HoldingCardBodyProps {
    symbol: string;
    /** 유효한 평단. `null`이면 봉을 받지 않고 평단 확인 안내만 보인다. */
    avg: number | null;
    /** 카드가 아직 화면 밖이거나 봉을 받는 중. */
    isPending: boolean;
    isError: boolean;
    facts: HoldingRangeFacts | null;
    model: PositionModel | null;
}

/**
 * 우선순위: 평단 무효 → 대기 → 실패·범위 계산 불가 → 결과. `model`이 있으면 `facts`도 있지만,
 * 결과가 `facts`를 쓰므로 TS가 좁히도록 같이 본다.
 */
export function HoldingCardBody({
    symbol,
    avg,
    isPending,
    isError,
    facts,
    model,
}: HoldingCardBodyProps) {
    const t = useTranslations('widgets.portfolio-position');
    if (avg === null)
        return (
            <HoldingCardDegraded
                symbol={symbol}
                avg={null}
                message={t('PositionHoldingCard.avgInvalid')}
            />
        );
    if (isPending) return <HoldingCardSkeleton symbol={symbol} />;
    if (isError || facts === null || model === null)
        return (
            <HoldingCardDegraded
                symbol={symbol}
                avg={avg}
                message={t('PositionHoldingCard.fa94cf')}
            />
        );
    return (
        <>
            <PositionBuilding
                symbol={symbol}
                model={model}
                low52w={facts.low52w}
                high52w={facts.high52w}
                current={facts.lastClose}
                avg={avg}
                className="max-w-[200px]"
            />
            <HoldingCardFigures
                symbol={symbol}
                avg={avg}
                current={facts.lastClose}
                returnPct={model.returnPct}
            />
        </>
    );
}
