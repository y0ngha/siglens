/**
 * 티커가 주식(stock)인지 ETF/지수(non-stock)인지 분류한다.
 *
 * 의도: JSON-LD `about` 블록의 `@type`을 결정하는 안전망 역할.
 * - schema.org Corporation은 "주식회사"를 나타내므로 SPY/QQQ 같은 ETF나
 *   ^SPX 같은 지수에 박으면 잘못된 시그널이 된다. 분류 가능한 경우만
 *   `Corporation`으로 처리하고, 분류 모호하거나 ETF/지수면 about 생략 권장.
 * - schema.org에는 `ExchangeTradedFund`나 `Index`에 해당하는 표준 타입이
 *   없으므로 ETF/Index에 대해서는 about 자체를 두지 않는 것이 가장 안전.
 *
 * 분류 휴리스틱:
 * 1. `fmpSymbol`이 `^`로 시작하면 지수 (예: ^SPX, ^DJI).
 * 2. KNOWN_ETF_TICKERS에 포함되면 ETF — POPULAR_TICKERS와 무관하게
 *    독립 목록을 유지해, 운영용 카테고리 변경이 SEO 분류를 깨지 않게 한다.
 * 3. 그 외엔 stock으로 default. 일부 ETF가 KNOWN_ETF_TICKERS에 빠져 있을
 *    경우 stock으로 오분류될 가능성은 있으나, 가장 거래량 많은 ETF는 모두
 *    포함되어 있어 회귀 영향은 제한적이다.
 */

export type AssetCategory = 'stock' | 'etf' | 'index';

// 거래량 상위 ETF + 섹터 ETF + 레버리지 ETF + 비트코인/이더 spot ETF.
// 신규 ETF가 sitemap에 등장해도 Corporation으로 오분류되지 않도록 보수적으로 확장.
const KNOWN_ETF_TICKERS: ReadonlySet<string> = new Set([
    // Broad market
    'SPY',
    'QQQ',
    'IWM',
    'DIA',
    'VTI',
    'VOO',
    'VEA',
    'VWO',
    'AGG',
    // SPDR sector ETFs
    'XLK',
    'XLF',
    'XLE',
    'XLV',
    'XLI',
    'XLY',
    'XLP',
    'XLB',
    'XLU',
    'XLRE',
    'XLC',
    // Leveraged / inverse
    'TQQQ',
    'SQQQ',
    'SPXL',
    'SPXS',
    'SOXL',
    'SOXS',
    'TNA',
    'TZA',
    'UPRO',
    'SPXU',
    'TSLL',
    'NVDL',
    'LABU',
    'LABD',
    // ARK
    'ARKK',
    'ARKW',
    'ARKQ',
    'ARKG',
    'ARKF',
    // Commodity / fixed income
    'GLD',
    'SLV',
    'USO',
    'UNG',
    'TLT',
    'IEF',
    'SHY',
    // Regional / country
    'EFA',
    'EEM',
    'FXI',
    'EWZ',
    'EWJ',
    // Crypto spot ETFs
    'IBIT',
    'FBTC',
    'BITB',
    'ETHA',
]);

export function classifyAsset(
    symbol: string,
    fmpSymbol?: string
): AssetCategory {
    if (fmpSymbol?.startsWith('^')) return 'index';
    if (KNOWN_ETF_TICKERS.has(symbol.toUpperCase())) return 'etf';
    return 'stock';
}

/**
 * schema.org Corporation about-node의 구체 형태. 반환 타입을 named interface로
 * 좁혀 두면 호출자(page.tsx)에서 spread할 때 키 누락/오타가 컴파일 시점에 잡힌다.
 */
export interface CorporationAboutNode {
    '@type': 'Corporation';
    name: string;
    tickerSymbol: string;
}

/**
 * JSON-LD `about` 블록을 빌드한다. stock으로 분류된 경우만 Corporation
 * 노드를 반환하고, ETF/Index는 `undefined`를 반환해 호출자가 about 자체를
 * 생략하도록 한다. spread 패턴으로 conditional 삽입:
 *
 *     const aboutNode = buildAssetAboutNode(ticker, name, fmpSymbol);
 *     const jsonLd = { ..., ...(aboutNode && { about: aboutNode }) };
 */
export function buildAssetAboutNode(
    symbol: string,
    name: string,
    fmpSymbol?: string,
    assetClass?: import('@/shared/config/marketProfile').AssetClass
): CorporationAboutNode | undefined {
    // Crypto has no standard schema.org type → omit the about node entirely.
    if (assetClass === 'crypto') return undefined;
    const category = classifyAsset(symbol, fmpSymbol);
    if (category !== 'stock') return undefined;
    return {
        '@type': 'Corporation',
        name,
        tickerSymbol: symbol.toUpperCase(),
    };
}
