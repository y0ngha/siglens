'use client';

import { useActionState } from 'react';
import type { LoginFormState } from '@/domain/auth/formTypes';
import { loginAction } from '@/infrastructure/auth/loginAction';

const INITIAL_STATE: LoginFormState = { error: null };

type UseLoginFormReturn = ReturnType<
    typeof useActionState<LoginFormState, FormData>
>;

export function useLoginForm(): UseLoginFormReturn {
    return useActionState<LoginFormState, FormData>(loginAction, INITIAL_STATE);
}
