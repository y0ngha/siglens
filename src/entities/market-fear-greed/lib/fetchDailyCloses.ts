import type { MarketDailyClose } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { lastClosedSessionDateEt } from '@/shared/lib/marketSessionDate';
import { MS_PER_DAY } from '@/shared/config/time';
import { e2eDailyCloses } from './e2eFearGreedFixture';
import { MARKET_FEAR_GREED_LOOKBACK_DAYS } from './marketFearGreedSymbols';

/** One row of FMP `/stable/historical-price-eod/light`. */
interface FmpLightEodRow {
    date?: unknown;
    price?: unknown;
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
 * `lastClosedSessionDateEt` is the same helper the bars EOD cache and the sitemap
 * `lastmod` builders use, including its 4h publish buffer, DST, and weekend rewind.
 */
export function lastPublishedSessionDate(now: Date): string {
    return lastClosedSessionDateEt(now);
}

/**
 * Daily closes for one ticker from FMP's light EOD endpoint.
 *
 * The light endpoint returns `{symbol, date, price, volume}` — closes only,
 * which is all the market Fear & Greed factors need. Deliberately *not* routed
 * through `getBarsStatic`: that path runs the full `calculateIndicators` suite
 * and produces a ~500KB payload per symbol, and this page needs six symbols'
 * worth of a single number each.
 *
 * Rows without a string date or a positive numeric price are dropped here
 * rather than downstream, so a partially malformed response degrades to fewer
 * sessions instead of poisoning a factor. The price check is `typeof` rather
 * than `Number(...)` on purpose: `Number(null)` is `0`, which is finite, so a
 * coercing check would turn an explicit `"price": null` into a zero close.
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

    const rows = await fmpGet<FmpLightEodRow[]>('historical-price-eod/light', {
        symbol,
        from,
        to,
    });

    const closes = Array.isArray(rows)
        ? rows.flatMap(row =>
              typeof row.date === 'string' &&
              typeof row.price === 'number' &&
              Number.isFinite(row.price) &&
              row.price > 0
                  ? [{ date: row.date, close: row.price }]
                  : []
          )
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
