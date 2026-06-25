/**
 * Strike 바 차트용 순수 기하학 헬퍼.
 *
 * OpenInterestChart·StrikeVolumeChart 양쪽에서 완전히 동일한 수식을 사용하므로
 * 여기로 추출한다. 레이아웃 상수(PAD_LEFT, CHART_WIDTH, HALF_HEIGHT)는 각
 * 차트가 독립적으로 튜닝할 수 있도록 인수로 주입받는다 — 상수 자체를 공유하면
 * 한 차트 패딩 변경이 다른 차트에 의도치 않게 영향을 미친다.
 */

/**
 * 슬라이드 하나의 픽셀 너비.
 *
 * @param count      - strike 총 개수
 * @param chartWidth - 차트 영역 전체 너비 (px)
 */
export function slotWidth(count: number, chartWidth: number): number {
    return chartWidth / count;
}

/**
 * 슬롯 중앙 x 좌표.
 *
 * @param index      - 0-based strike 인덱스
 * @param count      - strike 총 개수
 * @param padLeft    - SVG 좌측 패딩 (px)
 * @param chartWidth - 차트 영역 전체 너비 (px)
 */
export function barCenterX(
    index: number,
    count: number,
    padLeft: number,
    chartWidth: number
): number {
    const sw = slotWidth(count, chartWidth);
    return padLeft + sw * index + sw / 2;
}

/**
 * 값을 차트 절반 높이 기준으로 픽셀 높이로 변환한다.
 * maxValue가 0이면 0을 반환해 0-division 경로를 차단한다.
 *
 * @param value      - 렌더할 값 (OI 또는 volume)
 * @param maxValue   - 같은 차트 전체의 최대값
 * @param halfHeight - 차트 절반 높이 (px)
 */
export function barPixelHeight(
    value: number,
    maxValue: number,
    halfHeight: number
): number {
    if (maxValue === 0) return 0;
    return Math.min((value / maxValue) * halfHeight, halfHeight);
}
