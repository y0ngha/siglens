vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import type { SiglensDatabase, WatchlistItemRecord } from '@/shared/db/types';

const createdAt = new Date('2026-10-09T00:00:00.000Z');

function record(symbol: string): WatchlistItemRecord {
    return {
        id: `row-${symbol}`,
        userId: 'user-1',
        symbol,
        companyName: null,
        createdAt,
    };
}

/** select(...).from(...).where(...) → rows */
function selectChain(rows: unknown[]) {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { select, where };
}

/** insert(...).values(...).onConflictDoNothing(...).returning(...) → rows */
function insertNothingChain(rows: unknown[]) {
    const returning = vi.fn().mockResolvedValue(rows);
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    return { insert, values, onConflictDoNothing, returning };
}

describe('DrizzleWatchlistRepository', () => {
    describe('mergeSymbols', () => {
        it('이미 있는 심볼은 빼고, 상한 안의 새 심볼만 넣고, 초과분을 skipped로 센다', async () => {
            const { select } = selectChain([record('AAPL')]);
            const { insert, values, returning } = insertNothingChain([
                { id: 'a' },
                { id: 'b' },
            ]);
            const db = { select, insert } as unknown as SiglensDatabase;

            const outcome = await new DrizzleWatchlistRepository(
                db
            ).mergeSymbols(
                'user-1',
                [
                    { symbol: 'MSFT', companyName: 'Microsoft Corp.' },
                    { symbol: 'AAPL', companyName: null },
                    { symbol: 'NVDA', companyName: null },
                    { symbol: 'TSLA', companyName: null },
                ],
                3
            );

            // 기존 1 + 신규 2 = 상한 3. TSLA가 밀린다.
            expect(values).toHaveBeenCalledWith([
                {
                    userId: 'user-1',
                    symbol: 'MSFT',
                    companyName: 'Microsoft Corp.',
                },
                { userId: 'user-1', symbol: 'NVDA', companyName: null },
            ]);
            expect(returning).toHaveBeenCalledTimes(1);
            expect(outcome).toEqual({ added: 2, skipped: 1 });
        });

        it('후보가 중복되면 앞의 것만 센다', async () => {
            const { select } = selectChain([]);
            const { insert, values } = insertNothingChain([{ id: 'a' }]);
            const db = { select, insert } as unknown as SiglensDatabase;

            await new DrizzleWatchlistRepository(db).mergeSymbols(
                'user-1',
                [
                    { symbol: 'MSFT', companyName: 'Microsoft' },
                    { symbol: 'MSFT', companyName: null },
                ],
                50
            );

            expect(values).toHaveBeenCalledWith([
                { userId: 'user-1', symbol: 'MSFT', companyName: 'Microsoft' },
            ]);
        });

        it('넣을 것이 없으면 insert하지 않고 { added: 0 }을 돌려준다', async () => {
            const { select } = selectChain([record('AAPL')]);
            const { insert } = insertNothingChain([]);
            const db = { select, insert } as unknown as SiglensDatabase;

            const outcome = await new DrizzleWatchlistRepository(
                db
            ).mergeSymbols(
                'user-1',
                [{ symbol: 'AAPL', companyName: null }],
                50
            );

            expect(insert).not.toHaveBeenCalled();
            expect(outcome).toEqual({ added: 0, skipped: 0 });
        });

        it('유니크 충돌로 DB가 덜 돌려주면 added는 실제 삽입 수다', async () => {
            const { select } = selectChain([]);
            const { insert } = insertNothingChain([{ id: 'a' }]);
            const db = { select, insert } as unknown as SiglensDatabase;

            const outcome = await new DrizzleWatchlistRepository(
                db
            ).mergeSymbols(
                'user-1',
                [
                    { symbol: 'MSFT', companyName: null },
                    { symbol: 'NVDA', companyName: null },
                ],
                50
            );

            expect(outcome).toEqual({ added: 1, skipped: 0 });
        });
    });

    describe('countByUser', () => {
        it('count 행의 value를 숫자로 돌려준다', async () => {
            const { select } = selectChain([{ value: 7 }]);
            const db = { select } as unknown as SiglensDatabase;

            await expect(
                new DrizzleWatchlistRepository(db).countByUser('user-1')
            ).resolves.toBe(7);
        });
    });

    describe('remove', () => {
        it('삭제된 행이 있으면 true', async () => {
            const returning = vi.fn().mockResolvedValue([{ id: 'row' }]);
            const where = vi.fn(() => ({ returning }));
            const del = vi.fn(() => ({ where }));
            const db = { delete: del } as unknown as SiglensDatabase;

            await expect(
                new DrizzleWatchlistRepository(db).remove('user-1', 'AAPL')
            ).resolves.toBe(true);
        });
    });
});
