import { getOrSetCache } from '@/shared/cache/getOrSetCache';

/** 에러 처리 전략 — 'empty': 로깅 후 [] 반환, 'rethrow': 에러 전파 */
type CachedListOnError = 'empty' | 'rethrow';

/**
 * opts 타입 — `cachedListWithLimit` 선택적 파라미터.
 */
interface CachedListOpts {
    onError?: CachedListOnError;
    logPrefix?: string;
}

/**
 * 리스트형 FMP 응답의 공통 패턴을 추출한 헬퍼:
 * `getOrSetCache(key, ttl, fetcher).then(r => r.slice(0, max)).catch(...)`.
 *
 * - `onError: 'empty'`  — inner throw 시 로깅 후 `[]` 반환 (financials 패턴).
 * - `onError: 'rethrow'` — inner throw 시 그대로 전파 (congress 패턴).
 *   "throw = 인프라 장애" vs "[] = 0건(정상)"을 상위 호출자가 구분해야 할 때 사용.
 *
 * 캐시 키·TTL·슬라이스 동작은 호출 측이 결정한다. 이 함수는
 * `getOrSetCache → slice → catch` 3단 조합만 캡슐화한다.
 *
 * @param key      Redis 캐시 키 (호출자가 완성된 키를 전달)
 * @param ttl      캐시 TTL(초)
 * @param max      반환 상한 — getOrSetCache 결과를 slice(0, max)로 잘라 반환한다.
 *                 cold fetch 시 inner 호출 상한은 caller의 `fetcher` 클로저에 바인딩되며,
 *                 이 함수는 캐시된 전체 목록에서 slice만 적용한다.
 * @param fetcher  cold 캐시 시 데이터를 가져올 async fetcher
 * @param opts.onError   에러 처리 전략 (기본값: 'empty')
 * @param opts.logPrefix console.error 앞에 붙는 접두사 (onError='empty'일 때만 사용)
 */
export function cachedListWithLimit<T>(
    key: string,
    ttl: number,
    max: number,
    fetcher: () => Promise<T[]>,
    opts: CachedListOpts = {}
): Promise<T[]> {
    const { onError = 'empty', logPrefix = '' } = opts;

    const base = getOrSetCache(key, ttl, fetcher).then(rows =>
        rows.slice(0, max)
    );

    if (onError === 'rethrow') {
        // congress 패턴: 에러를 그대로 전파해 호출자가 처리하게 한다.
        return base;
    }

    // financials 패턴: 에러 로깅 후 빈 배열 반환. 장애 결과는 캐시되지 않는다
    // (getOrSetCache는 fetcher가 throw하면 set을 건너뜀).
    return base.catch(error => {
        console.error(logPrefix, error);
        return [] as T[];
    });
}
