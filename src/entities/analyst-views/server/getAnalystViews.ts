import 'server-only';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { getYahooAnalystSummary } from '@/shared/api/yahoo/yahooAnalystSource';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { buildAnalystViews } from '../lib/buildAnalystViews';
import type { AnalystViews } from '../model';

/**
 * 한 종목의 애널리스트 뷰(목표가 두 출처·투자의견 분포·증권사별 변경 이력·실적 힌트)를 모은다.
 *
 * 절대 던지지 않는다. 한 출처가 실패하면 다른 출처만으로 채우고 `degraded`에 적는다:
 * Yahoo 소스는 자체적으로 실패를 `null`로 돌리고, FMP는 `allSettled`의 reject로 잡는다.
 *
 * 한국 종목은 FMP를 부르지 않는다. 한국 펀더멘털 프로바이더가 이미 Yahoo라 같은 값을 두 번 싣게 되고,
 * 변경 이력 모듈은 한국 종목에 데이터가 없어 요청하지 않는다(`includeActions: false`). 따라서 FMP는
 * 한국 종목에서 `degraded`에 올라가지 않는다.
 */
export interface GetAnalystViewsOptions {
    /**
     * `full`(기본): 변경 이력 모듈과 FMP 기간 평균까지 읽는다. `lite`: 이력 모듈과 `getPriceTargetSummary`를
     * 빼고 목표가·의견 분포·실적 힌트만 읽는다 — `get_fundamentals`처럼 이력을 쓰지 않는 호출용이다
     * (`actions.available`이 `false`로 나온다).
     */
    detail?: 'full' | 'lite';
}

export async function getAnalystViews(
    symbol: string,
    options: GetAnalystViewsOptions = {}
): Promise<AnalystViews> {
    const full = (options.detail ?? 'full') === 'full';
    const isKr = isKrEquitySymbol(symbol);
    if (isKr) {
        const yahoo = await getYahooAnalystSummary(symbol, {
            includeActions: false,
        });
        return buildAnalystViews({
            symbol,
            now: new Date(),
            yahoo,
            fmp: null,
            fmpFailed: false,
            includeActions: false,
            includeEarnings: false,
        });
    }
    const [yahooR, consensusR, summaryR] = await Promise.allSettled([
        getYahooAnalystSummary(symbol, { includeActions: full }),
        Promise.resolve().then(() =>
            getFundamentalDataProvider(symbol).getPriceTargetConsensus(symbol)
        ),
        full
            ? Promise.resolve().then(() =>
                  getFundamentalDataProvider(symbol).getPriceTargetSummary(
                      symbol
                  )
              )
            : Promise.resolve(null),
    ]);
    const fmpFailed =
        consensusR.status === 'rejected' || summaryR.status === 'rejected';
    if (fmpFailed)
        console.warn('[analystViews] fmp price targets failed', symbol);
    return buildAnalystViews({
        symbol,
        now: new Date(),
        yahoo: yahooR.status === 'fulfilled' ? yahooR.value : null,
        fmp: {
            consensus:
                consensusR.status === 'fulfilled' ? consensusR.value : null,
            summary: summaryR.status === 'fulfilled' ? summaryR.value : null,
        },
        fmpFailed,
        includeActions: full,
        includeEarnings: true,
    });
}
