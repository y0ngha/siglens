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
