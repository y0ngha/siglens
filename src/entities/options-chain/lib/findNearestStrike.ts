/**
 * Return the index of the strike value closest to `target` within `strikes`.
 *
 * Returns -1 for an empty input. When two strikes are equidistant the
 * lower index wins (first match in iteration order). Used by both the
 * OI chart (needs the index for x-axis positioning) and the chain table
 * (which then reads the strike value at that index for ATM row
 * highlighting), so the helper exposes the index — callers retrieve the
 * value with `strikes[result]` when needed.
 */
export function findNearestStrikeIndex(
    strikes: ReadonlyArray<number>,
    target: number
): number {
    if (strikes.length === 0) return -1;
    return strikes.reduce(
        (best, strike, i) => {
            const d = Math.abs(strike - target);
            return d < best.dist ? { idx: i, dist: d } : best;
        },
        { idx: 0, dist: Math.abs(strikes[0] - target) }
    ).idx;
}
