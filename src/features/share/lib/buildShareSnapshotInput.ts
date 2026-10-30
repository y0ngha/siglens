import type { Tier } from '@y0ngha/siglens-core';
import {
    MAX_CHART_BARS,
    type CreateShareInput,
} from '@/entities/shared-analysis/types';
import type { ShareableRegistration } from '../model/ShareableAnalysisContext';

/**
 * Builds the `createShareSnapshotAction` payload from the active registration,
 * or `null` when there is no finished result to share yet.
 *
 * Optional fields are dropped instead of sent empty: the server rejects the
 * whole share as `invalid_input` for a whitespace-only `plain`
 * (`isNonEmptyString`) or a bar list over `MAX_CHART_BARS`. Bars are trimmed
 * to the most recent `MAX_CHART_BARS`, the part the analysis reads; the server
 * still re-validates the count.
 */
export function buildShareSnapshotInput(
    reg: ShareableRegistration | null,
    sharerTier: Tier
): CreateShareInput | null {
    if (reg === null || reg.status !== 'success' || !reg.result) return null;
    const chartBars =
        reg.kind === 'chart' && reg.chartBars !== undefined
            ? reg.chartBars.slice(-MAX_CHART_BARS)
            : [];
    const plain = typeof reg.plain === 'string' ? reg.plain : '';
    return {
        kind: reg.kind,
        symbol: reg.context.symbol,
        context: reg.context,
        result: reg.result,
        sharerTier,
        ...(chartBars.length > 0 && { chartBars }),
        ...(plain.trim().length > 0 && { plain }),
    };
}
