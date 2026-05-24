'use client';

import { useActionState } from 'react';
import type { ResetPasswordFormState } from '@/shared/lib/types';
import { confirmPasswordResetAction } from '@/infrastructure/auth/confirmPasswordResetAction';

const INITIAL_STATE: ResetPasswordFormState = { error: null };

type UseResetPasswordFormReturn = ReturnType<
    typeof useActionState<ResetPasswordFormState, FormData>
>;

export function useResetPasswordForm(): UseResetPasswordFormReturn {
    return useActionState<ResetPasswordFormState, FormData>(
        confirmPasswordResetAction,
        INITIAL_STATE
    );
}
