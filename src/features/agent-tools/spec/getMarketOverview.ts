import { type AgentToolDefinition } from '@y0ngha/siglens-core';

/**
 * `get_market_overview` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_MARKET_OVERVIEW_SPEC: AgentToolDefinition = {
    name: 'get_market_overview',
    description:
        "Market-wide fear & greed index with its factor breakdown and `comparisons` (the same index at past sessions — quote the past score and its date as given), major index levels and day change (each index `price` is the live/last-trade quote; when present `lastClose`/`lastCloseDate` is the official daily close — use it for the most recent close), SIGLENS's own market `briefing` when one is cached (`summary`, `dominantThemes`, `riskSentiment` — relay it as SIGLENS's view), and the sector signal scan (golden crosses, RSI divergences, squeezes across the market's large caps) in `sectorSignals` — `countsBySector` plus `topSignals`, each flagged symbol with the rule that flagged it. All three markets carry the scan. `market: 'crypto'` scans the major and altcoin coins SIGLENS curates; it has no fear & greed index and no sector ETFs, so `fearGreed`, `sectors`, `sectorBreadth` and `bestWorstSpreadPp` are null or empty there and the coin groups live in the scan's `countsBySector` instead. Each sector carries its display `name` and `rank` (by day change, best to worst), plus `sectorBreadth` (up/down/flat counts of the sector ETFs listed here — not market-wide advancers/decliners) and `bestWorstSpreadPp` (best-minus-worst sector spread) — all already computed, quote them as given, do not recompute them. Use for \"how is the market\", market mood, index or sector questions, and as the only screen SIGLENS has when the user asks which sectors or stocks are worth looking at.",
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {
            market: {
                type: 'string',
                enum: ['us', 'kr', 'crypto'],
                description: 'Which market to summarize',
            },
        },
        required: ['market'],
        additionalProperties: false,
    },
};
