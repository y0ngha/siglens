import type { CategoryId, TickerCategory } from '@/shared/lib/types';

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
            { symbol: 'LAES', name: '실스큐' },
            { symbol: 'RGTI', name: '리게티 컴퓨팅' },
            { symbol: 'QBTS', name: '디웨이브 퀀텀' },
            { symbol: 'QUBT', name: '퀀텀 컴퓨팅' },
            { symbol: 'IBM', name: 'IBM' },
        ],
    },
    {
        id: 'space',
        label: '우주·항공우주',
        // SpaceX(SPCX)는 여기 없다 — SpaceX는 비상장이고, SPCX는 그 이름을 딴
        // SPAC/신규 발행 ETF다. 대체할 진짜 SpaceX 티커가 없으므로 빼기만 한다
        // (SEO 감사 라운드 2 finding 1 — 카테고리 그리드가 이 심볼을 SpaceX로 표기해
        // Corporation JSON-LD까지 펀드를 회사로 잘못 단언하고 있었다).
        items: [
            { symbol: 'RKLB', name: '로켓랩' },
            { symbol: 'ASTS', name: 'AST 스페이스모바일' },
            { symbol: 'LUNR', name: '인튜이티브 머신스' },
            { symbol: 'RDW', name: '레드와이어' },
            { symbol: 'PL', name: '플래닛 랩스' },
            { symbol: 'SPCE', name: '버진 갤럭틱' },
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
        id: 'kr-semiconductor',
        label: '반도체·IT',
        // 아래 여섯 개 KR 카테고리의 종목 합집합은 `POPULAR_TICKERS`의 KR 블록과
        // **정확히 같아야 한다.**
        //
        // 이 그리드(`widgets/home/TickerCategories` → `CategoryCardGrid`)가 저장소
        // 전체에서 한국 종목 페이지로 가는 **유일한 크롤 가능한 `<a>`**다. 검색
        // 자동완성은 `<button>` + `router.push`라 링크가 아니고, 크로스링크 카드는
        // 같은 심볼의 다른 탭만 잇는다. 여기 빠진 종목은 sitemap에만 있는 고아가 된다.
        //
        // 두 번째 이유는 `CURATED_KOREAN_NAMES`다. 이 배열에서 파생되므로, 빠진
        // 종목은 한글명 폴백이 없어 `korean_tickers`가 아직 비어 있는 콜드 ISR
        // 생성에서 `006400.KS 주가 전망` 같은 영문 티커 제목이 캐시에 굳는다.
        items: [
            { symbol: '005930.KS', name: '삼성전자' },
            { symbol: '000660.KS', name: 'SK하이닉스' },
            { symbol: '006400.KS', name: '삼성SDI' },
        ],
    },
    {
        id: 'kr-auto-battery',
        label: '자동차·2차전지',
        items: [
            { symbol: '005380.KS', name: '현대차' },
            { symbol: '000270.KS', name: '기아' },
            { symbol: '012330.KS', name: '현대모비스' },
            { symbol: '373220.KS', name: 'LG에너지솔루션' },
            { symbol: '051910.KS', name: 'LG화학' },
        ],
    },
    {
        id: 'kr-bio',
        label: '바이오·헬스케어',
        items: [
            { symbol: '207940.KS', name: '삼성바이오로직스' },
            { symbol: '068270.KS', name: '셀트리온' },
        ],
    },
    {
        id: 'kr-platform',
        label: '인터넷·플랫폼',
        items: [
            { symbol: '035420.KS', name: '네이버' },
            { symbol: '035720.KS', name: '카카오' },
        ],
    },
    {
        id: 'kr-finance',
        label: '금융·지주',
        items: [
            { symbol: '105560.KS', name: 'KB금융' },
            { symbol: '055550.KS', name: '신한지주' },
            { symbol: '028260.KS', name: '삼성물산' },
        ],
    },
    {
        id: 'kr-kosdaq',
        label: '코스닥',
        items: [
            { symbol: '196170.KQ', name: '알테오젠' },
            { symbol: '086520.KQ', name: '에코프로' },
            { symbol: '247540.KQ', name: '에코프로비엠' },
            { symbol: '058470.KQ', name: '리노공업' },
            { symbol: '403870.KQ', name: 'HPSP' },
        ],
    },
];

