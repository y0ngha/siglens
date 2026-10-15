import 'server-only';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import type { InvestorFlowsSnapshot } from '../coreTypes';
import { investorFlowsTag } from '../lib/investorFlowsTag';
import { getInvestorFlowsDataProvider } from './getInvestorFlowsDataProvider';

/**
 * 렌더 경로에서 읽는 수급 스냅샷(`staticSymbolCache` — ISR이 정적 생성 중 DB·Redis·FMP no-store
 * 읽기에 막히지 않게 한다). 데이터가 일 단위로 바뀌므로 12시간.
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
        [investorFlowsTag(upper)],
        SECONDS_PER_HALF_DAY
    );
}
