/**
 * OptionsDataProvider implementation backed by yahoo-finance2.
 *
 * Error policy: all errors are caught, logged via console.error, and returned
 * as null. The consuming use-case treats null as "no data available" and
 * should not receive thrown exceptions from the data layer.
 */
import YahooFinance from 'yahoo-finance2';
import { sanitizeOptionsChain } from '@y0ngha/siglens-core';
import type {
    OptionsChain,
    OptionsDataProvider,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';
import {
    normalizeYahooExpiration,
    normalizeYahooSnapshot,
    type YahooOptionsResult,
} from './yahooNormalize';

const yahooFinance = new YahooFinance();

export class YahooOptionsAdapter implements OptionsDataProvider {
    /**
     * Fetch the full options snapshot (all expirations) for a symbol.
     *
     * After normalization, each chain is run through `sanitizeOptionsChain`.
     * Chains rejected by sanitization (null return) are filtered out.
     * If no chains remain, returns null.
     */
    async fetchSnapshot(symbol: string): Promise<OptionsSnapshot | null> {
        try {
            const response = await yahooFinance.options(symbol);

            if (!response.options || response.options.length === 0) {
                return null;
            }

            // Cast through unknown: OptionsResult.quote is a large union type
            // that TypeScript cannot prove structurally compatible with our
            // local YahooOptionsResult interface, even though regularMarketPrice
            // is present at runtime across all Quote union members.
            const raw = normalizeYahooSnapshot(
                response as unknown as YahooOptionsResult,
                new Date()
            );

            const sanitizedChains = raw.chains
                .map((chain) => sanitizeOptionsChain(chain))
                .filter((chain): chain is OptionsChain => chain !== null);

            if (sanitizedChains.length === 0) {
                return null;
            }

            return { ...raw, chains: sanitizedChains };
        } catch (err) {
            console.error('[YahooOptionsAdapter] fetchSnapshot failed', err);
            return null;
        }
    }

    /**
     * Fetch a single expiration's chain for a symbol.
     *
     * Passes `{ date }` to yahoo-finance2 to filter to the requested expiration
     * date server-side. Takes the first entry in `options[]` from the response.
     * Returns null if the expiration is unavailable or rejected by sanitization.
     */
    async fetchChain(
        symbol: string,
        expirationDate: string
    ): Promise<OptionsChain | null> {
        try {
            const response = await yahooFinance.options(symbol, {
                date: new Date(`${expirationDate}T00:00:00Z`),
            });

            const first = response.options?.[0];
            if (!first) {
                return null;
            }

            const normalized = normalizeYahooExpiration(first, new Date());
            return sanitizeOptionsChain(normalized);
        } catch (err) {
            console.error('[YahooOptionsAdapter] fetchChain failed', err);
            return null;
        }
    }

    /**
     * Fast existence check — resolves true when the symbol has at least one
     * listed expiration, false on any error or when no expirations are available.
     */
    async hasOptionsMarket(symbol: string): Promise<boolean> {
        try {
            const response = await yahooFinance.options(symbol);
            return (response.expirationDates?.length ?? 0) > 0;
        } catch {
            return false;
        }
    }
}
