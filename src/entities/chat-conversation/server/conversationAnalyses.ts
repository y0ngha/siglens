import type { ChatMessageRecord } from '../model';

/** 한 대화에서 카드가 비교 기준으로 삼는 종목 수의 상한 — 최근에 본 순이다. 에이전트의 `sinceEarlier`에는 걸지 않는다. */
export const CONVERSATION_CHANGES_MAX_SYMBOLS = 3;

/** 대화에 남은 일봉 기술적 분석 한 건 — 그 회원이 본 모양 그대로(`analysis`)와 만든 시각. */
export interface ConversationAnalysis {
    symbol: string;
    /** 도구 결과의 `generatedAt`(ISO). */
    generatedAt: string;
    /** 도구 결과의 `analysis` 투영 — `changeReferenceOf(…, 'as_shown')`의 입력이다. */
    analysis: Record<string, unknown>;
    /** 이 결과를 담은 tool 행의 `seq` — 같은 종목의 여러 건 중 나중 것을 고른다. */
    seq: number;
}

type AnalysisRow = Pick<
    ChatMessageRecord,
    'seq' | 'role' | 'content' | 'toolCalls' | 'toolCallId' | 'toolName'
> &
    Partial<Pick<ChatMessageRecord, 'status'>>;

const ANALYSIS_TOOLS: ReadonlySet<string> = new Set([
    'get_cached_analysis',
    'run_fresh_analysis',
]);

const ALLOWED_STATUSES: ReadonlySet<string> = new Set(['complete', 'aborted']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonObject(content: string): Record<string, unknown> | null {
    try {
        const parsed: unknown = JSON.parse(content);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * 저장된 대화의 도구 결과에서 일봉 기술적 분석을 모은다.
 *
 * 도구 결과에는 종목이 없다 — 그 호출의 인자(앞선 assistant 행의 `toolCalls`)에서 `tool_call_id`로 짝지어 읽는다.
 * 비교 기준이 될 수 있는 것은 `found: true`, `tab: 'technical'`, `timeframe: '1Day'`(일봉만), 읽을 수 있는
 * `generatedAt`, 객체 `analysis`가 모두 있는 결과뿐이다. 길이 상한에 잘린 결과(`{ truncated, preview }`)는
 * `found`가 없어 여기서 걸러진다.
 *
 * 종목마다 가장 나중 것 하나만 남기고, 가장 최근에 본 종목부터 돌려준다. 종목 수 상한은 쓰는 쪽이 정한다 — 카드는
 * {@link CONVERSATION_CHANGES_MAX_SYMBOLS}개로 자르고, 에이전트(`sinceEarlier`)는 이번 턴에 부른 종목 하나만 찾으므로
 * 자르지 않는다(자르면 오래전에 본 종목을 다시 물을 때 비교가 사라진다).
 * 호출 쪽이 `superseded` 행을 이미 걸러 넘긴다는 전제 — 여기서도 `complete`·`aborted` 밖의 상태는 읽지 않는다.
 */
export function extractConversationAnalyses(
    rows: readonly AnalysisRow[]
): ConversationAnalysis[] {
    // 호출 id(`call_0`)는 턴마다 다시 쓰일 수 있다 — 대화 전체 맵이 아니라, 그 tool 행 **직전**의 assistant 호출
    // 묶음(seq 순)에서만 짝을 찾는다.
    let currentCalls = new Map<string, string>();
    const latestBySymbol = new Map<string, ConversationAnalysis>();
    for (const row of rows.toSorted((a, b) => a.seq - b.seq)) {
        if (row.role === 'assistant' && row.toolCalls?.length) {
            currentCalls = new Map();
            for (const call of row.toolCalls) {
                if (!ANALYSIS_TOOLS.has(call.name)) continue;
                const symbol = call.args['symbol'];
                if (typeof symbol === 'string' && symbol.trim().length > 0)
                    currentCalls.set(call.id, symbol.trim().toUpperCase());
            }
            continue;
        }
        if (
            row.role !== 'tool' ||
            row.toolCallId === null ||
            row.toolName === null ||
            !ANALYSIS_TOOLS.has(row.toolName) ||
            (row.status !== undefined && !ALLOWED_STATUSES.has(row.status))
        )
            continue;
        const symbol = currentCalls.get(row.toolCallId);
        if (symbol === undefined) continue;
        const result = parseJsonObject(row.content);
        if (
            result === null ||
            result['found'] !== true ||
            result['tab'] !== 'technical' ||
            result['timeframe'] !== '1Day'
        )
            continue;
        const generatedAt = result['generatedAt'];
        const analysis = result['analysis'];
        if (
            typeof generatedAt !== 'string' ||
            Number.isNaN(Date.parse(generatedAt)) ||
            !isRecord(analysis)
        )
            continue;
        const previous = latestBySymbol.get(symbol);
        if (previous === undefined || row.seq > previous.seq)
            latestBySymbol.set(symbol, {
                symbol,
                generatedAt,
                analysis,
                seq: row.seq,
            });
    }

    return [...latestBySymbol.values()].toSorted((a, b) => b.seq - a.seq);
}
