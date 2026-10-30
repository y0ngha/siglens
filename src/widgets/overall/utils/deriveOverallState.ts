import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { AwaitingInteractionError } from '@/shared/lib/AwaitingInteractionError';
import type { WithPlain } from '@/shared/lib/plainEnvelope';
import type { OverallAnalysisNotice, OverallAnalysisState } from '../types';
import { OverallAnalysisError, OverallCooldownError } from './overallErrors';

export interface DeriveOverallStateInput {
    /** 쿼리가 들고 있는 마지막 결과. 재실행이 실패해도 React Query가 남겨 둔다. */
    data: WithPlain<OverallAnalysisResponse> | undefined;
    error: unknown;
    isFetching: boolean;
    /** 사용자가 분석을 요청했거나 SSR seed가 있어 쿼리가 돌 자격이 있는지. */
    isRequested: boolean;
    /** `Error`가 아닌 값이 던져졌을 때 쓸 로케일 문구. */
    fallbackMessage: string;
}

function toNotice(
    error: unknown,
    fallbackMessage: string
): OverallAnalysisNotice | null {
    if (error === null || error instanceof AwaitingInteractionError)
        return null;
    const message = error instanceof Error ? error.message : fallbackMessage;
    return {
        kind: error instanceof OverallCooldownError ? 'cooldown' : 'failed',
        message,
    };
}

/**
 * 쿼리 상태를 위젯이 분기하는 상태 유니온으로 바꾼다. **결과가 오류보다 먼저다** —
 * 재분석이 쿨다운이나 실패로 끝나도 보고 있던 분석은 그대로 두고 안내만 덧붙인다.
 */
export function deriveOverallState({
    data,
    error,
    isFetching,
    isRequested,
    fallbackMessage,
}: DeriveOverallStateInput): OverallAnalysisState {
    if (data !== undefined)
        return {
            status: 'done',
            result: data.data,
            plain: data.plain,
            reanalyzing: isFetching,
            // 새 요청이 도는 동안 직전 실패 안내는 낡은 정보다.
            notice: isFetching ? null : toNotice(error, fallbackMessage),
        };

    if (error !== null) {
        if (isFetching) return { status: 'submitting' };
        if (error instanceof AwaitingInteractionError)
            return { status: 'idle' };
        return {
            status: 'error',
            error: error instanceof Error ? error.message : fallbackMessage,
            axis:
                error instanceof OverallAnalysisError ? error.axis : undefined,
        };
    }

    return isRequested ? { status: 'submitting' } : { status: 'idle' };
}
