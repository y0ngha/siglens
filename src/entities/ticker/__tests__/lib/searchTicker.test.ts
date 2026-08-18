import type { CacheProvider } from '@y0ngha/siglens-core';
import type { TickerSearchResult } from '@/shared/lib/types';
import type { FmpSearchResult } from '../../model';

const {
    mockCache,
    createCacheProviderMock,
    searchBySymbolMock,
    searchByNameMock,
    searchByKoreanNameMock,
    getKoreanNamesMock,
    setKoreanTickersMock,
    translateCompanyNamesMock,
    searchKrEquityMock,
} = vi.hoisted(() => ({
    mockCache: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    },
    createCacheProviderMock: vi.fn(),
    searchBySymbolMock: vi.fn(),
    searchByNameMock: vi.fn(),
    searchByKoreanNameMock: vi.fn(),
    getKoreanNamesMock: vi.fn(),
    setKoreanTickersMock: vi.fn(),
    translateCompanyNamesMock: vi.fn(),
    searchKrEquityMock: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    createCacheProvider: () => createCacheProviderMock(),
}));
vi.mock('../../lib/fmpTickerApi', async () => {
    const actual = await vi.importActual('../../lib/fmpTickerApi');
    return {
        ...actual,
        searchBySymbol: (q: string) => searchBySymbolMock(q),
        searchByName: (q: string) => searchByNameMock(q),
    };
});
vi.mock('../../lib/koreanNameStore', () => ({
    searchByKoreanName: (q: string) => searchByKoreanNameMock(q),
    getKoreanNames: (s: string[]) => getKoreanNamesMock(s),
    setKoreanTickers: (entries: unknown[]) => setKoreanTickersMock(entries),
}));
vi.mock('../../lib/koreanTranslator', () => ({
    translateCompanyNames: () => translateCompanyNamesMock(),
}));
// Crypto results are tested separately in searchTicker.crypto.test.ts.
// Equity test cases return [] so the existing equity path is unaffected.
vi.mock('../../lib/cryptoAssetStore', () => ({
    searchCryptoAssets: vi.fn().mockResolvedValue([]),
}));
// 라틴 질의(`lg innotek`)는 yahoo 국내 검색도 함께 태운다 — 목이 없으면 실제 호출로 샌다.
vi.mock('../../lib/krEquitySearch', () => ({
    searchKrEquity: (q: string) => searchKrEquityMock(q),
}));

import {
    _resetInFlightTranslationsForTest,
    searchTicker,
} from '../../lib/searchTicker';

const apple: FmpSearchResult = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currency: 'USD',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

