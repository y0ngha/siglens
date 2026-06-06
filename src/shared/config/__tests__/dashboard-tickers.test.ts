import {
    DASHBOARD_TIMEFRAME_LABELS,
    DASHBOARD_TIMEFRAMES,
    DEFAULT_DASHBOARD_TIMEFRAME,
    isDashboardTimeframe,
    MARKET_INDICES,
    MARKET_SUMMARY_FMP_SYMBOLS,
    SECTOR_ETFS,
    SECTOR_GROUPS,
    SECTOR_STOCKS,
    SIGNAL_SECTORS,
} from '@/shared/config/dashboard-tickers';

describe('MARKET_INDICES', () => {
    it('비어있지 않은 배열이다', () => {
        expect(MARKET_INDICES.length).toBeGreaterThan(0);
    });

    it('각 항목이 symbol, fmpSymbol, displayName, koreanName을 가진다', () => {
        for (const idx of MARKET_INDICES) {
            expect(typeof idx.symbol).toBe('string');
            expect(idx.symbol.length).toBeGreaterThan(0);
            expect(typeof idx.fmpSymbol).toBe('string');
            expect(idx.fmpSymbol.length).toBeGreaterThan(0);
            expect(typeof idx.displayName).toBe('string');
            expect(idx.displayName.length).toBeGreaterThan(0);
            expect(typeof idx.koreanName).toBe('string');
            expect(idx.koreanName.length).toBeGreaterThan(0);
        }
    });

    it('symbol 값에 중복이 없다', () => {
        const symbols = MARKET_INDICES.map(i => i.symbol);
        expect(new Set(symbols).size).toBe(symbols.length);
    });

    it('S&P 500, Dow Jones, NASDAQ, VIX를 포함한다', () => {
        const symbols = MARKET_INDICES.map(i => i.symbol);
        expect(symbols).toContain('GSPC');
        expect(symbols).toContain('DJI');
        expect(symbols).toContain('IXIC');
        expect(symbols).toContain('VIX');
    });
});

describe('SECTOR_ETFS', () => {
    it('비어있지 않은 배열이다', () => {
        expect(SECTOR_ETFS.length).toBeGreaterThan(0);
    });

    it('각 항목이 symbol, sectorName, koreanName을 가진다', () => {
        for (const etf of SECTOR_ETFS) {
            expect(typeof etf.symbol).toBe('string');
            expect(etf.symbol.length).toBeGreaterThan(0);
            expect(typeof etf.sectorName).toBe('string');
            expect(etf.sectorName.length).toBeGreaterThan(0);
            expect(typeof etf.koreanName).toBe('string');
            expect(etf.koreanName.length).toBeGreaterThan(0);
        }
    });

    it('symbol 값에 중복이 없다', () => {
        const symbols = SECTOR_ETFS.map(e => e.symbol);
        expect(new Set(symbols).size).toBe(symbols.length);
    });

    it('11개 GICS 섹터를 포함한다', () => {
        expect(SECTOR_ETFS).toHaveLength(11);
    });
});

describe('SECTOR_GROUPS', () => {
    it('비어있지 않은 배열이다', () => {
        expect(SECTOR_GROUPS.length).toBeGreaterThan(0);
    });

    it('각 그룹이 label과 비어있지 않은 symbols 배열을 가진다', () => {
        for (const group of SECTOR_GROUPS) {
            expect(typeof group.label).toBe('string');
            expect(group.label.length).toBeGreaterThan(0);
            expect(group.symbols.length).toBeGreaterThan(0);
        }
    });

    it('성장, 경기민감, 방어 세 그룹으로 구성된다', () => {
        const labels = SECTOR_GROUPS.map(g => g.label);
        expect(labels).toEqual(['성장', '경기민감', '방어']);
    });

    it('모든 symbols가 SECTOR_ETFS에 존재하는 ETF 심볼이다', () => {
        const etfSymbols = new Set(SECTOR_ETFS.map(e => e.symbol));
        for (const group of SECTOR_GROUPS) {
            for (const symbol of group.symbols) {
                expect(etfSymbols).toContain(symbol);
            }
        }
    });
});

describe('MARKET_SUMMARY_FMP_SYMBOLS', () => {
    it('비어있지 않은 배열이다', () => {
        expect(MARKET_SUMMARY_FMP_SYMBOLS.length).toBeGreaterThan(0);
    });

    it('MARKET_INDICES의 fmpSymbol + SECTOR_ETFS의 symbol을 모두 포함한다', () => {
        const expected = [
            ...MARKET_INDICES.map(i => i.fmpSymbol),
            ...SECTOR_ETFS.map(e => e.symbol),
        ];
        expect([...MARKET_SUMMARY_FMP_SYMBOLS]).toEqual(expected);
    });
});

