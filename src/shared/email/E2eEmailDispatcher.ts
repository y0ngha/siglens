import 'server-only';
import type { Redis } from '@upstash/redis';
import type { EmailDispatcher, EmailMessage } from './types';
import {
    buildEmailDebugKey,
    extractEmailDebugRecord,
} from './emailDebugRecord';

/** 스펙이 읽을 만큼 길고 스스로 정리될 만큼 짧은 debug 키 TTL. */
const EMAIL_DEBUG_TTL_SECONDS = 600;

/**
 * `E2E_TEST=1`에서만 쓰는 가짜 dispatcher. 실제 발송 대신 발송 시점에 메일에서
 * 평문 코드/토큰을 뽑아 `email_debug:{recipient}`에 기록한다 — 토큰 저장소는
 * 해시만 보관해 스펙이 평문을 되읽을 수 없기 때문이다. Resend 키를 읽지 않으며
 * 외부로 아무것도 나가지 않는다. `createEmailDispatcher`가 정적 import로
 * `E2E_TEST=1` 분기에서만 생성하므로 운영에서는 죽은 분기다.
 */
export class E2eEmailDispatcher implements EmailDispatcher {
    private readonly redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    async sendEmail(message: EmailMessage): Promise<boolean> {
        const record = extractEmailDebugRecord(message);
        await this.redis.set(buildEmailDebugKey(message.to), record, {
            ex: EMAIL_DEBUG_TTL_SECONDS,
        });
        // 실제 발송은 수락된 것으로 가장해 인증 흐름이 이어지게 한다.
        return true;
    }
}
