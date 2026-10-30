/** Row-limiting for the trades table: caps the SSR payload and reports what was cut. */

/** Max rows rendered in a single SSR pass (newest-first). */
export const MAX_ROWS = 50;

interface LimitedRows<T> {
    rows: T[];
    total: number;
    truncated: boolean;
}

/** Keeps the newest `MAX_ROWS` rows and reports the cut so the UI can say rows were omitted. */
export function limitRows<T>(trades: T[]): LimitedRows<T> {
    return {
        rows: trades.slice(0, MAX_ROWS),
        total: trades.length,
        truncated: trades.length > MAX_ROWS,
    };
}
