import { checkFixedWindowRateLimit } from '@/shared/cache/fixedWindowRateLimit';

/**
 * 버킷별 시간당 허용 횟수. 👍/👎는 한 세션에서 여러 응답을 연달아 평가하므로
 * 넉넉하고, 사람이 쓰는 VOC 폼은 빡빡하다.
 */
const LIMIT_PER_HOUR = {
    voc: 5,
    ai_vote: 120,
} as const;

export type FeedbackRateLimitBucket = keyof typeof LIMIT_PER_HOUR;

const WINDOW_SECONDS = 3600;

/**
 * IP 해시당 시간당 제출 횟수를 버킷별로 제한한다. 고정 1시간 창이며 해시는 Redis에만
 * 1시간 TTL로 남는다(DB에는 저장하지 않는다). 원자성·fail-open 정책은
 * `checkFixedWindowRateLimit`을 따른다(`checkShareRateLimit`과 같은 정책).
 *
 * @returns true = 허용, false = 차단(한도 초과)
 */
export async function checkFeedbackRateLimit(
    bucket: FeedbackRateLimitBucket,
    ipHash: string
): Promise<boolean> {
    return checkFixedWindowRateLimit({
        key: `feedback:rl:${bucket}:${ipHash}`,
        limit: LIMIT_PER_HOUR[bucket],
        windowSeconds: WINDOW_SECONDS,
        logTag: 'checkFeedbackRateLimit',
    });
}
