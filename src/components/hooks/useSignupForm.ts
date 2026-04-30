'use client';

import { useActionState } from 'react';
import type { SignupFormState } from '@/domain/auth/formTypes';
import { registerAction } from '@/infrastructure/auth/registerAction';

const INITIAL_STATE: SignupFormState = { error: null };

type UseSignupFormReturn = ReturnType<
    typeof useActionState<SignupFormState, FormData>
>;

export function useSignupForm(): UseSignupFormReturn {
    return useActionState<SignupFormState, FormData>(
        registerAction,
        INITIAL_STATE
    );
}
