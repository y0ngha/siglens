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
    consumeHandoffCode,
    handoffStateCookie,
    handoffStateCookieName,
    resolveHandoffNext,
    type HandoffPayload,
} from '@/entities/auth/lib/handoffStore';
import { AI_SITE_URL, isAiHost } from '@/shared/config/aiHost';
import { DEFAULT_LOCALE, localePath, type Locale } from '@/shared/i18n/locales';

export const dynamic = 'force-dynamic';

/** Landing with `?sso=none` in the given locale (e.g. `/en?sso=none`). */
function ssoNoneUrl(locale: Locale): URL {
    const url = new URL(localePath(locale, '/'), AI_SITE_URL);
    url.searchParams.set('sso', 'none');
    return url;
}

function noStoreRedirect(url: URL): NextResponse {
    const response = NextResponse.redirect(url, 302);
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
export async function GET(request: NextRequest): Promise<Response> {
    if (!isAiHost(request.headers.get('host'))) {
        return NextResponse.json(
            { error: 'invalid_request' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } }
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
    if (payload === null) return noStoreRedirect(ssoNoneUrl(DEFAULT_LOCALE));
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
        return noStoreRedirect(ssoNoneUrl(locale));
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