/**
 * 한국 상장 종목을 담는 카테고리 id 집합.
 *
 * 홈 그리드는 이 집합으로 미국/한국 섹션을 가른다. 그런데 이걸 `id.startsWith('kr-')`
 * 같은 **작명 규칙**으로 판정하면 규칙을 어긴 새 카테고리(`korea-fintech` 등)가
 * 타입 검사도 통과하고, 조용히 `미국 섹터별 인기 종목` 밑에 렌더되며, 합집합
 * 불변식 검사(`popular-tickers.test.ts`)도 함께 빠져나간다 — 그게 바로 이 파일이
 * 막으려는 SEO 고아다. 명시 집합으로 두면 카테고리를 추가할 때 미국/한국 판단을
 * 강제로 한 번 하게 된다.
 */
export const KR_CATEGORY_IDS: ReadonlySet<CategoryId> = new Set([
    'kr-semiconductor',
    'kr-auto-battery',
    'kr-bio',
    'kr-platform',
    'kr-finance',
    'kr-kosdaq',
]);

/**
 * 큐레이션된 카테고리에 적힌 한글 종목명 — 심볼 → 한글명.
 *
 * `korean_tickers` 테이블이 비어 있는 동안의 시드로 쓴다. 한글명은 원래
 * `translateCompanyNames`가 종목 방문 시 lazy하게 채우지만, ISR은 **첫 렌더를
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
    // SPCX 제거(SEO 감사 라운드 2 finding 1) — SpaceX가 아니라 SPAC/신규 발행 ETF.
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
    // SKHY 제거(SEO 감사 라운드 2 finding 2) — SK하이닉스 OTC ADR. KRX 원주(000660.KS)와
    // 같은 회사를 두 클러스터로 쪼개고 있었고, 한국어 검색 수요·Naver 뉴스 소스는
    // 원주 쪽에만 있다.
    'CARR',
    'GSK',
    'SAP',
    'DLR',

    // --- [13] /market 섹터 허브가 링크하는 대상 (2026-08-24) ---
    // `/market`은 색인된 허브인데, 그 섹터 그리드가 링크하는 이 23개가 전부
    // `longtail-default-blocked`(noindex)였다. 실측(2026-08-24): 23개 모두
    // 200 + `noindex, nofollow` + 본문 893~1,131자 — 크롤 예산은 쓰면서 색인은
    // 되지 않고, 허브의 ItemList JSON-LD가 가리키는 대상이 색인 불가인 상태다.
    //
    // 이건 롱테일 재개방이 아니다. `SECTOR_ETFS`(11) + `SECTOR_STOCKS`(80)에서
    // 이미 화이트리스트에 있는 것을 뺀 **차집합 전부**이고, 전원 SPDR 섹터 ETF
    // 또는 S&P 500 대형주라 차트·펀더멘털·재무가 모두 채워진다. prewarm
    // 유니버스는 312 → 335가 되고, 야간 처리량(틱 ~90 × SYMBOLS_PER_TICK 6
    // ≈ 540 슬롯)에 여유가 있다.
    //
    // 불변식: 이 블록의 합집합 = `SECTOR_ETFS` ∪ `SECTOR_STOCKS` − (다른 블록).
    // `__tests__/marketHubIndexability.test.ts`가 강제한다 — dashboard 그리드에 심볼을 더하면
    // 여기에도 더해야 하고, 안 그러면 또 색인 불가 링크가 생긴다.
    'XLK', // 기술 섹터 ETF
    'XLF', // 금융 섹터 ETF
    'XLE', // 에너지 섹터 ETF
    'XLV', // 헬스케어 섹터 ETF
    'XLY', // 경기소비재 섹터 ETF
    'XLP', // 필수소비재 섹터 ETF
    'XLI', // 산업재 섹터 ETF
    'XLB', // 소재 섹터 ETF
    'XLU', // 유틸리티 섹터 ETF
    'XLRE', // 부동산 섹터 ETF
    'XLC', // 통신서비스 섹터 ETF
    'PM', // 필립모리스
    'UNP', // 유니온퍼시픽
    'LIN', // 린데
    'APD', // 에어프로덕츠
    'ECL', // 에코랩
    'DUK', // 듀크에너지
    'AEP', // 아메리칸일렉트릭파워
    'EXC', // 엑셀론
    'AMT', // 아메리칸타워
    'EQIX', // 에퀴닉스
    'CCI', // 크라운캐슬
    'PSA', // 퍼블릭스토리지

    // --- [14] GSC 실측 수요 기반 (2026-08-24) ---
    // 추정이 아니라 실측으로 뽑았다. GSC `실적 > 페이지` 90일 상위 1,000행에서
    // 심볼 850종을 집계하고, 화이트리스트 밖 상위 96종에 대해
    //   · `/{sym}` 봇 SSR 길이 (콘텐츠 깊이)
    //   · `/{sym}/fundamental`·`/financials` SSR 길이 (데이터 가용성)
    //   · 같은 페이지가 렌더하는 시가총액 (규모)
    // 을 프로덕션 Googlebot UA로 전수 측정했다. 아래 주석의 노출·시총은 그 실측값이다.
    //
    // ⚠️ 여기 넣는다는 건 매일 밤 prewarm이 LLM 분석을 돌린다는 뜻이다. 넣기 전
    // 이 심볼들의 봇 SSR은 645~1,239자로, 색인 중인 화이트리스트(2,399~3,726자,
    // 중앙값 3,042)의 절반도 안 된다 — 얇아서 못 넣는 게 아니라 **안 넣어서 얇다**.
    // 스냅샷이 붙기 전까지는 `hasSnapshot` 게이트가 degraded 페이지를 계속 막는다.
    //
    // ⚠️ 용량: 유니버스 335 → 431. 야간 처리량은 틱 약 90회 × SYMBOLS_PER_TICK 6
    // ≈ 540 심볼-슬롯이라 이론 가동률이 62% → 80%로 오른다. 실제 처리량은 in-flight
    // 점유와 터미널 6h 백오프 때문에 이론보다 낮으므로, 배포 후
    // `[seo-prewarm] batch done`의 `remaining`이 매일 밤 0으로 수렴하는지 반드시
    // 확인한다. 수렴하지 않으면 기존 종목 스냅샷이 낡는다 — 그때는 SYMBOLS_PER_TICK을
    // 올리거나 아래 C 구간부터 줄인다(노출 기준 내림차순이라 뒤에서부터 자르면 된다).
    //
    // ⚠️ C 구간(페니주·SPAC·워런트·뮤추얼펀드·2배 단일종목 ETF)은 2026-07 절벽에서
    // 지목된 종목군과 형태가 같다. 수요는 실측으로 가장 크지만(90일 노출 4372),
    // 색인 가치가 있는지는 코드가 아니라 관측으로만 갈린다. GSC `크롤링됨-미색인`이
    // 늘거나 사이트 평균 순위가 나빠지면 이 구간이 첫 롤백 대상이다.

    // A: 미국 정규 상장 ETF — 90일 노출 1349
    'SOXX', // 반도체 ETF · 203노출 · 시총 $461.0억
    'TLT', // 미국 장기국채 ETF · 199노출 · 시총 $414.8억
    'QQQM', // 인베스코 나스닥 100 ETF · 161노출 · 시총 $792.8억
    'SCHD', // 배당 ETF (슈왑) · 98노출 · 시총 $1004.8억
    'SOXQ', // 인베스코 필라델피아 반도체 ETF · 90노출 · 시총 $27.4억
    'AGQ', // 프로셰어즈 울트라 실버 · 83노출 · 시총 $16.0억
    'SPYG', // 79노출 · 시총 $535.6억
    'FTEC', // 피델리티 MSCI 정보 기술 지수 ETF · 77노출 · 시총 $170.5억
    'UCO', // 프로셰어즈 울트라 블룸버그 원유 · 74노출 · 시총 $5.4억
    'SGOL', // 아브던 피지컬 골드 셰어즈 ETF · 62노출 · 시총 $77.3억
    'SLV', // 은 ETF · 46노출 · 시총 $337.5억
    'QLD', // 프로셰어즈 울트라 QQQ · 35노출 · 시총 $109.2억
    'ROM', // 프로셰어스 울트라 테크놀로지 · 34노출 · 시총 $7.9억
    'NLR', // 반엑 코리아 우라늄 핵 에너지 ETF · 34노출 · 시총 $28.7억
    'EWY', // 아이셰어즈 MSCI 한국 ETF · 31노출 · 시총 $134.8억
    'BCAT', // 블랙록 캐피탈 알로케이션 트러스트 · 43노출 · 시총 $16.7억

    // A: 미국 정규 상장 주식 — 90일 노출 896
    'CNC', // 센테인 코퍼레이션 · 30노출 · 시총 $321.2억
    'PEN', // 펜브라 · 95노출 · 시총 $128.1억
    'AEIS', // 어드밴스드 에너지 인더스트리즈 · 30노출 · 시총 $114.5억
    'ARW', // 애로우 일렉트로닉스 · 35노출 · 시총 $107.8억
    'AAOI', // 애플라이드 옵토일렉트로닉스 · 183노출 · 시총 $100.2억
    'ALTR', // 알테어 엔지니어링 · 50노출 · 시총 $96.3억
    'BAH', // 부즈 앨런 해밀턴 · 50노출 · 시총 $92.7억
    'AVT', // 애브넷 · 166노출 · 시총 $72.7억
    'ALTM', // 아카디움 리튬 · 81노출 · 시총 $62.9억
    'ESMT', // 인게이지스마트 · 67노출 · 시총 $38.8억
    'ARCB', // 아크베스트 · 39노출 · 시총 $31.4억
    'NLST', // 넷리스트 · 31노출 · 시총 $17.0억
    'RCAT', // 레드캣 홀딩스 · 39노출 · 시총 $14.6억

    // B: OTC/ADR — 한국 투자자 검색 수요가 실측되는 해외 종목. 90일 노출 786
    //    (NBMFF·SLROF는 OTC라 여기 묶였지만 시총 $20~30M 마이크로캡이라 성격이 C에 가깝다)
    'AIQUY', // 에어리퀴드 · 229노출 · 시총 $1237.1억
    'DCNSF', // 다이이치 생명 홀딩스 · 101노출 · 시총 $396.2억
    'STMNF', // 스미토모 금속 광산 · 135노출 · 시총 $168.8억
    'ASMVF', // ASMPT · 43노출 · 시총 $88.1억
    'ARKAY', // 아케마 · 42노출 · 시총 $52.6억
    'TOSCF', // 토소 코퍼레이션 · 47노출 · 시총 $49.3억
    'HPHTY', // 하마마츠 포토닉스 · 80노출 · 시총 $39.1억
    'ORAAF', // 아우라 미네랄스 · 42노출 · 시총 $20.0억
    'NBMFF', // 네오 배터리 머티리얼즈 · 35노출 · 시총 $0.2억
    'SLROF', // 스텔라 리소스 리미티드 · 32노출 · 시총 $0.3억

    // C: 페니주·SPAC·워런트·뮤추얼펀드·2배 단일종목 ETF — 90일 노출 4372
    //    노출 내림차순. 용량이 모자라면 뒤에서부터 자른다.
    'QSPT', // QSPT · 577노출 · 시총 $6.4억
    'GPUS', // 하이퍼스케일 데이터 · 242노출 · 시총 $0.4억
    'MRVU', // 디렉션 데일리 MRVL 불 2X ETF · 198노출 · 시총 $0.1억
    'MUU', // 디렉션 데일리 MU 불 2X ETF · 196노출 · 시총 $16.8억
    'SOI', // 솔라리스 오일필드 인프라스트럭처 · 191노출 · 시총 $5.0억
    'OPGN', // 옵젠 · 188노출 · 시총 $2.4억
    'MVLL', // 126노출 · 시총 $3.7억
    'CUPR', // 125노출 · 시총 $0.1억
    'MSTY', // 105노출 · 시총 $8.2억
    'ORCX', // 데일리 타겟 2X 롱 ORCL ETF · 102노출 · 시총 $3.1억
    'RKLZ', // 90노출 · 시총 $0.0억
    'ASBP', // 아스파이어 바이오파마 홀딩스 · 89노출 · 시총 $0.0억
    'CTK', // 쿠테크 · 84노출 · 시총 $0.0억
    'RAM', // 아리스 I 인수 법인 · 83노출 · 시총 $5.0억
    'DYFN', // 82노출 · 시총 $0.7억
    'RKLX', // 데일리 타겟 2X 롱 RKLB ETF · 74노출 · 시총 $0.4억
    'CERO', // 세로 테라퓨틱스 홀딩스 · 71노출 · 시총 $0.0억
    'TLIIX', // 71노출 · 시총 $6.5억
    'BTDG', // 비투디지털 · 65노출 · 시총 $0.0억
    'CLAA', // 콜로네이드 애퀴지션 II · 65노출 · 시총 $4.2억
    'RGTIW', // 리게티 컴퓨팅 · 61노출 · 시총 $63.2억
    'PSMC', // 58노출 · 시총 $0.1억
    'EDHL', // 에버브라이트 디지털 홀딩스 · 57노출 · 시총 $0.1억
    'AMZE', // 어메이즈 홀딩스 · 57노출 · 시총 $0.0억
    'HVBC', // HV 방코프 · 56노출 · 시총 $0.8억
    'BSTG', // 바이오스테이지 · 53노출 · 시총 $0.6억
    'ASSF', // 어시스티드 포 리빙 · 52노출 · 시총 $0.5억
    'FFFVX', // 피델리티 프리덤 2005 · 50노출 · 시총 $6.2억
    'GTS', // 트리플-S 매니지먼트 · 50노출 · 시총 $0.0억
    'CSOC', // 카두세우스 소프트웨어 시스템즈 · 49노출 · 시총 $0.0억
    'ASTC', // 애스트로테크 · 49노출 · 시총 $0.2억
    'GLXG', // 갤럭시 페이롤 그룹 · 47노출 · 시총 $0.0억
    'RGTX', // 데일리 타겟 2X 롱 RGTI ETF · 46노출 · 시총 $0.1억
    'ENTF', // 46노출 · 시총 $1.6억
    'SRYB', // 서리뱅코프 · 43노출 · 시총 $0.7억
    'PLTY', // 42노출 · 시총 $4.1억
    'MX', // 매그나칩반도체 · 42노출 · 시총 $1.2억
    'IONZ', // 데일리 타겟 2X 숏 IONQ ETF · 41노출 · 시총 $0.1억
    'CPOP', // 팝 컬처 그룹 · 41노출 · 시총 $0.0억
    'SDOT', // 사돗 그룹 · 39노출 · 시총 $0.1억
    'TRPSX', // 37노출 · 시총 $67.5억
    'NEWTI', // 뉴텍원 · 37노출 · 시총 $4.3억
    'DIRV', // 다이렉트뷰 홀딩스 · 37노출 · 시총 $0.0억
    'BGMS', // 바이오 그린 메드 솔루션 · 36노출 · 시총 $0.0억
    'INHD', // 이노 홀딩스 · 36노출 · 시총 $0.3억
    'NOWL', // 35노출 · 시총 $2.4억
    'ELYM', // 엘리엠 테라퓨틱스 · 35노출 · 시총 $3.4억
    'TNEN', // 트루 노스 에너지 · 35노출 · 시총 $0.0억
    'SLRK', // 솔레라 내셔널 뱅코프 · 33노출 · 시총 $0.9억
    'BNAIW', // 브랜드 엔게이지먼트 네트워크 · 32노출 · 시총 $0.1억
    'SWAR', // 32노출 · 시총 $0.0억
    'GMEI', // 갬빗 에너지 · 32노출 · 시총 $0.0억
    'HSCS', // 하트사이언시스 · 32노출 · 시총 $0.1억
    'XDIV', // 30노출 · 시총 $0.8억
    'QTOP', // 아이셰어즈 나스닥 탑 30 종목 ETF · 30노출 · 시총 $2.8억
    'UNBX', // 유니티 바이오테크놀로지 · 30노출 · 시총 $0.0억
    'LENZ', // 렌즈 테라퓨틱스 · 30노출 · 시총 $1.5억

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
