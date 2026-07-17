/**
 * Trims trailing fractional zeros (and a dangling decimal point) from a decimal
 * string, e.g. "10.00000000" -> "10", "152.35000000" -> "152.35".
 *
 * Deliberately duplicated from `features/portfolio-management/lib/formatDecimal`
 * rather than imported: that module isn't exported through the
 * `portfolio-management` barrel (production code may only import slice barrels,
 * see `src/features/CLAUDE.md`), and holdings quantity/averagePrice are exact
 * decimal strings that must never be routed through a JS float /
 * Intl.NumberFormat rounding step. Keep both copies in sync if the trimming
 * rule ever changes.
 */
export function trimTrailingZeros(value: string): string {
    if (!value.includes('.')) return value;
    return value.replace(/0+$/, '').replace(/\.$/, '');
}
