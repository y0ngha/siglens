'use client';

import { useActionState } from 'react';
import type { ContactFormState } from '@/shared/lib/types';
import { submitContactAction } from '@/entities/inquiry/actions/submitContactAction';

const INITIAL_STATE: ContactFormState = {
    submitted: false,
    error: null,
    values: { title: '', email: '', content: '' },
};

type UseContactFormReturn = ReturnType<
    typeof useActionState<ContactFormState, FormData>
>;

/**
 * 문의 폼의 `useActionState` 연결 — `[state, formAction, isPending]`을 그대로 돌려준다.
 * 실패 시 `state.values`에 사용자가 보낸 값이 실려 와 비제어 입력의 기본값으로 쓰인다.
 */
export function useContactForm(): UseContactFormReturn {
    return useActionState<ContactFormState, FormData>(
        submitContactAction,
        INITIAL_STATE
    );
}
