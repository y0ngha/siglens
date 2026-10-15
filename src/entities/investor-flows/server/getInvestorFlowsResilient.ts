import 'server-only';
import { cache } from 'react';
import { isE2E } from '@/shared/api/e2eEnv';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import type { InvestorFlowsSnapshot } from '../coreTypes';
import { getInvestorFlowsSnapshot } from './getInvestorFlowsSnapshot';

export interface ResilientInvestorFlows {
    /** 수급 데이터가 없는 종목(정상)이거나 인프라 장애면 `null`. */
    snapshot: InvestorFlowsSnapshot | null;
    /**
     * true = 인프라 실패(`getInvestorFlowsSnapshot`이 던짐 — "데이터 없음"이 아니다). false = 정상, 데이터가
     * 없어 `snapshot`이 `null`인 경우 포함. 페이지의 degrade/noindex 판정의 유일한 근거다.
     */
    degraded: boolean;
}

/**
 * `getInvestorFlowsSnapshot`의 graceful 래퍼 — `getCongressTradesResilient`를 미러링한다.
 * Next의 정적/ISR 제어 흐름 오류(`DYNAMIC_SERVER_USAGE`)는 인프라 실패가 아니므로 그대로 다시 던진다.
 * React `cache`로 한 요청 안의 중복 호출(generateMetadata + 본문)을 접는다.
 */
export const getInvestorFlowsResilient = cache(
    async (symbol: string): Promise<ResilientInvestorFlows> => {
        try {
            return {
                snapshot: await getInvestorFlowsSnapshot(symbol),
                degraded: false,
            };
        } catch (error) {
            if (isDynamicServerError(error)) throw error;
            // FMP 키가 없는 E2E에서는 이 degrade가 정상이라 침묵한다(getCongressTradesResilient와 같은 정책).
            if (!isE2E()) {
                console.error(
                    '[getInvestorFlowsResilient] 수급 데이터 장애, degrade:',
                    error
                );
            }
            return { snapshot: null, degraded: true };
        }
    }
);
