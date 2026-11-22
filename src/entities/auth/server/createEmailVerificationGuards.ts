import 'server-only';

import { hashUsageIp } from '@y0ngha/siglens-core';
import type { EmailCodeRateLimiter } from '@/entities/auth/lib/authUseCaseTypes';
import { getClientIp } from '@/shared/api/getClientIp';
import { checkFixedWindowRateLimit } from '@/shared/cache/fixedWindowRateLimit';
import { getRedisReaderWriter } from '@/shared/cache/redisClient';

const RATE_LIMIT_LOG_TAG = 'signupEmailCodeRateLimit';

interface EmailVerificationGuards {
    rateLimit: EmailCodeRateLimiter;
    resetCounter: (key: string) => Promise<void>;
    ipHash: () => Promise<string>;
}

/**
 * 가입 이메일 인증의 남용 한도 포트(실제 Redis 구현). 코드 요청·확인 두 액션이 use-case 의존성에 펼쳐 쓴다.
 *
 * fail-open: Redis 오류에는 한도를 통과시킨다(`checkFixedWindowRateLimit`). 코드 기록 자체가 같은 Redis에
 * 있으므로 Redis가 죽으면 흐름이 `redis_unavailable`/`unexpected`로 어차피 실패하고, 한도만 따로 열려 있는
 * 구간이 생기지 않는다. IP는 SA-15대로 엣지 IP(`getClientIp`)의 해시만 쓴다.
 */
export function createEmailVerificationGuards(): EmailVerificationGuards {
    return {
        rateLimit: rule =>
            checkFixedWindowRateLimit({ ...rule, logTag: RATE_LIMIT_LOG_TAG }),
        resetCounter: async key => {
            await getRedisReaderWriter()?.writer.del(key);
        },
        ipHash: async () => hashUsageIp(await getClientIp(), new Date()),
    };
}
