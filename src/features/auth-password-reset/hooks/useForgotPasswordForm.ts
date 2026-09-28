'use client';

import { useActionState } from 'react';
import type { ForgotPasswordFormState } from '@/shared/lib/auth/formTypes';
import { requestPasswordResetAction } from '../actions/requestPasswordResetAction';

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
