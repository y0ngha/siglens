'use server';

import { requestEmailVerification } from '@/infrastructure/auth/use-cases/requestEmailVerification';
import {
    createEmailTokenStore,
    buildEmailVerificationEmail,
} from '@/entities/email-token';
import type { RequestEmailVerificationFormState } from '@/domain/auth/formTypes';
import { createEmailDispatcher } from '@/shared/email';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';
import { normalizeEmail } from '@/domain/auth/validation';

export async function requestEmailVerificationAction(
    _prev: RequestEmailVerificationFormState,
    formData: FormData
): Promise<RequestEmailVerificationFormState> {
    const email = normalizeEmail(String(formData.get('email') ?? ''));

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
