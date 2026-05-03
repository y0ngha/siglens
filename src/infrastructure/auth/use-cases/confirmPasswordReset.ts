import { normalizeEmail, validatePassword } from '@/domain/auth/validation';
import {
    hashEmailToken,
    safeCompareTokenHashes,
} from '@/infrastructure/auth/tokenUtils';
import {
    PASSWORD_RESET_EXPIRED_TOKEN_CODE,
    PASSWORD_RESET_INVALID_TOKEN_CODE,
} from '@/infrastructure/auth/use-cases/constants';
import type {
    ConfirmPasswordResetDependencies,
    ConfirmPasswordResetError,
    ConfirmPasswordResetInput,
    ConfirmPasswordResetResult,
} from '@/infrastructure/auth/use-cases/types';

const PURPOSE = 'password_reset' as const;
const INVALID_TOKEN_MESSAGE = 'Password reset token is invalid';
const EXPIRED_TOKEN_MESSAGE = 'Password reset token has expired';

function invalidTokenError(): ConfirmPasswordResetError {
    return {
        code: PASSWORD_RESET_INVALID_TOKEN_CODE,
        field: 'token',
        message: INVALID_TOKEN_MESSAGE,
    };
}

function expiredTokenError(): ConfirmPasswordResetError {
    return {
        code: PASSWORD_RESET_EXPIRED_TOKEN_CODE,
        field: 'token',
        message: EXPIRED_TOKEN_MESSAGE,
    };
}

// 동시성 계약: 비밀번호 업데이트 전에 토큰을 atomic consume(read+delete) → 동시 요청 둘이
// 같은 토큰으로 모두 성공하지 못하도록 보장. consume race를 이긴 caller만 rehash 수행.
/** 비밀번호 재설정 토큰을 소비하고 사용자 비밀번호 해시를 교체. */
export async function confirmPasswordReset(
    input: ConfirmPasswordResetInput,
    dependencies: ConfirmPasswordResetDependencies
): Promise<ConfirmPasswordResetResult> {
    const passwordError = validatePassword(input.newPassword);

    if (passwordError !== null) {
        return { ok: false, error: passwordError };
    }

    const email = normalizeEmail(input.email);

    // Atomically consume the token first. Any racing caller will receive null
    // here and bail out with expired_token below.
    const stored = await dependencies.emailTokens.consume(PURPOSE, email);

    if (stored === null) {
        return { ok: false, error: expiredTokenError() };
    }

    if (stored.status !== 'pending') {
        return { ok: false, error: invalidTokenError() };
    }

    const submittedHash = hashEmailToken(input.token);
    if (!safeCompareTokenHashes(submittedHash, stored.tokenHash)) {
        return { ok: false, error: invalidTokenError() };
    }

    const user =
        await dependencies.emailAuthUsers.findEmailAuthUserByEmail(email);
    if (user === null || user.passwordHash === null) {
        return { ok: false, error: invalidTokenError() };
    }

    const passwordHash = await dependencies.passwordHasher.hashPassword(
        input.newPassword
    );
    const updated = await dependencies.users.updatePassword(
        user.id,
        passwordHash
    );

    if (!updated) {
        return { ok: false, error: invalidTokenError() };
    }

    return { ok: true };
}
