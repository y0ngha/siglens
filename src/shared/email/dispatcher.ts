import { getRedisClient } from '@/shared/cache/redisClient';
import { isE2E } from '@/shared/api/e2eEnv';
import type { EmailDispatcher } from './types';
import { E2eEmailDispatcher } from './E2eEmailDispatcher';
import {
    ResendEmailDispatcher,
    type ResendConfig,
} from './ResendEmailDispatcher';

const RESEND_API_KEY_ENV = 'RESEND_API_KEY';
const EMAIL_FROM_ENV = 'EMAIL_FROM';
const DEFAULT_FROM = 'SIGLENS <noreply@siglens.io>';

function readResendConfig(): ResendConfig | null {
    const apiKey = process.env[RESEND_API_KEY_ENV];
    if (!apiKey) return null;
    const from = process.env[EMAIL_FROM_ENV] || DEFAULT_FROM;
    return { apiKey, from };
}

/** 발송 수단이 설정되지 않은 환경(키 없음, E2E인데 Redis 없음)에서 항상 거절(false)하는 대체 구현. */
class NoopEmailDispatcher implements EmailDispatcher {
    async sendEmail(): Promise<boolean> {
        return false;
    }
}

/**
 * 트랜잭셔널 메일 dispatcher를 고른다. `E2E_TEST=1`이면 코드/토큰을 Redis에
 * 캡처하는 {@link E2eEmailDispatcher}(실제 토큰 저장소는 해시만 보관), 아니면
 * Resend dispatcher, Resend 키가 없으면(E2E에서 Redis가 없을 때도) noop이다.
 *
 * E2E 가짜를 require로 게이트하지 않고 정적 import로 두는 것은 의도적이다.
 * 번들에 이미 있는 `getRedisClient`와 타입 전용 `@upstash/redis`만 쓰므로
 * 번들 비용이 무시할 만하고, Vitest의 vmThreads 풀은 require-게이트 팩토리 안의
 * 상대 경로 CJS `require('./E2eEmailDispatcher')`(.ts)를 해석하지 못해 E2E
 * 분기를 단위 테스트할 수 없게 되기 때문이다. `getOAuthAdapter`의 정적
 * `e2eFakeOAuthAdapter` import와 같은 근거이며, `E2E_TEST`가 없으면 운영 경로는
 * 그대로다.
 */
export function createEmailDispatcher(): EmailDispatcher {
    if (isE2E()) {
        const redis = getRedisClient();
        // 가짜는 캡처 값을 쓸 Redis 클라이언트가 필요하므로 없으면 noop으로 폴백한다.
        return redis
            ? new E2eEmailDispatcher(redis)
            : new NoopEmailDispatcher();
    }
    const config = readResendConfig();
    return config
        ? new ResendEmailDispatcher(config)
        : new NoopEmailDispatcher();
}
