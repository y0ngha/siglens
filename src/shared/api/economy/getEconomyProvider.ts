import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';
import { isE2E } from '@/shared/api/e2eEnv';
import type { EconomyProvider } from './EconomyProvider';

let cached: EconomyProvider | null = null;

/**
 * /economy용 EconomyProvider — prod에선 FMP, E2E_TEST에선 결정적 Fake.
 *
 * E2E degrade 시나리오: `E2E_ECONOMY_FORCE_EMPTY=1`이면 `EmptyEconomyProvider`를
 * 반환해 전 축 null 스냅샷 → `isEmptyEconomySnapshot=true` → `EconomyDegraded` UI
 * 렌더를 강제한다. `FakeEconomyProvider`와 같은 gated-require 패턴으로 prod 번들에서
 * dead-code로 남는다(Tier 3 env-seam).
 */
export function getEconomyProvider(): EconomyProvider {
    if (cached !== null) return cached;
    if (isE2E()) {
        // Sync factory + gated require — getMarketDataProvider 패턴 미러.
        // FakeEconomyProvider/EmptyEconomyProvider는 fixture를 들고 있어
        // prod 번들에서 dead로 남기 위함.
        // 동일 파일 경로의 named export이므로 typeof import()와 shape 일치가 컴파일
        // 타임에 보장된다(MISTAKES §TS §7 — `as` 캐스트 안전성 주석).
        const { FakeEconomyProvider, EmptyEconomyProvider } =
            require('./FakeEconomyProvider') as typeof import('./FakeEconomyProvider');
        if (process.env.E2E_ECONOMY_FORCE_EMPTY === '1') {
            // E2E degrade 시나리오: 캐시하지 않아 다른 테스트에 영향 없음.
            return new EmptyEconomyProvider();
        }
        cached = new FakeEconomyProvider();
        return cached;
    }
    cached = new FmpEconomyProvider();
    return cached;
}
