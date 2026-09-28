import 'server-only';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { FMP_FUNDAMENTAL_REVALIDATE_SECONDS } from '@/shared/api/fmp/fundamentalClient';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import {
    roundNumber,
    roundNumbersDeep,
} from '@/entities/bars/lib/roundIndicators';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor, isKrEquitySymbol } from '@/shared/config/marketProfile';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { MS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import type { ToolExecutor } from './index';
import { pctVs, ratioPct } from './percent';
import { resolveAssetInfoOrNull } from './resolveAssetInfo';

/**
 * 펀더멘털 값이 지나는 캐시 계층 수 — Redis(`getOrSetCache`) + Next Data Cache.
 * 둘 다 `FMP_FUNDAMENTAL_REVALIDATE_SECONDS`를 쓰지만 만료 시점이 독립이라
 * 최악의 나이는 두 창의 합에 가깝다.
 */
const FUNDAMENTAL_CACHE_LAYERS = 2;

function settledOrNull<T>(r: PromiseSettledResult<T>): T | null {
    return r.status === 'fulfilled' ? r.value : null;
}

/**
 * Whole calendar days from `now` to `dateStr` (`YYYY-MM-DD`), in the
 * market's OWN timezone — can be negative (a past date). Both dates are
 * reduced to their LOCAL calendar date first (`zonedDate`) and diffed as
 * UTC-midnight instants of those dates, which is always an exact integer —
 * unlike rounding a raw `(target - now) / MS_PER_DAY` ms difference, which
 * is thrown off by `now`'s time-of-day: e.g. earnings tomorrow but `now` is
 * still mid-afternoon ET would leave under 24h of raw ms until a UTC-
 * midnight-parsed `target`, rounding down to "0 days" (today) instead of the
 * correct "1 day" (tomorrow). `now`/`timeZone` are parameters (defaults
 * `new Date()`/ET) so the day count is testable without mocking the system
 * clock. `null` on an unparseable date, per the null rule (spec §0).
 */
export function daysUntil(
    dateStr: string | null,
    now: Date = new Date(),
    timeZone: string = 'America/New_York'
): number | null {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (!Number.isFinite(target.getTime())) return null;
    const targetDate = target.toISOString().slice(0, 10);
    const nowDate = zonedDate(now, timeZone);
    const diffMs =
        Date.parse(`${targetDate}T00:00:00Z`) -
        Date.parse(`${nowDate}T00:00:00Z`);
    return Math.round(diffMs / MS_PER_DAY);
}

/**
 * Compact valuation/profitability/growth/health/analyst snapshot for stocks
 * (US and Korean — crypto has no fundamental tab, gated the same way
 * `getOptionsSummaryTool` gates options). One `Promise.allSettled` fan-out so
 * a single failing FMP/yahoo endpoint only drops its own section instead of
 * the whole tool result.
 *
 * Dividend yield is not in the provider's exposed shapes
 * (`FundamentalValuationMetrics` carries no such field) — omitted rather
 * than guessed. Peers and the long-form profile description are omitted
 * too: the model-facing shape is numbers for valuation/health questions,
 * not the page's full content.
 *
 * `nextEarningsDate` goes through `getNextEarningsReport` — the same
 * DB-backed, 24h-staleness-gated loader the news/analysis paths already use
 * (`entities/earnings-report`) — rather than the provider's own
 * `getEarningsReport`, which is deliberately `no-store` at the FMP/yahoo
 * client (earnings-day real-time-ness matters there). Routing through it
 * here means this tool shares that cache instead of adding an uncached
 * FMP/yahoo call per turn.
 *
 * `profitability`/`growth` fields are RENAMED with an explicit `...Pct`
 * suffix (spec §3.4, audit B6): FMP returns these as decimals (`0.25` =
 * 25%), verified against the fundamental tab's own display code
 * (`ProfitabilityCard.tsx`/`GrowthChart.tsx`, both `value * 100`) before
 * converting. `debtRatioTTM`/`currentRatioTTM`/`pe`/`pb`/`ps`/`evToEbitda`
 * are plain multiples in that same display code (`toFixed(2)`, no `* 100`)
 * and are left unconverted/unrenamed.
 *
 * No `epsEstimateVsTtmPct`: the analyst estimate's period IS well-defined now
 * (FMP's row is `currentFiscalYearRow` — the fiscal year in progress; Yahoo's
 * is the CURRENT quarter, `'0q'`), but neither is the SAME period as
 * `keyMetrics.epsTTM` (trailing twelve months): the FMP row is an annual
 * consensus for a fiscal year that mostly falls outside the trailing twelve
 * months, and the Yahoo row is a single upcoming quarter. Diffing either
 * against a TTM figure would still produce a number for two different
 * windows, not a real "estimate vs TTM" delta. `analystEstimate` (the raw
 * estimate) is still surfaced for the model to read, labelled with the
 * period it actually covers — the name used to be `nextQuarterEstimate`,
 * which a real turn read back as "next quarter EPS 20.00" for NVDA's annual
 * consensus. US rows come from FMP's annual consensus for the fiscal year in
 * progress (`currentFiscalYearRow`); Korean rows from Yahoo's current
 * quarter (`'0q'`) — `period` is derived with the SAME predicate
 * (`isKrEquitySymbol`) `getFundamentalDataProvider` itself uses to route to
 * the Yahoo vs FMP provider, not a separate `currency === 'KRW'` check that
 * could in principle disagree with it.
 */
export const getFundamentalsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await isTabAllowedForSymbol(symbol, 'fundamental')))
        return { symbol, available: false, reason: 'tab_not_available' };

    const provider = getFundamentalDataProvider(symbol);
    const [marketProfile, asset] = await Promise.all([
        resolveMarketProfile(symbol),
        resolveAssetInfoOrNull(symbol, 'get_fundamentals'),
    ]);
    const session = sessionSpecFor(marketProfile);
    const [
        profileR,
        keyMetricsR,
        ratiosR,
        growthR,
        scoresR,
        cashFlowR,
        gradesR,
        priceTargetR,
        estimatesR,
        earningsR,
        quoteR,
    ] = await Promise.allSettled([
        provider.getProfile(symbol),
        provider.getKeyMetricsTtm(symbol),
        provider.getRatiosTtm(symbol),
        provider.getIncomeStatementGrowth(symbol),
        provider.getFinancialScores(symbol),
        provider.getCashFlowStatement(symbol),
        provider.getGradesConsensus(symbol),
        provider.getPriceTargetConsensus(symbol),
        provider.getAnalystEstimates(symbol),
        getNextEarningsReport(symbol, getDatabaseClient().db),
        // Same symbol→fmpSymbol mapping `get_quote`/`get_bars_indicators`
        // use. Bounded by `quoteWithTimeout` like the other quotes that are
        // only enrichment (`get_my_portfolio`, `get_cached_analysis`);
        // `get_quote` calls getQuote directly because the quote IS its output.
        // Here the price is an extra (`price`, `targetUpsidePct`), so a slow
        // quote must not stall the whole tool.
        quoteWithTimeout(
            getCachedMarketDataProvider(session),
            asset?.fmpSymbol ?? symbol
        ),
    ]);

    const profile = settledOrNull(profileR);
    if (!profile) return { symbol, available: false, reason: 'no_profile' };

    const currency = getDescriptor(marketProfile).priceFormat.currency;
    const earningsTimeZone =
        session.kind === 'scheduled' ? session.timeZone : 'UTC';
    const keyMetrics = settledOrNull(keyMetricsR);
    const ratios = settledOrNull(ratiosR);
    const growth = settledOrNull(growthR);
    const scores = settledOrNull(scoresR);
    const cashFlow = settledOrNull(cashFlowR);
    const grades = settledOrNull(gradesR);
    const priceTarget = settledOrNull(priceTargetR);
    const estimates = settledOrNull(estimatesR);
    const earnings = settledOrNull(earningsR);
    const quote = settledOrNull(quoteR);
    // A failed lookup is `null` (rejections are settled to `null` above);
    // `price > 0` also rejects bad upstream data (a zero or negative price),
    // so either reads as "unknown", never as a real price.
    const price =
        quote && Number.isFinite(quote.price) && quote.price > 0
            ? quote.price
            : null;

    const gradeTotal = grades
        ? grades.strongBuy +
          grades.buy +
          grades.hold +
          grades.sell +
          grades.strongSell
        : null;

    // Provider ratios arrive as raw floats (P/E 27.622012578616346); trim them
    // to significant digits like every other number the agent quotes.
    return roundNumbersDeep({
        /*
         * `asOf`는 **조회 시각**이다 — 데이터가 그 시점 값이라는 뜻이 아니다.
         *
         * 이 경로는 전부 `getOrSetCache(key, FMP_FUNDAMENTAL_REVALIDATE_SECONDS, …)`
         * 로 읽으므로 프로필·밸류에이션·성장·재무건전성·애널리스트 값이 최대
         * 24시간 묵었을 수 있는데, 예전에는 그걸 `asOf: now`로만 내보내 모델이
         * "지금 P/E"라고 단정할 근거를 줬다. 펀더멘털은 분기 단위로 바뀌므로
         * 24시간 지연 자체는 문제가 아니지만, **지연을 숨기는 것**은 문제다.
         *
         * 실제 생성 시각은 캐시 계층이 돌려주지 않으므로 지어내지 않는다. 대신
         * 나이의 **상한**을 명시해 모델이 "최대 하루 전 기준"으로 말할 수 있게 한다.
         * (`get_quote`처럼 프로바이더가 타임스탬프를 주는 경로는 실제 시각을
         * 싣는다 — 여기서 같은 걸 흉내 내면 그게 거짓이 된다.)
         *
         * 상한이 무엇을 덮고 무엇을 안 덮는지는 `cachedSectionsMaxAgeHours`의
         * 이름과 그 옆 주석이 말한다.
         */
        asOf: new Date().toISOString(),
        asOfIsFetchTime: true as const,
        // 이 상한이 덮는 것은 **캐시된 펀더멘털 섹션**뿐이다(profile·valuation·
        // growth·health·analyst). 같은 봉투의 `price`는 별개의 창을 쓴다 —
        // `computeBarsEffectiveTtl`이 장중에만 60초이고 장외에는
        // `min(BARS_OFFHOURS_TTL_CEILING_SECONDS=86_400, 다음 정규장까지)`라
        // 하루와 같은 자릿수가 된다(값 자체는 정확한 마지막 종가이므로 그게
        // 문제는 아니다). `nextEarningsDate`/`daysToEarnings`는 DB 행이라 갱신이
        // 실패하면 몇 주 묵을 수 있다 — 하나의 숫자로 전부를 덮는다고 말하면
        // 그게 이 PR이 고치는 `asOf: now`와 같은 과장이 된다.
        // **두 계층이 겹친다.** Redis(`getOrSetCache`)가 24h로 잡고, 그게 miss나면
        // 안쪽 `fmpGet`이 Next Data Cache를 같은 24h `revalidate`로 읽는다
        // (stale-while-revalidate). 두 창이 어긋나게 만료되면 실질 상한은 24h가
        // 아니라 그 합에 가깝다 — 한 계층만 세면 이 PR이 고치는 `asOf: now`와
        // 같은 과소평가가 된다.
        cachedSectionsMaxAgeHours:
            (FMP_FUNDAMENTAL_REVALIDATE_SECONDS * FUNDAMENTAL_CACHE_LAYERS) /
            SECONDS_PER_HOUR,
        source: 'fundamental data provider (cached)',
        symbol,
        available: true,
        price,
        profile: {
            name: profile.companyName,
            sector: profile.sector,
            industry: profile.industry,
            marketCap: profile.marketCap,
            currency,
        },
        valuation: keyMetrics && {
            pe: keyMetrics.peRatioTTM,
            pb: keyMetrics.pbRatioTTM,
            ps: keyMetrics.priceToSalesRatioTTM,
            evToEbitda: keyMetrics.enterpriseValueOverEBITDATTM,
        },
        profitability: ratios && {
            roePct:
                ratios.returnOnEquityTTM === null
                    ? null
                    : roundNumber(ratios.returnOnEquityTTM * 100),
            roaPct:
                ratios.returnOnAssetsTTM === null
                    ? null
                    : roundNumber(ratios.returnOnAssetsTTM * 100),
            operatingMarginPct:
                ratios.operatingProfitMarginTTM === null
                    ? null
                    : roundNumber(ratios.operatingProfitMarginTTM * 100),
            netMarginPct:
                ratios.netProfitMarginTTM === null
                    ? null
                    : roundNumber(ratios.netProfitMarginTTM * 100),
        },
        growth: growth && {
            revenueGrowthPct:
                growth.growthRevenue === null
                    ? null
                    : roundNumber(growth.growthRevenue * 100),
            epsGrowthPct:
                growth.growthEPS === null
                    ? null
                    : roundNumber(growth.growthEPS * 100),
        },
        health: {
            altmanZScore: scores?.altmanZScore ?? null,
            piotroskiScore: scores?.piotroskiScore ?? null,
            debtRatio: ratios?.debtRatioTTM ?? null,
            currentRatio: ratios?.currentRatioTTM ?? null,
            operatingCashFlow: cashFlow?.operatingCashFlow ?? null,
        },
        analyst: {
            consensus: grades,
            analystBuySharePct: grades
                ? ratioPct(grades.strongBuy + grades.buy, gradeTotal)
                : null,
            priceTarget,
            targetUpsidePct: pctVs(priceTarget?.targetConsensus ?? null, price),
            analystEstimate: estimates && {
                ...estimates,
                // Same predicate `getFundamentalDataProvider` itself routes
                // on — Korean-listed symbols use the Yahoo provider (current
                // quarter, '0q'); everything else FMP's annual consensus for
                // the fiscal year in progress.
                period: isKrEquitySymbol(symbol)
                    ? ('current_quarter' as const)
                    : ('current_fiscal_year' as const),
            },
            nextEarningsDate: earnings?.earningsDate ?? null,
            daysToEarnings: daysUntil(
                earnings?.earningsDate ?? null,
                new Date(),
                earningsTimeZone
            ),
        },
    });
};
