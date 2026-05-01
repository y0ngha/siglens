'use server';

import { createEmailTokenStore, verifyEmail } from '@y0ngha/siglens-core';
import type { VerifyEmailFormState } from '@/domain/auth/formTypes';

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
                code: 'invalid_verification_code',
                message: '서비스가 일시적으로 동작하지 않습니다.',
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
