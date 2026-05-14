export interface BreadcrumbItem {
    name: string;
    url: string;
}

export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://siglens.io';

export const SITE_NAME = 'Siglens';

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

export const SITE_DESCRIPTION =
    '테슬라 PER이 비싼지, AAPL 실적(어닝)이 언제인지, 차트가 좋아 보이는지 — 미국 주식을 볼 때 궁금한 것들을 티커 하나로 확인합니다. 보조지표 25종 기반 차트 분석부터 펀더멘털, 뉴스, 셋을 합친 종합 결론은 물론, 지금 매수 분위기가 강한지(공포 탐욕 지수)까지 함께 봅니다. 2년치 AI 백테스팅 결과도 같이 공개합니다.';

export const ROOT_TITLE = `미국 주식 AI 분석 — 차트와 실적, 뉴스로 보는 결론 | ${SITE_NAME}`;

export const ROOT_KEYWORDS = [
    'Siglens',
    '미국 주식 AI 분석',
    '미국 주식 분석',
    '미국 주식 차트 분석',
    '미국 주식 펀더멘털',
    '미국 주식 뉴스',
    '미국 주식 시장 동향',
    '오늘의 미국 주식',
    '미국 주식 전망',
    '섹터별 주식 분석',
    '섹터 순환',
    '급등주',
    '매매 신호',
    '차트 해석',
    '무료 주식 차트',
    'RSI',
    'MACD',
    '볼린저밴드',
    '이동평균선',
    '골든크로스',
    '데드크로스',
    '캔들 패턴',
    '지지 저항',
    '주식 PER',
    '주식 ROE',
    '밸류에이션 분석',
    '애널리스트 컨센서스',
    '목표 주가',
    '어닝 일정',
    '어닝 발표',
    '실적 발표',
    '실적 일정',
    '뉴스 분위기',
    '주식 호재',
    '주식 악재',
    '주식 이슈',
    '공포 탐욕 지수',
    '투자 심리 지표',
    '주식 매수 분위기',
    'Fear Greed Index',
    'AI 종합 분석',
    '시나리오 분석',
    'AI 주식 백테스팅',
    '주식 예측 정확도',
    'AI stock analysis',
    'stock chart analysis',
];

function buildSymbolDescription(displayName: string, sector?: string): string {
    const sectorPhrase = sector ? `${sector} 섹터 ` : '';
    return `${sectorPhrase}${displayName} 주가가 지금 어떤 흐름인지, 어느 가격대에서 매매 신호가 나오는지 차트에서 확인합니다. RSI, MACD, 볼린저밴드와 캔들 패턴, 주요 지지선과 저항선을 같이 보고, AI가 정리한 추세 판단과 진입 후보 가격대를 이어서 읽습니다.`;
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
    const title = `${ticker} 주가 분석 — 차트와 매매 신호, 지지저항`;
    const displayName = opts.displayName ?? ticker;
    return {
        ticker,
        title,
        fullTitle: `${title} | ${SITE_NAME}`,
        description: buildSymbolDescription(displayName, opts.sector),
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
    'AAPL, NVDA, TSLA 등 10개 종목을 2년간 실제 분석한 백테스팅 케이스입니다. RSI, MACD, Supertrend 기술적 신호와 AI 예측이 실제로 얼마나 맞았는지 데이터로 직접 확인하세요.';
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
        description: buildSymbolFundamentalDescription(subject, opts.sector),
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
    const sectorPhrase = sector ? ` ${sector} 섹터에서의 위치,` : '';
    return `${subject} 회사 프로필과 PER, PSR, EPS로 보는 밸류에이션, ROE와 마진으로 보는 수익성, 부채와 현금흐름으로 보는 재무 건전성을 살펴봅니다.${sectorPhrase} 애널리스트 컨센서스와 목표 주가도 이어서 확인합니다.`;
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
        description: hasOptions
            ? `${subject}의 옵션 시장을 AI가 한국어로 해석합니다. 만기별 Max Pain, Put/Call Ratio, ATM IV, Implied Move 같은 핵심 지표와 Strike별 Open Interest 분포로 시장이 어디에 베팅하고 있는지 살펴봅니다.`
            : `${subject}는 현재 옵션 시장이 형성되어 있지 않습니다. 차트, 펀더멘털, 뉴스 분석으로 종목을 살펴보세요.`,
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
        description: buildSymbolNewsDescription(subject),
        url: `${SITE_URL}/${upper}/news`,
        keywords: buildSymbolNewsKeywords(upper, opts.koreanName),
    };
}

function buildSymbolNewsDescription(subject: string): string {
    return `${subject} 주가가 왜 움직였는지 궁금할 때 보는 페이지입니다. 최신 뉴스마다 호재나 악재 분위기를 표시하고, 어떤 이슈와 소식이 영향을 줬는지 분석 의견과 함께 정리합니다. 다음 어닝과 실적 발표, 애널리스트 목표 주가와 등급 변경도 이어서 살펴봅니다.`;
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
        description: buildSymbolOverallDescription(subject),
        url: `${SITE_URL}/${upper}/overall`,
        keywords: buildSymbolOverallKeywords(upper, opts.koreanName),
    };
}

function buildSymbolOverallDescription(subject: string): string {
    return `${subject} 주가를 살 만한지 판단할 때 보는 페이지입니다. 차트의 추세와 분기 실적, 최근 뉴스 분위기, 그리고 단기 매수 분위기까지 묶어 강세와 약세 시나리오를 정리하고, 어떤 가격대에서 진입을 고려할 만한지, 어떤 신호가 나오면 시나리오가 깨지는지 위험 요인까지 짚습니다.`;
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
        description: buildSymbolFearGreedDescription(subject),
        url: `${SITE_URL}/${upper}/fear-greed`,
        keywords: buildSymbolFearGreedKeywords(
            upper,
            opts.sector,
            opts.koreanName
        ),
    };
}

function buildSymbolFearGreedDescription(subject: string): string {
    return `${subject} 매수세가 지금 강한지 약한지 궁금할 때 보는 페이지입니다. 거래량 흐름과 가격 위치를 묶어 0~100 점수로 정리하고, 극심한 공포부터 극심한 탐욕까지 5단계로 분위기를 보여줍니다. 1년 시계열로 흐름이 어떻게 바뀌어왔는지도 같이 확인합니다.`;
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
