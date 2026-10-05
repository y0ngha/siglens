import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';

/**
 * `cacheNonEmpty`가 빈 결과를 캐싱 우회용으로 throw할 때 쓰는 내부 sentinel.
 * 메시지 문자열 비교 대신 전용 클래스를 써서, 외부 라이브러리가 우연히 같은
 * 메시지로 throw해도 sentinel로 오인하지 않도록 `instanceof`로 분기한다.
 */
class EmptyResultError extends Error {}

/**
 * `staticSymbolCache`로 fetch를 정적화하되 **빈 배열 결과는 캐싱하지 않는다.**
 *
 * `unstable_cache`는 fetcher가 throw하면 set을 건너뛴다. 빈 결과일 때 fetcher 안에서
 * throw해 캐싱을 막고, 바깥에서 catch해 `[]`로 graceful degrade한다. fetcher의 다른
 * 예외도 같은 `[]`로 떨어진다(로그는 남긴다) — 호출부가 따로 `.catch`할 필요가 없다.
 *
 * 왜 필요한가: 빈 결과가 그대로 캐시되면 TTL 내내 "데이터 없음"이 고정된다.
 *   - 재무제표: FMP 일시 장애를 provider가 swallow해 `[]`를 resolve → 복구 후에도
 *     최대 24h all-empty 스냅샷(그 사이 잘못된 색인·표시).
 *   - 뉴스 카테고리 목록(`/news/[category]`): 기사가 적재되기 전 순간의 `[]`가 12h
 *     굳어, 다이제스트는 25건으로 생성됐는데 목록은 "불러오지 못했어요"인 화면이
 *     나왔다(2026-10-01 운영, `/news/articles`).
 *
 * 장애와 건강한 빈 상태를 구분해야 하면 `cacheNonEmptyOrNull`을 쓴다.
 *
 * 트레이드오프: 정말로 비어 있는 키는 매 요청 fetcher를 다시 부른다. 대신 일시적
 * 빈 상태가 캐시를 오염시키는 문제를 없앤다.
 *
 * 태그는 비어 있어도 페이지에 붙는다 — Next의 `unstable_cache`는 fetcher를 부르기
 * **전에** 태그를 렌더 스토어에 누적한다. 그래서 빈 렌더도 이후 `revalidateTag`로
 * 다시 생성된다.
 */
export async function cacheNonEmpty<T>(
    keyParts: readonly string[],
    symbol: string,
    fetcher: () => Promise<T[]>,
    extraTags: readonly string[],
    revalidateSeconds: number
): Promise<T[]> {
    return (
        (await cacheNonEmptyOrNull(
            keyParts,
            symbol,
            fetcher,
            extraTags,
            revalidateSeconds
        )) ?? []
    );
}

/**
 * `cacheNonEmpty`의 **실패 신호 버전**. 같은 캐시 규칙(빈 결과는 저장하지 않는다)을 쓰되,
 * 결과를 셋으로 구분해 돌려준다:
 *  - 행이 있음 → `T[]`
 *  - 정상적으로 **비어 있음** → `[]` (sentinel — 건강한 빈 상태)
 *  - 읽기가 **실패**함 → `null` (로그를 남기고 삼킨다)
 *
 * 호출부가 "건강한 빈 상태"와 "장애"를 다르게 다뤄야 할 때 쓴다 — 예: 장애일 때만 이 렌더의
 * revalidate를 낮추고(`shortenRevalidateForRuntimeDegrade`) 건강한 빈 상태는 라우트 기본
 * revalidate를 유지한다. 던지는 쪽(콜백 안)과 잡는 쪽(바깥)이 갈리는 구조는 그대로다.
 */
export async function cacheNonEmptyOrNull<T>(
    keyParts: readonly string[],
    symbol: string,
    fetcher: () => Promise<T[]>,
    extraTags: readonly string[],
    revalidateSeconds: number
): Promise<T[] | null> {
    try {
        return await staticSymbolCache(
            keyParts,
            symbol,
            async () => {
                const rows = await fetcher();
                if (rows.length === 0) {
                    throw new EmptyResultError();
                }
                return rows;
            },
            extraTags,
            revalidateSeconds
        );
    } catch (err) {
        // sentinel(의도적 빈 결과)은 무음. 그 외(staticSymbolCache/fetcher의
        // 예상치 못한 throw)는 로깅해 프로덕션 캐시 장애를 추적 가능하게 한다.
        if (err instanceof EmptyResultError) return [];
        console.error('[cacheNonEmpty] unexpected cache error:', err);
        return null;
    }
}
