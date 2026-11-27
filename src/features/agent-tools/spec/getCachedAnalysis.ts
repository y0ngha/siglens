import { type AgentToolDefinition } from '@y0ngha/siglens-core';
import { SYMBOL_PROP, TIMEFRAME_ENUM } from './toolSchema';

/**
 * `get_cached_analysis` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_CACHED_ANALYSIS_SPEC: AgentToolDefinition = {
    name: 'get_cached_analysis',
    description:
        'Most recent SIGLENS AI analysis for a symbol and tab, read from cache/snapshot/history. Call this FIRST for any "what does SIGLENS think" question, including chart pattern questions: technical results include detected chart patterns, candle patterns and strategy verdicts, plus `sinceAnalysis` — analysisPrice, priceNow, movePct, levelsBroken, planNow (may be null) and levelLadder (may be absent): the analysis levels and, for daily analyses, the 52-week and 20-day high and low and the 20/50/200-day averages, placed by their side of priceNow, nearest first in `above` and `below`, with `closer` and a one-line `summary` — precomputed; quote them as given, do not recompute them. Each `patterns` entry has `baseRate` (null when not measured): eventShare is the share of past daily cases whose target came before invalidation within 60 bars, placeboShare the same for a target at the same distance on other dates, n the sample size; only verdict beats_placebo means it beat that placebo, and pooled true means the numbers are for all chart patterns combined, not this pattern. If it returns stale:true or found:false, call run_fresh_analysis when that tool is available.',
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: SYMBOL_PROP,
            tab: {
                type: 'string',
                enum: [
                    'technical',
                    'overall',
                    'fundamental',
                    'financials',
                    'news',
                    'options',
                    'congress',
                ],
            },
            timeframe: {
                type: 'string',
                enum: TIMEFRAME_ENUM,
                description: 'Only for technical/overall; default 1Day',
            },
        },
        required: ['symbol', 'tab'],
        additionalProperties: false,
    },
};
