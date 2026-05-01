// EmailMessage 의 정식 정의는 siglens-core가 publish 후 그곳으로 이전될 예정.
// 그 시점까지는 domain/auth/coreStubs에 정의된 shape를 그대로 사용한다.
import type { EmailMessage } from '@/domain/auth/coreStubs';

export type { EmailMessage };

export interface SendEmailOptions {
    signal?: AbortSignal;
}

export interface EmailDispatcher {
    /** 메일을 전송한다. 실패 시 에러를 던지지 않고 false를 반환해 호출부가 fire-and-forget 처리할 수 있게 한다. */
    sendEmail(
        message: EmailMessage,
        options?: SendEmailOptions
    ): Promise<boolean>;
}
