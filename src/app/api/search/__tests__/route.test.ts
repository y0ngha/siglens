const { mockGetClientIp } = vi.hoisted(() => ({ mockGetClientIp: vi.fn() }));
vi.mock('@/shared/api/getClientIp', () => ({ getClientIp: mockGetClientIp }));

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
import {
    SEARCH_REQUESTS_PER_IP_PER_MINUTE,
    searchLimiter,
} from '../searchLimiter';
import { __resetFixedWindowLimiterForTests } from '@/shared/lib/fixedWindowLimiter';
import { UNKNOWN_CLIENT_IP } from '@/shared/api/unknownClientIp';

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
        __resetFixedWindowLimiterForTests(searchLimiter);
        mockGetClientIp.mockResolvedValue('203.0.113.1');
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

    describe('IP별 상한', () => {
        async function exhaust(): Promise<void> {
            for (let i = 0; i < SEARCH_REQUESTS_PER_IP_PER_MINUTE; i++) {
                const res = await GET(request('?q=aapl'));
                expect(res.status).toBe(200);
            }
        }

        it('상한을 넘긴 요청은 검색하지 않고 429 no-store로 거절한다', async () => {
            mockedSearch.mockResolvedValue(RESULTS);
            await exhaust();
            mockedSearch.mockClear();

            const res = await GET(request('?q=aapl'));

            expect(res.status).toBe(429);
            expect(res.headers.get('Cache-Control')).toBe('no-store');
            expect(res.headers.get('Retry-After')).toBe('60');
            expect(mockedSearch).not.toHaveBeenCalled();
        });

        it('한도는 IP마다 따로 센다', async () => {
            mockedSearch.mockResolvedValue(RESULTS);
            await exhaust();

            mockGetClientIp.mockResolvedValue('203.0.113.2');
            const res = await GET(request('?q=aapl'));

            expect(res.status).toBe(200);
        });

        it('창이 지나면 다시 받는다', async () => {
            vi.useFakeTimers();
            try {
                mockedSearch.mockResolvedValue(RESULTS);
                await exhaust();
                expect((await GET(request('?q=aapl'))).status).toBe(429);

                vi.advanceTimersByTime(60_000);

                expect((await GET(request('?q=aapl'))).status).toBe(200);
            } finally {
                vi.useRealTimers();
            }
        });

        it('IP 해석이 실패하면 공용 버킷으로 세고 요청은 처리한다', async () => {
            mockedSearch.mockResolvedValue(RESULTS);
            mockGetClientIp.mockRejectedValue(new Error('headers unavailable'));

            const res = await GET(request('?q=aapl'));

            expect(res.status).toBe(200);
            // 공용 버킷이 실제 키로 쓰였는지 — 같은 버킷을 채우면 막힌다.
            for (let i = 1; i < SEARCH_REQUESTS_PER_IP_PER_MINUTE; i++) {
                searchLimiter.admit(UNKNOWN_CLIENT_IP, Date.now());
            }
            expect((await GET(request('?q=aapl'))).status).toBe(429);
        });
    });
});
