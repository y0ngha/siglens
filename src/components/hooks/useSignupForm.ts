'use client';

import { useActionState } from 'react';
import type { SignupFormState } from '@/domain/auth/formTypes';
import { registerAction } from '@/infrastructure/auth/registerAction';

const INITIAL_STATE: SignupFormState = { error: null };

export function useSignupForm() {
    return useActionState<SignupFormState, FormData>(
        registerAction,
        INITIAL_STATE
    );
}
