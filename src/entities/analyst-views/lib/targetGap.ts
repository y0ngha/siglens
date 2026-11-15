import { TARGET_DISAGREE_THRESHOLD_PCT } from '../model';

/**
 * FMP 컨센서스가 Yahoo 평균보다 몇 % 높은가(`(fmp - yahoo) / yahoo * 100`). 한쪽이 없거나 Yahoo 평균이
 * 0 이하면 `null`.
 */
export function targetGapPct(
    fmpConsensus: number | null | undefined,
    yahooMean: number | null | undefined
): number | null {
    if (fmpConsensus == null || yahooMean == null || yahooMean <= 0)
        return null;
    return ((fmpConsensus - yahooMean) / yahooMean) * 100;
}

/** 격차가 임계값(`TARGET_DISAGREE_THRESHOLD_PCT`)보다 크면 `true`. 정확히 임계값이면 불일치가 아니다. */
export function targetsDisagree(gapPct: number | null): boolean {
    return gapPct !== null && Math.abs(gapPct) > TARGET_DISAGREE_THRESHOLD_PCT;
}
