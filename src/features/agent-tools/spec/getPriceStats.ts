import {
    AGENT_HISTORY_INDICES,
    AGENT_PRICE_STATS_DEFAULT_PERIOD,
    AGENT_PRICE_STATS_MAX_DATES,
    AGENT_PRICE_STATS_MAX_SUBJECTS,
    AGENT_PRICE_STATS_PERIODS,
    PRICE_STATS_CAGR_ABOVE_DAYS,
    PRICE_STATS_YEAR,
    type AgentToolDefinition,
} from '@y0ngha/siglens-core';

/**
 * `get_price_stats` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_PRICE_STATS_SPEC: AgentToolDefinition = {
    name: 'get_price_stats',
    description: `Price statistics from SIGLENS daily closes of completed sessions (price only: split-adjusted, dividends not included) for up to ${AGENT_PRICE_STATS_MAX_SUBJECTS} subjects at once: stocks, ETFs, coins and Korean stocks (\`symbols\`) and a stock index itself (\`index\`: sp500, nasdaq for the Nasdaq Composite, kospi, kosdaq; it counts toward the ${AGENT_PRICE_STATS_MAX_SUBJECTS}). The window is \`period\` (${AGENT_PRICE_STATS_PERIODS.join(', ')}; default ${AGENT_PRICE_STATS_DEFAULT_PERIOD}), or \`year\` for one calendar year, or \`from\` with an optional \`to\` (YYYY-MM-DD); \`from\` beats \`year\` beats \`period\`, and a note names the argument that was ignored. It starts at the close of the last session on or before its start date (ytd and a calendar year: the previous year's last close; 1m: the same date a month before the last session) and ends at the last completed session (a calendar year: that year's last session; with \`to\`: the last session on or before it). Returns {asOf, window (the request as understood), subjects, correlation, notes}. Per subject: {subject, window {baseDate, baseClose, endDate, endClose, sessions, calendarDays}, returnPct, cagrPct (annual rate; given only for a window longer than ${PRICE_STATS_CAGR_ABOVE_DAYS} calendar days, so null for ytd, a calendar year and any period of a year or less), highestClose and lowestClose ({date, close} among the sessions after baseDate; for max or a start before the history, from baseDate on), fromHighestClosePct, maxDrawdown ({pct, peakDate, peakClose, troughDate, troughClose, recoveredDate: the first close back at or above that peak up to endDate, null when there is none}; measured from baseClose on; null when no close fell below an earlier one or the fall rounds to 0.00%), closes (one entry per \`dates\` entry: {requestedDate, date, close, status}; status exact; previous_session: no session that day, the close is from the last session before it; before_history: SIGLENS's history starts later; after_last_close: the data has no close for that date yet, which is not the same as no session; unusable_price or no_price_data: no close is available), summary}. With two or more subjects \`correlation\` has one entry per pair ({subjects, daily, weekly}, each {coefficient (-1 to 1; null with too few shared sessions or when one series is flat), observations, from, to}). Only \`dates\` (no window argument) returns just those closes. \`notes\` say how to read a partial window, a substituted date, an omitted row or a null figure in this result: follow them. Every figure is precomputed: quote it with its dates, and never recompute a return, an annual rate, a drawdown or a correlation yourself. Highs, lows and drawdowns are on closing prices: for the intraday 52-week high or low use get_bars_indicators when it is available. When get_bars_indicators is available and no session is in progress, the 1-, 3- and 12-month returns equal its calendarChange; while one is, calendarChange runs to the live price and these end at the last completed close, so name each figure's dates. A correlation says how the moves lined up in this window: describe a coefficient by its strength and sign only (e.g. weak, moderate or strong positive), never as a share of days moving together, and never give a reason for it or a forecast. found false: no price history for that subject; found false with error stale_listing (with lastTradeDate): that listing has not traded recently, so say its price statistics are not available and never present its old closes as current; available false with reason provider_failed: it could not be loaded, say so. Error invalid_args names the argument to fix.`,
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {
            symbols: {
                type: 'array',
                items: { type: 'string' },
                description: `1 to ${AGENT_PRICE_STATS_MAX_SUBJECTS} ticker symbols as used on SIGLENS (e.g. AAPL, 005930.KS, BTCUSD); put every symbol of a comparison in this one call, and spread a longer list over parallel calls of up to ${AGENT_PRICE_STATS_MAX_SUBJECTS}`,
            },
            index: {
                type: 'string',
                enum: [...AGENT_HISTORY_INDICES],
                description: `A stock index itself (not a tracking ETF); counts toward the ${AGENT_PRICE_STATS_MAX_SUBJECTS} subjects`,
            },
            period: {
                type: 'string',
                enum: [...AGENT_PRICE_STATS_PERIODS],
                description: `Window ending at the last completed session; default ${AGENT_PRICE_STATS_DEFAULT_PERIOD}. Omit when you pass year or from. A question relative to this time last year or N months ago (작년 이맘때 대비, N개월 전 대비, 1년 전보다) uses 1m, 3m, 6m or 1y here, never from; for 1m, 3m and 1y, when no session is in progress, the figure then equals the calendarChange of get_bars_indicators (while one is, calendarChange runs to the live price), so name the dates`,
            },
            year: {
                type: 'integer',
                minimum: PRICE_STATS_YEAR.min,
                maximum: PRICE_STATS_YEAR.max,
                description: 'One calendar year (작년 수익률, 2022년 수익률)',
            },
            from: {
                type: 'string',
                description:
                    'Window start date YYYY-MM-DD (a purchase or reference date); the base is the last close on or before it, so for this month or this week to date pass the last day of the previous month or week',
            },
            to: {
                type: 'string',
                description:
                    'Window end date YYYY-MM-DD; only with from (a to alone is rejected); omit for the last completed session',
            },
            dates: {
                type: 'array',
                items: { type: 'string' },
                description: `Up to ${AGENT_PRICE_STATS_MAX_DATES} past dates YYYY-MM-DD whose close you need`,
            },
        },
        additionalProperties: false,
    },
};
