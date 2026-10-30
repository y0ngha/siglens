import { describe, expect, it, vi } from 'vitest';
import {
    pruneAggregatesBefore,
    pruneFilingsBefore,
    prunePositionsBefore,
} from '../../api/prune13f';
import { INVESTOR_FLOWS_PRUNE_BATCH_SIZE } from '../../lib/investorFlowsPolicy';
import { createFakeDb, renderSql } from '../fixtures/fakeDb';

vi.mock('server-only', () => ({}));

/** postgres-js의 결과 배열처럼 영향 행 수(`count`)를 단 결과. */
const withCount = (count: number) => Object.assign([], { count });

describe('prunePositionsBefore', () => {
    it('deletes stock positions in batches and continues after a full batch', async () => {
        const { db, ops } = createFakeDb([
            withCount(INVESTOR_FLOWS_PRUNE_BATCH_SIZE),
            withCount(0),
            withCount(0),
        ]);
        const result = await prunePositionsBefore(
            db,
            '2026-03-31',
            () => false
        );
        expect(result).toEqual({
            deleted: INVESTOR_FLOWS_PRUNE_BATCH_SIZE,
            done: true,
        });
        // two stock batches (the second is empty), then one option batch
        expect(ops).toHaveLength(3);
    });

    it('prunes option positions only after the stock positions are done', async () => {
        const { db, ops } = createFakeDb([withCount(3), withCount(4)]);
        const result = await prunePositionsBefore(
            db,
            '2026-03-31',
            () => false
        );
        expect(result).toEqual({ deleted: 7, done: true });
        expect(renderSql(ops[0]?.target as never).text).toContain(
            'DELETE FROM sec_13f_positions WHERE ctid IN'
        );
        expect(renderSql(ops[1]?.target as never).text).toContain(
            'DELETE FROM sec_13f_option_positions WHERE ctid IN'
        );
    });

    it('binds the floor date and the batch size as parameters', async () => {
        const { db, ops } = createFakeDb([withCount(0), withCount(0)]);
        await prunePositionsBefore(db, '2026-03-31', () => false);
        expect(renderSql(ops[0]?.target as never).params).toEqual([
            '2026-03-31',
            INVESTOR_FLOWS_PRUNE_BATCH_SIZE,
        ]);
    });

    it('does nothing and reports not done when told to stop before the first batch', async () => {
        const { db, ops } = createFakeDb();
        const result = await prunePositionsBefore(db, '2026-03-31', () => true);
        expect(result).toEqual({ deleted: 0, done: false });
        expect(ops).toEqual([]);
    });

    it('skips the option table when the stock pass was interrupted', async () => {
        const { db, ops } = createFakeDb([
            withCount(INVESTOR_FLOWS_PRUNE_BATCH_SIZE),
        ]);
        let checks = 0;
        const result = await prunePositionsBefore(
            db,
            '2026-03-31',
            () => checks++ >= 1
        );
        expect(result).toEqual({
            deleted: INVESTOR_FLOWS_PRUNE_BATCH_SIZE,
            done: false,
        });
        expect(ops).toHaveLength(1);
    });

    it('reports not done when the option pass is interrupted', async () => {
        const { db } = createFakeDb([withCount(2)]);
        let checks = 0;
        const result = await prunePositionsBefore(
            db,
            '2026-03-31',
            () => checks++ >= 1
        );
        expect(result).toEqual({ deleted: 2, done: false });
    });

    it('counts a result without a driver count as zero rows', async () => {
        const { db } = createFakeDb([[], []]);
        const result = await prunePositionsBefore(
            db,
            '2026-03-31',
            () => false
        );
        expect(result).toEqual({ deleted: 0, done: true });
    });
});

describe('pruneAggregatesBefore', () => {
    it('sums the stock and option aggregate deletions', async () => {
        const { db, ops } = createFakeDb([withCount(3), withCount(2)]);
        expect(await pruneAggregatesBefore(db, '2023-09-30')).toBe(5);
        expect(renderSql(ops[0]?.target as never)).toEqual({
            text: 'DELETE FROM sec_13f_aggregates WHERE period < $1::date',
            params: ['2023-09-30'],
        });
        expect(renderSql(ops[1]?.target as never)).toEqual({
            text: 'DELETE FROM sec_13f_option_aggregates WHERE period < $1::date',
            params: ['2023-09-30'],
        });
    });
});

describe('pruneFilingsBefore', () => {
    it('returns the deleted ledger row count', async () => {
        const { db, ops } = createFakeDb([withCount(4)]);
        expect(await pruneFilingsBefore(db, '2024-08-01')).toBe(4);
        expect(renderSql(ops[0]?.target as never)).toEqual({
            text: 'DELETE FROM sec_13f_filings WHERE filing_date < $1::date',
            params: ['2024-08-01'],
        });
    });

    it('rejects when the delete fails', async () => {
        const { db } = createFakeDb([new Error('boom')]);
        await expect(pruneFilingsBefore(db, '2024-08-01')).rejects.toThrow(
            'boom'
        );
    });
});
