import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import { generateNumericCode, hashEmailToken } from './tokenUtils';
import {
    EMAIL_VERIFICATION_CODE_LENGTH,
    EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
    EMAIL_VERIFICATION_RATE_LIMITS,
} from './authUseCaseConstants';
import type {
    RequestEmailVerificationDependencies,
    RequestEmailVerificationInput,
    RequestEmailVerificationOptions,
    RequestEmailVerificationResult,
} from './authUseCaseTypes';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

const PURPOSE = 'email_verification' as const;

/** 한도 키와 시도 카운터 키에는 주소 원문이 아니라 SHA-256 해시만 둔다(`hashEmailToken`은 같은 SHA-256 hex). */
export function emailVerificationAttemptsKey(emailHash: string): string {
    return `auth:signup-verify:e:${emailHash}`;
}

/**
 * 숫자 이메일 인증 코드를 발급해 해당 주소로 보낸다. 코드는 해시만 저장한다.
 *
 * 형식이 잘못된 이메일은 오류 대신 `ok: true`(`codeIssued: false`)를 돌려준다. 발송 실패는
 * 던지지 않고 `emailDispatched: false`로 알린다.
 *
 * 남용 한도(알림 메일의 `requestMailAlertCode`와 같은 순서). 형식 검사는 먼저 하고 세지 않는다. 그 뒤 IP(해시)
 * 한도를 주소 한도보다 먼저 센다 — 막힌 IP가 주소의 칸을 소모하지 않게 한다. 하나라도 막히면 코드도 메일도
 * 없이 `rate_limited`다. 코드를 저장하면 그 주소의 확인 시도 카운터를 0으로 되돌린 뒤 보낸다. 한도는 주소·IP로만
 * 정해지고 DB를 읽지 않으므로 계정 존재 여부가 응답에 드러나지 않는다.
 */
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

    const emailHash = hashEmailToken(email);
    const ipHash = await dependencies.ipHash();
    const limits = EMAIL_VERIFICATION_RATE_LIMITS;
    const rules = [
        { key: `auth:signup-code:ip:h:${ipHash}`, ...limits.codePerIpHour },
        { key: `auth:signup-code:ip:d:${ipHash}`, ...limits.codePerIpDay },
        {
            key: `auth:signup-code:e:cd:${emailHash}`,
            ...limits.codeCooldownPerEmail,
        },
        {
            key: `auth:signup-code:e:h:${emailHash}`,
            ...limits.codePerEmailHour,
        },
        {
            key: `auth:signup-code:e:d:${emailHash}`,
            ...limits.codePerEmailDay,
        },
    ];
    // 순서가 보안이다(IP 먼저, 첫 거부에서 멈춤). 순차 await가 의도라 병렬화하지 않는다.
    for (const rule of rules) {
        if (!(await dependencies.rateLimit(rule))) {
            return { ok: false, reason: 'rate_limited' };
        }
    }

    const code = generateNumericCode(EMAIL_VERIFICATION_CODE_LENGTH);
    const tokenHash = hashEmailToken(code);

    await dependencies.emailTokens.set(
        PURPOSE,
        email,
        { status: 'pending', tokenHash },
        EMAIL_VERIFICATION_PENDING_TTL_SECONDS
    );
    await dependencies.resetCounter(emailVerificationAttemptsKey(emailHash));

    const message = options.buildMessage(code);
    const emailDispatched = await dependencies.emailDispatcher
        .sendEmail(message)
        .catch((error: unknown) => {
            console.warn(
                '[requestEmailVerification] emailDispatcher.sendEmail failed',
                redactDbErrorForLog(error)
            );
            return false;
        });

    return { ok: true, codeIssued: true, emailDispatched };
}
