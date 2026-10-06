import 'server-only';
import { randomUUID } from 'node:crypto';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';

/**
 * 한 심볼의 카드 분석(번역 + 라벨링)을 한 번에 하나만 돌리는 진행 중 잠금.
 *
 * 방문자 경로(`ensureNewsCardsAnalyzedAction`)와 SEO prewarm(`prewarmNews`)이 같은
 * 미분석 기사를 동시에 집으면 둘 다 LLM을 태운다 — 행이 `analyzedAt === null`인 채로
 * 분석이 끝날 때까지 남아 있어서다(감사 L1). 두 경로가 이 잠금을 먼저 잡는다.
 *
 * TTL은 방문자 상한(25건 ÷ 동시성 4 = 7청크)이 한 청크의 재시도 예산을 감안해도 들어올
 * 만큼이다. 넘기면 잠금이 먼저 풀려 겹칠 수 있지만, 그건 지금의 기본 동작일 뿐이다.
 */
const LOCK_TTL_SECONDS = 10 * SECONDS_PER_MINUTE;

const RELEASE_LOCK_SCRIPT =
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

function lockKey(symbol: string): string {
    return `news:cards:inflight:${symbol.toUpperCase()}`;
}

/**
 * 잠금을 잡고 `run`을 실행한다. 다른 경로가 이미 분석 중이면 실행하지 않는다.
 *
 * Redis 미설정/장애면 잠금 없이 실행한다(fail-open) — 잠금은 중복 비용을 줄이는
 * 장치라, 장애 때 카드 분석 자체를 멈추면 뉴스·종합 스냅샷이 비게 된다
 * (`analyzeNewsCards` JSDoc).
 *
 * 해제는 토큰 비교 후 삭제다 — TTL이 지나 다른 경로가 잡은 잠금을 지우지 않는다.
 *
 * @returns `run`을 실행했으면 `true`, 다른 경로가 진행 중이라 건너뛰었으면 `false`.
 */
export async function withNewsCardAnalysisLock(
    symbol: string,
    run: () => Promise<void>
): Promise<boolean> {
    const redis = getRedisClient();
    const token = randomUUID();
    const acquired =
        redis === null
            ? true
            : await redis
                  .set(lockKey(symbol), token, {
                      nx: true,
                      ex: LOCK_TTL_SECONDS,
                  })
                  .then(result => result !== null)
                  .catch((error: unknown) => {
                      console.error(
                          '[newsCardAnalysisLock] acquire failed',
                          error
                      );
                      return true;
                  });
    if (!acquired) return false;

    try {
        await run();
    } finally {
        if (redis !== null) {
            await redis
                .eval(RELEASE_LOCK_SCRIPT, [lockKey(symbol)], [token])
                .catch((error: unknown) => {
                    console.error(
                        '[newsCardAnalysisLock] release failed',
                        error
                    );
                });
        }
    }
    return true;
}
