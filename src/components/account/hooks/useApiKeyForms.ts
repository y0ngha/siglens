'use client';

import { useActionState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { saveApiKeyAction } from '@/infrastructure/llm/saveApiKeyAction';
import { deleteApiKeyAction } from '@/infrastructure/llm/deleteApiKeyAction';
import { QUERY_KEYS } from '@/lib/queryConfig';
import type { ApiKeyActionState } from '@/domain/types';

const INITIAL_STATE: ApiKeyActionState = { status: 'idle', message: null };

export interface ApiKeyFormsReturn {
    saveState: ApiKeyActionState;
    saveFormAction: (formData: FormData) => void;
    deleteState: ApiKeyActionState;
    deleteFormAction: (formData: FormData) => void;
}

export function useApiKeyForms(): ApiKeyFormsReturn {
    const [saveState, saveFormAction] = useActionState<
        ApiKeyActionState,
        FormData
    >(saveApiKeyAction, INITIAL_STATE);
    const [deleteState, deleteFormAction] = useActionState<
        ApiKeyActionState,
        FormData
    >(deleteApiKeyAction, INITIAL_STATE);

    const queryClient = useQueryClient();

    useEffect(() => {
        if (
            saveState.status === 'success' ||
            deleteState.status === 'success'
        ) {
            void queryClient.invalidateQueries({
                queryKey: QUERY_KEYS.registeredProviders(),
            });
        }
    }, [saveState.status, deleteState.status, queryClient]);

    return { saveState, saveFormAction, deleteState, deleteFormAction };
}
