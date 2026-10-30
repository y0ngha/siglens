import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { type AssetClass } from '@/shared/config/marketProfile/types';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';
import { brandTitle } from '@/shared/lib/brandName';
import { SITE_URL, type SeoTranslator } from '@/shared/lib/seo';
import {
    clampSeoDescription,
    clampSeoTitle,
    SEO_TITLE_MAX_WIDTH,
    seoTitleWidth,
} from '@/shared/lib/seoClamp';

/**
 * 자기 SEO 카피 빌더를 가진 탭. 일곱 스냅샷 탭은 `SeoSnapshotTab`
 * (`entities/seo-snapshot`)을 그대로 따르는데 `shared`는 그것을 import할 수 없다 —
 * 빌더가 여기 있으므로 유니온도 여기서 선언하고 엔티티 값이 흘러 들어온다.
 * `technical`은 차트 라우트(종목 루트)이며 카피는 기본 {@link buildSymbolSeoContent}다.
 *
 * `fear-greed`는 스냅샷 탭이 아니지만 자기 제목 카피가 있다. 여기 없으면 점수가 안 나와
 * noindex로 막힌 공포·탐욕 페이지가 차트 탭 제목을 그대로 써 한 종목에 같은 title이
 * 두 개가 된다(2026-10-05 운영 재크롤: TOSCF·SLROF). 스냅샷 탭과 갈라야 하는 곳은
 * `isSeoSnapshotTab`(entities/seo-snapshot)으로 거른다.
 *
 * `position`도 같은 이유로 들어 있다 — 차단 메타가 차트 탭 카피를 쓰면 `/{symbol}`과
 * `/{symbol}/position`이 같은 title·description을 낸다(네이버 중복 감지와 같은 부류).
 */
export type SymbolSeoTab =
    | 'technical'
    | 'overall'
    | 'fundamental'
    | 'financials'
    | 'congress'
    | 'flows'
    | 'news'
    | 'options'
    | 'fear-greed'
    | 'position';

/**
 * 색인되는 `[symbol]` 탭(= `ALWAYS_NOINDEX_TAB_ROBOTS`를 쓰지 않는 탭). 차트(`technical`)·뉴스·
 * 공포탐욕 세 개다.
 *
 * 항상-noindex 탭으로 가는 링크는 크롤 예산만 쓰고 색인 신호를 만들지 못한다 — 그런 링크를 내는
 * 곳(카드 그리드 등)이 이 목록으로 대상을 좁힌다. 탭을 다시 열 때는 `ALWAYS_NOINDEX_TAB_ROBOTS`와
 * sitemap 빌더에 더해 여기에도 추가한다.
 */
export const INDEXABLE_SYMBOL_TABS = [
    'technical',
    'news',
    'fear-greed',
] as const satisfies readonly SymbolSeoTab[];

/**
 * 탭별 `titleCore` 카탈로그 키 — 자산군 분기가 있는 탭만 `crypto`를 갖는다.
 *
 * `SYMBOL_SEO_TAB_BUILDERS`/`resolveSymbol*SeoContent`가 제목을 만들 때 쓰는
 * 키와 **같은 값**이어야 한다. 어긋나면 description 프리픽스가 제목과 다른
 * 말을 하게 되므로, `__tests__/symbolTabDescriptionLabel.test.ts`가 탭×자산군 전수로
 * "제목이 라벨을 포함한다"를 단언해 드리프트를 막는다.
 */
const SYMBOL_TAB_LABEL_KEYS: Record<
    SymbolSeoTab,
    { readonly equity: string; readonly crypto?: string }
> = {
    technical: {
        equity: 'symbol.chart.titleCore',
        crypto: 'symbol.crypto.titleCore',
    },
    overall: {
        equity: 'symbol.overall.titleCore',
        crypto: 'symbol.cryptoOverall.titleCore',
    },
    fundamental: { equity: 'symbol.fundamental.titleCore' },
    financials: { equity: 'symbol.financials.titleCore' },
    congress: { equity: 'symbol.congress.titleCore' },
    flows: { equity: 'symbol.flows.titleCore' },
    news: {
        equity: 'symbol.news.titleCore',
        crypto: 'symbol.cryptoNews.titleCore',
    },
    options: { equity: 'symbol.options.titleCore' },
    // 크립토 빌더도 같은 키를 쓴다(`buildCryptoSymbolFearGreedSeoContent`).
    'fear-greed': { equity: 'symbol.fearGreed.titleCore' },
    // position 제목은 `{훅} — {주어} {라벨}` 꼴이라 titleCore 대신 브레드크럼 라벨이 그 자리다.
    position: { equity: 'position.breadcrumb' },
};

/**
 * `<meta name="description">` 프리픽스에 쓰는 탭 라벨 — `주가 분석`, `펀더멘털`처럼
 * 제목의 `titleCore`와 같은 말이다.
 *
 * **왜 필요한가 (2026-09-20 네이버 중복 감지)**: 스냅샷 파생 description은 AI 산문의
 * 앞머리를 잘라 쓰는데, 한 종목의 두 탭이 같은 도입 문장으로 시작하면(ETF·인버스처럼
 * "이게 무슨 상품인지"로 여는 종목) 클램프 지점 전에 갈라지지 않아 **완전히 같은
 * 문자열**이 된다. 실측: `/SOXS/overall`과 `/SOXS/fundamental`이 193자까지 동일했고
 * 둘 다 `index, follow`였다. 프리픽스에 탭 라벨을 넣으면 충돌이 구조적으로 불가능하다.
 */
