'use client';

import { useActionState } from 'react';
import { setApiDefaultModelAction } from '@/entities/siglens-api-key/actions/setApiDefaultModelAction';
import type { SetApiDefaultModelState } from '@/entities/siglens-api-key/model';

const INITIAL_STATE: SetApiDefaultModelState = { status: 'idle' };

export interface ApiDefaultModelFormReturn {
    state: SetApiDefaultModelState;
    formAction: (formData: FormData) => void;
}

/** 저장에 성공하면 액션이 `revalidatePath`로 페이지를 다시 그리게 하므로 쿼리 무효화는 필요 없다. */
export function useApiDefaultModelForm(): ApiDefaultModelFormReturn {
    const [state, formAction] = useActionState<
        SetApiDefaultModelState,
        FormData
    >(setApiDefaultModelAction, INITIAL_STATE);
    return { state, formAction };
}
