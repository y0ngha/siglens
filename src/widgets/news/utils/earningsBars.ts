/**
 * 실적 비교 막대의 기하 계산 — 폭(%)과 위치 스타일을 값에서 순수하게 구한다.
 */
import type React from 'react';

/** 0이 아닌 값이 눈에 띄도록 보장하는 최소 막대 폭(%). */
const MIN_BAR_WIDTH_PERCENT = 6;

/** 값들의 절댓값 최댓값 — 막대 폭의 기준. `null`은 건너뛴다. */
export function getMaxAbs(values: readonly (number | null)[]): number {
    return Math.max(
        0,
        ...values.flatMap(value => (value !== null ? [Math.abs(value)] : []))
    );
}

/**
 * 막대 폭(%). 부호 있는 지표는 중앙선 기준 한쪽이라 최대 50%다. 정확히 0은 막대를 그리지 않는다 —
 * 최소 폭을 0에도 적용하면 "0 실적"이 눈에 띄는 양의 막대로 보인다.
 */
export function getBarWidth(
    value: number | null,
    maxValue: number,
    signed: boolean
): number {
    if (value === null || value === 0 || maxValue === 0) return 0;
    const maxWidth = signed ? 50 : 100;
    return Math.max(
        MIN_BAR_WIDTH_PERCENT,
        Math.min(maxWidth, (Math.abs(value) / maxValue) * maxWidth)
    );
}

/** 막대 위치 스타일 — 부호 있는 지표는 음수가 중앙선 왼쪽, 양수가 오른쪽으로 뻗는다. */
export function getBarStyle(
    value: number,
    width: number,
    signed: boolean
): React.CSSProperties {
    if (!signed) return { left: 0, width: `${width}%` };
    if (value < 0) return { right: '50%', width: `${width}%` };
    return { left: '50%', width: `${width}%` };
}
