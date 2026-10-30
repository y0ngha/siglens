/**
 * Compact count notation shared by the OI and volume charts (1.2M, 4.5k, 750).
 * Both charts use the same y-scale language, so thresholds and the single
 * decimal place are intentionally identical.
 */
const MILLION = 1_000_000;
const THOUSAND = 1_000;
// One decimal of `k` steps by 0.1k = 100; values within half a step below a
// million round up to "1000.0k", so they belong to the M unit instead.
const HALF_THOUSAND_DISPLAY_STEP = THOUSAND / 20;

interface CompactUnit {
    /** Smallest raw value that is displayed in this unit after rounding. */
    minValue: number;
    size: number;
    suffix: string;
}

// Ordered from the largest unit; the first match wins.
const COMPACT_UNITS: ReadonlyArray<CompactUnit> = [
    {
        minValue: MILLION - HALF_THOUSAND_DISPLAY_STEP,
        size: MILLION,
        suffix: 'M',
    },
    { minValue: THOUSAND, size: THOUSAND, suffix: 'k' },
];

/**
 * Format a non-negative count compactly. The unit is chosen with rounding in
 * mind, so 999_960 reads "1.0M" rather than "1000.0k".
 */
export function formatCompactCount(value: number): string {
    const unit = COMPACT_UNITS.find(({ minValue }) => value >= minValue);
    if (unit === undefined) return String(value);
    return `${(value / unit.size).toFixed(1)}${unit.suffix}`;
}
