import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDatabaseClientMock, mockDb, sourceCountMock, unstableCacheMock } =
    vi.hoisted(() => ({
        getDatabaseClientMock: vi.fn(),
        mockDb: {},
        sourceCountMock: vi.fn(),
        unstableCacheMock: vi.fn((fn: () => Promise<unknown>) => fn),
    }));

vi.mock('next/cache', () => ({
    unstable_cache: unstableCacheMock,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: getDatabaseClientMock,
}));

vi.mock('../api', () => ({
    DrizzleLongTailTickerSource: vi.fn(function () {
        return {
            count: sourceCountMock,
        };
    }),
}));

import { unstable_cache } from 'next/cache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleLongTailTickerSource } from '../api';
import { countLongTailTickers } from '../lib/countLongTailTickers';

describe('countLongTailTickers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDatabaseClientMock.mockReset();
        sourceCountMock.mockReset();
        unstableCacheMock.mockReset();
        unstableCacheMock.mockImplementation(
            (fn: () => Promise<unknown>) => fn
        );
        getDatabaseClientMock.mockReturnValue({ db: mockDb });
    });

    it('returns the source count result', async () => {
        sourceCountMock.mockResolvedValue(12_345);

        await expect(countLongTailTickers()).resolves.toBe(12_345);
    });

    it('uses the v1 count key and 24-hour revalidation', async () => {
        sourceCountMock.mockResolvedValue(12_345);

        await countLongTailTickers();

        expect(unstable_cache).toHaveBeenLastCalledWith(
            expect.any(Function),
            ['sitemap:longtail:count:v1'],
            { revalidate: SECONDS_PER_DAY }
        );
    });

    it('constructs the long-tail source with the database client', async () => {
        sourceCountMock.mockResolvedValue(12_345);

        await countLongTailTickers();

        expect(getDatabaseClient).toHaveBeenCalledTimes(1);
        expect(DrizzleLongTailTickerSource).toHaveBeenCalledWith(mockDb);
        expect(sourceCountMock).toHaveBeenCalledTimes(1);
    });

    it('propagates DB/source failures', async () => {
        sourceCountMock.mockRejectedValue(new Error('db down'));

        await expect(countLongTailTickers()).rejects.toThrow('db down');
    });

    it('propagates database client construction failures', async () => {
        getDatabaseClientMock.mockImplementation(() => {
            throw new Error('missing db config');
        });

        await expect(countLongTailTickers()).rejects.toThrow(
            'missing db config'
        );
    });
});
