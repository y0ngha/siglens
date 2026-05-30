import type { EmailDispatcher, EmailMessage } from './types';
import { Resend } from 'resend';
import { E2eEmailDispatcher } from './E2eEmailDispatcher';
import { getRedisClient } from '@/shared/cache/redisClient';

const RESEND_API_KEY_ENV = 'RESEND_API_KEY';
const EMAIL_SEND_TIMEOUT_MS = 10_000;
const EMAIL_FROM_ENV = 'EMAIL_FROM';
const DEFAULT_FROM = 'Siglens <noreply@siglens.io>';

interface ResendConfig {
    apiKey: string;
    from: string;
}

function readResendConfig(): ResendConfig | null {
    const apiKey = process.env[RESEND_API_KEY_ENV];
    if (!apiKey) return null;
    const from = process.env[EMAIL_FROM_ENV] || DEFAULT_FROM;
    return { apiKey, from };
}

export class ResendEmailDispatcher implements EmailDispatcher {
    private readonly client: Resend;
    private readonly from: string;

    constructor(config: ResendConfig) {
        this.client = new Resend(config.apiKey);
        this.from = config.from;
    }

    async sendEmail(message: EmailMessage): Promise<boolean> {
        const signal = AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS);
        let cleanup: (() => void) | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
            if (signal.aborted) {
                reject(signal.reason);
                return;
            }
            const listener = (): void => reject(signal.reason);
            signal.addEventListener('abort', listener, { once: true });
            cleanup = () => signal.removeEventListener('abort', listener);
        });
        try {
            const { error } = await Promise.race([
                this.client.emails.send({
                    from: this.from,
                    to: message.to,
                    subject: message.subject,
                    html: message.html,
                    text: message.text,
                }),
                timeoutPromise,
            ]);
            return error === null;
        } catch {
            return false;
        } finally {
            cleanup?.();
        }
    }
}

class NoopEmailDispatcher implements EmailDispatcher {
    async sendEmail(): Promise<boolean> {
        return false;
    }
}

/**
 * Returns the transactional email dispatcher: under `E2E_TEST=1` an
 * {@link E2eEmailDispatcher} that captures the plain code/token to Redis (so
 * specs can read them back — the real token store only keeps a hash), else the
 * real Resend dispatcher (or a noop when no Resend key is configured).
 *
 * DELIBERATE — the E2E fake is a STATIC import, not require-gated like the
 * other E2E fakes (FakeMarketProvider etc.). It carries no heavy / test-only
 * deps: only a type-only `@upstash/redis` import plus `getRedisClient`, both
 * already in the prod bundle via the email-token store, so its bundle footprint
 * is negligible. The static import keeps this function's E2E branch
 * unit-testable — Vitest's vmThreads pool cannot resolve a relative CJS
 * `require('./E2eEmailDispatcher')` (`.ts`) inside a require-gated factory. This
 * mirrors the documented rationale for `getLlmProvider`'s static FakeChatProvider
 * import. The prod path is unchanged when `E2E_TEST` is unset.
 */
export function createEmailDispatcher(): EmailDispatcher {
    if (process.env.E2E_TEST === '1') {
        const redis = getRedisClient();
        // Falls back to noop when Redis is not configured (the fake needs a
        // client to write the captured code/token to).
        return redis
            ? new E2eEmailDispatcher(redis)
            : new NoopEmailDispatcher();
    }
    const config = readResendConfig();
    return config
        ? new ResendEmailDispatcher(config)
        : new NoopEmailDispatcher();
}
