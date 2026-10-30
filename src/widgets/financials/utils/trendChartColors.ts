/**
 * 추세 차트 시리즈 색 → Tailwind 클래스 조회.
 */
import type { SeriesColor } from './trendChartTypes';

/** 시리즈 색 하나가 막대·범례·툴팁 점에 쓰는 클래스 묶음. */
export interface SeriesColorClasses {
    fill: string;
    legend: string;
    dot: string;
}

/** `color`를 생략한 시리즈의 색. */
const DEFAULT_SERIES_COLOR: SeriesColor = 'neutral';

/**
 * 막대 채움이 `/85`인 이유: `/70`은 라이트 카드(흰색) 위에서 2.64:1로 그래픽 기준(3:1)을
 * 밑돈다 — 다크는 통과라 다크만 보면 안 보인다. `/85`는 램프 세 표면 × 양 테마 전부에서 3.34
 * 이상이고, 옵션 차트의 막대·`FearGreedGroupBar`의 GREED 밴드와 같은 값이다. 알파를 아예 빼면
 * 막대가 선(stroke)과 붙어 보인다.
 *
 * **리터럴로 적는다.** 알파를 상수로 빼서 템플릿으로 조립하면 Tailwind의 정적 추출이 그
 * 클래스를 못 보고 규칙이 통째로 안 구워진다 — 타입도 빌드도 통과하는데 화면에서만 색이
 * 사라진다.
 */
const COLOR_CLASSES: Record<SeriesColor, SeriesColorClasses> = {
    bullish: {
        fill: 'fill-chart-bullish/85',
        legend: 'bg-chart-bullish',
        dot: 'bg-chart-bullish',
    },
    bearish: {
        fill: 'fill-chart-bearish/85',
        legend: 'bg-chart-bearish',
        dot: 'bg-chart-bearish',
    },
    neutral: {
        fill: 'fill-primary-500/85',
        legend: 'bg-primary-500',
        dot: 'bg-primary-500',
    },
};

/**
 * 시리즈가 **선언한 색**의 클래스를 돌려준다.
 *
 * 값의 부호로 색을 덮지 않는다. 범례와 툴팁 점은 선언한 색을 보여 주므로, 막대만 음수에서
 * 다른 색이 되면 같은 시리즈가 화면 안에서 두 가지 색이 된다(현금흐름표의 FCF가 음수 기간에
 * CapEx와 같은 빨강이 되는 식). 부호는 색이 아니라 baseline 아래로 그려지는 **방향**이 나른다.
 */
export function seriesColorClasses(
    color: SeriesColor | undefined
): SeriesColorClasses {
    return COLOR_CLASSES[color ?? DEFAULT_SERIES_COLOR];
}
