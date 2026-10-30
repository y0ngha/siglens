/**
 * 분기별 순매수·순매도 막대의 크기 계산(순수).
 */
import type { FlowDirection, QuarterBar } from './institutional';

/** 막대 영역 높이(px). 위·아래(IN·OUT) 각각 이 값의 절반을 최대로 쓴다. */
export const CHART_HEIGHT = 112;
/** 기준선(0)의 y — 위쪽 IN 영역과 아래쪽 OUT 영역의 경계. */
export const BASELINE_Y = CHART_HEIGHT / 2;
/** 막대가 너무 얇아져 사라지지 않게 하는 최소 높이(px). 0이 아닌 값에만 적용된다. */
const MIN_BAR = 3;
/** 가장 긴 막대가 영역 가장자리에 붙지 않게 남기는 여백(px). */
const EDGE_MARGIN = 4;

/** 가장 큰 순변화의 절댓값. 막대 길이의 기준이며 0으로 나누지 않도록 최소 1이다. */
export function maxAbsNetChange(bars: readonly QuarterBar[]): number {
    return Math.max(...bars.map(bar => Math.abs(bar.netShareChange)), 1);
}

/** 막대의 높이와 윗변 y. */
export interface BarRect {
    height: number;
    /** 막대 윗변의 y — IN은 기준선 위로, OUT은 기준선 아래로 뻗는다. */
    y: number;
}

/** 순변화 `netShareChange`의 막대 크기와 위치. 변화가 0이면 높이 0이라 그리지 않는다. */
export function barRect(
    netShareChange: number,
    direction: FlowDirection,
    maxAbs: number
): BarRect {
    const height =
        netShareChange === 0
            ? 0
            : Math.max(
                  MIN_BAR,
                  (Math.abs(netShareChange) / maxAbs) *
                      (BASELINE_Y - EDGE_MARGIN)
              );
    return {
        height,
        y: direction === 'out' ? BASELINE_Y : BASELINE_Y - height,
    };
}
