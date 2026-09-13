import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { GUEST_ID_COOKIE_NAME } from '@/shared/config/cookieNames';

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Duplicated from `entities/auth/lib/sessionCookieOptions.ts`'s
 * `isSecureCookieEnv` — `shared` cannot import `entities` (FSD dependency
 * direction), and the check is one line, so it is not worth an exception.
 */
function isSecureCookieEnv(): boolean {
    return process.env.NODE_ENV === 'production';
}

/**
 * First-party anonymous visitor id, read from (or minted into) the
 * `siglens_guest` cookie. Used as the guest quota/rate-limit key for the
 * SIGLENS AI agent and the symbol-page chatbot instead of the client IP —
 * an IP can be shared by many visitors (NAT/CGNAT) or many visitors' worth
 * of turns can hide behind one browser's cookie, so both the agent route
 * and the chatbot action additionally run a looser per-IP backstop.
 *
 * Server Route Handlers / Server Actions only: it calls `cookies().set()`,
 * which throws outside a request that can still write response cookies (a
 * Server Component's `cookies()` is read-only).
 *
 * Cookies are per-host, so siglens.io and ai.siglens.io each mint and track
 * their own guest id — and therefore their own quota. That is intentional,
 * not a gap.
 */
export async function getOrCreateGuestId(): Promise<string> {
    const store = await cookies();
    const existing = store.get(GUEST_ID_COOKIE_NAME)?.value;
    if (existing && UUID_RE.test(existing)) return existing;

    const id = randomUUID();
    store.set({
        name: GUEST_ID_COOKIE_NAME,
        value: id,
        httpOnly: true,
        secure: isSecureCookieEnv(),
        sameSite: 'lax',
        path: '/',
        maxAge: ONE_YEAR_SECONDS,
    });
    return id;
}
