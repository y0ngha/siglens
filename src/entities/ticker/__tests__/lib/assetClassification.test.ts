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

    it('[회귀] 사명에 브랜드명이 부분 문자열로 들어간 종목을 ETF로 보지 않는다', () => {
        // `LG UPLUS`가 `PLUS`를 품는다. 부분 문자열 매칭이면 정상 종목의
        // `Corporation` about 노드가 조용히 사라진다.
        expect(classifyAsset('032640.KS', undefined, 'LG UPLUS CORP')).toBe(
            'stock'
        );
        expect(classifyAsset('005930.KS', undefined, 'SOLUTION ADVANCED')).toBe(
            'stock'
        );
        expect(classifyAsset('000000.KQ', undefined, 'ACEHIGH CO')).toBe(
            'stock'
        );
        expect(buildAssetAboutNode('032640.KS', 'LG UPLUS CORP')).toBeDefined();
    });

    it('이름이 없으면 종전대로 stock으로 떨어진다', () => {
        expect(classifyAsset('005930.KS')).toBe('stock');
    });
});

/**
 * 회귀 가드(SEO 감사 라운드 2 finding 1): `KNOWN_ETF_TICKERS`는 미국 티커
 * allowlist다. SPCX("SPAC and New Issue ETF")처럼 그 목록 밖에 있는 펀드가
 * `POPULAR_TICKERS`에 들어오면 `stock`으로 떨어져 `Corporation` 노드가 붙었다
 * — 실제로 프로덕션에서 발생했던 오분류(SpaceX로 표기됐지만 실제로는 SPAC 펀드).
 */
describe('classifyAsset — 영문 펀드명 접미 안전망', () => {
    it('이름이 ETF/Fund/ETN/Index로 끝나면 etf로 분류한다', () => {
        expect(classifyAsset('SPCX', undefined, 'SPAC and New Issue ETF')).toBe(
            'etf'
        );
        expect(classifyAsset('XYZ1', undefined, 'Example Growth Fund')).toBe(
            'etf'
        );
        expect(classifyAsset('XYZ3', undefined, 'iPath Example ETN')).toBe(
            'etf'
        );
        expect(
            classifyAsset('XYZ4', undefined, 'Vanguard Total Market Index')
        ).toBe('etf');
    });

    /**
     * `TRUST`를 유형어 목록에서 뺀 대가를 명시적으로 고정한다. `SPDR Gold Trust`는
     * 진짜 펀드지만 안전망이 잡지 못하고 `stock`으로 떨어진다 — 미국 리츠가 같은
     * 형태로 끝나는 실제 기업이라 이름만으로 가를 수 없기 때문이다. 이런 펀드는
     * `KNOWN_ETF_TICKERS`에 추가하는 것이 정본 경로다.
     */
    it('Trust로 끝나는 진짜 펀드는 안전망이 잡지 못한다 — allowlist가 정본이다', () => {
        expect(classifyAsset('XYZ2', undefined, 'SPDR Gold Trust')).toBe(
            'stock'
        );
        expect(classifyAsset('GLD', undefined, 'SPDR Gold Trust')).toBe('etf');
    });

    it('대소문자와 무관하게 매칭한다', () => {
        expect(classifyAsset('SPCX', undefined, 'spac and new issue etf')).toBe(
            'etf'
        );
    });

    it('etf로 분류되면 Corporation about 노드를 만들지 않는다', () => {
        expect(
            buildAssetAboutNode('SPCX', 'SPAC and New Issue ETF')
        ).toBeUndefined();
    });

    /**
     * [회귀] 안전망은 **끝 토큰만** 본다. 아무 위치에서나 유형어를 찾으면 사명
     * 중간에 그 단어가 들어간 상장사가 조용히 ETF로 오분류돼 Corporation about
     * 노드가 사라진다.
     *
     * 픽스처는 구성한 이름이다 — `FUND_NAME_SUFFIX_WORDS`의 실제 원소(ETF/FUND/
     * ETN/INDEX)를 중간 토큰으로 가진 상장사가 마땅치 않다. 원소가 아닌 단어를
     * 쓰면(예전 `Northern Trust Corporation`) 어떤 탐색 전략에서도 통과해 이
     * 불변식을 전혀 고정하지 못한다 — `TRUST`가 목록에서 빠진 뒤 실제로 그렇게
     * 됐다(아래 리츠 케이스가 그 규칙을 따로 지킨다).
     */
    it('사명에 유형어가 들어가지만 끝 토큰이 아니면 stock을 유지한다', () => {
        expect(
            classifyAsset('GIP', undefined, 'Global Index Partners Corporation')
        ).toBe('stock');
        expect(
            buildAssetAboutNode('GIP', 'Global Index Partners Corporation')
        ).toEqual({
            '@type': 'Corporation',
            name: 'Global Index Partners Corporation',
            tickerSymbol: 'GIP',
        });
    });

    /**
     * [회귀] 미국 리츠는 `Postal Realty Trust`·`Vornado Realty Trust`처럼 이름이
     * `Trust`로 **끝나는** 실제 상장 기업이다. 안전망이 `TRUST`를 유형어로 잡으면
     * 이들의 Corporation 노드가 통째로 사라지고, ISR이라 그 렌더가 revalidate 창
     * 내내 굳는다. 진짜 펀드(`SPDR Gold Trust`)와 이름만으로는 가를 수 없어
     * `TRUST`를 목록에서 뺐다 — 두 오류 중 조용한 쪽을 피한다.
     */
    it.each([
        ['PSTL', 'Postal Realty Trust'],
        ['VNO', 'Vornado Realty Trust'],
    ])('%s 처럼 Trust로 끝나는 리츠는 stock을 유지한다', (symbol, name) => {
        expect(classifyAsset(symbol, undefined, name)).toBe('stock');
        expect(buildAssetAboutNode(symbol, name)).toEqual({
            '@type': 'Corporation',
            name,
            tickerSymbol: symbol,
        });
    });

    it('이름이 없으면 펀드명 안전망도 no-op이다', () => {
        expect(classifyAsset('AAPL')).toBe('stock');
    });
});
