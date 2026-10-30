vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));
vi.mock('@/shared/cache/contentLocaleKeyPart', () => ({
    contentLocaleKeyPart: (locale: string) => [locale],
}));
vi.mock('@/entities/news-article/api', () => ({
    getNewsList: vi.fn(),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadSymbolNewsList } from '@/app/[locale]/[symbol]/_lib/symbolNewsList';
import { getNewsList } from '@/entities/news-article/api';
import { NEWS_LIST_CACHE_KEY } from '@/entities/news-article/lib/cacheKeys';
import { newsCacheTag } from '@/entities/news-article/lib/newsCacheTag';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';

describe('loadSymbolNewsList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('뉴스·종합 탭이 공유하는 키·태그·TTL로 읽는다', async () => {
        vi.mocked(getNewsList).mockResolvedValue([]);

        await loadSymbolNewsList('AAPL', 'en');

        expect(staticSymbolCache).toHaveBeenCalledWith(
            [NEWS_LIST_CACHE_KEY, 'AAPL', 'en'],
            'AAPL',
            expect.any(Function),
            [newsCacheTag('AAPL')],
            SECONDS_PER_HALF_DAY
        );
        expect(getNewsList).toHaveBeenCalledWith('AAPL', 'en');
    });

    it('목록 읽기가 실패하면 로그를 남기고 빈 목록이다', async () => {
        const error = new Error('db down');
        vi.mocked(getNewsList).mockRejectedValue(error);
        const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(loadSymbolNewsList('MSFT', 'ko')).resolves.toEqual([]);
        expect(logSpy).toHaveBeenCalledWith(
            '[loadSymbolNewsList] getNewsList failed, degrading to []:',
            error
        );
        logSpy.mockRestore();
    });
});
