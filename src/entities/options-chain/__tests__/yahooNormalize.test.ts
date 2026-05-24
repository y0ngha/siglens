/**
 * Unit tests for yahooNormalize pure functions.
 *
 * No network calls, no external library imports — fixtures are constructed
 * locally using the exported structural interfaces from yahooNormalize.ts.
 */

import {
    normalizeYahooContract,
    normalizeYahooExpiration,
    normalizeYahooSnapshot,
} from '../lib/yahooNormalize';
import type {
    YahooCallOrPut,
    YahooOption,
    YahooOptionsResult,
} from '../lib/yahooNormalize';

function makeYahooContract(
    strike: number,
    overrides: Partial<YahooCallOrPut> = {}
): YahooCallOrPut {
    return {
        contractSymbol: `AAPL260515C${String(strike * 1000).padStart(8, '0')}`,
        strike,
        lastPrice: 2.5,
        change: 0,
        percentChange: 0,
        volume: 100,
        openInterest: 200,
        bid: 2.4,
        ask: 2.6,
        contractSize: 'REGULAR',
        expiration: new Date('2026-05-15T00:00:00.000Z'),
        lastTradeDate: new Date('2026-05-14T16:00:00Z'),
        impliedVolatility: 0.3,
        inTheMoney: false,
        ...overrides,
    };
}

function makeYahooExpiration(
    expirationDate: Date,
    calls: YahooCallOrPut[],
    puts: YahooCallOrPut[]
): YahooOption {
    return {
        expirationDate,
        hasMiniOptions: false,
        calls,
        puts,
    };
}

describe('normalizeYahooContract', () => {
    it('maps all fields from a fully-populated contract', () => {
        const raw = makeYahooContract(190, { inTheMoney: true });

        const result = normalizeYahooContract(raw);

        expect(result.contractSymbol).toBe(raw.contractSymbol);
        expect(result.strike).toBe(190);
        expect(result.lastPrice).toBe(2.5);
        expect(result.bid).toBe(2.4);
        expect(result.ask).toBe(2.6);
        expect(result.volume).toBe(100);
        expect(result.openInterest).toBe(200);
        expect(result.impliedVolatility).toBe(0.3);
        expect(result.inTheMoney).toBe(true);
    });

    it('defaults volume to 0 when undefined', () => {
        const raw = makeYahooContract(200, { volume: undefined });
        expect(normalizeYahooContract(raw).volume).toBe(0);
    });

    it('defaults openInterest to 0 when undefined', () => {
        const raw = makeYahooContract(200, { openInterest: undefined });
        expect(normalizeYahooContract(raw).openInterest).toBe(0);
    });

    it('defaults both volume and openInterest to 0 when both undefined', () => {
        const raw = makeYahooContract(200, {
            volume: undefined,
            openInterest: undefined,
        });
        const result = normalizeYahooContract(raw);
        expect(result.volume).toBe(0);
        expect(result.openInterest).toBe(0);
    });

    it('preserves lastPrice as null when the raw value is absent', () => {
        // lastPrice is required in the interface but the ?? null guard applies
        // when the value is explicitly 0-ish falsy — test via explicit cast
        const raw = makeYahooContract(200, {
            lastPrice: null as unknown as number,
        });
        expect(normalizeYahooContract(raw).lastPrice).toBeNull();
    });

    it('preserves bid as null when undefined', () => {
        const raw = makeYahooContract(200, { bid: undefined });
        expect(normalizeYahooContract(raw).bid).toBeNull();
    });

    it('preserves ask as null when undefined', () => {
        const raw = makeYahooContract(200, { ask: undefined });
        expect(normalizeYahooContract(raw).ask).toBeNull();
    });

    it('preserves impliedVolatility as null when absent', () => {
        const raw = makeYahooContract(200, {
            impliedVolatility: null as unknown as number,
        });
        expect(normalizeYahooContract(raw).impliedVolatility).toBeNull();
    });

    it('passes inTheMoney: false through unchanged', () => {
        const raw = makeYahooContract(210, { inTheMoney: false });
        expect(normalizeYahooContract(raw).inTheMoney).toBe(false);
    });
});

