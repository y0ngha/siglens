import 'server-only';

import { createHash } from 'node:crypto';
import {
    EMAIL_VERIFICATION_CODE_LENGTH,
    EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
} from '@/entities/auth/lib/authUseCaseConstants';
import {
    generateNumericCode,
    hashEmailToken,
    safeCompareTokenHashes,
} from '@/entities/auth/lib/tokenUtils';
import type { EmailTokenStore } from '@/entities/email-token/types';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import type { EmailDispatcher, EmailMessage } from '@/shared/email/types';
import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import { MAIL_ALERT_RATE_LIMITS } from '../lib/mailAlertConstants';

/** 한 번의 한도 확인. `true`면 허용이다(고정 창 방식, Redis 장애는 통과). 호출 한 번이 시도 한 번이다. */
export type MailAlertRateLimiter = (rule: {
    readonly key: string;
    readonly limit: number;
    readonly windowSeconds: number;
}) => Promise<boolean>;

export interface MailAlertCodeDeps {
    readonly emailTokens: EmailTokenStore;
    readonly emailDispatcher: EmailDispatcher;
    readonly rateLimit: MailAlertRateLimiter;
    /** 한도 카운터를 0으로 되돌린다(새 코드를 보낼 때 확인 시도 카운터에 쓴다). */
    readonly resetCounter: (key: string) => Promise<void>;
    /** 요청 IP의 해시(`hashUsageIp`) — 원본 IP는 키에도 로그에도 남지 않는다. */
    readonly ipHash: string;
    readonly buildMessage: (email: string, code: string) => EmailMessage;
}

export type RequestMailAlertCodeOutcome =
    | { readonly status: 'code_sent'; readonly email: string }
    | {
          readonly status: 'invalid_email' | 'rate_limited' | 'unavailable';
      };

export type ConfirmMailAlertCodeOutcome =
    | { readonly status: 'verified'; readonly email: string }
    | {
          readonly status:
              | 'invalid_email'
              | 'wrong_code'
              | 'expired'
              | 'too_many'
              | 'rate_limited';
      };

/** 한도 키와 코드 기록 키에는 주소 원문이 아니라 해시만 둔다(방침이 해시만 보관한다고 적는다). */
function emailHash(email: string): string {
    return createHash('sha256').update(email).digest('hex');
}

function attemptsKey(hash: string): string {
    return `mail-alert:verify:e:${hash}`;
}

/**
 * 알림 메일 신청의 코드 발급. 코드 기록은 가입 인증(`email_verification`)과 다른 `mail_alert` 용도의 키이고,
 * 키 자리에도 주소가 아니라 **주소 해시**가 들어간다(Redis에 평문 주소가 남지 않는다). 가입 쪽에는 없는
 * 남용 한도를 건다: IP(해시)당·주소(해시)당 시간당 횟수. 넓은 쪽(IP)을 먼저 세어 막힌 요청이 주소 칸을
 * 소모하지 않게 한다. 새 코드를 저장하면 그 주소의 확인 시도 카운터를 0으로 되돌린다.
 *
 * 응답은 주소나 계정이 이미 있는지에 따라 달라지지 않는다.
 */
export async function requestMailAlertCode(
    rawEmail: string,
    deps: MailAlertCodeDeps
): Promise<RequestMailAlertCodeOutcome> {
    const email = normalizeEmail(rawEmail);
    if (validateEmail(email) !== null) return { status: 'invalid_email' };

    const hash = emailHash(email);
    const { codePerIp, codePerEmail } = MAIL_ALERT_RATE_LIMITS;
    const withinIp = await deps.rateLimit({
        key: `mail-alert:code:ip:${deps.ipHash}`,
        ...codePerIp,
    });
    if (!withinIp) return { status: 'rate_limited' };
    const withinEmail = await deps.rateLimit({
        key: `mail-alert:code:e:${hash}`,
        ...codePerEmail,
    });
    if (!withinEmail) return { status: 'rate_limited' };

    const code = generateNumericCode(EMAIL_VERIFICATION_CODE_LENGTH);
    await deps.emailTokens.set(
        'mail_alert',
        hash,
        { status: 'pending', tokenHash: hashEmailToken(code) },
        EMAIL_VERIFICATION_PENDING_TTL_SECONDS
    );
    await deps.resetCounter(attemptsKey(hash));
    const dispatched = await deps.emailDispatcher
        .sendEmail(deps.buildMessage(email, code))
        .catch((error: unknown) => {
            console.warn(
                '[requestMailAlertCode] emailDispatcher.sendEmail failed',
                redactDbErrorForLog(error)
            );
            return false;
        });
    return dispatched
        ? { status: 'code_sent', email }
        : { status: 'unavailable' };
}

/**
 * 코드 확인. 순서가 보안이다:
 * 1. IP(해시)당 시도 한도. 제3자가 한 주소의 카운터를 계속 채워 두지 못하게 한다.
 * 2. 주소(해시)당 시도를 **비교 전에** 센다(원자 증가). 한도를 넘은 요청은 비교하지 않고 대기 중인 코드를
 *    지운 뒤 `too_many`다 — 동시에 들어온 요청 여럿이 같은 카운터를 보고 한도 밖에서 비교되는 일이 없다.
 * 3. 저장된 값이 대기 중(`pending`)이 아니면 만료다. 이 용도에서는 `verified` 마커를 쓰지도 받아들이지도 않는다.
 * 4. 상수 시간 비교. 맞으면 대기 값을 원자적으로 꺼내(`consume`) 같은 해시인지 다시 보고 끝낸다 — 같은 코드를
 *    동시에 쓴 두 요청 중 하나만 이긴다.
 */
export async function confirmMailAlertCode(
    rawEmail: string,
    rawCode: string,
    deps: Pick<MailAlertCodeDeps, 'emailTokens' | 'rateLimit' | 'ipHash'>
): Promise<ConfirmMailAlertCodeOutcome> {
    const email = normalizeEmail(rawEmail);
    if (validateEmail(email) !== null) return { status: 'invalid_email' };

    const hash = emailHash(email);
    const withinIp = await deps.rateLimit({
        key: `mail-alert:verify:ip:${deps.ipHash}`,
        ...MAIL_ALERT_RATE_LIMITS.confirmPerIp,
    });
    if (!withinIp) return { status: 'rate_limited' };
    const withinAttempts = await deps.rateLimit({
        key: attemptsKey(hash),
        ...MAIL_ALERT_RATE_LIMITS.wrongCodePerEmail,
    });
    if (!withinAttempts) {
        await deps.emailTokens.delete('mail_alert', hash);
        return { status: 'too_many' };
    }

    const stored = await deps.emailTokens.get('mail_alert', hash);
    if (stored?.status !== 'pending') return { status: 'expired' };
    if (
        !safeCompareTokenHashes(
            hashEmailToken(rawCode.trim()),
            stored.tokenHash
        )
    ) {
        return { status: 'wrong_code' };
    }
    const consumed = await deps.emailTokens.consume('mail_alert', hash);
    return consumed?.status === 'pending' &&
        safeCompareTokenHashes(consumed.tokenHash, stored.tokenHash)
        ? { status: 'verified', email }
        : { status: 'expired' };
}
