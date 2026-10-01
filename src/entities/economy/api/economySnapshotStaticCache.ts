import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { EconomySnapshot } from '@y0ngha/siglens-core';

import { SECONDS_PER_DAY } from '@/shared/config/time';

import { markSsrMiss } from '@/shared/cache/ssrMissMarker';

import {
    ECONOMY_CONFIG_FINGERPRINT,
    getEconomySnapshot,
} from './economySnapshotCache';
import { shouldCacheEconomySnapshot } from '../lib/economyCompleteness';

/**
 * `economy:snapshot` — 정적 스냅샷 캐시 태그. 무효화하는 쪽(허브 프리웜)은 이 상수를 쓴다.
 */
export const ECONOMY_SNAPSHOT_CACHE_TAG = 'economy:snapshot';

/** quorum 미달 스냅샷을 캐싱 우회용으로 throw할 때 쓰는 내부 sentinel. */
class IncompleteSnapshotError extends Error {
    constructor(readonly snapshot: EconomySnapshot) {
        super('incomplete economy snapshot');
    }
}

/**
 * ISR static-safe wrapper — `@upstash/redis` HTTP는 no-store fetch라 static generate가
 * `DYNAMIC_SERVER_USAGE`를 throw한다. `unstable_cache`로 감싸 HTML에 박고 정적화한다.
 *
 * revalidate=86400(24h, `SECONDS_PER_DAY`)으로 페이지 리터럴과 단일 TTL 공유.
 * tag=`economy:snapshot`(`ECONOMY_SNAPSHOT_CACHE_TAG`) — quorum 미달로 렌더된 페이지는 허브
 * 프리웜이 완전한 스냅샷을 확인한 뒤 이 태그로 다시 생성한다(`markSsrMiss`).
 *
 * 단일 요청 내 `generateMetadata` + `EconomyContent`가 같은 페이지에서 두 번 호출하므로
 * `React.cache`로 감싸 요청 내 dedup한다 — `unstable_cache`는 cross-request 정적화는
 * 처리하지만 in-request memoize는 하지 않는다.
 *
 * `/market`의 `getMarketSummaryStatic`은 React.cache 래핑 없이 매 호출마다 `unstable_cache`
 * wrapper를 생성한다 — market 페이지는 `generateMetadata`가 summary를 읽지 않아 한 요청 내
 * 1회 호출에 그치기 때문이다. 본 함수는 metadata와 본문이 같은 snapshot을 보는 degrade
 * 판정 동기화 요건 때문에 2회 호출되므로 React.cache 추가가 필요하다.
 */
export const getEconomySnapshotStatic = cache(
    async (): Promise<EconomySnapshot> => {
        try {
            return await unstable_cache(
                async () => {
                    const snapshot = await getEconomySnapshot();
                    // Redis 층(`getEconomySnapshot`)과 **같은 quorum**으로 거른다. 예전에는
                    // Redis만 걸러서, 소스가 전부 실패한 빈 스냅샷이 이 층에는 24h 그대로
                    // 굳었다 — `EconomyDegraded` + noindex가 하루 내내(2026-10-01 허브 감사 B1).
                    if (!shouldCacheEconomySnapshot(snapshot)) {
                        throw new IncompleteSnapshotError(snapshot);
                    }
                    return snapshot;
                },
                ['economy-snapshot-static', ECONOMY_CONFIG_FINGERPRINT],
                {
                    revalidate: SECONDS_PER_DAY,
                    tags: [ECONOMY_SNAPSHOT_CACHE_TAG],
                }
            )();
        } catch (error) {
            if (!(error instanceof IncompleteSnapshotError)) throw error;
            // 렌더는 받은 그대로 한다(최소 데이터라도 있으면 noindex로 렌더, 완전히
            // 비면 degrade — 판정은 호출부). 다만 그 HTML은 페이지 ISR(24h) 동안
            // 남으므로, 허브 프리웜이 완전한 스냅샷을 확인하면 태그를 털도록 표시한다.
            await markSsrMiss(ECONOMY_SNAPSHOT_CACHE_TAG);
            return error.snapshot;
        }
    }
);