export function symbolTabDescriptionLabel(
    tab: SymbolSeoTab,
    assetClass: AssetClass,
    t: SeoTranslator
): string {
    const keys = SYMBOL_TAB_LABEL_KEYS[tab];
    return t(
        assetClass === 'crypto' && keys.crypto ? keys.crypto : keys.equity
    );
}

type SymbolSeoBuilder = (
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions
) => SymbolSeoContent;

/**
 * 탭×자산군 → SEO 카피 빌더. `SYMBOL_TAB_LABEL_KEYS`와 같은 모양(크립토 변형이 있는
 * 탭만 `crypto`)이라 두 테이블의 분기가 한눈에 대응된다.
 *
 * `resolveSymbol*SeoContent`와 `noindexSymbolMetadata`가 **이 테이블 하나로** 자산군을
 * 고른다. 예전에는 차단 메타 경로만 equity 빌더를 고정으로 써서, 크립토의 차단된 탭이
 * `시세` 대신 `주가`/`Stock` 카피를 냈다(CONVENTIONS.md#CS-5 — 같은 규칙을 형제 경로 하나에만 적용).
 */
const SYMBOL_SEO_TAB_BUILDERS: Record<
    SymbolSeoTab,
    { readonly equity: SymbolSeoBuilder; readonly crypto?: SymbolSeoBuilder }
> = {
    technical: {
        equity: buildSymbolSeoContent,
        crypto: buildCryptoSymbolSeoContent,
    },
    overall: {
        equity: buildSymbolOverallSeoContent,
        crypto: buildCryptoSymbolOverallSeoContent,
    },
    fundamental: { equity: buildSymbolFundamentalSeoContent },
    financials: { equity: buildSymbolFinancialsSeoContent },
    congress: { equity: buildSymbolCongressSeoContent },
    flows: { equity: buildSymbolFlowsSeoContent },
    news: {
        equity: buildSymbolNewsSeoContent,
        crypto: buildCryptoSymbolNewsSeoContent,
    },
    options: { equity: buildSymbolOptionsSeoContent },
    'fear-greed': {
        equity: buildSymbolFearGreedSeoContent,
        crypto: buildCryptoSymbolFearGreedSeoContent,
    },
    position: { equity: buildSymbolPositionSeoContent },
};

/** 탭·자산군에 맞는 빌더로 SEO 카피를 만든다 — 크립토 변형이 없는 탭은 equity 빌더를 쓴다. */
export function buildSymbolTabSeoContent(
    tab: SymbolSeoTab,
    symbol: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const builders = SYMBOL_SEO_TAB_BUILDERS[tab];
    const build =
        assetClass === 'crypto' && builders.crypto
            ? builders.crypto
            : builders.equity;
    return build(symbol, t, opts);
}

/**
 * title 전용 짧은 주어 — `애플(AAPL)`.
 *
 * `buildDisplayName`(`애플, Apple Inc. (AAPL)`, 21자·23 폭단위)은 H1·본문용이라
 * title에는 너무 길다. title 예산 58~60 폭단위 중 23 폭단위를 주어에 쓰면
 * 검색 의도를 드러낼 자리가 남지 않는다.
 *
 * `entities/ticker`가 아니라 여기 두는 이유: 12개 SEO 빌더가 전부
 * `BuildSymbolSeoOptions`(또는 이를 extends한 타입)를 받고 그 안에 `koreanName`이
 * 이미 있다. 여기서 파생하면 호출부 시그니처를 하나도 바꾸지 않는다.
 *
 * 중복 판정(`koreanName`이 티커와 사실상 같은 값)은 대소문자를 무시한다
 * (`kr.toUpperCase() !== upper`) — 티커 레이어의 나머지 비교도 전부
 * 대소문자 무시다(`searchTickerQuery.ts`의 `.toLowerCase()`, `api.ts`의
 * SQL `lower(...)`). `ticker`가 빈 문자열이면 `koreanName`만 반환해
 * `'애플()'` 같은 빈 괄호 출력을 막는다.
 *
 * 이 함수는 trim과 대소문자 무시 중복 제거를 적용하지만, 형제 키워드
 * 빌더(`buildSymbolKeywords` 등)는 `koreanName`을 truthy 체크만 거쳐
 * 원시값 그대로 보간한다 — 의도적 비대칭이다. `keywords` 메타 태그는
 * 2009년경부터 Google·Naver 모두 무시하므로, 그쪽을 맞춰 고치는 것은
 * 낭비다.
 */
export function buildTitleSubject(ticker: string, koreanName?: string): string {
    const upper = titleTicker(ticker);
    const kr = koreanName?.trim();
    if (!kr) return upper;
    if (!upper) return kr;
    if (kr.toUpperCase() === upper) return upper;
    // 이름이 이미 `)`로 끝나면(`삼성전자우(보통주)` 류) 괄호가 겹쳐 `이름(보통주)(CODE)`가
    // 된다 — 공백으로 이어 괄호 한 쌍만 남긴다.
    if (kr.endsWith(')')) return `${kr} ${upper}`;
    return `${kr}(${upper})`;
}

