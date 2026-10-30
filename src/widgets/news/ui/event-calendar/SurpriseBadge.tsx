'use client';

/**
 * 실적 서프라이즈 배지 — 종류 라벨과 부호 퍼센트를 한 알약에 담는다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatSurprisePercent } from '../../utils/earningsFormat';
import {
    SURPRISE_BADGE_CLASS,
    type SurpriseBadgeData,
} from '../../utils/surpriseBadge';

interface SurpriseBadgeProps {
    badge: SurpriseBadgeData;
}

/** 서프라이즈/쇼크/부합 배지. */
export function SurpriseBadge({ badge }: SurpriseBadgeProps) {
    const tSurprise = useTranslations('widgets.news.surprise');
    const locale = useResolvedLocale();

    return (
        <span
            className={cn(
                'rounded-full border px-2 py-0.5 text-xs tabular-nums',
                SURPRISE_BADGE_CLASS[badge.kind]
            )}
        >
            {tSurprise(badge.kind)}{' '}
            {formatSurprisePercent(badge.percent, locale)}
        </span>
    );
}
