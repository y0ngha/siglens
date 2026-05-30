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
    // After the typeof guard `result` is an object, but TS cannot narrow it to
    // EmailDebug — the SRH GET response always returns a serialized
    // EmailDebugRecord (only E2eEmailDispatcher writes this key), so the shape
    // is guaranteed by the producer.
    if (typeof result === 'object') return result as EmailDebug;
    if (typeof result === 'string') {
        try {
            // JSON.parse returns `any`; the value originates solely from
            // E2eEmailDispatcher writing an EmailDebugRecord under
            // `email_debug:{recipient}`, so the parsed structure is guaranteed.
            return JSON.parse(result) as EmailDebug;
        } catch {
            // Corrupt / non-JSON payload — treat as "nothing captured" rather
            // than crashing the test runner with a SyntaxError.
            return null;
        }
    }
    return null;
}

/** Polling knobs for {@link getEmailDebug}. */
export interface GetEmailDebugOptions {
    /** How many times to poll before giving up (default {@link DEFAULT_POLL_ATTEMPTS}). */
    attempts?: number;
    /** Delay between polls in ms (default {@link DEFAULT_POLL_INTERVAL_MS}). */
    intervalMs?: number;
}

/**
 * Fetch the captured code/token for `email`, polling until the async send lands
 * the debug key (or the attempt budget is exhausted). Returns null if nothing
 * was captured within the window.
 */
export async function getEmailDebug(
    email: string,
    options: GetEmailDebugOptions = {}
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
