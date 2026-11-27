import {
    AGENT_HISTORY_INDICES,
    type AgentToolDefinition,
} from '@y0ngha/siglens-core';

/**
 * `get_index_history_stats` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_INDEX_HISTORY_STATS_SPEC: AgentToolDefinition = {
    name: 'get_index_history_stats',
    description: `Long-run statistics of a stock index from month-end closes: sp500 (S&P 500, from 1950), nasdaq (Nasdaq Composite, from 1971), kospi (from the end of 1996) and kosdaq (from late 2000). Returns {asOf, index, firstMonth, lastMonth, firstFullYear, lastFullYear, annual [{year, returnPct, maxDrawdownPct}], annualSummary {samples, positive, avgPct, medianPct, positivePct}, monthly [{month (1–12), samples, positive, avgPct, medianPct, positivePct}] (each calendar month's own return), presidentialCycle (US indices only, otherwise null) [{position (post_election, midterm, pre_election, election), years, samples, positive, avgPct, medianPct, positivePct}] — calendar-year returns of those years — and midtermForward12m (US indices only, otherwise null) {rows [{year, returnPct}] from the end of October of each midterm year to a year later, summary}}. For 'after a midterm election' use midtermForward12m; for 'in a midterm, election or pre-election year' use presidentialCycle. Figures are price returns without dividends, from month-end closes only: maxDrawdownPct is between month-end closes (the daily low was deeper), and nothing here is daily. The month in progress and the first partial year are left out. Quote the figures as given with the sample count and the period, taking N from samples and M from positive (e.g. 1950년 이후 N번 중 M번 상승). This is the past, not a forecast: never say a pattern will repeat, and never present a calendar month or the political cycle as the cause of a return. A question this table cannot express (a single day, an event such as an FOMC meeting, another index) has no statistic here: say so, except that a recent window, one calendar year or a single day's close of these indices is get_price_stats when it is available. Use for 중간선거 뒤 상승장, 대선 해 수익률, 9월 약세, 1월 효과, 연말 랠리(12월), 역대 연간 수익률, 최악의 해, 연평균 수익률 over their whole history (a named recent window such as 최근 10년 is get_price_stats when it is available).`,
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {
            index: {
                type: 'string',
                enum: [...AGENT_HISTORY_INDICES],
            },
        },
        required: ['index'],
        additionalProperties: false,
    },
};
