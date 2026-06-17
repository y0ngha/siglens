import 'server-only';
import { unstable_cache } from 'next/cache';
import {
    peekMacroBriefingCache,
    type EconomySnapshot,
    type MacroBriefingResponse,
} from '@y0ngha/siglens-core';

import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * /economy SSR seed — 캐시된 macro briefing을 read-only로 surface한다.
 *
 * `peekMacroBriefingCache(snapshot)`는 내부에서 dateHour 버킷을 계산하므로 외부에서
 * 따로 전달하지 않는다. 캐시 miss → `null` 반환 → 클라가 submit으로 fallback.
 * `unstable_cache`로 감싸 ISR 정적 generate 시 DSU(`DYNAMIC_SERVER_USAGE`)를 피한다.
 *
 * 키 prefix `economy-briefing-peek-static`는 시간 단위(`dateHour`)로 버킷팅되며,
 * 그에 맞춰 `revalidate=SECONDS_PER_HOUR`로 두어 키 granularity와 TTL을 일치시킨다
 * (시장 briefing peek와 같은 패턴). 페이지 `revalidate=86400`(24h)와는 의도적으로
 * 분리된 축 — briefing은 시간 단위 신선도가 필요하지만 지표/캘린더는 일 단위로 충분.
 */
export function peekMacroBriefingStatic(
    snapshot: EconomySnapshot,
    dateHour: string
): Promise<MacroBriefingResponse | null> {
    return unstable_cache(
        () => peekMacroBriefingCache(snapshot),
        ['economy-briefing-peek-static', dateHour],
        { revalidate: SECONDS_PER_HOUR, tags: ['economy:briefing'] }
    )();
}
