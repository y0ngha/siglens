export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://siglens.io';

export const SITE_NAME = 'Siglens';

export const SITE_DESCRIPTION =
    '미국 주식 차트를 AI로 분석하세요. RSI, MACD, 볼린저밴드 등 보조지표 시그널과 캔들 패턴, 지지·저항 레벨을 자동으로 해석합니다. 회원가입 없이 무료로 바로 확인하세요.';

export const ROOT_TITLE = `미국 주식 AI 기술적 분석 — ${SITE_NAME}`;

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

export const POPULAR_TICKERS_DISPLAY_COUNT = 6;

export const POPULAR_TICKERS = [
    // --- [1] Mega Cap & Index ---
    'AAPL',
    'MSFT',
    'NVDA',
    'GOOGL',
    'AMZN',
    'META',
    'TSLA',
    'NFLX',
    'BRK.B',
    'SPY',
    'QQQ',
    'IWM',
    'VTI',
    'DIA',

    // --- [2] Semi / AI / Infra ---
    'AMD',
    'INTC',
    'AVGO',
    'QCOM',
    'TXN',
    'MU',
    'ASML',
    'LRCX',
    'AMAT',
    'KLAC',
    'SMCI',
    'ARM',
    'MRVL',
    'VRT',
    'ALAB',
    'ASTS',
    'SOUN',
    'BBAI',
    'AI',

    // --- [3] Quantum Computing ---
    'BTQ',
    'IONQ',
    'RGTI',
    'QBTS',
    'QUBT',
    'LAES',
    'IBM',

    // --- [4] Software / SaaS / Cloud ---
    'CRM',
    'NOW',
    'ADBE',
    'ORCL',
    'SNOW',
    'PLTR',
    'PANW',
    'CRWD',
    'ZS',
    'DDOG',
    'MDB',
    'NET',
    'SHOP',
    'DOCU',
    'ZM',
    'TEAM',
    'PATH',
    'U',
    'RBLX',

    // --- [5] Fintech / Crypto / Meme ---
    'COIN',
    'MSTR',
    'MARA',
    'RIOT',
    'CLSK',
    'WULF',
    'HOOD',
    'SQ',
    'PYPL',
    'SOFI',
    'AFRM',
    'UPST',
    'NU',
    'GME',
    'AMC',
    'RDDT',
    'DJT',
    'CVNA',
    'DKNG',

    // --- [6] EV / Mobility / Space ---
    'RIVN',
    'NIO',
    'LCID',
    'XPEV',
    'LI',
    'F',
    'GM',
    'STLA',
    'UBER',
    'LYFT',
    'ABNB',
    'BKNG',
    'LUNR',
    'SPCE',

    // --- [7] Leveraged ETFs ---
    'TQQQ',
    'SQQQ',
    'SOXL',
    'SOXS',
    'TSLL',
    'NVDL',
    'LABU',

    // --- [8] Big Financials ---
    'JPM',
    'BAC',
    'WFC',
    'C',
    'GS',
    'MS',
    'SCHW',
    'BLK',
    'V',
    'MA',
    'AXP',

    // --- [9] Consumer / Retail / Food ---
    'COST',
    'WMT',
    'TGT',
    'HD',
    'LOW',
    'NKE',
    'SBUX',
    'MCD',
    'DIS',
    'KO',
    'PEP',
    'PG',
    'LULU',

    // --- [10] Energy / Industrials / Materials ---
    'XOM',
    'CVX',
    'OXY',
    'SLB',
    'COP',
    'EOG',
    'CAT',
    'DE',
    'GE',
    'BA',
    'HON',
    'UPS',
    'FDX',

    // --- [11] Healthcare / Pharma / Bio ---
    'LLY',
    'NVO',
    'UNH',
    'JNJ',
    'PFE',
    'MRK',
    'ABBV',
    'TMO',
    'DHR',
    'ISRG',
    'AMGN',
    'GILD',

    // --- [12] China ADR / Global ---
    'BABA',
    'JD',
    'PDD',
    'BIDU',
    'TCEHY',
    'TSM',
    'SPOT',
    'PINS',
    'SNAP',
    'ETSY',
] as const;
