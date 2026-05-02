'use client';

import { useActionState } from 'react';
import { saveApiKeyAction } from '@/infrastructure/llm/saveApiKeyAction';
import { deleteApiKeyAction } from '@/infrastructure/llm/deleteApiKeyAction';
import type { ApiKeyActionState } from '@/domain/llm';

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

    return { saveState, saveFormAction, deleteState, deleteFormAction };
}
