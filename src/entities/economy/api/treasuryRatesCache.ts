import 'server-only';
import type { TreasuryRateSnapshot } from '@y0ngha/siglens-core';

import type { TreasuryReading } from '@/shared/api/economy/EconomyProvider';
import { getEconomyProvider } from '@/shared/api/economy/getEconomyProvider';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/shared/config/time';

import { etDateOf } from '../lib/calendarWindow';

/**
 * 국채 금리 단독 캐시 TTL(3시간). 공급자는 재무부 공식 CSV와 FMP `treasury-rates` 중 기준일이 더 최근인 쪽을
 * 낸다(`OfficialTreasuryEconomyProvider`, 출처별 게시 시점은 `treasuryGovClient.ts`). 새 행은 하루 한 번
 * 붙으므로 3시간이면 공표 뒤 늦어도 몇 시간 안에 새 값이 나가고, 외부 호출은 하루 몇 번에 그친다.
 */
export const TREASURY_CACHE_TTL_SECONDS = 3 * SECONDS_PER_HOUR;
/**
 * 재무부를 못 읽어 FMP로 물러난 값의 TTL(15분). 3시간 동안 늦은 값으로 굳지는 않게, 재무부 장애가 이어지는
 * 동안 호출마다 두 출처를 다시 읽지도 않게 짧게 둔다.
 */
export const TREASURY_FALLBACK_TTL_SECONDS = 15 * SECONDS_PER_MINUTE;

/** 국채 금리 + 이 값을 공급자에서 읽은 시각. */
export interface FreshTreasuryRates {
    treasury: TreasuryRateSnapshot;
    /** 공급자에서 읽은 시각(ISO). `treasury.date`(금리 기준일)와 다르다. */
    fetchedAt: string;
    /** 값을 낸 출처. 출처를 알리지 않는 공급자(FMP 단독·E2E Fake)는 `fmp`. */
    source: TreasuryReading['source'];
    /** 재무부 읽기가 값을 냈는가. `false`(FMP로 물러난 값)는 캐시하지 않는다. */
    officialAvailable: boolean;
}

/** 캐시 키 — ET 날짜를 넣어 날짜가 바뀌면 전날 값을 절대 다시 쓰지 않는다. v2: `source` 필드 추가. */
export function buildTreasuryCacheKey(now: Date): string {
    return `economy:treasury:v2:${etDateOf(now)}`;
}

/** 출처가 붙은 값. `getTreasuryReading`이 없는 공급자는 `getTreasury` 값을 FMP 출처로 본다. */
async function readTreasury(): Promise<TreasuryReading | null> {
    const provider = getEconomyProvider();
    if (provider.getTreasuryReading) return provider.getTreasuryReading();
    const treasury = await provider.getTreasury();
    return treasury === null
        ? null
        : { treasury, source: 'fmp', officialAvailable: true };
}

/**
 * 경제 스냅샷과 **따로** 읽는 국채 금리(짧은 TTL, ET 날짜 키).
 *
 * 스냅샷(`getEconomySnapshotStatic`)은 `unstable_cache` 24h 위에 Redis 24h가 겹쳐 있어
 * 최대 약 48h까지 묵는다. 월간 지표에는 상관없지만 일간 공표인 10년물은 이틀 전 값이
 * "현재 금리"로 나갔다(2026-10-22 실측: 10/21 공표가 있는데 10/19 값). AI 에이전트의
 * `get_economy`는 route handler라 정적화가 필요 없으므로 Redis만 거쳐 직접 읽는다.
 *
 * 실패는 `null`로 내려 호출부가 스냅샷 값으로 물러나게 한다. `null` 결과는 캐시하지 않는다. 재무부를 못 읽어
 * FMP로 물러난 결과는 {@link TREASURY_FALLBACK_TTL_SECONDS}만 캐시한다(일시 장애가 3시간 동안 늦은 값으로
 * 굳지 않게, 장애 중 호출마다 다시 읽지도 않게).
 */
export async function getFreshTreasuryRates(
    now: Date = new Date()
): Promise<FreshTreasuryRates | null> {
    try {
        return await getOrSetCache<FreshTreasuryRates | null>(
            buildTreasuryCacheKey(now),
            value =>
                value?.officialAvailable === false
                    ? TREASURY_FALLBACK_TTL_SECONDS
                    : TREASURY_CACHE_TTL_SECONDS,
            async () => {
                const reading = await readTreasury();
                return reading === null
                    ? null
                    : { ...reading, fetchedAt: new Date().toISOString() };
            },
            value => value !== null
        );
    } catch (error) {
        // Log the name only (no payload), then degrade to the snapshot's treasury in get_economy.
        // `logToolDegrade`(app 레이어 도구 헬퍼)는 entities에서 import할 수 없어 같은 규칙(오류 이름만)을 직접 쓴다.
        console.warn('[economy] treasury fresh read failed', {
            error: error instanceof Error ? error.name : typeof error,
        });
        return null;
    }
}
