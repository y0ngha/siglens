import type {
    AgentToolDefinition,
    AgentToolSet,
    AgentToolSetFragments,
} from '@y0ngha/siglens-core';
import { GET_ANALYST_VIEWS_SPEC } from './getAnalystViews';
import { GET_BARS_INDICATORS_SPEC } from './getBarsIndicators';
import { GET_CACHED_ANALYSIS_SPEC } from './getCachedAnalysis';
import { GET_COMPANY_FILINGS_SPEC } from './getCompanyFilings';
import { GET_CONGRESS_TRADES_SPEC } from './getCongressTrades';
import { GET_ECONOMY_SPEC } from './getEconomy';
import { GET_FUNDAMENTALS_SPEC } from './getFundamentals';
import { GET_GUIDE_SPEC } from './getGuide';
import { GET_INDEX_HISTORY_STATS_SPEC } from './getIndexHistoryStats';
import { GET_INVESTOR_FLOWS_SPEC } from './getInvestorFlows';
import { GET_MACRO_QUOTES_SPEC } from './getMacroQuotes';
import { GET_MARKET_OVERVIEW_SPEC } from './getMarketOverview';
import { GET_MY_PORTFOLIO_SPEC } from './getMyPortfolio';
import { GET_NEWS_SPEC } from './getNews';
import { GET_OPTIONS_SUMMARY_SPEC } from './getOptionsSummary';
import { GET_PRICE_STATS_SPEC } from './getPriceStats';
import { GET_QUOTE_SPEC } from './getQuote';
import { GET_SWING_HISTORY_SPEC } from './getSwingHistory';
import { GET_THEME_SNAPSHOT_SPEC } from './getThemeSnapshot';
import { GET_X_POSTS_SPEC } from './getXPosts';
import { AGENT_ROUTING_ROWS } from './routingRows';
import { agentToolRuleLines } from './ruleLines';
import { RUN_FRESH_ANALYSIS_SPEC } from './runFreshAnalysis';
import { SEARCH_TICKER_SPEC } from './searchTicker';
import { SHOW_CHART_SPEC } from './showChart';
import { WATCHLIST_ALERT_TOOLS } from './watchlistAlertTools';
import { WEB_SEARCH_SPEC } from './webSearch';

/**
 * 모델이 보는 도구 문구(설명·인자 스키마·라우팅 줄·도구별 규칙 줄·조각·결과 notes)의 버전. `<날짜>.<번호>`이고,
 * 그 문구를 하나라도 바꾸면 올린다. core는 도구와 무관한 프레임의 버전(`AGENT_PROMPT_VERSION`)만 기록하므로,
 * 어느 도구 문구로 답했는지는 `[Agent]` 로그의 이 값으로 가른다.
 */
export const AGENT_TOOLSET_VERSION = '2026-11-28.4';

/**
 * 도구 목록. 공급자는 이 순서로 도구를 받는다(순서도 프롬프트 접두사 캐시의 바이트다). core 내장 모음의 순서에
 * 관심종목·가격대 알림 도구를 뒤에 붙인 순서 그대로다.
 */
const AGENT_TOOLS: readonly AgentToolDefinition[] = [
    SEARCH_TICKER_SPEC,
    GET_QUOTE_SPEC,
    GET_BARS_INDICATORS_SPEC,
    GET_CACHED_ANALYSIS_SPEC,
    GET_NEWS_SPEC,
    GET_OPTIONS_SUMMARY_SPEC,
    GET_FUNDAMENTALS_SPEC,
    GET_ANALYST_VIEWS_SPEC,
    GET_COMPANY_FILINGS_SPEC,
    GET_MARKET_OVERVIEW_SPEC,
    GET_ECONOMY_SPEC,
    GET_MACRO_QUOTES_SPEC,
    GET_THEME_SNAPSHOT_SPEC,
    GET_INDEX_HISTORY_STATS_SPEC,
    GET_SWING_HISTORY_SPEC,
    GET_PRICE_STATS_SPEC,
    GET_CONGRESS_TRADES_SPEC,
    GET_INVESTOR_FLOWS_SPEC,
    GET_GUIDE_SPEC,
    RUN_FRESH_ANALYSIS_SPEC,
    GET_MY_PORTFOLIO_SPEC,
    GET_X_POSTS_SPEC,
    SHOW_CHART_SPEC,
    WEB_SEARCH_SPEC,
    ...WATCHLIST_ALERT_TOOLS,
];

/** core 프레임의 도구와 무관한 문장 안에 끼워 넣는 도구 이름·필드 조각. */
const AGENT_TOOL_FRAGMENTS: AgentToolSetFragments = {
    computedFigureExamples:
        'derived, sinceAnalysis, pnl/pnlPct/weightPct, targetUpsidePct, upsidePct, gapPct, daysToEarnings, tally, ageHours, spread2s10s, bestWorstSpreadPp, options maxPainDistancePct/impliedMoveRange, macro changes/range52w, price statistics returnPct/cagrPct/fromHighestClosePct/maxDrawdown/correlation coefficient, other …Pct fields',
    guestCapabilities: available =>
        `quotes, indicators, SIGLENS analyses including fresh ones, news, options, fundamentals, market overview, economy, congress trades, ${available.has('get_investor_flows') ? 'investor flows (수급) for US and Korean stocks, ' : ''}${available.has('get_analyst_views') ? 'analyst targets and rating changes, ' : ''}${available.has('get_company_filings') ? 'company SEC filings, ' : ''}${available.has('get_x_posts') ? 'official company and CEO posts on X, ' : ''}${available.has('get_macro_quotes') ? 'commodity, futures and exchange-rate quotes, ' : ''}${available.has('get_theme_snapshot') ? 'theme baskets, ' : ''}${available.has('get_index_history_stats') ? 'long-run index statistics, ' : ''}${available.has('get_swing_history') ? 'past declines and rallies of a symbol, ' : ''}${available.has('get_price_stats') ? 'price statistics over any period, ' : ''}web search`,
    portfolioTool: 'get_my_portfolio',
    recallExamples: available =>
        available.has('get_investor_flows')
            ? 'get_investor_flows with holder for a named holder missing from the holders list, '
            : '',
    internalToolNameExamples: 'get_quote, get_news, run_fresh_analysis, …',
    toolDisplayNames:
        'quotes / bars & indicators / analysis / news / options / portfolio / guide / web search',
};

/**
 * siglens 에이전트의 도구 모음. core는 루프·한도·도구와 무관한 답변 규칙만 갖고, 도구 이름이나 결과 필드를
 * 말하는 문구는 전부 여기서 온다. core를 부르는 모든 곳(에이전트 스트림, 공개 API `/api/v1`)이 이 모음을
 * `toolSet`으로 넘기거나 이 모음에서 명세를 고른다.
 *
 * 모델이 보는 바이트가 옮기기 전과 같은지는 `__tests__/toolSetParity.test.ts`가 지킨다.
 */
export const SIGLENS_AGENT_TOOL_SET: AgentToolSet = {
    version: AGENT_TOOLSET_VERSION,
    tools: AGENT_TOOLS,
    routingRows: AGENT_ROUTING_ROWS,
    ruleLines: agentToolRuleLines,
    fragments: AGENT_TOOL_FRAGMENTS,
};
