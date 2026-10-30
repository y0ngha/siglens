import type { AgentStopReason, AgentToolCall } from '@y0ngha/siglens-core';

/**
 * 도구가 제공되는 동안 스텝 텍스트의 앞 이 글자 수는 스트리밍하지 않고 보류한다.
 * DeepSeek은 프롬프트가 금지해도 도구 호출을 예고하는 문장("SIGLENS의 최신 분석을 확인할게요…",
 * 2026-09-15 production)을 먼저 내보내곤 한다. 보류된 예고는 도구 호출이 오면 버려진다.
 * 진짜 답은 1초 안에 보류 한도를 넘겨 그때부터 스트리밍된다. 관찰된 예고는 100자 미만이었다.
 */
export const AGENT_NARRATION_HOLD_CHARS = 200;

/** 스트리밍 도중 조각조각 도착하는 도구 호출 하나의 누적 상태. */
export interface PartialToolCall {
    id: string;
    name: string;
    args: string;
}

/** 스트림 delta의 `tool_calls` 한 항목 중 누적에 쓰는 필드. */
export interface ToolCallDelta {
    index: number;
    id?: string;
    function?: { name?: string; arguments?: string };
}

/** 보류 판정 결과. `held`가 `null`이면 이 스텝의 보류가 풀렸다는 뜻이다. */
export interface NarrationHoldStep {
    held: string | null;
    /** 지금 사용자에게 내보낼 텍스트. 빈 문자열이면 아직 보류 중이다. */
    emit: string;
}

/**
 * delta 텍스트를 보류 버퍼에 더하고 내보낼 몫을 정한다. `held`가 `null`(보류 해제 또는
 * 도구 없는 스텝)이면 delta를 그대로 내보내고, 보류 중이면 누적이 한도에 닿을 때 한꺼번에 내보낸다.
 */
export function holdNarration(
    held: string | null,
    delta: string
): NarrationHoldStep {
    if (held === null) return { held: null, emit: delta };
    const next = held + delta;
    return next.length >= AGENT_NARRATION_HOLD_CHARS
        ? { held: null, emit: next }
        : { held: next, emit: '' };
}

/**
 * `finish_reason`만으로는 부족하다: Gemini의 OpenAI 호환 엔드포인트는 턴이 도구 호출로
 * 끝나도 `'stop'`을 보고한다(2026-09-15 실측). 이를 `end`로 매핑하면 core가 도구를 실행하지 않는다.
 */
export function mapStopReason(
    reason: string | null | undefined,
    hasToolCalls: boolean
): AgentStopReason {
    switch (reason) {
        case 'tool_calls':
            return 'tool_use';
        case 'stop':
            return hasToolCalls ? 'tool_use' : 'end';
        case 'length':
            return 'max_tokens';
        default:
            return 'other';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * 모델이 만든 도구 인자 JSON을 객체로 읽는다. 비었거나 깨졌거나 객체가 아니면 `{}`다 —
 * 잘못된 인자는 도구 쪽 입력 검증이 거절하고, 여기서 턴을 실패시키지 않는다.
 */
export function parseToolCallArgs(raw: string): Record<string, unknown> {
    try {
        const parsed: unknown = JSON.parse(raw || '{}');
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * delta의 도구 호출 조각을 `index`별 누적 맵에 합친다. id·name은 통째로 도착하므로(openai SDK의
 * 자체 누적기도 name을 대입한다) 덮어쓰고, 인자만 조각으로 오므로 이어 붙인다. `partial`을 직접 갱신한다.
 */
export function accumulateToolCallDeltas(
    partial: Map<number, PartialToolCall>,
    deltas: readonly ToolCallDelta[]
): void {
    for (const tc of deltas) {
        const slot = partial.get(tc.index) ?? { id: '', name: '', args: '' };
        partial.set(tc.index, {
            id: tc.id || slot.id,
            name: tc.function?.name || slot.name,
            args: slot.args + (tc.function?.arguments ?? ''),
        });
    }
}

/**
 * 누적된 조각을 `index` 순서의 `AgentToolCall`로 확정한다. id가 없는 호출은 다음 스텝에서
 * `tool_call_id: ''`로 재생돼 UI에서 충돌하므로 `call_<index>`를 부여한다.
 */
export function buildToolCalls(
    partial: ReadonlyMap<number, PartialToolCall>
): AgentToolCall[] {
    return [...partial.entries()]
        .sort(([a], [b]) => a - b)
        .map(([index, slot]) => ({
            id: slot.id || `call_${index}`,
            name: slot.name,
            args: parseToolCallArgs(slot.args),
        }));
}
