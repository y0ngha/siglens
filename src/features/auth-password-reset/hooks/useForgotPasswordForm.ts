'use client';

import { useActionState } from 'react';
import type { ForgotPasswordFormState } from '@/shared/lib/auth/formTypes';
import { requestPasswordResetAction } from '../actions/requestPasswordResetAction';

const INITIAL_STATE: ForgotPasswordFormState = { submitted: false };

type UseForgotPasswordFormReturn = ReturnType<
    typeof useActionState<ForgotPasswordFormState, FormData>
>;

/**
 * `ForgotPasswordForm`의 `useActionState` 연결. 상태는 `submitted`(계정 존재와
 * 무관하게 성공 안내)와 형식 오류 코드만 담는다.
 */
export function useForgotPasswordForm(): UseForgotPasswordFormReturn {
    return useActionState<ForgotPasswordFormState, FormData>(
        requestPasswordResetAction,
        INITIAL_STATE
    );
}
