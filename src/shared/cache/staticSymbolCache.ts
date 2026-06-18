import { unstable_cache } from 'next/cache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

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
    return unstable_cache(fetcher, [...keyParts], {
        revalidate: revalidateSeconds,
        tags: [`symbol:${symbol}`, ...extraTags],
    })();
}
