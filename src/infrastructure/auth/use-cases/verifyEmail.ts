import { normalizeEmail, validateEmail } from '@/domain/auth/validation';
import {
    hashEmailToken,
    safeCompareTokenHashes,
} from '@/infrastructure/auth/tokenUtils';
import { EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS } from '@/infrastructure/auth/use-cases/constants';
import type {
    VerifyEmailDependencies,
    VerifyEmailError,
    VerifyEmailInput,
    VerifyEmailResult,
} from '@/infrastructure/auth/use-cases/types';

const PURPOSE = 'email_verification' as const;
const INVALID_CODE_MESSAGE = 'Verification code is invalid';
const EXPIRED_CODE_MESSAGE = 'Verification code has expired';

function invalidCodeError(): VerifyEmailError {
    return {
        code: 'invalid_verification_code',
        field: 'code',
        message: INVALID_CODE_MESSAGE,
    };
}

function expiredCodeError(): VerifyEmailError {
    return {
        code: 'expired_verification_code',
        field: 'code',
        message: EXPIRED_CODE_MESSAGE,
    };
}

/** Verify a numeric email verification code. */
export async function verifyEmail(
    input: VerifyEmailInput,
    dependencies: VerifyEmailDependencies
): Promise<VerifyEmailResult> {
    const email = normalizeEmail(input.email);
    const emailError = validateEmail(email);

    if (emailError !== null) {
        return { ok: false, error: invalidCodeError() };
    }

    const stored = await dependencies.emailTokens.get(PURPOSE, email);

    if (stored === null) {
        return { ok: false, error: expiredCodeError() };
    }

    if (stored.status === 'verified') {
        return { ok: true };
    }

    const submittedHash = hashEmailToken(input.code);
    if (!safeCompareTokenHashes(submittedHash, stored.tokenHash)) {
        return { ok: false, error: invalidCodeError() };
    }

    await dependencies.emailTokens.set(
        PURPOSE,
        email,
        { status: 'verified' },
        EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS
    );

    return { ok: true };
}
