export type TimingVerdict = 'higher' | 'lower' | 'none';

/**
 * 거래당 차이의 95% 범위로 고정된 판정을 낸다. 사람이 고르지 않는다 — 범위가 0보다 위면
 * `higher`, 0보다 아래면 `lower`, 0을 지나거나 닿으면 `none`(뚜렷한 차이 없음)이다.
 */
export function timingVerdict(ci95: {
    readonly low: number;
    readonly high: number;
}): TimingVerdict {
    if (ci95.low > 0) return 'higher';
    if (ci95.high < 0) return 'lower';
    return 'none';
}
