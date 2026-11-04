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
    /**
     * 분석 전체의 추세 배지에 켠다 — "현재 추세 강세"처럼 시점을 붙인다. 이 값은 분석 시점까지의
     * 흐름을 설명할 뿐 앞으로의 방향 예측이 아니다(2026-11 백테스트: 직전 10거래일 방향과 89%
     * 일치, 이후 10거래일 방향과는 50%). 배지만 두면 전망으로 읽힌다. 패턴·전략·신호 배지는
     * 그 항목의 방향이라 붙이지 않는다.
     */
    asCurrentTrend?: boolean;
}

export function TrendBadge({ trend, asCurrentTrend = false }: TrendBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    const tPanel = useTranslations('widgets.analysis.AnalysisPanel');
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
            {asCurrentTrend
                ? tPanel('currentTrend', { v0: display.label })
                : display.label}
        </span>
    );
}
