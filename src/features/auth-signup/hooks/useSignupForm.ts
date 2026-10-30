'use client';

import { useActionState } from 'react';
import type { SignupFormState } from '@/shared/lib/auth/formTypes';
import { registerAction } from '../actions/registerAction';

const INITIAL_STATE: SignupFormState = { error: null };

type UseSignupFormReturn = ReturnType<
    typeof useActionState<SignupFormState, FormData>
>;

/** 3단계 가입 폼을 `registerAction`에 묶는다. 성공하면 액션이 리다이렉트하므로 상태에는 오류만 남는다. */
export function useSignupForm(): UseSignupFormReturn {
    return useActionState<SignupFormState, FormData>(
        registerAction,
        INITIAL_STATE
    );
}
