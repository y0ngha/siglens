import { SHAREABLE_KIND_VALUES, USER_TIER_VALUES } from '@/shared/db/constants';
import type { CreateShareInput } from '../types';

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.length > 0;
}

/**
 * Maximum UTF-8 byte length allowed for the `result` field in a share snapshot.
 * 64 KB is comfortably above the largest legitimate analysis response while
 * blocking pathological payloads that would bloat the shared_analyses jsonb column.
 *
 * Measured with `Buffer.byteLength(..., 'utf8')` rather than
 * `JSON.stringify(...).length` to correctly account for multibyte characters
 * (e.g. Korean text) that occupy 3 bytes each in UTF-8 but only 1 UTF-16 code
 * unit — which the `.length` property returns.
 */
export const MAX_RESULT_BYTES = 65_536;

/**
 * Maximum number of candlestick bars stored in a chart share snapshot.
 *
 * Size reasoning (worst case):
 *   - Largest legitimate AnalysisResponse (Korean text, 50 signals, 40 key levels): ~20 KB
 *   - 400 bars × ~101 bytes/bar (JSON): ~40 KB
 *   - Combined: ~60 KB — well within the 64 KB jsonb column limit.
 *
 * Core's TIMEFRAME_BARS_LIMIT for 1Day is 500; we cap at 400 to leave a
 * comfortable safety margin. ChartContent slices to the last MAX_CHART_BARS
 * before sending (most recent candles are most relevant for the analysis).
 */
export const MAX_CHART_BARS = 400;

/** 클라가 전달한 공유 입력의 형태를 검증한다(내용 신뢰 X, 형태만). */
export function isValidShareInput(raw: unknown): raw is CreateShareInput {
    if (typeof raw !== 'object' || raw === null) return false;
    const o = raw as Record<string, unknown>;
    if (
        !(SHAREABLE_KIND_VALUES as readonly string[]).includes(o.kind as string)
    )
        return false;
    if (!isNonEmptyString(o.symbol) || (o.symbol as string).length > 32)
        return false;
    if (typeof o.context !== 'object' || o.context === null) return false;
    const ctx = o.context as Record<string, unknown>;
    if (!isNonEmptyString(ctx.displayName)) return false;
    // assetClass is optional; when present it must be a string
    if (ctx.assetClass !== undefined && typeof ctx.assetClass !== 'string')
        return false;
    if (typeof o.result !== 'object' || o.result === null) return false;
    if (Buffer.byteLength(JSON.stringify(o.result), 'utf8') > MAX_RESULT_BYTES)
        return false;
    if (
        !(USER_TIER_VALUES as readonly string[]).includes(
            o.sharerTier as string
        )
    )
        return false;
    // chartBars is optional; when present (chart kind), it must be a non-empty
    // array within the count cap. Non-chart kinds must not include chartBars.
    if (o.chartBars !== undefined) {
        if (o.kind !== 'chart') return false;
        if (!Array.isArray(o.chartBars)) return false;
        if (o.chartBars.length === 0 || o.chartBars.length > MAX_CHART_BARS)
            return false;
    }
    return true;
}
