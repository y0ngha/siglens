'use client';

import { useActionState } from 'react';
import { saveApiKeyAction } from '@/infrastructure/llm/saveApiKeyAction';
import { deleteApiKeyAction } from '@/infrastructure/llm/deleteApiKeyAction';
import type {
    SaveApiKeyState,
    DeleteApiKeyState,
} from '@/infrastructure/llm/types';

const SAVE_INITIAL_STATE: SaveApiKeyState = { status: 'idle', message: null };
const DELETE_INITIAL_STATE: DeleteApiKeyState = {
    status: 'idle',
    message: null,
};

export interface ApiKeyFormsReturn {
    saveState: SaveApiKeyState;
    saveFormAction: (formData: FormData) => void;
    deleteState: DeleteApiKeyState;
    deleteFormAction: (formData: FormData) => void;
}

export function useApiKeyForms(): ApiKeyFormsReturn {
    const [saveState, saveFormAction] = useActionState<SaveApiKeyState, FormData>(
        saveApiKeyAction,
        SAVE_INITIAL_STATE
    );
    const [deleteState, deleteFormAction] = useActionState<
        DeleteApiKeyState,
        FormData
    >(deleteApiKeyAction, DELETE_INITIAL_STATE);

    return { saveState, saveFormAction, deleteState, deleteFormAction };
}
