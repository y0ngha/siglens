/**
 * Read the verification code / password-reset token that the E2E fake email
 * dispatcher captured at send time.
 *
 * WHY this exists: the real email-token store (`@/entities/email-token/api.ts`)
 * persists only a HASH of the code, so a spec can never recover the plain
 * code/token from Redis. Under `E2E_TEST=1` the app swaps in
 * `E2eEmailDispatcher`, which writes the plain code/token to a debug key
 * (`email_debug:{recipient}`, JSON `{ code?, token?, raw }`) instead of sending.
 * This helper reads that key back through the shared SRH transport.
 *
 * The send happens inside an async server action, so the key may appear a beat
 * after the UI submit resolves — we poll briefly before giving up. Transport is
 * the same Node-side SRH fetch used by the other support helpers, so the
 * page-level network guard in `fixtures.ts` does not apply.
 */

import { srhCommand } from './srhClient';

/** Captured-email payload, mirroring `EmailDebugRecord` in E2eEmailDispatcher.ts. */
export interface EmailDebug {
    /** 6-digit verification code (verification emails). */
    code?: string;
    /** Password-reset token, parsed from the reset link (reset emails). */
    token?: string;
    /** Full plain-text body, for custom fallback parsing. */
    raw: string;
}

const EMAIL_DEBUG_KEY_PREFIX = 'email_debug';
const DEFAULT_POLL_ATTEMPTS = 20;
const DEFAULT_POLL_INTERVAL_MS = 150;

function buildKey(email: string): string {
    return `${EMAIL_DEBUG_KEY_PREFIX}:${email}`;
}

/**
 * Parse a raw SRH `GET` result into an {@link EmailDebug}, or null when the key
 * is absent. The Upstash client stores objects as JSON, so the value comes back
 * as a JSON string (or, defensively, an already-parsed object).
 */
function parseDebugResult(result: unknown): EmailDebug | null {
    if (result === null || result === undefined) return null;
    if (typeof result === 'object') return result as EmailDebug;
    if (typeof result === 'string') {
        return JSON.parse(result) as EmailDebug;
    }
    return null;
}

/**
 * Fetch the captured code/token for `email`, polling until the async send lands
 * the debug key (or the attempt budget is exhausted). Returns null if nothing
 * was captured within the window.
 */
export async function getEmailDebug(
    email: string,
    options: { attempts?: number; intervalMs?: number } = {}
): Promise<EmailDebug | null> {
    const attempts = options.attempts ?? DEFAULT_POLL_ATTEMPTS;
    const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const key = buildKey(email);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const result = await srhCommand(['GET', key]);
        const parsed = parseDebugResult(result);
        if (parsed !== null) return parsed;
        if (attempt < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }

    return null;
}
