import 'server-only';
import type { Redis } from '@upstash/redis';
import type { EmailDispatcher, EmailMessage } from './types';

/**
 * E2E-only email dispatcher. The real {@link ResendEmailDispatcher} hands the
 * code/token to an external SMTP relay, and the email-token store only persists
 * a HASH of the code (`@/entities/email-token/api.ts`), so a spec can never read
 * the plain code/token back out of Redis. Under `E2E_TEST=1` we swap in this
 * fake which, at SEND time, extracts the plain 6-digit verification code and/or
 * the password-reset token from the rendered email and writes them to a debug
 * Redis key (`email_debug:{recipient}`). The spec then reads that key via
 * `e2e/support/emailHelper.ts`. No Resend key is read; nothing leaves the box.
 *
 * This dispatcher is a STATIC import in `createEmailDispatcher` (dispatcher.ts),
 * constructed only under the `E2E_TEST=1` guard, so it's server-only and the
 * branch is dead in production. (See that factory's doc for why static, not
 * gated: it keeps the E2E branch unit-testable.)
 */

/** Redis key prefix for the captured code/token payload, keyed by recipient. */
export const EMAIL_DEBUG_KEY_PREFIX = 'email_debug';

/** TTL for the debug key — long enough for a spec to read it, short enough to self-clean. */
const EMAIL_DEBUG_TTL_SECONDS = 600;

/** Captured-email payload written to Redis under `email_debug:{recipient}`. */
export interface EmailDebugRecord {
    /** 6-digit verification code, when the email is a verification email. */
    code?: string;
    /** Password-reset token, parsed from the reset link's `token=` query. */
    token?: string;
    /** The full plain-text body, so a spec can fall back to custom parsing. */
    raw: string;
}

/** Build the debug Redis key for a recipient. */
export function buildEmailDebugKey(recipient: string): string {
    return `${EMAIL_DEBUG_KEY_PREFIX}:${recipient}`;
}

// A 6-digit verification code rendered as `인증 코드: 482917` (and as a standalone
// block in the HTML). We anchor on the label to avoid matching unrelated digit
// runs; the `\b` keeps it to exactly 6 digits.
const VERIFICATION_CODE_RE = /인증\s*코드[:：]?\s*(\d{6})\b/;

// Fallback: any standalone 6-digit run (used only when the labelled match misses
// but the email is still a verification email).
const ANY_SIX_DIGIT_RE = /\b(\d{6})\b/;

// The password-reset link carries the raw token as a `token=` query param
// (`/reset-password?email=...&token=...`). The value is URL-encoded.
const RESET_TOKEN_RE = /[?&]token=([^&\s"']+)/;

/**
 * Extract the verification code and/or reset token from a rendered email.
 * Returns whichever fields are present; `raw` is always the plain-text body.
 */
export function extractEmailDebugRecord(
    message: EmailMessage
): EmailDebugRecord {
    const haystack = `${message.text}\n${message.html}`;
    const record: EmailDebugRecord = { raw: message.text };

    const tokenMatch = haystack.match(RESET_TOKEN_RE);
    if (tokenMatch) {
        try {
            record.token = decodeURIComponent(tokenMatch[1]);
        } catch {
            // Malformed %-encoding would make decodeURIComponent throw a
            // URIError; fall back to the raw matched value so the dispatcher
            // never crashes mid-send.
            record.token = tokenMatch[1];
        }
    }

    const codeMatch =
        haystack.match(VERIFICATION_CODE_RE) ??
        haystack.match(ANY_SIX_DIGIT_RE);
    if (codeMatch) {
        record.code = codeMatch[1];
    }

    return record;
}

export class E2eEmailDispatcher implements EmailDispatcher {
    private readonly redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    async sendEmail(message: EmailMessage): Promise<boolean> {
        const record = extractEmailDebugRecord(message);
        await this.redis.set(buildEmailDebugKey(message.to), record, {
            ex: EMAIL_DEBUG_TTL_SECONDS,
        });
        // The real send is faked as accepted so the auth flow proceeds.
        return true;
    }
}
