import { type AgentToolDefinition } from '@y0ngha/siglens-core';

/**
 * `get_guide` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_GUIDE_SPEC: AgentToolDefinition = {
    name: 'get_guide',
    description:
        "SIGLENS's own chart guide: explainers for a technical-analysis concept (a candlestick pattern, chart pattern, indicator or strategy/theory, e.g. 망치형, double bottom, RSI, 엘리어트 파동) and practical step-by-step how-to articles (e.g. RSI 보는 법, 이중바닥 확인하는 법, 주식 차트 보는 법). Returns the best match's article (how it looks or is calculated, what it means, how SIGLENS detects it, caveats) plus up to two other matches, each with a page url. Call when the user asks what a concept is, how to read it or how to check it on a chart, without needing a symbol. Link the url in your answer.",
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description:
                    'Concept or how-to topic in any language (e.g. "이중바닥", "MACD", "hammer", "주식 차트 보는 법")',
            },
        },
        required: ['query'],
        additionalProperties: false,
    },
};
