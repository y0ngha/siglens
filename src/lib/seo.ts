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

export const INVESTMENT_DISCLAIMER =
    '본 서비스의 분석 정보는 투자 참고용이며, 투자 결정의 책임은 이용자에게 있습니다.';

export const LEGAL_EFFECTIVE_DATE = '2026년 4월 11일';

export const PRIVACY_PATH = '/privacy';
export const TERMS_PATH = '/terms';

export const PRIVACY_TITLE = '개인정보처리방침';
export const PRIVACY_DESCRIPTION = `${SITE_NAME}의 개인정보처리방침 — 수집하는 정보, 이용 목적, 보관 기간 및 이용자 권리를 안내합니다.`;

export const TERMS_TITLE = '이용약관';
export const TERMS_DESCRIPTION = `${SITE_NAME} 서비스 이용약관 — 서비스 이용 조건, 투자 정보 면책 조항, 사용자 권리와 의무를 안내합니다.`;

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
