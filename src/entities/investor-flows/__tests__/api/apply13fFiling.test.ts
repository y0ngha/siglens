import { describe, expect, it, vi } from 'vitest';
import {
    sec13fDirtyAggregates,
    sec13fFilers,
    sec13fFilings,
    sec13fOptionPositions,
    sec13fPositions,
} from '@/shared/db/schema';
import {
    applyFiling,
    toValueK,
    type ApplyFilingInput,
} from '../../api/apply13fFiling';
import { callsOf, createFakeDb, renderSql } from '../fixtures/fakeDb';

vi.mock('server-only', () => ({}));

const ABBOTT = '002824100';
const MSFT = '594918104';

const baseInput: ApplyFilingInput = {
    accession: '0002085853-26-001185',
    cik: '0002148692',
    filingDate: '2026-10-14',
    submissionType: '13F-HR',
    amendmentType: null,
    period: '2026-09-30',
    filerName: '15 Wealth Advisors LLC',
    mode: 'merge',
    rows: [{ cusip: ABBOTT, shares: 19357, valueUsd: 1912972 }],
    optionRows: [],
    cusipIds: new Map([
        [ABBOTT, 11],
        [MSFT, 22],
    ]),
    firstForPeriod: false,
    universeStamp: '2026-10-15 11:00:00+00',
};

describe('toValueK', () => {
    it('rounds dollars to thousands', () => {
        expect(toValueK(1_912_972)).toBe(1_913);
        expect(toValueK(499)).toBe(0);
        expect(toValueK(500)).toBe(1);
    });

    it('clamps to int4 so a huge position cannot fail the whole filing', () => {
        expect(toValueK(9_000_000_000_000_000)).toBe(2_147_483_647);
    });

    it('keeps zero at zero', () => {
        expect(toValueK(0)).toBe(0);
    });
});

describe('applyFiling', () => {
    describe('when the period is unknown', () => {
        it('records the ledger row with a null period and writes no positions or dirty rows', async () => {
            const { db, ops } = createFakeDb();
            const touched = await applyFiling(db, vi.fn(), {
                ...baseInput,
                period: null,
                mode: 'replace',
            });
            expect(touched).toEqual([]);
            expect(ops.map(op => op.target)).toEqual([
                sec13fFilers,
                sec13fFilings,
            ]);
            const [[values]] = callsOf(ops[1] as never, 'values') as [
                [Record<string, unknown>],
            ];
            expect(values.period).toBeNull();
        });
    });

    describe('when the same CUSIP repeats in one filing', () => {
        it('keeps the last row, writes it once and logs the drop', async () => {
            const log = vi.fn();
            const { db, ops } = createFakeDb([[{ cusipId: 11 }], []]);
            await applyFiling(db, log, {
                ...baseInput,
                rows: [
                    { cusip: ABBOTT, shares: 1, valueUsd: 1_000 },
                    { cusip: ABBOTT, shares: 2, valueUsd: 2_000 },
                ],
            });
            const insert = ops.find(op => op.target === sec13fPositions);
            const [[values]] = callsOf(insert as never, 'values') as [
                [Record<string, unknown>[]],
            ];
            expect(values).toEqual([
                {
                    shares: 2,
                    cik: 2148692,
                    cusipId: 11,
                    period: '2026-09-30',
                    valueK: 2,
                },
            ]);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log.mock.calls[0]?.[0]).toContain('sec_13f_positions');
        });
    });

    describe('when a stock and an option row change the same CUSIP', () => {
        it('reports the CUSIP once', async () => {
            const { db } = createFakeDb([
                [{ cusipId: 22 }], // stock rows
                [], // dirty
                [{ cusip: MSFT }], // option rows
                [], // dirty
            ]);
            const touched = await applyFiling(db, vi.fn(), {
                ...baseInput,
                rows: [{ cusip: MSFT, shares: 5, valueUsd: 5_000 }],
                optionRows: [
                    { cusip: MSFT, putCall: 'put', shares: 1, valueUsd: 10 },
                ],
            });
            expect(touched).toEqual([MSFT]);
        });
    });

    describe('when the filing is the first for its period', () => {
        it('queues the previous and next quarter holdings after the position writes', async () => {
            const { db, ops } = createFakeDb();
            await applyFiling(db, vi.fn(), {
                ...baseInput,
                firstForPeriod: true,
            });
            const kinds = ops.map(op => op.kind);
            const lastInsertIndex = kinds.lastIndexOf('insert');
            const executes = ops
                .map((op, index) => ({ op, index }))
                .filter(({ op }) => op.kind === 'execute');
            expect(executes).toHaveLength(2);
            const prev = renderSql(executes[0]?.op.target as never);
            const next = renderSql(executes[1]?.op.target as never);
            expect(prev.params).toEqual(['2026-09-30', 2148692, '2026-06-30']);
            expect(next.params).toEqual(['2026-12-31', 2148692, '2026-12-31']);
            // both queue statements run before the filer and ledger rows are written
            expect(executes[1]?.index).toBeLessThan(
                ops.findIndex(op => op.target === sec13fFilers)
            );
            expect(lastInsertIndex).toBeGreaterThan(executes[1]?.index ?? 0);
        });

        it('does not queue neighbouring quarters otherwise', async () => {
            const { db, ops } = createFakeDb();
            await applyFiling(db, vi.fn(), baseInput);
            expect(ops.some(op => op.kind === 'execute')).toBe(false);
        });
    });

    describe('when the transaction fails', () => {
        it('rejects without recording the ledger row', async () => {
            const { db, ops } = createFakeDb([new Error('boom')]);
            await expect(
                applyFiling(db, vi.fn(), { ...baseInput, mode: 'replace' })
            ).rejects.toThrow('boom');
            expect(ops.some(op => op.target === sec13fFilings)).toBe(false);
        });
    });

    describe('when positions change', () => {
        it('queues each written CUSIP id under the period in the dirty table', async () => {
            const { db, ops } = createFakeDb([[{ cusipId: 11 }]]);
            await applyFiling(db, vi.fn(), baseInput);
            const dirty = ops.find(op => op.target === sec13fDirtyAggregates);
            const [[values]] = callsOf(dirty as never, 'values') as [[unknown]];
            expect(values).toEqual([{ period: '2026-09-30', cusipId: 11 }]);
        });

        it('does not touch the dirty table when nothing changed', async () => {
            const { db, ops } = createFakeDb([[]]);
            const touched = await applyFiling(db, vi.fn(), baseInput);
            expect(touched).toEqual([]);
            expect(ops.some(op => op.target === sec13fDirtyAggregates)).toBe(
                false
            );
        });
    });

    describe('when option rows are in the filing', () => {
        it('writes option positions only for universe CUSIPs', async () => {
            const { db, ops } = createFakeDb();
            await applyFiling(db, vi.fn(), {
                ...baseInput,
                rows: [],
                optionRows: [
                    {
                        cusip: 'ZZZZZZZZ9',
                        putCall: 'call',
                        shares: 1,
                        valueUsd: 1,
                    },
                ],
            });
            expect(ops.some(op => op.target === sec13fOptionPositions)).toBe(
                false
            );
        });
    });
});
