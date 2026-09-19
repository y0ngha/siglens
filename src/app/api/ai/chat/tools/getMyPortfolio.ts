import 'server-only';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { roundNumber } from '@/entities/bars/lib/roundIndicators';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import { getDatabaseClient } from '@/shared/db/client';
import type { ToolExecutor } from './index';
import { pctVs, ratioPct } from './percent';

interface HoldingView {
    symbol: string;
    companyName: string | null;
    quantity: number;
    averagePrice: number;
    currency: string;
    price: number | null;
    dayChangePct: number | null;
    marketValue: number | null;
    costBasis: number;
    pnl: number | null;
    pnlPct: number | null;
    weightPct: number | null;
}

interface CurrencyTotal {
    currency: string;
    marketValue: number | null;
    costBasis: number;
    pnl: number | null;
    pnlPct: number | null;
}

/**
 * One holding's quote-derived figures BEFORE any rounding — `costBasis`/
 * `marketValue` here are the RAW `quantity × price` products,
 * not `roundNumber`'d yet. Keeping them raw through every downstream sum
 * (currency totals) and ratio (`pnlPct`/`weightPct`) avoids double-rounding:
 * rounding once at holding-construction time and AGAIN after summing a
 * currency group (the previous shape) can drift from rounding the raw sum
 * once, and `pctVs`/`ratioPct` fed already-rounded inputs compound a THIRD
 * rounding on top of their own single internal one.
 */
interface RawHolding {
    symbol: string;
    companyName: string | null;
    quantity: number;
    averagePrice: number;
    currency: string;
    price: number | null;
    dayChangePctRaw: number | null;
    costBasisRaw: number;
    marketValueRaw: number | null;
}

/** Raw currency-group sums — see {@link RawHolding} for why these stay unrounded until output. */
interface RawCurrencyTotal {
    currency: string;
    costBasisRaw: number;
    /** `null` when ANY holding in the group has an unknown `marketValueRaw` (spec §0 null rule) — a partial sum would understate exposure rather than say "unknown". */
    marketValueRaw: number | null;
}

/**
 * `quoteWithTimeout`'s result, validated — `null` when the lookup failed
 * (the adapter returned `null`), timed out, or returned a zero/negative
 * price (bad upstream data) — so an unusable quote reads as "unknown", never
 * as a real -100% pnlPct. Extracted so `fetchRawHolding` can bind `price`/`dayChangePctRaw`
 * with `const` instead of two mutated `let`s.
 */
async function fetchValidatedQuote(
    marketProfile: MarketProfileId,
    symbol: string
): Promise<{ price: number; dayChangePctRaw: number | null } | null> {
    try {
        const quote = await quoteWithTimeout(
            getCachedMarketDataProvider(sessionSpecFor(marketProfile)),
            symbol
        );
        if (!quote || !Number.isFinite(quote.price) || quote.price <= 0)
            return null;
        return {
            price: quote.price,
            dayChangePctRaw: Number.isFinite(quote.changesPercentage)
                ? quote.changesPercentage
                : null,
        };
    } catch {
        // Quote failure → price/dayChangePct/marketValue/pnl/pnlPct stay
        // null; the holding is still listed (spec §3.3).
        return null;
    }
}

/**
 * One row's quote-derived figures, bounded by the same `QUOTE_LOOKUP_TIMEOUT_MS`
 * `getCachedAnalysis.ts` uses — an FMP 429 storm must not stall this tool call
 * past a few seconds per holding.
 */
async function fetchRawHolding(r: {
    symbol: string;
    companyName: string | null;
    quantity: string | number;
    averagePrice: string | number;
    fmpSymbol?: string | null;
}): Promise<RawHolding> {
    const quantity = Number(r.quantity);
    const averagePrice = Number(r.averagePrice);
    const costBasisRaw = quantity * averagePrice;
    const marketProfile = await resolveMarketProfile(r.symbol);
    const currency = getDescriptor(marketProfile).priceFormat.currency;
    const validated = await fetchValidatedQuote(
        marketProfile,
        r.fmpSymbol ?? r.symbol
    );
    const price = validated?.price ?? null;
    const dayChangePctRaw = validated?.dayChangePctRaw ?? null;
    return {
        symbol: r.symbol,
        companyName: r.companyName,
        quantity,
        averagePrice,
        currency,
        price,
        dayChangePctRaw,
        costBasisRaw,
        marketValueRaw: price === null ? null : quantity * price,
    };
}

