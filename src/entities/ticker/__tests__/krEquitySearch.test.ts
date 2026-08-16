import { describe, it, expect, vi, beforeEach } from 'vitest';

const searchYahooQuotes = vi.fn();

vi.mock('@/shared/api/yahoo/yahooSearch', () => ({
    searchYahooQuotes: (...args: unknown[]) => searchYahooQuotes(...args),
}));

const { searchKrEquity } = await import('../lib/krEquitySearch');

const SAMSUNG = {
    symbol: '005930.KS',
    shortname: 'SamsungElec',
    longname: 'Samsung Electronics Co., Ltd.',
    exchange: 'KSC',
    quoteType: 'EQUITY',
};

describe('searchKrEquity', () => {
    beforeEach(() => searchYahooQuotes.mockReset());

    it('maps a KOSPI hit with the curated Korean name attached', async () => {
        searchYahooQuotes.mockResolvedValue([SAMSUNG]);

        expect(await searchKrEquity('005930')).toEqual([
            {
                symbol: '005930.KS',
                name: 'Samsung Electronics Co., Ltd.',
                exchange: 'KOSPI',
                exchangeFullName: 'Korea Exchange (KOSPI)',
                marketProfile: 'kr-equity',
                koreanName: '삼성전자',
            },
        ]);
    });

    it('derives the exchange from the suffix, not yahoo exchange codes', async () => {
        // yahoo는 KSC/KOE 같은 자체 코드를 쓰고 quote와 search에서 표기가 갈린다.
        searchYahooQuotes.mockResolvedValue([
            {
                symbol: '247540.KQ',
                longname: 'EcoPro BM Co., Ltd.',
                exchange: 'KOE',
            },
        ]);

        const [hit] = await searchKrEquity('247540');
        expect(hit!.exchange).toBe('KOSDAQ');
    });

    it('queries yahoo for English company names', async () => {
        // 이전 구현은 6자리 코드만 통과시켜 "samsung"으로는 국내 종목이 아예 안 나왔다.
        searchYahooQuotes.mockResolvedValue([SAMSUNG]);

        const results = await searchKrEquity('samsung');

        expect(searchYahooQuotes).toHaveBeenCalledWith('samsung');
        expect(results).toHaveLength(1);
    });

    it('skips Korean queries — yahoo rejects them outright', async () => {
        // 실측: BadRequestError: Invalid Search Query. 한글은 korean_tickers가 담당한다.
        expect(await searchKrEquity('삼성전자')).toEqual([]);
        expect(searchYahooQuotes).not.toHaveBeenCalled();
    });

    it('skips single-character and empty queries', async () => {
        expect(await searchKrEquity('a')).toEqual([]);
        expect(await searchKrEquity('   ')).toEqual([]);
        expect(searchYahooQuotes).not.toHaveBeenCalled();
    });

    it('filters out non-KR symbols in the same response', async () => {
        // `005930` 검색에는 크립토 파생(`005930-USD`)이 섞여 온다.
        searchYahooQuotes.mockResolvedValue([
            SAMSUNG,
            { symbol: '005930-USD', longname: 'Samsung (Derivatives) USD' },
            { symbol: 'AAPL', longname: 'Apple Inc.' },
        ]);

        const results = await searchKrEquity('005930');
        expect(results.map(r => r.symbol)).toEqual(['005930.KS']);
    });

    it('replaces a garbled company name with the symbol', async () => {
        searchYahooQuotes.mockResolvedValue([
            {
                symbol: '900140.KQ',
                longname: '900140.KQ,0P0000RVWF,493004',
                shortname: '900140.KQ,0P0000RVWF,493004',
            },
        ]);

        const [hit] = await searchKrEquity('900140');
        expect(hit!.name).toBe('900140.KQ');
    });

    it('omits koreanName for symbols outside the curated catalog', async () => {
        searchYahooQuotes.mockResolvedValue([
            { symbol: '278990.KQ', longname: 'Some Small Cap Inc.' },
        ]);

        const [hit] = await searchKrEquity('278990');
        expect(hit).not.toHaveProperty('koreanName');
    });

    it('degrades to empty when the yahoo search fails', async () => {
        searchYahooQuotes.mockResolvedValue([]);
        expect(await searchKrEquity('005930')).toEqual([]);
    });
});
