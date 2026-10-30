'use client';

import { useActionState } from 'react';
import { finalizeOAuthSignupAction } from '../actions/finalizeOAuthSignupAction';
import type { FinalizeOAuthSignupState } from '@/shared/lib/auth/formTypes';

const INITIAL_STATE: FinalizeOAuthSignupState = {};

type UseFinalizeOAuthSignupReturn = ReturnType<
    typeof useActionState<FinalizeOAuthSignupState, FormData>
>;

/**
 * "가입 완료" 폼의 `useActionState` 연결 — `[state, formAction, isPending]`. 성공은
 * 액션이 리다이렉트로 끝내므로 상태로 돌아오는 것은 약관 미동의 오류뿐이다.
 */
export function useFinalizeOAuthSignup(): UseFinalizeOAuthSignupReturn {
    return useActionState<FinalizeOAuthSignupState, FormData>(
        finalizeOAuthSignupAction,
        INITIAL_STATE
    );
}
