import {
    findExactUsMatch,
    filterUsExchanges,
    searchByName,
    searchBySymbol,
    toTickerSearchResult,
} from '../../lib/fmpTickerApi';
import type { FmpSearchResult } from '../../model';

const mockFetch = vi.fn();

const apple: FmpSearchResult = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currency: 'USD',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

const tokyoSony: FmpSearchResult = {
    symbol: 'SONY.T',
    name: 'Sony Corp',
    currency: 'JPY',
    exchange: 'TOKYO',
    exchangeFullName: 'Tokyo Stock Exchange',
};

describe('toTickerSearchResult', () => {
    it('FmpSearchResult를 TickerSearchResult 형태로 변환한다 (currency 제거)', () => {
        expect(toTickerSearchResult(apple)).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            exchange: 'NASDAQ',
            exchangeFullName: 'NASDAQ Global Select',
        });
    });
});

describe('filterUsExchanges', () => {
    it('미국 거래소만 남기고 나머지는 제외한다', () => {
        const results = [apple, tokyoSony];
        expect(filterUsExchanges(results)).toEqual([apple]);
    });

    it('NYSE/NASDAQ/AMEX/CBOE/OTC/PNK를 모두 인식한다', () => {
        const inputs: FmpSearchResult[] = (
            ['NYSE', 'NASDAQ', 'AMEX', 'CBOE', 'OTC', 'PNK'] as const
        ).map(exchange => ({ ...apple, exchange }));
        expect(filterUsExchanges(inputs)).toHaveLength(6);
    });
});

describe('searchBySymbol/searchByName', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockReset();
        process.env.FMP_API_KEY = 'test-key';
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete process.env.FMP_API_KEY;
    });

    it('FMP_API_KEY가 없으면 빈 배열을 반환한다', async () => {
        delete process.env.FMP_API_KEY;
        await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
        await expect(searchByName('Apple')).resolves.toEqual([]);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('정상 응답을 그대로 반환한다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple],
        });
        const result = await searchBySymbol('AAPL');
        expect(result).toEqual([apple]);
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('search-symbol');
        expect(url).toContain('query=AAPL');
        expect(url).toContain('apikey=test-key');
    });

    it('search-symbol 질의는 FMP 표기로 정규화한다 (dual-class)', async () => {
        // FMP는 미국 dual-class를 하이픈으로 쓴다. 정규화가 없으면 `BRK.B` 질의가
        // 빈 배열로 돌아와 캐시·DB에 없는 심볼이 영영 404가 된다(2026-07-26 라이브 실측).
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple],
        });
        await searchBySymbol('BRK.B');
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('query=BRK-B');
        expect(url).not.toContain('query=BRK.B');
    });

    it('별칭에 없는 심볼은 그대로 통과시킨다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple],
        });
        await searchBySymbol('AAPL');
        expect(mockFetch.mock.calls[0][0] as string).toContain('query=AAPL');
    });

    it('소문자로 들어와도 별칭이 적용된다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple],
        });
        await searchBySymbol('brk.b');
        expect(mockFetch.mock.calls[0][0] as string).toContain('query=BRK-B');
    });

    it('search-name은 회사명 질의라 별칭을 적용하지 않는다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple],
        });
        await searchByName('BRK.B');
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('query=BRK.B');
    });

    it('search-name은 입력을 그대로 통과시킨다 (대소문자 보존)', async () => {
        // 대문자 입력만 검증하면 `.toUpperCase()`를 되살려도 통과한다 — 소문자로 고정해
        // pass-through를 실제로 falsifiable하게 만든다.
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple],
        });
        await searchByName('brk.b');
        expect(mockFetch.mock.calls[0][0] as string).toContain('query=brk.b');
    });

    it('searchByName은 search-name 엔드포인트를 호출한다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple],
        });
        await searchByName('Apple');
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('search-name');
        expect(url).toContain('query=Apple');
    });

    it('응답이 ok가 아니면 빈 배열을 반환한다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Server Error',
        });
        await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
    });

    it('JSON이 배열이 아니면 빈 배열을 반환한다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ error: 'invalid' }),
        });
        await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
    });

    it('fetch가 throw하면 빈 배열을 반환한다', async () => {
        mockFetch.mockRejectedValueOnce(new Error('network down'));
        await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
    });

    it('필수 필드가 누락된 row 는 검증 단계에서 제외하고 유효한 row 만 반환한다', async () => {
        const malformed = { symbol: 'BAD' }; // missing name/currency/exchange/exchangeFullName
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple, malformed],
        });

        const result = await searchBySymbol('AAPL');

        expect(result).toEqual([apple]);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('dropped 1 malformed FMP row')
        );
        warnSpy.mockRestore();
    });

    describe('throwOnInfraFailure 모드 (getAssetInfo 경로)', () => {
        it('!res.ok(429/5xx)면 throw한다', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 429 });
            await expect(
                searchBySymbol('AAPL', { throwOnInfraFailure: true })
            ).rejects.toThrow();
        });

        it('network/timeout 예외면 throw한다', async () => {
            mockFetch.mockRejectedValue(new Error('network down'));
            await expect(
                searchBySymbol('AAPL', { throwOnInfraFailure: true })
            ).rejects.toThrow();
        });

        it('200 + 빈 배열은 throw하지 않고 [] 반환 (legit no-match)', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => [],
            });
            await expect(
                searchBySymbol('NOPE', { throwOnInfraFailure: true })
            ).resolves.toEqual([]);
        });

        it('lenient(기본값)는 에러 시 여전히 []로 degrade한다', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 500 });
            await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
        });

        it('FMP config 없음이면 throw하고 fetch하지 않는다', async () => {
            delete process.env.FMP_API_KEY;
            await expect(
                searchBySymbol('AAPL', { throwOnInfraFailure: true })
            ).rejects.toThrow();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('200 + 비배열 응답이면 throw한다', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ error: 'invalid' }),
            });
            await expect(
                searchBySymbol('AAPL', { throwOnInfraFailure: true })
            ).rejects.toThrow();
        });

        it('JSON 파싱 실패면 throw한다', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => {
                    throw new Error('invalid json');
                },
            });
            await expect(
                searchBySymbol('AAPL', { throwOnInfraFailure: true })
            ).rejects.toThrow();
        });
    });
});

