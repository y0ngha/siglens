import { Resend } from 'resend';
import type { EmailDispatcher, EmailMessage } from './types';

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

export class ResendEmailDispatcher implements EmailDispatcher {
    private readonly client: Resend;
    private readonly from: string;

    constructor(config: ResendConfig) {
        this.client = new Resend(config.apiKey);
        this.from = config.from;
    }

    async sendEmail(message: EmailMessage): Promise<boolean> {
        const { error } = await this.client.emails.send({
            from: this.from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
        });
        if (error) {
            console.warn('[email] Resend send failed', error);
            return false;
        }
        return true;
    }
}

class NoopEmailDispatcher implements EmailDispatcher {
    async sendEmail(message: EmailMessage): Promise<boolean> {
        // 운영 환경에서 RESEND_API_KEY 누락은 설정 오류이므로 경고를 남긴다.
        console.warn(
            `[email] RESEND_API_KEY not configured; email to ${message.to} dropped (subject: "${message.subject}")`
        );
        return false;
    }
}

export function createEmailDispatcher(): EmailDispatcher {
    const config = readResendConfig();
    return config
        ? new ResendEmailDispatcher(config)
        : new NoopEmailDispatcher();
}
