import { describe, expect, it } from 'vitest';
import type { IncomeStatementRow } from '@y0ngha/siglens-core';
import {
    EARNINGS_REACTIONS_COUNT,
    earningsReactions,
    RECENT_QUARTERS_COUNT,
    recentQuarterRows,
} from '@/app/api/ai/chat/tools/earningsHistory';
import { pctVs } from '@/app/api/ai/chat/tools/percent';

const bar = (date: string, close: number) => ({
    time: Date.parse(`${date}T00:00:00Z`) / 1000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
});

describe('earningsReactions', () => {
    // Thu 07-30, Fri 07-31, Mon 08-03, Tue 08-04.
    const bars = [
        bar('2026-07-30', 100),
        bar('2026-07-31', 110),
        bar('2026-08-03', 99),
        bar('2026-08-04', 120),
    ];

    it('spans the session before the report date to the session after it', () => {
        // Report on Fri 07-31 (a session): 07-30 close → 08-03 close.
        expect(earningsReactions(bars, ['2026-07-31'], false)).toEqual([
            { date: '2026-07-31', movePct: pctVs(99, 100) },
        ]);
    });

    it('a report dated on a non-session day uses the sessions around it', () => {
        // Sat 08-01: 07-31 close → 08-03 close.
        expect(earningsReactions(bars, ['2026-08-01'], false)).toEqual([
            { date: '2026-08-01', movePct: pctVs(99, 110) },
        ]);
    });

    it('skips a date with no session after it', () => {
        expect(
            earningsReactions(bars, ['2026-08-04', '2026-09-01'], false)
        ).toEqual([]);
    });

    it('a report dated on the first loaded bar has no session before it and is skipped', () => {
        expect(earningsReactions(bars, ['2026-07-30'], false)).toEqual([]);
    });

    it('a live (forming) last bar is not a close: an after-close report on 08-03 read during 08-04 is skipped', () => {
        expect(earningsReactions(bars, ['2026-08-03'], true)).toEqual([]);
        // Earlier reports, measured on completed bars only, are unaffected.
        expect(earningsReactions(bars, ['2026-07-31'], true)).toEqual([
            { date: '2026-07-31', movePct: pctVs(99, 100) },
        ]);
    });

    it('once that session has closed, the same bar is a completed close and the report is kept', () => {
        expect(earningsReactions(bars, ['2026-08-03'], false)).toEqual([
            { date: '2026-08-03', movePct: pctVs(120, 110) },
        ]);
    });

    it('newest first, deduplicated, capped', () => {
        const long = Array.from({ length: 40 }, (_, i) =>
            bar(
                new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
                100 + i
            )
        );
        const dates = Array.from({ length: 12 }, (_, i) =>
            new Date(Date.UTC(2026, 0, 3 + i * 3)).toISOString().slice(0, 10)
        );
        const r = earningsReactions(long, [...dates, dates[0]!], false);
        expect(r).toHaveLength(EARNINGS_REACTIONS_COUNT);
        expect(r.map(x => x.date)).toEqual(
            dates.toReversed().slice(0, EARNINGS_REACTIONS_COUNT)
        );
    });
});

describe('recentQuarterRows', () => {
    const row = (
        date: string,
        period: string,
        extra: Partial<IncomeStatementRow> & { filingDate?: string | null } = {}
    ): IncomeStatementRow =>
        ({
            fiscalYear: date.slice(0, 4),
            period,
            date,
            reportedCurrency: 'USD',
            revenue: 1_000,
            grossProfit: null,
            operatingIncome: null,
            netIncome: null,
            ebitda: null,
            eps: 1.1,
            epsDiluted: 1,
            grossMargin: null,
            operatingMargin: null,
            netMargin: null,
            ...extra,
        }) as IncomeStatementRow;

    it('newest first, capped, with the filing date when the provider gives one', () => {
        const rows = [
            row('2025-10-03', 'Q1'),
            row('2026-07-03', 'Q4', { filingDate: '2026-08-01' }),
            row('2026-04-03', 'Q3', { filingDate: '2026-04-29' }),
            row('2026-01-02', 'Q2'),
            row('2025-06-27', 'Q4'),
            row('2025-03-28', 'Q3'),
        ];
        const r = recentQuarterRows(rows);
        expect(r).toHaveLength(RECENT_QUARTERS_COUNT);
        expect(r[0]).toEqual({
            periodEnd: '2026-07-03',
            fiscalYear: '2026',
            period: 'Q4',
            filingDate: '2026-08-01',
            epsDiluted: 1,
            revenue: 1_000,
            currency: 'USD',
        });
        expect(r.map(q => [q.periodEnd, q.filingDate])).toEqual([
            ['2026-07-03', '2026-08-01'],
            ['2026-04-03', '2026-04-29'],
            ['2026-01-02', null],
            ['2025-10-03', null],
            ['2025-06-27', null],
        ]);
    });

    it('carries the reporting currency (an ADR reports in its home currency)', () => {
        const twd = row('2026-06-30', 'Q2', { reportedCurrency: 'TWD' });
        expect(recentQuarterRows([twd])[0]!.currency).toBe('TWD');
    });

    it('drops rows without a period end date', () => {
        expect(recentQuarterRows([row('', 'Q1')])).toEqual([]);
    });
});
