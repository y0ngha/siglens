import { PgDialect } from 'drizzle-orm/pg-core';
import { getTableName, type SQL } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
    cusipSymbolMap,
    sec13fAggregates,
    sec13fFilings,
    sec13fPositions,
} from '@/shared/db/schema';
import {
    buildAggregateDeleteSql,
    buildAggregateUpsertSql,
    buildBaselinelessAggregateUpsertSql,
    buildResetChangesSql,
} from '../../api/aggregateSql';

const dialect = new PgDialect();
const render = (query: SQL): { text: string; params: unknown[] } => {
    const { sql, params } = dialect.sqlToQuery(query);
    return { text: sql.replace(/\s+/g, ' '), params };
};

describe('aggregate SQL — table names match the schema', () => {
    const all = [
        render(
            buildAggregateUpsertSql('panel', '2026-09-30', '2026-06-30', ['A'])
        ).text,
        render(buildBaselinelessAggregateUpsertSql('2026-09-30', ['A'])).text,
        render(
            buildAggregateDeleteSql('complete', '2026-09-30', '2026-06-30', [
                'A',
            ])
        ).text,
        render(buildResetChangesSql('2026-09-30')).text,
    ].join(' ');

    it.each([
        ['aggregates', getTableName(sec13fAggregates)],
        ['filings', getTableName(sec13fFilings)],
        ['positions', getTableName(sec13fPositions)],
        ['cusip map', getTableName(cusipSymbolMap)],
    ])('references the %s table by its real name', (_label, name) => {
        expect(all).toContain(name);
    });
});

describe('buildAggregateUpsertSql', () => {
    describe('complete mode (full previous quarter vs full current quarter)', () => {
        const { text, params } = render(
            buildAggregateUpsertSql('complete', '2026-06-30', '2026-03-31', [
                '037833100',
                '594918104',
            ])
        );

        it('does not restrict either side to a filer set (symmetric populations)', () => {
            // the only filings reference is the prior period's first-ingestion time for the per-CUSIP baseline
            expect(text).not.toContain(
                'cik IN (SELECT cik FROM sec_13f_filings'
            );
        });

        it('binds period, prior period and CUSIPs as parameters (never inlined)', () => {
            expect(params).toEqual([
                '037833100',
                '594918104',
                '2026-03-31', // first-ingestion subquery (prior period)
                '2026-06-30', // current period positions
                '2026-03-31', // prior period positions
                '2026-06-30', // the period column written
            ]);
            for (const literal of ['2026-06-30', '2026-03-31', '037833100']) {
                expect(text).not.toContain(literal);
            }
        });

        it('classifies new / increased / decreased / exited from the full outer join', () => {
            expect(text).toContain('FULL OUTER JOIN');
            expect(text).toContain(
                'j.cur_shares IS NOT NULL AND j.prev_shares IS NULL'
            );
            expect(text).toContain('j.cur_shares > j.prev_shares');
            expect(text).toContain('j.cur_shares < j.prev_shares');
            expect(text).toContain(
                'j.cur_shares IS NULL AND j.prev_shares IS NOT NULL'
            );
        });

        it('nulls every change column for a CUSIP mapped AFTER the prior period was first ingested (per-CUSIP baseline by ingestion time)', () => {
            const cases =
                text.match(
                    /CASE WHEN m\.created_at <= \(SELECT first_at FROM pe\)/g
                ) ?? [];
            expect(cases).toHaveLength(5);
        });

        it('derives the baseline reference from the prior period’s earliest universe snapshot stamp, not from processed_at or a calendar cutoff', () => {
            expect(text).toContain(
                'SELECT min(universe_stamp) AS first_at FROM sec_13f_filings WHERE period = $3 AND processed_at IS NOT NULL'
            );
            expect(text).not.toContain('+ 1)');
        });

        it('stores value in thousands and scales the sum back to dollars', () => {
            expect(text).toContain(
                '(coalesce(sum(j.cur_value), 0) * 1000)::bigint'
            );
        });

        it('skips unchanged rows with an IS DISTINCT FROM guard on the conflict update', () => {
            expect(text).toContain('ON CONFLICT (cusip, period) DO UPDATE');
            expect(text).toContain('IS DISTINCT FROM');
        });
    });

    describe('panel mode (in-progress quarter: only filers present in BOTH quarters)', () => {
        const { text } = render(
            buildAggregateUpsertSql('panel', '2026-09-30', '2026-06-30', ['A'])
        );

        it('restricts BOTH the current and the prior side to filers that filed both periods', () => {
            const filerFilters =
                text.match(
                    /cik IN \(SELECT cik FROM sec_13f_filings WHERE period = \$\d+ AND processed_at IS NOT NULL\)/g
                ) ?? [];
            // 2 periods × 2 sides
            expect(filerFilters).toHaveLength(4);
        });
    });
});

describe('buildBaselinelessAggregateUpsertSql', () => {
    const { text } = render(
        buildBaselinelessAggregateUpsertSql('2026-03-31', ['A'])
    );

    it('writes only counts and never the change columns', () => {
        expect(text).toContain(
            '(cusip, period, holders, shares, value_usd, computed_at)'
        );
        expect(text).not.toContain('new_holders = excluded');
        expect(text).not.toContain('net_share_change');
    });

    it('always refreshes holders / shares / value, leaving only the change columns untouched', () => {
        const update = text.slice(text.indexOf('DO UPDATE SET'));
        expect(update).toContain('holders = excluded.holders');
        expect(update).toContain('shares = excluded.shares');
        expect(update).toContain('value_usd = excluded.value_usd');
        expect(update).not.toMatch(
            /new_holders = |increased = |decreased = |exited = |net_share_change = /
        );
    });

    it('is not gated on the existing row having NULL change columns', () => {
        expect(text).not.toContain('a.new_holders IS NULL');
        expect(text).toContain(
            'IS DISTINCT FROM (excluded.holders, excluded.shares, excluded.value_usd)'
        );
    });
});

describe('buildAggregateDeleteSql', () => {
    it('complete: deletes only when neither quarter has any position', () => {
        const { text, params } = render(
            buildAggregateDeleteSql('complete', '2026-09-30', '2026-06-30', [
                'A',
            ])
        );
        expect(text).toContain('p.period IN ($3, $4)');
        expect(text).not.toContain('sec_13f_filings');
        expect(params).toEqual(['2026-09-30', 'A', '2026-09-30', '2026-06-30']);
    });

    it('panel: only panel filers count as "still has positions"', () => {
        const { text } = render(
            buildAggregateDeleteSql('panel', '2026-09-30', '2026-06-30', ['A'])
        );
        expect(
            text.match(/p\.cik IN \(SELECT cik FROM sec_13f_filings/g)
        ).toHaveLength(2);
    });

    it('none: only rows computed without a baseline are deleted', () => {
        const { text } = render(
            buildAggregateDeleteSql('none', '2026-03-31', '2025-12-31', ['A'])
        );
        expect(text).toContain('a.new_holders IS NULL');
        expect(text).not.toContain('p.period IN');
    });
});

describe('buildResetChangesSql', () => {
    it('nulls all five change columns of rows that have a baseline, for one period', () => {
        const { text, params } = render(buildResetChangesSql('2026-03-31'));
        for (const column of [
            'new_holders',
            'increased',
            'decreased',
            'exited',
            'net_share_change',
        ]) {
            expect(text).toContain(`${column} = NULL`);
        }
        expect(text).toContain('new_holders IS NOT NULL');
        expect(params).toEqual(['2026-03-31']);
    });
});
