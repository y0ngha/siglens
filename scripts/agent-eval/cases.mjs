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
//   periodStart   (뉴스 케이스) 질문이 말하는 기간 모양: 'month'(최근 1개월) 또는 'week'(이번 주). `newsAligned`가
//                 `get_news`의 `since`가 그 시작에서 ±3일 안인지 본다.
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
        mustNotCall: [],
        checks: ['firstFigureHasDate'],
    },
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
