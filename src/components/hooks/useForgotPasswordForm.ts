'use client';

import { useActionState } from 'react';
import type { ForgotPasswordFormState } from '@/shared/lib/types';
import { requestPasswordResetAction } from '@/infrastructure/auth/requestPasswordResetAction';

const INITIAL_STATE: ForgotPasswordFormState = { submitted: false };

type UseForgotPasswordFormReturn = ReturnType<
    typeof useActionState<ForgotPasswordFormState, FormData>
>;

export function useForgotPasswordForm(): UseForgotPasswordFormReturn {
    return useActionState<ForgotPasswordFormState, FormData>(
        requestPasswordResetAction,
        INITIAL_STATE
    );
}