/**
 * title에 노출할 티커 표기. 국내 상장 종목은 거래소 접미사(`.KS`/`.KQ`)를 뗀다.
 *
 * 접미사는 yahoo 벤더 규약이고 한국 검색량이 0이다 — 실제로 검색되는 건 단축코드(`005930`)다.
 * 반면 폭 예산은 3단위를 먹어서, 실측상 KR 타이틀 120개(20종목 × 6탭) 중 21개가
 * 서술 tail을 떨어뜨리고 있었고 그중 15개가 접미사만 빼면 되살아난다.
 *
 * **표기에만 적용한다.** canonical·URL·라우팅·JSON-LD 식별자는 접미사가 있어야
 * 종목을 특정할 수 있으므로 그대로 둔다.
 */
function titleTicker(ticker: string): string {
    const upper = ticker.toUpperCase();
    return isKrEquitySymbol(upper)
        ? upper.replace(KR_EXCHANGE_SUFFIX_RE, '')
        : upper;
}

/** `composeSymbolTitle` 입력. 모든 탭 빌더가 같은 형태로 제목을 조립하게 한다. */
export interface ComposeSymbolTitleArgs {
    ticker: string;
    koreanName?: string;
    /** 비-기본 로케일에서 `koreanName` 자리에 들어간다. */
    englishName?: string;
    /** 생략하면 기본 로케일로 본다 — 한국어명을 그대로 노출한다. */
    locale?: Locale;
    /** 검색 매칭을 만드는 키워드. 티커를 줄여서라도 보존한다 — `core` 자체가 예산(55 폭단위)을
     *  넘지 않는 한 잘리지 않는다. 예: `공포 탐욕 지수` */
    core: string;
    /** 예산이 남을 때만 붙는 서술. 가장 먼저 버려진다. 예: `차트·기술적 신호` */
    tail?: string;
}

/**
 * 심볼 title을 예산 안에서 조립한다 — 3단으로 물러난다.
 *
 * 1. `한국어명(TICKER) core — tail`
 * 2. `한국어명(TICKER) core`            tail을 버린다
 * 3. `TICKER core — tail` 또는 `TICKER core`   한국어명을 버린다
 *
 * **버리는 순서가 설계의 핵심이다.** 검색 매칭을 만드는 건 `주가 분석`·`공포 탐욕 지수`
 * 같은 core이지 뒤의 서술이 아니다. 단순 클램프(뒤에서 자르기)를 쓰면 긴 한국어명을 가진
 * 종목에서 core가 통째로 날아간다 — 실측상 264개 중 90개(34%)가 그 경우였다.
 *
 * 3단까지 가는 종목은 실측 2개뿐이다(NVDL 47, LABU 42 폭단위). 둘 다 레버리지 ETF로
 * 한국어명이 서술적이고(`그래닛셰어스 2배 레버리지 NVDA 데일리 ETF`) 실제 검색어는
 * 티커다. 그래서 이 경우 한국어명을 **자르지 않고 버린다** — 중간에 잘린 이름은
 * SERP에서 읽히지 않는 데다 검색어와도 맞지 않는다.
 */
export function composeSymbolTitle(args: ComposeSymbolTitleArgs): string {
    const { ticker, core, tail } = args;
    /**
     * 비-기본 로케일에서는 **한국어명을 title에 넣지 않는다.**
     *
     * 이 함수는 21개 빌더가 공유하므로 여기서 한 번에 거른다 — 빌더마다
     * 고치면 하나만 빠뜨려도 그 탭만 조용히 한국어 제목으로 남는다.
     * `/en/AAPL`이 `애플(AAPL) Stock Forecast …`로 나가던 결함이다.
     *
     * `keywords`는 대상이 아니다 — ko 전용 데이터로 정했다.
     */
    // 이름이 로케일을 타므로 `koreanName`이라는 이름은 더 이상 맞지 않다.
    const titleName =
        args.locale === undefined || args.locale === DEFAULT_LOCALE
            ? args.koreanName
            : args.englishName;
    const withTail = (subject: string) =>
        tail ? `${subject} ${core}: ${tail}` : `${subject} ${core}`;
    const fits = (t: string) => seoTitleWidth(t) <= SEO_TITLE_MAX_WIDTH;

    const subject = buildTitleSubject(ticker, titleName);
    const full = withTail(subject);
    if (fits(full)) return full;

    const coreOnly = `${subject} ${core}`;
    if (fits(coreOnly)) return coreOnly;

    /**
     * 이름을 통째로 버리기 전에 **법인 접미사만** 떼어 본다.
     *
     * 폭 예산(55)은 한글 기준으로 잡혔고 라틴 문자는 1단위라, 영문 법인명은
     * `Samsung Electronics Co., Ltd.(005930)`처럼 쉽게 37단위를 먹는다. 그래서
     * 국내 종목의 비-ko 제목이 8개 탭 중 4개에서 `005930 Overall Analysis`가
     * 됐다 — 숫자만 남는 제목이다. `Apple Inc.`처럼 짧은 이름으로만 검증해서
     * 처음엔 못 봤다.
     *
     * `Co., Ltd.`·`Inc.`·`Corp.` 같은 접미사는 검색어에도 안 쓰이고 화면에서
     * 읽히지도 않는다 — 이름 자체를 버리는 것보다 이걸 먼저 버린다.
     */
    const shortName = titleName?.replace(
        /[,]?\s*(?:Co\.?,?\s*Ltd\.?|Corporation|Corp\.?|Incorporated|Inc\.?|Limited|Ltd\.?|PLC|S\.A\.|AG|NV|SE)\s*$/i,
        ''
    );
    if (shortName && shortName !== titleName) {
        const shortSubject = buildTitleSubject(ticker, shortName);
        const shortFull = withTail(shortSubject);
        if (fits(shortFull)) return shortFull;
        const shortCore = `${shortSubject} ${core}`;
        if (fits(shortCore)) return shortCore;
    }

    const bare = buildTitleSubject(ticker);
    const coreSuffix = ` ${core}`;
    const bareFull = withTail(bare);
    if (fits(bareFull)) return bareFull;

    // 마지막 방어선: core는 그대로 두고 티커 쪽만 줄인다. `clampSeoTitle`을 전체
    // 문자열에 걸면 뒤에서부터 자르므로 core가 깎인다 — 3단 설계의 목적이 무너진다.
    const tickerBudget = SEO_TITLE_MAX_WIDTH - seoTitleWidth(coreSuffix);
    return `${clampSeoTitle(bare, tickerBudget)}${coreSuffix}`;
}

