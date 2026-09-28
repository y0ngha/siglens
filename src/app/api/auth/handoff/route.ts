import 'server-only';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    handoffStartUrl,
    isHandoffToken,
    issueHandoffCode,
    resolveHandoffNext,
} from '@/entities/auth/lib/handoffStore';
import { AI_SITE_URL, isAiHost } from '@/shared/config/aiHost';
import { localePath } from '@/shared/i18n/locales';
import { invalidHandoffRequest, noStoreRedirect } from './_shared/responses';

export const dynamic = 'force-dynamic';

/**
 * MAIN host only: issue a one-time code for the signed-in user (spec §8, §9-4).
 *
 * Not an open redirect: `to` is an enum (only `ai`), the target origin is always
 * the `AI_SITE_URL` constant, and `next` is reduced to a path before it is used.
 *
 * A request without a valid `state` (e.g. the ai login CTA returning here from
 * `/login?next=/api/auth/handoff?to=ai&next=…`) is bounced to the ai-host start
 * route, which sets the browser-binding cookie and comes straight back with a
 * state — see `handoff/start/route.ts` for the login-CSRF rationale. Start
 * always supplies a valid state, so this cannot loop.
 */
export async function GET(request: NextRequest): Promise<Response> {
    const params = request.nextUrl.searchParams;
    if (isAiHost(request.headers.get('host')) || params.get('to') !== 'ai') {
        return invalidHandoffRequest();
    }
    // Every same-site target goes through `localePath` with the locale carried in
    // `next` (`/api` paths come back unchanged) — noRawRedirect guard.
    const { locale, next } = resolveHandoffNext(params.get('next'));
    const state = params.get('state');
    if (!isHandoffToken(state)) {
        return noStoreRedirect(handoffStartUrl(next));
    }

    const fallback = new URL(next, AI_SITE_URL);
    fallback.searchParams.set('sso', 'none');
    const user = await getCurrentUser();
    if (!user) return noStoreRedirect(fallback);

    let code: string;
    try {
        code = await issueHandoffCode({ userId: user.id, next, state });
    } catch (error) {
        console.error('[handoff] redis unavailable', error);
        return noStoreRedirect(fallback);
    }
    const consume = new URL(
        localePath(locale, '/api/auth/handoff/consume'),
        AI_SITE_URL
    );
    consume.searchParams.set('code', code);
    return noStoreRedirect(consume);
}
