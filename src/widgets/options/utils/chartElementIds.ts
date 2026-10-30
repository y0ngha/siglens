/**
 * 두 strike 차트의 DOM id — 같은 페이지에 두 차트가 함께 그려지므로 차트마다 따로 둔다.
 * `tooltip`은 `role="tooltip"` 요소와 hit-rect의 `aria-describedby`가, `desc`는 svg의
 * `aria-describedby`와 `<desc>`가 함께 가리키는 anchor다.
 */

/** 차트 하나가 쓰는 id 묶음. */
export interface StrikeChartElementIds {
    readonly tooltip: string;
    readonly desc: string;
}

/** 차트별 id — 같은 id를 두 차트가 나눠 쓰면 `aria-describedby`가 어느 요소를 가리키는지 모호해진다. */
export const STRIKE_CHART_ELEMENT_IDS = {
    openInterest: { tooltip: 'oi-chart-tooltip', desc: 'oi-chart-desc' },
    volume: { tooltip: 'volume-chart-tooltip', desc: 'volume-chart-desc' },
} as const satisfies Record<string, StrikeChartElementIds>;
