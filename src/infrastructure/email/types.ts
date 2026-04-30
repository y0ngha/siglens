export interface EmailMessage {
    to: string;
    subject: string;
    html: string;
    text: string;
}

export interface EmailDispatcher {
    /**
     * 메일을 전송한다. 실패 시 에러를 던지지 않고 false를 반환해 호출부가
     * fire-and-forget 처리할 수 있게 한다.
     */
    sendEmail(message: EmailMessage): Promise<boolean>;
}
