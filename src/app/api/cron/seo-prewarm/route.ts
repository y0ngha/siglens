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
    const token = await acquirePrewarmLock();
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
