import 'server-only';
import { cookies } from 'next/headers';
import { GUEST_ID_COOKIE_NAME } from '@/shared/config/cookieNames';
import {
    guestIdCookieOptions,
    signGuestId,
    verifyGuestCookie,
} from '@/shared/config/guestCookie';

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
 *
 * Used by the symbol-page chatbot (siglens.io), which — unlike the SiglensAI
 * agent — has no page-view gate minting the cookie ahead of the API call.
 *
 * An unsigned/legacy value (from a cookie minted before signing landed) or a
 * forged one fails `verifyGuestCookie` the same as a missing cookie and is
 * simply replaced with a freshly signed one on this call.
 */
export async function getOrCreateGuestId(): Promise<string> {
    const store = await cookies();
    const existing = await verifyGuestCookie(
        store.get(GUEST_ID_COOKIE_NAME)?.value
    );
    if (existing !== null) return existing;

    const id = crypto.randomUUID();
    store.set({
        name: GUEST_ID_COOKIE_NAME,
        value: await signGuestId(id),
        ...guestIdCookieOptions(),
    });
    return id;
}

/**
 * Reads the `siglens_guest` cookie without minting one. Used by routes that
 * must NOT be able to issue a guest id on their own (SiglensAI's chat stream
 * route — see `proxy.ts`'s `handleAiHost`, which mints the cookie on page
 * view instead) so that only a real browser page load can create a guest
 * identity. Returns `null` for an unsigned/legacy or forged value, same as a
 * missing cookie.
 */
export async function readGuestId(): Promise<string | null> {
    const store = await cookies();
    return verifyGuestCookie(store.get(GUEST_ID_COOKIE_NAME)?.value);
}
