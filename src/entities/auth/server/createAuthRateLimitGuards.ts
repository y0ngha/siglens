import 'server-only';

import { hashUsageIp } from '@y0ngha/siglens-core';
import type { AuthRateLimiter } from '@/entities/auth/lib/authUseCaseTypes';
import { getClientIp } from '@/shared/api/getClientIp';
import { checkFixedWindowRateLimit } from '@/shared/cache/fixedWindowRateLimit';
import { getRedisReaderWriter } from '@/shared/cache/redisClient';

interface AuthRateLimitGuards {
    rateLimit: AuthRateLimiter;
    resetCounter: (key: string) => Promise<void>;
    ipHash: () => Promise<string>;
}

/**
 * 인증 흐름(가입 코드·비밀번호 재설정·로그인)의 남용 한도 포트(실제 Redis 구현). 각 액션이 use-case 의존성에
 * 펼쳐 쓴다. `logTag`는 Redis 오류 로그에 붙는 흐름 이름이다(`signupEmailCodeRateLimit` 등).
 *
 * fail-open: Redis 오류에는 한도를 통과시킨다(`checkFixedWindowRateLimit`). 코드 기록 자체가 같은 Redis에
 * 있으므로 Redis가 죽으면 흐름이 `redis_unavailable`/`unexpected`로 어차피 실패하고, 한도만 따로 열려 있는
 * 구간이 생기지 않는다. IP는 SA-15대로 엣지 IP(`getClientIp`)의 해시만 쓴다.
 */
export function createAuthRateLimitGuards(logTag: string): AuthRateLimitGuards {
    return {
        rateLimit: rule => checkFixedWindowRateLimit({ ...rule, logTag }),
        resetCounter: async key => {
            await getRedisReaderWriter()?.writer.del(key);
        },
        ipHash: async () => hashUsageIp(await getClientIp(), new Date()),
    };
}
