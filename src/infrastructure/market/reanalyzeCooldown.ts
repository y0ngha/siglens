'use server';

import { Redis } from '@upstash/redis';
import type { Timeframe } from '@/domain/types';

/**
 * 재분석 쿨다운 정책
 *
 * 사용자가 force=true로 재분석을 트리거할 때, 동일 심볼·타임프레임에 대해
 * 5분 이내 재호출을 차단한다. Redis(Upstash) PTTL을 기반으로 분산 환경에서도
 * 동일하게 동작하도록 한다.
 *
 * Redis가 구성되지 않은 환경(개발 등)에서는 클라이언트 측 모듈 스코프 Map이
 * 세션 범위에서 동일 정책을 강제하므로, 서버는 항상 ok로 응답한다.
 */

const REANALYZE_COOLDOWN_SEC = 5 * 60;
const REANALYZE_COOLDOWN_MS = REANALYZE_COOLDOWN_SEC * 1000;

type AcquireReanalyzeCooldownResult =
    | { ok: true }
    | { ok: false; remainingMs: number };

function buildKey(symbol: string, timeframe: Timeframe): string {
    return `analysis:cooldown:${symbol}:${timeframe}`;
}

function getRedis(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    return new Redis({ url, token });
}

/**
 * 쿨다운 키를 원자적으로 점유한다.
 *  - 키가 이미 존재하면 PTTL을 읽어 잔여 ms를 반환한다.
 *  - 키가 없으면 TTL을 설정하고 ok를 반환한다.
 *
 * NX 옵션으로 set하여 read-then-write 경합을 방지한다.
 */
export async function tryAcquireReanalyzeCooldown(
    symbol: string,
    timeframe: Timeframe
): Promise<AcquireReanalyzeCooldownResult> {
    const redis = getRedis();
    if (redis === null) return { ok: true };

    const key = buildKey(symbol, timeframe);

    try {
        const acquired = await redis.set(key, '1', {
            ex: REANALYZE_COOLDOWN_SEC,
            nx: true,
        });
        if (acquired === 'OK') return { ok: true };

        const pttl = await redis.pttl(key);
        const remainingMs = pttl > 0 ? pttl : REANALYZE_COOLDOWN_MS;
        return { ok: false, remainingMs };
    } catch (error) {
        // Redis 오류 시 사용자가 분석 자체를 못 하는 일이 없도록 통과시킨다.
        console.error('[ReanalyzeCooldown] acquire 실패:', error);
        return { ok: true };
    }
}

/**
 * 점유한 쿨다운을 즉시 해제한다.
 * 분석 실행이 실패하여 사용자에게 결과를 주지 못한 경우,
 * 다시 재분석을 시도할 수 있도록 키를 삭제한다.
 */
export async function releaseReanalyzeCooldown(
    symbol: string,
    timeframe: Timeframe
): Promise<void> {
    const redis = getRedis();
    if (redis === null) return;
    try {
        await redis.del(buildKey(symbol, timeframe));
    } catch (error) {
        console.error('[ReanalyzeCooldown] release 실패:', error);
    }
}

/**
 * 잔여 쿨다운(ms)을 조회한다. 키가 없으면 0.
 * 마운트 시점에 클라이언트 상태를 서버 진실값으로 동기화하기 위해 사용한다.
 */
export async function getReanalyzeCooldownMs(
    symbol: string,
    timeframe: Timeframe
): Promise<number> {
    const redis = getRedis();
    if (redis === null) return 0;

    try {
        const pttl = await redis.pttl(buildKey(symbol, timeframe));
        return pttl > 0 ? pttl : 0;
    } catch (error) {
        console.error('[ReanalyzeCooldown] pttl 조회 실패:', error);
        return 0;
    }
}
