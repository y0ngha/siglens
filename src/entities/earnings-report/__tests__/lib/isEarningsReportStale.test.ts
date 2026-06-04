import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    EARNINGS_REPORT_STALE_MS,
    isEarningsReportStale,
} from '@/entities/earnings-report/lib/isEarningsReportStale';
import { MS_PER_DAY } from '@/shared/config/time';

describe('isEarningsReportStale', () => {
    afterEach(() => vi.useRealTimers());

    it('fetchedAt이 null이면 stale(true) — 첫 방문', () => {
        expect(isEarningsReportStale(null)).toBe(true);
    });

    it('24시간 이내면 fresh(false)', () => {
        expect(isEarningsReportStale(new Date(Date.now() - 1000))).toBe(false);
    });

    it('24시간 초과면 stale(true)', () => {
        expect(
            isEarningsReportStale(new Date(Date.now() - (MS_PER_DAY + 1000)))
        ).toBe(true);
    });

    it('정확히 24시간 경계는 fresh(false) — 초과(>)만 stale', () => {
        vi.useFakeTimers();
        const now = new Date('2026-06-04T00:00:00Z');
        vi.setSystemTime(now);
        expect(
            isEarningsReportStale(new Date(now.getTime() - MS_PER_DAY))
        ).toBe(false);
    });

    it('EARNINGS_REPORT_STALE_MS는 24시간(MS_PER_DAY)', () => {
        expect(EARNINGS_REPORT_STALE_MS).toBe(MS_PER_DAY);
    });
});
