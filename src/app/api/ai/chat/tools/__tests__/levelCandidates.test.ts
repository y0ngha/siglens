import { describe, expect, it } from 'vitest';
import type {
    AnalysisResponse,
    Bar,
    IndicatorResult,
} from '@y0ngha/siglens-core';
import {
    chartReferenceLevels,
    technicalLevelCandidates,
} from '@/app/api/ai/chat/tools/levelCandidates';

const barAt = (i: number): Bar => ({
    time: 1_700_000_000 + i * 86_400,
    open: 100,
    high: 101 + i,
    low: 99 + i,
    close: 100 + i,
    volume: 1,
});
const bars = (count: number): Bar[] =>
    Array.from({ length: count }, (_, i) => barAt(i));

/** Only `ma` is read; the rest of the indicator result is irrelevant to the chart references. */
const withMa = (ma: Record<number, (number | null)[]>): IndicatorResult =>
    ({ ma }) as unknown as IndicatorResult;

describe('chartReferenceLevels', () => {
    it('reads the 252-bar window for the 52-week high/low and the last 20 bars for the 20-day ones', () => {
        // 300 bars: high = 101 + i, low = 99 + i. The 252 window is i = 48..299, the 20 window i = 280..299.
        expect(
            chartReferenceLevels(bars(300), withMa({ 20: [], 50: [], 200: [] }))
        ).toMatchObject({
            high52w: 400,
            low52w: 147,
            high20: 400,
            low20: 379,
        });
    });

    it('a short series uses what it has for the 52-week window, but needs 20 bars for the 20-day one', () => {
        expect(chartReferenceLevels(bars(19), withMa({}))).toMatchObject({
            high52w: 119,
            low52w: 99,
            high20: null,
            low20: null,
        });
        expect(chartReferenceLevels(bars(20), withMa({}))).toMatchObject({
            high20: 120,
            low20: 99,
        });
    });

    it('takes the last value of each average, rounded like latest.ma; a missing or empty average is null', () => {
        expect(
            chartReferenceLevels(
                bars(30),
                withMa({ 20: [1, 101.123456789], 50: [null], 200: [] })
            )
        ).toMatchObject({ sma20: 101.123, sma50: null, sma200: null });
    });
});

const analysis = (over: Partial<AnalysisResponse>): AnalysisResponse =>
    ({
        keyLevels: null,
        priceTargets: null,
        actionRecommendation: null,
        ...over,
    }) as unknown as AnalysisResponse;

describe('technicalLevelCandidates', () => {
    const full = analysis({
        keyLevels: {
            support: [{ price: 90, reason: 'r' }],
            resistance: [
                { price: 110, reason: 'r' },
                { price: 120, reason: 'r' },
            ],
            poc: { price: 100, reason: 'r' },
        },
        priceTargets: {
            bullish: {
                condition: 'c',
                targets: [{ price: 130, basis: 'b' }],
            },
            bearish: {
                condition: 'c',
                targets: [{ price: 80, basis: 'b' }],
            },
        },
        actionRecommendation: { stopLoss: 85 },
    } as Partial<AnalysisResponse>);

    it('collects every analysis price with its kind', () => {
        expect(technicalLevelCandidates(full, null)).toEqual([
            { price: 90, kind: 'analysis_support' },
            { price: 110, kind: 'analysis_resistance' },
            { price: 120, kind: 'analysis_resistance' },
            { price: 100, kind: 'analysis_poc' },
            { price: 130, kind: 'analysis_target' },
            { price: 80, kind: 'analysis_target' },
            { price: 85, kind: 'analysis_stop' },
        ]);
    });

    it('uses the reconciled stop over the model stop', () => {
        const reconciled = analysis({
            actionRecommendation: {
                stopLoss: 85,
                reconciledLevels: { stopLoss: 82 },
            } as never,
        });
        expect(technicalLevelCandidates(reconciled, null)).toEqual([
            { price: 82, kind: 'analysis_stop' },
        ]);
    });

    it('drops the stop when core rejected it (stopLossRejected)', () => {
        const rejected = analysis({
            actionRecommendation: {
                stopLoss: 85,
                reconciledLevels: { stopLossRejected: true },
            } as never,
        });
        expect(technicalLevelCandidates(rejected, null)).toEqual([]);
    });

    it('adds the chart references (skipping the null ones) only when given', () => {
        const chart = {
            high52w: 200,
            low52w: null,
            high20: 150,
            low20: 140,
            sma20: 145,
            sma50: null,
            sma200: 130,
        };
        const kinds = technicalLevelCandidates(analysis({}), chart);
        expect(kinds).toEqual([
            { price: 200, kind: 'high_52w' },
            { price: 150, kind: 'high_20' },
            { price: 140, kind: 'low_20' },
            { price: 145, kind: 'sma20' },
            { price: 130, kind: 'sma200' },
        ]);
    });

    it('an analysis with no levels, scenarios or stop yields nothing', () => {
        expect(technicalLevelCandidates(analysis({}), null)).toEqual([]);
    });

    it('a null scenario and a missing stop loss are skipped', () => {
        const partial = analysis({
            priceTargets: {
                bullish: null,
                bearish: {
                    condition: 'c',
                    targets: [{ price: 70, basis: 'b' }],
                },
            },
            actionRecommendation: {} as never,
        });
        expect(technicalLevelCandidates(partial, null)).toEqual([
            { price: 70, kind: 'analysis_target' },
        ]);
    });
});
