import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import { generateUrlSafeToken, hashEmailToken } from './tokenUtils';
import {
    PASSWORD_RESET_RATE_LIMITS,
    PASSWORD_RESET_TOKEN_BYTE_LENGTH,
    PASSWORD_RESET_TTL_SECONDS,
} from './authUseCaseConstants';
import {
    passwordResetCooldownKey,
    passwordResetEmailDayKey,
    passwordResetEmailHourKey,
    passwordResetIpDayKey,
    passwordResetIpHourKey,
} from './authRateLimitKeys';
import { passesRateLimits } from './passesRateLimits';
import type {
    RequestPasswordResetDependencies,
    RequestPasswordResetInput,
    RequestPasswordResetOptions,
    RequestPasswordResetResult,
} from './authUseCaseTypes';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

const PURPOSE = 'password_reset' as const;

/**
 * 1회용 비밀번호 재설정 토큰을 발급해 메일로 보낸다. 토큰은 해시만 저장한다.
 *
 * 잘못된 이메일·없는 계정·비밀번호 없는(OAuth 전용) 계정·기존 계정 모두 `ok: true`로
 * 같게 응답한다. 계정이 있을 때만 하는 I/O(토큰 저장·메일 발송)는 `deferDispatch`로 응답 뒤에
 * 돌려, 응답 시간으로도 계정 존재 여부가 새지 않게 한다 — 응답 경로의 await는 두 경우 모두
 * 한도 확인과 계정 조회뿐이다. 그 대가로 발송 성공 여부는 호출자가 알 수 없고, 실패는 로그로만 남는다.
 *
 * 남용 한도(가입 코드 요청 `requestEmailVerification`과 같은 숫자·순서). 형식 검사는 먼저 하고 세지 않는다.
 * 그 뒤 IP(해시) 한도를 주소 한도보다 먼저 세고, 첫 거부에서 멈춰 `rate_limited`를 돌려준다(DB·토큰·메일 없음).
 * 한도는 계정을 조회하기 **전에** 세고 키는 입력 주소와 IP로만 정해지므로, 계정이 있든 없든 같은 키를
 * 같은 횟수로 세어 응답이 계정 존재 여부에 달라지지 않는다.
 */
export async function requestPasswordReset(
    input: RequestPasswordResetInput,
    dependencies: RequestPasswordResetDependencies,
    options: RequestPasswordResetOptions
): Promise<RequestPasswordResetResult> {
    const email = normalizeEmail(input.email);
    const emailError = validateEmail(email);

    if (emailError !== null) {
        return { ok: true };
    }

    const emailHash = hashEmailToken(email);
    const ipHash = await dependencies.ipHash();
    const limits = PASSWORD_RESET_RATE_LIMITS;
    const allowed = await passesRateLimits(dependencies.rateLimit, [
        { key: passwordResetIpHourKey(ipHash), ...limits.requestPerIpHour },
        { key: passwordResetIpDayKey(ipHash), ...limits.requestPerIpDay },
        {
            key: passwordResetCooldownKey(emailHash),
            ...limits.requestCooldownPerEmail,
        },
        {
            key: passwordResetEmailHourKey(emailHash),
            ...limits.requestPerEmailHour,
        },
        {
            key: passwordResetEmailDayKey(emailHash),
            ...limits.requestPerEmailDay,
        },
    ]);
    if (!allowed) {
        return { ok: false, reason: 'rate_limited' };
    }

    const user = await dependencies.users.findEmailAuthUserByEmail(email);

    if (user !== null && user.passwordHash !== null) {
        const rawToken = generateUrlSafeToken(PASSWORD_RESET_TOKEN_BYTE_LENGTH);
        const tokenHash = hashEmailToken(rawToken);

        // 토큰 저장(Redis)과 메일 발송(Resend)은 응답 뒤로 미룬다. 계정이 있을 때만 하는 I/O라
        // 응답 경로에서 기다리면 응답 시간으로 계정 존재 여부가 드러난다.
        dependencies.deferDispatch(async () => {
            try {
                await dependencies.emailTokens.set(
                    PURPOSE,
                    email,
                    { status: 'pending', tokenHash },
                    PASSWORD_RESET_TTL_SECONDS
                );
                await dependencies.emailDispatcher.sendEmail(
                    options.buildMessage(rawToken)
                );
            } catch (error: unknown) {
                console.warn(
                    '[requestPasswordReset] deferred token store/dispatch failed',
                    redactDbErrorForLog(error)
                );
            }
        });
    }

    return { ok: true };
}
