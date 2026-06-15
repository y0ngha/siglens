/**
 * Returns a new array in oldest→newest (left-to-right) display order.
 *
 * Statement rows arrive newest→oldest (index 0 = latest) from the provider, but
 * tables and trend charts render oldest→newest. Uses `Array.prototype.toReversed()`
 * (non-mutating) shared by all statement section components so the
 * "reverse for display" intent lives in one place and never mutates the prop.
 */
export function toDisplayOrder<T>(rows: readonly T[]): T[] {
    return rows.toReversed();
}
