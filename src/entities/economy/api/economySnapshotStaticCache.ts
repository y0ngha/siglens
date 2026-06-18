import 'server-only';
import { cache } from 'react';
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
    (): Promise<EconomySnapshot> =>
        unstable_cache(
            () => getEconomySnapshot(),
            ['economy-snapshot-static', ECONOMY_CONFIG_FINGERPRINT],
            { revalidate: SECONDS_PER_DAY, tags: ['economy:snapshot'] }
        )()
);
