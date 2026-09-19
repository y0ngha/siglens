import { describe, expect, it } from 'vitest';
import { currentFiscalYearRow } from '@/shared/api/fmp/fundamentalClient';

// Shape of FMP's real `analyst-estimates?period=annual` response for NVDA on
// 2026-09-19: newest first, reaching five fiscal years ahead.
const NVDA_ROWS = [
    { date: '2031-01-25', epsAvg: 20, revenueAvg: 1119719500000 },
    { date: '2030-01-25', epsAvg: 23, revenueAvg: 1106047088760 },
    { date: '2029-01-25', epsAvg: 21.30748, revenueAvg: 914086450243 },
    { date: '2028-01-25', epsAvg: 15.70071, revenueAvg: 687354277951 },
    { date: '2027-01-25', epsAvg: 9.2584, revenueAvg: 408757705951 },
    { date: '2026-01-25', epsAvg: 4.69388, revenueAvg: 213656385457 },
    { date: '2025-01-26', epsAvg: 2.95192, revenueAvg: 129426091457 },
];
const NOW = new Date('2026-09-19T00:00:00Z');

describe('currentFiscalYearRow', () => {
    it('picks the fiscal year in progress, not the far-future first row', () => {
        expect(currentFiscalYearRow(NVDA_ROWS, NOW)?.date).toBe('2027-01-25');
    });

    it('picks a fiscal year ending today as still in progress', () => {
        expect(
            currentFiscalYearRow(NVDA_ROWS, new Date('2027-01-25T12:00:00Z'))
                ?.date
        ).toBe('2027-01-25');
    });

    it('falls back to the most recent past row when every row is in the past', () => {
        expect(currentFiscalYearRow(NVDA_ROWS.slice(5), NOW)?.date).toBe(
            '2026-01-25'
        );
    });

    it('falls back to the first row when no row carries a usable date', () => {
        const rows = [{ epsAvg: 1 }, { epsAvg: 2 }];
        expect(currentFiscalYearRow(rows, NOW)).toBe(rows[0]);
    });

    it('returns undefined for an empty response', () => {
        expect(currentFiscalYearRow([], NOW)).toBeUndefined();
    });
});
