import 'server-only';
import type { MarketSectorData, StockSignalResult } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import { getMarketFearGreedKrStatic } from '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import { dashboardScopeOf } from '@/shared/config/dashboardScope';
import type { Locale } from '@/shared/i18n/locales';
import type { ToolExecutor } from './index';
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
 * Market-wide mood: fear & greed + index/sector levels, plus (US only) the
 * dashboard's sector signal scan compacted to per-sector counts and the top
 * flagged signals. `Promise.allSettled` so one failing section (e.g. the
 * signal scan) never blanks the fear & greed or index data.
 */
export const getMarketOverviewTool: ToolExecutor = async (args, ctx) => {
    const market = args.market === 'kr' ? 'kr' : 'us';
    const scope = dashboardScopeOf(market);
    const [fgResult, summaryResult, sectorResult] = await Promise.allSettled([
        market === 'kr'
            ? getMarketFearGreedKrStatic()
            : getMarketFearGreedStatic(),
        getMarketSummaryStatic(scope),
        market === 'us'
            ? getSectorSignalsStatic(scope, DEFAULT_DASHBOARD_TIMEFRAME)
            : Promise.resolve(null),
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
    const names = await sectorDisplayNames(ctx.locale, rawSectors);
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
        },
        indices:
            summary?.indices.map(i => ({
                symbol: i.symbol,
                price: i.price,
                changesPercentage: i.changesPercentage,
            })) ?? [],
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
    };
};
