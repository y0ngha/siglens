import type { Trend } from '@y0ngha/siglens-core';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

export interface TrendDisplay {
    label: string;
    color: string;
    bgColor: string;
}

/**
 * Trend → `shared.enumLabel.trend` 카탈로그 키. 값 자체는 더 이상 한글이 아니다 —
 * `resolveTrendDisplay`가 번역자로 조회한다.
 *
 * 예전에는 라벨이 `강세`/`약세`/`보합` 리터럴이었다 — `/en/AAPL`의 AI Analysis
 * 패널 헤드라인이 스냅샷 프로즈("AAPL Technical Direction: Flat") 바로 옆에서
 * `보합`을 찍었다(같은 값, 두 언어, 한 화면).
 */
const TREND_LABEL_KEY: Record<Trend, string> = {
    bullish: 'trend.bullish',
    bearish: 'trend.bearish',
    neutral: 'trend.neutral',
};

const TREND_STYLE: Record<Trend, { color: string; bgColor: string }> = {
    bullish: {
        // 채움과 같은 색 계열이지만 **텍스트는 `-text` 짝**을 쓴다. `chart-*`는
        // 그래픽용(3:1)으로 맞춘 토큰이라, 자기 /10 틴트 위 12px 굵은 글씨에서
        // 라이트 3.99:1로 본문 기준(4.5)을 밑돈다 — globals.css가 그 이유를
        // 적어두고 있고, 같은 위젯의 `ENTRY_RECOMMENDATION_COLOR`는 이미 준수한다.
        color: 'text-ui-success-text',
        bgColor: 'bg-chart-bullish/10 border-chart-bullish/30',
    },
    bearish: {
        color: 'text-ui-danger-text',
        bgColor: 'bg-chart-bearish/10 border-chart-bearish/30',
    },
    neutral: {
        color: 'text-secondary-400',
        bgColor: 'bg-secondary-700/30 border-secondary-600/30',
    },
};

/**
 * trend 값이 유효한 Trend 리터럴이면 표시 정보를 반환한다.
 * null · undefined · 알 수 없는 값이 들어오면 null을 반환해 렌더링을 건너뛴다.
 * AI 응답에서 trend 필드가 누락되거나 예상치 못한 값이 오는 경우를 방어한다.
 *
 * `t`는 필수 인자다 — 기본값을 두면 호출부가 조용히 `t`를 누락해도 컴파일이
 * 통과하고, 그 결과 라벨이 `trend.bullish` 같은 raw 카탈로그 키 문자열로
 * 렌더된다.
 */
export function resolveTrendDisplay(
    trend: Trend | null | undefined,
    t: EnumLabelTranslator
): TrendDisplay | null {
    if (trend == null || !(trend in TREND_STYLE)) return null;
    return { label: t(TREND_LABEL_KEY[trend]), ...TREND_STYLE[trend] };
}
