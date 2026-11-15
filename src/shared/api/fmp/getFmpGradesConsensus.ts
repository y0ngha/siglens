import 'server-only';
import type { FundamentalGradesConsensusInput } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { FMP_FUNDAMENTAL_CACHE_TTL_SECONDS } from '@/shared/config/time';
import { FmpFundamentalClient } from './fundamentalClient';
import { getFundamentalDataProvider } from './getFundamentalDataProvider';
import { sym } from './symKey';

const fmpClient = new FmpFundamentalClient();

/**
 * FMP 자체의 `grades-consensus`(지난 의견이 누적된 값) — Yahoo를 거치지 않는다. 공개 API는 Yahoo 값을 내보내지
 * 않으므로 미국 종목의 투자의견 건수를 종전 출처 그대로 읽는 데 쓴다. Redis 키는 **원래 키**
 * `fundamental:grades-consensus:<SYM>`이고 그 키의 의미(FMP 값)는 바뀌지 않았으므로 버전을 올리지 않는다
 * (Yahoo 값이 담기는 쪽은 `-v2`).
 *
 * E2E에서는 네트워크에 나가지 않도록 기존 fake 프로바이더 경로를 그대로 탄다.
 */
export function getFmpGradesConsensus(
    symbol: string
): Promise<FundamentalGradesConsensusInput | null> {
    if (isE2E()) {
        return getFundamentalDataProvider(symbol).getGradesConsensus(symbol);
    }
    return getOrSetCache(
        `fundamental:grades-consensus:${sym(symbol)}`,
        FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
        () => fmpClient.getGradesConsensus(symbol)
    );
}
