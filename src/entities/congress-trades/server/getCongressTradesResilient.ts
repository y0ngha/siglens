import { cache } from 'react';
import type { CongressTrade } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { getCongressTrades } from './getCongressTrades';

/** `getCongressTradesResilient`의 반환 envelope. */
export interface ResilientCongressTrades {
    trades: CongressTrade[];
    /**
     * true = FMP 장애(`getCongressTrades`가 throw, 0건 결과 아님). false = 정상 —
     * "의회 거래 기록 없음"도 포함한다. 페이지의 degrade/noindex 판단의 유일한 근거다.
     */
    degraded: boolean;
}

/**
 * `getCongressTrades`의 graceful 래퍼 — 의회 탭 페이지와 에이전트 도구 소비.
 * 거래 0건(정상)은 `degraded: false`, FMP 장애(throw)만 `degraded: true`로 구분한다.
 * Next의 `DYNAMIC_SERVER_USAGE` 같은 정적/ISR 제어 흐름 에러는 인프라 장애가 아니므로 그대로 재throw한다.
 * `getProfileResilient`·`getAssetInfoResilient`와 같은 degrade 정책이다.
 *
 * React.cache로 메모이즈되므로 동일 요청 내에서 여러 번 호출해도(예: generateMetadata +
 * 페이지 본문) 실제 실행은 한 번만 된다.
 */
export const getCongressTradesResilient = cache(
    async (symbol: string): Promise<ResilientCongressTrades> => {
        try {
            return { trades: await getCongressTrades(symbol), degraded: false };
        } catch (e) {
            if (isDynamicServerError(e)) throw e;
            // 프로덕션에선 로깅하되, FMP 키가 없는 E2E에선 이 degrade가 정상이라 침묵시킨다
            // (E2E_TEST는 prod에 없으므로 prod 로깅은 그대로). getProfileResilient와 동일 정책.
            if (!isE2E()) {
                console.error(
                    '[getCongressTradesResilient] FMP 의회 거래 장애, degrade:',
                    e
                );
            }
            return { trades: [], degraded: true };
        }
    }
);
