import type { Trend } from '@y0ngha/siglens-core';

export interface TrendDisplay {
    label: string;
    color: string;
    bgColor: string;
}

const TREND_DISPLAY_MAP: Record<Trend, TrendDisplay> = {
    bullish: {
        label: '강세',
        color: 'text-chart-bullish',
        bgColor: 'bg-chart-bullish/10 border-chart-bullish/30',
    },
    bearish: {
        label: '약세',
        color: 'text-chart-bearish',
        bgColor: 'bg-chart-bearish/10 border-chart-bearish/30',
    },
    neutral: {
        label: '보합',
        color: 'text-secondary-400',
        bgColor: 'bg-secondary-700/30 border-secondary-600/30',
    },
};

/**
 * trend 값이 유효한 Trend 리터럴이면 표시 정보를 반환한다.
 * null · undefined · 알 수 없는 값이 들어오면 null을 반환해 렌더링을 건너뛴다.
 * AI 응답에서 trend 필드가 누락되거나 예상치 못한 값이 오는 경우를 방어한다.
 */
export function resolveTrendDisplay(
    trend: Trend | null | undefined
): TrendDisplay | null {
    if (trend == null || !(trend in TREND_DISPLAY_MAP)) return null;
    return TREND_DISPLAY_MAP[trend];
}
