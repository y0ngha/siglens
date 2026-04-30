'use client';

import { useActionState } from 'react';
import type {
    RequestEmailVerificationFormState,
    VerifyEmailFormState,
} from '@/domain/auth/formTypes';
import { requestEmailVerificationAction } from '@/infrastructure/auth/requestEmailVerificationAction';
import { verifyEmailAction } from '@/infrastructure/auth/verifyEmailAction';

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

export function useRequestEmailVerification(): UseRequestEmailVerificationReturn {
    return useActionState<RequestEmailVerificationFormState, FormData>(
        requestEmailVerificationAction,
        REQUEST_INITIAL
    );
}

export function useVerifyEmail(): UseVerifyEmailReturn {
    return useActionState<VerifyEmailFormState, FormData>(
        verifyEmailAction,
        VERIFY_INITIAL
    );
}
