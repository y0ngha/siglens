import { checkFixedWindowRateLimit } from '@/shared/cache/fixedWindowRateLimit';

const SHARE_LIMIT_PER_HOUR = 30;
const WINDOW_SECONDS = 3600;

/**
 * IP 해시당 시간당 공유 생성 횟수를 제한한다. `createShareSnapshotAction`이 쓴다.
 * 고정 창·원자성·fail-open 정책은 `checkFixedWindowRateLimit`을 따른다.
 *
 * @returns true = 허용, false = 차단(rate limit 초과)
 */
export async function checkShareRateLimit(ipHash: string): Promise<boolean> {
    return checkFixedWindowRateLimit({
        key: `share:rl:${ipHash}`,
        limit: SHARE_LIMIT_PER_HOUR,
        windowSeconds: WINDOW_SECONDS,
        logTag: 'checkShareRateLimit',
    });
}
