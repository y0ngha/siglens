'use client';

import { useActionState } from 'react';
import { createSiglensApiKeyAction } from '@/entities/siglens-api-key/actions/createSiglensApiKeyAction';
import { revokeSiglensApiKeyAction } from '@/entities/siglens-api-key/actions/revokeSiglensApiKeyAction';
import type {
    CreateSiglensApiKeyState,
    RevokeSiglensApiKeyState,
} from '@/entities/siglens-api-key/model';

const INITIAL_CREATE_STATE: CreateSiglensApiKeyState = { status: 'idle' };
const INITIAL_REVOKE_STATE: RevokeSiglensApiKeyState = { status: 'idle' };

export interface SiglensApiKeyFormsReturn {
    createState: CreateSiglensApiKeyState;
    createFormAction: (formData: FormData) => void;
    revokeState: RevokeSiglensApiKeyState;
    revokeFormAction: (formData: FormData) => void;
}

/**
 * 키 목록 자체는 서버 컴포넌트(계정 페이지)가 props로 내려 준다. 두 액션은 성공하면
 * `revalidatePath`로 페이지를 다시 그리게 해 목록이 갱신되므로, 여기서 쿼리를 무효화할
 * 필요가 없다.
 */
export function useSiglensApiKeyForms(): SiglensApiKeyFormsReturn {
    const [createState, createFormAction] = useActionState<
        CreateSiglensApiKeyState,
        FormData
    >(createSiglensApiKeyAction, INITIAL_CREATE_STATE);
    const [revokeState, revokeFormAction] = useActionState<
        RevokeSiglensApiKeyState,
        FormData
    >(revokeSiglensApiKeyAction, INITIAL_REVOKE_STATE);
    return { createState, createFormAction, revokeState, revokeFormAction };
}
