import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isBot } from '@/shared/api/isBot';
import {
    AI_SSO_PROBED_COOKIE_NAME,
    AUTH_SESSION_COOKIE_NAME,
} from '@/shared/config/cookieNames';
import { localePath, resolveLocale } from '@/shared/i18n/locales';

/**
 * 핸드오프 왕복에서 살려 보낼 쿼리. `q`는 siglens.io의 질문 진입 링크, 나머지는
 * 광고 클릭 식별자와 캠페인 태그다 — 버리면 광고에서 온 방문의 전환이 광고와
 * 연결되지 않는다. 목록 밖 파라미터는 버린다.
 */
const CARRIED_PARAMS = [
    'q',
    'gclid',
    'gbraid',
    'wbraid',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
] as const;

/**
 * No ai-host session and no `?sso=none` (nor the probed cookie the proxy sets
 * for it) → bounce through the SSO handoff once
 * (spec §9-4). The bounce goes to the ai-host `/api/auth/handoff/start` route
 * (relative, so it stays on the ai host in every environment) because the
 * browser-binding state cookie must be set first and a Server Component render
 * cannot set cookies — see `api/auth/handoff/start/route.ts`.
 *
 * **Both ai pages — `/` (`app/ai/[locale]/page.tsx`) and `/c/[id]`
 * (`app/ai/[locale]/c/[id]/page.tsx`) — must call this first**, before any other
 * data access or render, so a signed-in main-site user never sees the anonymous
 * landing or a 404 for their own conversation.
 *
 * Lives outside `page.tsx` because page files may only export the default
 * component (and Next config).
 */
export async function maybeHandoffRedirect(
    locale: string,
    path: string,
    searchParams: Record<string, string | string[] | undefined>
): Promise<void> {
    const cookieStore = await cookies();
    const hasSession = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
    // `?sso=none` 쿠키 판(`proxy.ts`가 심는다)도 같은 뜻이다 — 파라미터는 주소창
    // 정리나 내부 링크 이동으로 사라지지만 프로브가 이미 끝났다는 사실은 남아야 한다.
    const alreadyProbed =
        searchParams.sso === 'none' ||
        cookieStore.get(AI_SSO_PROBED_COOKIE_NAME)?.value !== undefined;
    if (hasSession || alreadyProbed) return;
    // Crawlers have no session anywhere; bouncing them through two hosts only
    // hands them a meta-refresh page instead of the landing they should index.
    if (isBot(await headers())) return;
    const resolved = resolveLocale(locale);
    // `?q=` must survive the round trip (otherwise a signed-in user lands on an
    // empty composer), and so must ad click ids (otherwise the visit loses its ad).
    const query = CARRIED_PARAMS.flatMap(key => {
        const value = searchParams[key];
        return typeof value === 'string' && value
            ? [`${key}=${encodeURIComponent(value)}`]
            : [];
    }).join('&');
    const next = `${localePath(resolved, path)}${query ? `?${query}` : ''}`;
    // `localePath` leaves `/api` untouched; routing through it keeps every server
    // redirect locale-aware (noRawRedirect guard). The locale travels in `next`.
    redirect(
        `${localePath(resolved, '/api/auth/handoff/start')}?next=${encodeURIComponent(next)}`
    );
}
