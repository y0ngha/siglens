import type {
    EmailMessage,
    KeyedEmailDispatcher,
    KeyedEmailOutcome,
} from './types';

/**
 * 연속한 두 발송이 시작되는 최소 간격(ms). Resend 계정의 초당 요청 한도(약 2건)를 넘지 않게 하는 값이다 —
 * 한도를 넘은 요청은 429로 거절돼 `false`가 되고, 발송 기록은 이미 선점돼 그날 다시 보내지 않으므로 그 메일은
 * 사라진다.
 */
export const EMAIL_SEND_MIN_INTERVAL_MS = 500;

/**
 * 다른 {@link KeyedEmailDispatcher}를 감싸 **발송 시작 시각**을 최소 간격만큼 벌리는 어댑터.
 *
 * 메일 리포트와 알림 메일 패스는 한 요청 안에서 나란히 돌고 각자 워커 풀(4)을 가지므로, 두 풀이 따로 보내면
 * 제공자 한도를 합쳐서 넘는다. 두 패스가 이 인스턴스 하나를 공유하면 도착 순서대로(FIFO) 한 줄로 서고,
 * 간격은 요청이 끝나길 기다리지 않고 **시작 시각**만 잰다(한 건이 느려도 다음 건이 밀려나지 않는다).
 * 리포트 패스의 가입 첫 리포트는 `sendKeyedEmail`로 보내므로 두 발송 모두 같은 줄에 선다.
 * 안쪽 dispatcher가 던져도 `false`(`rejected`)로 바꿔 돌려주어 호출자의 "던지지 않는다" 계약을 지킨다.
 */
export class ThrottledEmailDispatcher implements KeyedEmailDispatcher {
    private nextStartAt = 0;

    constructor(
        private readonly inner: KeyedEmailDispatcher,
        private readonly minIntervalMs: number = EMAIL_SEND_MIN_INTERVAL_MS
    ) {}

    async sendEmail(message: EmailMessage): Promise<boolean> {
        await this.waitForSlot();
        try {
            return await this.inner.sendEmail(message);
        } catch {
            return false;
        }
    }

    async sendKeyedEmail(
        message: EmailMessage & { idempotencyKey: string }
    ): Promise<KeyedEmailOutcome> {
        await this.waitForSlot();
        try {
            return await this.inner.sendKeyedEmail(message);
        } catch {
            return 'rejected';
        }
    }

    /** 시작 시각을 동기적으로 예약한다 — 동시에 들어온 호출들이 같은 슬롯을 받지 못하고 도착 순서대로 줄을 선다. */
    private async waitForSlot(): Promise<void> {
        const startAt = Math.max(Date.now(), this.nextStartAt);
        this.nextStartAt = startAt + this.minIntervalMs;
        const waitMs = startAt - Date.now();
        if (waitMs > 0) {
            await new Promise<void>(resolve => setTimeout(resolve, waitMs));
        }
    }
}
