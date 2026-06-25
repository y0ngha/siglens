import { normalizeEmail, validatePassword } from '@/shared/lib/auth/validation';
import { hashEmailToken, safeCompareTokenHashes } from './tokenUtils';
import {
    PASSWORD_RESET_EXPIRED_TOKEN_CODE,
    PASSWORD_RESET_INVALID_TOKEN_CODE,
} from './authUseCaseConstants';
import type {
    ConfirmPasswordResetDependencies,
    ConfirmPasswordResetError,
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

// 동시성 계약: 비밀번호 업데이트 전에 토큰을 atomic consume(read+delete) → 동시 요청 둘이
// 같은 토큰으로 모두 성공하지 못하도록 보장. consume race를 이긴 caller만 rehash 수행.
//
// same-password 체크는 토큰 소비 없이 링크를 재사용할 수 있어야 하므로 consume 이전에 수행한다.
// 그러나 토큰 검증 없이 same-password 체크를 노출하면 유효하지 않은 토큰으로도 현재
// 비밀번호를 probe할 수 있다. 이를 방지하기 위해 먼저 get(소비 없음)으로 토큰을 선검증한 뒤
// same-password를 확인하고, 마지막으로 consume으로 원자적으로 소비·재검증한다(TOCTOU 방어).
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
    const submittedHash = hashEmailToken(input.token);

    // Step 1: pre-validate the token without consuming it.
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

    // Step 2: same-password check before consuming, so the link stays valid on retry.
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

    // Step 3: atomically consume the token. Any racing caller receives null here.
    // Re-validate the consumed value to guard against TOCTOU token replacement.
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
