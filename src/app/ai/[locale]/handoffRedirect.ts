import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isBot } from '@/shared/api/isBot';
import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import { isLocale, localePath, DEFAULT_LOCALE } from '@/shared/i18n/locales';

/**
 * No ai-host session and no `?sso=none` → bounce through the SSO handoff once
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
    const hasSession = (await cookies()).get(AUTH_SESSION_COOKIE_NAME)?.value;
    if (hasSession || searchParams.sso === 'none') return;
    // Crawlers have no session anywhere; bouncing them through two hosts only
    // hands them a meta-refresh page instead of the landing they should index.
    if (isBot(await headers())) return;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    // A prefilled question (`?q=`, the entry links from siglens.io) must survive
    // the round trip, otherwise a signed-in user lands on an empty composer.
    const q = typeof searchParams.q === 'string' ? searchParams.q : '';
    const next = `${localePath(resolved, path)}${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    // `localePath` leaves `/api` untouched; routing through it keeps every server
    // redirect locale-aware (noRawRedirect guard). The locale travels in `next`.
    redirect(
        `${localePath(resolved, '/api/auth/handoff/start')}?next=${encodeURIComponent(next)}`
    );
}
