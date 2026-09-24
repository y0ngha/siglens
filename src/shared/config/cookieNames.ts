/** HttpOnly session cookie — server-only, used for authentication. */
export const AUTH_SESSION_COOKIE_NAME = 'siglens_session';

/** Client-readable hint cookie set on login, cleared on logout. Value is always "1". */
export const AUTH_HINT_COOKIE_NAME = 'siglens_auth';

/**
 * HttpOnly first-party anonymous visitor id (`shared/api/guestId.ts`). Used
 * as the guest quota/rate-limit key for the agent and the symbol-page
 * chatbot instead of the client IP. Per-host — siglens.io and
 * ai.siglens.io each mint and track their own id.
 */
export const GUEST_ID_COOKIE_NAME = 'siglens_guest';

/**
 * Client-readable one-shot flag the sign-up server actions set so the next
 * page can record a Google Ads sign-up conversion (`shared/lib/googleAds.ts`).
 * Value is always "1". Scoped to `siglens.io` so ai.siglens.io reads it too —
 * a bare "signed up" marker leaks nothing to sibling subdomains.
 */
export const SIGNUP_CONVERSION_COOKIE_NAME = 'siglens_signup_conversion';
