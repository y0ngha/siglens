import { unstable_cache } from 'next/cache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { runWithRenderBudget } from '@/shared/lib/renderBudget';

/**
 * 모든 `staticSymbolCache` 키 앞에 붙는 버전 keyPart.
 *
 * 데이터 캐시는 배포를 넘어 공유되는 S3 prefix에 산다(CONVENTIONS "Server Data Cache Rules").
 * 그래서 키는 빌드마다 같아야 하고, 바꿀 때는 의도적으로 바꿔야 한다. 이 값이 그 두 가지를 맡는다:
 *  - 키의 고정 부분을 **명시적인 문자열**로 둔다. `unstable_cache` 키에는 콜백 텍스트도 들어가지만
 *    (아래 JSDoc), 그건 번들러 출력이라 코드로 고정할 수 없다 — 의미 있는 식별은 이 값과 keyParts가 한다.
 *  - **올리면 이 래퍼의 모든 엔트리가 한 번에 은퇴한다** — 래퍼 자체(예: 렌더 예산 래핑, 값 감싸기)의
 *    의미가 바뀔 때 쓴다. 호출부 하나의 반환 형태만 바뀌면 그 호출부의 keyPart에 `-vN`을 붙인다.
 */
export const STATIC_SYMBOL_CACHE_VERSION = 'ssc-v1';

/**
 * per-symbol 동적 호출(redis getOrSetCache / DB / FMP)을 Next data cache로 감싸 ISR
 * static generate가 no-store fetch에 막히지 않게 한다. 종목당 캐시이며 기본 revalidate=1h,
 * `symbol:${SYMBOL}` 태그로 on-demand 무효화를 지원한다.
 *
 * 전제: root layout cookies() 제거(축 0)가 선결돼야 효과가 있다 — PoC에서 layout이
 * 전 라우트를 dynamic으로 강제하면 unstable_cache 래핑도 무력했다(phase0-1 plan Task 1).
 *
 * keyParts는 호출 결과를 유일하게 식별해야 한다(symbol + 추가 인자 모두 포함). fetcher는
 * 인자 없는 closure로 넘긴다(키잉은 keyParts가 담당).
 *
 * **캐시 키는 keyParts만으로 정해진다 — 호출부의 closure는 키에 들어가지 않는다.**
 * Next의 `unstable_cache`는 키를 `cb.toString()` + keyParts로 만든다
 * (`unstable-cache.js`의 `fixedKey`). 예전처럼 호출부 closure를 그대로 넘기면 소스 텍스트가
 * 다른 호출부마다(`() => getProfile(symbol)` vs `() => provider.getProfile(upper)`) 엔트리가
 * 갈라져, 같은 keyParts를 쓰는 곳끼리 공유한다는 전제(예: `fundamental:profile`을
 * `getProfileResilient`와 `ProfileSection`이, 뉴스 목록 키를 news·overall 탭이 공유)가
 * 조용히 깨졌다 — cold render마다 같은 FMP/DB 읽기가 키 수만큼 반복됐다(2026-10 서버 성능
 * 감사 M4). 그래서 여기서 **고정된 래퍼**로 감싸 넘긴다. 대가로 **같은 keyParts는 어디서
 * 부르든 같은 데이터여야 한다** — 다른 데이터를 같은 키 접두사로 캐시하면 서로 덮는다.
 * 새 키를 만들 때 `rg "staticSymbolCache|cacheNonEmpty"`로 접두사 충돌을 확인할 것.
 *
 * **키 안정성은 호출부 책임이다**(데이터 캐시가 배포를 넘어 공유되므로 — CONVENTIONS
 * "Server Data Cache Rules"):
 *  (a) keyParts는 결과를 결정하는 입력만으로, 빌드와 무관하게 같은 문자열이 나오게 만든다
 *      (`process.env.GIT_SHA` 같은 빌드 값은 매 배포 cold를 의도할 때만).
 *  (b) fetcher의 **반환 형태나 의미**가 바뀌면 같은 PR에서 그 호출부 keyPart에 `-vN`을 붙이거나
 *      올린다(`'fundamental:profile'` → `'fundamental:profile-v2'`). 안 그러면 롤링 배포 중 옛/새
 *      빌드가 서로의 값을 읽는다.
 *  (c) 같은 데이터를 돌려주는 호출부끼리가 **아니면** keyParts를 공유하지 않는다 — 공유하면 서로의
 *      값을 덮어 읽는다. `rg "staticSymbolCache|cacheNonEmpty"`로 확인한다.
 * 래퍼 전체를 은퇴시킬 때는 {@link STATIC_SYMBOL_CACHE_VERSION}을 올린다.
 *
 * fetcher는 렌더 예산(`runWithRenderBudget`) 안에서 돈다 — 그 안의 FMP 호출은 짧은
 * timeout·재시도 1회로 실패해 페이지를 degrade하고 ISR 렌더를 붙잡지 않는다.
 *
 * @param symbol 캐시 스코핑 키 — 주식 티커(AAPL, TSLA 등)뿐 아니라 비티커 센티널(예:
 *   `__NEWS_GENERAL__`)도 허용된다. 뉴스 허브·카테고리 페이지는 이 파라미터를 sentinel로
 *   넘겨 `symbol:__NEWS_GENERAL__` 태그를 생성한다. 함수는 키 형식을 강제하지 않는다.
 *
 * extraTags: `symbol:${symbol}`(전체 무효화) 외에 그룹 무효화용 태그를 추가한다. 예: news는
 * `news:${symbol}`을 달아, fresh 뉴스 ingestion 후 news만 골라 revalidateTag할 수 있게 한다
 * (bars/peek/profile 캐시는 보존).
 *
 * revalidateSeconds: 기본값 SECONDS_PER_HOUR(1h) — 신선도 민감 페이지(예: `[symbol]/news`)
 * 전용. 신선도가 낮은 페이지(financials/congress 등 revalidate=86400)는 이 값을
 * SECONDS_PER_DAY 등 페이지 revalidate와 일치시켜야 한다. Next 16은 라우트의 effective
 * s-maxage를 렌더 중 읽힌 unstable_cache revalidate 중 최솟값으로 clamp하므로, 짧은 TTL을
 * 그대로 두면 페이지 선언(revalidate=86400)에 관계없이 1h마다 재생성된다.
 */
export function staticSymbolCache<R>(
    keyParts: readonly string[],
    symbol: string,
    fetcher: () => Promise<R>,
    extraTags: readonly string[] = [],
    revalidateSeconds: number = SECONDS_PER_HOUR
): Promise<R> {
    // 래퍼 텍스트가 모든 호출부에서 같아야 키가 keyParts로만 정해진다(위 JSDoc).
    // `fetcher`를 직접 넘기거나 이 화살표를 호출부별로 바꾸지 말 것.
    return unstable_cache(
        () => runWithRenderBudget(fetcher),
        [STATIC_SYMBOL_CACHE_VERSION, ...keyParts],
        {
            revalidate: revalidateSeconds,
            tags: [`symbol:${symbol}`, ...extraTags],
        }
    )();
}
