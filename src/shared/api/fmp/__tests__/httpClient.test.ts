vi.mock('@y0ngha/siglens-core', () => ({
    readFmpConfig: vi.fn(() => ({ apiKey: 'test-fmp-key' })),
}));

import { readFmpConfig } from '@y0ngha/siglens-core';
import { FMP_STABLE_BASE, fmpGet } from '@/shared/api/fmp/httpClient';

const mockFetch = vi.fn();

describe('FMP_STABLE_BASE', () => {
    it('FMP stable base URL이 정의되어 있다', () => {
        expect(FMP_STABLE_BASE).toBe(
            'https://financialmodelingprep.com/stable'
        );
    });
});

describe('fmpGet', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        mockFetch.mockReset();
        vi.mocked(readFmpConfig).mockReturnValue({ apiKey: 'test-fmp-key' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function mockOk(body: unknown): void {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => body,
        });
    }

    function mockError(status: number): void {
        mockFetch.mockResolvedValueOnce({ ok: false, status });
    }

    it('올바른 URL과 쿼리 파라미터로 fetch를 호출한다', async () => {
        mockOk({ data: 'test' });
        await fmpGet('profile', { symbol: 'AAPL' });

        const calledUrl = mockFetch.mock.calls[0]![0] as string;
        expect(calledUrl).toContain(FMP_STABLE_BASE + '/profile');
        expect(calledUrl).toContain('apikey=test-fmp-key');
        expect(calledUrl).toContain('symbol=AAPL');
    });

    it('query 파라미터 없이도 동작한다', async () => {
        mockOk([]);
        await fmpGet('stock-list');

        const calledUrl = mockFetch.mock.calls[0]![0] as string;
        expect(calledUrl).toContain(FMP_STABLE_BASE + '/stock-list');
        expect(calledUrl).toContain('apikey=test-fmp-key');
    });

    it('응답 JSON을 파싱해서 반환한다', async () => {
        const body = { symbol: 'AAPL', price: 150 };
        mockOk(body);

        const result = await fmpGet<typeof body>('profile');
        expect(result).toEqual(body);
    });

    it('cache: no-store 옵션을 사용한다', async () => {
        mockOk({});
        await fmpGet('profile');

        const options = mockFetch.mock.calls[0]![1] as RequestInit;
        expect(options.cache).toBe('no-store');
    });

    it('AbortSignal timeout을 설정한다', async () => {
        mockOk({});
        await fmpGet('profile');

        const options = mockFetch.mock.calls[0]![1] as RequestInit;
        expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    describe('에러 처리', () => {
        it('4xx 응답 시 에러를 던진다', async () => {
            mockError(404);
            await expect(fmpGet('profile')).rejects.toThrow('FMP profile 404');
        });

        it('5xx 응답 시 에러를 던진다', async () => {
            mockError(500);
            await expect(fmpGet('profile')).rejects.toThrow('FMP profile 500');
        });

        it('FMP_API_KEY가 없으면 readFmpConfig에서 에러를 던진다', async () => {
            vi.mocked(readFmpConfig).mockImplementation(() => {
                throw new Error('FMP_API_KEY is required');
            });
            await expect(fmpGet('profile')).rejects.toThrow('FMP_API_KEY');
        });

        it('fetch가 네트워크 에러를 던지면 전파된다', async () => {
            mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
            await expect(fmpGet('profile')).rejects.toThrow('fetch failed');
        });
    });
});
