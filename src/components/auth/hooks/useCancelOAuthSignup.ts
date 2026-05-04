'use client';

import { cancelOAuthSignupAction } from '@/infrastructure/auth/cancelOAuthSignupAction';

export function useCancelOAuthSignup(): typeof cancelOAuthSignupAction {
    return cancelOAuthSignupAction;
}
