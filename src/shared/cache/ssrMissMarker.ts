import 'server-only';
import { getRedisClient } from './redisClient';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * 표시 보존 기간. 크론 창 사이 공백(최대 ~7.5시간, `docs/reference/CRON.md`)과 페이지
 * ISR(최대 24시간)을 모두 덮어야 한다 — 더 짧으면 크론이 오기 전에 표시가 사라져
 * 플레이스홀더 페이지가 ISR 만료까지 남는다.
 */
const SSR_MISS_TTL_SECONDS = 2 * SECONDS_PER_DAY;

const keyOf = (tag: string): string => `ssr-miss:${tag}`;

/**
 * "이 캐시 태그의 페이지가 **비어 있는 값으로** SSR됐다"를 기록한다.
 *
 * ## 왜 필요한가
 *
 * 허브의 AI 산문(브리핑·다이제스트)과 경제 스냅샷은 SSR 시점에 캐시를 **읽기만**
 * 한다. 비어 있으면 플레이스홀더로 렌더되고, 그 HTML은 페이지 ISR(12~24시간) 동안
 * 그대로 서빙된다. 이후 방문자나 크론이 값을 채워도 **누가 그 태그를 털지 않으면**
 * 페이지는 TTL 끝까지 플레이스홀더다. 크론은 새로 구웠을 때(`generated`)만 털었고,
 * 방문자 생성 경로는 아예 털지 않았다 — 그래서 "값은 캐시에 있는데 페이지는 비어
 * 있는" 상태가 생겼다(2026-10-01 허브 감사 B3).
 *
 * 매 tick 무조건 털면 ISR 쓰기가 폭증한다(MISTAKES.md "ISR & Caching #1"). 그래서
 * **빈 렌더가 실제로 있었을 때만** 표시를 남기고, 크론이 값이 있음을 확인한 순간
 * {@link consumeSsrMiss}로 표시를 소비하며 한 번만 턴다.
 *
 * Redis 미구성·장애면 noop — 최악은 예전 동작(TTL까지 플레이스홀더)이다.
 */
export async function markSsrMiss(tag: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(keyOf(tag), '1', { ex: SSR_MISS_TTL_SECONDS });
    } catch (error) {
        console.error('[ssrMissMarker] set failed', error);
    }
}

/**
 * 표시가 있으면 지우고 true. 호출자는 true일 때만 그 태그를 무효화한다.
 *
 * `getdel` 한 번으로 읽기와 지우기를 원자적으로 한다 — 크론은 루트 락으로 직렬화돼
 * 있지만, 원자성이 있으면 그 전제에 기대지 않아도 된다.
 *
 * Redis 장애면 false — 털지 않는 쪽이 안전한 기본값이다(쓰기 폭증 방지).
 */
export async function consumeSsrMiss(tag: string): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.getdel(keyOf(tag))) !== null;
    } catch (error) {
        console.error('[ssrMissMarker] getdel failed', error);
        return false;
    }
}