/**
 * P3 안전망 회귀 가드.
 *
 * `searchBySymbol`이 질의를 FMP 표기로 정규화하므로(`HEI.A` → `HEI-A`) 응답 row도
 * 하이픈 형태다. 앱 표기와 그대로 비교하면 dual-class는 절대 일치하지 않아 안전망이
 * 죽고, FMP가 먼저 준 아무 row가 URL에 묶인다. decoy를 앞에 두어 이를 falsifiable하게
 * 고정한다 — 비교 기준을 앱 표기로 되돌리면 이 테스트가 실패한다.
 */
describe('findExactUsMatch', () => {
    const row = (symbol: string) => ({
        symbol,
        name: symbol,
        currency: 'USD',
        exchange: 'NYSE',
        exchangeFullName: 'New York Stock Exchange',
    });

    it('dual-class는 하이픈 표기로 정확 일치시킨다 (decoy가 앞에 있어도)', () => {
        const results = [row('HEIA'), row('HEI-A')];
        expect(findExactUsMatch(results, 'HEI.A')?.symbol).toBe('HEI-A');
    });

    it('별칭 맵에 있는 심볼도 동일하게 동작한다', () => {
        const results = [row('BRKB'), row('BRK-B')];
        expect(findExactUsMatch(results, 'BRK.B')?.symbol).toBe('BRK-B');
    });

    it('점 없는 심볼은 앱 표기 그대로 정확 일치시킨다', () => {
        const results = [row('AAPLX'), row('AAPL')];
        expect(findExactUsMatch(results, 'AAPL')?.symbol).toBe('AAPL');
    });

    it('정확 일치가 없으면 첫 US row로 폴백한다', () => {
        const results = [row('ZZZ'), row('YYY')];
        expect(findExactUsMatch(results, 'HEI.A')?.symbol).toBe('ZZZ');
    });

    it('빈 결과는 undefined', () => {
        expect(findExactUsMatch([], 'AAPL')).toBeUndefined();
    });
});
