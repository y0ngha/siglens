import { SHAREABLE_KIND_VALUES, USER_TIER_VALUES } from '@/shared/db/constants';
import type { CreateShareInput } from '../types';
import { MAX_CHART_BARS } from '../types';

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
 * Maximum byte length for `context.displayName` and `context.assetClass`.
 * Prevents bypassing the MAX_RESULT_BYTES guard by stuffing large payloads
 * into string context fields that are not covered by the `result` size check.
 */
export const MAX_DISPLAY_NAME_LENGTH = 128;

/**
 * Returns true when the value is a valid OHLCV Bar element.
 *
 * `time`, `open`, `high`, `low`, and `close` must all be finite numbers.
 * `volume` is optional in the Bar type (`vwap` is also optional and ignored
 * here), but when present it must also be a finite number.
 */
function isValidBar(v: unknown): boolean {
    if (typeof v !== 'object' || v === null) return false;
    // guarded by the typeof + null check just above; safe to index as a plain object map
    const b = v as Record<string, unknown>;
    const requiredNumeric: (keyof typeof b)[] = [
        'time',
        'open',
        'high',
        'low',
        'close',
    ];
    for (const key of requiredNumeric) {
        if (typeof b[key] !== 'number' || !Number.isFinite(b[key] as number))
            return false;
    }
    // volume is required in Bar but checking presence defensively.
    if (b.volume !== undefined) {
        if (
            typeof b.volume !== 'number' ||
            !Number.isFinite(b.volume as number)
        )
            return false;
    }
    return true;
}

/** 클라가 전달한 공유 입력의 형태를 검증한다(내용 신뢰 X, 형태만). */
export function isValidShareInput(raw: unknown): raw is CreateShareInput {
    if (typeof raw !== 'object' || raw === null) return false;
    // guarded by the typeof + null check just above; safe to index as a plain object map
    const o = raw as Record<string, unknown>;
    if (
        // const arrays widened to readonly string[] so .includes() accepts a plain string argument
        !(SHAREABLE_KIND_VALUES as readonly string[]).includes(o.kind as string)
    )
        return false;
    if (!isNonEmptyString(o.symbol) || (o.symbol as string).length > 32)
        return false;
    if (typeof o.context !== 'object' || o.context === null) return false;
    const ctx = o.context as Record<string, unknown>;
    if (!isNonEmptyString(ctx.displayName)) return false;
    if ((ctx.displayName as string).length > MAX_DISPLAY_NAME_LENGTH)
        return false;
    // assetClass is optional; when present it must be a string within the length cap.
    if (ctx.assetClass !== undefined) {
        if (typeof ctx.assetClass !== 'string') return false;
        if ((ctx.assetClass as string).length > MAX_DISPLAY_NAME_LENGTH)
            return false;
    }
    if (typeof o.result !== 'object' || o.result === null) return false;
    if (Buffer.byteLength(JSON.stringify(o.result), 'utf8') > MAX_RESULT_BYTES)
        return false;
    if (
        // const array widened to readonly string[] so .includes() accepts a plain string argument
        !(USER_TIER_VALUES as readonly string[]).includes(
            o.sharerTier as string
        )
    )
        return false;
    // chartBars is optional; when present (chart kind), it must be a non-empty
    // array within the count cap where every element has valid Bar shape.
    // Non-chart kinds must not include chartBars.
    if (o.chartBars !== undefined) {
        if (o.kind !== 'chart') return false;
        if (!Array.isArray(o.chartBars)) return false;
        if (o.chartBars.length === 0 || o.chartBars.length > MAX_CHART_BARS)
            return false;
        if (!o.chartBars.every(isValidBar)) return false;
    }
    return true;
}