function buildSymbolDescription(
    t: SeoTranslator,
    displayName: string,
    sector?: string
): string {
    return sector
        ? t('symbol.chart.descriptionWithSector', {
              subject: displayName,
              sector,
          })
        : t('symbol.chart.description', { subject: displayName });
}

/** 종목 페이지 한 탭의 SEO 카피 묶음 — 페이지의 metadata와 JSON-LD가 소비한다. */
export interface SymbolSeoContent {
    ticker: string;
    title: string;
    fullTitle: string;
    description: string;
    url: string;
    keywords: string[];
}

/** 탭 SEO 빌더들이 공유하는 선택 입력. */
export interface BuildSymbolSeoOptions {
    /** 해석된 표시명(예: "애플, Apple Inc. (AAPL)"). 없으면 티커를 쓴다. */
    displayName?: string;
    /** 한국어 회사명. 있으면 키워드 집합이 확장된다. */
    koreanName?: string;
    /**
     * 영문 법인명. **비-기본 로케일 title에서 한국어명을 대신한다.**
     *
     * 없으면 title은 티커만 남는다 — 국내 종목에서는 그게
     * `005930 Stock Forecast — Chart & Trading Signals`처럼 **숫자만 덩그러니**
     * 남는 제목이 된다. 같은 페이지 `<h1>`은
     * `Samsung Electronics Co., Ltd. (005930.KS)`로 제대로 나오는데도.
     */
    englishName?: string;
    /**
     * URL 로케일. 비-기본 로케일이면 **title에서 한국어명을 뺀다**
     * (`keywords`는 ko 전용이라 영향 없음).
     */
    locale?: Locale;
    /** 섹터명(영문, FMP 형식 — 예: "Technology"). 있으면 description에 녹인다. */
    sector?: string;
}

/** 주식·ETF·지수 차트(`/[symbol]`) 페이지의 SEO 카피(주가 프레임). */
export function buildSymbolSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.chart.titleCore'),
        tail: t('symbol.chart.titleTail'),
    });
    const displayName = opts.displayName ?? ticker;
    return {
        ticker,
        title,
        fullTitle: brandTitle(title, opts.locale ?? DEFAULT_LOCALE),
        description: clampSeoDescription(
            buildSymbolDescription(t, displayName, opts.sector)
        ),
        url: `${SITE_URL}/${ticker}`,
        keywords: buildSymbolKeywords(ticker, displayName, opts.koreanName),
    };
}

function buildSymbolKeywords(
    ticker: string,
    displayName: string,
    koreanName?: string
): string[] {
    return [
        `${ticker} 주가`,
        `${ticker} 차트`,
        `${ticker} 차트 분석`,
        `${ticker} 기술적 신호`,
        `${ticker} 기술적 분석`,
        `${ticker} AI 분석`,
        `${displayName} 주가 분석`,
        `${displayName} 차트 분석`,
        `${ticker} chart analysis`,
        ...(koreanName
            ? [`${koreanName} 주가`, `${koreanName} 차트 분석`]
            : []),
    ];
}

/** `/[symbol]/financials` 페이지의 SEO 카피. */
export function buildSymbolFinancialsSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.financials.titleCore'),
        tail: t('symbol.financials.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolFinancialsDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/financials`,
        keywords: buildSymbolFinancialsKeywords(upper, opts.koreanName),
    };
}

function buildSymbolFinancialsDescription(
    t: SeoTranslator,
    subject: string
): string {
    return t('symbol.financials.description', { subject });
}

function buildSymbolFinancialsKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} 재무제표`,
        `${ticker} 손익계산서`,
        `${ticker} 재무상태표`,
        `${ticker} 현금흐름표`,
        `${ticker} 매출 성장`,
        `${ticker} 영업이익`,
        `${ticker} 재무 분석`,
        ...(koreanName
            ? [
                  `${koreanName} 재무제표`,
                  `${koreanName} 손익계산서`,
                  `${koreanName} 재무 분석`,
                  `${koreanName} 현금흐름`,
              ]
            : []),
        '재무제표 분석',
        '손익계산서',
        '재무상태표',
        '현금흐름표',
        '매출 성장',
        '영업이익',
        '순이익',
        '재무 건전성',
    ];
}

/** `/[symbol]/congress` 페이지의 SEO 카피. */
export function buildSymbolCongressSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.congress.titleCore'),
        tail: t('symbol.congress.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolCongressDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/congress`,
        keywords: buildSymbolCongressKeywords(upper, opts.koreanName),
    };
}

function buildSymbolCongressDescription(
    t: SeoTranslator,
    subject: string
): string {
    // 공시지연 ~45일은 STOCK Act 규정상 거래일로부터 신고 마감까지의 최대치다.
    return t('symbol.congress.description', { subject });
}

function buildSymbolCongressKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} 의회 거래`,
        `${ticker} 의원 매매`,
        `${ticker} 상원 의원 매매`,
        `${ticker} 하원 의원 매매`,
        `${ticker} 정치인 매매`,
        `${ticker} 공시`,
        ...(koreanName
            ? [
                  `${koreanName} 의회 거래`,
                  `${koreanName} 의원 매매`,
                  `${koreanName} 정치인 매매`,
              ]
            : []),
        '의회 거래',
        '의원 매매',
        '상원 의원 매매',
        '하원 의원 매매',
        '정치인 주식 매매',
        'STOCK Act',
        '의회 공시',
    ];
}

/** Build SEO metadata for the `/[symbol]/flows` (기관·내부자·공매도 수급) page. */
export function buildSymbolFlowsSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    // 한국 종목의 수급 탭은 DART 지분공시(대량보유·임원 소유보고)다 — 13F·공매도 카피를 쓰지 않는다.
    const kr = isKrEquitySymbol(upper);
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: kr ? t('symbol.flows.krTitleCore') : t('symbol.flows.titleCore'),
        tail: kr ? t('symbol.flows.krTitleTail') : t('symbol.flows.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            kr
                ? t('symbol.flows.krDescription', { subject })
                : t('symbol.flows.description', { subject })
        ),
        url: `${SITE_URL}/${upper}/flows`,
        keywords: kr
            ? buildKrSymbolFlowsKeywords(upper, opts.koreanName)
            : buildSymbolFlowsKeywords(upper, opts.koreanName),
    };
}

function buildKrSymbolFlowsKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    // KRX 티커(`005930.KS`)는 아무도 검색하지 않는 형태라 단축코드와 한글명을 쓴다.
    const code = ticker.replace(KR_EXCHANGE_SUFFIX_RE, '');
    return [
        code,
        `${code} 대량보유`,
        `${code} 지분 공시`,
        ...(koreanName
            ? [
                  `${koreanName} 대량보유`,
                  `${koreanName} 지분 변동`,
                  `${koreanName} 임원 지분`,
                  `${koreanName} 주요주주`,
              ]
            : []),
        '대량보유 보고',
        '임원 소유 보고',
        '거래계획 보고서',
        'DART 지분공시',
    ];
}

function buildSymbolFlowsKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} 수급`,
        `${ticker} 기관 매수`,
        `${ticker} 기관 보유`,
        `${ticker} 공매도`,
        `${ticker} 내부자 거래`,
        ...(koreanName
            ? [
                  `${koreanName} 수급`,
                  `${koreanName} 기관 매수`,
                  `${koreanName} 공매도`,
              ]
            : []),
        '기관 수급',
        '13F',
        '공매도 잔고',
        '내부자 거래',
        '대량보유',
    ];
}

/** `/[symbol]/fundamental` 페이지의 SEO 카피. */
export function buildSymbolFundamentalSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.fundamental.titleCore'),
        tail: t('symbol.fundamental.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolFundamentalDescription(t, subject, opts.sector)
        ),
        url: `${SITE_URL}/${upper}/fundamental`,
        keywords: buildSymbolFundamentalKeywords(
            upper,
            opts.sector,
            opts.koreanName
        ),
    };
}

function buildSymbolFundamentalDescription(
    t: SeoTranslator,
    subject: string,
    sector?: string
): string {
    return sector
        ? t('symbol.fundamental.descriptionWithSector', { subject, sector })
        : t('symbol.fundamental.description', { subject });
}

function buildSymbolFundamentalKeywords(
    ticker: string,
    sector?: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} 펀더멘털 분석`,
        `${ticker} 재무 분석`,
        `${ticker} 밸류에이션`,
        `${ticker} 애널리스트 컨센서스`,
        ...(koreanName
            ? [
                  `${koreanName} 펀더멘털`,
                  `${koreanName} 재무 분석`,
                  `${koreanName} 밸류에이션`,
              ]
            : []),
        ...(sector ? [`${sector} 섹터 펀더멘털`] : []),
        '펀더멘털 분석',
        'PER',
        'PSR',
        'EPS',
        'ROE',
        '재무 건전성',
        '애널리스트 컨센서스',
    ];
}

/** 옵션 탭 전용 입력 — 공통 옵션에 옵션 시장 유무를 더한다. */
export interface BuildSymbolOptionsSeoOptions extends BuildSymbolSeoOptions {
    /**
     * `false`일 때 옵션 시장이 없는 종목으로 안내한다. metadata에서 robots를
     * noindex로 떨어뜨리는 신호로도 사용된다.
     */
    hasOptions?: boolean;
}

/** `/[symbol]/options` 페이지의 SEO 카피. */
export function buildSymbolOptionsSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolOptionsSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const subject = opts.displayName ?? upper;
    const hasOptions = opts.hasOptions ?? true;
    const title = hasOptions
        ? composeSymbolTitle({
              ticker: upper,
              koreanName: opts.koreanName,
              englishName: opts.englishName,
              locale: opts.locale,
              core: t('symbol.options.titleCore'),
              tail: t('symbol.options.titleTail'),
          })
        : composeSymbolTitle({
              ticker: upper,
              koreanName: opts.koreanName,
              englishName: opts.englishName,
              locale: opts.locale,
              core: t('symbol.options.titleCore'),
          });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            hasOptions
                ? t('symbol.options.description', { subject })
                : t('symbol.options.descriptionNoMarket', { subject })
        ),
        url: `${SITE_URL}/${upper}/options`,
        keywords: buildSymbolOptionsKeywords(upper, opts.koreanName),
    };
}

function buildSymbolOptionsKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        `${ticker} 옵션`,
        `${ticker} 옵션 분석`,
        `${ticker} Max Pain`,
        `${ticker} Put Call Ratio`,
        `${ticker} Open Interest`,
        `${ticker} Implied Volatility`,
        ...(koreanName
            ? [
                  `${koreanName} 옵션`,
                  `${koreanName} 옵션 시장`,
                  `${koreanName} 옵션 분석`,
              ]
            : []),
        '옵션 분석',
        '옵션 시장',
        'Max Pain',
        'Put/Call Ratio',
        'Implied Volatility',
        'Open Interest',
    ];
}

/** `/[symbol]/news` 페이지의 SEO 카피. */
export function buildSymbolNewsSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.news.titleCore'),
        tail: t('symbol.news.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolNewsDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/news`,
        keywords: buildSymbolNewsKeywords(upper, opts.koreanName),
    };
}

