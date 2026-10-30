'use client';

/**
 * 회원가입 이메일 인증 두 단계(코드 요청·코드 확인)의 Server Action을
 * `useActionState`로 묶는다. 단계 전환은 소비자(`auth-signup`)가 이 상태로 판단한다.
 */

import { useActionState } from 'react';
import type {
    RequestEmailVerificationFormState,
    VerifyEmailFormState,
} from '@/shared/lib/auth/formTypes';
import { requestEmailVerificationAction } from '../actions/requestEmailVerificationAction';
import { verifyEmailAction } from '../actions/verifyEmailAction';

const REQUEST_INITIAL: RequestEmailVerificationFormState = {
    submitted: false,
    error: null,
};

const VERIFY_INITIAL: VerifyEmailFormState = {
    verified: false,
    error: null,
};

type UseRequestEmailVerificationReturn = ReturnType<
    typeof useActionState<RequestEmailVerificationFormState, FormData>
>;

type UseVerifyEmailReturn = ReturnType<
    typeof useActionState<VerifyEmailFormState, FormData>
>;

/** 코드 요청 폼. `state.submitted`가 켜지면 `SignupForm`이 코드 입력 단계로 넘어간다. */
export function useRequestEmailVerification(): UseRequestEmailVerificationReturn {
    return useActionState<RequestEmailVerificationFormState, FormData>(
        requestEmailVerificationAction,
        REQUEST_INITIAL
    );
}

/** 코드 확인 폼. `state.verified`가 켜지면 `SignupForm`이 가입 정보 단계로 넘어간다. */
export function useVerifyEmail(): UseVerifyEmailReturn {
    return useActionState<VerifyEmailFormState, FormData>(
        verifyEmailAction,
        VERIFY_INITIAL
    );
}
