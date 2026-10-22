import 'server-only';
import type { TreasuryRateSnapshot } from '@y0ngha/siglens-core';

import { getEconomyProvider } from '@/shared/api/economy/getEconomyProvider';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

import { etDateOf } from '../lib/calendarWindow';

/**
 * 국채 금리 단독 캐시 TTL(3시간). FMP `treasury-rates`는 하루 한 번 새 행이 붙으므로
 * 3시간이면 공표 뒤 늦어도 몇 시간 안에 새 값이 나가고, FMP 호출은 하루 몇 번에 그친다.
 */
export const TREASURY_CACHE_TTL_SECONDS = 3 * SECONDS_PER_HOUR;

/** 국채 금리 + 이 값을 공급자에서 읽은 시각. */
export interface FreshTreasuryRates {
    treasury: TreasuryRateSnapshot;
    /** 공급자에서 읽은 시각(ISO). `treasury.date`(금리 기준일)와 다르다. */
    fetchedAt: string;
}

/** 캐시 키 — ET 날짜를 넣어 날짜가 바뀌면 전날 값을 절대 다시 쓰지 않는다. */
export function buildTreasuryCacheKey(now: Date): string {
    return `economy:treasury:${etDateOf(now)}`;
}

/**
 * 경제 스냅샷과 **따로** 읽는 국채 금리(짧은 TTL, ET 날짜 키).
 *
 * 스냅샷(`getEconomySnapshotStatic`)은 `unstable_cache` 24h 위에 Redis 24h가 겹쳐 있어
 * 최대 약 48h까지 묵는다. 월간 지표에는 상관없지만 일간 공표인 10년물은 이틀 전 값이
 * "현재 금리"로 나갔다(2026-10-22 실측: 10/21 공표가 있는데 10/19 값). AI 에이전트의
 * `get_economy`는 route handler라 정적화가 필요 없으므로 Redis만 거쳐 직접 읽는다.
 *
 * 실패는 `null`로 내려 호출부가 스냅샷 값으로 물러나게 한다. `null` 결과는 캐시하지 않는다
 * (일시 장애가 3시간 동안 굳지 않게).
 */
export async function getFreshTreasuryRates(
    now: Date = new Date()
): Promise<FreshTreasuryRates | null> {
    try {
        return await getOrSetCache<FreshTreasuryRates | null>(
            buildTreasuryCacheKey(now),
            TREASURY_CACHE_TTL_SECONDS,
            async () => {
                const treasury = await getEconomyProvider().getTreasury();
                return treasury === null
                    ? null
                    : { treasury, fetchedAt: new Date().toISOString() };
            },
            value => value !== null
        );
    } catch (error) {
        // Log the name only (no payload), then degrade to the snapshot's treasury in get_economy.
        console.warn('[economy] treasury fresh read failed', {
            error: error instanceof Error ? error.name : typeof error,
        });
        return null;
    }
}
