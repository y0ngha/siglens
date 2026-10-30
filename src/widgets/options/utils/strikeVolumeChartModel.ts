/**
 * View-model builder for the per-strike volume chart: scale, current-price
 * index and x-axis label indices. Pure — the component only renders it.
 */
import type { ClientOptionsChain } from '@/entities/options-chain/lib/clientOptionsSnapshot';
import { findNearestStrikeIndex } from '@/entities/options-chain/lib/findNearestStrike';
import {
    aggregateStrikeVolume,
    type StrikeVolume,
} from './aggregateStrikeVolume';
import { pickLabelIndices } from './pickLabelIndices';
import { MAX_X_AXIS_LABELS } from './strikeChartLayout';

// globalMax가 0이 되어 barPixelHeight에서 0으로 나누는 경로를 막는 하한값.
// OI 차트와 같은 패턴.
const MIN_VOLUME_SCALE_FLOOR = 1;

/** Everything `StrikeVolumeChart` needs to draw, computed once per input change. */
export interface StrikeVolumeChartModel {
    /** Per-strike volume rows, ascending by strike. */
    rows: ReadonlyArray<StrikeVolume>;
    /** Largest single-side volume (floored at 1) used as the y-scale. */
    globalMax: number;
    /** Index of the strike nearest the spot price. */
    currentPriceIdx: number;
    /** Row indices whose strike label is drawn on the x-axis. */
    labelIndices: ReadonlySet<number>;
}

/**
 * Build the volume chart model, or `null` when there is nothing to draw (no
 * chain, no strikes, or zero volume everywhere — weekends, holidays, right
 * after an expiry roll). Max Pain is an OI concept, so only the current
 * price anchors the x-axis labels.
 */
export function buildStrikeVolumeChartModel(
    chain: ClientOptionsChain | null,
    underlyingPrice: number
): StrikeVolumeChartModel | null {
    if (!chain) return null;
    const rows = aggregateStrikeVolume(chain);
    if (rows.length === 0) return null;

    const rawMax = rows.reduce(
        (max, row) => Math.max(max, row.callVolume, row.putVolume),
        0
    );
    if (rawMax === 0) return null;

    const currentPriceIdx = findNearestStrikeIndex(
        rows.map(row => row.strike),
        underlyingPrice
    );

    return {
        rows,
        globalMax: Math.max(rawMax, MIN_VOLUME_SCALE_FLOOR),
        currentPriceIdx,
        labelIndices: pickLabelIndices(
            rows.length,
            [currentPriceIdx],
            MAX_X_AXIS_LABELS
        ),
    };
}