describe('normalizeYahooExpiration', () => {
    /**
     * now = 2026-05-14T16:00:00Z = 12:00 noon EDT.
     * etMidnight(now) → ET date is May 14 → Date.UTC(2026, 4, 14, 12) = 2026-05-14T12:00:00Z
     */
    const NOW = new Date('2026-05-14T16:00:00Z');

    it('converts expirationDate to ISO YYYY-MM-DD string', () => {
        const exp = makeYahooExpiration(
            new Date('2026-05-15T00:00:00.000Z'),
            [makeYahooContract(190)],
            []
        );
        const result = normalizeYahooExpiration(exp, NOW);
        expect(result.expirationDate).toBe('2026-05-15');
    });

    it('computes daysToExpiration ≥ 0', () => {
        const exp = makeYahooExpiration(
            new Date('2026-05-15T00:00:00.000Z'),
            [makeYahooContract(190)],
            []
        );
        const result = normalizeYahooExpiration(exp, NOW);
        expect(result.daysToExpiration).toBeGreaterThanOrEqual(0);
    });

    it('computes daysToExpiration = 1 for next-day expiration (noon-ET reference)', () => {
        /**
         * expMidnight = 2026-05-15T00:00:00Z
         * refMidnight = 2026-05-14T12:00:00Z  (etMidnight of NOW)
         * diff = 12 h → 0.5 days → Math.round(0.5) = 1
         */
        const exp = makeYahooExpiration(
            new Date('2026-05-15T00:00:00.000Z'),
            [makeYahooContract(190)],
            []
        );
        const result = normalizeYahooExpiration(exp, NOW);
        expect(result.daysToExpiration).toBe(1);
    });

    it('computes daysToExpiration = 8 for expiration 8 days out', () => {
        /**
         * expMidnight = 2026-05-22T00:00:00Z
         * refMidnight = 2026-05-14T12:00:00Z
         * diff = 7.5 days → Math.round = 8
         */
        const exp = makeYahooExpiration(
            new Date('2026-05-22T00:00:00.000Z'),
            [makeYahooContract(195)],
            []
        );
        const result = normalizeYahooExpiration(exp, NOW);
        expect(result.daysToExpiration).toBe(8);
    });

    it('clamps daysToExpiration to 0 for past expirations', () => {
        // Expiration before NOW
        const exp = makeYahooExpiration(
            new Date('2026-05-13T00:00:00.000Z'),
            [makeYahooContract(190)],
            []
        );
        const result = normalizeYahooExpiration(exp, NOW);
        expect(result.daysToExpiration).toBe(0);
    });

    it('sorts calls ascending by strike', () => {
        const exp = makeYahooExpiration(
            new Date('2026-05-15T00:00:00.000Z'),
            // Intentionally out of order
            [
                makeYahooContract(210),
                makeYahooContract(190),
                makeYahooContract(200),
            ],
            []
        );
        const result = normalizeYahooExpiration(exp, NOW);
        const strikes = result.calls.map(c => c.strike);
        expect(strikes).toEqual([190, 200, 210]);
    });

    it('sorts puts ascending by strike', () => {
        const exp = makeYahooExpiration(
            new Date('2026-05-15T00:00:00.000Z'),
            [],
            [
                makeYahooContract(210),
                makeYahooContract(190),
                makeYahooContract(200),
            ]
        );
        const result = normalizeYahooExpiration(exp, NOW);
        const strikes = result.puts.map(c => c.strike);
        expect(strikes).toEqual([190, 200, 210]);
    });

    it('returns arrays for calls and puts', () => {
        const exp = makeYahooExpiration(
            new Date('2026-05-15T00:00:00.000Z'),
            [makeYahooContract(190)],
            [makeYahooContract(190)]
        );
        const result = normalizeYahooExpiration(exp, NOW);
        expect(Array.isArray(result.calls)).toBe(true);
        expect(Array.isArray(result.puts)).toBe(true);
    });

    it('handles empty calls and puts arrays', () => {
        const exp = makeYahooExpiration(
            new Date('2026-05-15T00:00:00.000Z'),
            [],
            []
        );
        const result = normalizeYahooExpiration(exp, NOW);
        expect(result.calls).toHaveLength(0);
        expect(result.puts).toHaveLength(0);
    });
});

