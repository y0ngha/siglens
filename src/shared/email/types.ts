/** Email message payload passed to an {@link EmailDispatcher} implementation. */
export interface EmailMessage {
    /** Recipient email address. */
    to: string;
    /** Email subject line. */
    subject: string;
    /** HTML body of the email. */
    html: string;
    /** Plain-text body of the email. */
    text: string;
    /**
     * Extra MIME headers (e.g. `List-Unsubscribe`). Transactional auth mail
     * omits it; bulk-style mail such as the scheduled report needs it for
     * one-click unsubscribe (RFC 8058) and inbox-provider requirements.
     */
    headers?: Record<string, string>;
}

/** 트랜잭셔널 이메일 발송 추상 (Resend/SendGrid/SMTP 등을 use-case에 주입). */
export interface EmailDispatcher {
    /** 메시지 발송 — 전송 수락 시 true, 거절 시 false. */
    sendEmail(message: EmailMessage): Promise<boolean>;
}
