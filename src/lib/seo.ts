export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://siglens.io';

export const SITE_NAME = 'Siglens';

export const SITE_DESCRIPTION =
    '미국 주식 티커만 입력하면 RSI·MACD·볼린저밴드 등 13종 지표와 차트 패턴, 지지·저항을 AI가 해석해줍니다. 오늘 주목할 섹터 확인부터 AI 채팅까지. 회원가입 없이 무료로.';

export const ROOT_TITLE = `미국 주식 AI 분석·시장 동향·AI 대화 | ${SITE_NAME}`;

export const ROOT_KEYWORDS = [
    'Siglens',
    '미국 주식 AI 분석',
    '미국 주식 분석',
    '미국 주식 차트 분석',
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
    'AI stock analysis',
    'stock chart analysis',
];

export function buildSymbolDescription(displayName: string): string {
    return `${displayName} 주가를 AI가 자동 분석합니다. RSI·MACD·볼린저밴드 지표 해석, 캔들·차트 패턴 감지, AI와 대화하며 확인까지. 회원가입 없이 무료로.`;
}

export function buildSymbolKeywords(
    ticker: string,
    displayName: string,
    koreanName?: string
): string[] {
    return [
        `${ticker} AI 분석`,
        `${ticker} 주가 AI 분석`,
        `${displayName} AI 분석`,
        `${displayName} 기술적 분석`,
        `${displayName} 차트 분석`,
        `${ticker} 주가`,
        `${ticker} 주가 전망`,
        `${ticker} 기술적 분석`,
        `${ticker} chart analysis`,
        ...(koreanName
            ? [
                  `${koreanName} AI 분석`,
                  `${koreanName} 주가 분석`,
                  `${koreanName} 주가 전망`,
                  `${koreanName} 차트 분석`,
              ]
            : []),
    ];
}

export interface BreadcrumbItem {
    name: string;
    url: string;
}

// 홈(Siglens → SITE_URL)이 첫 항목으로 자동 삽입된다.
export function buildBreadcrumbJsonLd(trail: BreadcrumbItem[]): object {
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
            item: item.url,
        })),
    };
}

export const BACKTESTING_PATH = '/backtesting';
export const BACKTESTING_URL = `${SITE_URL}${BACKTESTING_PATH}`;
// Root layout template appends "| Siglens" — exclude brand name to prevent duplication
export const BACKTESTING_TITLE = 'AI 기술적 분석 백테스팅 결과';
export const BACKTESTING_DESCRIPTION =
    'AAPL·NVDA·TSLA 등 10개 종목을 2년간 실제 분석한 백테스팅 케이스입니다. RSI·MACD·Supertrend 기술적 신호와 AI 예측이 실제로 얼마나 맞았는지 데이터로 직접 확인하세요.';
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
];
