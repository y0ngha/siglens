// SiglensAI 에이전트 회귀 평가 케이스 (로컬 전용, 실제 provider 사용 — CI에서 돌지 않는다).
//
// 질문 모양은 운영에서 실제로 틀렸던 유형과 같고, 종목은 일부러 다른 것을 골랐다. 값은 저장된 도구 행에서
// 읽으므로 시장 날짜에 의존하지 않는다. `fail` 검사는 하드, `review` 줄은 사람이 읽는 판정용이다.
//
// 케이스 모양
//   id            고유 이름. conv 케이스의 턴은 `<id>-t<n>`으로 불린다.
//   question      그대로 보낼 한국어 질문.
//   mustCall      그 턴에 호출돼야 하는 도구 이름 목록.
//   mustNotCall   호출되면 안 되는 도구 이름 목록.
//   checks        checks.mjs `CHECKS`에 등록된 이름 목록.
//   turns         (conv만) 같은 대화에서 이어 보내는 턴 목록 — 각 턴은 question/mustCall/mustNotCall/checks.
//   cache         (conv만) true면 `--cache`일 때만 돈다.
//   mustCallAny   그 턴에 이 중 하나는 호출돼야 하는 도구 이름 목록.
//   reviewIfCalled 호출되면 실패가 아니라 리뷰 줄을 남기는 도구 이름 목록(경계 케이스).
//   expectArgs    (가격 통계) 어느 한 `get_price_stats` 호출이 모두 만족해야 하는 인자. 키는 `checks.mjs`
//                 `argMismatches` 주석 참고: symbols, index, period('ytd'는 from 연초 근처도 허용), defaultPeriod,
//                 year('previous'=작년), from, datesInclude, noWindow.
//   periodStart   (뉴스 케이스) 질문이 말하는 기간 모양: 'month'(최근 1개월) 또는 'week'(이번 주). `newsAligned`가
//                 `get_news`의 `since`가 그 시작에서 ±3일 안인지 본다.
//
// WP-09 케이스(ps-*, b-*)의 종목·날짜는 저자가 정했다(벤치마크 항목 아님). 날짜 케이스의 날짜(2026-07-03 금·2026-10-05 월 등)는
// 검증자가 돌리기 전에 세션 유무를 확인한다 — 어느 쪽이든 `priceStatsDates`가 status별로 판정한다.
//
// WP-08 케이스(news-*, pc-*, levels-*, holder-*)의 종목은 저자가 고른 것이다. news-month-*는 창 안에 중앙값의 2배 이상
// 일변동이 있는 종목이어야 의미가 있으므로 검증자가 돌리기 전에 확인한다(맞지 않으면 moveDays가 비어 review 줄로 알려 준다).
//
// 종목 선택 메모: div-* 는 최근 배당금이 소수 셋째 자리 이상인 종목을 골랐다. 오래된 기억에 의존한 선택이라
// 검증자가 돌리기 전에 확인한다(맞지 않으면 checks의 `dividendVerbatim`이 review 줄로 알려 준다).

const oscillatorQuestion = symbol =>
    `${symbol}가 지금 지표상 과매도(과매수) 구간인지 RSI, 스토캐스틱 등으로 설명해줘.`;
const trendQuestion = symbol =>
    `${symbol}의 일봉 기준 추세(향후 수 주 관점)를 기술적 지표로 판단해줘.`;
const dividendQuestion = symbol =>
    `${symbol}의 가장 최근 배당락일과 주당 배당금은?`;
const monthNewsQuestion = symbol =>
    `${symbol}의 최근 1개월 주가 흐름을 뉴스와 함께 설명해줘.`;
const weekNewsQuestion = symbol => `${symbol} 이번 주 왜 빠졌어?`;
const putCallQuestion = symbol =>
    `${symbol}의 옵션 풋콜 비율로 시장 포지셔닝을 설명해줘.`;
const levelsQuestion = symbol => `${symbol} 일봉 기준 가까운 지지선과 저항선`;
const holderQuestion = (holder, symbol) =>
    `${holder}가 가장 최근 13F 기준으로 ${symbol}를 몇 주 보유하고 있어?`;
