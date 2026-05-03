import { KST_OFFSET_HOURS, MS_PER_HOUR } from '@/domain/constants/time';

/** Returns today's KST date as `YYYY-MM-DD`; call outside `'use cache'` boundaries so the date is always fresh. */
export function todayKstIsoDate(): string {
    const kstOffsetMs = KST_OFFSET_HOURS * MS_PER_HOUR;
    return new Date(Date.now() + kstOffsetMs).toISOString().slice(0, 10);
}
