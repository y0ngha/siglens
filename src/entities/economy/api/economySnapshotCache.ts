import 'server-only';
import { cache } from 'react';

import type { EconomyProvider } from '@/shared/api/economy/EconomyProvider';
import { getEconomyProvider } from '@/shared/api/economy/getEconomyProvider';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { ECONOMY_INDICATORS } from '@/shared/config/economyIndicators';
import { MS_PER_DAY, SECONDS_PER_DAY } from '@/shared/config/time';
import type {
    EconomicIndicatorSeries,
    EconomySnapshot,
} from '@y0ngha/siglens-core';

import { isEmptyEconomySnapshot } from '../lib/economyCompleteness';

/**
 * 레지스트리 fingerprint — 지표 목록이 바뀌면 캐시 키도 자동 무효화된다.
 * static/runtime 캐시 양 계층이 import해 동일 fingerprint를 공유(드리프트 방지).
 */
export const ECONOMY_CONFIG_FINGERPRINT = createCacheConfigFingerprint(
    JSON.stringify({ indicators: ECONOMY_INDICATORS.map(i => i.name) })
);
const CACHE_KEY = `economy:snapshot:${ECONOMY_CONFIG_FINGERPRINT}`;

/** 캘린더 윈도(다가오는 ~2주) 일수 — 매직넘버 상수화(MISTAKES §15). */
const CALENDAR_WINDOW_DAYS = 14;

/** 'YYYY-MM-DD' prefix 길이 — `isoDate` slice 끝(매직넘버 상수화). */
const ISO_DATE_LENGTH = 10;

/** core EconomicIndicatorSeries의 빈 placeholder — Provider 실패 시 fallback. */
function emptyIndicator(name: string): EconomicIndicatorSeries {
    return { name, latest: null, previous: null, trend: [] };
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * 레지스트리 9개 지표 + treasury + calendar를 병렬 fetch해 단일 스냅샷으로 조립.
 *
 * 축별 graceful: provider 실패 시 그 축만 비고(`emptyIndicator` / `null` / `[]`)
 * 다른 축은 살아남는다. 전 축 실패 → 빈 스냅샷 → `shouldCache` 가드가 캐시 차단.
 *
 * 동시 호출 수 = 11(9 indicators + treasury + calendar). 결과는 24h Redis 캐시로
 * 묶이므로 실 호출은 페이지 cold-gen 시점에만 발생한다 — 페이지당 11회/24h 수준.
 *
 * MISTAKES §0.8 검토: 본 레포에는 `FETCH_CONCURRENCY` 상수 자체가 존재하지 않는다.
 * 가장 가까운 동시성 정책은 peer page들의 Promise.all 패턴이며, market(`getMarketSummary`
 * — 지수 N + 섹터 ETF M, 통상 11+개), financials(6 endpoint)이 모두 동일 패턴으로
 * production에서 안정적으로 운영 중이다. FMP starter 플랜 기준 분당 300 req(초당 5)
 * 한도 대비 11 calls / 24h cold-gen은 무시 가능 수준 — `fetchInChunks` 분할 이득이
 * 없다. 향후 지표 수가 50+로 늘거나 페이지가 hot-path가 되면 그때 재검토한다.
 */
async function fetchSnapshot(
    provider: EconomyProvider
): Promise<EconomySnapshot> {
    const today = new Date();
    const to = new Date(today.getTime() + CALENDAR_WINDOW_DAYS * MS_PER_DAY);

    const [indicators, treasury, calendar] = await Promise.all([
        Promise.all(
            ECONOMY_INDICATORS.map(meta =>
                provider
                    .getIndicator(meta.name)
                    .catch(() => emptyIndicator(meta.name))
            )
        ),
        provider.getTreasury().catch(() => null),
        provider.getCalendar(isoDate(today), isoDate(to)).catch(() => []),
    ]);

    return { indicators, treasury, calendar };
}

/**
 * React.cache(요청 dedup) + Redis 2계층 캐시.
 *
 * `shouldCache`로 빈 스냅샷(`isEmptyEconomySnapshot`)을 캐시에 굳히지 않는다 —
 * transient 장애가 24h TTL 동안 빈 결과를 고정하는 사고 차단(financials `cacheNonEmpty`
 * 동등 패턴).
 */
export const getEconomySnapshot = cache(
    (): Promise<EconomySnapshot> =>
        getOrSetCache(
            CACHE_KEY,
            SECONDS_PER_DAY,
            () => fetchSnapshot(getEconomyProvider()),
            s => !isEmptyEconomySnapshot(s)
        )
);
