import 'server-only';
import { cookies } from 'next/headers';
import { GUEST_ID_COOKIE_NAME } from '@/shared/config/cookieNames';
import { verifyGuestCookie } from '@/shared/config/guestCookie';

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
