'use client';

/**
 * @file 로그인 서버 액션을 `useActionState`로 묶는 훅.
 */

import { useActionState } from 'react';
import type { LoginFormState } from '@/shared/lib/auth/formTypes';
import { loginAction } from '../actions/loginAction';

const INITIAL_STATE: LoginFormState = { error: null };

type UseLoginFormReturn = ReturnType<
    typeof useActionState<LoginFormState, FormData>
>;

/** `[state, formAction, isPending]` — `formAction`은 `<form action>`에 그대로 단다. */
export function useLoginForm(): UseLoginFormReturn {
    return useActionState<LoginFormState, FormData>(loginAction, INITIAL_STATE);
}
