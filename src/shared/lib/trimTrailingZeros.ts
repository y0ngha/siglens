/**
 * Trims trailing fractional zeros (and a dangling decimal point) from a decimal
 * string produced by validateHoldingInput (shape `^\d+(\.\d+)?$`). Kept separate
 * from shared/lib/priceFormat because holdings quantity/averagePrice are stored
 * as exact decimal strings (up to 8 fractional digits) and must never be routed
 * through a JS float / Intl.NumberFormat rounding step — that would silently
 * truncate a crypto holding's sub-cent average price.
 *
 * "10.00000000" -> "10", "152.35000000" -> "152.35", "10" -> "10"
 */
export function trimTrailingZeros(value: string): string {
    if (!value.includes('.')) return value;
    return value.replace(/0+$/, '').replace(/\.$/, '');
}
