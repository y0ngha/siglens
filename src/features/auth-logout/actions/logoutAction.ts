'use server';

/**
 * 로그아웃 Server Action. 세션을 지우고 쿠키를 만료시킨 뒤 호스트에 맞는 곳으로
 * 리다이렉트한다.
 */

import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { localeHref } from '@/shared/i18n/localeRedirect';
import { cookies, headers } from 'next/headers';
import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import { createExpiredSessionCookie } from '@/entities/auth/lib/sessionCookie';
import { applyAuthCookie } from '@/entities/auth/lib/applyAuthCookie';
import { isSecureCookieEnv } from '@/entities/auth/lib/sessionCookieOptions';
import { createExpiredAuthHintCookie } from '@/entities/auth/lib/authHintCookie';
import { logoutUser } from '@/entities/auth/lib/logoutUser';
import { DrizzleSessionRepository } from '@/entities/auth/api';
import { getDatabaseClient } from '@/shared/db/client';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    aiSignedOutUrl,
    issueLogoutCode,
} from '@/entities/auth/lib/handoffStore';
import { isAiHost } from '@/shared/config/aiHost';
import { type Locale, resolveLocale } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import { isNextRedirectError } from '@/shared/lib/isNextRedirectError';

/** 요청 로케일. */
async function requestLocale(): Promise<Locale> {
    const raw = await getLocale();
    return resolveLocale(raw);
}

/**
 * ai 호스트 로그아웃의 목적지. 메인 세션까지 끝내도록 메인
 * `/api/auth/handoff/logout`으로 보낸다(이유는 `issueLogoutCode` JSDoc).
 * 코드를 못 만들면(ai 세션이 이미 없었거나 Redis 장애) ai 랜딩 `?sso=none`으로
 * 떨어진다 — 최소한 이 탭에서 자동 재로그인은 막는다.
 *
 * 둘 다 다른 호스트이거나 절대 URL이라 Next.js가 외부 리다이렉트로 보고 하드
 * 내비게이션한다(`toHandoffAwareRedirect` JSDoc 참고).
 */
async function aiLogoutTarget(userId: string | null): Promise<string> {
    const locale = await requestLocale();
    if (userId !== null) {
        try {
            const code = await issueLogoutCode({ userId, locale });
            const url = new URL('/api/auth/handoff/logout', SITE_URL);
            url.searchParams.set('code', code);
            return url.href;
        } catch (error) {
            console.error('[logoutAction] logout code not issued', error);
        }
    }
    return aiSignedOutUrl(locale).href;
}

/**
 * 오류가 난 로그아웃에서도 이 브라우저의 세션 쿠키·힌트 쿠키는 만료시킨다. DB 세션
 * 삭제가 실패했다고 쿠키를 남기면 사용자는 로그아웃했다고 믿지만 다음 요청에서 그대로
 * 로그인돼 있다(공용 PC에서 다음 사람이 그 계정을 쓴다). 쿠키를 지우는 것까지 실패하면
 * 리다이렉트를 막지 않도록 기록만 한다.
 */
async function expireAuthCookiesAfterError(): Promise<void> {
    try {
        const secure = isSecureCookieEnv();
        const cookieStore = await cookies();
        cookieStore.set(
            applyAuthCookie(createExpiredSessionCookie({ secure }))
        );
        cookieStore.set(createExpiredAuthHintCookie({ secure }));
    } catch (error) {
        console.error('[logoutAction] auth cookies not expired', error);
    }
}

/**
 * 로그아웃. 메인 호스트는 로케일 홈으로, ai 호스트는 메인 세션까지 끝내는 핸드오프
 * 로그아웃(`aiLogoutTarget`)으로 보낸다. 성공·실패 모두 리다이렉트로 끝나며 값을
 * 돌려주지 않는다.
 */
export async function logoutAction(): Promise<void> {
    const onAiHost = isAiHost((await headers()).get('host'));
    try {
        const secure = isSecureCookieEnv();
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
        // 세션을 지우기 전에 읽는다 — 지운 뒤에는 누구의 로그아웃인지 알 수 없다.
        const aiUser = onAiHost && sessionToken ? await getCurrentUser() : null;
        if (sessionToken) {
            const { db } = getDatabaseClient();
            const result = await logoutUser(
                { sessionToken },
                { sessions: new DrizzleSessionRepository(db) },
                { secureCookie: secure }
            );
            cookieStore.set(applyAuthCookie(result.cookie));
            cookieStore.set(createExpiredAuthHintCookie({ secure }));
        }
        redirect(
            onAiHost
                ? await aiLogoutTarget(aiUser?.id ?? null)
                : await localeHref('/')
        );
    } catch (err) {
        if (isNextRedirectError(err)) throw err;
        console.error('[logoutAction] unexpected error:', err);
        await expireAuthCookiesAfterError();
        redirect(
            onAiHost
                ? aiSignedOutUrl(await requestLocale()).href
                : await localeHref('/')
        );
    }
}
