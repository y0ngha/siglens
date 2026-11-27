import { Resend } from 'resend';
import type {
    EmailMessage,
    KeyedEmailDispatcher,
    KeyedEmailOutcome,
} from './types';

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
export class ResendEmailDispatcher implements KeyedEmailDispatcher {
    private readonly client: Resend;
    private readonly from: string;

    constructor(config: ResendConfig) {
        this.client = new Resend(config.apiKey);
        this.from = config.from;
    }

    async sendEmail(message: EmailMessage): Promise<boolean> {
        return (await this.submit(message)) === null;
    }

    /**
     * 멱등 키 발송. Resend의 두 멱등 오류를 거절과 구분한다: `invalid_idempotent_request`(같은 키에
     * 다른 본문)는 그 키의 첫 요청이 이미 수락됐다는 뜻이고, `concurrent_idempotent_requests`는 같은 키의
     * 요청이 처리 중이라는 뜻이다. 그 밖의 오류·예외·타임아웃은 `rejected`다.
     */
    async sendKeyedEmail(
        message: EmailMessage & { idempotencyKey: string }
    ): Promise<KeyedEmailOutcome> {
        const failure = await this.submit(message);
        if (failure === null) return 'accepted';
        if (failure === 'invalid_idempotent_request') return 'already_accepted';
        if (failure === 'concurrent_idempotent_requests') return 'in_flight';
        return 'rejected';
    }

    /** 보내고 수락되면 `null`, 아니면 Resend 오류 이름(예외·타임아웃은 `'exception'`)을 돌려준다. */
    private async submit(message: EmailMessage): Promise<string | null> {
        const { timeout, cleanup } = createTimeoutRace();
        try {
            const payload = {
                from: this.from,
                to: message.to,
                subject: message.subject,
                html: message.html,
                text: message.text,
                // 헤더가 없는 메일(인증 메일)은 키 자체를 싣지 않는다 — 빈 객체를
                // 보내면 SDK 버전에 따라 빈 헤더 블록이 생길 수 있다.
                ...(message.headers ? { headers: message.headers } : {}),
                // SDK 필드명은 camelCase `replyTo`이고 와이어에선 `reply_to`로 직렬화된다.
                ...(message.replyTo ? { replyTo: message.replyTo } : {}),
            };
            // 멱등 키는 재시도로 같은 메일이 두 번 나가면 안 되는 발송만 싣는다. 키가 없으면 두 번째
            // 인자 자체를 넘기지 않아 다른 메일의 호출 모양은 그대로다.
            const { error } = await Promise.race([
                message.idempotencyKey
                    ? this.client.emails.send(payload, {
                          idempotencyKey: message.idempotencyKey,
                      })
                    : this.client.emails.send(payload),
                timeout,
            ]);
            return error === null ? null : error.name;
        } catch {
            return 'exception';
        } finally {
            cleanup();
        }
    }
}
