export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://siglens.io';

export const SITE_NAME = 'Siglens';

export const SITE_DESCRIPTION =
    '시장 흐름 파악부터 종목별 기술적 분석, AI와의 심층 대화까지 한 곳에서. RSI·MACD·볼린저밴드·캔들 패턴·지지저항 자동 분석과 오늘 주목할 종목을 무료로 확인하세요. 회원가입 불필요.';

export const ROOT_TITLE = `미국 주식 무료 AI 분석 — 시장 분석·기술적 분석·AI 대화 | ${SITE_NAME}`;

export const ROOT_KEYWORDS = [
    'Siglens',
    '미국 주식 차트 분석',
    '미국 주식 차트 보는 법',
    '미국 주식 분석',
    'AI 주식 분석',
    '무료 주식 차트',
    'RSI',
    'RSI 보는 법',
    'MACD',
    'MACD 보는 법',
    '볼린저밴드',
    '이동평균선',
    '스토캐스틱',
    '일목균형표',
    'VWAP',
    '캔들 패턴',
    '골든크로스',
    '데드크로스',
    '지지 저항',
    'free stock analysis',
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
