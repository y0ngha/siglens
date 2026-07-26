// ingestNewsForSymbol은 ensureNewsCardsAnalyzedAction.ts에서 추출된 FMP fetch +
// DB upsert seam(prewarmNews도 재사용). 의존성 mock 전략은
// ensureNewsCardsAnalyzedAction.test.ts와 동일하게 유지해 두 테스트가 같은
// 로직을 다른 각도(호출부별)에서 검증한다.
vi.mock('../../lib/newsRefreshFlag', () => ({
    isRecentlyFetched: vi.fn(),
    markFetched: vi.fn(),
}));

vi.mock('../../lib/getNewsClient', () => ({
    getNewsClient: vi.fn(),
}));

// getAssetInfo is called by ingestNewsForSymbol (via resolveMarketProfile) to
// resolve news source per asset. Default to equity (no marketProfile).
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn().mockResolvedValue({ symbol: 'AAPL', name: 'Apple' }),
}));

import type { Mock, MockedFunction } from 'vitest';
import type { NewsItem } from '@y0ngha/siglens-core';
import { ingestNewsForSymbol } from '../../lib/ingestNewsForSymbol';
import { getNewsClient } from '../../lib/getNewsClient';
import { markFetched } from '../../lib/newsRefreshFlag';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import type { DrizzleNewsRepository } from '../../api';

const mockGetNewsClient = getNewsClient as Mock;
const mockMarkFetched = markFetched as Mock;
const mockGetAssetInfo = getAssetInfo as MockedFunction<typeof getAssetInfo>;

const NEWS_ITEM_1: NewsItem = {
    id: 'item-001',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://reuters.com/aapl-1',
    publishedAt: '2025-07-01T10:00:00.000Z',
    titleEn: 'Apple Q3 earnings beat',
    bodyEn: 'Apple reported strong Q3 results...',
};

const NEWS_ITEM_2: NewsItem = {
    id: 'item-002',
    symbol: 'AAPL',
    source: 'Bloomberg',
    url: 'https://bloomberg.com/aapl-2',
    publishedAt: '2025-07-02T12:00:00.000Z',
    titleEn: 'Apple launches new iPhone',
    bodyEn: 'Apple announced the new iPhone...',
};

function makeRepo(upsertNewsItem: Mock): DrizzleNewsRepository {
    return { upsertNewsItem } as unknown as DrizzleNewsRepository;
}

describe('ingestNewsForSymbol 함수는', () => {
    let mockFetchNewsForPeriod: Mock;
    let mockUpsertNewsItem: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockMarkFetched.mockResolvedValue(undefined);
        mockGetAssetInfo.mockResolvedValue({ symbol: 'AAPL', name: 'Apple' });

        mockFetchNewsForPeriod = vi.fn();
        mockUpsertNewsItem = vi.fn().mockResolvedValue(true);
        mockGetNewsClient.mockReturnValue({
            fetchNewsForPeriod: mockFetchNewsForPeriod,
        });
    });

    describe('정상 흐름에서', () => {
        it('fetch된 모든 아이템을 upsert하고 markFetched를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            const repo = makeRepo(mockUpsertNewsItem);

            const result = await ingestNewsForSymbol('AAPL', repo);

            expect(mockUpsertNewsItem).toHaveBeenCalledTimes(2);
            expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_1);
            expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_2);
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
            expect(result).not.toBeNull();
            expect(result?.fresh).toEqual([NEWS_ITEM_1, NEWS_ITEM_2]);
            expect(result?.upsertSettled).toHaveLength(2);
        });

        it('뉴스가 없으면 upsert 없이 markFetched만 호출하고 fresh=[]를 반환한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([]);
            const repo = makeRepo(mockUpsertNewsItem);

            const result = await ingestNewsForSymbol('AAPL', repo);

            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
            expect(result).toEqual({ fresh: [], upsertSettled: [] });
        });

        it('crypto 심볼(marketProfile: "crypto")은 getNewsClient를 "crypto"로 호출한다', async () => {
            mockGetAssetInfo.mockResolvedValueOnce({
                symbol: 'BTCUSD',
                name: 'Bitcoin',
                marketProfile: 'crypto',
            });
            mockFetchNewsForPeriod.mockResolvedValue([]);
            const repo = makeRepo(mockUpsertNewsItem);

            await ingestNewsForSymbol('BTCUSD', repo);

            expect(mockGetNewsClient).toHaveBeenCalledWith('crypto');
        });
    });

    describe('FMP fetch 실패 시', () => {
        it('reject하지 않고 null을 반환하며 upsert를 호출하지 않는다', async () => {
            mockFetchNewsForPeriod.mockRejectedValue(
                new Error('FMP network error')
            );
            const repo = makeRepo(mockUpsertNewsItem);

            const result = await ingestNewsForSymbol('AAPL', repo);

            expect(result).toBeNull();
            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
            expect(mockMarkFetched).not.toHaveBeenCalled();
        });

        it('429 실패 시 서버 로그를 남기지 않고 null을 반환한다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockFetchNewsForPeriod.mockRejectedValue(
                new Error('FMP news/stock 429')
            );
            const repo = makeRepo(mockUpsertNewsItem);

            const result = await ingestNewsForSymbol('AAPL', repo);

            expect(result).toBeNull();
            expect(errorSpy).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('upsert 과반 실패 시', () => {
        it('에러를 throw하고 markFetched를 호출하지 않는다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB down'))
                .mockRejectedValueOnce(new Error('DB down'));
            const repo = makeRepo(mockUpsertNewsItem);

            await expect(ingestNewsForSymbol('AAPL', repo)).rejects.toThrow(
                'majority upsert failure'
            );

            expect(mockMarkFetched).not.toHaveBeenCalled();
        });

        it('소수 실패는 throw하지 않고 markFetched까지 진행한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB constraint'))
                .mockResolvedValueOnce(true);
            const repo = makeRepo(mockUpsertNewsItem);

            const result = await ingestNewsForSymbol('AAPL', repo);

            expect(result).not.toBeNull();
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
        });
    });
});
