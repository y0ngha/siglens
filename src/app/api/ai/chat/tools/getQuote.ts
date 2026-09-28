import 'server-only';
import type { MarketQuote } from '@y0ngha/siglens-core';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    assessFreshness,
    type FreshnessView,
    QUOTE_MAX_AGE_MS,
} from './freshness';
import type { ToolExecutor } from './index';
import { resolveAssetInfoOrNull } from './resolveAssetInfo';

const MAX_SYMBOLS = 3;

/**
 * `MarketQuote.timestamp` (core, unix seconds) is the provider's own quote
 * time, when the adapter reports one — `FmpMarketProvider`/`YahooMarketProvider`
 * both pass it through now (spec §3.8, audit B10). Falls
 * back to fetch time + `asOfIsFetchTime: true` only when the field is
 * absent, so a provider outage/degraded row that genuinely has no quote time
 * still gets an honest `asOf`.
 */
function quoteAsOf(quote: MarketQuote): {
    asOf: string;
    asOfIsFetchTime?: true;
    freshness?: FreshnessView;
} {
    if (quote.timestamp !== undefined && Number.isFinite(quote.timestamp)) {
        const asOfMs = quote.timestamp * MS_PER_SECOND;
        return {
            asOf: new Date(asOfMs).toISOString(),
            freshness: assessFreshness({
                asOfMs,
                maxAgeMs: QUOTE_MAX_AGE_MS,
                nowMs: Date.now(),
            }),
        };
    }
    return { asOf: new Date().toISOString(), asOfIsFetchTime: true };
}

/**
 * Per-symbol profile → session spec (KR = Yahoo, US/crypto = FMP), quoted
 * through `fmpSymbol` when the canonical symbol differs from the one the
 * provider expects (e.g. indices). `quoteDelayMinutes` is surfaced so the
 * model doesn't present a 20-minute-delayed KR quote as real-time.
 */
export const getQuoteTool: ToolExecutor = async args => {
    const symbols = (args.symbols as string[])
        .slice(0, MAX_SYMBOLS)
        .map(s => s.toUpperCase());
    // `allSettled`, not `all` — one symbol's provider error (e.g. FMP rate
    // limit on a single ticker) must not blank out every other requested
    // quote in the same call.
    const settled = await Promise.allSettled(
        symbols.map(async symbol => {
            const [profile, asset] = await Promise.all([
                resolveMarketProfile(symbol),
                resolveAssetInfoOrNull(symbol, 'get_quote'),
            ]);
            const quote = await getCachedMarketDataProvider(
                sessionSpecFor(profile)
            ).getQuote(asset?.fmpSymbol ?? symbol);
            if (quote === null) return { symbol, found: false };
            const descriptor = getDescriptor(profile);
            return {
                symbol,
                found: true,
                price: quote.price,
                changesPercentage: quote.changesPercentage,
                currency: descriptor.priceFormat.currency,
                marketProfile: profile,
                quoteDelayMinutes: descriptor.quoteDelayMinutes,
                ...quoteAsOf(quote),
            };
        })
    );
    const quotes = settled.map((result, i) =>
        result.status === 'fulfilled'
            ? result.value
            : { symbol: symbols[i]!, found: false }
    );
    return {
        asOf: new Date().toISOString(),
        source: 'market data provider (60s in-session cache)',
        quotes,
    };
};
