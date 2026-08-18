import {
    isKrEquitySymbol,
    type AssetClass,
} from '@/shared/config/marketProfile';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';

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
 * 3. 국내 상장 종목이고 이름이 KODEX/TIGER 등 국내 ETF 브랜드로 시작하면 ETF.
 * 4. 이름이 ETF/Fund/Trust/ETN/Index로 끝나면 ETF — KNOWN_ETF_TICKERS
 *    allowlist를 비켜 간 미상장 펀드에 대한 안전망(`isFundShapedName`).
 * 5. 그 외엔 stock으로 default. 일부 ETF가 KNOWN_ETF_TICKERS에 빠져 있고
 *    이름도 유형어로 끝나지 않을 경우 stock으로 오분류될 가능성은 있으나,
 *    가장 거래량 많은 ETF는 모두 포함되어 있어 회귀 영향은 제한적이다.
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

/**
 * 국내 상장 ETF 코드 접두. KRX는 ETF/ETN에 별도 코드 대역을 쓴다 — ETF는 대부분
 * `069500`(KODEX 200)처럼 069/07x/08x 대역이지만 규칙이 완전하지 않아, 접두만으로는
 * 판정하지 않고 이름에 붙는 브랜드로 함께 본다.
 *
 * `KNOWN_ETF_TICKERS`는 미국 티커 allowlist라 KODEX/TIGER가 들어오면 `stock`으로
 * 떨어져 `Corporation` 노드가 붙는다 — 이 함수의 JSDoc이 막으려던 바로 그 오분류다.
 * 지금 `POPULAR_TICKERS`에는 국내 ETF가 없어 발현되지 않지만, 하나 추가되는 순간 샌다.
 */
const KR_ETF_BRAND_PREFIXES = [
    'KODEX',
    'TIGER',
    'KBSTAR',
    'ARIRANG',
    'HANARO',
    'PLUS',
    'RISE',
    'SOL',
    'ACE',
];

/**
 * **선두 토큰만 본다.** 부분 문자열로 찾으면 정상 종목이 ETF로 오분류된다 —
 * `LG UPLUS CORP`가 `PLUS`를, 다른 사명들이 `ACE`·`SOL`을 품는다. 오분류의 대가는
 * `Corporation` about 노드가 통째로 사라지는 것이라 조용하고 되돌리기 어렵다.
 *
 * 선두 토큰이 옳은 판정인 이유: KRX ETF 명명 규약이 `<브랜드> <기초지수>`
 * (`KODEX 200`, `TIGER 미국나스닥100`)로 브랜드를 항상 맨 앞에 둔다.
 */
function isKrEtfName(name: string | undefined): boolean {
    if (!name) return false;
    const firstToken = name.trim().toUpperCase().split(/\s+/)[0] ?? '';
    return KR_ETF_BRAND_PREFIXES.includes(firstToken);
}

/**
 * 영문 펀드형 상품명이 끝나는 유형어. 미국 ETF/ETN/인덱스 펀드는 명명 관행상
 * `<스폰서> <기초지수> ETF/Fund`처럼 상품 유형어를 이름 **끝**에 붙인다
 * (`SPAC and New Issue ETF`, `Vanguard Total Stock Market Index Fund`).
 * `isKrEtfName`이 한국 ETF 브랜드를 맨 **앞** 토큰으로 보는 것과는 반대 위치인데,
 * 명명 관행이 다르므로 검사 위치도 그 관행을 따라간다.
 *
 * **`TRUST`는 일부러 뺐다.** `SPDR Gold Trust`처럼 진짜 펀드도 끝이 `Trust`지만,
 * 미국 리츠가 `Postal Realty Trust`·`Vornado Realty Trust`처럼 같은 형태로 끝나는
 * **실제 상장 기업**이다. 둘을 이름만으로 가를 방법이 없고, 두 오류의 대가가 다르다 —
 * 펀드에 `Corporation` 노드가 붙는 건 눈에 띄고 고치기 쉽지만, 리츠에서 노드가
 * 사라지는 건 조용하고 ISR 창 내내 굳는다(`isKrEtfName` 주석의 같은 판단).
 */
