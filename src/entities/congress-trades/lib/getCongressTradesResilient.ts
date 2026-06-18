import { cache } from 'react';
import type { CongressTrade } from '@y0ngha/siglens-core';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { isE2E } from '@/shared/api/e2eEnv';
import { getCongressTrades } from './getCongressTrades';

export interface ResilientCongressTrades {
    trades: CongressTrade[];
    /**
     * true = FMP infra failure (`getCongressTrades` threw — NOT a 0-trade result).
     * false = normal, including the legitimate "no congressional trades on record"
     * case. This is the single source of truth for the page's degrade/noindex
     * decision: a 0-trade result is NOT degraded; only infra failures are.
     */
    degraded: boolean;
}

/**
 * Graceful wrapper around `getCongressTrades`. Distinguishes the two
 * non-error outcomes:
 *
 * - 0 trades (normal — FMP returned an empty list): `{ trades: [], degraded: false }`.
 * - FMP infra failure (throw): `{ trades: [], degraded: true }`.
 *
 * Next's static/ISR control-flow errors (`DYNAMIC_SERVER_USAGE`) are always
 * re-thrown untouched — they are routing signals, not infra failures.
 *
 * Mirrors `getProfileResilient` and `getAssetInfoResilient` degrade policy.
 *
 * React.cache로 메모이즈되므로 동일 요청 내에서 여러 번 호출해도(예: generateMetadata +
 * 페이지 본문) 실제 실행은 한 번만 된다 — 두 번째 호출은 즉시 반환된다.
 */
export const getCongressTradesResilient = cache(
    async (symbol: string): Promise<ResilientCongressTrades> => {
        try {
            return { trades: await getCongressTrades(symbol), degraded: false };
        } catch (e) {
            // Next's static/ISR control-flow error must propagate untouched.
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
