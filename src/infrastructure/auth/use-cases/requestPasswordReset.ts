import { normalizeEmail, validateEmail } from '@/domain/auth/validation';
import {
    generateUrlSafeToken,
    hashEmailToken,
} from '@/infrastructure/auth/tokenUtils';
import {
    PASSWORD_RESET_TOKEN_BYTE_LENGTH,
    PASSWORD_RESET_TTL_SECONDS,
} from './constants';
import type {
    RequestPasswordResetDependencies,
    RequestPasswordResetInput,
    RequestPasswordResetOptions,
    RequestPasswordResetResult,
} from './types';

const PURPOSE = 'password_reset' as const;

/** Issue a one-time password reset token and dispatch the reset email. */
export async function requestPasswordReset(
    input: RequestPasswordResetInput,
    dependencies: RequestPasswordResetDependencies,
    options: RequestPasswordResetOptions
): Promise<RequestPasswordResetResult> {
    const email = normalizeEmail(input.email);
    const emailError = validateEmail(email);

    if (emailError !== null) {
        return { ok: true, tokenIssued: false, emailDispatched: false };
    }

    const user = await dependencies.users.findEmailAuthUserByEmail(email);

    if (user === null || user.passwordHash === null) {
        return { ok: true, tokenIssued: false, emailDispatched: false };
    }

    const rawToken = generateUrlSafeToken(PASSWORD_RESET_TOKEN_BYTE_LENGTH);
    const tokenHash = hashEmailToken(rawToken);

    await dependencies.emailTokens.set(
        PURPOSE,
        email,
        { status: 'pending', tokenHash },
        PASSWORD_RESET_TTL_SECONDS
    );

    const message = options.buildMessage(rawToken);
    const emailDispatched = await dependencies.emailDispatcher
        .sendEmail(message)
        .catch((error: unknown) => {
            console.warn(
                '[requestPasswordReset] emailDispatcher.sendEmail failed',
                error
            );
            return false;
        });

    return { ok: true, tokenIssued: true, emailDispatched };
}