function buildSymbolNewsDescription(t: SeoTranslator, subject: string): string {
    return t('symbol.news.description', { subject });
}

function buildSymbolNewsKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} 뉴스`,
        `${ticker} 호재`,
        `${ticker} 악재`,
        `${ticker} 뉴스 분위기`,
        `${ticker} 소식`,
        `${ticker} 이슈`,
        `${ticker} 분석 의견`,
        `${ticker} 어닝 일정`,
        `${ticker} 실적 발표`,
        `${ticker} 애널리스트 등급`,
        ...(koreanName
            ? [
                  `${koreanName} 뉴스`,
                  `${koreanName} 호재`,
                  `${koreanName} 어닝`,
                  `${koreanName} 실적`,
              ]
            : []),
        '뉴스 분석',
        '뉴스 분위기',
        '뉴스 분석 의견',
        '주식 호재',
        '주식 악재',
        '주식 이슈',
        '주식 소식',
        '어닝 발표',
        '실적 발표',
        '애널리스트 등급',
        '주식 뉴스',
    ];
}

/** `/[symbol]/overall` 페이지의 SEO 카피. */
export function buildSymbolOverallSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.overall.titleCore'),
        tail: t('symbol.overall.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolOverallDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/overall`,
        keywords: buildSymbolOverallKeywords(upper, opts.koreanName),
    };
}

function buildSymbolOverallDescription(
    t: SeoTranslator,
    subject: string
): string {
    return t('symbol.overall.description', { subject });
}

function buildSymbolOverallKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} AI 종합 분석`,
        `${ticker} 종합 분석`,
        `${ticker} 시나리오 분석`,
        `${ticker} 시나리오`,
        `${ticker} 위험 요인`,
        `${ticker} 매수 분위기`,
        `${ticker} 4축 분석`,
        ...(koreanName
            ? [
                  `${koreanName} 종합 분석`,
                  `${koreanName} AI 분석`,
                  `${koreanName} 시나리오 분석`,
                  `${koreanName} 매수 분위기`,
              ]
            : []),
        'AI 종합 분석',
        '시나리오 분석',
        '4축 분석',
        '기술적 분석',
        '펀더멘털 분석',
        '뉴스 분석',
    ];
}

function buildCryptoSymbolDescription(
    t: SeoTranslator,
    displayName: string
): string {
    return t('symbol.crypto.description', { subject: displayName });
}

function buildCryptoSymbolKeywords(
    ticker: string,
    displayName: string
): string[] {
    return [
        `${ticker} 시세`,
        `${ticker} 가격`,
        `${ticker} 차트`,
        `${ticker} 차트 분석`,
        `${ticker} 기술적 신호`,
        `${ticker} 기술적 분석`,
        `${ticker} AI 분석`,
        `${displayName} 시세 분석`,
        `${displayName} 차트 분석`,
    ];
}

/** 암호화폐 `/[symbol]` 차트 페이지의 SEO 카피(시세 프레임). */
export function buildCryptoSymbolSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const displayName = opts.displayName ?? ticker;
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.crypto.titleCore'),
        // 크립토 chart title tail은 주식과 동일 문구("차트·기술적 신호") —
        // `symbol.chart.titleTail` 키를 그대로 재사용해 두 카탈로그 값이
        // 번역 갱신 시 어긋나지 않게 한다.
        tail: t('symbol.chart.titleTail'),
    });
    return {
        ticker,
        title,
        fullTitle: brandTitle(title, opts.locale ?? DEFAULT_LOCALE),
        description: clampSeoDescription(
            buildCryptoSymbolDescription(t, displayName)
        ),
        url: `${SITE_URL}/${ticker}`,
        keywords: buildCryptoSymbolKeywords(ticker, displayName),
    };
}

/**
 * `resolveSymbolSeoContent` 계열의 옵션. `BuildSymbolSeoOptions`와 달리 `displayName`이
 * 필수다 — 호출부가 표시명을 이미 해석한 뒤 부르기 때문이다. `koreanName`은 DB 원시
 * 필드 타입에 맞춰 `null`을 받으며, 구현이 null→undefined로 바꿔 빌더에 넘긴다.
 */
export interface ResolveSymbolSeoOpts {
    displayName: string;
    koreanName?: string | null;
    /** 비-기본 로케일 title에서 `koreanName`을 대신한다. */
    englishName?: string | null;
    /** URL 로케일. 비-기본 로케일이면 title에서 한국어명을 뺀다. */
    locale?: Locale;
}

/**
 * 자산군에 맞는 차트 페이지 SEO 카피를 고른다. 암호화폐는 `buildCryptoSymbolSeoContent`
 * (시세 프레임: "시세 분석"), 주식·ETF·지수는 `buildSymbolSeoContent`(주가 프레임:
 * "주가 분석")다. 두 분기 모두 `koreanName`을 넘긴다 — `composeSymbolTitle`이 어느
 * 자산군이든 한국어명이 있으면 제목에 넣는다.
 *
 * 분기를 한 곳에 모아 `generateMetadata`와 `SymbolPage` 두 호출부가 카피가 바뀔 때
 * 따로 어긋나지 않게 한다.
 */
export function resolveSymbolSeoContent(
    ticker: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: ResolveSymbolSeoOpts
): SymbolSeoContent {
    return buildSymbolTabSeoContent('technical', ticker, assetClass, t, {
        displayName: opts.displayName,
        koreanName: opts.koreanName ?? undefined,
        englishName: opts.englishName ?? undefined,
        locale: opts.locale,
    });
}

/** 암호화폐 `/[symbol]/news` 페이지의 SEO 카피(어닝·실적·애널리스트 문구 없음). */
export function buildCryptoSymbolNewsSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const subject = opts.displayName ?? ticker;
    // Crypto news focuses on price catalysts and market sentiment — not earnings or analyst ratings.
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.cryptoNews.titleCore'),
        tail: t('symbol.cryptoNews.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    return {
        ticker,
        title,
        fullTitle,
        description: clampSeoDescription(
            t('symbol.cryptoNews.description', { subject })
        ),
        url: `${SITE_URL}/${ticker}/news`,
        keywords: buildCryptoSymbolNewsKeywords(ticker),
    };
}

function buildCryptoSymbolNewsKeywords(ticker: string): string[] {
    return [
        `${ticker} 뉴스`,
        `${ticker} 코인 뉴스`,
        `${ticker} 호재`,
        `${ticker} 악재`,
        `${ticker} 뉴스 분위기`,
        `${ticker} 시장 이슈`,
        `${ticker} 크립토 뉴스`,
        `${ticker} 소식`,
        `코인 뉴스 분석`,
        `크립토 뉴스`,
        `코인 호재`,
        `코인 악재`,
        `암호화폐 뉴스`,
        `코인 시장 분위기`,
        `비트코인 뉴스`,
    ];
}

/**
 * 자산군에 맞는 뉴스 페이지 SEO 빌더를 고른다. 암호화폐는
 * `buildCryptoSymbolNewsSeoContent`(어닝·실적·애널리스트 문구 없음), 주식은
 * `buildSymbolNewsSeoContent`다.
 */
export function resolveSymbolNewsSeoContent(
    ticker: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: ResolveSymbolSeoOpts
): SymbolSeoContent {
    return buildSymbolTabSeoContent('news', ticker, assetClass, t, {
        displayName: opts.displayName,
        koreanName: opts.koreanName ?? undefined,
        englishName: opts.englishName ?? undefined,
        locale: opts.locale,
    });
}

/** Build SEO metadata for a crypto `/[symbol]/overall` page (no 주가/분기실적/펀더멘털). */
export function buildCryptoSymbolOverallSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const subject = opts.displayName ?? ticker;
    // Crypto overall axes: chart trend, news sentiment, fear-greed — no earnings/fundamental.
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.cryptoOverall.titleCore'),
        tail: t('symbol.cryptoOverall.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    return {
        ticker,
        title,
        fullTitle,
        description: clampSeoDescription(
            t('symbol.cryptoOverall.description', { subject })
        ),
        url: `${SITE_URL}/${ticker}/overall`,
        keywords: buildCryptoSymbolOverallKeywords(ticker),
    };
}

function buildCryptoSymbolOverallKeywords(ticker: string): string[] {
    return [
        `${ticker} AI 종합 분석`,
        `${ticker} 코인 종합 분석`,
        `${ticker} 시나리오 분석`,
        `${ticker} 시나리오`,
        `${ticker} 위험 요인`,
        `${ticker} 매수 분위기`,
        `AI 종합 분석`,
        `코인 시나리오 분석`,
        `크립토 종합 분석`,
        `코인 기술적 분석`,
        `암호화폐 AI 분석`,
    ];
}

/**
 * 자산군에 맞는 종합 페이지 SEO 빌더를 고른다. 암호화폐는
 * `buildCryptoSymbolOverallSeoContent`(차트·뉴스·공포탐욕 축만), 주식은
 * `buildSymbolOverallSeoContent`다.
 */
export function resolveSymbolOverallSeoContent(
    ticker: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: ResolveSymbolSeoOpts
): SymbolSeoContent {
    return buildSymbolTabSeoContent('overall', ticker, assetClass, t, {
        displayName: opts.displayName,
        koreanName: opts.koreanName ?? undefined,
        englishName: opts.englishName ?? undefined,
        locale: opts.locale,
    });
}

/** 암호화폐 `/[symbol]/fear-greed` 페이지의 SEO 카피(코인 프레임 키워드). */
export function buildCryptoSymbolFearGreedSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const subject = opts.displayName ?? ticker;
    // 제목은 주식 빌더와 같은 구조에 코인에 맞는 문구를 쓴다.
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.fearGreed.titleCore'),
        tail: t('symbol.fearGreed.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    return {
        ticker,
        title,
        fullTitle,
        description: clampSeoDescription(
            // 공포탐욕 지표는 가격 위치와 거래량 흐름에서 매수·매도 압력을 재므로
            // 의미가 암호화폐와 주식에서 같다. 암호화폐 전용 카피가 필요한 건 제목과
            // 키워드뿐이라, description 본문은 buildSymbolFearGreedDescription을
            // 일부러 공유한다.
            buildSymbolFearGreedDescription(t, subject)
        ),
        url: `${SITE_URL}/${ticker}/fear-greed`,
        keywords: buildCryptoSymbolFearGreedKeywords(ticker),
    };
}

function buildCryptoSymbolFearGreedKeywords(ticker: string): string[] {
    return [
        `${ticker} 공포 지수`,
        `${ticker} 탐욕 지수`,
        `${ticker} 코인 매수 분위기`,
        `${ticker} 매수세`,
        `${ticker} 단기 흐름`,
        `${ticker} 단기 심리`,
        `공포 탐욕 지수`,
        `코인 투자 심리`,
        `코인 매수 분위기`,
        `Fear Greed Index`,
        `크립토 투자 심리`,
        `암호화폐 매수 분위기`,
        `코인 단기 매매 심리`,
    ];
}

/**
 * 자산군에 맞는 공포탐욕 페이지 SEO 빌더를 고른다. 암호화폐는
 * `buildCryptoSymbolFearGreedSeoContent`(코인 프레임 키워드), 주식은
 * `buildSymbolFearGreedSeoContent`다.
 */
export function resolveSymbolFearGreedSeoContent(
    ticker: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: ResolveSymbolSeoOpts
): SymbolSeoContent {
    return buildSymbolTabSeoContent('fear-greed', ticker, assetClass, t, {
        displayName: opts.displayName,
        koreanName: opts.koreanName ?? undefined,
        englishName: opts.englishName ?? undefined,
        locale: opts.locale,
    });
}

/** `/[symbol]/fear-greed` 페이지의 SEO 카피. */
export function buildSymbolFearGreedSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const subject = opts.displayName ?? upper;
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.fearGreed.titleCore'),
        tail: t('symbol.fearGreed.titleTail'),
    });
    const fullTitle = brandTitle(title, opts.locale ?? DEFAULT_LOCALE);
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolFearGreedDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/fear-greed`,
        keywords: buildSymbolFearGreedKeywords(
            upper,
            opts.sector,
            opts.koreanName
        ),
    };
}

