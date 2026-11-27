import { type AgentToolDefinition } from '@y0ngha/siglens-core';

/**
 * `get_news` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_NEWS_SPEC: AgentToolDefinition = {
    name: 'get_news',
    description:
        "News already ingested by SIGLENS for a symbol or a market category, with sentiment and Korean summary, a `tally` (bullish/bearish/neutral/highImpact counts) and each item's `ageHours` and, for a symbol, `session` (the trading session it falls in; null = published after the last close) plus `priceMoves`: the window's largest daily moves of completed sessions, each with the headlines published between the previous close and that close (`moreHeadlines` = how many more) — already computed, quote them as given, do not recount or recompute them. A category request also carries `digest`: SIGLENS's own summary of that feed (`driver`, `keyEvents`, `upcomingEvents`, `overallSentiment`) — relay it as SIGLENS's reading of the category rather than re-deriving one from the item list; it is absent for a symbol request and when nothing is cached yet. Call for news, events, rulings or \"why did it move / what happened\" questions. If the result is empty or older than the question needs, say coverage is limited and use web_search if available. `itemsTrimmed` = how many of the oldest items were dropped to fit (priceMoves still covers the whole window); if the question needs them, call get_news again with a query, never guess what was cut.",
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'Symbol; omit when asking about a market category',
            },
            category: {
                type: 'string',
                enum: ['general', 'stock', 'crypto', 'forex', 'articles', 'kr'],
                description: 'Market news category; omit when symbol is given',
            },
            since: {
                type: 'string',
                description:
                    "ISO date (YYYY-MM-DD): the first day of the period the question asks about (최근 1개월 → 30 days before the date in the ## Now note; 이번 주 → this week's Monday). Omit for latest news: then the last 30 days for a symbol, 14 days for a category; at most 30 days back.",
            },
            query: {
                type: 'string',
                description: 'Keyword filter on title/summary',
            },
            limit: { type: 'integer', minimum: 1, maximum: 10 },
            includeBody: {
                type: 'boolean',
                description:
                    'Include up to 1,000 chars of body for the top 3 items',
            },
        },
        additionalProperties: false,
    },
};
