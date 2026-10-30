'use client';

/**
 * 가격 영향도 배지 — 색·라벨 키·가드는 시장 뉴스 카드와 같은 공유 테이블을 쓴다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import {
    IMPACT_CLASS,
    IMPACT_LABEL_KEY,
    isNewsImpact,
} from '@/shared/lib/news/impactDisplay';

interface ImpactBadgeProps {
    value: string;
}

/** 알 수 없는 값이면 아무것도 그리지 않는다. */
export function ImpactBadge({ value }: ImpactBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    // `SentimentBadge`와 같은 이유로 키를 그대로 `tLabel`에 넣는다.
    if (!isNewsImpact(value)) return null;
    return (
        <span
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                IMPACT_CLASS[value]
            )}
        >
            {tLabel(IMPACT_LABEL_KEY[value])}
        </span>
    );
}
