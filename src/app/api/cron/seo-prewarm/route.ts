import { timingSafeEqual } from 'crypto';
import { constants } from 'node:http2';
import { after } from 'next/server';
import { acquirePrewarmLock, releasePrewarmLock } from './lock';
import { runPrewarmBatch } from './runPrewarmBatch';

const {
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_NO_CONTENT,
    HTTP_STATUS_ACCEPTED,
} = constants;

/** cleanupExpiredSessionsAction의 safeBearerCompare와 동일 — 3번째 사용처 생기면 shared로 승격. */
function safeBearerCompare(actual: string | null, expected: string): boolean {
    if (actual === null) return false;
    const a = Buffer.from(actual);
    const b = Buffer.from(`Bearer ${expected}`);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

/**
 * SEO pre-warm cron 엔드포인트 (spec 2026-07-24 §6).
 * EventBridge API Destination(~5s)·ALB idle 60s를 피하려 202를 즉시 반환하고
 * 배치는 after()로 백그라운드 실행. 중첩 실행은 Redis 루트 락이 차단하며,
 * 락 보유 중엔 204(2xx — EventBridge 재시도 폭풍 방지).
 */
export async function PATCH(request: Request): Promise<Response> {
    const expected = process.env.CRON_SECRET;
    if (!expected)
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    if (!safeBearerCompare(request.headers.get('authorization'), expected)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }

    // FIX H(감사) — acquirePrewarmLock은 redis 미구성(unconfigured) 시엔
    // fail-closed로 null을 반환하지만, Upstash 장애/타임아웃처럼 redis.set()
    // 자체가 REJECT하는 경우는 별도다: getRedisClient()가 연결 상태를 미리
    // 검증하지 않으므로 그 예외가 그대로 여기로 전파되면 500이 나가고,
    // EventBridge는 5xx를 공격적으로 재시도한다(기본 최대 185회/24h) — 락 보유
    // 중 204를 반환하는 설계 의도(재시도 폭풍 방지)와 정확히 반대되는 결과다.
    // 어떤 이유로 던지든 204로 흡수해 EventBridge가 2xx로 보고 재시도하지
    // 않게 한다. `[seo-prewarm] redis unavailable` 접두는 13-seo-prewarm.sh의
    // CloudWatch metric filter(FIX F)와 의도적으로 동일한 마커를 재사용한다 —
    // "redis 미구성"과 "redis 장애로 lock 획득 자체가 던짐" 두 경로 모두 같은
    // 필터 하나로 잡는다.
    let token: string | null;
    try {
        token = await acquirePrewarmLock();
    } catch (error) {
        console.error(
            '[seo-prewarm] redis unavailable — lock acquire threw:',
            error
        );
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
    }
    if (token === null) {
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
    }
    after(async () => {
        try {
            const counts = await runPrewarmBatch();
            console.log('[seo-prewarm] batch done:', JSON.stringify(counts));
        } catch (error) {
            console.error('[seo-prewarm] batch failed:', error);
        } finally {
            await releasePrewarmLock(token);
        }
    });
    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
