import { type AgentToolDefinition } from '@y0ngha/siglens-core';

/**
 * `get_quote` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_QUOTE_SPEC: AgentToolDefinition = {
    name: 'get_quote',
    description:
        'Latest price and day change for up to 3 symbols. Call for any current-price or today\'s-move question, and always instead of quoting a price from memory. Each quote carries quoteDelayMinutes; when it is greater than 0 the quote is delayed by that many minutes and must not be called real-time. When asOfIsFetchTime is true, asOf is when SIGLENS fetched the quote, not necessarily the trade time — cite it as "as of <time>", never as the trade time. `resolvedName`/`resolvedSymbol` name the instrument actually priced — when it is not what the user meant (an ETF instead of an index, another share class), say so instead of answering. `symbolCorrectedFrom` means SIGLENS fixed a Korean suffix (.KS = KOSPI, .KQ = KOSDAQ); use the corrected symbol. An error `stale_listing` (with lastTradeDate) means that listing has not traded recently: say the price is not available, never quote an old price as current.',
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {
            symbols: {
                type: 'array',
                description: 'Up to 3 symbols; extra entries are ignored',
                items: { type: 'string' },
            },
        },
        required: ['symbols'],
        additionalProperties: false,
    },
};
