import type { MarketDailyClose } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';

/** Sessions per fixture series — comfortably past the 185 needed for `confidence: 'normal'`. */
const FIXTURE_SESSIONS = 400;

/** Anchor for fixture dates. Fixed, so the rendered `asOf` never drifts between runs. */
const FIXTURE_ANCHOR_UTC = Date.UTC(2026, 0, 1);

/** Deterministic LCG — E2E fixtures must never depend on `Math.random`. */
function lcg(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
}

/** Stable per-symbol seed so each series has its own shape but never changes run to run. */
function seedFor(symbol: string): number {
    return (
        [...symbol].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) % 100000
    );
}

/**
 * Deterministic stand-in for FMP daily closes, used only under `E2E_TEST`.
 *
 * CI runs the E2E suite with no FMP key on purpose, so without this the
 * `/fear-greed` page could only ever be exercised in its "insufficient data"
 * state — the gauge, the comparison row, and the factor bars would go
 * completely untested end to end. A random walk (seeded per symbol) gives every
 * factor a non-degenerate history to rank against, so a real score comes out
 * the other side; the exact number is not meaningful and specs should not
 * assert it.
 */
export function e2eDailyCloses(symbol: string): MarketDailyClose[] {
    const next = lcg(seedFor(symbol));
    let close = 100;

    return Array.from({ length: FIXTURE_SESSIONS }, (_, i) => {
        close *= 1 + (next() - 0.5) * 0.04;
        return {
            date: new Date(FIXTURE_ANCHOR_UTC + i * MS_PER_DAY)
                .toISOString()
                .slice(0, 10),
            close,
        };
    });
}
