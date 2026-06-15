import type { Metadata } from 'next';

export interface BreadcrumbItem {
    name: string;
    url: string;
}

export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://siglens.io';

export const SITE_NAME = 'Siglens';

/**
 * Shared metadata for the noindex early-returns on the `[symbol]` routes
 * (invalid ticker, infra-degraded asset, FMP-degraded profile).
 *
 * `canonical: null` is the important part: it OVERRIDES the root layout's
 * `alternates.canonical: SITE_URL`, so a noindexed symbol page does not falsely
 * advertise the homepage as its canonical. Without it these early-returns
 * inherit the layout canonical (a wrong cross-page signal).
 */
export const NOINDEX_SYMBOL_METADATA: Metadata = {
    robots: { index: false, follow: false },
    alternates: { canonical: null },
};

// 빌드 시각 — 매 요청마다 변동되면 안 되는 schema.org datePublished 등에 사용.
// NEXT_BUILD_DATE env가 있으면 우선, 없으면 모듈 로드 시각(deploy 시점)을 한 번만 캐시.
function parseBuildDate(): Date {
    const raw = process.env.NEXT_BUILD_DATE;
    if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
}
export const SITE_BUILD_DATE = parseBuildDate();

/**
 * 한글 SERP description 안전권. Google 한국어 SERP에서 모바일은 ~80자,
 * 데스크톱은 ~120자 안팎에서 절단되므로 120자를 상한으로 둔다.
 * 현재 모든 빌더는 이미 90~115자 범위로 짧지만, 입력(displayName/sector)
 * 변화로 인한 회귀를 막기 위해 출력단에서 한 번 더 강제한다.
 */
export const SEO_DESCRIPTION_MAX_LENGTH = 120;

/**
 * 입력이 SEO_DESCRIPTION_MAX_LENGTH 이하면 그대로, 초과 시 잘라내고 말줄임표(…)를 붙인다.
 * 말줄임표는 1자로 계산해 최종 길이가 항상 SEO_DESCRIPTION_MAX_LENGTH 이하가 되게 한다.
 *
 * 길이/슬라이스는 모두 code point 기준으로 처리해 surrogate pair(이모지,
 * supplementary plane 한자 등)가 split되어 invalid UTF-16이 되는 것을 막는다.
 */
export function clampSeoDescription(text: string): string {
    const codePoints = [...text];
    if (codePoints.length <= SEO_DESCRIPTION_MAX_LENGTH) return text;
    return (
        codePoints
            .slice(0, SEO_DESCRIPTION_MAX_LENGTH - 1)
            .join('')
            .trimEnd() + '…'
    );
}

// "보조지표 25종" 같은 동적 숫자는 Skills 개수가 바뀌면 stale되므로 질적 표현으로 둔다
// (M7에서 FAQ JSON-LD에 적용한 정책을 SITE_DESCRIPTION에도 일관 적용).
export const SITE_DESCRIPTION = clampSeoDescription(
    '미국 주식을 티커 하나로 종합 분석합니다. 다양한 보조지표 차트, 펀더멘털·뉴스·옵션, 공포 탐욕 지수를 묶은 AI 종합 결론과 2년 백테스팅 결과까지 한 화면에서.'
);

export const ROOT_TITLE = `미국 주식 AI 분석 — 차트·실적·뉴스로 투자 결론까지 | ${SITE_NAME}`;

// 한글 SERP는 80~120자가 안전권이라 키워드는 핵심 검색의도 위주로 추렸다.
// 영문 키워드, 동의어 중복(매매 신호/차트 해석 등), 너무 일반적인 단일 명사(RSI, MACD 등)는 의도적으로 제외했다.
export const ROOT_KEYWORDS = [
    'Siglens',
    '미국 주식 AI 분석',
    '미국 주식 차트 분석',
    '미국 주식 펀더멘털',
    '미국 주식 뉴스',
    '미국 주식 옵션',
    'AI 종합 분석',
    '공포 탐욕 지수',
    'AI 주식 백테스팅',
    '오늘의 미국 주식',
    '섹터별 주식 분석',
    '골든크로스 종목',
    '미국 주식 PER',
    '어닝 일정',
    '애널리스트 컨센서스',
    '목표 주가',
];

function buildSymbolDescription(displayName: string, sector?: string): string {
    const sectorPhrase = sector ? `${sector} 섹터 ` : '';
    return `${sectorPhrase}${displayName} 주가 흐름과 매매 신호를 차트에서 확인합니다. RSI·MACD·볼린저밴드, 캔들 패턴, 주요 지지·저항선을 AI가 분석해 추세와 진입 후보 가격대를 정리합니다.`;
}

export interface SymbolSeoContent {
    ticker: string;
    title: string;
    fullTitle: string;
    description: string;
    url: string;
    keywords: string[];
}

