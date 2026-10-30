import type {
    SectorSignalsResult,
    StockSignalResult,
} from '@y0ngha/siglens-core';

/** SSR 크롤 텍스트 계층용 섹터 요약. 신호가 하나라도 있는 섹터 ETF 심볼당 한 건. */
export interface SectorFact {
    /** 섹터 ETF 심볼(예: `'XLK'`). */
    readonly sectorSymbol: string;
    /** 강세 신호가 하나 이상인 종목 수. */
    readonly bullishCount: number;
    /** 약세 신호가 하나 이상인 종목 수. */
    readonly bearishCount: number;
    /** 대표 종목 심볼 최대 3개 — 강세 우선, 그다음 약세 전용, 각 그룹은 알파벳순. */
    readonly topSymbols: readonly string[];
    /**
     * `topSymbols`와 같은 종목·같은 순서에 한글 상수명(`koreanName`)을 붙인 목록. 링크 앵커
     * 텍스트("애플 (AAPL)")를 만드는 데 쓴다 — 티커만 있는 앵커는 검색어와 거리가 멀다.
     */
    readonly topStocks: readonly SectorFactStock[];
}

/** 섹터 요약의 대표 종목 한 건. */
export interface SectorFactStock {
    readonly symbol: string;
    /** 한국어 상수명 — 표시는 호출부가 카탈로그(`useAssetLabel`)로 로케일화한다. */
    readonly koreanName: string;
}

const MAX_TOP_SYMBOLS = 3;

function isBullish(stock: StockSignalResult): boolean {
    return stock.signals.some(s => s.direction === 'bullish');
}

function isBearish(stock: StockSignalResult): boolean {
    return stock.signals.some(s => s.direction === 'bearish');
}

/**
 * `SectorSignalsResult`를 섹터별 요약으로 바꾼다(`SectorFactsSummary`의 SSR SEO 크롤 텍스트용).
 *
 * - 종목을 `sectorSymbol`로 묶는다.
 * - `bullishCount` / `bearishCount`: 각 방향 신호가 하나 이상인 종목 수.
 * - `topSymbols`: 최대 3개, 강세 종목이 먼저이고 그다음 알파벳순.
 * - 종목이 없는 섹터는 생략하고, 빈 입력은 빈 배열을 돌려준다.
 */
export function buildSectorFacts(
    data: SectorSignalsResult
): readonly SectorFact[] {
    if (data.stocks.length === 0) return [];

    // push 누적 없이 O(N)으로 묶는다 — spread 기반 reduce는 O(N²)다.
    // Map.groupBy는 lib: esnext, 런타임 Node 21+ 에서 쓸 수 있다.
    const grouped = Map.groupBy(data.stocks, stock => stock.sectorSymbol);

    const facts = [...grouped].map(([sectorSymbol, stocks]) => {
        const bullishStocks = stocks.filter(isBullish);
        const bearishStocks = stocks.filter(isBearish);
        const bullishCount = bullishStocks.length;
        const bearishCount = bearishStocks.length;

        // 대표 종목: 강세 먼저, 그다음 약세 전용 — 각 그룹은 알파벳순.
        // 환경과 무관하게 순서가 고정되도록 로케일을 'en'으로 못박는다.
        const bySymbol = (a: StockSignalResult, b: StockSignalResult): number =>
            a.symbol.localeCompare(b.symbol, 'en');
        const bullishSorted = bullishStocks.toSorted(bySymbol);
        const bearishOnlySorted = bearishStocks
            .filter(s => !isBullish(s))
            .toSorted(bySymbol);
        const topStocks = [...bullishSorted, ...bearishOnlySorted]
            .slice(0, MAX_TOP_SYMBOLS)
            .map(s => ({ symbol: s.symbol, koreanName: s.koreanName }));
        const topSymbols = topStocks.map(s => s.symbol);

        return {
            sectorSymbol,
            bullishCount,
            bearishCount,
            topSymbols,
            topStocks,
        };
    });

    // 출력 순서를 고정하려고 섹터를 알파벳순(로케일 'en')으로 정렬한다.
    return facts.toSorted((a, b) =>
        a.sectorSymbol.localeCompare(b.sectorSymbol, 'en')
    );
}
