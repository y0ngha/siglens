import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import {
    generateNumericCode,
    hashEmailToken,
} from '@/entities/session/lib/tokenUtils';
import {
    EMAIL_VERIFICATION_CODE_LENGTH,
    EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
} from './authUseCaseConstants';
import type {
    RequestEmailVerificationDependencies,
    RequestEmailVerificationInput,
    RequestEmailVerificationOptions,
    RequestEmailVerificationResult,
} from './authUseCaseTypes';

const PURPOSE = 'email_verification' as const;

/** Issue a numeric email verification code and dispatch it to the address. */
export async function requestEmailVerification(
    input: RequestEmailVerificationInput,
    dependencies: RequestEmailVerificationDependencies,
    options: RequestEmailVerificationOptions
): Promise<RequestEmailVerificationResult> {
    const email = normalizeEmail(input.email);
    const emailError = validateEmail(email);

    if (emailError !== null) {
        return { ok: true, codeIssued: false, emailDispatched: false };
    }

    const code = generateNumericCode(EMAIL_VERIFICATION_CODE_LENGTH);
    const tokenHash = hashEmailToken(code);

    await dependencies.emailTokens.set(
        PURPOSE,
        email,
        { status: 'pending', tokenHash },
        EMAIL_VERIFICATION_PENDING_TTL_SECONDS
    );

    const message = options.buildMessage(code);
    const emailDispatched = await dependencies.emailDispatcher
        .sendEmail(message)
        .catch((error: unknown) => {
            console.warn(
                '[requestEmailVerification] emailDispatcher.sendEmail failed',
                error
            );
            return false;
        });

    return { ok: true, codeIssued: true, emailDispatched };
}
