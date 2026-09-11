import { US_EQUITY_SESSION, type MarketDailyClose } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import { MS_PER_DAY } from '@/shared/config/time';
import { e2eDailyCloses } from './e2eFearGreedFixture';
import { MARKET_FEAR_GREED_LOOKBACK_DAYS } from './marketFearGreedSymbols';

/**
 * One row of FMP `/stable/historical-price-eod/dividend-adjusted` (`adjClose`)
 * or `/stable/historical-price-eod/light` (`price`) — see {@link priceSourceFor}.
 */
interface FmpEodRow {
    date?: unknown;
    adjClose?: unknown;
    price?: unknown;
}

/** FMP endpoint and row field that carry the close for a symbol. */
interface PriceSource {
    endpoint:
        | 'historical-price-eod/light'
        | 'historical-price-eod/dividend-adjusted';
    field: 'price' | 'adjClose';
}

/**
 * Which FMP endpoint and field carry the close for `symbol`.
 *
 * ETFs read the dividend-adjusted close (see {@link fetchDailyCloses}). Index
 * symbols (`^VIX`) cannot: they pay no distributions, so there is nothing to
 * adjust, and FMP gates `dividend-adjusted` for them behind a paid tier —
 * verified 2026-09-11 that `^VIX` answers `402 Premium Query Parameter` there
 * while `light` returns the full history. Sending `^VIX` to the adjusted
 * endpoint would throw and take the whole US index down with it.
 */
function priceSourceFor(symbol: string): PriceSource {
    return symbol.startsWith('^')
        ? { endpoint: 'historical-price-eod/light', field: 'price' }
        : {
              endpoint: 'historical-price-eod/dividend-adjusted',
              field: 'adjClose',
          };
}

/** ISO `YYYY-MM-DD` for `date` in UTC. */
function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/**
 * The `from` bound for a lookback window ending at `now`.
 *
 * Exported so the cache layer computes it once and passes the same bound to all
 * six series. Deriving it per series would let a request that straddles
 * midnight UTC fetch different windows for different symbols.
 */
export function lookbackStartDate(now: Date): string {
    return isoDate(
        new Date(now.getTime() - MARKET_FEAR_GREED_LOOKBACK_DAYS * MS_PER_DAY)
    );
}

/**
 * The `to` bound — the last session that has actually closed and published.
 *
 * FMP's EOD endpoints return a row for the *in-progress* session carrying the
 * live price, not a close (confirmed against a 24/7 symbol, which shows a row
 * dated today mid-session). Without this bound the index would silently feed on
 * an intraday tick, drift all day, and still be captioned "종가 기준" — and the
 * value it settles on would be whichever intraday tick the last ISR
 * regeneration happened to catch.
 *
 * `lastClosedSessionDate` is the same helper the bars EOD cache and the sitemap
 * `lastmod` builders use, including its 4h publish buffer, DST, weekend rewind, and
 * NYSE holiday/half-day calendar. The spec is pinned to `US_EQUITY_SESSION` because
 * every symbol in `MARKET_FEAR_GREED_SYMBOLS` is a U.S. index or ETF.
 */
export function lastPublishedSessionDate(now: Date): string {
    return lastClosedSessionDate(US_EQUITY_SESSION, now);
}

/**
 * Daily closes for one ticker from FMP's dividend-adjusted EOD endpoint
 * (index symbols use `light` instead — {@link priceSourceFor}).
 *
 * ETFs deliberately do *not* use the `light` endpoint (unadjusted `price`): verified
 * 2026-08-12 that `HYG`'s `light` close (79.61) differs from its
 * dividend-adjusted close (79.18). Bond ETFs in this basket (`HYG`, `LQD`,
 * `TLT`) pay monthly distributions, so an unadjusted series shows a fake drop
 * on every ex-dividend date — which biases the 20-session return spreads the
 * `junk_bond`/`safe_haven` factors compare. Also deliberately *not* routed
 * through `getBarsStatic`: that path runs the full `calculateIndicators` suite
 * and produces a ~500KB payload per symbol, and this page needs six symbols'
 * worth of a single number each.
 *
 * Rows without a string date or a positive numeric `adjClose` are dropped here
 * rather than downstream, so a partially malformed response degrades to fewer
 * sessions instead of poisoning a factor. The check is `typeof` rather than
 * `Number(...)` on purpose: `Number(null)` is `0`, which is finite, so a
 * coercing check would turn an explicit `"adjClose": null` into a zero close.
 *
 * @param symbol - FMP ticker (e.g. `SPY`, `^VIX`).
 * @param from - Inclusive ISO `YYYY-MM-DD` lower bound.
 * @param to - Inclusive ISO `YYYY-MM-DD` upper bound; see {@link lastPublishedSessionDate}.
 * @returns Daily closes, in whatever order FMP returned them — `computeMarketFearGreed*` sorts.
 * @throws When FMP fails, or returns no usable rows at all.
 */
export async function fetchDailyCloses(
    symbol: string,
    from: string,
    to: string
): Promise<MarketDailyClose[]> {
    // E2E는 FMP 키 없이 도는 것이 의도된 설계라, 실호출을 두면 이 페이지가 항상
    // "표본 부족" 상태로만 검증된다. 결정적 fixture로 대체해 게이지·비교·요인 막대까지
    // 실제로 렌더시킨다.
    if (isE2E()) return e2eDailyCloses(symbol);

    const { endpoint, field } = priceSourceFor(symbol);
    const rows = await fmpGet<FmpEodRow[]>(endpoint, { symbol, from, to });

    const closes = Array.isArray(rows)
        ? rows.flatMap(row => {
              const close = row[field];
              return typeof row.date === 'string' &&
                  typeof close === 'number' &&
                  Number.isFinite(close) &&
                  close > 0
                  ? [{ date: row.date, close }]
                  : [];
          })
        : [];

    // FMP answers an unknown or delisted symbol with `200 []` rather than an
    // error. Returning that quietly would empty the date inner-join and surface
    // as "표본이 부족합니다" — an upstream outage wearing a warm-up message, with
    // nothing in the logs. Throw instead: `getOrSetCache` then refuses to cache,
    // and the page's catch still renders a normal 200.
    if (closes.length === 0) {
        throw new Error(
            `[marketFearGreed] no usable closes for ${symbol} (${from}..${to})`
        );
    }

    return closes;
}
