'use client';

import { useCallback } from 'react';
import { cancelOAuthSignupAction } from '@/infrastructure/auth/cancelOAuthSignupAction';

export function useCancelOAuthSignup(): (formData: FormData) => Promise<void> {
    return useCallback(
        (formData: FormData) => cancelOAuthSignupAction(formData),
        []
    );
}
