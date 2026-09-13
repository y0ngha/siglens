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
