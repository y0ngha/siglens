import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

import { fmpGet } from '@/shared/api/fmp/httpClient';
import {
    FmpMarketProvider,
    parseAftermarketTrade,
} from '@/shared/api/fmp/FmpMarketProvider';
import aftermarketTradeFixture from './fixtures/aftermarketTrade.aapl.json';
import quoteFixture from './fixtures/quote.aapl.preMarket.json';

const mockFmpGet = vi.mocked(fmpGet);

/** 2026-10-15 07:07:12 ET — 라이브 프로브 1회로 캡처한 실제 형태(fixtures/aftermarketTrade.aapl.json). */
const AAPL_TRADE_MS = 1792062432000;

describe('parseAftermarketTrade', () => {
    it('실제 응답 형태에서 마지막 체결을 뽑는다', () => {
        expect(parseAftermarketTrade(aftermarketTradeFixture)).toEqual({
            price: 346.38,
            tradeSize: 5,
            timestampMs: AAPL_TRADE_MS,
        });
    });

    it('빈 배열은 null이다', () => {
        expect(parseAftermarketTrade([])).toBeNull();
    });

    it.each([
        ['객체', { price: 1, timestamp: 1 }],
        ['null', null],
        ['undefined', undefined],
        ['문자열', 'error'],
    ])('배열이 아닌 응답(%s)은 null이다', (_label, raw) => {
        expect(parseAftermarketTrade(raw)).toBeNull();
    });

    it.each([
        ['첫 행이 null', [null]],
        ['첫 행이 원시값', [42]],
        ['가격이 문자열', [{ price: '346.38', timestamp: AAPL_TRADE_MS }]],
        ['가격이 0', [{ price: 0, timestamp: AAPL_TRADE_MS }]],
        ['가격이 음수', [{ price: -1, timestamp: AAPL_TRADE_MS }]],
        ['가격이 NaN', [{ price: Number.NaN, timestamp: AAPL_TRADE_MS }]],
        ['가격 누락', [{ timestamp: AAPL_TRADE_MS }]],
        ['시각 누락', [{ price: 346.38 }]],
        ['시각이 문자열', [{ price: 346.38, timestamp: '1792062432000' }]],
        ['시각이 0', [{ price: 346.38, timestamp: 0 }]],
    ])('깨진 행(%s)은 null이다', (_label, raw) => {
        expect(parseAftermarketTrade(raw)).toBeNull();
    });

    it('tradeSize가 깨져도 가격과 시각이 유효하면 0으로 채워 살린다', () => {
        expect(
            parseAftermarketTrade([
                { price: 346.38, tradeSize: 'x', timestamp: AAPL_TRADE_MS },
            ])
        ).toEqual({ price: 346.38, tradeSize: 0, timestampMs: AAPL_TRADE_MS });
    });
});

describe('FmpMarketProvider.getExtendedHoursTrade', () => {
    const provider = new FmpMarketProvider();

    beforeEach(() => {
        mockFmpGet.mockReset();
        // 거부형 기본값: 어떤 테스트도 실제 FMP로 새어 나가지 못한다.
        mockFmpGet.mockRejectedValue(new Error('fmpGet must be stubbed'));
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('network must not be used'))
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('aftermarket-trade 한 엔드포인트만, 심볼만 넘겨 호출한다', async () => {
        mockFmpGet.mockResolvedValueOnce(aftermarketTradeFixture);

        const trade = await provider.getExtendedHoursTrade('AAPL');

        expect(trade?.price).toBe(346.38);
        expect(mockFmpGet).toHaveBeenCalledTimes(1);
        expect(mockFmpGet).toHaveBeenCalledWith('aftermarket-trade', {
            symbol: 'AAPL',
        });
    });

    it('호가·거래량(aftermarket-quote)과 배치 변형은 부르지 않는다', async () => {
        mockFmpGet.mockResolvedValueOnce(aftermarketTradeFixture);

        await provider.getExtendedHoursTrade('AAPL');

        const paths = mockFmpGet.mock.calls.map(([path]) => path);
        expect(paths).not.toContain('aftermarket-quote');
        expect(paths.filter(p => p.startsWith('batch'))).toEqual([]);
    });

    it('빈 배열 응답은 null이다', async () => {
        mockFmpGet.mockResolvedValueOnce([]);

        await expect(
            provider.getExtendedHoursTrade('AAPL')
        ).resolves.toBeNull();
    });

    it('조회가 던지면(키 없음·402·429) 경고만 남기고 null이다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockFmpGet.mockRejectedValueOnce(new Error('FMP config missing'));

        await expect(
            provider.getExtendedHoursTrade('AAPL')
        ).resolves.toBeNull();
        expect(warn).toHaveBeenCalledWith(
            '[FmpMarketProvider] aftermarket trade fetch failed:',
            'AAPL',
            expect.any(Error)
        );
    });
});

describe('확장 세션 가격은 정규장 시세 경로에 섞이지 않는다', () => {
    const provider = new FmpMarketProvider();

    beforeEach(() => {
        mockFmpGet.mockReset();
        mockFmpGet.mockRejectedValue(new Error('fmpGet must be stubbed'));
    });

    it('getQuoteSnapshot은 quote 엔드포인트만 부르고, 가격은 /quote 값 그대로다', async () => {
        mockFmpGet.mockResolvedValueOnce(quoteFixture);

        const { quote, todayBar } = await provider.getQuoteSnapshot('AAPL');

        expect(mockFmpGet.mock.calls).toEqual([['quote', { symbol: 'AAPL' }]]);
        expect(quote?.price).toBe(342.96);
        expect(todayBar?.close).toBe(342.96);
    });

    it('일봉 getBars도 aftermarket 엔드포인트를 부르지 않는다', async () => {
        mockFmpGet.mockImplementation(async path =>
            path === 'quote' ? quoteFixture : []
        );

        await provider.getBars({ symbol: 'AAPL', timeframe: '1Day' });

        const paths = mockFmpGet.mock.calls.map(([path]) => path);
        expect(paths.filter(p => p.includes('aftermarket'))).toEqual([]);
    });
});
