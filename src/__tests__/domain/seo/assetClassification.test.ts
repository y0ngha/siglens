import {
    buildAssetAboutNode,
    classifyAsset,
} from '@/domain/seo/assetClassification';

describe('classifyAsset', () => {
    describe('index 분류', () => {
        it('fmpSymbol이 "^"로 시작하면 index로 분류한다', () => {
            expect(classifyAsset('SPX', '^SPX')).toBe('index');
            expect(classifyAsset('DJI', '^DJI')).toBe('index');
        });

        it('fmpSymbol이 "^"로 시작하면 symbol이 KNOWN_ETF에 있어도 index가 우선이다', () => {
            // 휴리스틱 우선순위: fmpSymbol prefix 검사가 ETF set lookup보다 먼저.
            // 실제로 SPY ETF에는 fmpSymbol "^"가 붙지 않지만 우선순위 검증 목적의 케이스.
            expect(classifyAsset('SPY', '^FAKE')).toBe('index');
        });
    });

    describe('etf 분류', () => {
        it('KNOWN_ETF_TICKERS에 포함된 심볼은 etf로 분류한다', () => {
            expect(classifyAsset('SPY')).toBe('etf');
            expect(classifyAsset('QQQ')).toBe('etf');
            expect(classifyAsset('TQQQ')).toBe('etf');
            expect(classifyAsset('TSLL')).toBe('etf');
        });

        it('소문자/혼합 대소문자 ETF 심볼도 toUpperCase로 정규화해 매칭한다', () => {
            expect(classifyAsset('spy')).toBe('etf');
            expect(classifyAsset('Qqq')).toBe('etf');
        });

        it('fmpSymbol이 없어도 ETF set만으로 분류 가능하다', () => {
            expect(classifyAsset('IBIT')).toBe('etf');
        });
    });

    describe('stock 분류 (default)', () => {
        it('index도 아니고 ETF set에도 없으면 stock으로 default한다', () => {
            expect(classifyAsset('AAPL')).toBe('stock');
            expect(classifyAsset('TSLA')).toBe('stock');
            expect(classifyAsset('NVDA')).toBe('stock');
        });

        it('소문자 stock 심볼도 stock으로 분류한다', () => {
            expect(classifyAsset('aapl')).toBe('stock');
        });

        it('fmpSymbol이 있어도 "^"로 시작하지 않으면 stock으로 default한다', () => {
            expect(classifyAsset('AAPL', 'AAPL.MX')).toBe('stock');
        });
    });
});

describe('buildAssetAboutNode', () => {
    it('stock으로 분류되면 Corporation 노드를 반환한다', () => {
        expect(buildAssetAboutNode('AAPL', '애플')).toEqual({
            '@type': 'Corporation',
            name: '애플',
            tickerSymbol: 'AAPL',
        });
    });

    it('tickerSymbol은 항상 대문자로 출력된다 (소문자 입력도 정규화)', () => {
        expect(buildAssetAboutNode('aapl', '애플')).toEqual({
            '@type': 'Corporation',
            name: '애플',
            tickerSymbol: 'AAPL',
        });
    });

    it('etf로 분류되면 undefined를 반환한다 (Corporation 오분류 방지)', () => {
        expect(buildAssetAboutNode('SPY', 'SPDR S&P 500')).toBeUndefined();
        expect(
            buildAssetAboutNode('TQQQ', 'ProShares UltraPro QQQ')
        ).toBeUndefined();
    });

    it('index로 분류되면 undefined를 반환한다 (Corporation 오분류 방지)', () => {
        expect(buildAssetAboutNode('SPX', 'S&P 500', '^SPX')).toBeUndefined();
    });

    it('stock에 fmpSymbol을 함께 전달해도 정상적으로 Corporation을 반환한다', () => {
        expect(buildAssetAboutNode('AAPL', '애플', 'AAPL')).toEqual({
            '@type': 'Corporation',
            name: '애플',
            tickerSymbol: 'AAPL',
        });
    });
});
