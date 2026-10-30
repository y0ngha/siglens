'use client';

/**
 * 추세(강세/약세/보합) 배지. 알 수 없는 값이면 아무것도 그리지 않는다.
 */
import { useTranslations } from 'next-intl';
import type { Trend } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { resolveTrendDisplay } from '../utils/trendUtils';

interface TrendBadgeProps {
    trend: Trend | null | undefined;
}

export function TrendBadge({ trend }: TrendBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    const display = resolveTrendDisplay(trend, tLabel);
    if (display === null) return null;

    return (
        <span
            className={cn(
                'rounded border px-2 py-0.5 text-xs font-bold whitespace-nowrap',
                display.color,
                display.bgColor
            )}
        >
            {display.label}
        </span>
    );
}
