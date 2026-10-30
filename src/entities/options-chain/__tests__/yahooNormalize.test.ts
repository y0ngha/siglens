/**
 * Unit tests for yahooNormalize pure functions.
 *
 * No network calls, no external library imports — fixtures are constructed
 * locally using the exported structural interfaces from yahooNormalize.ts.
 */

import { summarizeChainForLlm } from '@y0ngha/siglens-core';
import {
    MIN_PLAUSIBLE_IMPLIED_VOLATILITY,
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
     * etNoonUtc(now) → ET date is May 14 → Date.UTC(2026, 4, 14, 12) = 2026-05-14T12:00:00Z
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
         * refNoon = 2026-05-14T12:00:00Z  (etNoonUtc of NOW)
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
         * refNoon = 2026-05-14T12:00:00Z
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

describe('implied volatility that is not a market reading (dev-2026-10-22 A9)', () => {
    // Live Yahoo MSI 2026-11-20 chain, 2026-10-22 09:11 ET (pre-market): spot
    // 467.50, every near-ATM contract with bid = ask = 0 and solver-floor IVs.
    const NOW = new Date('2026-10-22T13:11:00Z');
    const msiContract = (
        strike: number,
        impliedVolatility: number,
        lastPrice: number
    ) =>
        makeYahooContract(strike, {
            contractSymbol: `MSI261120C${strike}`,
            impliedVolatility,
            lastPrice,
            bid: 0,
            ask: 0,
            expiration: new Date('2026-11-20T00:00:00.000Z'),
        });
    const msiChain = (): YahooOptionsResult => ({
        underlyingSymbol: 'MSI',
        expirationDates: [new Date('2026-11-20T00:00:00.000Z')],
        strikes: [450, 460, 470, 480],
        hasMiniOptions: false,
        quote: { regularMarketPrice: 467.5 },
        options: [
            makeYahooExpiration(
                new Date('2026-11-20T00:00:00.000Z'),
                [
                    msiContract(450, 0.00001, 24.11),
                    msiContract(460, 0.00001, 22.4),
                    msiContract(470, 0.0039162109375, 16.8),
                    msiContract(480, 0.015634843750000002, 11.15),
                ],
                [
                    msiContract(450, 0.0312596875, 10.96),
                    msiContract(460, 0.015634843750000002, 14.6),
                    msiContract(470, 0.00001, 19.5),
                ]
            ),
        ],
    });

    it('no bid and no ask → IV is null (Yahoo backs it out of a stale last price)', () => {
        const raw = makeYahooContract(470, {
            impliedVolatility: 0.25,
            bid: 0,
            ask: 0,
        });
        expect(normalizeYahooContract(raw).impliedVolatility).toBeNull();
        // Absent quotes behave the same as zero quotes.
        expect(
            normalizeYahooContract(
                makeYahooContract(470, { bid: undefined, ask: undefined })
            ).impliedVolatility
        ).toBeNull();
    });

    it('a one-sided quote keeps the IV (far strikes often have an ask but no bid)', () => {
        const raw = makeYahooContract(470, {
            impliedVolatility: 0.42,
            bid: 0,
            ask: 0.15,
        });
        expect(normalizeYahooContract(raw).impliedVolatility).toBe(0.42);
    });

    it('a solver-floor IV below the plausible minimum is null even with quotes', () => {
        const raw = makeYahooContract(470, { impliedVolatility: 0.00001 });
        expect(normalizeYahooContract(raw).impliedVolatility).toBeNull();
        expect(
            normalizeYahooContract(
                makeYahooContract(470, {
                    impliedVolatility: MIN_PLAUSIBLE_IMPLIED_VOLATILITY,
                })
            ).impliedVolatility
        ).toBe(MIN_PLAUSIBLE_IMPLIED_VOLATILITY);
    });

    it('MSI regression: the implied move is unknown (null), not ±0.11% (466.98–468.02)', () => {
        const snapshot = normalizeYahooSnapshot(msiChain(), NOW);
        const chain = snapshot.chains[0]!;
        expect(chain.daysToExpiration).toBe(29);

        const metrics = summarizeChainForLlm(chain, snapshot.underlyingPrice);

        expect(metrics.atmImpliedVolatility).toBeNull();
        expect(metrics.impliedMovePercent).toBeNull();
        expect(metrics.impliedMoveRange).toBeNull();
    });

    it('MSI with one quoted near-ATM contract: the implied move comes from that contract', () => {
        const response = msiChain();
        const quoted = response.options[0]!.calls.find(c => c.strike === 470)!;
        Object.assign(quoted, { bid: 16.5, ask: 17.1, impliedVolatility: 0.2 });

        const snapshot = normalizeYahooSnapshot(response, NOW);
        const metrics = summarizeChainForLlm(
            snapshot.chains[0]!,
            snapshot.underlyingPrice
        );

        expect(metrics.atmImpliedVolatility).toBe(0.2);
        // 0.2 × √(29/365) × 100 ≈ 5.64%.
        expect(metrics.impliedMovePercent).toBeCloseTo(
            0.2 * Math.sqrt(29 / 365) * 100,
            6
        );
    });
});
