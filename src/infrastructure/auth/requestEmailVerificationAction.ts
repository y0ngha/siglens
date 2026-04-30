'use server';

import type { RequestEmailVerificationFormState } from '@/domain/auth/formTypes';
import { buildEmailVerificationEmail } from '@/infrastructure/email/emailVerificationEmail';
import { createEmailDispatcher } from '@/infrastructure/email/resend';
// TODO(siglens-core#55): replace with real exports once the new core ships.
import {
    createEmailTokenStore,
    requestEmailVerification,
} from '@/domain/auth/coreStubs';

export async function requestEmailVerificationAction(
    _prev: RequestEmailVerificationFormState,
    formData: FormData
): Promise<RequestEmailVerificationFormState> {
    const email = String(formData.get('email') ?? '').trim();

    const emailTokens = createEmailTokenStore();
    const emailDispatcher = createEmailDispatcher();

    const result = await requestEmailVerification(
        { email },
        { emailTokens, emailDispatcher },
        {
            buildMessage: code =>
                buildEmailVerificationEmail({ to: email, code }),
        }
    );

    if (!result.ok) {
        return {
            submitted: false,
            error: {
                code: result.error.code,
                message: result.error.message,
            },
        };
    }

    return { submitted: true, error: null };
}