/** Raw per-currency subtotal from RAW holding figures — never from already-rounded ones. */
function rawCurrencyTotal(
    currency: string,
    rawHoldings: readonly RawHolding[]
): RawCurrencyTotal {
    const marketValues = rawHoldings.map(h => h.marketValueRaw);
    return {
        currency,
        costBasisRaw: rawHoldings.reduce((sum, h) => sum + h.costBasisRaw, 0),
        marketValueRaw: marketValues.every((v): v is number => v !== null)
            ? marketValues.reduce((sum, v) => sum + v, 0)
            : null,
    };
}

/**
 * The signed-in user's own holdings (R9), with quote-derived P/L (spec §3.3,
 * audit B5) — the model used to be handed raw qty × avg price and had to
 * compute value/P/L/weight itself.
 *
 * `weightPct` is always relative to its OWN currency's subtotal, never a
 * cross-currency blend (adding un-converted USD + KRW would be meaningless).
 * `weightScope: 'currency'` is added at the top level only when the
 * portfolio actually spans more than one currency, so the model knows the
 * weights don't sum to 100% of the whole portfolio in that case.
 *
 * All arithmetic (costBasis/marketValue/pnl/pnlPct/weightPct, and the
 * currency totals) runs on RAW values first; `roundNumber`/`pctVs`/`ratioPct`
 * are applied exactly once, at the very end, to build the OUTPUT shapes —
 * `holdings`/`totals` are built via two straight `.map`
 * passes over already-fully-computed raw data, never mutated afterward.
 */
export const getMyPortfolioTool: ToolExecutor = async (_args, ctx) => {
    const rows = await new DrizzlePortfolioRepository(
        getDatabaseClient().db
    ).findByUser(ctx.userId);

    const rawHoldings = await Promise.all(rows.map(fetchRawHolding));

    const currencies = [...new Set(rawHoldings.map(h => h.currency))];
    const rawTotalByCurrency = new Map(
        currencies.map(currency => [
            currency,
            rawCurrencyTotal(
                currency,
                rawHoldings.filter(h => h.currency === currency)
            ),
        ])
    );

    const holdings: HoldingView[] = rawHoldings.map(h => {
        const rawTotal = rawTotalByCurrency.get(h.currency)!;
        return {
            symbol: h.symbol,
            companyName: h.companyName,
            quantity: h.quantity,
            averagePrice: h.averagePrice,
            currency: h.currency,
            price: h.price,
            dayChangePct:
                h.dayChangePctRaw === null
                    ? null
                    : roundNumber(h.dayChangePctRaw),
            marketValue:
                h.marketValueRaw === null
                    ? null
                    : roundNumber(h.marketValueRaw),
            costBasis: roundNumber(h.costBasisRaw),
            pnl:
                h.marketValueRaw === null
                    ? null
                    : roundNumber(h.marketValueRaw - h.costBasisRaw),
            pnlPct: pctVs(h.marketValueRaw, h.costBasisRaw),
            weightPct: ratioPct(h.marketValueRaw, rawTotal.marketValueRaw),
        };
    });

    const totals: CurrencyTotal[] = currencies.map(currency => {
        const rawTotal = rawTotalByCurrency.get(currency)!;
        return {
            currency,
            marketValue:
                rawTotal.marketValueRaw === null
                    ? null
                    : roundNumber(rawTotal.marketValueRaw),
            costBasis: roundNumber(rawTotal.costBasisRaw),
            pnl:
                rawTotal.marketValueRaw === null
                    ? null
                    : roundNumber(
                          rawTotal.marketValueRaw - rawTotal.costBasisRaw
                      ),
            pnlPct: pctVs(rawTotal.marketValueRaw, rawTotal.costBasisRaw),
        };
    });

    return {
        asOf: new Date().toISOString(),
        source: 'SIGLENS portfolio',
        count: holdings.length,
        holdings,
        totals,
        ...(currencies.length > 1 ? { weightScope: 'currency' as const } : {}),
    };
};
