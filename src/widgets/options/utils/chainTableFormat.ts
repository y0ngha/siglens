/**
 * Cell formatters for the options chain table. Options trade only on US
 * venues, so dollars and `en-US` separators are pinned: server and browser
 * output stay identical (hydration-safe).
 */

const countFormatter = new Intl.NumberFormat('en-US');

const quoteFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** 정수 행사가는 소수 없이(`$1,050`), 아니면 한 자리(`$102.5`). */
const strikeFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
});

const EMPTY_CELL = '-';

/** Format a contract count or open interest with thousands separators. */
export function formatOi(value: number): string {
    return countFormatter.format(value);
}

/** Format an implied-volatility fraction as a one-decimal percent; null → `-`. */
export function formatIv(value: number | null): string {
    if (value === null) return EMPTY_CELL;
    return `${(value * 100).toFixed(1)}%`;
}

const formatQuote = (value: number | null): string =>
    value === null ? EMPTY_CELL : quoteFormatter.format(value);

/** Format a bid/ask pair as `$bid/$ask`; `-` when both sides are missing. */
export function formatBidAsk(bid: number | null, ask: number | null): string {
    if (bid === null && ask === null) return EMPTY_CELL;
    return `${formatQuote(bid)}/${formatQuote(ask)}`;
}

/** Format a strike price in dollars. */
export function formatStrike(strike: number): string {
    return strikeFormatter.format(strike);
}
