import 'server-only';
import type {
    MarketIndexData,
    MarketSectorData,
    StockSignalResult,
} from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import { getMarketFearGreedKrStatic } from '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache';
import type { MarketFearGreedView } from '@/entities/market-fear-greed/model';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { peekBriefingStatic } from '@/entities/market-summary/api/briefingStaticCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import {
    dashboardScopeOf,
    isDashboardScopeId,
    type DashboardScopeId,
} from '@/shared/config/dashboardScope';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import { lastCompletedDailyClose } from '@/entities/bars/lib/quantizeBars';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecForDashboardScope } from '@/shared/api/market/sessionSpecFor';
import { ISO_DATE_HOUR_SLICE_END } from '@/shared/config/time';
import type { Locale } from '@/shared/i18n/locales';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { logToolDegrade } from './logToolDegrade';
import { ppDelta } from './percent';

/** Capped so a busy signal scan (dozens of flagged stocks) stays inside the tool's budget. */
const TOP_SIGNALS_MAX = 10;

/**
 * `Object.groupBy` groups in one O(n) pass; `Object.fromEntries` over the
 * grouped entries then just maps each group to its length (O(sector count),
 * not another pass over `stocks`) — avoids both mutation and the O(n²) cost
 * of a reduce that spreads into a new object per stock.
 */
function countsBySector(
    stocks: readonly StockSignalResult[]
): Record<string, number> {
    const groups = Object.groupBy(stocks, s => s.sectorSymbol);
    return Object.fromEntries(
        Object.entries(groups).map(([sector, group]) => [
            sector,
            group?.length ?? 0,
        ])
    );
}

function topSignals(stocks: readonly StockSignalResult[]) {
    return stocks
        .flatMap(s =>
            s.signals.map(sig => ({
                symbol: s.symbol,
                sectorSymbol: s.sectorSymbol,
                type: sig.type,
                direction: sig.direction,
            }))
        )
        .slice(0, TOP_SIGNALS_MAX);
}

/**
 * Symbol → display name, the SAME source the dashboard uses
 * (`shared/i18n/assetLabel.ts`'s `useAssetLabel`, a client hook this
 * server-side tool can't call): the locale-scoped `shared.assetName`
 * catalog when a translated entry exists, else the sector's own
 * `koreanName` — `useAssetLabel` falls back to `koreanName` regardless of
 * locale (the config only carries a Korean name), so this mirrors that
 * rather than "improving" it into an English fallback the dashboard doesn't
 * have either. next-intl's `t(key)` does NOT throw on a missing key by
 * default — it returns the key path itself and reports the miss to its
 * error handler — so a missing-key check must use `t.has(key)`, the same
 * check `useAssetLabel` uses; a `try/catch` around `t(key)` would silently
 * never fall back.
 */
async function sectorDisplayNames(
    locale: Locale,
    sectors: readonly MarketSectorData[]
): Promise<Record<string, string>> {
    try {
        const t = await getTranslations({
            locale,
            namespace: 'shared.assetName',
        });
        return Object.fromEntries(
            sectors.map(s => {
                // next-intl uses `.` as a nesting separator (see
                // `useAssetLabel`) — same escape as the client hook.
                const key = s.symbol.replace(/\./g, '_');
                return [s.symbol, t.has(key) ? t(key) : s.koreanName] as const;
            })
        );
    } catch (error) {
        logToolDegrade('get_market_overview', 'sector name translation', error);
        return Object.fromEntries(
            sectors.map(s => [s.symbol, s.koreanName] as const)
        );
    }
}

/** An index's last COMPLETED daily close — the official settlement value, not a live quote. */
interface IndexLastClose {
    lastClose: number | null;
    lastCloseDate: string | null;
}

const NO_LAST_CLOSE: IndexLastClose = { lastClose: null, lastCloseDate: null };

/**
 * Last completed daily close of one index, from the same cached daily bars
 * `get_bars_indicators` reads (in-memory LRU over the provider's Redis-cached
 * history, so a repeat turn costs no extra upstream call; at most one provider
 * load per index, which keeps the whole overview far below FMP's 300/min).
 *
 * The summary's `price` is a `/quote` last-trade snapshot cached for an hour:
 * during a session it is a live print, and even after the close it can differ
 * from the official settlement (VIX answered 19.64 vs Cboe's 19.45). When the
 * last bar is still forming (regular session open) it is the live print, so
 * the previous bar is the last completed close; otherwise the last bar is it.
 * Never throws — a failed or empty load degrades to nulls (logged).
 */
