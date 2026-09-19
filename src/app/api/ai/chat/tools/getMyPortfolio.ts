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
import { currencyFractionDigits } from '@/shared/lib/priceFormat';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import type { ToolExecutor } from './index';
import { logToolDegrade } from './logToolDegrade';
import { pctVs, ratioPct } from './percent';

/**
 * Max concurrent quote lookups per `getMyPortfolioTool` call (MISTAKES.md
 * §0.8) — `fetchRawHolding` does one external quote lookup per holding and
 * `findByUser` has no holdings cap, so an unbounded fan-out would send one
 * request per row at once. Each lookup goes through `getCachedMarketDataProvider`'s
 * Redis cache, so most calls are cache hits and this only bounds the worst
 * case (cold cache / large portfolio). Set below the prewarm batch's peer
 * chunk size (`SYMBOL_CONCURRENCY` = 6 in
 * `src/app/api/cron/seo-prewarm/runPrewarmBatch.ts`).
 */
const QUOTE_CONCURRENCY = 5;

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
    } catch (error) {
        logToolDegrade('get_my_portfolio', 'quote lookup', error);
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

/**
 * Round a money field (`marketValue`/`costBasis`/`pnl`, per-holding or per-
 * currency total) to its currency's minor unit — decimal places come from
 * `currencyFractionDigits` (`shared/lib/priceFormat.ts`), not `roundNumber`'s
 * significant-digit rule — using half-away-from-zero rounding (150.005 →
 * 150.01, -150.005 → -150.01).
 *
 * `roundNumber` (`roundIndicators.ts`) was built for indicator VALUES, where
 * digit count should track magnitude. Money is a currency amount, not a
 * measurement: it always has the same number of decimals regardless of size.
 * Using significant digits here lost cents and got worse the bigger the
 * account got — measured: a $10,874.63 total came back as `10874.6` (6
 * sig-figs), and a $1,234,567.89 total would come back as `1234570` (rounded
 * to the TENS place). USD/crypto keep cents (2dp); KRW has no minor unit
 * (원화 호가 관례, matches `KR_EQUITY_DESCRIPTOR.priceFormat.precision`).
 *
 * NOT `Number(value.toFixed(d))` — binary floats make `toFixed` inconsistent
 * exactly at the half-cent boundary a user-entered `averagePrice` can land
 * on: `(150.005).toFixed(2) === '150.00'` (should round up) while
 * `(10.005).toFixed(2) === '10.01'`, because 150.005 and 10.005 aren't
 * exactly representable and happen to round to the nearest double on
 * opposite sides of .005. Nudging the magnitude by a relative
 * `Number.EPSILON` before `Math.round` pushes true .5 boundaries the same
 * way regardless of which side the float representation drifted to, without
 * going through a decimal string (so float noise like
 * `2.2737367544323206e-13`, from subtracting two equal raw totals, rounds to
 * `0` instead of round-tripping through a string). `-0` (e.g. a fully offset
 * pnl) is normalized to `0` so the model never reports a "-0 pnl".
 */
function roundMoney(value: number, currency: string): number {
    const factor = 10 ** currencyFractionDigits(currency);
    const magnitude =
        Math.round(Math.abs(value) * (1 + Number.EPSILON) * factor) / factor;
    const rounded = Math.sign(value) * magnitude;
    return rounded === 0 ? 0 : rounded;
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
 * currency totals) runs on RAW values first; rounding is applied exactly
 * once, at the very end, to build the OUTPUT shapes — `holdings`/`totals`
 * are built via two straight `.map` passes over already-fully-computed raw
 * data, never mutated afterward. Money fields (costBasis/marketValue/pnl,
 * per-holding and per-currency total) use `roundMoney` (currency minor
 * unit — see `currencyFractionDigits` in `shared/lib/priceFormat.ts`);
 * percent fields (dayChangePct/pnlPct/weightPct) keep
 * `roundNumber`/`pctVs`/`ratioPct` as before — only the money path changed.
 */
export const getMyPortfolioTool: ToolExecutor = async (_args, ctx) => {
    const rows = await new DrizzlePortfolioRepository(
        getDatabaseClient().db
    ).findByUser(ctx.userId);

    // withConcurrencyLimit settles every call rather than rejecting on the
    // first failure, so the previous Promise.all semantics are rebuilt by
    // hand: throw the first rejection in input order, otherwise unwrap the
    // fulfilled values. A quote failure never lands here — it already
    // degrades to null inside `fetchValidatedQuote`; what rejects is a
    // non-quote per-holding step such as `resolveMarketProfile`, which fails
    // the whole tool call as before (the dispatcher's `logToolError` logs it).
    const settled = await withConcurrencyLimit(
        rows,
        QUOTE_CONCURRENCY,
        fetchRawHolding
    );
    const rejected = settled.find(
        (s): s is PromiseRejectedResult => s.status === 'rejected'
    );
    if (rejected) throw rejected.reason;
    const rawHoldings = settled.map(
        (s): RawHolding => (s as PromiseFulfilledResult<RawHolding>).value
    );

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
                    : roundMoney(h.marketValueRaw, h.currency),
            costBasis: roundMoney(h.costBasisRaw, h.currency),
            pnl:
                h.marketValueRaw === null
                    ? null
                    : roundMoney(h.marketValueRaw - h.costBasisRaw, h.currency),
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
                    : roundMoney(rawTotal.marketValueRaw, currency),
            costBasis: roundMoney(rawTotal.costBasisRaw, currency),
            pnl:
                rawTotal.marketValueRaw === null
                    ? null
                    : roundMoney(
                          rawTotal.marketValueRaw - rawTotal.costBasisRaw,
                          currency
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
