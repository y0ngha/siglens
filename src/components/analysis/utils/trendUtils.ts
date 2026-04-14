import type { Trend } from '@/domain/types';

const TREND_COLOR: Record<Trend, string> = {
    bullish: 'text-chart-bullish',
    bearish: 'text-chart-bearish',
    neutral: 'text-secondary-400',
};

const TREND_BG_COLOR: Record<Trend, string> = {
    bullish: 'bg-chart-bullish/10 border-chart-bullish/30',
    bearish: 'bg-chart-bearish/10 border-chart-bearish/30',
    neutral: 'bg-secondary-700/30 border-secondary-600/30',
};

export const TREND_LABEL: Record<Trend, string> = {
    bullish: '강세',
    bearish: '약세',
    neutral: '보합',
};

const VALID_TRENDS = new Set<string>(['bullish', 'bearish', 'neutral']);

export interface TrendDisplay {
    label: string;
    color: string;
    bgColor: string;
}

/**
 * trend 값이 유효한 Trend 리터럴이면 표시 정보를 반환한다.
 * null · undefined · 알 수 없는 값이 들어오면 null을 반환해 렌더링을 건너뛴다.
 * AI 응답에서 trend 필드가 누락되거나 예상치 못한 값이 오는 경우를 방어한다.
 */
export function resolveTrendDisplay(
    trend: Trend | null | undefined
): TrendDisplay | null {
    if (trend == null || !VALID_TRENDS.has(trend)) return null;
    return {
        label: TREND_LABEL[trend],
        color: TREND_COLOR[trend],
        bgColor: TREND_BG_COLOR[trend],
    };
}
