import 'server-only';
import { cookies } from 'next/headers';
import {
    signReportValue,
    verifyReportValue,
} from '@/entities/email-report/lib/reportSignature';
import { MS_PER_SECOND } from '@/shared/config/time';
import { MAIL_ALERT_COOKIE_MAX_AGE_SECONDS } from '../lib/mailAlertConstants';
import {
    decodeMailAlertCookie,
    encodeMailAlertCookie,
    MAIL_ALERT_COOKIE_NAME,
    mailAlertCookieSigningValue,
} from '../lib/mailAlertCookie';
import type { MailAlertGuestCookie } from './mailAlertFlows';

/** 시계가 약간 어긋난 기기를 받아 주는 여유(초). 이보다 미래에 발급된 값은 위조로 본다. */
const CLOCK_SKEW_SECONDS = 60;

/**
 * 같은 브라우저가 코드를 다시 받지 않고 항목을 더하고 뺄 수 있게 하는 서명된 쿠키. 값은 구독자 id, 발급
 * 시각, 그리고 둘에 대한 HMAC(`alert-session`)뿐이다. 서명이 맞아도 그 행을 읽고 쓰는 권한은 저장소가
 * 비회원 소유자 조건(`user_id IS NULL`)으로 따로 지킨다 — 쿠키는 "이 브라우저가 코드를 확인한 적 있다"는
 * 증거일 뿐이다. 브라우저가 `Max-Age`를 어기고 값을 돌려보내도 서버가 발급 시각으로 만료를 강제한다
 * (`MAIL_ALERT_COOKIE_MAX_AGE_SECONDS`, 방침 §7의 최대 180일).
 *
 * HttpOnly·SameSite=Lax이고 운영에서는 Secure다. 구독자 행이 사라지면(수신 거부·회원 연결) 액션이 다음에
 * 쿠키를 지운다.
 */
export function createMailAlertGuestCookie(
    secret: string,
    now: () => number = Date.now
): MailAlertGuestCookie {
    const nowSeconds = () => Math.floor(now() / MS_PER_SECOND);
    return {
        async read() {
            const cookieStore = await cookies();
            const decoded = decodeMailAlertCookie(
                cookieStore.get(MAIL_ALERT_COOKIE_NAME)?.value
            );
            if (decoded === null) return null;
            const age = nowSeconds() - decoded.issuedAtSeconds;
            if (age > MAIL_ALERT_COOKIE_MAX_AGE_SECONDS) return null;
            if (age < -CLOCK_SKEW_SECONDS) return null;
            return verifyReportValue(
                secret,
                'alert-session',
                mailAlertCookieSigningValue(
                    decoded.subscriberId,
                    decoded.issuedAtSeconds
                ),
                decoded.signature
            )
                ? decoded.subscriberId
                : null;
        },
        async write(subscriberId) {
            const cookieStore = await cookies();
            const issuedAt = nowSeconds();
            cookieStore.set(
                MAIL_ALERT_COOKIE_NAME,
                encodeMailAlertCookie(
                    subscriberId,
                    issuedAt,
                    signReportValue(
                        secret,
                        'alert-session',
                        mailAlertCookieSigningValue(subscriberId, issuedAt)
                    )
                ),
                {
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production',
                    path: '/',
                    maxAge: MAIL_ALERT_COOKIE_MAX_AGE_SECONDS,
                }
            );
        },
        async clear() {
            const cookieStore = await cookies();
            cookieStore.set(MAIL_ALERT_COOKIE_NAME, '', {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                maxAge: 0,
            });
        },
    };
}
