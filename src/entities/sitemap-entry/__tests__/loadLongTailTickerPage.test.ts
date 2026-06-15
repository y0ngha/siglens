import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDatabaseClientMock, mockDb, sourceLoadPageMock, unstableCacheMock } =
    vi.hoisted(() => ({
        getDatabaseClientMock: vi.fn(),
        mockDb: {},
        sourceLoadPageMock: vi.fn(),
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
            loadPage: sourceLoadPageMock,
        };
    }),
}));

import { unstable_cache } from 'next/cache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleLongTailTickerSource } from '../api';
import { LONGTAIL_TICKERS_PER_PAGE } from '../model';
import { loadLongTailTickerPage } from '../lib/loadLongTailTickerPage';

describe('loadLongTailTickerPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDatabaseClientMock.mockReset();
        sourceLoadPageMock.mockReset();
        unstableCacheMock.mockReset();
        unstableCacheMock.mockImplementation(
            (fn: () => Promise<unknown>) => fn
        );
        getDatabaseClientMock.mockReturnValue({ db: mockDb });
    });

    it('returns the source page result', async () => {
        sourceLoadPageMock.mockResolvedValue(['AAA', 'BBB']);

        await expect(loadLongTailTickerPage(3)).resolves.toEqual([
            'AAA',
            'BBB',
        ]);
    });

    it('separates cache entries by page and uses a 24-hour TTL', async () => {
        sourceLoadPageMock.mockResolvedValue(['AAA']);

        await loadLongTailTickerPage(3);

        expect(unstable_cache).toHaveBeenLastCalledWith(
            expect.any(Function),
            [`sitemap:longtail:page:${LONGTAIL_TICKERS_PER_PAGE}:3`],
            { revalidate: SECONDS_PER_DAY }
        );
    });

    it('loads the requested page with the fixed long-tail page size', async () => {
        sourceLoadPageMock.mockResolvedValue(['AAA']);

        await loadLongTailTickerPage(3);

        expect(getDatabaseClient).toHaveBeenCalledTimes(1);
        expect(DrizzleLongTailTickerSource).toHaveBeenCalledWith(mockDb);
        expect(sourceLoadPageMock).toHaveBeenCalledWith(
            3,
            LONGTAIL_TICKERS_PER_PAGE
        );
        expect(LONGTAIL_TICKERS_PER_PAGE).toBe(10_000);
    });

    it('uses different cache keys for different page numbers', async () => {
        sourceLoadPageMock.mockResolvedValue(['AAA']);

        await loadLongTailTickerPage(1);
        await loadLongTailTickerPage(2);

        expect(unstable_cache).toHaveBeenNthCalledWith(
            1,
            expect.any(Function),
            [`sitemap:longtail:page:${LONGTAIL_TICKERS_PER_PAGE}:1`],
            { revalidate: SECONDS_PER_DAY }
        );
        expect(unstable_cache).toHaveBeenNthCalledWith(
            2,
            expect.any(Function),
            [`sitemap:longtail:page:${LONGTAIL_TICKERS_PER_PAGE}:2`],
            { revalidate: SECONDS_PER_DAY }
        );
    });

    it('propagates DB/source failures', async () => {
        sourceLoadPageMock.mockRejectedValue(new Error('db down'));

        await expect(loadLongTailTickerPage(1)).rejects.toThrow('db down');
    });

    it('propagates database client construction failures', async () => {
        getDatabaseClientMock.mockImplementation(() => {
            throw new Error('missing db config');
        });

        await expect(loadLongTailTickerPage(1)).rejects.toThrow(
            'missing db config'
        );
    });
});
