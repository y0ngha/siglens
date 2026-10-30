import { NextResponse } from 'next/server';
import { DrizzleSessionRepository } from '@/entities/auth/api';
import { applyAuthCookie } from '@/entities/auth/lib/applyAuthCookie';
import { createAuthHintCookie } from '@/entities/auth/lib/authHintCookie';
import {
    createAuthSession,
    DEFAULT_SESSION_TTL_SECONDS,
} from '@/entities/auth/lib/sessionCookie';
import { isSecureCookieEnv } from '@/entities/auth/lib/sessionCookieOptions';
import { getOAuthRedirectBaseUrl } from '@/features/auth-oauth/lib/providers';
import { expiredOAuthStateCookie } from '@/features/auth-oauth/lib/state';
import { getDatabaseClient } from '@/shared/db/client';
import { sanitizeNextPath, toSameOriginPath } from '@/shared/lib/auth/redirect';

/**
 * 기존 OAuth 계정 사용자의 세션을 만들고 `next`로 보낸다. 세션·로그인 힌트 쿠키를 심고 state
 * 쿠키를 지운다.
 *
 * 세 서버 액션이 쓰는 것과 **같은** 2차 방어(`toSameOriginPath`)를 여기에도 건다 — 문자열
 * 검사를 통과한 `"/\t/evil.com"`이 파싱 결과 `https://evil.com/`으로 나가면 세션 쿠키를 심은
 * 직후라 피싱 등급의 오픈 리디렉트가 된다.
 */
export async function redirectSignedIn(
    userId: string,
    next: string
): Promise<NextResponse> {
    const secure = isSecureCookieEnv();
    const { cookie } = await createAuthSession({
        userId,
        sessions: new DrizzleSessionRepository(getDatabaseClient().db),
        now: new Date(),
        secureCookie: secure,
    });
    // `next`는 로그인 화면이 로케일 접두사를 붙여 state에 실은 경로라 로케일을 다시 붙이지 않는다.
    const response = NextResponse.redirect(
        new URL(
            toSameOriginPath(sanitizeNextPath(next)),
            getOAuthRedirectBaseUrl()
        )
    );
    response.cookies.set(applyAuthCookie(cookie));
    response.cookies.set(
        createAuthHintCookie({
            maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
            secure,
        })
    );
    response.cookies.set(expiredOAuthStateCookie());
    return response;
}
