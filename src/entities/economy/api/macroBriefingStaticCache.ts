import 'server-only';
import {
    peekMacroBriefingCache,
    type EconomySnapshot,
    type MacroBriefingResponse,
} from '@y0ngha/siglens-core';

import { SECONDS_PER_DAY } from '@/shared/config/time';
import { readHubSsrSeed } from '@/shared/cache/hubSsrSeed';
import { cacheNonNull } from '@/shared/cache/cacheNonNull';

/** 프리웜이 쓰고 이 모듈이 읽는 SSR seed의 키. 거시 브리핑은 시장 구분이 없어 하나다. */
export const MACRO_BRIEFING_SEED_SURFACE = 'macro-briefing';

/**
 * `peekMacroBriefingStatic`의 캐시 태그. 무효화하는 쪽(허브 프리웜 등)은 반드시 이 상수를
 * 써야 한다 — 따로 철자하면 한쪽만 바뀌는 순간 무효화가 빗나가 ISR이 stale하게 남는다.
 */
export const MACRO_BRIEFING_CACHE_TAG = 'economy:briefing';

/**
 * /economy SSR seed — 캐시된 macro briefing을 read-only로 surface한다.
 *
 * `dateHour`는 외부(`page.tsx`)에서 계산해 `unstable_cache` 키 granularity 용도로
 * 전달한다. core의 `peekMacroBriefingCache`도 내부에서 자체 dateHour 버킷을 다시
 * 계산하므로 함수 인자로는 snapshot만 넘긴다(키 버킷과 read 키는 같은 시간으로 정렬됨).
 * 캐시 miss → `null` 반환 → 클라가 submit으로 fallback.
 * `unstable_cache`로 감싸 ISR 정적 generate 시 DSU(`DYNAMIC_SERVER_USAGE`)를 피한다.
 *
 * 키 prefix `economy-briefing-peek-static`는 시간 단위(`dateHour`)로 버킷팅된다.
 * `revalidate=SECONDS_PER_DAY`(24h)로 설정해 페이지 revalidate와 TTL을 일치시킨다.
 * Next 16은 라우트의 effective s-maxage를 렌더 중 읽힌 unstable_cache revalidate의
 * 최솟값으로 clamp하므로, 이전의 1h TTL은 페이지 선언(revalidate=86400)에 관계없이
 * 매 시간 ISR 재생성을 유발했다(24× 초과 ISR Writes + Fast Origin Transfer).
 * `dateHour` 키는 여전히 regen 경계에서 브리핑 seed를 새 시간 버킷으로 전환하나,
 * TTL 자체는 페이지 ISR 주기(24h)에 맞춰 clamp 원인을 제거한다.
 */
export function peekMacroBriefingStatic(
    snapshot: EconomySnapshot,
    dateHour: string
): Promise<MacroBriefingResponse | null> {
    // `cacheNonNull` — miss(`null`)는 캐시하지 않고 SSR miss로 표시한다. 예전에는 그
    // `null`이 24h 굳어, 방문자가 곧 브리핑을 생성해도 페이지는 하루 내내 비어 있었다.
    return cacheNonNull(
        async () =>
            // 이유는 `briefingStaticCache`와 같다 — 입력 파생 키라 프리웜이 쓴 값을
            // 나중에 같은 키로 읽지 못한다. SSR seed가 그 공백을 메운다.
            (await peekMacroBriefingCache(snapshot)) ??
            (await readHubSsrSeed<MacroBriefingResponse>(
                MACRO_BRIEFING_SEED_SURFACE
            )),
        ['economy-briefing-peek-static', dateHour],
        { revalidate: SECONDS_PER_DAY, tags: [MACRO_BRIEFING_CACHE_TAG] }
    );
}