describe('normalizeYahooSnapshot', () => {
    const NOW = new Date('2026-05-14T16:00:00Z');

    function makeResponse(
        overrides: Partial<YahooOptionsResult> = {}
    ): YahooOptionsResult {
        return {
            underlyingSymbol: 'AAPL',
            expirationDates: [
                new Date('2026-05-22T00:00:00.000Z'),
                new Date('2026-05-15T00:00:00.000Z'),
            ],
            strikes: [190, 195, 200, 205],
            hasMiniOptions: false,
            quote: { regularMarketPrice: 195 },
            options: [
                makeYahooExpiration(
                    new Date('2026-05-22T00:00:00.000Z'),
                    [makeYahooContract(195), makeYahooContract(205)],
                    [makeYahooContract(195), makeYahooContract(205)]
                ),
                makeYahooExpiration(
                    new Date('2026-05-15T00:00:00.000Z'),
                    [makeYahooContract(190), makeYahooContract(200)],
                    [makeYahooContract(190), makeYahooContract(200)]
                ),
            ],
            ...overrides,
        };
    }

    it('sets symbol from underlyingSymbol', () => {
        const result = normalizeYahooSnapshot(makeResponse(), NOW);
        expect(result.symbol).toBe('AAPL');
    });

    it('sets underlyingPrice from quote.regularMarketPrice', () => {
        const result = normalizeYahooSnapshot(makeResponse(), NOW);
        expect(result.underlyingPrice).toBe(195);
    });

    it('falls back to 0 when quote.regularMarketPrice is undefined', () => {
        const response = makeResponse({
            quote: { regularMarketPrice: undefined },
        });
        const result = normalizeYahooSnapshot(response, NOW);
        expect(result.underlyingPrice).toBe(0);
    });

    it('sets capturedAt to now.toISOString()', () => {
        const result = normalizeYahooSnapshot(makeResponse(), NOW);
        expect(result.capturedAt).toBe(NOW.toISOString());
    });

    it('sorts chains ascending by expirationDate string', () => {
        // options array has May-22 before May-15 intentionally
        const result = normalizeYahooSnapshot(makeResponse(), NOW);
        expect(result.chains[0].expirationDate).toBe('2026-05-15');
        expect(result.chains[1].expirationDate).toBe('2026-05-22');
    });

    it('returns the correct number of chains', () => {
        const result = normalizeYahooSnapshot(makeResponse(), NOW);
        expect(result.chains).toHaveLength(2);
    });

    it('returns an array for chains', () => {
        const result = normalizeYahooSnapshot(makeResponse(), NOW);
        expect(Array.isArray(result.chains)).toBe(true);
    });

    it('normalizes each chain — calls sorted ascending by strike', () => {
        const response = makeResponse({
            options: [
                makeYahooExpiration(
                    new Date('2026-05-15T00:00:00.000Z'),
                    // Out of order
                    [makeYahooContract(200), makeYahooContract(190)],
                    []
                ),
            ],
        });
        const result = normalizeYahooSnapshot(response, NOW);
        const strikes = result.chains[0].calls.map(c => c.strike);
        expect(strikes).toEqual([190, 200]);
    });

    it('handles empty options array', () => {
        const response = makeResponse({ options: [] });
        const result = normalizeYahooSnapshot(response, NOW);
        expect(result.chains).toHaveLength(0);
    });
});
