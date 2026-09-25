import { constants } from 'node:http2';
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import {
    AUTH_SESSION_COOKIE_NAME,
    applyAuthCookie,
    createExpiredAuthHintCookie,
    isSecureCookieEnv,
    logoutUser,
} from '@/entities/auth';
import { DrizzleSessionRepository } from '@/entities/auth/api';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    aiSignedOutUrl,
    consumeLogoutCode,
} from '@/entities/auth/lib/handoffStore';
import { isAiHost } from '@/shared/config/aiHost';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_FOUND } = constants;

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
        return NextResponse.json(
            { error: 'invalid_request' },
            {
                status: HTTP_STATUS_BAD_REQUEST,
                headers: { 'Cache-Control': 'no-store' },
            }
        );
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
    const response = NextResponse.redirect(
        aiSignedOutUrl(payload?.locale ?? DEFAULT_LOCALE),
        HTTP_STATUS_FOUND
    );
    response.headers.set('Cache-Control', 'no-store');
    if (payload === null) return response;

    const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
    const user = await getCurrentUser();
    if (!sessionToken || user?.id !== payload.userId) return response;

    const secure = isSecureCookieEnv();
    const result = await logoutUser(
        { sessionToken },
        {
            sessions: new DrizzleSessionRepository(getAuthDatabaseClient().db),
        },
        { secureCookie: secure }
    );
    response.cookies.set(applyAuthCookie(result.cookie));
    response.cookies.set(createExpiredAuthHintCookie({ secure }));
    return response;
}
