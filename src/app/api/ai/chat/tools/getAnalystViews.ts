import 'server-only';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { getAnalystViews } from '@/entities/analyst-views/server/getAnalystViews';
import { roundNumbersDeep } from '@/entities/bars/lib/roundIndicators';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { logToolDegrade } from './logToolDegrade';
import { pctVs } from './percent';
import { resolveAssetInfoOrNull } from './resolveAssetInfo';

/**
 * 모델에 싣는 변경 이력 행 수. core 설명은 "up to 15"이고, 긴 증권사명·등급 문구를 담은 15행과 추정치 4기간을 함께 실은
 * 실측이 이 도구의 전용 상한 `ANALYST_VIEWS_RESULT_MAX_CHARS`(5,500자) 안에 들어와 15를 유지한다(`getAnalystViews.test.ts`가
 * 고정한다). 넘으면 상한을 올리지 말고 이 값을 줄일 것.
 */
export const ANALYST_ACTION_ROWS_MAX = 15;

/**
 * 종목의 애널리스트 뷰: 목표가 두 출처(Yahoo·FMP) 병기, 현재 투자의견 분포, 증권사별 변경 이력, 실적 추정치 추이
 * (`estimates`, Yahoo — 미국·한국). 펀더멘털 탭이 허용되는 종목(미국·한국 주식)만 대상이고, 그 밖은 `not_a_stock`이다.
 * 넷 다 없으면 `no_analyst_data`(또는 출처 실패면 `provider_failed`)다. `earnings`는 싣지 않는다(`get_fundamentals`의 몫).
 */
export const getAnalystViewsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await isTabAllowedForSymbol(symbol, 'fundamental')))
        return { symbol, available: false, reason: 'not_a_stock' };

    const [marketProfile, asset] = await Promise.all([
        resolveMarketProfile(symbol),
        resolveAssetInfoOrNull(symbol, 'get_analyst_views'),
    ]);
    const marketData = getCachedMarketDataProvider(
        sessionSpecFor(marketProfile)
    );
    // 시세는 뷰에 의존하지 않으므로 함께 기다린다. 시세는 부가 정보(`price`, `upsidePct`)라 실패나 지연이
    // 도구를 막지 않는다.
    const [views, quote] = await Promise.all([
        getAnalystViews(symbol),
        quoteWithTimeout(marketData, asset?.fmpSymbol ?? symbol).catch(
            (error: unknown) => {
                logToolDegrade('get_analyst_views', 'quote', error);
                return null;
            }
        ),
    ]);
    const price =
        quote && Number.isFinite(quote.price) && quote.price > 0
            ? quote.price
            : null;

    const { targets, ratings, actions, degraded } = views;
    if (
        targets.yahoo === null &&
        targets.fmp === null &&
        ratings === null &&
        actions.rows.length === 0 &&
        views.estimates === null
    )
        // 출처가 실패했으면 "모름"(재시도 가치), 아니면 이 종목에 애널리스트 데이터가 없는 것(ETF·소형주)이다.
        return {
            symbol,
            available: false,
            reason: degraded.length > 0 ? 'provider_failed' : 'no_analyst_data',
        };

    return roundNumbersDeep({
        asOf: views.asOf,
        source: 'analyst views (Yahoo Finance, FMP)',
        symbol,
        available: true,
        price,
        currency: getDescriptor(marketProfile).priceFormat.currency,
        targets: {
            yahoo: targets.yahoo && {
                ...targets.yahoo,
                upsidePct: pctVs(targets.yahoo.mean, price),
            },
            fmp: targets.fmp && {
                ...targets.fmp,
                upsidePct: pctVs(targets.fmp.consensus, price),
            },
            gapPct: targets.gapPct,
            sourcesDisagree: targets.sourcesDisagree,
        },
        ratings,
        actions: {
            available: actions.available,
            rows: actions.rows.slice(0, ANALYST_ACTION_ROWS_MAX),
            tally: actions.tally,
        },
        estimates: views.estimates,
        degraded,
    });
};
