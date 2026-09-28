import 'server-only';
import type { NextRequest } from 'next/server';
import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import { applyAuthCookie } from '@/entities/auth/lib/applyAuthCookie';
import { createExpiredAuthHintCookie } from '@/entities/auth/lib/authHintCookie';
import { isSecureCookieEnv } from '@/entities/auth/lib/sessionCookieOptions';
import { logoutUser } from '@/entities/auth/lib/logoutUser';
import { DrizzleSessionRepository } from '@/entities/auth/api';
import { getDatabaseClient } from '@/shared/db/client';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    aiSignedOutUrl,
    consumeLogoutCode,
} from '@/entities/auth/lib/handoffStore';
import { isAiHost } from '@/shared/config/aiHost';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { invalidHandoffRequest, noStoreRedirect } from '../_shared/responses';

export const dynamic = 'force-dynamic';

/**
 * MAIN host only: second hop of an ai-host logout — ends the main-host session
 * too, then sends the browser back to the ai landing with `?sso=none`.
 *
 * The main session is deleted only when the code's user is the one signed in
 * here (see `issueLogoutCode` for the logout-CSRF rationale); any other case —
 * missing/reused/expired code, a different or no main user, Redis down — still
 * lands on the ai landing without touching the main session. Not an open
 * redirect: the target origin is always the `AI_SITE_URL` constant.
 */
// 브라우저가 ai 로그아웃 액션의 리다이렉트로 도착하는 지점이라 GET이어야 한다.
// CSRF는 메서드가 아니라 1회용 코드와 userId 대조로 막는다.
// react-doctor-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler
export async function GET(request: NextRequest): Promise<Response> {
    if (isAiHost(request.headers.get('host'))) {
        return invalidHandoffRequest();
    }
    let payload: Awaited<ReturnType<typeof consumeLogoutCode>>;
    try {
        payload = await consumeLogoutCode(
            request.nextUrl.searchParams.get('code')
        );
    } catch (error) {
        console.error('[handoff] redis unavailable', error);
        payload = null;
    }
    // `aiSignedOutUrl` builds its path with `localePath` — noRawRedirect guard.
    const response = noStoreRedirect(
        aiSignedOutUrl(payload?.locale ?? DEFAULT_LOCALE)
    );
    if (payload === null) return response;

    const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
    const user = await getCurrentUser();
    if (!sessionToken || user?.id !== payload.userId) return response;

    const secure = isSecureCookieEnv();
    const result = await logoutUser(
        { sessionToken },
        {
            sessions: new DrizzleSessionRepository(getDatabaseClient().db),
        },
        { secureCookie: secure }
    );
    response.cookies.set(applyAuthCookie(result.cookie));
    response.cookies.set(createExpiredAuthHintCookie({ secure }));
    return response;
}
