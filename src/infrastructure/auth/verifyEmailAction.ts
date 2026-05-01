'use server';

import { verifyEmail } from '@/infrastructure/auth/use-cases/verifyEmail';
import { createEmailTokenStore } from '@/infrastructure/email/tokenStore';
import type { VerifyEmailFormState } from '@/domain/auth/formTypes';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from './errorMessages';

export async function verifyEmailAction(
    _prev: VerifyEmailFormState,
    formData: FormData
): Promise<VerifyEmailFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const code = String(formData.get('code') ?? '').trim();

    const emailTokens = createEmailTokenStore();
    if (!emailTokens) {
        return {
            verified: false,
            error: {
                code: 'redis_unavailable',
                message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }
    const result = await verifyEmail({ email, code }, { emailTokens });

    if (!result.ok) {
        return {
            verified: false,
            error: { code: result.error.code, message: result.error.message },
        };
    }

    return { verified: true, error: null };
}
