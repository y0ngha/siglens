import { Resend } from 'resend';
import type { EmailDispatcher, EmailMessage, SendEmailOptions } from './types';

const RESEND_API_KEY_ENV = 'RESEND_API_KEY';
const EMAIL_FROM_ENV = 'EMAIL_FROM';
const DEFAULT_FROM = 'Siglens <noreply@siglens.io>';

interface ResendConfig {
    apiKey: string;
    from: string;
}

function readResendConfig(): ResendConfig | null {
    const apiKey = process.env[RESEND_API_KEY_ENV];
    if (!apiKey) return null;
    const from = process.env[EMAIL_FROM_ENV] ?? DEFAULT_FROM;
    return { apiKey, from };
}

function createAbortError(): Error {
    return new Error('Email send aborted');
}

function withAbortSignal<T>(
    promise: Promise<T>,
    signal?: AbortSignal
): Promise<T> {
    if (signal === undefined) return promise;
    if (signal.aborted) return Promise.reject(createAbortError());

    return new Promise((resolve, reject) => {
        const handleAbort = (): void => reject(createAbortError());
        signal.addEventListener('abort', handleAbort, { once: true });
        promise
            .then(resolve, reject)
            .finally(() => signal.removeEventListener('abort', handleAbort));
    });
}

export class ResendEmailDispatcher implements EmailDispatcher {
    private readonly client: Resend;
    private readonly from: string;

    constructor(config: ResendConfig) {
        this.client = new Resend(config.apiKey);
        this.from = config.from;
    }

    async sendEmail(
        message: EmailMessage,
        options?: SendEmailOptions
    ): Promise<boolean> {
        try {
            const { error } = await withAbortSignal(
                this.client.emails.send({
                    from: this.from,
                    to: message.to,
                    subject: message.subject,
                    html: message.html,
                    text: message.text,
                }),
                options?.signal
            );
            return error === null;
        } catch {
            return false;
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
