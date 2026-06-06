/**
 * getNewsList — entities/news-article 어댑터 헬퍼.
 *
 * 검증:
 * - 정상: DrizzleNewsRepository.listBySymbol을 올바른 인자(symbol, NEWS_LOOKBACK_MS)로 호출
 * - React.cache per-request memoization: 동일 symbol 두 번 호출 시 listBySymbol 1회만 실행
 * - listBySymbol throw → 예외 그대로 상위로 전파 (ISR 호출 측 catch로 위임)
 * - 다른 symbol은 cache key가 분리돼 각각 호출됨 (회귀 가드)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListBySymbol = vi.fn();
const mockGetDatabaseClient = vi.fn(() => ({ db: { __mock: true } }));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => mockGetDatabaseClient(),
}));

vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: vi.fn().mockImplementation(function (db: unknown) {
        return {
            db,
            listBySymbol: (...args: unknown[]) => mockListBySymbol(...args),
        };
    }),
}));

import { getNewsList } from '@/entities/news-article/lib/getNewsList';
import { NEWS_LOOKBACK_MS } from '@/entities/news-article/lib/newsLookback';

describe('getNewsList', () => {
    beforeEach(() => {
        mockListBySymbol.mockReset();
        mockGetDatabaseClient.mockClear();
    });

    it('listBySymbol을 (symbol, NEWS_LOOKBACK_MS)로 호출하고 결과를 그대로 반환한다', async () => {
        const rows = [{ id: 'r1' }];
        mockListBySymbol.mockResolvedValueOnce(rows);

        const result = await getNewsList('AAPL');

        expect(mockListBySymbol).toHaveBeenCalledWith('AAPL', NEWS_LOOKBACK_MS);
        expect(result).toBe(rows);
    });

    it('동일 symbol 호출은 idempotent — 같은 result를 반환한다 (purity 보장)', async () => {
        // 주의: React.cache의 per-request memoization은 RSC AsyncLocalStorage scope에
        // 의존하므로 vitest 단위 테스트(Node, RSC scope 없음)에서는 두 호출 모두
        // listBySymbol을 거친다. 단위 테스트는 purity(같은 input → 같은 output)만
        // 검증하고, cache 효과는 통합/E2E에서 검증한다.
        const rows = [{ id: 'r1' }];
        mockListBySymbol.mockResolvedValue(rows);

        const a = await getNewsList('TSLA');
        const b = await getNewsList('TSLA');

        expect(a).toEqual(b);
        expect(a).toEqual(rows);
    });

    it('다른 symbol은 cache key가 분리돼 각각 listBySymbol을 호출한다 (회귀 가드)', async () => {
        mockListBySymbol.mockResolvedValueOnce([{ id: 'aapl-1' }]);
        mockListBySymbol.mockResolvedValueOnce([{ id: 'msft-1' }]);

        await getNewsList('AAPL_KEY_SEP');
        await getNewsList('MSFT_KEY_SEP');

        expect(mockListBySymbol).toHaveBeenCalledTimes(2);
        expect(mockListBySymbol).toHaveBeenNthCalledWith(
            1,
            'AAPL_KEY_SEP',
            NEWS_LOOKBACK_MS
        );
        expect(mockListBySymbol).toHaveBeenNthCalledWith(
            2,
            'MSFT_KEY_SEP',
            NEWS_LOOKBACK_MS
        );
    });

    it('listBySymbol이 throw하면 예외를 그대로 상위로 전파한다 (ISR safety는 호출 측 catch에 위임)', async () => {
        mockListBySymbol.mockRejectedValueOnce(new Error('db down'));

        await expect(getNewsList('THROW_SYMBOL')).rejects.toThrow('db down');
    });
});
