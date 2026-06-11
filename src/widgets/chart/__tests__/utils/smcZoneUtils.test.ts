import { describe, expect, it } from 'vitest';
import type { SMCResult } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { buildSmcZoneLines } from '@/widgets/chart/utils/smcZoneUtils';

function smc(overrides: Partial<SMCResult>): SMCResult {
    return {
        swingHighs: [],
        swingLows: [],
        orderBlocks: [],
        fairValueGaps: [],
        equalHighs: [],
        equalLows: [],
        premiumZone: null,
        discountZone: null,
        equilibriumZone: null,
        structureBreaks: [],
        ...overrides,
    };
}

describe('buildSmcZoneLines', () => {
    it('returns [] for undefined smc', () => {
        expect(buildSmcZoneLines(undefined)).toEqual([]);
    });

    it('returns [] when all zones are null', () => {
        expect(buildSmcZoneLines(smc({}))).toEqual([]);
    });

    it('builds 5 lines when all three zones present (premium/discount 2 each + equilibrium 1)', () => {
        const out = buildSmcZoneLines(
            smc({
                premiumZone: { high: 110, low: 105, type: 'premium' },
                discountZone: { high: 95, low: 90, type: 'discount' },
                equilibriumZone: { high: 101, low: 99, type: 'equilibrium' },
            })
        );
        expect(out).toEqual([
            { price: 110, color: CHART_COLORS.smcPremium, title: 'Premium' },
            { price: 105, color: CHART_COLORS.smcPremium, title: '' },
            { price: 95, color: CHART_COLORS.smcDiscount, title: 'Discount' },
            { price: 90, color: CHART_COLORS.smcDiscount, title: '' },
            {
                price: 100,
                color: CHART_COLORS.smcEquilibrium,
                title: 'Equilibrium',
            },
        ]);
    });

    it('equilibrium line uses the (high+low)/2 midpoint', () => {
        const out = buildSmcZoneLines(
            smc({
                equilibriumZone: { high: 102, low: 98, type: 'equilibrium' },
            })
        );
        expect(out).toEqual([
            {
                price: 100,
                color: CHART_COLORS.smcEquilibrium,
                title: 'Equilibrium',
            },
        ]);
    });

    it('skips null zones independently (premium only)', () => {
        const out = buildSmcZoneLines(
            smc({ premiumZone: { high: 110, low: 105, type: 'premium' } })
        );
        expect(out).toEqual([
            { price: 110, color: CHART_COLORS.smcPremium, title: 'Premium' },
            { price: 105, color: CHART_COLORS.smcPremium, title: '' },
        ]);
    });
});
