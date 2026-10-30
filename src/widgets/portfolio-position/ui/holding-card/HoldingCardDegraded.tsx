'use client';

/**
 * 보유 카드를 그릴 수 없을 때의 대체 본문 — 이유 한 줄과, 평단이 유효하면 그 평단.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { formatAmount } from '../../utils/buildingPriceFormat';
import { CARD_BODY_MIN_H } from './cardLayout';

interface HoldingCardDegradedProps {
    readonly symbol: string;
    /** 유효한 평단일 때만 — 잘못된 평단(NaN·0)은 보여 줄 값이 없다. */
    readonly avg: number | null;
    readonly message: string;
}

/** 카드 한 장만 대체한다 — 그리드 전체는 그대로다. */
export function HoldingCardDegraded({
    symbol,
    avg,
    message,
}: HoldingCardDegradedProps) {
    const t = useTranslations('widgets.portfolio-position');
    return (
        <div
            data-testid="holding-card-degraded"
            className={cn(
                CARD_BODY_MIN_H,
                'border-secondary-700 flex w-full max-w-[200px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-3 text-center'
            )}
        >
            <span className="text-xs text-secondary-400">{message}</span>
            {avg !== null && (
                <span className="text-xs text-secondary-400 tabular-nums">
                    {t('PositionHoldingCard.0ac914', {
                        v0: formatAmount(avg, symbol),
                    })}
                </span>
            )}
        </div>
    );
}
