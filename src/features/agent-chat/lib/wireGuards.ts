import type { AgentRemaining } from '@y0ngha/siglens-core';

/** 배열이 아닌 일반 객체인지 좁힌다. SSE/JSON 같은 신뢰할 수 없는 입력용. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 한도 필드는 숫자 또는 `null`(무제한)이다. */
function isCount(value: unknown): value is number | null {
    return value === null || typeof value === 'number';
}

/** `done` 프레임의 `remaining`이 코어의 `AgentRemaining` 형태인지 확인한다. */
export function isAgentRemaining(value: unknown): value is AgentRemaining {
    return (
        isRecord(value) &&
        isCount(value.turns) &&
        isCount(value.fresh) &&
        isCount(value.search)
    );
}
