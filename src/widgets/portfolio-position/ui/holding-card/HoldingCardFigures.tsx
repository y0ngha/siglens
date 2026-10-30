'use client';

/**
 * 보유 카드 아래 숫자 표 — 평단, 현재가, 수익률.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import { formatAmount } from '../../utils/buildingPriceFormat';
import { returnTextClass } from '../../utils/returnTone';

interface HoldingCardFiguresProps {
    readonly symbol: string;
    readonly avg: number;
    readonly current: number;
    readonly returnPct: number;
}

/** 수익률 색은 위 빌딩 리드아웃과 같은 규칙이다 — 정확히 0%는 중립색. */
export function HoldingCardFigures({
    symbol,
    avg,
    current,
    returnPct,
}: HoldingCardFiguresProps) {
    const t = useTranslations('widgets.portfolio-position');
    return (
        <dl className="grid w-full grid-cols-2 gap-x-2 gap-y-1 text-xs text-secondary-300">
            <dt className="text-secondary-400">
                {t('PositionHoldingCard.900beb')}
            </dt>
            <dd className="text-right tabular-nums">
                {formatAmount(avg, symbol)}
            </dd>
            <dt className="text-secondary-400">
                {t('PositionHoldingCard.497d1e')}
            </dt>
            <dd className="text-right tabular-nums">
                {formatAmount(current, symbol)}
            </dd>
            <dt className="text-secondary-400">
                {t('PositionHoldingCard.fb64df')}
            </dt>
            <dd
                className={cn(
                    'text-right tabular-nums',
                    returnTextClass(returnPct)
                )}
            >
                {formatSignedPercent(returnPct)}
            </dd>
        </dl>
    );
}
