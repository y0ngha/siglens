// `sleep` is the only side-effect inside `withRetry`. Stubbing it prevents
// real wall-clock delays and keeps tests synchronous.
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@y0ngha/siglens-core', () => ({
    readFmpConfig: vi.fn(() => ({ apiKey: 'test-fmp-key' })),
}));

import type { MockedFunction } from 'vitest';
import { readFmpConfig } from '@y0ngha/siglens-core';
import { FMP_STABLE_BASE, fmpGet } from '@/shared/api/fmp/httpClient';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';
import { sleep } from '@/shared/lib/sleep';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

const mockFetch = vi.fn();
const sleepMock = sleep as MockedFunction<typeof sleep>;

describe('FMP_STABLE_BASE 상수는', () => {
    it('FMP stable 기본 URL이 정의되어 있다', () => {
        expect(FMP_STABLE_BASE).toBe(
            'https://financialmodelingprep.com/stable'
        );
    });
});

describe('fmpGet 함수는', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        mockFetch.mockReset();
        sleepMock.mockClear();
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

    describe('정상 응답에서는', () => {
        it('올바른 URL과 쿼리 파라미터로 fetch를 호출한다', async () => {
            mockOk({ data: 'test' });
            await fmpGet('profile', { symbol: 'AAPL' });

            const calledUrl = mockFetch.mock.calls[0]![0] as string;
            expect(calledUrl).toContain(FMP_STABLE_BASE + '/profile');
            expect(calledUrl).toContain('apikey=test-fmp-key');
            expect(calledUrl).toContain('symbol=AAPL');
        });

        it('symbol 파라미터를 FMP 표기로 정규화한다 (BRK.B → BRK-B)', async () => {
            mockOk({ data: 'test' });
            await fmpGet('historical-price-eod/full', { symbol: 'BRK.B' });

            const calledUrl = mockFetch.mock.calls[0]![0] as string;
            // URLSearchParams percent-encodes the hyphen-bearing value's `-`? No —
            // `-` is unreserved, so it stays literal; the dot would also be literal.
            expect(calledUrl).toContain('symbol=BRK-B');
            expect(calledUrl).not.toContain('symbol=BRK.B');
        });

        it('alias가 없는 symbol은 그대로 전달한다', async () => {
            mockOk({ data: 'test' });
            await fmpGet('profile', { symbol: 'AAPL' });

            const calledUrl = mockFetch.mock.calls[0]![0] as string;
            expect(calledUrl).toContain('symbol=AAPL');
        });

        it('쿼리 파라미터 없이도 동작한다', async () => {
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

        it('no-store 캐시 옵션을 사용한다', async () => {
            mockOk({});
            await fmpGet('profile');

            const options = mockFetch.mock.calls[0]![1] as RequestInit;
            expect(options.cache).toBe('no-store');
        });

        it('AbortSignal 타임아웃을 설정한다', async () => {
            mockOk({});
            await fmpGet('profile');

            const options = mockFetch.mock.calls[0]![1] as RequestInit;
            expect(options.signal).toBeInstanceOf(AbortSignal);
        });
    });

    describe('재시도 동작에서는', () => {
        it('429 응답은 최대 재시도 횟수만큼 재시도 후 FmpHttpError를 던진다', async () => {
            // maxRetries=3 → 총 4번 호출
            mockError(429);
            mockError(429);
            mockError(429);
            mockError(429);

            await expect(fmpGet('profile')).rejects.toThrow(FmpHttpError);
            expect(mockFetch).toHaveBeenCalledTimes(4);
            expect(sleepMock).toHaveBeenNthCalledWith(1, 10_000);
            expect(sleepMock).toHaveBeenNthCalledWith(2, 15_000);
            expect(sleepMock).toHaveBeenNthCalledWith(3, 20_000);
        });

        it('500 응답 후 재시도에서 성공하면 결과를 반환한다', async () => {
            mockError(500);
            mockOk({ symbol: 'AAPL' });

            const result = await fmpGet('profile');
            expect(result).toEqual({ symbol: 'AAPL' });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('Retry-After 헤더가 있는 429 응답은 FmpHttpError.retryAfterSeconds를 설정한다', async () => {
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

        it('Retry-After 헤더가 없는 429 응답은 FmpHttpError.retryAfterSeconds를 null로 둔다', async () => {
            mockError(429);
            mockError(429);
            mockError(429);
            mockError(429);

            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect(error).toBeInstanceOf(FmpHttpError);
            expect((error as FmpHttpError).retryAfterSeconds).toBeNull();
        });
    });

    describe('재시도하지 않는 오류에서는', () => {
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

        it('402 응답은 비용 예외 서버 로그를 남기고 재시도하지 않는다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockError(402);

            await expect(fmpGet('profile')).rejects.toThrow(FmpHttpError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(errorSpy).toHaveBeenCalledOnce();
            expect(errorSpy.mock.calls[0]?.[0]).toContain(
                'An API requiring a cost exception was called.'
            );
        });
    });

    describe('네트워크 오류에서는', () => {
        it('TypeError fetch 실패는 재시도된다', async () => {
            mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
            mockOk({ ok: true });

            const result = await fmpGet('profile');
            expect(result).toEqual({ ok: true });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('DOMException 타임아웃은 재시도된다', async () => {
            mockFetch.mockRejectedValueOnce(
                new DOMException('The operation was aborted', 'AbortError')
            );
            mockOk({ ok: true });

            const result = await fmpGet('profile');
            expect(result).toEqual({ ok: true });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('FmpHttpError 형태는', () => {
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

        it('에러가 올바른 상태 코드를 가진다', async () => {
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

    describe('parseRetryAfterSeconds 함수는', () => {
        it('"120" → 120으로 파싱한다', async () => {
            mockError(429, { 'Retry-After': '120' });
            mockError(429);
            mockError(429);
            mockError(429);

            const error = await fmpGet('profile').catch((e: unknown) => e);
            expect((error as FmpHttpError).retryAfterSeconds).toBe(120);
        });

        it('숫자가 아닌 문자열은 null을 반환한다', async () => {
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

        it.each(['', 'Infinity', 'NaN', 'tomorrow'])(
            '유효하지 않은 Retry-After "%s" → null 반환',
            async value => {
                mockError(429, { 'Retry-After': value });
                mockError(429);
                mockError(429);
                mockError(429);

                const error = await fmpGet('profile').catch((e: unknown) => e);
                expect((error as FmpHttpError).retryAfterSeconds).toBeNull();
            }
        );
    });

    describe('잘못된 JSON 본문에서는', () => {
        it('SyntaxError는 재시도 대상이 아니므로 즉시 던진다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => {
                    throw new SyntaxError('Unexpected token');
                },
            });

            await expect(fmpGet('profile')).rejects.toThrow(SyntaxError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('캐시 옵션에서는', () => {
        it('revalidate 지정 시 next.revalidate 사용', async () => {
            const fetchMock = vi
                .spyOn(global, 'fetch')
                .mockResolvedValue(
                    new Response(JSON.stringify([]), { status: 200 })
                );
            await fmpGet(
                'profile',
                { symbol: 'AAPL' },
                { revalidate: SECONDS_PER_HOUR }
            );
            expect(fetchMock.mock.calls[0]![1]).toMatchObject({
                next: { revalidate: SECONDS_PER_HOUR },
            });
            fetchMock.mockRestore();
        });
    });
});

// 2026-07-26 관측성 개선 회귀 가드(감사 재검토 #1).
// 402가 3,014건 찍혔는데 심볼 귀속이 없어 조치 자체가 불가능했다. 이 스레딩이
// 조용히 사라지면(예: 4번째 인자 누락, `?? query.symbols` 제거) 전체 스위트는
// 그대로 통과하면서 다음 402 폭주가 다시 추적 불가능해진다.
describe('fmpGet 오류의 심볼 귀속은', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        mockFetch.mockReset();
        vi.mocked(readFmpConfig).mockReturnValue({ apiKey: 'test-fmp-key' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('query.symbol을 오류에 실어 메시지와 필드로 노출한다', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 402,
            headers: { get: () => null },
        });

        await expect(
            fmpGet('historical-price-eod/full', { symbol: 'AAPL' })
        ).rejects.toMatchObject({ symbol: 'AAPL', status: 402 });
    });

    it('뉴스 엔드포인트의 symbols(복수) 파라미터도 귀속한다', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 402,
            headers: { get: () => null },
        });

        // pre-warm이 뉴스를 적재하면서 밤마다 불리는 경로 — 폴백이 없으면
        // 하필 이 호출만 `FMP news/crypto 402`로 남아 조치가 불가능해진다.
        const err = await fmpGet('news/crypto', {
            symbols: 'BTCUSD',
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(FmpHttpError);
        expect((err as FmpHttpError).symbol).toBe('BTCUSD');
        expect((err as Error).message).toBe('FMP news/crypto 402 (BTCUSD)');
    });

    it('심볼이 없는 엔드포인트는 기존 메시지 형식을 유지한다', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 402,
            headers: { get: () => null },
        });

        const err = await fmpGet('economic-indicators', {}).catch(
            (e: unknown) => e
        );

        expect((err as FmpHttpError).symbol).toBeNull();
        expect((err as Error).message).toBe('FMP economic-indicators 402');
    });
});
