import 'server-only';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import {
    INVESTOR_FLOWS_READINESS_TAG,
    investorFlowsTag,
} from '../lib/investorFlowsTag';
import { getInvestorFlowsDataProvider } from './getInvestorFlowsDataProvider';

/**
 * 렌더 경로에서 읽는 수급 스냅샷(`staticSymbolCache` — ISR이 정적 생성 중 DB·Redis·FMP no-store
 * 읽기에 막히지 않게 한다). 데이터가 일 단위로 바뀌므로 12시간.
 *
 * 수집 파이프라인 준비 상태 태그(`INVESTOR_FLOWS_READINESS_TAG`)도 단다 — 부트스트랩 중에 비어 있던 스냅샷이 13F 백필·FINRA
 * 첫 수집이 끝난 뒤에도 12시간 남지 않도록, 그 전환이 모든 종목의 스냅샷(과 이 스냅샷을 렌더 중 읽은 ISR 페이지)을 한 번에
 * 무효화한다. Next는 렌더 중 읽힌 `unstable_cache`의 태그를 페이지 캐시 엔트리에 모은다(`unstable-cache.js`의 `workUnitStore.tags`).
 *
 * 키에 **FINRA 플래그 상태를 넣는다**(SERVER.md#DC-1): 스냅샷의 공매도 필드가 플래그에 따라 달라지는데
 * 키가 같으면 플래그를 꺼도 TTL 동안 옛(공매도 포함) 스냅샷이 남는다 — 라이선스 때문에 끄는 스위치가
 * 즉시 듣지 않는 것은 허용할 수 없다. 반환 형태가 바뀌면 `-v1`을 올린다.
 */
export function getInvestorFlowsSnapshot(
    symbol: string
): Promise<InvestorFlowsSnapshot | null> {
    const upper = symbol.toUpperCase();
    return staticSymbolCache<InvestorFlowsSnapshot | null>(
        [
            'investor-flows:snapshot-v1',
            isFinraShortDataEnabled() ? 'finra-on' : 'finra-off',
            upper,
        ],
        upper,
        () => getInvestorFlowsDataProvider().getInvestorFlowsSnapshot(upper),
        [investorFlowsTag(upper), INVESTOR_FLOWS_READINESS_TAG],
        SECONDS_PER_HALF_DAY
    );
}
