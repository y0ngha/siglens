import { currencyFractionDigits } from '@/shared/lib/priceFormat';

/**
 * Round a money field (portfolio `marketValue`/`costBasis`/`pnl`, option
 * premiums in `get_options_summary`) to its currency's minor unit — decimal places come from
 * `currencyFractionDigits` (`shared/lib/priceFormat.ts`), not `roundNumber`'s
 * significant-digit rule — using half-away-from-zero rounding (150.005 →
 * 150.01, -150.005 → -150.01).
 *
 * `roundNumber` (`roundIndicators.ts`) was built for indicator VALUES, where
 * digit count should track magnitude. Money is a currency amount, not a
 * measurement: it always has the same number of decimals regardless of size.
 * Using significant digits here lost cents and got worse the bigger the
 * account got — measured: a $10,874.63 total came back as `10874.6` (6
 * sig-figs), and a $1,234,567.89 total would come back as `1234570` (rounded
 * to the TENS place). USD/crypto keep cents (2dp); KRW has no minor unit
 * (원화 호가 관례, matches `KR_EQUITY_DESCRIPTOR.priceFormat.precision`).
 *
 * NOT `Number(value.toFixed(d))` — binary floats make `toFixed` inconsistent
 * exactly at the half-cent boundary a user-entered `averagePrice` can land
 * on: `(150.005).toFixed(2) === '150.00'` (should round up) while
 * `(10.005).toFixed(2) === '10.01'`, because 150.005 and 10.005 aren't
 * exactly representable and happen to round to the nearest double on
 * opposite sides of .005. Nudging the magnitude by a relative
 * `Number.EPSILON` before `Math.round` pushes true .5 boundaries the same
 * way regardless of which side the float representation drifted to, without
 * going through a decimal string (so float noise like
 * `2.2737367544323206e-13`, from subtracting two equal raw totals, rounds to
 * `0` instead of round-tripping through a string). `-0` (e.g. a fully offset
 * pnl) is normalized to `0` so the model never reports a "-0 pnl".
 */
export function roundMoney(value: number, currency: string): number {
    const factor = 10 ** currencyFractionDigits(currency);
    const magnitude =
        Math.round(Math.abs(value) * (1 + Number.EPSILON) * factor) / factor;
    const rounded = Math.sign(value) * magnitude;
    return rounded === 0 ? 0 : rounded;
}
