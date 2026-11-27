import { type AgentToolDefinition } from '@y0ngha/siglens-core';

/**
 * `get_my_portfolio` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_MY_PORTFOLIO_SPEC: AgentToolDefinition = {
    name: 'get_my_portfolio',
    description:
        "The signed-in user's own holdings on SIGLENS: symbol, quantity, average price, currency, plus precomputed `pnl`/`pnlPct` (profit/loss vs cost) and `weightPct` (share of portfolio value) — quote them as given, do not recompute them. Call when the user asks about 'my stocks', 'my position', profit/loss, or what they hold. Never guess holdings.",
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
    },
};
