import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import type { EmailAuthUserRecord } from '@/shared/db/types';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { normalizeEmail } from '@/shared/lib/auth/validation';
import {
    loginEmailIpKey,
    loginEmailKey,
    loginIpDayKey,
    loginIpKey,
} from './authRateLimitKeys';
import {
    LOGIN_RATE_LIMITS,
    RATE_LIMITED_MESSAGE,
    LOGIN_TIMING_DUMMY_HASH,
} from './authUseCaseConstants';
import type {
    LoginUserDependencies,
    LoginUserError,
    LoginUserInput,
    LoginUserOptions,
    LoginUserResult,
} from './authUseCaseTypes';
import { passesRateLimits } from './passesRateLimits';
import { createAuthSession } from './sessionCookie';
import { hashEmailToken } from './tokenUtils';

const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다.';
const TOO_MANY_LOGIN_ATTEMPTS_MESSAGE =
    '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';

function invalidCredentialsError(): LoginUserError {
    return {
        code: 'invalid_credentials',
        message: INVALID_CREDENTIALS_MESSAGE,
    };
}

function omitPasswordHash(user: EmailAuthUserRecord): AuthUserRecord {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
}

/**
 * 이메일·비밀번호로 로그인해 새 세션과 쿠키를 만든다. 없는 계정·비밀번호 없는(OAuth 전용)
 * 계정·틀린 비밀번호는 같은 `invalid_credentials`로 응답해 계정 존재 여부를 구분할 수 없게 한다.
 * 반환 사용자에서 `passwordHash`는 제거된다.
 *
 * 남용 한도: 시도 **전부**를 계정 조회 전에 센다(맞는 비밀번호도 센다). 키는 주소·IP의 해시로만 정해지므로
 * 응답이 계정 존재 여부에 달라지지 않는다. 순서는 IP, IP 하루, 주소+IP, 주소이고 첫 거부에서 멈춘다. IP 규칙은
 * `rate_limited`, 주소 규칙은 `too_many_login_attempts`다. 성공은 주소+IP 쌍 키만 푼다(주소 키를 풀면 주인이
 * 로그인할 때마다 공격자가 새 예산을 얻는다). 주소 잠금은 비밀번호 재설정이 푼다.
 *
 * 균일한 시간: 계정이 없거나 비밀번호가 없으면 더미 해시와 비교해 결과를 버린다. 계정이 있을 때와 같은
 * bcrypt 비용을 치러 응답 시간으로 계정 유무를 가리지 못하게 한다.
 */
export async function loginUser(
    input: LoginUserInput,
    dependencies: LoginUserDependencies,
    options: LoginUserOptions = {}
): Promise<LoginUserResult> {
    const email = normalizeEmail(input.email);
    const emailHash = hashEmailToken(email);
    const ipHash = await dependencies.ipHash();
    const limits = LOGIN_RATE_LIMITS;
    const pairKey = loginEmailIpKey(emailHash, ipHash);

    if (
        !(await passesRateLimits(dependencies.rateLimit, [
            { key: loginIpKey(ipHash), ...limits.perIp },
            { key: loginIpDayKey(ipHash), ...limits.perIpDay },
        ]))
    ) {
        return {
            ok: false,
            error: { code: 'rate_limited', message: RATE_LIMITED_MESSAGE },
        };
    }
    if (
        !(await passesRateLimits(dependencies.rateLimit, [
            { key: pairKey, ...limits.perEmailIp },
            { key: loginEmailKey(emailHash), ...limits.perEmail },
        ]))
    ) {
        return {
            ok: false,
            error: {
                code: 'too_many_login_attempts',
                message: TOO_MANY_LOGIN_ATTEMPTS_MESSAGE,
            },
        };
    }

    const user = await dependencies.users.findEmailAuthUserByEmail(email);

    if (user === null || user.passwordHash === null) {
        await dependencies.passwordVerifier.verifyPassword(
            input.password,
            LOGIN_TIMING_DUMMY_HASH
        );
        return { ok: false, error: invalidCredentialsError() };
    }

    const passwordMatches = await dependencies.passwordVerifier.verifyPassword(
        input.password,
        user.passwordHash
    );

    if (!passwordMatches) {
        return { ok: false, error: invalidCredentialsError() };
    }

    // 해제는 best-effort: 실패가 이미 맞게 끝난 로그인을 실패로 만들지 않는다.
    await dependencies.resetCounter(pairKey).catch((error: unknown) => {
        console.warn(
            '[loginUser] login counter release failed after a success:',
            redactDbErrorForLog(error)
        );
    });

    const now = options.now ?? new Date();
    const { session, cookie } = await createAuthSession({
        userId: user.id,
        sessions: dependencies.sessions,
        now,
        sessionTtlSeconds: options.sessionTtlSeconds,
        cookieName: options.cookieName,
        secureCookie: options.secureCookie,
        sameSite: options.sameSite,
        path: options.path,
    });
    const safeUser = omitPasswordHash(user);

    return { ok: true, user: safeUser, session, cookie };
}