const earningsQuestion = symbol =>
    `${symbol}의 다음 실적 발표 전후 주가 변동성 위험을 정리해줘(발표일, 과거 반응 포함).`;

export const CASES = [
    ...['AMD', 'KO', 'PYPL'].map((symbol, i) => ({
        id: `osc-${i + 1}`,
        question: oscillatorQuestion(symbol),
        mustCall: ['get_bars_indicators'],
        mustNotCall: [],
        checks: ['oscillatorsNamed'],
    })),
    ...['MSFT', 'NFLX'].map((symbol, i) => ({
        id: `trend-${i + 1}`,
        question: trendQuestion(symbol),
        mustCall: ['get_bars_indicators'],
        mustNotCall: [],
        reviewIfCalled: ['get_price_stats'],
        checks: ['firstFigureHasDate'],
    })),
    {
        id: 'kr-month',
        question:
            'NAVER(035420)의 최근 1개월 주가 흐름을 뉴스·공시와 함께 설명해줘.',
        mustCall: ['get_bars_indicators', 'get_news'],
        mustNotCall: [],
        checks: ['firstFigureHasDate'],
    },
    ...['O', 'T', 'PFE'].map((symbol, i) => ({
        id: `div-${i + 1}`,
        question: dividendQuestion(symbol),
        mustCall: ['get_fundamentals'],
        mustNotCall: [],
        checks: ['dividendVerbatim'],
    })),
    ...['ADBE', 'CRM'].map((symbol, i) => ({
        id: `earn-${i + 1}`,
        question: earningsQuestion(symbol),
        mustCall: ['get_fundamentals'],
        mustNotCall: [],
        checks: ['earningsReview', 'earningsTally'],
    })),
    ...['삼성전자(005930)', '현대차(005380)', 'JPM', 'COST'].map(
        (symbol, i) => ({
            id: `news-month-${i + 1}`,
            question: monthNewsQuestion(symbol),
            mustCall: ['get_bars_indicators', 'get_news'],
            mustNotCall: [],
            periodStart: 'month',
            checks: ['newsAligned', 'firstFigureHasDate'],
        })
    ),
    {
        id: 'news-why-1',
        question: weekNewsQuestion('ORCL'),
        mustCall: ['get_bars_indicators', 'get_news'],
        mustNotCall: [],
        periodStart: 'week',
        checks: ['newsAligned'],
    },
    ...['WMT', 'BA'].map((symbol, i) => ({
        id: `pc-${i + 1}`,
        question: putCallQuestion(symbol),
        mustCall: ['get_options_summary'],
        mustNotCall: [],
        checks: ['putCallSide'],
    })),
    ...['INTC', 'DIS'].map((symbol, i) => ({
        id: `levels-${i + 1}`,
        question: levelsQuestion(symbol),
        mustCall: ['get_cached_analysis'],
        mustNotCall: [],
        checks: ['levelsNearest'],
    })),
    // 이름 지정 기관 보유: 첫 호출에 holder를 실어야 하고, 조회가 found면 답변이 주수·기준 분기를 그대로 말해야 한다.
    // 로컬 e2e DB에는 13F 행이 없어(조회가 no_matching_filer) 주수 검사는 평가 불가로 나온다 — 그 부분은 저장 대화 재생(E1)이 맡는다.
    ...[
        ['Two Sigma', 'AMD'],
        ['Vanguard Group', 'NVDA'],
    ].map(([holder, symbol], i) => ({
        id: i === 0 ? 'holder' : `holder-${i + 1}`,
        question: holderQuestion(holder, symbol),
        mustCall: ['get_investor_flows'],
        mustNotCall: [],
        holder,
        checks: ['noOffer', 'holderLookupUsed'],
    })),
    // WP-09: 가격 통계. 기간 수익률·연환산·낙폭·특정 날짜 종가·상관계수는 get_price_stats 한 번으로 묻는다.
    ...[
        ['ps-ytd-1', 'AAPL 올해 수익률 얼마야?', { period: 'ytd' }],
        [
            'ps-ytd-2',
            'SK하이닉스(000660) 연초 대비 몇 % 올랐어?',
            { period: 'ytd' },
        ],
        [
            'ps-idx-1',
            '코스피 올해 몇 % 올랐어?',
            { index: 'kospi', period: 'ytd' },
        ],
        [
            'ps-idx-2',
            'S&P 500 최근 10년 연평균 수익률은?',
            { index: 'sp500', period: '10y' },
        ],
        ['ps-year-1', 'NVDA 작년 한 해 수익률은?', { year: 'previous' }],
        [
            'ps-cagr-1',
            'KO 최근 10년 동안 연평균 몇 % 올랐어?',
            { period: '10y' },
        ],
        ['ps-mdd-1', '카카오(035720) 올해 최대 낙폭은?', { period: 'ytd' }],
        [
            'ps-since-1',
            'TSLA를 2026년 3월 2일에 샀으면 지금 몇 % 수익이야?',
            { from: '2026-03-02' },
        ],
        [
            'ps-cmp-1',
            'AAPL, MSFT, GOOGL 올해 수익률 비교해줘',
            { symbols: ['AAPL', 'MSFT', 'GOOGL'], period: 'ytd' },
        ],
        [
            'ps-crypto-1',
            'BTCUSD 올해 수익률이랑 올해 최고 종가 알려줘',
            { period: 'ytd' },
        ],
    ].map(([id, question, expectArgs]) => ({
        id,
        question,
        mustCall: ['get_price_stats'],
        mustNotCall: [],
        expectArgs,
        checks: [
            'priceStatsSelection',
            'priceFigures',
            'noAnnualRateUnderYear',
        ],
    })),
    ...[
        [
            'ps-date-1',
            'MSFT 2026년 7월 3일 종가는?',
            { datesInclude: ['2026-07-03'], noWindow: true },
        ],
        [
            'ps-date-2',
            '현대차(005380) 2026년 10월 5일 종가 알려줘',
            { datesInclude: ['2026-10-05'] },
        ],
    ].map(([id, question, expectArgs]) => ({
        id,
        question,
        mustCall: ['get_price_stats'],
        mustNotCall: [],
        expectArgs,
        checks: ['priceStatsSelection', 'priceFigures', 'priceStatsDates'],
    })),
    ...[
        [
            'ps-corr-1',
            'AMD랑 NVDA 최근 1년 상관관계는?',
            { symbols: ['AMD', 'NVDA'], period: '1y', defaultPeriod: true },
        ],
        [
            'ps-corr-2',
            '삼성전자(005930)랑 NVDA는 같이 움직여?',
            { symbols: ['005930', 'NVDA'] },
        ],
    ].map(([id, question, expectArgs]) => ({
        id,
        question,
        mustCall: ['get_price_stats'],
        mustNotCall: [],
        expectArgs,
        checks: ['priceStatsSelection', 'correlationNoCause'],
    })),
    {
        id: 'ps-1y-1',
        question: 'AAPL 작년 이맘때 대비 몇 % 올랐어?',
        mustCall: [],
        mustCallAny: ['get_bars_indicators', 'get_price_stats'],
        mustNotCall: [],
        checks: [],
    },
    // 경계: 인접 도구의 질문은 가격 통계로 새면 안 된다.
    {
        id: 'b-idxh-1',
        question: 'S&P 500 역대 연간 수익률 중 가장 나빴던 해는?',
        mustCall: ['get_index_history_stats'],
        mustNotCall: ['get_price_stats'],
        checks: [],
    },
    {
        id: 'b-swing-1',
        question: 'NVDA 최근 10년간 20% 넘는 조정은 몇 번 있었어?',
        mustCall: ['get_swing_history'],
        mustNotCall: ['get_price_stats'],
        checks: [],
    },
    {
        id: 'b-52w-1',
        question: 'AAPL 52주 최고가는 언제였어?',
        mustCall: ['get_bars_indicators'],
        mustNotCall: [],
        reviewIfCalled: ['get_price_stats'],
        checks: [],
    },
    {
        id: 'clock',
        question: '지금 미국장 열려 있어? 다음 개장은 언제야?',
        mustCall: [],
        mustNotCall: [],
        checks: ['clockBoundary', 'noWrongZoneConversion'],
    },
    {
        id: 'quote',
        question: 'AMZN 지금 얼마야?',
        mustCall: ['get_quote'],
        mustNotCall: ['get_price_stats'],
        checks: ['firstFigureHasDate'],
    },
    // WP-09 notes: null 규칙이 도구 설명에서 결과 `notes`로 옮겨 갔다. 두 변형(OLD 설명 규칙 / NEW notes)에 같은 질문을 던져 퇴행이 없는지 본다.
    // 기존 div-1..3(`dividendVerbatim`)도 같은 목적으로 함께 돈다. 아래 케이스의 종목 전제(상장이 짧음, 비배당)는 오래된 기억에
    // 의존한 선택이라 검증자가 돌리기 전에 저장 행으로 확인한다 — 전제가 틀리면 각 검사가 실패가 아니라 평가 불가로 알린다.
    {
        id: 'n-streak-1',
        question: 'AAPL 4시간봉 기준으로 며칠 연속 올랐어?',
        mustCall: ['get_bars_indicators'],
        mustNotCall: [],
        checks: ['streakNotFromOtherTimeframe'],
    },
    {
        // 상장 후 약 450세션 미만인 종목(검증자가 저장 행의 derived.maCross50_200이 null인지 확인한다).
        // CRCL(2025-06 상장)은 약 2027-03에 452세션에 닿아 스캔이 끝난다. 그 뒤에는 이 케이스가 평가 불가로만 나오니 더 최근 상장 종목으로 바꾼다.
        id: 'n-cross-1',
        question: 'CRCL 최근 1년 안에 골든크로스 있었어?',
        mustCall: ['get_bars_indicators'],
        mustNotCall: [],
        checks: ['crossNotDeniedOnShortHistory'],
    },
    {
        id: 'n-div-1',
        question: 'AMZN 배당금 얼마 줘?',
        mustCall: ['get_fundamentals'],
        // web_search는 `nonPayerSaysNone`이 판정한다: 저장된 배당이 확정 무배당 모양일 때만 호출이 실패다.
        mustNotCall: [],
        checks: ['nonPayerSaysNone'],
    },
    {
        id: 'n-earn-1',
        question:
            '삼성전자(005930) 다음 실적 발표는 장 시작 전이야, 끝난 뒤야?',
        mustCall: ['get_fundamentals'],
        mustNotCall: [],
        checks: ['earningsTimingNotInvented'],
    },
    // US 종목: 저장 결과가 `earningsSessionUnknown` 조건(날짜는 있고 earningsSession 없음)이어야 시험된다. 아니면 검사가 평가 불가로 알린다.
    ...['AMZN', 'O'].map((symbol, i) => ({
        id: `n-earn-${i + 2}`,
        question: `${symbol} 다음 실적 발표는 장 시작 전이야, 끝난 뒤야?`,
        mustCall: ['get_fundamentals'],
        mustNotCall: [],
        checks: ['earningsTimingNotInvented'],
    })),
    {
        id: 'conv',
        cache: true,
        turns: [
            {
                question: trendQuestion('AAPL'),
                mustCall: ['get_bars_indicators'],
                mustNotCall: [],
                checks: [],
            },
            {
                question: '주봉으로 보면?',
                mustCall: [],
                mustNotCall: [],
                checks: ['cachedPrefix'],
            },
            {
                question: '거래량은?',
                mustCall: [],
                mustNotCall: [],
                checks: ['cachedPrefix'],
            },
            {
                question: '오늘 무슨 요일이고 한국장은 언제 열려?',
                mustCall: [],
                mustNotCall: [],
                checks: [
                    'cachedPrefix',
                    'weekdayAndKrxBoundary',
                    'noWrongZoneConversion',
                ],
            },
        ],
    },
];
