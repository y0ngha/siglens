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
import { MS_PER_DAY } from '@/domain/constants/time';

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

const ET_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

interface EtDateParts {
    year: number;
    month: number;
    day: number;
}

/**
 * Returns an instant anchored at noon UTC on the same *calendar day in
 * America/New_York* as `now`. Using noon avoids DST-transition windows
 * (the few hours each spring/fall where a wall-clock value is ambiguous).
 *
 * The previous implementation hardcoded `-4h` (EDT), which off-by-one
 * for ~5 months of the year (EST is `-5h`). DTE math rounds to days, so
 * a 1h drift could still cross a midnight boundary — replaced with
 * IANA-aware date-part extraction via `Intl.DateTimeFormat`.
 */
function etMidnight(now: Date): Date {
    // `formatToParts` returns ~3-5 items; reduce+spread cost is negligible.
    // Declarative form preferred over let+for mutation.
    const { year, month, day } = ET_DATE_FORMATTER.formatToParts(now).reduce<EtDateParts>(
        (acc, part) => {
            if (part.type === 'year')
                return { ...acc, year: Number.parseInt(part.value, 10) };
            if (part.type === 'month')
                return { ...acc, month: Number.parseInt(part.value, 10) };
            if (part.type === 'day')
                return { ...acc, day: Number.parseInt(part.value, 10) };
            return acc;
        },
        { year: 0, month: 0, day: 0 }
    );
    return new Date(Date.UTC(year, month - 1, day, 12));
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
export function normalizeYahooExpiration(
    yexp: YahooOption,
    now: Date
): OptionsChain {
    const expirationDate = yexp.expirationDate.toISOString().slice(0, 10);

    const expMidnight = new Date(`${expirationDate}T00:00:00.000Z`);
    const refMidnight = etMidnight(now);
    const daysToExpiration = Math.max(
        0,
        Math.round((expMidnight.getTime() - refMidnight.getTime()) / MS_PER_DAY)
    );

    const calls = yexp.calls
        .map(normalizeYahooContract)
        .toSorted((a, b) => a.strike - b.strike);

    const puts = yexp.puts
        .map(normalizeYahooContract)
        .toSorted((a, b) => a.strike - b.strike);

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
    const chains = response.options
        .map(exp => normalizeYahooExpiration(exp, now))
        .toSorted((a, b) => a.expirationDate.localeCompare(b.expirationDate));

    return {
        symbol: response.underlyingSymbol,
        underlyingPrice: response.quote.regularMarketPrice ?? 0,
        chains,
        capturedAt: now.toISOString(),
    };
}
