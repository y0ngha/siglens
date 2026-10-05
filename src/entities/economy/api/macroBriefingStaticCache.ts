import 'server-only';
import {
    peekMacroBriefingCacheEntry,
    type EconomySnapshot,
    type MacroBriefingCacheEntry,
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
 * 저장된 seed가 `{ briefing, generatedAt }` 봉투인지 판별한다.
 *
 * 이 변경 이전의 프리웜은 `MacroBriefingResponse`를 그대로 seed에 썼다. TTL(12h) 동안
 * 그 옛 형태가 남아 있으므로, 봉투가 아니면 생성 시각 없는 본문으로 읽는다 — 그대로
 * 봉투로 취급하면 `entry.briefing`이 undefined가 되어 페이지가 깨진다.
 */
function isSeedEnvelope(
    value: MacroBriefingCacheEntry | MacroBriefingResponse
): value is MacroBriefingCacheEntry {
    return 'briefing' in value && value.briefing != null;
}

async function readMacroBriefingSeed(): Promise<MacroBriefingCacheEntry | null> {
    const seed = await readHubSsrSeed<
        MacroBriefingCacheEntry | MacroBriefingResponse
    >(MACRO_BRIEFING_SEED_SURFACE);
    if (seed === null) return null;
    if (isSeedEnvelope(seed)) {
        return {
            briefing: seed.briefing,
            generatedAt:
                typeof seed.generatedAt === 'string' ? seed.generatedAt : null,
        };
    }
    return { briefing: seed, generatedAt: null };
}

/**
 * /economy SSR seed — 캐시된 macro briefing을 read-only로 surface한다. 본문과 함께
 * 생성 시각(`generatedAt`)을 돌려줘 화면이 seed로 그려진 브리핑에도 "생성 시각"을
 * 보여 줄 수 있게 한다(`null`은 시각을 모르는 옛 항목).
 *
 * `dayKey`(UTC 달력일, `macroBriefingDayKey`)는 외부(`page.tsx`)에서 계산해
 * `unstable_cache` 키 granularity 용도로 전달한다. core의 캐시 키도 같은 UTC 날짜로
 * 버킷팅되므로(core 2026-10-05부터 — 이전에는 시간 단위) 키 버킷과 read 키의 경계가
 * 맞는다. 함수 인자로는 snapshot만 넘긴다.
 * 캐시 miss → `null` 반환 → 클라가 submit으로 fallback.
 * `unstable_cache`로 감싸 ISR 정적 generate 시 DSU(`DYNAMIC_SERVER_USAGE`)를 피한다.
 *
 * `revalidate=SECONDS_PER_DAY`(24h)로 설정해 페이지 revalidate와 TTL을 일치시킨다.
 * Next 16은 라우트의 effective s-maxage를 렌더 중 읽힌 unstable_cache revalidate의
 * 최솟값으로 clamp하므로, 이전의 1h TTL은 페이지 선언(revalidate=86400)에 관계없이
 * 매 시간 ISR 재생성을 유발했다(24× 초과 ISR Writes + Fast Origin Transfer).
 * 날짜 키는 UTC 자정의 regen 경계에서 브리핑 seed를 새 버킷으로 전환한다.
 */
export function peekMacroBriefingStatic(
    snapshot: EconomySnapshot,
    dayKey: string
): Promise<MacroBriefingCacheEntry | null> {
    // `cacheNonNull` — miss(`null`)는 캐시하지 않고 SSR miss로 표시한다. 예전에는 그
    // `null`이 24h 굳어, 방문자가 곧 브리핑을 생성해도 페이지는 하루 내내 비어 있었다.
    return cacheNonNull(
        async () =>
            // 이유는 `briefingStaticCache`와 같다 — 입력 파생 키라 프리웜이 쓴 값을
            // 나중에 같은 키로 읽지 못한다. SSR seed가 그 공백을 메운다.
            (await peekMacroBriefingCacheEntry(snapshot)) ??
            (await readMacroBriefingSeed()),
        ['economy-briefing-peek-static', dayKey],
        { revalidate: SECONDS_PER_DAY, tags: [MACRO_BRIEFING_CACHE_TAG] }
    );
}
