import type { Trend } from '@y0ngha/siglens-core';

export interface TrendDisplay {
    label: string;
    color: string;
    bgColor: string;
}

const TREND_DISPLAY_MAP: Record<Trend, TrendDisplay> = {
    bullish: {
        label: '강세',
        // 채움과 같은 색 계열이지만 **텍스트는 `-text` 짝**을 쓴다. `chart-*`는
        // 그래픽용(3:1)으로 맞춘 토큰이라, 자기 /10 틴트 위 12px 굵은 글씨에서
        // 라이트 3.99:1로 본문 기준(4.5)을 밑돈다 — globals.css가 그 이유를
        // 적어두고 있고, 같은 위젯의 `ENTRY_RECOMMENDATION_COLOR`는 이미 준수한다.
        color: 'text-ui-success-text',
        bgColor: 'bg-chart-bullish/10 border-chart-bullish/30',
    },
    bearish: {
        label: '약세',
        color: 'text-ui-danger-text',
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
