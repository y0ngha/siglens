/**
 * Normalizes yahoo-finance2 options response shapes into siglens-core domain types.
 *
 * All field-level defaulting happens here — domain types treat `volume` and
 * `openInterest` as `number` (never null), so we apply `?? 0` at this boundary.
 * Nullable price/IV fields are preserved as `number | null`.
 */
import type {
    OptionsChain,
    OptionsContract,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';

/**
 * Structural types mirroring yahoo-finance2 v3 CallOrPut / Option / OptionsResult.
 *
 * We use local structural interfaces rather than deep imports from the library
 * because the project uses `moduleResolution: "node"`, which does not resolve
 * subpath exports for type-only deep imports. The shapes below are verified
 * against the live introspection output (see implementation notes in
 * YahooOptionsAdapter.ts).
 */
export interface YahooCallOrPut {
    contractSymbol: string;
    strike: number;
    currency?: string;
    lastPrice: number;
    change: number;
    percentChange?: number;
    volume?: number;
    openInterest?: number;
    bid?: number;
    ask?: number;
    contractSize: 'REGULAR';
    expiration: Date;
    lastTradeDate: Date;
    impliedVolatility: number;
    inTheMoney: boolean;
}

export interface YahooOption {
    expirationDate: Date;
    hasMiniOptions: boolean;
    calls: YahooCallOrPut[];
    puts: YahooCallOrPut[];
}

export interface YahooOptionsResult {
    underlyingSymbol: string;
    expirationDates: Date[];
    strikes: number[];
    hasMiniOptions: boolean;
    quote: { regularMarketPrice?: number };
    options: YahooOption[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Approximate ET-midnight reference for DTE calculation.
 * Uses a fixed -4h offset (EDT). This matches the plan verbatim.
 *
 * NOTE: Does not account for EST/EDT switchover (Nov → Mar). For a
 * production-grade implementation, replace with a proper timezone library.
 */
function etMidnight(now: Date): Date {
    const offset = -4 * 60; // EDT offset in minutes
    const utcMidnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    return new Date(utcMidnight.getTime() - offset * 60 * 1000);
}

/** Normalize a single call or put contract from yahoo-finance2 into an OptionsContract. */
export function normalizeYahooContract(c: YahooCallOrPut): OptionsContract {
    return {
        contractSymbol: c.contractSymbol,
        strike: c.strike,
        lastPrice: c.lastPrice ?? null,
        bid: c.bid ?? null,
        ask: c.ask ?? null,
        volume: c.volume ?? 0,
        openInterest: c.openInterest ?? 0,
        impliedVolatility: c.impliedVolatility ?? null,
        inTheMoney: c.inTheMoney,
    };
}

/**
 * Normalize a single yahoo-finance2 Option (one expiration) into an OptionsChain.
 *
 * Contracts are sorted ascending by strike.
 */
export function normalizeYahooExpiration(yexp: YahooOption, now: Date): OptionsChain {
    const expirationDate = yexp.expirationDate.toISOString().slice(0, 10);

    const expMidnight = new Date(`${expirationDate}T00:00:00.000Z`);
    const refMidnight = etMidnight(now);
    const daysToExpiration = Math.max(
        0,
        Math.round((expMidnight.getTime() - refMidnight.getTime()) / MS_PER_DAY)
    );

    const calls = [...yexp.calls]
        .map(normalizeYahooContract)
        .sort((a, b) => a.strike - b.strike);

    const puts = [...yexp.puts]
        .map(normalizeYahooContract)
        .sort((a, b) => a.strike - b.strike);

    return {
        expirationDate,
        daysToExpiration,
        calls,
        puts,
    };
}

/**
 * Normalize the top-level yahoo-finance2 OptionsResult into an OptionsSnapshot.
 *
 * Chains are sorted ascending by expirationDate.
 */
export function normalizeYahooSnapshot(
    response: YahooOptionsResult,
    now: Date
): OptionsSnapshot {
    const chains = [...response.options]
        .map((exp) => normalizeYahooExpiration(exp, now))
        .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));

    return {
        symbol: response.underlyingSymbol,
        underlyingPrice: response.quote.regularMarketPrice ?? 0,
        chains,
        capturedAt: now.toISOString(),
    };
}
