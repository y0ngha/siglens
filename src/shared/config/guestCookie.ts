/**
 * First-party anonymous visitor id cookie (`siglens_guest`) config shared by
 * `shared/api/guestId.ts` (server-only cookie read/write) and `proxy.ts`
 * (edge runtime — cannot import `server-only`/`next/headers`). Kept dependency-free
 * so both can import it without pulling in a runtime the other can't use.
 */
export const GUEST_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidGuestId(value: string | undefined): value is string {
    return value !== undefined && UUID_RE.test(value);
}

interface GuestIdCookieOptions {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax';
    path: '/';
    maxAge: number;
}

export function guestIdCookieOptions(): GuestIdCookieOptions {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: GUEST_ID_MAX_AGE_SECONDS,
    };
}
