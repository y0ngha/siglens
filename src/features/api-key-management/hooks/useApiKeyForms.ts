'use client';

import { useActionState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { saveApiKeyAction } from '@/entities/api-key/actions/saveApiKeyAction';
import { deleteApiKeyAction } from '@/entities/api-key/actions/deleteApiKeyAction';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import type { ApiKeyActionState } from '@/shared/lib/types';

const INITIAL_STATE: ApiKeyActionState = { status: 'idle', message: null };

type ApiKeyAction = (
    prevState: ApiKeyActionState,
    formData: FormData
) => Promise<ApiKeyActionState>;

/** 성공한 폼이 어느 쪽인가. */
export type ApiKeyFormKind = 'save' | 'delete';

interface UseApiKeyFormsOptions {
    /**
     * 저장이나 삭제가 성공한 직후 한 번, 성공한 쪽을 넘겨 부른다. 카드 재마운트보다
     * 먼저 온다는 보장은 없다 — 액션 응답과 목록 갱신의 커밋 순서는 React와
     * 라우터가 정한다.
     */
    onSuccess?: (kind: ApiKeyFormKind) => void;
}

/** 한 프로바이더 카드의 저장·삭제 폼 상태와 `<form action>` 핸들러. */
export interface ApiKeyFormsReturn {
    saveState: ApiKeyActionState;
    saveFormAction: (formData: FormData) => void;
    /** 저장 요청이 진행 중이다. 결과 영역을 미리 띄워 두는 데 쓴다. */
    isSavePending: boolean;
    deleteState: ApiKeyActionState;
    deleteFormAction: (formData: FormData) => void;
    /** 삭제 요청이 진행 중이다. */
    isDeletePending: boolean;
}

/**
 * 프로바이더 카드의 BYOK 키 저장·삭제를 Server Action에 연결한다.
 *
 * 성공하면 `registeredProviders` 쿼리(모델 게이트가 읽는다)를 무효화한다. 무효화는
 * 결과 state를 보는 effect가 아니라 액션 안에서 한다 — 성공과 함께 오는
 * `revalidatePath` 갱신이 등록 여부를 바꾸면 카드가 다시 마운트돼, 옛 카드의
 * 성공 state는 커밋되지 않고 버려진다. effect로 보면 바로 그 경우(첫 등록·삭제)에
 * 무효화가 빠져, 다른 화면의 모델 게이트가 방금 등록한 키를 모르는 채로 남는다.
 *
 * 키 값은 상태에 담지 않는다. 입력은 비제어라 액션이 끝나면 폼이 비운다.
 */
export function useApiKeyForms({
    onSuccess,
}: UseApiKeyFormsOptions = {}): ApiKeyFormsReturn {
    const queryClient = useQueryClient();

    // `useCallback`으로 감싸지 않는다 — 호출부의 `onSuccess`가 렌더마다 새 화살표라 메모가 늘
    // 깨지고, `useActionState`는 디스패치 때 가장 최근 렌더의 액션을 쓰므로 식별자가 안정할 필요가 없다.
    const settle =
        (action: ApiKeyAction, kind: ApiKeyFormKind): ApiKeyAction =>
        async (prevState, formData) => {
            const next = await action(prevState, formData);
            if (next.status === 'success') {
                void queryClient.invalidateQueries({
                    queryKey: QUERY_KEYS.registeredProviders(),
                });
                onSuccess?.(kind);
            }
            return next;
        };

    const [saveState, saveFormAction, isSavePending] = useActionState<
        ApiKeyActionState,
        FormData
    >(settle(saveApiKeyAction, 'save'), INITIAL_STATE);
    const [deleteState, deleteFormAction, isDeletePending] = useActionState<
        ApiKeyActionState,
        FormData
    >(settle(deleteApiKeyAction, 'delete'), INITIAL_STATE);

    return {
        saveState,
        saveFormAction,
        isSavePending,
        deleteState,
        deleteFormAction,
        isDeletePending,
    };
}
