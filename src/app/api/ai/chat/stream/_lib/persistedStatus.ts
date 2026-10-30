import type { AgentErrorCode } from '@y0ngha/siglens-core';

/**
 * 부분 답변을 저장할 때 붙는 상태. 모든 `AgentErrorCode`를 명시적으로 나열한다.
 * `default` 분기는 `code`를 `never` 타입 변수에 대입하므로, core가 새
 * `AgentErrorCode`를 추가하면 조용히 `'error'`로 흘러가는 대신 여기서 `tsc`가
 * 실패한다.
 */
export function persistedStatusFor(code: AgentErrorCode): 'aborted' | 'error' {
    switch (code) {
        case 'aborted':
        case 'deadline':
            return 'aborted';
        case 'turn_limit':
        case 'premium_turn_limit':
        case 'rate_limited':
        case 'server_busy':
        case 'server_error':
            return 'error';
        default: {
            const _never: never = code;
            throw new Error(`unhandled AgentErrorCode: ${String(_never)}`);
        }
    }
}
