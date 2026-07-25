/**
 * Builds a prototype-safe `unknown`-narrowing guard for a string-keyed enum
 * `labelMap`. Extracted from the `isTrend`/`isTone`/`isSentiment`/`isAxis`/
 * `isCategory`/`isSignalKind` guards that each `*SnapshotProse` renderer
 * re-implemented separately (PR #698 round-2 review FIX 3).
 *
 * Uses `Object.hasOwn` — **do not** replace with `value in labelMap`. The
 * `in` operator walks the prototype chain, so `'__proto__' in labelMap` is
 * `true` and `labelMap['__proto__']` yields `Object.prototype`, which React
 * throws on when rendered as a child ("Objects are not valid as a React
 * child"). A malformed JSONB enum value (`__proto__`, `constructor`,
 * `toString`, ...) reaching this guard must be rejected, not resolved to a
 * prototype method — this is the guard against that production-500 class of
 * bug (see the original `TechnicalSnapshotProse.isTrend` rationale). Any
 * future edit to this factory must keep both the `Object.hasOwn` check and
 * the `typeof value === 'string'` guard (non-string input, e.g. an object
 * or array, must never reach `Object.hasOwn`).
 */
export function createEnumGuard<T extends string>(
    labelMap: Record<T, string>
): (value: unknown) => value is T {
    return (value: unknown): value is T =>
        typeof value === 'string' && Object.hasOwn(labelMap, value);
}
