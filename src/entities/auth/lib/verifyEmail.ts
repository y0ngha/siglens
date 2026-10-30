import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import { hashEmailToken, safeCompareTokenHashes } from './tokenUtils';
import { EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS } from './authUseCaseConstants';
import type {
    VerifyEmailDependencies,
    VerifyEmailError,
    VerifyEmailInput,
    VerifyEmailResult,
} from './authUseCaseTypes';

const PURPOSE = 'email_verification' as const;
const INVALID_CODE_MESSAGE = '인증 코드가 올바르지 않습니다.';
const EXPIRED_CODE_MESSAGE = '인증 코드가 만료되었습니다.';

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

/**
 * 제출된 이메일 인증 코드를 저장된 해시와 상수 시간으로 비교하고, 맞으면 `verified` 마커로 바꾼다.
 * 마커는 `registerUser`가 가입 시 확인한다. 이미 `verified`면 코드를 보지 않고 성공을 돌려준다.
 */
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
