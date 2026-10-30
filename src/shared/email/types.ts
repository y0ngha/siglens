/** {@link EmailDispatcher}에 넘기는 메일 한 통의 내용. */
export interface EmailMessage {
    /** 수신자 이메일 주소. */
    to: string;
    /** 메일 제목. */
    subject: string;
    /** HTML 본문. */
    html: string;
    /** plain-text 본문. */
    text: string;
    /**
     * 추가 MIME 헤더(예: `List-Unsubscribe`). 트랜잭셔널 인증 메일은 생략하고,
     * 정기 리포트 같은 대량성 메일은 원클릭 구독 해지(RFC 8058)와 받은편지함
     * 제공자 요구사항 때문에 싣는다.
     */
    headers?: Record<string, string>;
}

/** 트랜잭셔널 이메일 발송 추상 (Resend/SendGrid/SMTP 등을 use-case에 주입). */
export interface EmailDispatcher {
    /** 메시지 발송 — 전송 수락 시 true, 거절 시 false. */
    sendEmail(message: EmailMessage): Promise<boolean>;
}
