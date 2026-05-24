import type { EmailDispatcher, EmailMessage } from './types';
import { Resend } from 'resend';

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

export function createEmailDispatcher(): EmailDispatcher {
    const config = readResendConfig();
    return config
        ? new ResendEmailDispatcher(config)
        : new NoopEmailDispatcher();
}
