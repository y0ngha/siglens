import 'server-only';
import type { NextRequest } from 'next/server';
import {
    handoffStartUrl,
    resolveHandoffNext,
} from '@/entities/auth/lib/handoffRedirect';
import { clearMainSessionHint } from '@/entities/auth/lib/mainSessionHintCookie';
import { isSecureCookieEnv } from '@/entities/auth/lib/sessionCookieOptions';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import {
    isHandoffToken,
    issueHandoffCode,
} from '@/entities/auth/server/handoffStore';
import { AI_SITE_URL, isAiHost } from '@/shared/config/aiHost';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { localePath } from '@/shared/i18n/locales';
import { invalidHandoffRequest, noStoreRedirect } from './_shared/responses';

export const dynamic = 'force-dynamic';

/**
 * MAIN host only: issue a one-time code for the signed-in user.
 *
 * Not an open redirect: `to` is an enum (only `ai`), the target origin is always
 * the `AI_SITE_URL` constant, and `next` is reduced to a path before it is used.
 *
 * A request without a valid `state` (e.g. the ai login CTA returning here from
 * `/login?next=/api/auth/handoff?to=ai&next=…`) is bounced to the ai-host start
 * route, which sets the browser-binding cookie and comes straight back with a
 * state — see `handoff/start/route.ts` for the login-CSRF rationale. Start
 * always supplies a valid state, so this cannot loop.
 *
 * The only side effect besides issuing a code is clearing the non-secret,
 * non-auth presence hint on the no-user branch: idempotent, and a cross-site
 * trigger can at worst cost one missed automatic sign-in. The route is a
 * browser-navigation hop by design (`noStoreRedirect`, no-store).
 */
// react-doctor-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler
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
    if (!user) {
        // 흔적은 있었는데 세션은 없다(만료·다른 기기에서 로그아웃). 흔적을 지워 이 왕복이
        // 한 번으로 끝나게 한다 — 이어지는 `?sso=none`이 probed 쿠키를 심으니 루프도 없다.
        const response = noStoreRedirect(fallback);
        clearMainSessionHint(response.cookies, {
            secure: isSecureCookieEnv(),
        });
        return response;
    }

    let code: string;
    try {
        code = await issueHandoffCode({ userId: user.id, next, state });
    } catch (error) {
        console.error(
            '[handoff] redis unavailable',
            redactDbErrorForLog(error)
        );
        return noStoreRedirect(fallback);
    }
    const consume = new URL(
        localePath(locale, '/api/auth/handoff/consume'),
        AI_SITE_URL
    );
    consume.searchParams.set('code', code);
    return noStoreRedirect(consume);
}
