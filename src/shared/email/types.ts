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
    /**
     * 답장 받을 주소. 운영자 알림 메일이 방문자 이메일을 여기에 실으면 운영자가
     * 메일 클라이언트에서 바로 회신할 수 있다. 생략하면 헤더 자체를 싣지 않는다.
     */
    replyTo?: string;
    /**
     * 같은 키로 24시간 안에 다시 보내면 Resend가 한 번만 보낸다. 재시도로 같은 메일이 두 번 나가면
     * 안 되는 발송만 싣는다.
     */
    idempotencyKey?: string;
}

/**
 * 멱등 키를 단 발송의 결과. `already_accepted`는 같은 키의 첫 요청을 Resend가 이미 받았다는 뜻이다
 * (`invalid_idempotent_request`: 본문이 달라진 재시도). `in_flight`는 같은 키의 요청이 아직 처리 중이라
 * 나중에 다시 시도하라는 뜻이다(`concurrent_idempotent_requests`). 둘 다 메일이 나갔거나 나가는 중이라
 * 단순 거절과 구분해야 한다 — 거절로 기록하면 이미 받은 메일을 "실패"로 남기게 된다.
 */
export type KeyedEmailOutcome =
    | 'accepted'
    | 'already_accepted'
    | 'in_flight'
    | 'rejected';

/** 트랜잭셔널 이메일 발송 추상 (Resend/SendGrid/SMTP 등을 use-case에 주입). */
export interface EmailDispatcher {
    /** 메시지 발송 — 전송 수락 시 true, 거절 시 false. */
    sendEmail(message: EmailMessage): Promise<boolean>;
}

/** 멱등 키 발송의 결과를 구분해 돌려주는 dispatcher. 재시도가 있는 발송(가입 첫 리포트)만 쓴다. */
export interface KeyedEmailDispatcher extends EmailDispatcher {
    sendKeyedEmail(
        message: EmailMessage & { idempotencyKey: string }
    ): Promise<KeyedEmailOutcome>;
}