async function loadIndexLastClose(
    index: MarketIndexData,
    scopeId: DashboardScopeId
): Promise<IndexLastClose> {
    try {
        const session = sessionSpecForDashboardScope(scopeId);
        const { bars } = await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(session),
            index.symbol,
            '1Day',
            index.fmpSymbol,
            session
        );
        const close = lastCompletedDailyClose(bars, session, new Date());
        return close === null
            ? NO_LAST_CLOSE
            : { lastClose: close.close, lastCloseDate: close.date };
    } catch (error) {
        logToolDegrade(
            'get_market_overview',
            `index last close ${index.symbol}`,
            error
        );
        return NO_LAST_CLOSE;
    }
}

interface RankedSector {
    symbol: string;
    name: string;
    price: number;
    changesPercentage: number;
    rank: number | null;
}

/**
 * A sector row is usable for ranking/breadth/spread only with a real price
 * and a finite day change — a `0`/negative price (upstream quote failure)
 * or a non-finite `changesPercentage` must never enter a ranking or a
 * best-worst spread.
 */
const isRankableSector = (s: MarketSectorData): boolean =>
    Number.isFinite(s.changesPercentage) &&
    Number.isFinite(s.price) &&
    s.price > 0;

/**
 * Sector rows ranked by day change desc (spec §3.5, audit B7) — was
 * symbol-only and unordered. Unrankable rows (see `isRankableSector`) are
 * NOT dropped — the sector still exists and the model should know it's in
 * the universe — they're appended after the ranked rows with `rank: null`,
 * so the model can tell "ranked last" (a real, poor rank) apart from
 * "couldn't be ranked" (bad/missing data).
 */
function rankSectors(
    sectors: readonly MarketSectorData[],
    names: Record<string, string>
): RankedSector[] {
    const toRow = (s: MarketSectorData, rank: number | null): RankedSector => ({
        symbol: s.symbol,
        name: names[s.symbol] ?? s.koreanName,
        price: s.price,
        changesPercentage: s.changesPercentage,
        rank,
    });
    const ranked = sectors
        .filter(isRankableSector)
        .toSorted((a, b) => b.changesPercentage - a.changesPercentage)
        .map((s, i) => toRow(s, i + 1));
    const unrankable = sectors
        .filter(s => !isRankableSector(s))
        .map(s => toRow(s, null));
    return [...ranked, ...unrankable];
}

/** `get_market_overview`'s `sectorBreadth` field shape — up/down/flat counts over the ~11 sector ETFs. */
interface SectorBreadthView {
    up: number;
    down: number;
    flat: number;
}

/** Breadth/spread only ever see rankable sectors (see `isRankableSector`) — same exclusion as `rankSectors`. */
function sectorBreadth(
    sectors: readonly MarketSectorData[]
): SectorBreadthView {
    return {
        up: sectors.filter(s => s.changesPercentage > 0).length,
        down: sectors.filter(s => s.changesPercentage < 0).length,
        flat: sectors.filter(s => s.changesPercentage === 0).length,
    };
}

/**
 * The market's fear & greed view, or `null` for a market that has none.
 *
 * `crypto` has no index of its own, and the US/KR snapshots are built from
 * their own market's breadth and sector data — handing one of them to a crypto
 * question would be a number from a different market with nothing marking it
 * as such.
 */
function fearGreedFor(
    market: DashboardScopeId
): Promise<MarketFearGreedView | null> {
    switch (market) {
        case 'crypto':
            return Promise.resolve(null);
        case 'kr':
            return getMarketFearGreedKrStatic();
        case 'us':
            return getMarketFearGreedStatic();
        default: {
            // 삼항으로 두면 네 번째 시장이 추가될 때 아무 결정도 하지 않은 채
            // 미국 지수로 흘러간다 — 화면에는 숫자가 정상으로 보인다.
            // `sessionSpecForDashboardScope`가 같은 유니온을 같은 방식으로 지킨다.
            const _exhaustive: never = market;
            console.error(
                `[get_market_overview] Unhandled market: ${String(_exhaustive)}`
            );
            return Promise.resolve(null);
        }
    }
}

/**
 * Market-wide mood: fear & greed + index/sector levels, plus the dashboard's
 * sector signal scan compacted to per-sector counts and the top flagged
 * signals. Both markets are scanned — `/market` and `/market/kr` already run
 * the same scan over their own `scope.sectorStocks`, and the scan is the only
 * screen the agent has when the user asks which stocks are worth a look, so
 * skipping it for `kr` left Korean discovery questions with nothing to answer
 * from. `Promise.allSettled` so one failing section (e.g. the signal scan)
 * never blanks the fear & greed or index data.
 */
