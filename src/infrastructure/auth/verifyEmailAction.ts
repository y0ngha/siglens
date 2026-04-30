'use server';

import type { VerifyEmailFormState } from '@/domain/auth/formTypes';
// TODO(siglens-core#55): replace with real exports once the new core ships.
import { createEmailTokenStore, verifyEmail } from '@/domain/auth/coreStubs';

export async function verifyEmailAction(
    _prev: VerifyEmailFormState,
    formData: FormData
): Promise<VerifyEmailFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const code = String(formData.get('code') ?? '').trim();

    const emailTokens = createEmailTokenStore();
    const result = await verifyEmail({ email, code }, { emailTokens });

    if (!result.ok) {
        return {
            verified: false,
            error: { code: result.error.code, message: result.error.message },
        };
    }

    return { verified: true, error: null };
}
