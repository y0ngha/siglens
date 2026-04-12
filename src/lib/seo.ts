export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://siglens.io';

export const SITE_NAME = 'Siglens';

export const SITE_DESCRIPTION =
    '티커 입력 한 번으로 RSI·MACD·볼린저밴드·캔들 패턴·지지저항을 AI가 자동 분석합니다. 무료, 회원가입 불필요.';

export const ROOT_TITLE = `미국 주식 AI 기술적 분석 — RSI·MACD·볼린저밴드 자동 해석 | ${SITE_NAME}`;

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
