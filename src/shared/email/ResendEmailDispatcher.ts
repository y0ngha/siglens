import { Resend } from 'resend';
import type { EmailDispatcher, EmailMessage } from './types';

/** Resend 요청 대기 상한. 넘기면 발송 실패(false)로 취급해 호출한 use-case가 막히지 않게 한다. */
const EMAIL_SEND_TIMEOUT_MS = 10_000;

/** {@link ResendEmailDispatcher} 생성에 필요한 자격과 발신자 주소. */
export interface ResendConfig {
    apiKey: string;
    from: string;
}

/**
 * 타임아웃 신호가 울리면 reject하는 Promise와 리스너 해제 함수를 만든다.
 * 발송이 먼저 끝났을 때 `cleanup`으로 abort 리스너를 떼어 남기지 않는다.
 */
function createTimeoutRace(): {
    timeout: Promise<never>;
    cleanup: () => void;
} {
    const signal = AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS);
    let cleanup = (): void => {};
    const timeout = new Promise<never>((_, reject) => {
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }
        const listener = (): void => reject(signal.reason);
        signal.addEventListener('abort', listener, { once: true });
        cleanup = () => signal.removeEventListener('abort', listener);
    });
    return { timeout, cleanup };
}

/**
 * Resend로 메일을 보내는 운영 dispatcher. 전송 거절·SDK 예외·타임아웃은 모두
 * 던지지 않고 `false`로 돌려준다.
 */
export class ResendEmailDispatcher implements EmailDispatcher {
    private readonly client: Resend;
    private readonly from: string;

    constructor(config: ResendConfig) {
        this.client = new Resend(config.apiKey);
        this.from = config.from;
    }

    async sendEmail(message: EmailMessage): Promise<boolean> {
        const { timeout, cleanup } = createTimeoutRace();
        try {
            const { error } = await Promise.race([
                this.client.emails.send({
                    from: this.from,
                    to: message.to,
                    subject: message.subject,
                    html: message.html,
                    text: message.text,
                    // 헤더가 없는 메일(인증 메일)은 키 자체를 싣지 않는다 — 빈 객체를
                    // 보내면 SDK 버전에 따라 빈 헤더 블록이 생길 수 있다.
                    ...(message.headers ? { headers: message.headers } : {}),
                }),
                timeout,
            ]);
            return error === null;
        } catch {
            return false;
        } finally {
            cleanup();
        }
    }
}
