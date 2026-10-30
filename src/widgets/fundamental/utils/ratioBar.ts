/**
 * 수익성 비율 막대의 표기와 채움 폭 계산.
 */
import {
    BAR_FILL_MAX_PERCENT,
    MISSING_VALUE,
    PERCENT_SCALE,
} from './displayConstants';

/** 퍼센트 표기의 소수 자릿수. */
const PERCENT_FRACTION_DIGITS = 1;

/** 비율(0~1)을 `12.3%`로 표기한다. 값이 없으면 `-`. */
export function formatRatioPercent(value: number | null): string {
    if (value === null) return MISSING_VALUE;
    return `${(value * PERCENT_SCALE).toFixed(PERCENT_FRACTION_DIGITS)}%`;
}

/** 막대 채움 폭(%)을 0~100으로 제한한다. 값이 없으면 0. */
export function ratioFillPercent(value: number | null): number {
    if (value === null) return 0;
    return Math.min(BAR_FILL_MAX_PERCENT, Math.max(0, value * PERCENT_SCALE));
}