export const getMarketOverviewTool: ToolExecutor = async (args, ctx) => {
    const market: DashboardScopeId = isDashboardScopeId(args.market)
        ? args.market
        : 'us';
    const scope = dashboardScopeOf(market);
    const [fgResult, summaryResult, sectorResult] = await Promise.allSettled([
        // 크립토에는 공포·탐욕 지수가 없다 — 미국·한국 스냅샷은 그 시장의 지수·
        // 섹터 데이터로 만들어지므로 빌려 쓸 수도 없다.
        fearGreedFor(market),
        getMarketSummaryStatic(scope),
        getSectorSignalsStatic(scope, DEFAULT_DASHBOARD_TIMEFRAME),
    ]);

    const fearGreedView =
        fgResult.status === 'fulfilled' ? fgResult.value : null;
    const summary =
        summaryResult.status === 'fulfilled' ? summaryResult.value : null;
    const sectorSignals =
        sectorResult.status === 'fulfilled' ? sectorResult.value : null;
    const fg = fearGreedView?.snapshot ?? null;
    const rawSectors = summary?.sectors ?? [];
    const rankableSectors = rawSectors.filter(isRankableSector);
    const rawIndices = summary?.indices ?? [];
    // 시장 브리핑은 `/market`·`/market/kr`이 이미 화면에 그리는 AI 요약이고,
    // peek은 **캐시 읽기 전용**이라 LLM 비용이 0이다(`get_economy`가 거시 브리핑을
    // 같은 방식으로 붙인다). 요약이 먼저 필요해 위 `allSettled`에 넣지 못한다 —
    // core 캐시 키가 그 시세에서 파생된다. `hasHubPage`가 false인 scope는
    // 아예 조회하지 않는다 — 프리웜(`seo-prewarm/hubs.ts`)이 그 시장의 브리핑을
    // 굽지 않으므로 **확정 미스**이고, 호출해 봤자 Redis 왕복만 버린다. 도구를
    // 위해 굽게 만드는 쪽은 더 나쁘다(아무도 읽지 않는 LLM 호출이 매일 밤 추가된다).
    //
    // 셋 모두 요약에만 의존하고 서로는 독립이라 한 번에 돌린다(직렬이면 지연이 합이 된다).
    // 지수 일봉은 요청당 지수 수만큼(미국 몇 개)만 읽고, 인스턴스 메모리 LRU
    // (`getCachedBarsWithIndicators`)가 같은 키를 다른 도구·요청과 공유해 재호출은 provider를 안 친다.
    const [names, briefing, indexCloses] = await Promise.all([
        sectorDisplayNames(ctx.locale, rawSectors),
        summary === null || !scope.hasHubPage
            ? Promise.resolve(null)
            : peekBriefingStatic(
                  summary,
                  new Date().toISOString().slice(0, ISO_DATE_HOUR_SLICE_END),
                  scope
              ).catch(error => {
                  logToolDegrade('get_market_overview', 'briefing peek', error);
                  return null;
              }),
        Promise.all(rawIndices.map(i => loadIndexLastClose(i, market))),
    ]);
    const rankedSectors = rankSectors(rawSectors, names);

    return {
        asOf: new Date().toISOString(),
        source: 'market dashboard cache (1h)',
        market,
        fearGreed: fg && {
            score: fg.score,
            label: fg.label,
            factors: fg.factors.map(f => ({
                key: f.key,
                percentile: f.percentile,
            })),
            // 게이지 옆에 이미 그려지는 과거 대비 점수. 없으면 "지난주보다
            // 탐욕이 심해졌나" 류 질문에 오늘 점수 하나로만 답하게 된다.
            comparisons: fearGreedView?.comparisons ?? [],
        },
        // `price` is a live/last-trade quote (FMP `/quote`, hourly cache; the
        // quote carries no timestamp, so there is no `priceAsOf`) — it can
        // differ from the official close. For "the close" or a settlement
        // value (e.g. VIX) answer from `lastClose`/`lastCloseDate`, the last
        // completed daily bar; `null` when the daily bars could not be loaded.
        indices: rawIndices.map((i, n) => ({
            symbol: i.symbol,
            price: i.price,
            changesPercentage: i.changesPercentage,
            ...(indexCloses[n] ?? NO_LAST_CLOSE),
        })),
        sectors: rankedSectors,
        // Named `sectorBreadth`, not `breadth` — the counts are the ~11
        // sector ETFs up/down/flat, not market-wide advancers/decliners
        // (core's own tool description already says `sectorBreadth`).
        sectorBreadth:
            rankableSectors.length > 0 ? sectorBreadth(rankableSectors) : null,
        bestWorstSpreadPp:
            rankableSectors.length > 0
                ? ppDelta(
                      Math.max(
                          ...rankableSectors.map(s => s.changesPercentage)
                      ),
                      Math.min(...rankableSectors.map(s => s.changesPercentage))
                  )
                : null,
        sectorSignals: sectorSignals && {
            computedAt: sectorSignals.computedAt,
            countsBySector: countsBySector(sectorSignals.stocks),
            topSignals: topSignals(sectorSignals.stocks),
        },
        briefing: briefing && {
            summary: briefing.summary,
            dominantThemes: briefing.dominantThemes,
            riskSentiment: briefing.riskSentiment,
        },
    };
};
