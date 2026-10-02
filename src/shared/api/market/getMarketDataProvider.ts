import type { SiglensMarketProvider } from './marketProvider.types';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';
import { createE2EGatedSingleton } from '@/shared/api/createE2EGatedSingleton';
import { YahooMarketProvider } from '@/shared/api/yahoo/YahooMarketProvider';
import { isE2E } from '@/shared/api/e2eEnv';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

/** Returns the app's market data provider (FMP in prod, fake under E2E_TEST). */
export const getMarketDataProvider: () => SiglensMarketProvider =
    createE2EGatedSingleton(
        () => new FmpMarketProvider(),
        () => {
            // Sync factory — no dynamic import possible here, so the fake + fixture load
            // via a gated require. Server-only and dead when E2E_TEST is unset
            // (Turbopack still bundles them into the server output).
            // Safe cast: require() returns the exact module object at runtime, but TS
            // cannot infer its shape from synchronous require(), so we assert it
            // matches the static import type of the same module.
            const { FakeMarketProvider } =
                require('./FakeMarketProvider') as typeof import('./FakeMarketProvider');
            return new FakeMarketProvider();
        }
    );

/**
 * 대시보드 scope에 맞는 raw provider.
 *
 * 미국·크립토는 FMP지만 **KRX는 FMP 플랜에 없어** yahoo를 쓴다. 그 분기를 대시보드
 * 캐시마다 되풀이하면 한 곳만 빠져도 한국 페이지가 조용히 빈 시세를 그린다.
 *
 * E2E에서는 scope와 무관하게 `getMarketDataProvider()`(=FakeMarketProvider)를 쓴다 —
 * 픽스처가 소스별로 갈리면 E2E가 배선을 검증하는 것처럼 보이지만 실제로는 픽스처만
 * 검증한다. 여기 캐시 데코레이터를 씌우지 않는 것도 미국 경로와 같은 이유다:
 * 상위 `getOrSetCache`(summary/signals)가 이미 Redis 계층을 담당한다.
 */
export function marketDataProviderFor(
    scope: DashboardScopeId
): SiglensMarketProvider {
    if (scopeUsesFmp(scope) || isE2E()) return getMarketDataProvider();
    if (krProvider === null) krProvider = new YahooMarketProvider();
    return krProvider;
}

let krProvider: SiglensMarketProvider | null = null;

/**
 * 이 scope의 시세가 FMP에서 오는가 — {@link marketDataProviderFor}의 분기와 같은 판정.
 * 빌드 중 FMP 실패 가드(`assertFmpAvailableAtBuild`)와 60초 degrade revalidate를
 * FMP 기반 scope에만 걸기 위해 쓴다 — yahoo인 KRX는 FMP 상태와 무관하게 정상 빌드돼야 한다.
 */
export function scopeUsesFmp(scope: DashboardScopeId): boolean {
    return SCOPE_USES_FMP[scope];
}

// 전수 Record — 새 scope가 생기면 여기서 컴파일 에러가 나 FMP 여부를 정하게 한다
// (`scope !== 'kr'`였다면 새 scope가 조용히 FMP로 분류된다).
const SCOPE_USES_FMP: Readonly<Record<DashboardScopeId, boolean>> = {
    us: true,
    kr: false,
    crypto: true,
};
