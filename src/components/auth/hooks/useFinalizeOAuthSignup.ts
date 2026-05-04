'use client';

import { useActionState } from 'react';
import { finalizeOAuthSignupAction } from '@/infrastructure/auth/finalizeOAuthSignupAction';
import type { FinalizeOAuthSignupState } from '@/domain/types';

const INITIAL_STATE: FinalizeOAuthSignupState = {};

type UseFinalizeOAuthSignupReturn = ReturnType<
    typeof useActionState<FinalizeOAuthSignupState, FormData>
>;

export function useFinalizeOAuthSignup(): UseFinalizeOAuthSignupReturn {
    return useActionState<FinalizeOAuthSignupState, FormData>(
        finalizeOAuthSignupAction,
        INITIAL_STATE
    );
}
