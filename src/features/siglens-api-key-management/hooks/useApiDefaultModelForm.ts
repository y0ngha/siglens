'use client';

import { useActionState } from 'react';
import { setApiDefaultModelAction } from '@/entities/siglens-api-key/actions/setApiDefaultModelAction';
import type { SetApiDefaultModelState } from '@/entities/siglens-api-key/model';

const INITIAL_STATE: SetApiDefaultModelState = { status: 'idle' };

/** API 기본 모델 저장 폼의 결과 상태와 `<form action>` 핸들러. */
export interface ApiDefaultModelFormReturn {
    state: SetApiDefaultModelState;
    formAction: (formData: FormData) => void;
}

/**
 * "API 기본 모델" 저장을 Server Action에 연결한다. 저장에 성공하면 액션이 `revalidatePath`로
 * 페이지를 다시 그리게 하므로 쿼리 무효화는 필요 없다.
 */
export function useApiDefaultModelForm(): ApiDefaultModelFormReturn {
    const [state, formAction] = useActionState<
        SetApiDefaultModelState,
        FormData
    >(setApiDefaultModelAction, INITIAL_STATE);
    return { state, formAction };
}
