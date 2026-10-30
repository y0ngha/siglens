'use client';

/** 메일 수신거부 확인을 Server Action에 잇는 React Query 훅. */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { unsubscribeEmailReportAction } from '@/entities/email-report/actions/unsubscribeEmailReportAction';
import type {
    UnsubscribeEmailReportInput,
    UnsubscribeEmailReportResult,
} from '@/entities/email-report/model';

/**
 * 수신거부 확인 버튼의 mutation. 액션은 던지지 않고 결과(`status`)를 돌려주므로
 * 서버 오류는 `data`로, 네트워크 등 요청 자체의 실패만 `isError`로 온다.
 */
export function useUnsubscribeEmailReport(): UseMutationResult<
    UnsubscribeEmailReportResult,
    Error,
    UnsubscribeEmailReportInput
> {
    return useMutation({
        mutationFn: input => unsubscribeEmailReportAction(input),
    });
}
