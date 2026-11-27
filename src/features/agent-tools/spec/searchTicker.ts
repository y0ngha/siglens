import { type AgentToolDefinition } from '@y0ngha/siglens-core';

/**
 * `search_ticker` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const SEARCH_TICKER_SPEC: AgentToolDefinition = {
    name: 'search_ticker',
    description:
        'Find ticker symbols by company name or partial symbol (Korean and English). Call this before any other tool when the user names a company instead of a symbol.',
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Company name or symbol fragment',
            },
        },
        required: ['query'],
        additionalProperties: false,
    },
};