describe('SECTOR_STOCKS', () => {
    it('비어있지 않은 배열이다', () => {
        expect(SECTOR_STOCKS.length).toBeGreaterThan(0);
    });

    it('각 항목이 symbol, koreanName, sectorSymbol을 가진다', () => {
        for (const stock of SECTOR_STOCKS) {
            expect(typeof stock.symbol).toBe('string');
            expect(stock.symbol.length).toBeGreaterThan(0);
            expect(typeof stock.koreanName).toBe('string');
            expect(stock.koreanName.length).toBeGreaterThan(0);
            expect(typeof stock.sectorSymbol).toBe('string');
            expect(stock.sectorSymbol.length).toBeGreaterThan(0);
        }
    });

    it('symbol 값에 중복이 없다', () => {
        const symbols = SECTOR_STOCKS.map(s => s.symbol);
        expect(new Set(symbols).size).toBe(symbols.length);
    });
});

describe('DASHBOARD_TIMEFRAMES', () => {
    it('비어있지 않은 배열이다', () => {
        expect(DASHBOARD_TIMEFRAMES.length).toBeGreaterThan(0);
    });

    it("'15Min', '1Hour', '1Day'를 포함한다", () => {
        expect([...DASHBOARD_TIMEFRAMES]).toEqual(['15Min', '1Hour', '1Day']);
    });
});

describe('DEFAULT_DASHBOARD_TIMEFRAME', () => {
    it("'1Day'로 설정되어 있다", () => {
        expect(DEFAULT_DASHBOARD_TIMEFRAME).toBe('1Day');
    });

    it('DASHBOARD_TIMEFRAMES에 포함된 값이다', () => {
        expect(DASHBOARD_TIMEFRAMES).toContain(DEFAULT_DASHBOARD_TIMEFRAME);
    });
});

describe('DASHBOARD_TIMEFRAME_LABELS', () => {
    it('모든 DASHBOARD_TIMEFRAMES에 대한 레이블이 존재한다', () => {
        for (const tf of DASHBOARD_TIMEFRAMES) {
            expect(typeof DASHBOARD_TIMEFRAME_LABELS[tf]).toBe('string');
            expect(DASHBOARD_TIMEFRAME_LABELS[tf].length).toBeGreaterThan(0);
        }
    });

    it('한국어 레이블을 반환한다', () => {
        expect(DASHBOARD_TIMEFRAME_LABELS['15Min']).toBe('15분');
        expect(DASHBOARD_TIMEFRAME_LABELS['1Hour']).toBe('1시간');
        expect(DASHBOARD_TIMEFRAME_LABELS['1Day']).toBe('1일');
    });
});

describe('SIGNAL_SECTORS', () => {
    it('SECTOR_ETFS보다 하나 더 많다 (Quantum 가상 섹터)', () => {
        expect(SIGNAL_SECTORS.length).toBe(SECTOR_ETFS.length + 1);
    });

    it('모든 SECTOR_ETFS를 포함한다', () => {
        for (const etf of SECTOR_ETFS) {
            expect(SIGNAL_SECTORS).toContainEqual(etf);
        }
    });

    it('Quantum 가상 섹터를 포함한다', () => {
        const quantum = SIGNAL_SECTORS.find(s => s.symbol === 'QNTM');
        expect(quantum).toBeDefined();
        expect(quantum!.sectorName).toBe('Quantum');
    });
});

describe('isDashboardTimeframe', () => {
    it('(Happy) 모든 DASHBOARD_TIMEFRAMES 값에 대해 true (하드코딩 대신 모듈 export 순회)', () => {
        DASHBOARD_TIMEFRAMES.forEach(tf =>
            expect(isDashboardTimeframe(tf)).toBe(true)
        );
    });

    it('(Edge) 대소문자/미지원/빈값/non-string이면 false', () => {
        expect(isDashboardTimeframe('1day')).toBe(false); // 대소문자 구분
        expect(isDashboardTimeframe('1Week')).toBe(false); // 미지원 tf
        expect(isDashboardTimeframe('5Min')).toBe(false);
        expect(isDashboardTimeframe('')).toBe(false);
        expect(isDashboardTimeframe(null)).toBe(false);
        expect(isDashboardTimeframe(undefined)).toBe(false);
        expect(isDashboardTimeframe(123)).toBe(false);
    });
});
