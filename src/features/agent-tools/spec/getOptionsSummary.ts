import { type AgentToolDefinition } from '@y0ngha/siglens-core';
import { SYMBOL_PROP } from './toolSchema';

/**
 * `get_options_summary` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_OPTIONS_SUMMARY_SPEC: AgentToolDefinition = {
    name: 'get_options_summary',
    description:
        'Options market summary: ATM implied volatility, max pain, put/call ratio, top open-interest strikes (each with a precomputed distancePct/side vs the underlying), nearest expirations, plus precomputed daysToExpiration, maxPainDistancePct, impliedMoveRange (null, like the ATM IV, when there are no live option quotes — e.g. outside market hours — then say it is not available, never derive a move yourself), and callSpreadPct/putSpreadPct on the bid/ask summary — quote them as given, do not recompute them. Max pain is the strike with the smallest total payout to option holders if the stock closed there at expiration (not a forecast or a target; never say price is drawn or pinned toward it); put/call ratio = put OI ÷ call OI (0.58 = 0.58 puts per call); `metrics.putCallReading` ({side: more_calls, more_puts or even; text}) says which side has more open contracts — state the side from it, never from the ratio yourself. Open interest and volume are contract counts, never prices; only callMidPrice/putMidPrice are option prices (null = no two-sided quote, not zero), written to the cent, and a mid below $0.01 as "under one cent". Use for volatility, expected move or positioning questions.',
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: { symbol: SYMBOL_PROP },
        required: ['symbol'],
        additionalProperties: false,
    },
};
