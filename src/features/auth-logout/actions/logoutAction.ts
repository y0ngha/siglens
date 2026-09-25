'use server';

import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { localeHref } from '@/shared/i18n/localeRedirect';
import { cookies, headers } from 'next/headers';
import {
    AUTH_SESSION_COOKIE_NAME,
    applyAuthCookie,
    isSecureCookieEnv,
    createExpiredAuthHintCookie,
    logoutUser,
} from '@/entities/auth';
import { DrizzleSessionRepository } from '@/entities/auth/api';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    aiSignedOutUrl,
    issueLogoutCode,
} from '@/entities/auth/lib/handoffStore';
import { isAiHost } from '@/shared/config/aiHost';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';

async function requestLocale(): Promise<Locale> {
    const raw = await getLocale();
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
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

export async function logoutAction(): Promise<void> {
    const onAiHost = isAiHost((await headers()).get('host'));
    try {
        const secure = isSecureCookieEnv();
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
        // 세션을 지우기 전에 읽는다 — 지운 뒤에는 누구의 로그아웃인지 알 수 없다.
        const aiUser = onAiHost && sessionToken ? await getCurrentUser() : null;
        if (sessionToken) {
            const { db } = getAuthDatabaseClient();
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
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT'))
            throw err;
        console.error('[logoutAction] unexpected error:', err);
        redirect(
            onAiHost
                ? aiSignedOutUrl(await requestLocale()).href
                : await localeHref('/')
        );
    }
}