function buildSymbolFearGreedDescription(
    t: SeoTranslator,
    subject: string
): string {
    return t('symbol.fearGreed.description', { subject });
}

function buildSymbolFearGreedKeywords(
    ticker: string,
    sector?: string,
    koreanName?: string
): string[] {
    return [
        `${ticker} 공포 지수`,
        `${ticker} 탐욕 지수`,
        `${ticker} 매수 분위기`,
        `${ticker} 매수세`,
        `${ticker} 단기 흐름`,
        `${ticker} 단기 심리`,
        ...(sector ? [`${sector} 섹터 매수 분위기`] : []),
        ...(koreanName
            ? [
                  `${koreanName} 공포 지수`,
                  `${koreanName} 탐욕 지수`,
                  `${koreanName} 매수 분위기`,
              ]
            : []),
        '공포 탐욕 지수',
        '투자 심리 지표',
        'Fear Greed Index',
        '주식 매수 분위기',
        '단기 매매 심리',
    ];
}

/**
 * `/[symbol]/position` 탭의 SEO 콘텐츠 — `generateMetadata`(정상·차단 분기 모두)와 본문
 * JSON-LD의 **단일 소스**다. 둘로 갈라 두면 `<title>`과 `WebPage.name`이 조용히
 * 어긋난다(CONVENTIONS.md#CP-2).
 *
 * 다른 탭과 달리 `composeSymbolTitle`을 쓰지 않는다 — 후킹 키워드(아파트/옥상/지하)가
 * displayName **앞**에 와야 한다. displayName은 종목마다 길이가 크게 달라(70자+도 있다)
 * 뒤에 붙이면 title/OG truncation과 description clamp에 메타포가 잘려 나간다.
 * displayName은 호출부가 `buildDisplayName(assetInfo, symbol, locale)`로 로케일에 맞게
 * 만들어 넘긴다 — 생략하면 티커다.
 */
export function buildSymbolPositionSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const displayName = opts.displayName ?? upper;
    const title = t('position.title', { v0: displayName });
    return {
        ticker: upper,
        title,
        fullTitle: brandTitle(title, opts.locale ?? DEFAULT_LOCALE),
        description: clampSeoDescription(
            t('position.description', { v0: displayName })
        ),
        url: `${SITE_URL}/${upper}/position`,
        keywords: buildSymbolPositionKeywords(upper, opts.koreanName),
    };
}

/** position 탭 키워드 — ★평단/수익률이 client-only인 개인화 surface라 다른 탭과 공유하지 않는다. */
function buildSymbolPositionKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        `${ticker} 평단`,
        `${ticker} 평단 계산`,
        `${ticker} 내 위치`,
        `${ticker} 52주 범위`,
        ...(koreanName ? [`${koreanName} 평단`, `${koreanName} 내 위치`] : []),
        '평단 확인',
        '52주 최고가 최저가',
    ];
}
