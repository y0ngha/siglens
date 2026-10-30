import type { ConfirmPasswordResetError } from '@/shared/lib/auth/types';
import { normalizeEmail, validatePassword } from '@/shared/lib/auth/validation';
import { hashEmailToken, safeCompareTokenHashes } from './tokenUtils';
import {
    PASSWORD_RESET_EXPIRED_TOKEN_CODE,
    PASSWORD_RESET_INVALID_TOKEN_CODE,
} from './authUseCaseConstants';
import type {
    ConfirmPasswordResetDependencies,
    ConfirmPasswordResetInput,
    ConfirmPasswordResetResult,
} from './authUseCaseTypes';

const PURPOSE = 'password_reset' as const;
const INVALID_TOKEN_MESSAGE = '비밀번호 재설정 토큰이 유효하지 않습니다.';
const EXPIRED_TOKEN_MESSAGE = '비밀번호 재설정 토큰이 만료되었습니다.';
const SAME_PASSWORD_MESSAGE =
    '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.';

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

function samePasswordError(): ConfirmPasswordResetError {
    return {
        code: 'same_password',
        message: SAME_PASSWORD_MESSAGE,
    };
}

/**
 * 비밀번호 재설정 토큰을 소비하고 사용자 비밀번호 해시를 교체한다.
 *
 * 동시성 계약: 비밀번호를 바꾸기 전에 토큰을 atomic consume(read+delete)해, 같은 토큰으로
 * 동시 요청 둘이 모두 성공하지 못하게 한다. consume 경합을 이긴 호출만 rehash한다.
 *
 * same-password 체크는 링크를 재사용할 수 있게 consume 이전에 한다. 하지만 토큰 검증 없이
 * 노출하면 무효 토큰으로도 현재 비밀번호를 probe할 수 있으므로, 먼저 get(소비 없음)으로
 * 토큰을 선검증한 뒤 same-password를 확인하고, 마지막으로 consume으로 원자적으로 소비·재검증한다
 * (TOCTOU 방어).
 */
export async function confirmPasswordReset(
    input: ConfirmPasswordResetInput,
    dependencies: ConfirmPasswordResetDependencies
): Promise<ConfirmPasswordResetResult> {
    const passwordError = validatePassword(input.newPassword);

    if (passwordError !== null) {
        return { ok: false, error: passwordError };
    }

    const email = normalizeEmail(input.email);
    const submittedHash = hashEmailToken(input.token);

    // 1단계: 토큰을 소비하지 않고 선검증한다.
    const peeked = await dependencies.emailTokens.get(PURPOSE, email);
    if (peeked === null) {
        return { ok: false, error: expiredTokenError() };
    }
    if (peeked.status !== 'pending') {
        return { ok: false, error: invalidTokenError() };
    }
    if (!safeCompareTokenHashes(submittedHash, peeked.tokenHash)) {
        return { ok: false, error: invalidTokenError() };
    }

    // 2단계: 소비 전에 same-password를 확인해, 재시도해도 링크가 유효하게 한다.
    const user =
        await dependencies.emailAuthUsers.findEmailAuthUserByEmail(email);
    if (user === null || user.passwordHash === null) {
        return { ok: false, error: invalidTokenError() };
    }
    const isSamePassword = await dependencies.passwordVerifier.verifyPassword(
        input.newPassword,
        user.passwordHash
    );
    if (isSamePassword) {
        return { ok: false, error: samePasswordError() };
    }

    // 3단계: 토큰을 원자적으로 소비한다. 경합한 다른 호출은 여기서 null을 받는다.
    // TOCTOU 토큰 교체를 막으려고 소비한 값을 다시 검증한다.
    const stored = await dependencies.emailTokens.consume(PURPOSE, email);
    if (stored === null) {
        return { ok: false, error: expiredTokenError() };
    }
    if (stored.status !== 'pending') {
        return { ok: false, error: invalidTokenError() };
    }
    if (!safeCompareTokenHashes(submittedHash, stored.tokenHash)) {
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
