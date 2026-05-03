/**
 * Returns today's date in KST (Korea Standard Time, UTC+9) as an ISO-8601
 * date string (`YYYY-MM-DD`).
 *
 * Intended for use *outside* `'use cache'` / `unstable_cache` boundaries so
 * that the date is always evaluated fresh at render time and can be passed as
 * a stable cache key parameter.
 */
export function todayKstIsoDate(): string {
    const kstOffsetMs = 9 * 60 * 60 * 1000;
    return new Date(Date.now() + kstOffsetMs).toISOString().slice(0, 10);
}
