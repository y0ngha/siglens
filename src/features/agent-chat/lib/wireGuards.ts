import type { AgentRemaining } from '@y0ngha/siglens-core';
import { isPlainRecord } from '@/shared/lib/isPlainRecord';

/** 한도 필드는 숫자 또는 `null`(무제한)이다. */
function isCount(value: unknown): value is number | null {
    return value === null || typeof value === 'number';
}

/** `done` 프레임의 `remaining`이 코어의 `AgentRemaining` 형태인지 확인한다. */
export function isAgentRemaining(value: unknown): value is AgentRemaining {
    return (
        isPlainRecord(value) &&
        isCount(value.turns) &&
        isCount(value.fresh) &&
        isCount(value.search)
    );
}
