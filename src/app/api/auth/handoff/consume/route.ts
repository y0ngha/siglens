import { constants } from 'node:http2';
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import {
    applyAuthCookie,
    createAuthHintCookie,
    createAuthSession,
    DEFAULT_SESSION_TTL_SECONDS,
    isSecureCookieEnv,
} from '@/entities/auth';
import { DrizzleSessionRepository } from '@/entities/auth/api';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import {
    aiSignedOutUrl,
    consumeHandoffCode,
    handoffStateCookie,
    handoffStateCookieName,
    resolveHandoffNext,
    type HandoffPayload,
} from '@/entities/auth/lib/handoffStore';
import { AI_SITE_URL, isAiHost } from '@/shared/config/aiHost';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_FOUND } = constants;

export const dynamic = 'force-dynamic';

function noStoreRedirect(url: URL): NextResponse {
    const response = NextResponse.redirect(url, HTTP_STATUS_FOUND);
    response.headers.set('Cache-Control', 'no-store');
    // The state is single use: clear it whether or not the exchange succeeded.
    response.cookies.set(handoffStateCookie(''));
    return response;
}

/**
 * AI host only: exchange a one-time code for an ai-host session (spec §9-4).
 *
 * The session cookie is host-only (the cookie descriptor has no `domain`), so the
 * main-host session is never widened to subdomains. `secure` follows the same
 * `isSecureCookieEnv()` convention as every other login path. Any failure —
 * missing/reused/expired/forged code, or a state cookie that does not match the
 * one bound at issue (login CSRF, see `handoff/start/route.ts`), or a session
 * that cannot be created (e.g. the user was deleted after the code was issued) —
 * lands on the ai landing with `?sso=none`. Without a payload the locale is
 * unknown, so that lands on the default-locale root; a session failure keeps the
 * locale of the stored `next`.
 */
// 브라우저가 리다이렉트로 도착하는 SSO 복귀 지점이라 GET이어야 한다. CSRF는 메서드가
// 아니라 1회용 코드(getdel)와 발급 시 바인딩한 state 쿠키 대조로 막는다 — 코드가 없거나
// 재사용·위조면 세션을 만들지 않고 `?sso=none`으로 떨군다.
// react-doctor-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler
export async function GET(request: NextRequest): Promise<Response> {
    if (!isAiHost(request.headers.get('host'))) {
        return NextResponse.json(
            { error: 'invalid_request' },
            {
                status: HTTP_STATUS_BAD_REQUEST,
                headers: { 'Cache-Control': 'no-store' },
            }
        );
    }
    let payload: HandoffPayload | null;
    try {
        payload = await consumeHandoffCode(
            request.nextUrl.searchParams.get('code'),
            request.cookies.get(handoffStateCookieName())?.value
        );
    } catch (error) {
        console.error('[handoff] redis unavailable', error);
        payload = null;
    }
    // `aiSignedOutUrl` builds its path with `localePath`, and `next` comes back
    // localized from `resolveHandoffNext` — noRawRedirect guard.
    if (payload === null)
        return noStoreRedirect(aiSignedOutUrl(DEFAULT_LOCALE));
    const { locale, next } = resolveHandoffNext(payload.next);

    const secure = isSecureCookieEnv();
    let cookie: Awaited<ReturnType<typeof createAuthSession>>['cookie'];
    try {
        ({ cookie } = await createAuthSession({
            userId: payload.userId,
            sessions: new DrizzleSessionRepository(getAuthDatabaseClient().db),
            now: new Date(),
            secureCookie: secure,
        }));
    } catch {
        // The error itself is not logged: a DB error message can echo query
        // parameters. userId is enough to find the row.
        console.error('[handoff] session create failed', {
            userId: payload.userId,
        });
        return noStoreRedirect(aiSignedOutUrl(locale));
    }
    const response = noStoreRedirect(new URL(next, AI_SITE_URL));
    response.cookies.set(applyAuthCookie(cookie));
    response.cookies.set(
        createAuthHintCookie({
            maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
            secure,
        })
    );
    return response;
}
