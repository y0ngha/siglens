export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://siglens.io';

export const SITE_NAME = 'Siglens';

export const SITE_DESCRIPTION =
    '미국 주식 AI 기술적 분석 — RSI, MACD, 볼린저밴드 등 13종 보조지표와 캔들 패턴을 자동 분석합니다. 무료.';

export const ROOT_TITLE = `미국 주식 AI 기술적 분석 — ${SITE_NAME}`;

export const ROOT_KEYWORDS = [
    '미국 주식 기술적 분석',
    'AI 주식 분석',
    '미국 주식 차트 분석',
    '주식 보조지표',
    '무료 주식 분석',
    'RSI',
    'MACD',
    '볼린저밴드',
    '이동평균선',
    '캔들패턴',
    '지지 저항',
    '골든크로스',
    '데드크로스',
    'AI technical analysis',
    'stock chart analysis',
];

export function buildSymbolKeywords(
    ticker: string,
    displayName: string,
    koreanName?: string
): string[] {
    return [
        `${displayName} 기술적 분석`,
        `${displayName} 차트 분석`,
        `${ticker} 주가`,
        `${ticker} 기술적 분석`,
        `${ticker} chart analysis`,
        ...(koreanName
            ? [`${koreanName} 주가 분석`, `${koreanName} 차트 분석`]
            : []),
    ];
}

export const POPULAR_TICKERS_DISPLAY_COUNT = 6;

export const POPULAR_TICKERS = [
    'AAPL',
    'TSLA',
    'NVDA',
    'MSFT',
    'GOOGL',
    'AMZN',
    'META',
    'NFLX',
    'AMD',
    'INTC',
    'PLTR',
    'COIN',
    'SOFI',
    'NIO',
    'RIVN',
    'SNOW',
    'CRM',
    'UBER',
    'COST',
    'JPM',
] as const;
