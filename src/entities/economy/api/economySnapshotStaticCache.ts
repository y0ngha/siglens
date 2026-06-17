import 'server-only';
import { unstable_cache } from 'next/cache';
import type { EconomySnapshot } from '@y0ngha/siglens-core';

import { SECONDS_PER_DAY } from '@/shared/config/time';

import {
    ECONOMY_CONFIG_FINGERPRINT,
    getEconomySnapshot,
} from './economySnapshotCache';

/**
 * ISR static-safe wrapper — `@upstash/redis` HTTP는 no-store fetch라 static generate가
 * `DYNAMIC_SERVER_USAGE`를 throw한다. `unstable_cache`로 감싸 HTML에 박고 정적화한다.
 *
 * revalidate=86400(24h, `SECONDS_PER_DAY`)으로 페이지 리터럴과 단일 TTL 공유.
 * tag=`economy:snapshot`으로 on-demand `revalidateTag` 가능(향후 즉시 반영용).
 */
export function getEconomySnapshotStatic(): Promise<EconomySnapshot> {
    return unstable_cache(
        () => getEconomySnapshot(),
        ['economy-snapshot-static', ECONOMY_CONFIG_FINGERPRINT],
        { revalidate: SECONDS_PER_DAY, tags: ['economy:snapshot'] }
    )();
}
