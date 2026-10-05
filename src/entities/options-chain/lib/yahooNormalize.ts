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
import { MS_PER_DAY } from '@/shared/config/time';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

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

const ET_TIME_ZONE = 'America/New_York';

// 정오(UTC) — ET 캘린더 날짜를 UTC 인스턴트로 매핑할 때 DST 전이 윈도우
// (봄·가을 각 몇 시간씩 시각이 모호한 구간)에 걸리지 않도록 하루의 중간
// 시점에 앵커링한다. 자정 대신 정오를 쓰는 이유는 자정 자체가 DST
// 변환 시각이라 시간 산술이 한 시간씩 어긋날 수 있어서.
const ET_NOON_UTC_HOUR = 12;

/**
 * Returns an instant anchored at noon UTC on the same *calendar day in
 * America/New_York* as `now`. Using noon avoids DST-transition windows
 * (the few hours each spring/fall where a wall-clock value is ambiguous).
 *
 * The previous implementation hardcoded `-4h` (EDT), which off-by-one
 * for ~5 months of the year (EST is `-5h`). DTE math rounds to days, so
 * a 1h drift could still cross a midnight boundary — replaced with
 * IANA-aware `zonedDate` (shared/lib/marketSessionDate).
 */
function etMidnight(now: Date): Date {
    const [year, month, day] = zonedDate(now, ET_TIME_ZONE)
        .split('-')
        .map(Number);
    return new Date(Date.UTC(year, month - 1, day, ET_NOON_UTC_HOUR));
}

/**
 * Calendar days from today (ET) to `expirationDate` (`YYYY-MM-DD`), floored at 0.
 *
 * Shared by the Yahoo normalizer and the last-good fallback
 * (`rebaseOptionsSnapshot`) so a re-served snapshot counts days the same way a
 * freshly normalized one does.
 */
export function daysToExpirationFrom(
    expirationDate: string,
    now: Date
): number {
    const expMidnight = new Date(`${expirationDate}T00:00:00.000Z`);
    const refMidnight = etMidnight(now);
    return Math.max(
        0,
        Math.round((expMidnight.getTime() - refMidnight.getTime()) / MS_PER_DAY)
    );
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
    const expirationDate = toUtcIsoDate(yexp.expirationDate);

    const daysToExpiration = daysToExpirationFrom(expirationDate, now);

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
