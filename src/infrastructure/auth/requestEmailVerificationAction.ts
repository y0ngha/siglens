'use server';

import { requestEmailVerification } from '@/infrastructure/auth/use-cases/requestEmailVerification';
import { createEmailTokenStore } from '@/infrastructure/email/tokenStore';
import type { RequestEmailVerificationFormState } from '@/domain/auth/formTypes';
import { buildEmailVerificationEmail } from '@/infrastructure/email/emailVerificationEmail';
import { createEmailDispatcher } from '@/infrastructure/email/resend';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from './errorMessages';

export async function requestEmailVerificationAction(
    _prev: RequestEmailVerificationFormState,
    formData: FormData
): Promise<RequestEmailVerificationFormState> {
    const email = String(formData.get('email') ?? '').trim();

    const emailTokens = createEmailTokenStore();
    if (!emailTokens) {
        return {
            submitted: false,
            error: {
                code: 'redis_unavailable',
                message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }
    const emailDispatcher = createEmailDispatcher();

    // ok: true 고정 (enumeration 회피); codeIssued/emailDispatched 는 운영 디버깅용 필드.
    await requestEmailVerification(
        { email },
        { emailTokens, emailDispatcher },
        {
            buildMessage: code =>
                buildEmailVerificationEmail({ to: email, code }),
        }
    );

    return { submitted: true, error: null };
}