export interface BuildSymbolSeoOptions {
    /** Resolved display name (e.g. "애플, Apple Inc. (AAPL)"). Falls back to ticker. */
    displayName?: string;
    /** Korean company name; expands keyword set when present. */
    koreanName?: string;
    /** Sector name (English, FMP-style — e.g. "Technology"); woven into description when present. */
    sector?: string;
}

export function buildSymbolSeoContent(
    symbol: string,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const title = `${ticker} 주가 분석 — 차트와 매매 신호, 지지선·저항선`;
    const displayName = opts.displayName ?? ticker;
    return {
        ticker,
        title,
        fullTitle: `${title} | ${SITE_NAME}`,
        description: clampSeoDescription(
            buildSymbolDescription(displayName, opts.sector)
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
        `${ticker} 주가 전망`,
        `${ticker} 차트`,
        `${ticker} 차트 분석`,
        `${ticker} 매수`,
        `${ticker} 매도`,
        `${ticker} 매매 시점`,
        `${ticker} 매매 신호`,
        `${ticker} 기술적 분석`,
        `${ticker} AI 분석`,
        `${displayName} 주가 분석`,
        `${displayName} 차트 분석`,
        `${ticker} chart analysis`,
        ...(koreanName
            ? [
                  `${koreanName} 주가`,
                  `${koreanName} 주가 전망`,
                  `${koreanName} 매수`,
                  `${koreanName} 매도`,
                  `${koreanName} 매매 시점`,
                  `${koreanName} 차트 분석`,
              ]
            : []),
    ];
}

// 홈(Siglens → SITE_URL)이 첫 항목으로 자동 삽입된다.
// schema.org BreadcrumbList의 `item`은 절대 URL이어야 하므로
// 상대 경로로 들어온 trail은 SITE_URL prefix를 붙여 절대화한다.
export function buildBreadcrumbJsonLd(
    trail: readonly BreadcrumbItem[]
): Record<string, unknown> {
    const items: BreadcrumbItem[] = [
        { name: SITE_NAME, url: SITE_URL },
        ...trail,
    ];
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url.startsWith('http')
                ? item.url
                : `${SITE_URL}${item.url}`,
        })),
    };
}

export const BACKTESTING_PATH = '/backtesting';
export const BACKTESTING_URL = `${SITE_URL}${BACKTESTING_PATH}`;
// Root layout template appends "| Siglens" — exclude brand name to prevent duplication
export const BACKTESTING_TITLE =
    'AAPL, NVDA, TSLA 2년 백테스트 — AI 신호 예측 정확도';
export const BACKTESTING_DESCRIPTION =
    'AAPL·NVDA·TSLA 등 10개 종목 2년 백테스트입니다. RSI·MACD·Supertrend 기술적 신호와 AI 예측이 실제로 얼마나 맞았는지 데이터로 확인하세요.';
export const BACKTESTING_KEYWORDS = [
    ...ROOT_KEYWORDS,
    '주식 AI 백테스팅',
    '기술적 분석 백테스팅',
    'AI 주식 예측 정확도',
    '주식 기술적 분석 정확도',
    'RSI 신호 백테스팅',
    'MACD 백테스팅',
    'AI 분석 신뢰도',
    'Magnificent 7 분석',
    'AI 주식 예측 검증',
    '기술적 분석 백테스트 무료',
    '주식 매매 신호 정확도',
    '미국 주식 백테스트',
];

/** Build SEO metadata for the `/[symbol]/financials` page. */
export function buildSymbolFinancialsSeoContent(
    symbol: string,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    // Root layout template appends "| Siglens" — exclude brand name to prevent duplication.
    const title = `${upper} 재무제표 — 매출·이익·현금흐름 5년 추이`;
    const fullTitle = `${title} | ${SITE_NAME}`;
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolFinancialsDescription(subject)
        ),
        url: `${SITE_URL}/${upper}/financials`,
        keywords: buildSymbolFinancialsKeywords(upper, opts.koreanName),
    };
}

