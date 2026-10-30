/**
 * View-model builder for the open-interest chart: scales, emphasis set,
 * guide-line indices and x-axis label indices, derived from the per-strike
 * OI aggregate. Pure — the component only renders the result.
 */
import type { StrikeOpenInterest } from '@y0ngha/siglens-core';
import { findNearestStrikeIndex } from '@/entities/options-chain/lib/findNearestStrike';
import { MAX_X_AXIS_LABELS } from './strikeChartLayout';
import { pickLabelIndices } from './pickLabelIndices';

// 모든 strike의 OI가 0일 때 globalMax가 0이 되어 barPixelHeight에서
// 0으로 나누는 경로를 막기 위한 하한값.
const MIN_OI_SCALE_FLOOR = 1;

// 가장 OI가 두꺼운 상위 N개 strike만 강조해 시각적으로 두드러지게 한다.
const TOP_OI_STRIKE_COUNT = 3;

/** Everything `OpenInterestChart` needs to draw, computed once per input change. */
export interface OpenInterestChartModel {
    /** Per-strike OI rows, ascending by strike. */
    rows: ReadonlyArray<StrikeOpenInterest>;
    /** Strikes with the largest combined OI — drawn at full opacity. */
    topOiStrikes: ReadonlySet<number>;
    /** Largest single-side OI (floored at 1) used as the y-scale. */
    globalMax: number;
    /** Index of the strike nearest Max Pain, or -1 when there is no Max Pain. */
    maxPainIdx: number;
    /** Index of the strike nearest the spot price. */
    currentPriceIdx: number;
    /** Row indices whose strike label is drawn on the x-axis. */
    labelIndices: ReadonlySet<number>;
}

const totalOpenInterest = (row: StrikeOpenInterest): number =>
    row.callOpenInterest + row.putOpenInterest;

const hasNoOpenInterest = (row: StrikeOpenInterest): boolean =>
    row.callOpenInterest === 0 && row.putOpenInterest === 0;

/**
 * Build the OI chart model, or `null` when there is nothing to draw (no
 * strikes, or every strike has zero OI — the off-hours stale-quote
 * signature). Pass `maxPain: null` to omit the Max Pain guide.
 */
export function buildOpenInterestChartModel(
    oiByStrike: ReadonlyArray<StrikeOpenInterest>,
    maxPain: number | null,
    underlyingPrice: number
): OpenInterestChartModel | null {
    // `every` is also true for an empty aggregate.
    if (oiByStrike.every(hasNoOpenInterest)) return null;

    const topOiStrikes = new Set(
        oiByStrike
            .toSorted((a, b) => totalOpenInterest(b) - totalOpenInterest(a))
            .slice(0, TOP_OI_STRIKE_COUNT)
            .map(row => row.strike)
    );

    // Single reduce: spreading a long chain into Math.max risks the engine's
    // argument-length cap.
    const globalMax = oiByStrike.reduce(
        (max, row) => Math.max(max, row.callOpenInterest, row.putOpenInterest),
        MIN_OI_SCALE_FLOOR
    );

    const strikes = oiByStrike.map(row => row.strike);
    const maxPainIdx =
        maxPain === null ? -1 : findNearestStrikeIndex(strikes, maxPain);
    const currentPriceIdx = findNearestStrikeIndex(strikes, underlyingPrice);

    return {
        rows: oiByStrike,
        topOiStrikes,
        globalMax,
        maxPainIdx,
        currentPriceIdx,
        labelIndices: pickLabelIndices(
            oiByStrike.length,
            [maxPainIdx, currentPriceIdx],
            MAX_X_AXIS_LABELS
        ),
    };
}
