import { describe, expect, it, vi } from 'vitest';
import type { AggregateRecord } from '../../lib/snapshot/institutional';
import { resolveHoldersPeriod } from '../../server/resolveHoldersPeriod';

const aggregate = (period: string): AggregateRecord => ({
    period,
    holders: 1,
    shares: 1,
    valueUsd: 1,
    newHolders: 0,
    increased: 0,
    decreased: 0,
    exited: 0,
    netShareChange: 0,
});

describe('resolveHoldersPeriod', () => {
    const fallback = (value: string | null) =>
        vi.fn(async (): Promise<string | null> => value);

    it('picks the newest COMPLETE quarter (deadline 45 days + 5 grace passed)', async () => {
        // 2026-09-30 + 50 days = 2026-11-19 < 2026-11-21: complete.
        const reads = { findLatestPositionPeriod: fallback('1999-12-31') };
        expect(
            await resolveHoldersPeriod(
                reads,
                'C1',
                [aggregate('2026-06-30'), aggregate('2026-09-30')],
                '2026-11-21'
            )
        ).toBe('2026-09-30');
        expect(reads.findLatestPositionPeriod).not.toHaveBeenCalled();
    });

    it('skips an in-progress quarter and takes the previous complete one', async () => {
        // On 2026-11-10 the 09-30 quarter is still filing (until 11-19).
        const reads = { findLatestPositionPeriod: fallback('1999-12-31') };
        expect(
            await resolveHoldersPeriod(
                reads,
                'C1',
                [aggregate('2026-09-30'), aggregate('2026-06-30')],
                '2026-11-10'
            )
        ).toBe('2026-06-30');
    });

    it('falls back to the newest quarter that has positions when no complete one is kept', async () => {
        const reads = { findLatestPositionPeriod: fallback('2026-09-30') };
        expect(
            await resolveHoldersPeriod(
                reads,
                'C1',
                [aggregate('2026-09-30')],
                '2026-11-10'
            )
        ).toBe('2026-09-30');
        expect(reads.findLatestPositionPeriod).toHaveBeenCalledWith('C1');
    });

    it('ignores a complete aggregate older than the retention floor (its positions are pruned)', async () => {
        // floor on 2026-11-21 = 2026-06-30; the 03-31 aggregate has no positions left.
        const reads = { findLatestPositionPeriod: fallback(null) };
        expect(
            await resolveHoldersPeriod(
                reads,
                'C1',
                [aggregate('2026-03-31')],
                '2026-11-21'
            )
        ).toBeNull();
        expect(reads.findLatestPositionPeriod).toHaveBeenCalledOnce();
    });

    it('no aggregates at all falls back to the positions table', async () => {
        const reads = { findLatestPositionPeriod: fallback('2026-06-30') };
        expect(await resolveHoldersPeriod(reads, 'C1', [], '2026-11-21')).toBe(
            '2026-06-30'
        );
    });
});
