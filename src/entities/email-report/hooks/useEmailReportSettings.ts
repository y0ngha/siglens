'use client';

import { useCallback } from 'react';
import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { getEmailReportSettingsAction } from '../actions/getEmailReportSettingsAction';
import { saveEmailReportSettingsAction } from '../actions/saveEmailReportSettingsAction';
import type {
    EmailReportSettingsView,
    RawEmailReportSettingsInput,
    SaveEmailReportSettingsResult,
} from '../model';

/** `useEmailReportSettings`의 반환 모양. `refetch`는 결과를 기다리지 않는 fire-and-forget 콜백이다. */
interface UseEmailReportSettingsReturn {
    /** 비로그인이면 `null`, 조회 전·실패면 `undefined`. */
    settings: EmailReportSettingsView | null | undefined;
    isPending: boolean;
    isError: boolean;
    /** 조회 실패 화면의 "다시 시도" 버튼용. */
    refetch: () => void;
    /** 저장 뮤테이션. 입력 오류는 던지지 않고 `status: 'error'` 결과로 돌아온다. */
    save: UseMutationResult<
        SaveEmailReportSettingsResult,
        Error,
        RawEmailReportSettingsInput
    >;
}

/**
 * 계정 페이지와 회원 메일 리포트 넛지가 쓴다. 넛지는 후보일 때만 조회하도록 `enabled`로
 * 끈다 — 모든 페이지에서 회원마다 Server Action을 한 번씩 보내지 않기 위해서다.
 * 저장에 성공하면 응답의 설정으로 캐시를 바로 갈아 끼운다(다시 조회할 필요 없음).
 */
export function useEmailReportSettings({
    enabled = true,
}: { enabled?: boolean } = {}): UseEmailReportSettingsReturn {
    const qc = useQueryClient();
    const { data, isPending, isError, refetch } = useQuery({
        queryKey: QUERY_KEYS.emailReportSettings(),
        queryFn: () => getEmailReportSettingsAction(),
        enabled,
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

    const refetchSettings = useCallback((): void => {
        void refetch();
    }, [refetch]);

    return {
        settings: data,
        isPending,
        isError,
        refetch: refetchSettings,
        save,
    };
}
