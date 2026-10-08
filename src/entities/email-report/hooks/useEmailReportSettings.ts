'use client';

import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { getEmailReportSettingsAction } from '@/entities/email-report/actions/getEmailReportSettingsAction';
import { saveEmailReportSettingsAction } from '@/entities/email-report/actions/saveEmailReportSettingsAction';
import type {
    EmailReportSettingsView,
    RawEmailReportSettingsInput,
    SaveEmailReportSettingsResult,
} from '../model';

interface UseEmailReportSettingsReturn {
    /** 비로그인이면 `null`, 조회 전·실패면 `undefined`. */
    settings: EmailReportSettingsView | null | undefined;
    isPending: boolean;
    isError: boolean;
    refetch: () => void;
    save: UseMutationResult<
        SaveEmailReportSettingsResult,
        Error,
        RawEmailReportSettingsInput
    >;
}

/**
 * 계정 페이지 전용 — 그 페이지는 비로그인 시 서버에서 로그인으로 보내므로 게스트 분기가 없다.
 * 저장에 성공하면 응답의 설정으로 캐시를 바로 갈아 끼운다(다시 조회할 필요 없음).
 */
export function useEmailReportSettings(): UseEmailReportSettingsReturn {
    const qc = useQueryClient();
    const { data, isPending, isError, refetch } = useQuery({
        queryKey: QUERY_KEYS.emailReportSettings(),
        queryFn: () => getEmailReportSettingsAction(),
    });

    const save = useMutation<
        SaveEmailReportSettingsResult,
        Error,
        RawEmailReportSettingsInput
    >({
        mutationFn: input => saveEmailReportSettingsAction(input),
        onSuccess: result => {
            if (result.status === 'ok') {
                qc.setQueryData(
                    QUERY_KEYS.emailReportSettings(),
                    result.settings
                );
            }
        },
    });

    return {
        settings: data,
        isPending,
        isError,
        refetch: () => {
            void refetch();
        },
        save,
    };
}