const FUND_NAME_SUFFIX_WORDS = new Set(['ETF', 'FUND', 'ETN', 'INDEX']);

/**
 * **끝 토큰만 본다.** `Northern Trust Corporation`처럼 사명에 유형어가 들어가지만
 * 끝 토큰은 "Corporation"인 진짜 상장사가 있다 — 부분 문자열이나 임의 위치 토큰으로
 * 찾으면 이런 회사가 조용히 ETF로 오분류돼 `Corporation` about 노드가 사라진다.
 * `isKrEtfName`이 부분 문자열 대신 토큰 전체 일치를 쓰는 것과 같은 안전장치를,
 * 위치만 이름 끝으로 바꿔 적용한다.
 *
 * **적용 범위는 영문 이름뿐이다.** 호출부(`buildAssetAboutNode`)는
 * `koreanName ?? name`을 넘기므로, 한글명이 채워진 뒤에는 이 검사가 걸리지 않는다.
 * 즉 이건 큐레이션 목록(`KNOWN_ETF_TICKERS`)을 비켜 간 펀드에 대한 **1차 안전망**이지
 * 항구적 보증이 아니다 — 목록에 없는 펀드가 실제로 문제가 되면 목록에 추가하는 것이
 * 정본이다.
 */
function isFundShapedName(name: string | undefined): boolean {
    if (!name) return false;
    const tokens = name.trim().toUpperCase().split(/\s+/);
    const lastToken = tokens[tokens.length - 1] ?? '';
    return FUND_NAME_SUFFIX_WORDS.has(lastToken);
}

export function classifyAsset(
    symbol: string,
    fmpSymbol?: string,
    name?: string
): AssetCategory {
    if (fmpSymbol?.startsWith('^')) return 'index';
    if (KNOWN_ETF_TICKERS.has(symbol.toUpperCase())) return 'etf';
    if (isKrEquitySymbol(symbol) && isKrEtfName(name)) return 'etf';
    // KNOWN_ETF_TICKERS(60종 allowlist)를 비켜 간 미상장 펀드에 대한 안전망 —
    // SPCX("SPAC and New Issue ETF")가 그 allowlist 밖에서 stock으로 떨어져
    // Corporation 노드를 받았던 사례(SEO 감사 라운드 2 finding 1)의 재발 방지.
    if (isFundShapedName(name)) return 'etf';
    return 'stock';
}

/**
 * schema.org Corporation about-node의 구체 형태. 반환 타입을 named interface로
 * 좁혀 두면 호출자(page.tsx)에서 spread할 때 키 누락/오타가 컴파일 시점에 잡힌다.
 */
export interface CorporationAboutNode extends Record<string, unknown> {
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
    assetClass?: AssetClass
): CorporationAboutNode | undefined {
    // Crypto has no standard schema.org type → omit the about node entirely.
    if (assetClass === 'crypto') return undefined;
    const category = classifyAsset(symbol, fmpSymbol, name);
    if (category !== 'stock') return undefined;
    return {
        '@type': 'Corporation',
        name,
        tickerSymbol: toSchemaTickerSymbol(symbol),
    };
}

/**
 * schema.org `tickerSymbol`은 "거래소 + 종목"을 기대한다(Google이 읽는 통용 형태는
 * `KRX:005930`). `005930.KS`는 yahoo 벤더 규약이라 둘 중 어느 쪽도 아니고, 미국 티커와
 * 달리 실제 종목 코드조차 아니다(`005930`이 코드다). 국내 종목은 이 표기가 "한국 상장"을
 * 알리는 몇 안 되는 구조화 신호이므로 접두를 붙여 준다.
 *
 * 미국 티커는 손대지 않는다 — `AAPL`은 그 자체로 통용 식별자다.
 */
function toSchemaTickerSymbol(symbol: string): string {
    const upper = symbol.toUpperCase();
    if (!isKrEquitySymbol(upper)) return upper;
    return `KRX:${upper.replace(KR_EXCHANGE_SUFFIX_RE, '')}`;
}
