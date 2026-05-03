/** Returns today's KST date as `YYYY-MM-DD`; call outside `'use cache'` boundaries so the date is always fresh. */
export function todayKstIsoDate(): string {
    const kstOffsetMs = 9 * 60 * 60 * 1000;
    return new Date(Date.now() + kstOffsetMs).toISOString().slice(0, 10);
}
