'use client';

import { useActionState } from 'react';
import type { ResetPasswordFormState } from '@/shared/lib/auth/formTypes';
import { confirmPasswordResetAction } from '../actions/confirmPasswordResetAction';

const INITIAL_STATE: ResetPasswordFormState = { error: null };

type UseResetPasswordFormReturn = ReturnType<
    typeof useActionState<ResetPasswordFormState, FormData>
>;

/**
 * `ResetPasswordForm`의 `useActionState` 연결. 성공은 액션의 리디렉트라
 * 상태에는 실패 오류만 남는다.
 */
export function useResetPasswordForm(): UseResetPasswordFormReturn {
    return useActionState<ResetPasswordFormState, FormData>(
        confirmPasswordResetAction,
        INITIAL_STATE
    );
}
