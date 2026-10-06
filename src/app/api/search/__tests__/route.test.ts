import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/entities/ticker/lib/searchTickerQuery', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/entities/ticker/lib/searchTickerQuery')
    >()),
    searchTickerQuery: vi.fn(),
}));

import { GET } from '../route';
import {
    MAX_SEARCH_QUERY_LENGTH,
    searchTickerQuery,
} from '@/entities/ticker/lib/searchTickerQuery';
import type { TickerSearchResult } from '@/shared/lib/types';

const mockedSearch = vi.mocked(searchTickerQuery);

const RESULTS: TickerSearchResult[] = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
    },
];

function request(query: string): Request {
    return new Request(`https://siglens.io/api/search${query}`);
}

describe('GET /api/search', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('질의(q)를 다듬어 검색하고 결과를 JSON으로 낸다', async () => {
        mockedSearch.mockResolvedValue(RESULTS);

        const res = await GET(request('?q=%20aapl%20'));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(RESULTS);
        expect(mockedSearch).toHaveBeenCalledWith('aapl');
    });

    it('브라우저와 CDN이 캐시할 수 있는 공개 캐시 헤더를 단다', async () => {
        mockedSearch.mockResolvedValue(RESULTS);

        const res = await GET(request('?q=aapl'));

        const cacheControl = res.headers.get('Cache-Control') ?? '';
        expect(cacheControl).toContain('public');
        expect(cacheControl).toMatch(/max-age=\d+/);
        expect(cacheControl).toMatch(/s-maxage=\d+/);
    });

    it('q가 없으면 빈 질의로 검색한다(빈 배열은 searchTickerQuery가 결정)', async () => {
        mockedSearch.mockResolvedValue([]);

        const res = await GET(request(''));

        expect(res.status).toBe(200);
        expect(mockedSearch).toHaveBeenCalledWith('');
    });

    it('상한보다 긴 질의는 검색하지 않고 400 no-store로 거절한다', async () => {
        const tooLong = 'a'.repeat(MAX_SEARCH_QUERY_LENGTH + 1);

        const res = await GET(request(`?q=${tooLong}`));

        expect(res.status).toBe(400);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(mockedSearch).not.toHaveBeenCalled();
    });

    it('상한 길이의 질의는 받는다', async () => {
        mockedSearch.mockResolvedValue([]);
        const atLimit = 'a'.repeat(MAX_SEARCH_QUERY_LENGTH);

        const res = await GET(request(`?q=${atLimit}`));

        expect(res.status).toBe(200);
    });

    it('검색이 실패하면 빈 배열이 아니라 500 no-store로 답해 클라이언트가 실패를 구분하게 한다', async () => {
        mockedSearch.mockRejectedValue(new Error('fmp down'));

        const res = await GET(request('?q=aapl'));

        expect(res.status).toBe(500);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(await res.json()).not.toEqual([]);
    });
});
