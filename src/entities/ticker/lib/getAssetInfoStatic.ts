import { unstable_cache } from 'next/cache';
import type { AssetInfo } from '@/shared/lib/types';
import { getAssetInfoAction } from '../actions/getAssetInfoAction';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * ISR static-safe asset-info fetch. `getAssetInfoAction`(='use server' → getAssetInfo:
 * cache → DB → FMP)을 Next data cache로 감싸 static generate가 내부 redis/DB no-store
 * fetch에 막히지 않게 한다. 종목당 캐시이며 revalidate=1h로 주기 갱신한다.
 *
 * 왜 inner 데이터 호출을 정적화하는가: `getAssetInfoResilient`는 catch에서
 * `DYNAMIC_SERVER_USAGE`를 그대로 rethrow한다. inner redis 호출이 정적화되지 않으면 static
 * gen 중 no-store fetch가 `DYNAMIC_SERVER_USAGE`를 throw → resilient가 faithfully rethrow →
 * 라우트가 dynamic으로 떨어진다. 그래서 데이터 호출 자체를 `unstable_cache`로 감싸 정적화한다.
 * resilient의 `connection()`/rethrow는 이 래퍼 밖에 그대로 남아(인프라 실패 시 의도된
 * dynamic-escape) `unstable_cache` 안에서 throw하지 않는다.
 *
 * 왜 clean lib `getAssetInfo`가 아니라 `getAssetInfoAction`('use server')을 감싸는가:
 * `getAssetInfoResilient`는 ticker barrel(index.ts)에서 export되고, 그 barrel은 client
 * component(useRecentSearches 등)가 import한다. clean lib를 직접 감싸면 lib → db → client →
 * clientTest(postgres + 'server-only') 체인이 client bundle로 끌려와 빌드가 깨진다(Module not
 * found: fs/net/tls). `'use server'` 경계가 이 체인을 firewall하므로 action을 감싼다 —
 * `getBarsStatic`(getBarsAction 래핑)과 동일한 패턴. action body는 `getAssetInfo(upper)`
 * 호출뿐이라 dynamic API가 없어 DSU 정적화 의도는 그대로 충족된다.
 *
 * 전제(축 0): 이 정적화는 root layout cookies() 제거가 선결돼야 효과가 있다 — layout이 전
 * 라우트를 dynamic으로 강제하면 unstable_cache 래핑도 무력하다(Task 2).
 *
 * 정적 분석 확인: `getAssetInfo` 체인(cache/DB/FMP/koreanNameStore)에 cookies()/headers()/
 * connection() 없음 → `unstable_cache` 래핑 안전. null=실재하지 않는 종목, throw=인프라 실패.
 *
 * ticker는 대문자로 정규화해 unstable_cache 키·태그를 canonical하게 유지한다(호출부 대소문자
 * 혼용 시 캐시 분기·revalidateTag 누락 방지). getAssetInfoAction이 내부적으로도 대문자화하므로
 * 데이터는 동일하고, 정규화는 캐시 키/태그의 일관성만 보장한다.
 */
export function getAssetInfoStatic(ticker: string): Promise<AssetInfo | null> {
    const upper = ticker.toUpperCase();
    return unstable_cache(
        () => getAssetInfoAction(upper),
        ['asset-info-static', upper],
        { revalidate: SECONDS_PER_HOUR, tags: [`symbol:${upper}`] }
    )();
}
