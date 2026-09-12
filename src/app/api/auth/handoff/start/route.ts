import { constants } from 'node:http2';
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import {
    generateHandoffToken,
    handoffStateCookie,
    resolveHandoffNext,
} from '@/entities/auth/lib/handoffStore';
import { isAiHost } from '@/shared/config/aiHost';
import { localePath } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_FOUND } = constants;

export const dynamic = 'force-dynamic';

/**
 * AI host only: first hop of the SSO handoff (spec §9-4).
 *
 * Why this route exists — login CSRF. Without a browser binding, an attacker can
 * mint a code for *their own* account (it is valid for 60s) and make a victim's
 * browser open `ai.siglens.io/api/auth/handoff/consume?code=…` (a link, or a
 * top-level redirect from any page). The victim would then be silently signed in
 * to the attacker's account, and every message they type — the chat is saved
 * server-side — would be readable by the attacker. A code alone cannot tell
 * "the browser that asked" from "a browser that was handed the URL".
 *
 * So the ai host sets a random host-only state cookie here (`__Host-` prefixed in
 * production against cookie tossing — see `handoffStateCookieName`) and
 * passes the same value as `state` to the main-host issue route, which stores it
 * with the code; consume only succeeds when the cookie on the ai host equals the
 * stored state. The attacker cannot set that cookie in the victim's browser
 * (httpOnly, host-only on ai.siglens.io), so a planted code fails.
 *
 * It is a route handler rather than logic inside `maybeHandoffRedirect` because
 * a Server Component render cannot set cookies.
 */
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
    const { locale, next } = resolveHandoffNext(
        request.nextUrl.searchParams.get('next')
    );
    const state = generateHandoffToken();
    const target = new URL(localePath(locale, '/api/auth/handoff'), SITE_URL);
    target.searchParams.set('to', 'ai');
    target.searchParams.set('next', next);
    target.searchParams.set('state', state);
    const response = NextResponse.redirect(target, HTTP_STATUS_FOUND);
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set(handoffStateCookie(state));
    return response;
}
