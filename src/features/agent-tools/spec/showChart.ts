import {
    AGENT_THEME_IDS,
    AGENT_TURN_CAPS,
    type AgentToolDefinition,
} from '@y0ngha/siglens-core';
import {
    AGENT_CHART_KINDS,
    AGENT_CHART_PERIODS,
    AGENT_COMPARE_SYMBOLS_MAX,
    AGENT_COMPARE_SYMBOLS_MIN,
} from '@/entities/chat-conversation/lib/chartToolConstants';
import { SYMBOL_PROP } from './toolSchema';

/**
 * `show_chart` 도구 명세: 모델이 읽는 설명과 인자 스키마, 루프가 쓰는 턴당 상한.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const SHOW_CHART_SPEC: AgentToolDefinition = {
    name: 'show_chart',
    description: `Draw a chart under your answer from SIGLENS data — the server loads the data itself, so you never pass numbers. Kinds: compare (symbols: ${AGENT_COMPARE_SYMBOLS_MIN}–${AGENT_COMPARE_SYMBOLS_MAX} tickers, period: ${AGENT_CHART_PERIODS.join(', ')} — % return of each from the same start), financials (symbol — last 8 quarters of revenue, net income and EPS, with EPS estimate vs actual when available), options (symbol, optional expiry YYYY-MM-DD — call and put open interest by strike for one expiry with max pain; US optionable stocks only), flows (symbol — US: institutional holders and net share change by quarter plus insider net buying by month; Korea: daily foreign, institution and individual net buying), portfolio (no arguments — the signed-in user's holdings by weight and profit/loss; logged-in users only), heatmap (market: us or kr — today's sector moves; or theme: a theme id from get_theme_snapshot — its members' moves), dividends (symbol — dividend per share by year). Returns {rendered: true, kind, summary} where summary holds the figures the chart shows: quote them from there. An error no_data means there is nothing to draw (for example options for a Korean stock or dividends for a non-payer): answer in words without mentioning the chart. Call when a picture reads better than a list of numbers: comparing symbols over time, a trend across quarters or years, a distribution across strikes, weights, or a market-wide board. Never call it for a single figure, a definition, a yes/no question or a comparison of a few current values with no time axis (today's P/E, market cap or change of a few symbols, the latest quarter's EPS) — put that in a markdown table in the answer. At most two charts per answer (hard limit ${AGENT_TURN_CAPS.maxCharts} per turn). The chart appears under your answer: refer to it ("아래 차트") and spend the words on what it means, not on describing its shape.`,
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {
            kind: {
                type: 'string',
                enum: [...AGENT_CHART_KINDS],
                description: 'Which chart to draw',
            },
            symbols: {
                type: 'array',
                items: { type: 'string' },
                description: `compare only: ${AGENT_COMPARE_SYMBOLS_MIN}–${AGENT_COMPARE_SYMBOLS_MAX} ticker symbols as used on SIGLENS`,
            },
            symbol: {
                ...SYMBOL_PROP,
                description: `financials, options, flows and dividends: ${SYMBOL_PROP.description}`,
            },
            period: {
                type: 'string',
                enum: [...AGENT_CHART_PERIODS],
                description: 'compare only: look-back window (default 6M)',
            },
            expiry: {
                type: 'string',
                description:
                    'options only: expiration date YYYY-MM-DD; omit for the nearest expiry at least a week out',
            },
            market: {
                type: 'string',
                enum: ['us', 'kr'],
                description: 'heatmap only: sector board of this market',
            },
            theme: {
                type: 'string',
                enum: [...AGENT_THEME_IDS],
                description:
                    'heatmap only: theme basket instead of sectors. When no theme on the list matches the question, never pass a neighbouring one as a stand-in: use the market sector board or skip the chart',
            },
        },
        required: ['kind'],
        additionalProperties: false,
    },
    perTurn: { max: AGENT_TURN_CAPS.maxCharts },
};
