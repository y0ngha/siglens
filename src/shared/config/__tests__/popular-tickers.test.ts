import {
    POPULAR_TICKERS,
    TICKER_CATEGORIES,
} from '@/shared/config/popular-tickers';

describe('TICKER_CATEGORIES', () => {
    it('비어있지 않은 배열이다', () => {
        expect(TICKER_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('각 카테고리가 id, label, items를 가진다', () => {
        for (const category of TICKER_CATEGORIES) {
            expect(typeof category.id).toBe('string');
            expect(category.id.length).toBeGreaterThan(0);
            expect(typeof category.label).toBe('string');
            expect(category.label.length).toBeGreaterThan(0);
            expect(category.items.length).toBeGreaterThan(0);
        }
    });

    it('카테고리 id 값에 중복이 없다', () => {
        const ids = TICKER_CATEGORIES.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('각 카테고리 내 ticker에 중복이 없다', () => {
        for (const category of TICKER_CATEGORIES) {
            const symbols = category.items.map(i => i.symbol);
            expect(new Set(symbols).size).toBe(symbols.length);
        }
    });

    it('모든 ticker가 비어있지 않은 문자열이다', () => {
        for (const category of TICKER_CATEGORIES) {
            for (const item of category.items) {
                expect(typeof item.symbol).toBe('string');
                expect(item.symbol.length).toBeGreaterThan(0);
                expect(typeof item.name).toBe('string');
                expect(item.name.length).toBeGreaterThan(0);
            }
        }
    });

    it('megacap 카테고리가 존재한다', () => {
        const megacap = TICKER_CATEGORIES.find(c => c.id === 'megacap');
        expect(megacap).toBeDefined();
        const symbols = megacap!.items.map(i => i.symbol);
        expect(symbols).toContain('AAPL');
        expect(symbols).toContain('MSFT');
    });

    it('순수 우주 기업 카테고리를 포함한다', () => {
        const space = TICKER_CATEGORIES.find(c => c.id === 'space');
        expect(space).toBeDefined();
        expect(space!.label).toBe('우주·항공우주');
        expect(space!.items.map(i => i.symbol)).toEqual([
            'SPCX',
            'RKLB',
            'ASTS',
            'LUNR',
            'RDW',
            'PL',
            'SPCE',
        ]);
    });
});

describe('POPULAR_TICKERS', () => {
    it('비어있지 않은 배열이다', () => {
        expect(POPULAR_TICKERS.length).toBeGreaterThan(0);
    });

    it('모든 항목이 비어있지 않은 문자열이다', () => {
        for (const ticker of POPULAR_TICKERS) {
            expect(typeof ticker).toBe('string');
            expect(ticker.length).toBeGreaterThan(0);
        }
    });

    it('중복 값이 없다', () => {
        expect(new Set(POPULAR_TICKERS).size).toBe(POPULAR_TICKERS.length);
    });

    it('대표 메가캡 티커를 포함한다', () => {
        expect(POPULAR_TICKERS).toContain('AAPL');
        expect(POPULAR_TICKERS).toContain('MSFT');
        expect(POPULAR_TICKERS).toContain('NVDA');
        expect(POPULAR_TICKERS).toContain('GOOGL');
        expect(POPULAR_TICKERS).toContain('AMZN');
    });

    it('100개 이상의 티커를 포함한다', () => {
        expect(POPULAR_TICKERS.length).toBeGreaterThanOrEqual(100);
    });
});