const microsoft: FmpSearchResult = {
    symbol: 'MSFT',
    name: 'Microsoft',
    currency: 'USD',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

describe('searchTicker', () => {
    beforeEach(() => {
        _resetInFlightTranslationsForTest();
        mockCache.get.mockReset();
        mockCache.set.mockReset();
        mockCache.set.mockResolvedValue(undefined);
        createCacheProviderMock.mockReset();
        createCacheProviderMock.mockReturnValue(
            mockCache as unknown as CacheProvider
        );
        searchBySymbolMock.mockReset();
        searchByNameMock.mockReset();
        searchByKoreanNameMock.mockReset();
        getKoreanNamesMock.mockReset();
        getKoreanNamesMock.mockResolvedValue({});
        setKoreanTickersMock.mockReset();
        setKoreanTickersMock.mockResolvedValue(undefined);
        translateCompanyNamesMock.mockReset();
        translateCompanyNamesMock.mockResolvedValue({});
        searchKrEquityMock.mockReset();
        searchKrEquityMock.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    /**
     * [회귀] `삼성전자`는 `005930.KS`(KOSPI 주 상장)와 `SSNLF`(Other OTC, 비후원,
     * 거래 희박)로 둘 다 잡힌다. 둘 다 보여주되 — 의도적으로 OTC를 찾는 사용자를
     * 막지 않는다 — 기본값은 주 상장이어야 한다.
     *
     * 픽스처가 `삼성전자`가 아니라 `011070.KS`인 것은 의도적이다. 삼성전자는
     * `POPULAR_TICKERS`에 있어 `rankByRelevance`의 인기 보너스(+15)만으로도 위로
     * 올라간다 — 그 픽스처로는 정렬 로직을 지워도 테스트가 통과한다.
     */
    it('같은 회사의 KRX 상장을 미국 OTC 중복보다 위에 둔다', async () => {
        searchBySymbolMock.mockResolvedValue([]);
        searchByNameMock.mockResolvedValue([]);
        searchByKoreanNameMock.mockResolvedValue([
            {
                symbol: 'LGINF',
                name: 'LG Innotek Co., Ltd.',
                koreanName: '엘지이노텍',
                exchange: 'OTC',
                exchangeFullName: 'Other OTC',
            },
            {
                symbol: '011070.KS',
                name: 'LG Innotek Co., Ltd.',
                koreanName: '엘지이노텍',
                exchange: 'KOSPI',
                exchangeFullName: 'Korea Exchange (KOSPI)',
            },
        ]);
        getKoreanNamesMock.mockResolvedValue({});

        const results = await searchTicker('엘지이노텍');

        expect(results.map(r => r.symbol)).toEqual(['011070.KS', 'LGINF']);
    });

    it('같은 이름의 KRX 상장이 없으면 OTC를 내리지 않는다', async () => {
        // 강등은 "같은 회사의 주 상장이 이미 목록에 있을 때"만 걸려야 한다 —
        // 무조건 OTC를 뒤로 밀면 OTC만 있는 종목의 순위가 이유 없이 떨어진다.
        searchBySymbolMock.mockResolvedValue([]);
        searchByNameMock.mockResolvedValue([]);
        searchByKoreanNameMock.mockResolvedValue([
            {
                symbol: 'LGINF',
                name: 'LG Innotek Co., Ltd.',
                koreanName: '엘지이노텍',
                exchange: 'OTC',
                exchangeFullName: 'Other OTC',
            },
            {
                symbol: '011070.KS',
                name: 'LG Display Co., Ltd.',
                koreanName: '엘지디스플레이',
                exchange: 'KOSPI',
                exchangeFullName: 'Korea Exchange (KOSPI)',
            },
        ]);
        getKoreanNamesMock.mockResolvedValue({});

        const results = await searchTicker('엘지이노텍');

        expect(results[0]?.symbol).toBe('LGINF');
    });

    /**
     * 라틴 질의(`lg innotek`)는 한글 경로를 타지 않는다 — FMP + yahoo 국내 검색
     * 결과가 합쳐지는 별도 경로다. 두 경로 모두 같은 정렬을 거쳐야 하는데, 한쪽만
     * 테스트하면 나머지 한쪽이 조용히 원래대로 돌아가도 아무도 모른다.
     *
     * 픽스처의 영문명이 서로 **다른** 것도 의도다(`Co., Ltd.` vs `Co Ltd`).
     * 두 행이 서로 다른 제공자에서 오므로 실제로도 영문명이 미묘하게 다르고,
     * 매칭이 한글명 우선이어야 짝을 찾는다.
     */
    it('영문 질의에서도 KRX 상장을 미국 OTC 중복 위에 둔다', async () => {
        searchBySymbolMock.mockResolvedValue([]);
        searchByNameMock.mockResolvedValue([
            {
                symbol: 'LGINF',
                name: 'LG Innotek Co Ltd',
                currency: 'USD',
                exchange: 'OTC',
                exchangeFullName: 'Other OTC',
            },
        ]);
        // KRX 행에 한글명을 **주지 않는다**. 주면 두 행이 한글명으로 짝이 맞아
        // 영문 매칭 경로를 안 타고, 그 경로를 지워도 이 테스트가 통과한다.
        searchKrEquityMock.mockResolvedValue([
            {
                symbol: '011070.KS',
                name: 'LG Innotek Co., Ltd.',
                exchange: 'KOSPI',
                exchangeFullName: 'Korea Exchange (KOSPI)',
            },
        ]);
        getKoreanNamesMock.mockResolvedValue({ LGINF: '엘지이노텍' });
        createCacheProviderMock.mockReturnValue(null);

        const results = await searchTicker('lg innotek');

        expect(results.map(r => r.symbol)).toEqual(['011070.KS', 'LGINF']);
    });

    it('결과가 10개를 넘어도 강등된 OTC를 짝 옆에 붙여 함께 살린다', async () => {
        // 목록 끝으로 밀면 호출부의 slice(0, 10)가 강등이 아니라 **삭제**를 한다.
        // `삼성`처럼 접두가 겹치는 질의는 결과가 쉽게 10개를 넘는다.
        searchBySymbolMock.mockResolvedValue([]);
        searchByNameMock.mockResolvedValue([]);
        const filler = Array.from({ length: 12 }, (_, i) => ({
            symbol: `FILL${i}`,
            name: `엘지 계열사 ${i}`,
            koreanName: `엘지 계열사 ${i}`,
            exchange: 'KOSPI',
            exchangeFullName: 'Korea Exchange (KOSPI)',
        }));
        searchByKoreanNameMock.mockResolvedValue([
            {
                symbol: '011070.KS',
                name: 'LG Innotek Co., Ltd.',
                koreanName: '엘지이노텍',
                exchange: 'KOSPI',
                exchangeFullName: 'Korea Exchange (KOSPI)',
            },
            ...filler,
            {
                symbol: 'LGINF',
                name: 'LG Innotek Co Ltd',
                koreanName: '엘지이노텍',
                exchange: 'OTC',
                exchangeFullName: 'Other OTC',
            },
        ]);
        getKoreanNamesMock.mockResolvedValue({});

        const symbols = (await searchTicker('엘지이노텍')).map(r => r.symbol);

        expect(symbols).toHaveLength(10);
        expect(symbols.indexOf('LGINF')).toBe(symbols.indexOf('011070.KS') + 1);
    });

    // 두 심볼 모두 `POPULAR_TICKERS` 밖이다. 안에 있으면 `rankByRelevance`의
    // 인기 보너스(+15)만으로 위에 올라가, 정렬 로직을 지워도 테스트가 통과한다.
    it.each([['011070.KS'], ['068760.KQ']])(
        '%s — 코스피·코스닥 어느 쪽이든 주 상장으로 인정한다',
        async krxSymbol => {
            searchBySymbolMock.mockResolvedValue([]);
            searchByNameMock.mockResolvedValue([]);
            searchByKoreanNameMock.mockResolvedValue([
                {
                    symbol: 'DUPOTC',
                    name: 'Some Korean Corp',
                    koreanName: '테스트기업',
                    exchange: 'OTC',
                    exchangeFullName: 'Other OTC',
                },
                {
                    symbol: krxSymbol,
                    name: 'Some Korean Corporation',
                    koreanName: '테스트기업',
                    exchange: 'KRX',
                    exchangeFullName: 'Korea Exchange',
                },
            ]);
            getKoreanNamesMock.mockResolvedValue({});

            const results = await searchTicker('테스트기업');

            expect(results.map(r => r.symbol)).toEqual([krxSymbol, 'DUPOTC']);
        }
    );

    it('같은 이름이어도 정규 거래소 상장은 강등하지 않는다', async () => {
        // 강등의 근거는 "중복"이 아니라 "장외 비후원이라 거래가 희박하다"는 것이다.
        // NASDAQ ADR처럼 정규 거래소에 상장된 중복까지 밀면, 그 시장에서 실제로
        // 거래하려는 사용자의 결과를 이유 없이 내리는 셈이 된다.
        searchBySymbolMock.mockResolvedValue([]);
        searchByNameMock.mockResolvedValue([]);
        searchByKoreanNameMock.mockResolvedValue([
            {
                symbol: 'TESTADR',
                name: 'Some Korean Corp',
                koreanName: '테스트기업',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
            },
            {
                symbol: '011070.KS',
                name: 'Some Korean Corp',
                koreanName: '테스트기업',
                exchange: 'KOSPI',
                exchangeFullName: 'Korea Exchange (KOSPI)',
            },
        ]);
        getKoreanNamesMock.mockResolvedValue({});

        const results = await searchTicker('테스트기업');

        expect(results.map(r => r.symbol)).toEqual(['TESTADR', '011070.KS']);
    });

    it('한 KRX 상장에 OTC 중복이 둘이면 셋 다 살아남는다', async () => {
        // 삼성전자는 보통주(SSNLF)와 우선주(SSNNF)로 장외에 둘 다 뜬다. 버킷에
        // 누적하지 않고 덮어쓰면 첫 번째 행은 강등이 아니라 **삭제**된다 —
        // `demoted`에는 들어갔는데 다시 나올 자리가 없어진다.
        searchBySymbolMock.mockResolvedValue([]);
        searchByNameMock.mockResolvedValue([]);
        searchByKoreanNameMock.mockResolvedValue([
            {
                symbol: 'LGINF',
                name: 'LG Innotek Co Ltd',
                koreanName: '엘지이노텍',
                exchange: 'OTC',
                exchangeFullName: 'Other OTC',
            },
            {
                symbol: 'LGINP',
                name: 'LG Innotek Co Ltd Pref',
                koreanName: '엘지이노텍',
                exchange: 'OTC',
                exchangeFullName: 'Other OTC',
            },
            {
                symbol: '011070.KS',
                name: 'LG Innotek Co., Ltd.',
                koreanName: '엘지이노텍',
                exchange: 'KOSPI',
                exchangeFullName: 'Korea Exchange (KOSPI)',
            },
        ]);
        getKoreanNamesMock.mockResolvedValue({});

        const symbols = (await searchTicker('엘지이노텍')).map(r => r.symbol);

        expect(symbols).toEqual(['011070.KS', 'LGINF', 'LGINP']);
    });

    it('빈 query 는 빈 배열 반환', async () => {
        await expect(searchTicker('   ')).resolves.toEqual([]);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('한글 query 는 koreanNameStore 검색 결과를 반환한다', async () => {
        const koreanResults: TickerSearchResult[] = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
            },
        ];
        searchByKoreanNameMock.mockResolvedValue(koreanResults);
        await expect(searchTicker('애')).resolves.toEqual(koreanResults);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('cache hit 시 cached 값을 반환한다', async () => {
        const cached: TickerSearchResult[] = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
            },
        ];
        mockCache.get.mockResolvedValue(cached);
        await expect(searchTicker('AAPL')).resolves.toEqual(cached);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('cache miss 시 FMP 결과를 한국명과 함께 반환한다', async () => {
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([microsoft]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await searchTicker('AAPL');
        expect(result).toEqual([
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
                koreanName: '애플',
            },
            {
                symbol: 'MSFT',
                name: 'Microsoft',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
                koreanName: undefined,
            },
        ]);
        expect(mockCache.set).toHaveBeenCalledWith(
            'ticker:search:v2:aapl',
            result,
            expect.any(Number)
        );
    });

    it('중복 심볼은 제거한다', async () => {
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({});

        const result = await searchTicker('AAPL');
        expect(result).toHaveLength(1);
        expect(result[0].symbol).toBe('AAPL');
    });

    it('한국명 미보유 항목이 있으면 번역을 fire-and-forget 으로 트리거한다', async () => {
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockResolvedValue({ AAPL: '애플' });

        await searchTicker('AAPL');
        expect(translateCompanyNamesMock).toHaveBeenCalledTimes(1);
    });

    it('동시 요청 시 동일한 번역 작업은 single-flight 로 한 번만 호출된다', async () => {
        // C7 single-flight: concurrent searchTicker calls for the same uncached
        // missing-translation set must collapse into one translateCompanyNames
        // invocation. Hold the translate promise open until all callers have
        // attached so the second call sees the in-flight entry.
        let resolveTranslate: (
            value: Record<string, string>
        ) => void = () => {};
        const translatePromise = new Promise<Record<string, string>>(
            resolve => {
                resolveTranslate = resolve;
            }
        );
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockReturnValue(translatePromise);

        const callers = await Promise.all([
            searchTicker('AAPL'),
            searchTicker('AAPL'),
            searchTicker('AAPL'),
            searchTicker('AAPL'),
            searchTicker('AAPL'),
        ]);

        // All callers complete (fire-and-forget translation does not block them)
        expect(callers).toHaveLength(5);
        // Single-flight: only one translateCompanyNames call across 5 callers.
        expect(translateCompanyNamesMock).toHaveBeenCalledTimes(1);

        // Resolve the promise so the .finally cleanup runs before next test.
        resolveTranslate({ AAPL: '애플' });
        await translatePromise;
    });

    it('waitUntil이 제공되면 번역과 캐시 저장 promise를 등록한다', async () => {
        const waitUntil = vi.fn();
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});

        await searchTicker('AAPL', { waitUntil });

        expect(waitUntil).toHaveBeenCalledTimes(2);
        expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
    });

    it('cache provider 가 null 이어도 정상 동작', async () => {
        createCacheProviderMock.mockReturnValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});
        const result = await searchTicker('AAPL');
        expect(result).toHaveLength(1);
    });

    it('cache get 실패 시 fallback 동작', async () => {
        mockCache.get.mockRejectedValue(new Error('cache down'));
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});
        const result = await searchTicker('AAPL');
        expect(result).toHaveLength(1);
    });

    it('US 거래소가 아닌 결과는 제외한다', async () => {
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([{ ...apple, exchange: 'TOKYO' }]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});

        const result = await searchTicker('AAPL');
        expect(result).toEqual([]);
    });

    it('번역 실패 시 경고 로그만 남기고 결과는 정상 반환', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockRejectedValue(
            new Error('translation failed')
        );

        const result = await searchTicker('AAPL');
        expect(result).toHaveLength(1);

        // Wait for fire-and-forget to settle
        await new Promise(resolve => setImmediate(resolve));
        expect(warnSpy).toHaveBeenCalledWith(
            '[searchTicker] background translation failed',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('cache set 실패 시 경고 로그만 남기고 결과는 정상 반환', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockCache.get.mockResolvedValue(null);
        mockCache.set.mockRejectedValue(new Error('cache write failed'));
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await searchTicker('AAPL');
        expect(result).toHaveLength(1);

        // Wait for fire-and-forget to settle
        await new Promise(resolve => setImmediate(resolve));
        expect(warnSpy).toHaveBeenCalledWith(
            '[searchTicker] cache write failed',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('FMP 양쪽 모두 결과가 없으면 빈 배열 반환', async () => {
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});

        const result = await searchTicker('NONEXIST');
        expect(result).toEqual([]);
    });
});
