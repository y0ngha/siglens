import type { TickerCategory } from '@/shared/lib/types';

// TODO(seo): 현재 수동 관리 — 매일 새벽 FMP `/stable/stock-list`와 동기화하는 cron job 검토.
//            상장폐지된 종목이 sitemap에 남아 404를 유발하는 케이스 모니터링 필요.
export const TICKER_CATEGORIES: readonly TickerCategory[] = [
    {
        id: 'megacap',
        label: '메가캡·지수',
        items: [
            { symbol: 'AAPL', name: '애플' },
            { symbol: 'MSFT', name: '마이크로소프트' },
            { symbol: 'NVDA', name: '엔비디아' },
            { symbol: 'GOOGL', name: '알파벳(구글)' },
            { symbol: 'AMZN', name: '아마존' },
            { symbol: 'META', name: '메타' },
            { symbol: 'TSLA', name: '테슬라' },
            { symbol: 'SPY', name: 'S&P500 ETF' },
            { symbol: 'QQQ', name: '나스닥100 ETF' },
        ],
    },
    {
        id: 'ai-semiconductor',
        label: 'AI·반도체',
        items: [
            { symbol: 'AMD', name: 'AMD' },
            { symbol: 'AVGO', name: '브로드컴' },
            { symbol: 'ARM', name: '암(ARM)' },
            { symbol: 'SMCI', name: '슈퍼마이크로' },
            { symbol: 'ALAB', name: '아스테라랩스' },
            { symbol: 'SOUN', name: '사운드하운드' },
        ],
    },
    {
        id: 'software-cloud',
        label: '소프트웨어·클라우드',
        items: [
            { symbol: 'PLTR', name: '팔란티어' },
            { symbol: 'CRWD', name: '크라우드스트라이크' },
            { symbol: 'SNOW', name: '스노우플레이크' },
            { symbol: 'NOW', name: '서비스나우' },
            { symbol: 'CRM', name: '세일즈포스' },
            { symbol: 'DDOG', name: '데이터독' },
            { symbol: 'NET', name: '클라우드플레어' },
        ],
    },
    {
        id: 'fintech-crypto',
        label: '핀테크·크립토',
        items: [
            { symbol: 'COIN', name: '코인베이스' },
            { symbol: 'MSTR', name: '마이크로스트래티지' },
            { symbol: 'HOOD', name: '로빈후드' },
            { symbol: 'XYZ', name: '블록' },
            { symbol: 'PYPL', name: '페이팔' },
            { symbol: 'SOFI', name: '소파이' },
            { symbol: 'AFRM', name: '어펌' },
        ],
    },
    {
        id: 'leveraged-etf',
        label: '레버리지 ETF',
        items: [
            { symbol: 'TQQQ', name: '나스닥 3배 롱' },
            { symbol: 'SQQQ', name: '나스닥 3배 숏' },
            { symbol: 'SOXL', name: '반도체 3배 롱' },
            { symbol: 'TSLL', name: '테슬라 2배 롱' },
            { symbol: 'NVDL', name: '엔비디아 2배 롱' },
        ],
    },
    {
        id: 'healthcare-bio',
        label: '헬스케어·바이오',
        items: [
            { symbol: 'LLY', name: '일라이릴리' },
            { symbol: 'NVO', name: '노보노디스크' },
            { symbol: 'UNH', name: '유나이티드헬스' },
            { symbol: 'ISRG', name: '인튜이티브서지컬' },
            { symbol: 'AMGN', name: '암젠' },
        ],
    },
    {
        id: 'quantum-computing',
        label: '양자컴퓨팅',
        items: [
            { symbol: 'IONQ', name: '아이온큐' },
            { symbol: 'LAES', name: '세알시큐리티' },
            { symbol: 'RGTI', name: '리게티' },
            { symbol: 'QBTS', name: '디웨이브' },
            { symbol: 'QUBT', name: '퀀텀컴퓨팅' },
            { symbol: 'IBM', name: 'IBM' },
        ],
    },
    {
        id: 'space',
        label: '우주·항공우주',
        items: [
            { symbol: 'SPCX', name: '스페이스X' },
            { symbol: 'RKLB', name: '로켓랩' },
            { symbol: 'ASTS', name: 'AST스페이스모바일' },
            { symbol: 'LUNR', name: '인튜이티브머신스' },
            { symbol: 'RDW', name: '레드와이어' },
            { symbol: 'PL', name: '플래닛랩스' },
            { symbol: 'SPCE', name: '버진갤럭틱' },
        ],
    },
    {
        id: 'ev-mobility',
        label: 'EV·모빌리티',
        items: [
            // TSLA intentionally duplicated from megacap — it leads both categories
            { symbol: 'TSLA', name: '테슬라' },
            { symbol: 'RIVN', name: '리비안' },
            { symbol: 'NIO', name: '니오' },
            { symbol: 'LCID', name: '루시드' },
            { symbol: 'XPEV', name: '샤오펑' },
            { symbol: 'UBER', name: '우버' },
            { symbol: 'LYFT', name: '리프트' },
        ],
    },
    {
        id: 'energy-industrial',
        label: '에너지·산업재',
        items: [
            { symbol: 'XOM', name: '엑슨모빌' },
            { symbol: 'CVX', name: '셰브론' },
            { symbol: 'OXY', name: '옥시덴탈' },
            { symbol: 'COP', name: '코노코필립스' },
            { symbol: 'CAT', name: '캐터필러' },
            { symbol: 'GE', name: 'GE에어로스페이스' },
            { symbol: 'BA', name: '보잉' },
        ],
    },
    {
        id: 'korea-equity',
        label: '한국 주식',
        items: [
            { symbol: '005930.KS', name: '삼성전자' },
            { symbol: '000660.KS', name: 'SK하이닉스' },
            { symbol: '005380.KS', name: '현대차' },
            { symbol: '373220.KS', name: 'LG에너지솔루션' },
            { symbol: '207940.KS', name: '삼성바이오로직스' },
            { symbol: '035420.KS', name: '네이버' },
            { symbol: '035720.KS', name: '카카오' },
            { symbol: '247540.KQ', name: '에코프로비엠' },
            { symbol: '196170.KQ', name: '알테오젠' },
        ],
    },
];

