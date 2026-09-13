/**
 * First-party anonymous visitor id cookie (`siglens_guest`) config shared by
 * `shared/api/guestId.ts` (server-only cookie read/write) and `proxy.ts`
 * (edge runtime — cannot import `server-only`/`next/headers`). Kept dependency-free
 * (Web Crypto only, no `node:crypto`) so both can import it without pulling in a
 * runtime the other can't use.
 *
 * The cookie value is `<uuid>.<base64url HMAC-SHA256>`, signed with
 * `OAUTH_STATE_HMAC_SECRET` (the same secret `features/auth-oauth/lib/state.ts`
 * uses for OAuth state, under a different domain-separated purpose prefix — no
 * new SSM parameter needed). Without a valid signature a script could otherwise
 * mint its own `siglens_guest=<any uuid>` cookie and spend a guest's quota
 * without ever loading a page.
 */
export const GUEST_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIGNATURE_SEPARATOR = '.';
const MESSAGE_PREFIX = 'siglens_guest:v1:';

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

/** Thrown by {@link mintGuestCookieValue} when the signing secret is missing — fail closed. */
export class GuestCookieSecretMisconfiguredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GuestCookieSecretMisconfiguredError';
    }
}

function base64UrlEncode(bytes: ArrayBuffer): string {
    let binary = '';
    for (const byte of new Uint8Array(bytes))
        binary += String.fromCharCode(byte);
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

/** Reads `OAUTH_STATE_HMAC_SECRET` — throws if unset (caller must fail closed, not sign unsigned). */
function readHmacSecret(): string {
    const raw = process.env.OAUTH_STATE_HMAC_SECRET;
    if (!raw) {
        throw new GuestCookieSecretMisconfiguredError(
            'OAUTH_STATE_HMAC_SECRET environment variable is required to sign the guest id cookie'
        );
    }
    return raw;
}

/** Signs `uuid` into the `<uuid>.<signature>` cookie value. Throws if the secret is missing. */
export async function signGuestId(uuid: string): Promise<string> {
    const key = await importHmacKey(readHmacSecret());
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${MESSAGE_PREFIX}${uuid}`)
    );
    return `${uuid}${SIGNATURE_SEPARATOR}${base64UrlEncode(signature)}`;
}

/**
 * Verifies a `siglens_guest` cookie value and returns the uuid if the shape and
 * signature both check out, else `null` — including when the secret is missing
 * (fail closed) or the value is an unsigned/legacy `<uuid>`-only cookie from a
 * previous deploy.
 */
export async function verifyGuestCookie(
    value: string | undefined
): Promise<string | null> {
    if (value === undefined) return null;
    const separatorIndex = value.indexOf(SIGNATURE_SEPARATOR);
    if (separatorIndex === -1) return null;
    const uuid = value.slice(0, separatorIndex);
    const signature = value.slice(separatorIndex + 1);
    if (!isValidGuestId(uuid) || !signature) return null;

    let secret: string;
    try {
        secret = readHmacSecret();
    } catch {
        return null;
    }
    const key = await importHmacKey(secret);
    let signatureBytes: Uint8Array<ArrayBuffer>;
    try {
        signatureBytes = base64UrlDecode(signature);
    } catch {
        return null;
    }
    const valid = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        new TextEncoder().encode(`${MESSAGE_PREFIX}${uuid}`)
    );
    return valid ? uuid : null;
}

/** Mints a fresh guest id and signs it. Throws if the secret is missing (fail closed). */
export async function mintGuestCookieValue(): Promise<string> {
    return signGuestId(crypto.randomUUID());
}
