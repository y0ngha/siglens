import 'server-only';
import { unstable_cache } from 'next/cache';
import { markSsrMiss } from './ssrMissMarker';

/** `null` 결과를 캐싱 우회용으로 throw할 때 쓰는 내부 sentinel(`cacheNonEmpty`와 같은 방식). */
class NullResultError extends Error {}

interface CacheNonNullOptions {
    readonly revalidate: number;
    /** `unstable_cache` 태그. 첫 번째 태그가 SSR miss 표시의 키가 된다. */
    readonly tags: readonly [string, ...string[]];
}

/**
 * `unstable_cache`로 감싸되 **`null`은 캐시하지 않고**, `null`로 렌더했다는 사실을
 * 표시해 둔다. `cacheNonEmpty`의 단일 값 버전이다.
 *
 * 허브의 SSR peek(거시·시장 브리핑, 뉴스 다이제스트)은 캐시 miss를 `null`로 돌려주고
 * 페이지는 플레이스홀더를 그린다. 예전에는 그 `null`이 12~24시간 그대로 캐시됐다 —
 * 방문자가 곧 값을 생성해도 페이지는 TTL 끝까지 "생성 중"이었다(2026-10-01 허브
 * 감사 B3). 던지면 `unstable_cache`가 저장을 건너뛰고, 태그는 콜백 **전에** 페이지에
 * 붙으므로(`cacheNonEmpty` JSDoc) 이후 무효화로 다시 렌더된다. 그 무효화를 언제 할지
 * 알려 주는 게 `markSsrMiss`다 — 허브 프리웜이 값이 있음을 확인하면 소비하고 턴다.
 *
 * fetcher의 다른 예외도 `null`로 degrade하고 같은 표시를 남긴다 — 그 렌더도 결국
 * 플레이스홀더다.
 */
export async function cacheNonNull<T>(
    fetcher: () => Promise<T | null>,
    keyParts: readonly string[],
    { revalidate, tags }: CacheNonNullOptions
): Promise<T | null> {
    try {
        return await unstable_cache(
            async () => {
                const value = await fetcher();
                if (value === null) throw new NullResultError();
                return value;
            },
            [...keyParts],
            { revalidate, tags: [...tags] }
        )();
    } catch (error) {
        if (!(error instanceof NullResultError)) {
            console.error('[cacheNonNull] unexpected cache error:', error);
        }
        await markSsrMiss(tags[0]);
        return null;
    }
}
