import type { IChartApi } from 'lightweight-charts';

/**
 * 시간축 오른쪽 여백(px)을 적용한다 — 레벨선 제목이 마지막 캔들을 덮지 않게 비우는 폭(`useRightGutter`).
 * 종목 페이지(`useChartSync`)와 답변 안 차트(`useChartRightOffset`)가 같은 방식으로 적용한다.
 */
export function applyRightOffsetPixels(chart: IChartApi, pixels: number): void {
    chart.applyOptions({ timeScale: { rightOffsetPixels: pixels } });
}
