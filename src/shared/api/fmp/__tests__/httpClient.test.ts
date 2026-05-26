// `sleep` is the only side-effect inside `withRetry`. Stubbing it prevents
// real wall-clock delays and keeps tests synchronous.
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@y0ngha/siglens-core', () => ({
    readFmpConfig: vi.fn(() => ({ apiKey: 'test-fmp-key' })),
}));

import { readFmpConfig } from '@y0ngha/siglens-core';
import { FMP_STABLE_BASE, fmpGet } from '@/shared/api/fmp/httpClient';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';

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
        // Deterministic jitter so delay assertions can be exact.
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function mockOk(body: unknown): void {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => body,
        });
    }

    function mockError(status: number, headers?: Record<string, string>): void {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status,
            headers: new Headers(headers),
        });
    }

    describe('happy path', () => {
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

        it('FMP_STABLE_BASE가 올바른 URL이다', () => {
            expect(FMP_STABLE_BASE).toBe(
                'https://financialmodelingprep.com/stable'
            );
        });
    });

    describe('retry behavior', () => {
        it('429 응답은 maxRetries 횟수만큼 재시도 후 FmpHttpError를 던진다', async () => {
            // maxRetries=3 → 총 4번 호출
            mockError(429);
            mockError(429);
            mockError(429);
            mockError(429);

            await expect(fmpGet('profile')).rejects.toThrow(FmpHttpError);
            expect(mockFetch).toHaveBeenCalledTimes(4);
        });

        it('500 응답 후 재시도에서 성공하면 결과를 반환한다', async () => {
            mockError(500);
            mockOk({ symbol: 'AAPL' });

            const result = await fmpGet('profile');
            expect(result).toEqual({ symbol: 'AAPL' });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('429 with Retry-After header → FmpHttpError.retryAfterSeconds가 설정된다', async () => {
            // Only 1 mock needed since we check the error shape; but withRetry
            // will throw after all retries exhaust — mock all 4 calls.
            mockError(429, { 'Retry-After': '120' });
            mockError(429, { 'Retry-After': '120' });
            mockError(429, { 'Retry-After': '120' });
            mockError(429, { 'Retry-After': '120' });

            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect(error).toBeInstanceOf(FmpHttpError);
            expect((error as FmpHttpError).retryAfterSeconds).toBe(120);
        });

        it('429 without Retry-After header → FmpHttpError.retryAfterSeconds가 null이다', async () => {
            mockError(429);
            mockError(429);
            mockError(429);
            mockError(429);

            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect(error).toBeInstanceOf(FmpHttpError);
            expect((error as FmpHttpError).retryAfterSeconds).toBeNull();
        });
    });

    describe('non-retryable errors', () => {
        it('404 응답은 즉시 FmpHttpError를 던진다 (재시도 없음)', async () => {
            mockError(404);

            await expect(fmpGet('profile')).rejects.toThrow(FmpHttpError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('400 응답은 즉시 FmpHttpError를 던진다 (재시도 없음)', async () => {
            mockError(400);

            await expect(fmpGet('profile')).rejects.toThrow(FmpHttpError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('401 응답은 즉시 FmpHttpError를 던진다 (재시도 없음)', async () => {
            mockError(401);

            await expect(fmpGet('profile')).rejects.toThrow(FmpHttpError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('network errors', () => {
        it('TypeError (fetch failed) 는 재시도된다', async () => {
            mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
            mockOk({ ok: true });

            const result = await fmpGet('profile');
            expect(result).toEqual({ ok: true });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('DOMException (AbortError timeout) 은 재시도된다', async () => {
            mockFetch.mockRejectedValueOnce(
                new DOMException('The operation was aborted', 'AbortError')
            );
            mockOk({ ok: true });

            const result = await fmpGet('profile');
            expect(result).toEqual({ ok: true });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('FmpHttpError shape', () => {
        it('던져진 에러가 FmpHttpError의 인스턴스다', async () => {
            mockError(404);
            await expect(fmpGet('profile')).rejects.toBeInstanceOf(
                FmpHttpError
            );
        });

        it('에러 메시지가 "FMP {path} {status}" 형식이다', async () => {
            mockError(404);
            await expect(fmpGet('profile')).rejects.toThrow('FMP profile 404');
        });

        it('에러가 올바른 status 코드를 가진다', async () => {
            mockError(403);
            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect((error as FmpHttpError).status).toBe(403);
        });

        it('FMP_API_KEY가 없으면 readFmpConfig에서 에러를 던진다 (재시도 안 함)', async () => {
            vi.mocked(readFmpConfig).mockImplementation(() => {
                throw new Error('FMP_API_KEY is required');
            });
            await expect(fmpGet('profile')).rejects.toThrow('FMP_API_KEY');
            // readFmpConfig throws before fetch is called
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('parseRetryAfterSeconds', () => {
        it('"120" → 120으로 파싱한다', async () => {
            mockError(429, { 'Retry-After': '120' });
            mockError(429);
            mockError(429);
            mockError(429);

            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect((error as FmpHttpError).retryAfterSeconds).toBe(120);
        });

        it('non-numeric 문자열 → null 반환', async () => {
            mockError(429, { 'Retry-After': 'tomorrow' });
            mockError(429);
            mockError(429);
            mockError(429);

            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect((error as FmpHttpError).retryAfterSeconds).toBeNull();
        });

        it('"0" → null 반환 (0은 유효하지 않은 delay)', async () => {
            mockError(429, { 'Retry-After': '0' });
            mockError(429);
            mockError(429);
            mockError(429);

            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect((error as FmpHttpError).retryAfterSeconds).toBeNull();
        });

        it('음수 → null 반환', async () => {
            mockError(429, { 'Retry-After': '-5' });
            mockError(429);
            mockError(429);
            mockError(429);

            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect((error as FmpHttpError).retryAfterSeconds).toBeNull();
        });

        it('Retry-After 헤더 없음 → null 반환', async () => {
            mockError(429);
            mockError(429);
            mockError(429);
            mockError(429);

            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect((error as FmpHttpError).retryAfterSeconds).toBeNull();
        });
    });
});
