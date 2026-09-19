import 'server-only';
import { roundNumber } from '@/entities/bars/lib/roundIndicators';

/**
 * `(current - base) / base * 100`, rounded — the shared "distance/return as
 * a percent" computation every agent tool result needs (bars `derived`,
 * portfolio P/L%, fundamentals upside%, options distance%, ...).
 *
 * Follows the null rule (spec §0, `2026-09-18-precomputed-prompt-data.md`):
 * `null` unless both inputs are finite numbers AND `base > 0` — a zero or
 * negative base makes "% of base" meaningless, and a missing/`NaN` input is
 * unknown, never silently treated as 0.
 */
export function pctVs(
    current: number | null | undefined,
    base: number | null | undefined
): number | null {
    if (
        current === null ||
        current === undefined ||
        base === null ||
        base === undefined ||
        !Number.isFinite(current) ||
        !Number.isFinite(base) ||
        base <= 0
    )
        return null;
    return roundNumber(((current - base) / base) * 100);
}

/**
 * `a - b`, rounded — a percentage-POINT delta between two values that are
 * ALREADY percentages (margin change YoY, RSI vs previous, ...). Named
 * `...Pp` per spec §0, never `...Pct`, so it isn't misread as a ratio.
 *
 * Null rule: `null` unless both inputs are finite numbers. No base/sign
 * restriction — a `pp` delta is a plain subtraction, not "% of" anything.
 */
export function ppDelta(
    a: number | null | undefined,
    b: number | null | undefined
): number | null {
    if (
        a === null ||
        a === undefined ||
        b === null ||
        b === undefined ||
        !Number.isFinite(a) ||
        !Number.isFinite(b)
    )
        return null;
    return roundNumber(a - b);
}

/**
 * A finite, positive ratio `numerator / denominator * 100` — for fields that
 * are a ratio OF something (ATR% of price, spread% of mid), not a percent
 * DIFFERENCE from a base (`pctVs`). `null` unless both inputs are finite and
 * `denominator > 0`.
 */
export function ratioPct(
    numerator: number | null | undefined,
    denominator: number | null | undefined
): number | null {
    if (
        numerator === null ||
        numerator === undefined ||
        denominator === null ||
        denominator === undefined ||
        !Number.isFinite(numerator) ||
        !Number.isFinite(denominator) ||
        denominator <= 0
    )
        return null;
    return roundNumber((numerator / denominator) * 100);
}