function buildSymbolFinancialsDescription(subject: string): string {
    return `${subject}의 손익·재무상태·현금흐름과 성장성·수익성·안정성·현금창출력 점수를 한눈에 확인합니다.`;
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

/** Build SEO metadata for the `/[symbol]/fundamental` page. */
export function buildSymbolFundamentalSeoContent(
    symbol: string,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    // Root layout template appends "| Siglens" — exclude brand name to prevent duplication.
    const title = `${upper} 펀더멘털 — PER, ROE와 애널리스트 컨센서스`;
    const fullTitle = `${title} | ${SITE_NAME}`;
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolFundamentalDescription(subject, opts.sector)
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
    subject: string,
    sector?: string
): string {
    const sectorPhrase = sector ? ` ${sector} 섹터 위치와` : '';
    return `${subject} 회사 프로필, PER·PSR·EPS 밸류에이션, ROE·마진 수익성, 부채·현금흐름 재무 건전성을 한 페이지에서 정리합니다.${sectorPhrase} 애널리스트 컨센서스와 목표 주가도 이어 봅니다.`;
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
        `${ticker} 목표 주가`,
        ...(koreanName
            ? [
                  `${koreanName} 펀더멘털`,
                  `${koreanName} 재무 분석`,
                  `${koreanName} 밸류에이션`,
                  `${koreanName} 목표 주가`,
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
        '목표 주가',
    ];
}

export interface BuildSymbolOptionsSeoOptions extends BuildSymbolSeoOptions {
    /**
     * `false`일 때 옵션 시장이 없는 종목으로 안내한다. metadata에서 robots를
     * noindex로 떨어뜨리는 신호로도 사용된다.
     */
    hasOptions?: boolean;
}

/** Build SEO metadata for the `/[symbol]/options` page. */
export function buildSymbolOptionsSeoContent(
    symbol: string,
    opts: BuildSymbolOptionsSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const subject = opts.displayName ?? upper;
    const hasOptions = opts.hasOptions ?? true;
    const title = hasOptions
        ? `${upper} 옵션 분석 — Max Pain · OI · Put/Call · ATM IV`
        : `${upper} 옵션 분석`;
    const fullTitle = `${title} | ${SITE_NAME}`;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            hasOptions
                ? `${subject} 옵션 시장을 AI가 한국어로 해석합니다. 만기별 Max Pain·Put/Call·ATM IV·Implied Move와 Strike별 OI로 시장이 어디에 베팅하는지 봅니다.`
                : `${subject}는 현재 옵션 시장이 형성되어 있지 않습니다. 차트·펀더멘털·뉴스 분석으로 종목을 살펴보세요.`
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

/** Build SEO metadata for the `/[symbol]/news` page. */
export function buildSymbolNewsSeoContent(
    symbol: string,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    // Root layout template appends "| Siglens" — exclude brand name to prevent duplication.
    const title = `${upper} 뉴스 — 호재 분위기, 어닝과 실적, 애널리스트 등급`;
    const fullTitle = `${title} | ${SITE_NAME}`;
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(buildSymbolNewsDescription(subject)),
        url: `${SITE_URL}/${upper}/news`,
        keywords: buildSymbolNewsKeywords(upper, opts.koreanName),
    };
}

function buildSymbolNewsDescription(subject: string): string {
    return `${subject} 주가가 왜 움직였는지 최신 뉴스에서 확인합니다. 기사마다 호재·악재 분위기와 핵심 이슈를 정리하고, 다음 어닝·실적 발표, 애널리스트 목표 주가와 등급 변경도 이어 봅니다.`;
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
        `${ticker} 목표 주가`,
        ...(koreanName
            ? [
                  `${koreanName} 뉴스`,
                  `${koreanName} 호재`,
                  `${koreanName} 어닝`,
                  `${koreanName} 실적`,
                  `${koreanName} 목표 주가`,
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

/** Build SEO metadata for the `/[symbol]/overall` page. */
export function buildSymbolOverallSeoContent(
    symbol: string,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    // Root layout template appends "| Siglens" — exclude brand name to prevent duplication.
    const title = `${upper} 종합 분석 — 강세와 약세 시나리오, 위험 요인`;
    const fullTitle = `${title} | ${SITE_NAME}`;
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolOverallDescription(subject)
        ),
        url: `${SITE_URL}/${upper}/overall`,
        keywords: buildSymbolOverallKeywords(upper, opts.koreanName),
    };
}

function buildSymbolOverallDescription(subject: string): string {
    return `${subject} 주가를 매수할 만한지 차트·실적·뉴스·매수 분위기 네 축으로 묶어 강세·약세 시나리오로 정리합니다. 진입 후보 가격대와 시나리오가 깨지는 위험 요인도 함께 짚습니다.`;
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
        `${ticker} 진입 타이밍`,
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

/** Build SEO metadata for the `/[symbol]/fear-greed` page. */
export function buildSymbolFearGreedSeoContent(
    symbol: string,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const subject = opts.displayName ?? upper;
    // Root layout template appends "| Siglens" — exclude brand name to prevent duplication.
    const title = `${upper} 공포 탐욕 지수 — 0~100 점수와 5단계 분위기`;
    const fullTitle = `${title} | ${SITE_NAME}`;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolFearGreedDescription(subject)
        ),
        url: `${SITE_URL}/${upper}/fear-greed`,
        keywords: buildSymbolFearGreedKeywords(
            upper,
            opts.sector,
            opts.koreanName
        ),
    };
}

function buildSymbolFearGreedDescription(subject: string): string {
    return `${subject} 매수세가 강한지 약한지 거래량 흐름과 가격 위치로 산출한 0~100 점수로 확인합니다. 극심한 공포부터 극심한 탐욕까지 5단계 분위기와 1년 시계열도 같이 봅니다.`;
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
