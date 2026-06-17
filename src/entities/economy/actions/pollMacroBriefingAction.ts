'use server';

import {
    pollMacroBriefing,
    type PollMacroBriefingResult,
} from '@y0ngha/siglens-core';

/**
 * 폴링 진행 단계 단순 위임 — core가 이미 `processing | error | done` discriminated union을
 * 반환한다. 호출 자체 실패는 'error' variant로 정규화해 클라가 단일 union을 처리하면 된다.
 */
export async function pollMacroBriefingAction(
    jobId: string
): Promise<PollMacroBriefingResult> {
    try {
        return await pollMacroBriefing(jobId);
    } catch (e) {
        console.error('[pollMacroBriefingAction] failed:', e);
        return { status: 'error', error: 'server_error' };
    }
}
