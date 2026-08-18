import type {
    IndexTicker,
    SectorEtf,
    SectorGroupDef,
    SectorStock,
} from '@y0ngha/siglens-core';

/**
 * `/market/kr` 대시보드의 티커 설정 — 미국판(`dashboard-tickers.ts`)의 한국 대응.
 *
 * 데이터 소스는 yahoo-finance2다(FMP 플랜에 KRX가 없다). `IndexTicker.fmpSymbol`
 * 필드명이 FMP를 가리키지만 core에서는 **"프로바이더 심볼"**이라는 뜻으로 쓰인다 —
 * `getMarketSummary`가 그 값을 그대로 `provider.getQuote()`에 넘긴다. 여기서는
 * yahoo 티커를 담는다. 필드명은 core 타입이라 우리가 바꿀 수 없다.
 *
 * 2026-08-18 전 티커 실호출 확인(quote 200 + 3년 일봉).
 */

/**
 * 코스피200 지수(`^KS200`)는 **의도적으로 뺐다** — yahoo에서 마지막 종가가
 * 2026-07-16에 멈춰 있다(실측). 정체된 카드는 "오늘의 시장"에서 가장 나쁜 종류의
 * 거짓말이라, 넣느니 3개만 보여준다.
 *
 * 원/달러를 넣은 이유: 국내 증시에서 환율은 외국인 수급의 대리 지표라 지수와 같은
 * 줄에서 읽힌다. 미국판의 VIX 자리에 해당하는 "위험 온도계"다.
 */
export const KR_MARKET_INDICES: IndexTicker[] = [
    {
        symbol: 'KS11',
        fmpSymbol: '^KS11',
        displayName: 'KOSPI',
        koreanName: '코스피',
    },
    {
        symbol: 'KQ11',
        fmpSymbol: '^KQ11',
        displayName: 'KOSDAQ',
        koreanName: '코스닥',
    },
    {
        symbol: 'USDKRW',
        fmpSymbol: 'KRW=X',
        displayName: 'USD/KRW',
        koreanName: '원/달러 환율',
    },
];

/**
 * 섹터 대표 ETF 6종. 미국판이 GICS 11 섹터 ETF를 쓰는 것과 달리, 국내에는 GICS
 * 전 섹터를 덮는 유동성 있는 ETF 세트가 없다 — 실제로 거래되는 테마 ETF 중
 * 시가총액 상위 업종을 고른다.
 *
 * `symbol`이 곧 프로바이더 심볼이자 `/{symbol}` 딥링크다(`MarketSummaryPanel`이
 * 섹터 카드를 종목 페이지로 링크한다). `.KS` 접미사가 붙은 canonical 심볼이라
 * 그 링크가 그대로 동작한다.
 */
export const KR_SECTOR_ETFS: SectorEtf[] = [
    { symbol: '091160.KS', sectorName: 'Semiconductor', koreanName: '반도체' },
    { symbol: '305720.KS', sectorName: 'Battery', koreanName: '2차전지' },
    { symbol: '266360.KS', sectorName: 'IT Software', koreanName: '인터넷·SW' },
    { symbol: '091180.KS', sectorName: 'Autos', koreanName: '자동차' },
    { symbol: '091170.KS', sectorName: 'Banks', koreanName: '은행' },
    { symbol: '244580.KS', sectorName: 'Biotech', koreanName: '바이오' },
];

/**
 * 섹터 묶음. 3+3으로 나눈 것은 표시 때문이기도 하다 — `MarketSummaryPanel`이
 * 그룹 크기 3이면 `grid-cols-3`, 아니면 `grid-cols-4`를 쓰므로 3/3이 가장 고르게 찬다.
 */
export const KR_SECTOR_GROUPS: readonly SectorGroupDef[] = [
    { label: '성장·기술', symbols: ['091160.KS', '305720.KS', '266360.KS'] },
    { label: '경기·방어', symbols: ['091180.KS', '091170.KS', '244580.KS'] },
];

/**
 * 신호 스캔 대상 종목 — `shared/config/popular-tickers.ts`의 KR 블록 **20종 그대로**다.
 *
 * 새 심볼을 넣지 않은 것은 의도다. 국내 종목을 하나 추가하면 한글명 시드
 * (`CURATED_KOREAN_NAMES`), 사이트맵 범위(`docs/architecture/SITEMAP_SCOPE.md`),
 * prewarm 회전 대상까지 함께 손봐야 하는데, 그건 이 작업(동선 재편)의 목적과 무관한
 * 파생 작업이다. 섹터당 2~5종으로 얇지만 정직하다 — 확장은 후속 과제.
 *
 * `sectorSymbol`은 **실제 업종**으로 맞춘다. 홈 그리드의 카테고리(`kr-semiconductor`
 * 등)와 1:1로 두지 않은 이유: 삼성SDI는 `반도체·IT` 카테고리에 있지만 배터리 회사라,
 * 카테고리를 그대로 옮기면 `KODEX 반도체` 탭에 배터리주가 섞인다.
 */
export const KR_SECTOR_STOCKS: readonly SectorStock[] = [
    // 반도체 (091160.KS) — 4
    { symbol: '005930.KS', koreanName: '삼성전자', sectorSymbol: '091160.KS' },
    {
        symbol: '000660.KS',
        koreanName: 'SK하이닉스',
        sectorSymbol: '091160.KS',
    },
    { symbol: '058470.KQ', koreanName: '리노공업', sectorSymbol: '091160.KS' },
    { symbol: '403870.KQ', koreanName: 'HPSP', sectorSymbol: '091160.KS' },
    // 2차전지 (305720.KS) — 5
    {
        symbol: '373220.KS',
        koreanName: 'LG에너지솔루션',
        sectorSymbol: '305720.KS',
    },
    { symbol: '051910.KS', koreanName: 'LG화학', sectorSymbol: '305720.KS' },
    { symbol: '006400.KS', koreanName: '삼성SDI', sectorSymbol: '305720.KS' },
    { symbol: '086520.KQ', koreanName: '에코프로', sectorSymbol: '305720.KS' },
    {
        symbol: '247540.KQ',
        koreanName: '에코프로비엠',
        sectorSymbol: '305720.KS',
    },
    // 인터넷·SW (266360.KS) — 2
    { symbol: '035420.KS', koreanName: '네이버', sectorSymbol: '266360.KS' },
    { symbol: '035720.KS', koreanName: '카카오', sectorSymbol: '266360.KS' },
    // 자동차 (091180.KS) — 3
    { symbol: '005380.KS', koreanName: '현대차', sectorSymbol: '091180.KS' },
    { symbol: '000270.KS', koreanName: '기아', sectorSymbol: '091180.KS' },
    {
        symbol: '012330.KS',
        koreanName: '현대모비스',
        sectorSymbol: '091180.KS',
    },
    // 은행·지주 (091170.KS) — 3
    { symbol: '105560.KS', koreanName: 'KB금융', sectorSymbol: '091170.KS' },
    { symbol: '055550.KS', koreanName: '신한지주', sectorSymbol: '091170.KS' },
    { symbol: '028260.KS', koreanName: '삼성물산', sectorSymbol: '091170.KS' },
    // 바이오 (244580.KS) — 3
    {
        symbol: '207940.KS',
        koreanName: '삼성바이오로직스',
        sectorSymbol: '244580.KS',
    },
    { symbol: '068270.KS', koreanName: '셀트리온', sectorSymbol: '244580.KS' },
    { symbol: '196170.KQ', koreanName: '알테오젠', sectorSymbol: '244580.KS' },
];
