/**
 * 막대 그래프의 막대 높이 계산.
 */
import { PERCENT_SCALE } from './percentScale';

/** 막대가 너무 얇아져 사라지지 않게 하는 최소 높이(%). 0이 아닌 값에만 적용된다. */
const MIN_BAR_PCT = 3;

/** 가장 큰 값(`max`) 대비 막대 높이(%, 정수). 0 이하의 값은 0이고, 그 밖에는 최소 높이를 보장한다. */
export function barHeightPercent(value: number, max: number): number {
    if (value <= 0) return 0;
    return Math.max(MIN_BAR_PCT, Math.round((value / max) * PERCENT_SCALE));
}
