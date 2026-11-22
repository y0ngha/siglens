import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import { hashEmailToken, safeCompareTokenHashes } from './tokenUtils';
import {
    EMAIL_VERIFICATION_RATE_LIMITS,
    EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS,
} from './authUseCaseConstants';
import { emailVerificationAttemptsKey } from './requestEmailVerification';
import type {
    VerifyEmailDependencies,
    VerifyEmailError,
    VerifyEmailInput,
    VerifyEmailResult,
} from './authUseCaseTypes';

const PURPOSE = 'email_verification' as const;
const INVALID_CODE_MESSAGE = '인증 코드가 올바르지 않습니다.';
const EXPIRED_CODE_MESSAGE = '인증 코드가 만료되었습니다.';
const RATE_LIMITED_MESSAGE =
    '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
const TOO_MANY_ATTEMPTS_MESSAGE =
    '인증 코드를 여러 번 잘못 입력했습니다. 새 코드를 받아 주세요.';

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

function rateLimitedError(): VerifyEmailError {
    return {
        code: 'rate_limited',
        field: 'code',
        message: RATE_LIMITED_MESSAGE,
    };
}

function tooManyAttemptsError(): VerifyEmailError {
    return {
        code: 'too_many_verification_attempts',
        field: 'code',
        message: TOO_MANY_ATTEMPTS_MESSAGE,
    };
}

/**
 * 제출된 이메일 인증 코드를 저장된 해시와 상수 시간으로 비교하고, 맞으면 `verified` 마커로 바꾼다.
 * 마커는 `registerUser`가 가입 시 확인한다. 이미 `verified`면 코드를 보지 않고 성공을 돌려준다.
 *
 * 순서가 보안이다(알림 메일의 `confirmMailAlertCode`와 같은 구조):
 * 1. 형식 검사는 먼저, 세지 않는다.
 * 2. IP(해시)당 시도 한도. 제3자가 한 주소의 카운터를 계속 채워 두지 못하게 한다.
 * 3. 주소(해시)당 시도를 **비교 전에** 센다(원자 증가, 맞는 코드도 센다). 한도를 넘으면 비교하지 않고
 *    대기 중(`pending`)인 코드만 지운 뒤 `too_many_verification_attempts`다. `verified` 마커는 남겨 제3자가
 *    끝난 인증을 되돌리지 못하게 한다. 동시에 들어온 요청들이 한도 밖에서 비교되는 일도 없다.
 * 4. 그 뒤는 그대로다: 없으면 만료, `verified`면 성공, 상수 시간 비교, 맞으면 마커.
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

    const ipHash = await dependencies.ipHash();
    const withinIp = await dependencies.rateLimit({
        key: `auth:signup-verify:ip:${ipHash}`,
        ...EMAIL_VERIFICATION_RATE_LIMITS.confirmPerIp,
    });
    if (!withinIp) {
        return { ok: false, error: rateLimitedError() };
    }

    const withinAttempts = await dependencies.rateLimit({
        key: emailVerificationAttemptsKey(hashEmailToken(email)),
        ...EMAIL_VERIFICATION_RATE_LIMITS.attemptsPerEmail,
    });
    if (!withinAttempts) {
        const pending = await dependencies.emailTokens.get(PURPOSE, email);
        if (pending?.status === 'pending') {
            await dependencies.emailTokens.delete(PURPOSE, email);
        }
        return { ok: false, error: tooManyAttemptsError() };
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
