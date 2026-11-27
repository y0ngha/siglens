import { type AgentToolDefinition } from '@y0ngha/siglens-core';
import { SYMBOL_PROP } from './toolSchema';

/**
 * `get_congress_trades` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_CONGRESS_TRADES_SPEC: AgentToolDefinition = {
    name: 'get_congress_trades',
    description:
        "Recent disclosed US congressional trades in a US stock — trades by members of the US Senate and House (e.g. Pelosi), with a buy/sell trend summary. US stocks only. Use only when the user asks about lawmakers' or politicians' trading. It covers members of Congress only, not company executives, directors or other corporate insiders.",
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: { symbol: SYMBOL_PROP },
        required: ['symbol'],
        additionalProperties: false,
    },
};
