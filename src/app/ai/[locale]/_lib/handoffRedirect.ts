import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isBot } from '@/shared/api/isBot';
import {
    AI_SSO_PROBED_COOKIE_NAME,
    AUTH_SESSION_COOKIE_NAME,
} from '@/shared/config/cookieNames';
import { localePath, resolveLocale } from '@/shared/i18n/locales';
import { buildHandoffNext } from './handoffTarget';

/**
 * ai 호스트 세션도 `?sso=none`(또는 프록시가 그에 맞춰 심는 probed 쿠키)도 없으면 SSO
 * 핸드오프로 한 번 튕긴다. 목적지는 ai 호스트의 `/api/auth/handoff/start`(상대 경로라
 * 어느 환경에서도 ai 호스트에 머문다) — 브라우저 바인딩 state 쿠키를 먼저 심어야 하는데
 * Server Component 렌더는 쿠키를 설정할 수 없기 때문이다(`api/auth/handoff/start/route.ts`).
 *
 * **ai 페이지 `/`와 `/c/[id]`는 다른 데이터 접근·렌더보다 먼저 이것을 불러야 한다** —
 * 메인 사이트에 로그인한 사용자가 익명 랜딩이나 자기 대화의 404를 보지 않게 하려는 것이다.
 *
 * `page.tsx`는 기본 컴포넌트와 Next 설정만 export할 수 있어 별도 모듈이다.
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
    // 크롤러는 어느 호스트에도 세션이 없다 — 두 호스트를 튕기면 색인해야 할 랜딩 대신
    // meta-refresh 페이지만 받는다.
    if (isBot(await headers())) return;
    const resolved = resolveLocale(locale);
    const next = buildHandoffNext(resolved, path, searchParams);
    // `localePath`는 `/api`를 건드리지 않는다. 서버 redirect가 모두 로케일을 따르도록
    // (noRawRedirect 가드) 이 경로도 거치게 하고, 로케일은 `next`에 실려 다닌다.
    redirect(
        `${localePath(resolved, '/api/auth/handoff/start')}?next=${encodeURIComponent(next)}`
    );
}
