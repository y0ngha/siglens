'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { unsubscribeEmailReportAction } from '@/entities/email-report/actions/unsubscribeEmailReportAction';
import type {
    UnsubscribeEmailReportInput,
    UnsubscribeEmailReportResult,
} from '@/entities/email-report/model';

/** 수신거부 확인 버튼의 mutation. */
export function useUnsubscribeEmailReport(): UseMutationResult<
    UnsubscribeEmailReportResult,
    Error,
    UnsubscribeEmailReportInput
> {
    return useMutation({
        mutationFn: input => unsubscribeEmailReportAction(input),
    });
}
