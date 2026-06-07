/**
 * Branch coverage tests for overlayLabelUtils — targets uncovered ?? null
 * fallbacks for Bollinger, Ichimoku, and VP configs when indicator data
 * entries exist but fields are undefined, plus findBarIndex highDiff < lowDiff.
 */

import {
    buildOverlayLabelConfigs,
    findBarIndex,
} from '@/widgets/chart/utils/overlayLabelUtils';
import { EMPTY_SMC_RESULT } from '@y0ngha/siglens-core';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';

const BASE_INDICATORS: IndicatorResult = {
    ma: {},
    ema: {},
    macd: [],
    bollinger: [],
    rsi: [],
    cci: [],
    dmi: [],
    stochastic: [],
    stochRsi: [],
    vwap: [],
    volumeProfile: null as unknown as IndicatorResult['volumeProfile'],
    ichimoku: [],
    atr: [],
    obv: [],
    parabolicSar: [],
    williamsR: [],
    supertrend: [],
    mfi: [],
    keltnerChannel: [],
    cmf: [],
    donchianChannel: [],
    squeezeMomentum: [],
    macdV: [],
    connorsRsi: [],
    forceIndex: [],
    elderRay: [],
    elderImpulse: [],
    bollingerDerived: [],
    chandelierExit: [],
    yangZhang: [],
    ewmaVolatility: [],
    hurst: [],
    varianceRatio: [],
    regression: [],
    buySellVolume: [],
    smc: EMPTY_SMC_RESULT,
};

describe('overlayLabelUtils — branch coverage', () => {
    describe('Bollinger getValue fallbacks when entry has undefined fields', () => {
        it('returns null when bollinger entry exists but upper/middle/lower are undefined', () => {
            // Entry exists (not undefined) but fields are missing → ?? null fallback
            const indicators: IndicatorResult = {
                ...BASE_INDICATORS,
                bollinger: [{}] as unknown as IndicatorResult['bollinger'],
            };
            const configs = buildOverlayLabelConfigs({
                maVisiblePeriods: [],
                emaVisiblePeriods: [],
                bollingerVisible: true,
                ichimokuVisible: false,
                vpVisible: false,
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
            });

            expect(configs[0].getValue(indicators, 0)).toBeNull(); // upper
            expect(configs[1].getValue(indicators, 0)).toBeNull(); // middle
            expect(configs[2].getValue(indicators, 0)).toBeNull(); // lower
        });
    });

    describe('Ichimoku getValue fallbacks when entry has undefined fields', () => {
        it('returns null when ichimoku entry exists but all fields are undefined', () => {
            const indicators: IndicatorResult = {
                ...BASE_INDICATORS,
                ichimoku: [{}] as unknown as IndicatorResult['ichimoku'],
            };
            const configs = buildOverlayLabelConfigs({
                maVisiblePeriods: [],
                emaVisiblePeriods: [],
                bollingerVisible: false,
                ichimokuVisible: true,
                vpVisible: false,
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
            });

            expect(configs[0].getValue(indicators, 0)).toBeNull(); // tenkan
            expect(configs[1].getValue(indicators, 0)).toBeNull(); // kijun
            expect(configs[2].getValue(indicators, 0)).toBeNull(); // chikou
            expect(configs[3].getValue(indicators, 0)).toBeNull(); // senkouA
            expect(configs[4].getValue(indicators, 0)).toBeNull(); // senkouB
        });
    });

    describe('VP getValue fallbacks when volumeProfile has undefined fields', () => {
        it('returns null when volumeProfile exists but poc/vah/val are undefined', () => {
            const indicators: IndicatorResult = {
                ...BASE_INDICATORS,
                volumeProfile: {
                    profile: [],
                } as unknown as IndicatorResult['volumeProfile'],
            };
            const configs = buildOverlayLabelConfigs({
                maVisiblePeriods: [],
                emaVisiblePeriods: [],
                bollingerVisible: false,
                ichimokuVisible: false,
                vpVisible: true,
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
            });

            expect(configs[0].getValue(indicators, 0)).toBeNull(); // poc
            expect(configs[1].getValue(indicators, 0)).toBeNull(); // vah
            expect(configs[2].getValue(indicators, 0)).toBeNull(); // val
        });
    });

    describe('findBarIndex — highDiff is closer than lowDiff', () => {
        it('returns high index when closer to target time', () => {
            const bars: Bar[] = [
                {
                    time: 100,
                    open: 10,
                    high: 15,
                    low: 9,
                    close: 12,
                    volume: 1000,
                },
                {
                    time: 200,
                    open: 12,
                    high: 18,
                    low: 11,
                    close: 15,
                    volume: 1200,
                },
                {
                    time: 300,
                    open: 15,
                    high: 20,
                    low: 14,
                    close: 18,
                    volume: 1100,
                },
            ];
            // time=210: bars[1]=200(diff=10), bars[2]=300(diff=90) → high(=1) is closer
            expect(findBarIndex(bars, 210)).toBe(1);
        });
    });
});
