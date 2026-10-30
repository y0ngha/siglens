'use client';

/**
 * 보유 카드 로딩 자리 — 봉을 받는 동안 결과 카드와 같은 높이를 잡아 둔다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { CARD_BODY_MIN_H } from './cardLayout';

/** 스크린 리더에는 어느 종목을 불러오는지 알린다. */
export function HoldingCardSkeleton({ symbol }: { readonly symbol: string }) {
    const t = useTranslations('widgets.portfolio-position');
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="holding-card-loading"
            className={cn(
                CARD_BODY_MIN_H,
                'flex w-full max-w-[200px] flex-col items-center justify-center gap-2'
            )}
        >
            <span className="sr-only">
                {t('PositionHoldingCard.ba09a5', { v0: symbol })}
            </span>
            <div
                aria-hidden="true"
                className="h-32 w-32 animate-pulse rounded bg-secondary-700"
            />
        </div>
    );
}
