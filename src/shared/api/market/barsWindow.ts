import type { Bar } from '@y0ngha/siglens-core';
import { ISO_DATE_LENGTH } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/** `now`에서 UTC 기준 `days`일 전의 `YYYY-MM-DD`. */
export function isoDateDaysAgo(now: Date, days: number): string {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return toUtcIsoDate(d);
}

/** YYYY-MM-DD(또는 ISO) 날짜를 UTC 자정 unix초로 변환(Bar.time과 동일 규약). */
export function utcMidnightSeconds(dateStr: string): number {
    return Math.floor(
        Date.parse(dateStr.slice(0, ISO_DATE_LENGTH) + 'T00:00:00Z') / 1000
    );
}

/** `from` 이후(포함) 봉만 남긴다 — 단일 `getBars(from)`와 동일 집합 보장. */
export function sliceFrom(bars: Bar[], from: string | undefined): Bar[] {
    if (from === undefined) return bars;
    const threshold = utcMidnightSeconds(from);
    return bars.filter(b => b.time >= threshold);
}
