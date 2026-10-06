import { fetchTickerSearch } from '../fetchTickerSearch';
import type { TickerSearchResult } from '@/shared/lib/types';

const RESULTS: TickerSearchResult[] = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
    },
];

describe('fetchTickerSearch', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('GET /api/search로 다듬고 소문자로 바꾼 질의를 보내고 signal을 넘긴다', async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify(RESULTS), { status: 200 })
        );
        const controller = new AbortController();

        const result = await fetchTickerSearch('  AAPL ', controller.signal);

        expect(result).toEqual(RESULTS);
        expect(fetchMock).toHaveBeenCalledWith('/api/search?q=aapl', {
            signal: controller.signal,
        });
    });

    it('한글 질의는 URL 인코딩해 보낸다', async () => {
        fetchMock.mockResolvedValue(new Response('[]', { status: 200 }));

        await fetchTickerSearch('애플');

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            `/api/search?q=${encodeURIComponent('애플')}`
        );
    });

    it('응답이 실패면 던져서 호출부가 "결과 없음"과 구분하게 한다', async () => {
        fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));

        await expect(fetchTickerSearch('aapl')).rejects.toThrow(/500/);
    });
});
