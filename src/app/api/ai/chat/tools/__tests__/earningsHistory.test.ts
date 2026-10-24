import { describe, expect, it } from 'vitest';
import type { IncomeStatementRow } from '@y0ngha/siglens-core';
import {
    EARNINGS_REACTIONS_COUNT,
    earningsReactions,
    RECENT_QUARTERS_COUNT,
    recentQuarterRows,
} from '@/app/api/ai/chat/tools/earningsHistory';
import { pctVs } from '@/app/api/ai/chat/tools/percent';
import type { SecQuarter } from '@/app/api/ai/chat/tools/secQuarters';

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
            form: '10-K',
            filingDate: '2026-08-01',
            epsDiluted: 1,
            revenue: 1_000,
            revenueYoYPct: 0, // 2025 Q4 row exists with the same revenue
            currency: 'USD',
            sec: null,
        });
        expect(r.map(q => [q.periodEnd, q.filingDate])).toEqual([
            ['2026-07-03', '2026-08-01'],
            ['2026-04-03', '2026-04-29'],
            ['2026-01-02', null],
            ['2025-10-03', null],
            ['2025-06-27', null],
        ]);
    });

    it('form follows the fiscal quarter label: Q4 is the 10-K, Q1-Q3 the 10-Q, anything else unknown', () => {
        const forms = ['Q1', 'Q2', 'Q3', 'Q4', 'FY'].map(
            p => recentQuarterRows([row('2026-06-30', p)])[0]!.form
        );
        expect(forms).toEqual(['10-Q', '10-Q', '10-Q', '10-K', null]);
    });

    it('form is derived for a USD reporter', () => {
        expect(recentQuarterRows([row('2026-06-30', 'Q2')])[0]!.form).toBe(
            '10-Q'
        );
    });

    it('form is null for a Korean stock even when the rows report in USD', () => {
        expect(
            recentQuarterRows([row('2026-06-30', 'Q2')], true)[0]!.form
        ).toBeNull();
    });

    it('form is null for a non-USD (foreign/ADR) reporter', () => {
        const adr = row('2026-06-30', 'Q2', { reportedCurrency: 'TWD' });
        expect(recentQuarterRows([adr])[0]!.form).toBeNull();
    });

    it.each([null, undefined])(
        'a row with reportedCurrency %s still gets the derived form (documented limitation)',
        reportedCurrency => {
            const r = row('2026-12-31', 'Q4', { reportedCurrency });
            expect(recentQuarterRows([r])[0]!.form).toBe('10-K');
        }
    );

    it('revenueYoYPct compares with the same fiscal quarter a year earlier, found beyond the five rows shown', () => {
        const rows = [
            row('2026-09-30', 'Q3', { revenue: 1_250 }),
            row('2026-06-30', 'Q2', { revenue: 1_000 }),
            row('2026-03-31', 'Q1', { revenue: 900 }),
            row('2025-12-31', 'Q4', { revenue: 800 }),
            row('2025-09-30', 'Q3', { revenue: 1_000 }),
            row('2025-06-30', 'Q2', { revenue: 800 }),
            row('2025-03-31', 'Q1', { revenue: 1_200 }),
        ];
        const r = recentQuarterRows(rows);
        expect(r).toHaveLength(RECENT_QUARTERS_COUNT);
        expect(r.map(q => q.revenueYoYPct)).toEqual([
            25, // 1250 / 1000
            25, // 1000 / 800
            -25, // 900 / 1200
            null, // no 2024 Q4 row
            null, // no 2024 Q3 row
        ]);
    });

    it('revenueYoYPct is rounded to 2 decimals and null on a missing or non-positive base or a missing revenue', () => {
        const rows = [
            row('2026-09-30', 'Q3', { revenue: 1_000 }),
            row('2026-06-30', 'Q2', { revenue: 500 }),
            row('2026-03-31', 'Q1', { revenue: null }),
            row('2025-09-30', 'Q3', { revenue: 3_000 }),
            row('2025-06-30', 'Q2', { revenue: 0 }),
            row('2025-03-31', 'Q1', { revenue: 100 }),
        ];
        expect(recentQuarterRows(rows).map(q => q.revenueYoYPct)).toEqual([
            -66.67,
            null,
            null,
            null,
            null,
        ]);
    });

    it('carries the reporting currency (an ADR reports in its home currency)', () => {
        const twd = row('2026-06-30', 'Q2', { reportedCurrency: 'TWD' });
        expect(recentQuarterRows([twd])[0]!.currency).toBe('TWD');
    });

    describe('with SEC XBRL quarters', () => {
        const secQuarter = (
            overrides: Partial<SecQuarter> = {}
        ): SecQuarter => ({
            periodEnd: '2026-03-28',
            form: '10-Q',
            accn: '0001116132-26-000011',
            filed: '2026-05-07',
            epsDiluted: 1.65,
            revenue: 1_920_600_000,
            revenueYoYPct: 21.2,
            ...overrides,
        });
        // FMP says 1.66 and compares with a different year-ago row.
        const fmpRow = (extra: Partial<IncomeStatementRow> = {}) =>
            row('2026-03-28', 'Q3', {
                epsDiluted: 1.66,
                revenue: 1_900_000_000,
                ...extra,
            });

        it('adds the as-filed figures, keeps the FMP fields and takes the actual form', () => {
            const [q] = recentQuarterRows([fmpRow()], false, [secQuarter()]);
            expect(q).toMatchObject({
                form: '10-Q',
                epsDiluted: 1.66,
                revenue: 1_900_000_000,
                sec: {
                    form: '10-Q',
                    epsDiluted: 1.65,
                    revenue: 1_920_600_000,
                    revenueYoYPct: 21.2,
                    filed: '2026-05-07',
                    accn: '0001116132-26-000011',
                },
            });
        });

        it('the form comes from the filing, not the label (a 10-K/A for a Q4 label, a 10-Q/A for Q2)', () => {
            const amended = secQuarter({ form: '10-K/A' });
            expect(
                recentQuarterRows([fmpRow({ period: 'Q4' })], false, [
                    amended,
                ])[0]!.form
            ).toBe('10-K/A');
            expect(
                recentQuarterRows([fmpRow({ period: 'Q2' })], false, [
                    secQuarter({ form: '10-Q/A' }),
                ])[0]!.form
            ).toBe('10-Q/A');
        });

        it('revenueYoYPct prefers the SEC-derived value over the row-based one', () => {
            const rows = [
                fmpRow({ revenue: 1_000 }),
                row('2025-03-29', 'Q3', { revenue: 2_000 }), // would give -50
            ];
            expect(recentQuarterRows(rows)[0]!.revenueYoYPct).toBe(-50);
            expect(
                recentQuarterRows(rows, false, [secQuarter()])[0]!.revenueYoYPct
            ).toBe(21.2);
        });

        it('a null SEC YoY falls back to the row-based value', () => {
            const rows = [
                fmpRow({ revenue: 1_500 }),
                row('2025-03-29', 'Q3', { revenue: 1_000 }),
            ];
            const [q] = recentQuarterRows(rows, false, [
                secQuarter({ revenueYoYPct: null }),
            ]);
            expect(q!.revenueYoYPct).toBe(50);
            expect(q!.sec?.revenueYoYPct).toBeNull();
        });

        it('a quarter with no matching SEC period keeps the label-derived form and sec null', () => {
            const [q] = recentQuarterRows([fmpRow()], false, [
                secQuarter({ periodEnd: '2025-12-27' }),
            ]);
            expect(q).toMatchObject({ form: '10-Q', sec: null });
        });

        it('Korean stocks are unchanged even when SEC quarters are passed', () => {
            const [q] = recentQuarterRows([fmpRow()], true, [secQuarter()]);
            expect(q).toMatchObject({
                form: null,
                sec: null,
                revenueYoYPct: null,
            });
        });

        it('foreign (non-USD) reporters are unchanged', () => {
            const [q] = recentQuarterRows(
                [fmpRow({ reportedCurrency: 'TWD' })],
                false,
                [secQuarter()]
            );
            expect(q).toMatchObject({ form: null, sec: null });
        });

        it('null SEC quarters (no CIK, SEC down) leave the FMP-based view', () => {
            expect(recentQuarterRows([fmpRow()], false, null)[0]).toMatchObject(
                {
                    form: '10-Q',
                    sec: null,
                }
            );
        });
    });

    it('drops rows without a period end date', () => {
        expect(recentQuarterRows([row('', 'Q1')])).toEqual([]);
    });
});
