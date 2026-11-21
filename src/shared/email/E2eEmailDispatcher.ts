import 'server-only';
import type { Redis } from '@upstash/redis';
import type { EmailDispatcher, EmailMessage } from './types';
import {
    buildEmailDebugCountKey,
    buildEmailDebugIdemKey,
    buildEmailDebugKey,
    extractEmailDebugRecord,
} from './emailDebugRecord';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/** 스펙이 읽을 만큼 길고 스스로 정리될 만큼 짧은 debug 키 TTL. */
const EMAIL_DEBUG_TTL_SECONDS = 600;

/**
 * 발송 횟수와 멱등 표지의 TTL. 여러 단계를 오래 이어 가는 수동 검증(같은 날짜 재실행, 다음 날 시계)이
 * 한 번의 debug TTL 안에 끝나지 않아 하루로 둔다. 메일 제공자의 멱등 키 보존 기간도 하루다.
 */
const EMAIL_DEBUG_COUNT_TTL_SECONDS = SECONDS_PER_DAY;

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
        // 메일 제공자(Resend)는 같은 멱등 키의 두 번째 요청을 새 메일로 만들지 않고 성공으로 답한다.
        // 가짜도 그대로 흉내 내 기록과 카운터를 건드리지 않는다.
        if (message.idempotencyKey !== undefined) {
            const first = await this.redis.set(
                buildEmailDebugIdemKey(message.idempotencyKey),
                '1',
                { nx: true, ex: EMAIL_DEBUG_COUNT_TTL_SECONDS }
            );
            if (first === null) return true;
        }
        const record = extractEmailDebugRecord(message);
        await this.redis.set(buildEmailDebugKey(message.to), record, {
            ex: EMAIL_DEBUG_TTL_SECONDS,
        });
        const countKey = buildEmailDebugCountKey(message.to);
        await this.redis.incr(countKey);
        await this.redis.expire(countKey, EMAIL_DEBUG_COUNT_TTL_SECONDS);
        // 실제 발송은 수락된 것으로 가장해 인증 흐름이 이어지게 한다.
        return true;
    }
}