/**
 * 큐레이션된 카테고리에 적힌 한글 종목명 — 심볼 → 한글명.
 *
 * `korean_tickers` 테이블이 비어 있는 동안의 시드로 쓴다. 한글명은 원래
 * `translateCompanyNames`(Gemini)가 종목 방문 시 lazy하게 채우지만, ISR은 **첫 렌더를
 * 캐시에 굳히므로** 번역이 끝나기 전에 영문 제목(`005930.KS 주가 전망`)이 revalidate
 * 주기 동안 고정된다. 미국 종목은 대부분 이미 번역돼 있어 드러나지 않던 문제가, 전부
 * 신규인 한국 종목에서는 전면적으로 나타난다.
 *
 * 카테고리 상수에 이미 정확한 한글명이 있으므로 새 데이터 소스가 필요 없다.
 */
export const CURATED_KOREAN_NAMES: ReadonlyMap<string, string> = new Map(
    TICKER_CATEGORIES.flatMap(category =>
        category.items.map(item => [item.symbol, item.name] as const)
    )
);

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
    'XYZ',
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
    'PL',
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

    // --- Trending (2026-04-12) ---
    'T',
    'PBR',
    'VZ',
    'CMCSA',
    'ITUB',
    'CSCO',
    'FCX',
    'SNDK',
    'BP',
    'GOOG',

    // --- Trending (2026-04-18) ---
    'ABT',
    'BSX',
    'PBR-A',
    'GLW',
    'SAN',
    'BMY',
    'MDT',
    'HDB',

    // --- Trending (2026-04-27) ---
    'VALE',
    'LYG',
    'CSX',
    'CNQ',
    'KMI',
    'NEE',
    'B',
    'BKR',

    // --- Trending (2026-05-04) ---
    'NOK',
    'CRWV',
    'ET',
    'WBD',
    'MO',
    'BE',
    'SHEL',
    'MCHP',

    // --- Trending (2026-05-11) ---
    'ANET',
    'APH',
    'WDC',
    'CVS',
    'SONY',
    'USB',
    'FTNT',

    // --- Trending (2026-05-19) ---
    'RKLB',
    'MDLZ',
    'NEM',
    'ORLY',
    'TJX',
    'BCS',
    'WMB',
    'DELL',
    'RTX',
    'SO',

    // --- Trending (2026-05-21) ---
    'IBN',
    'ENB',
    'ADI',
    'COF',
    'IBKR',
    'EQNR',
    'INTU',

    // --- Trending (2026-05-23) ---
    'CBRS',
    'D',
    'STM',
    'ASX',
    'CVE',
    'VST',
    'DASH',
    'PGR',

    // --- Trending (2026-06-01) ---
    'AAL',
    'IREN',
    'HPQ',
    'HPE',
    'JOBY',
    'AUR',
    'BMNR',
    'CCL',
    'HBAN',
    'TTD',

    // --- Trending (2026-06-08) ---
    'ONDS',
    'BB',
    'KEEL',
    'RDW',
    'ACHR',
    'SMR',
    'NVTS',
    'OWL',
    'CDE',
    'CIFR',

    // --- Trending (2026-06-15) ---
    'SPCX',
    'ING',

    // --- Trending (2026-06-27) ---
    'TMUS',
    'MNST',
    'SNY',
    'STX',
    'BRK-B',
    'HWM',
    'PLD',
    'ADP',
    'ETN',
    'CM',

    // --- Trending (2026-07-06) ---
    'ACN',
    'JCI',
    'HONA',
    'APP',

    // --- Trending (2026-07-25) ---
    'SKHY',
    'CARR',
    'GSK',
    'SAP',
    'DLR',

    // --- [KR] KOSPI / KOSDAQ (2026-08-16) ---
    // 시가총액 상위 + 코스닥 대표주. 이 목록에 있어야 `evaluateSymbolIndexability`가
    // indexable로 판정하고 sitemap에도 실린다(그 외 종목은 longtail-default-blocked).
    // 전 종목을 넣지 않는 이유: 2026-07 노출 절벽이 thin 콘텐츠 대량 색인에서 비롯됐고,
    // 여기 있는 종목은 차트·펀더멘털·재무가 모두 채워지는 것을 실측으로 확인한 것들이다.
    // 20종목 전부 2026-08-16 yahoo quote 응답으로 상장 상태를 검증했다.
    '005930.KS', // 삼성전자
    '000660.KS', // SK하이닉스
    '005380.KS', // 현대차
    '373220.KS', // LG에너지솔루션
    '207940.KS', // 삼성바이오로직스
    '028260.KS', // 삼성물산
    '105560.KS', // KB금융
    '000270.KS', // 기아
    '055550.KS', // 신한지주
    '012330.KS', // 현대모비스
    '068270.KS', // 셀트리온
    '006400.KS', // 삼성SDI
    '035420.KS', // 네이버
    '051910.KS', // LG화학
    '035720.KS', // 카카오
    '196170.KQ', // 알테오젠
    '086520.KQ', // 에코프로
    '247540.KQ', // 에코프로비엠
    '058470.KQ', // 리노공업
    '403870.KQ', // HPSP
] as const;
