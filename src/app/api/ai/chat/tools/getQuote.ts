import 'server-only';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import type { ToolExecutor } from './index';

const MAX_SYMBOLS = 3;

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
                // A DB/FMP failure degrades to querying by the canonical
                // symbol rather than failing this symbol's quote.
                getAssetInfo(symbol).catch(() => null),
            ]);
            const quote = await getCachedMarketDataProvider(
                sessionSpecFor(profile)
            ).getQuote(asset?.fmpSymbol ?? symbol);
            if (quote === null) return { symbol, found: false };
            return {
                symbol,
                found: true,
                price: quote.price,
                changesPercentage: quote.changesPercentage,
                currency: getDescriptor(profile).priceFormat.currency,
                marketProfile: profile,
                quoteDelayMinutes: getDescriptor(profile).quoteDelayMinutes,
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
