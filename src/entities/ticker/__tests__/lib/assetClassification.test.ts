import {
    buildAssetAboutNode,
    classifyAsset,
} from '@/entities/ticker/lib/assetClassification';

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

/**
 * schema.org `tickerSymbol`은 "거래소 + 종목"을 기대한다. `005930.KS`는 yahoo 벤더
 * 규약이라 그 형태가 아니고, 미국 티커와 달리 실제 종목 코드조차 아니다(`005930`이 코드).
 * 국내 종목에는 이 필드가 "한국 상장"을 알리는 몇 안 되는 구조화 신호다.
 */
describe('buildAssetAboutNode — 국내 상장 종목', () => {
    it('tickerSymbol을 KRX:<코드> 형태로 낸다', () => {
        const node = buildAssetAboutNode('005930.KS', '삼성전자');
        expect(node).toEqual({
            '@type': 'Corporation',
            name: '삼성전자',
            tickerSymbol: 'KRX:005930',
        });
    });

    it('KOSDAQ도 같은 접두를 쓴다 — 거래소 운영 주체가 KRX로 동일하다', () => {
        expect(
            buildAssetAboutNode('247540.KQ', '에코프로비엠')?.tickerSymbol
        ).toBe('KRX:247540');
    });

    it('미국 티커는 손대지 않는다', () => {
        expect(buildAssetAboutNode('AAPL', 'Apple Inc.')?.tickerSymbol).toBe(
            'AAPL'
        );
    });
});

/**
 * `KNOWN_ETF_TICKERS`는 미국 티커 allowlist다. KODEX/TIGER 같은 국내 ETF가
 * `POPULAR_TICKERS`에 들어오는 순간 `stock`으로 떨어져 `Corporation` 노드가 붙는다 —
 * 이 함수의 JSDoc이 막으려던 바로 그 오분류다. 현재 목록엔 국내 ETF가 없어 잠복 상태다.
 */
describe('classifyAsset — 국내 ETF', () => {
    it('국내 ETF 브랜드명이 붙으면 etf로 분류한다', () => {
        expect(classifyAsset('069500.KS', undefined, 'KODEX 200')).toBe('etf');
        expect(classifyAsset('102110.KS', undefined, 'TIGER 200')).toBe('etf');
    });

    it('etf로 분류되면 Corporation about 노드를 만들지 않는다', () => {
        expect(
            buildAssetAboutNode('069500.KS', 'KODEX 200', undefined)
        ).toBeUndefined();
    });

    it('일반 국내 종목은 그대로 stock이다', () => {
        expect(classifyAsset('005930.KS', undefined, '삼성전자')).toBe('stock');
    });

    it('이름이 없으면 종전대로 stock으로 떨어진다', () => {
        expect(classifyAsset('005930.KS')).toBe('stock');
    });
});
