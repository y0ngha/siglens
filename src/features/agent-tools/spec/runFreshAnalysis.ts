import {
    AGENT_TURN_CAPS,
    FRESH_ANALYSIS_KINDS,
    type AgentToolDefinition,
    type FreshAnalysisKind,
} from '@y0ngha/siglens-core';
import { SYMBOL_PROP, TIMEFRAME_ENUM } from './toolSchema';

/** 실측 중앙값(초). `tool_start` 이벤트의 진행 안내로 화면에 나간다. */
const FRESH_ANALYSIS_ESTIMATED_SECONDS: Readonly<
    Record<FreshAnalysisKind, number>
> = {
    technical: 40,
    overall: 120,
    news: 90,
    options: 60,
};

const FRESH_ANALYSIS_KIND_STRINGS: readonly string[] = FRESH_ANALYSIS_KINDS;

function isFreshAnalysisKind(value: unknown): value is FreshAnalysisKind {
    return (
        typeof value === 'string' && FRESH_ANALYSIS_KIND_STRINGS.includes(value)
    );
}

/**
 * `run_fresh_analysis` 도구 명세: 모델이 읽는 설명과 인자 스키마, 루프가 쓰는 턴당 상한.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const RUN_FRESH_ANALYSIS_SPEC: AgentToolDefinition = {
    name: 'run_fresh_analysis',
    description: `Run a NEW SIGLENS AI analysis now (30–250 seconds). Call only after get_cached_analysis returned found:false or stale:true, at most ${AGENT_TURN_CAPS.maxFreshAnalysis} per turn. The result is the same structure as get_cached_analysis.`,
    costClass: 'expensive',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: SYMBOL_PROP,
            kind: {
                type: 'string',
                enum: FRESH_ANALYSIS_KINDS,
            },
            timeframe: {
                type: 'string',
                enum: TIMEFRAME_ENUM,
                description: 'technical/overall only; default 1Day',
            },
        },
        required: ['symbol', 'kind'],
        additionalProperties: false,
    },
    perTurn: { max: AGENT_TURN_CAPS.maxFreshAnalysis },
    estimatedSeconds: args =>
        isFreshAnalysisKind(args.kind)
            ? FRESH_ANALYSIS_ESTIMATED_SECONDS[args.kind]
            : undefined,
};
