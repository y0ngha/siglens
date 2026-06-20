import { describe, it, expect, vi } from 'vitest';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';

describe('withConcurrencyLimit', () => {
    it('returns empty array for empty input', async () => {
        const fn = vi.fn(async (x: number) => x * 2);
        const results = await withConcurrencyLimit([], 3, fn);
        expect(results).toEqual([]);
        expect(fn).not.toHaveBeenCalled();
    });

    it('preserves input order in results', async () => {
        const items = [1, 2, 3, 4, 5];
        const results = await withConcurrencyLimit(items, 2, async x => x * 10);
        expect(results).toEqual([
            { status: 'fulfilled', value: 10 },
            { status: 'fulfilled', value: 20 },
            { status: 'fulfilled', value: 30 },
            { status: 'fulfilled', value: 40 },
            { status: 'fulfilled', value: 50 },
        ]);
    });

    it('caps max in-flight concurrency at the given limit', async () => {
        let inFlight = 0;
        let maxObserved = 0;
        const limit = 3;
        const items = Array.from({ length: 9 }, (_, i) => i);

        await withConcurrencyLimit(items, limit, async () => {
            inFlight++;
            maxObserved = Math.max(maxObserved, inFlight);
            // yield so other promises in the same chunk can start
            await Promise.resolve();
            inFlight--;
        });

        expect(maxObserved).toBeLessThanOrEqual(limit);
    });

    it('captures rejected promises as status:rejected without throwing', async () => {
        const err = new Error('boom');
        const results = await withConcurrencyLimit(
            ['a', 'b', 'c'],
            10,
            async item => {
                if (item === 'b') throw err;
                return item.toUpperCase();
            }
        );
        expect(results[0]).toEqual({ status: 'fulfilled', value: 'A' });
        expect(results[1]).toEqual({ status: 'rejected', reason: err });
        expect(results[2]).toEqual({ status: 'fulfilled', value: 'C' });
    });

    it('processes all items when limit equals items.length (single chunk)', async () => {
        const items = [10, 20, 30];
        const results = await withConcurrencyLimit(
            items,
            items.length,
            async x => x + 1
        );
        expect(results.every(r => r.status === 'fulfilled')).toBe(true);
        const values = results.map(
            r => (r as PromiseFulfilledResult<number>).value
        );
        expect(values).toEqual([11, 21, 31]);
    });

    it('processes all items when limit is 1 (sequential)', async () => {
        const order: number[] = [];
        const items = [1, 2, 3];
        await withConcurrencyLimit(items, 1, async x => {
            order.push(x);
        });
        expect(order).toEqual([1, 2, 3]);
    });
});
