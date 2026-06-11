import { describe, it, expect } from 'vitest';
import {
    INDICATOR_REGISTRY,
    INDICATOR_META,
    CATEGORY_ORDER,
    CATEGORY_LABELS,
    groupBindingsByCategory,
    type IndicatorBinding,
    type IndicatorKey,
} from '../../model/indicatorRegistry';

function bindingFor(key: IndicatorKey, active = false): IndicatorBinding {
    return { meta: INDICATOR_META[key], active };
}

describe('indicatorRegistry', () => {
    it('registers exactly the 18 modal-target indicators', () => {
        expect(INDICATOR_REGISTRY).toHaveLength(18);
    });

    it('has no duplicate keys', () => {
        const keys = INDICATOR_REGISTRY.map(m => m.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('every meta belongs to a known category', () => {
        for (const meta of INDICATOR_REGISTRY) {
            expect(CATEGORY_ORDER).toContain(meta.category);
        }
    });

    it('only ma/ema carry hasPeriods', () => {
        const periodKeys = INDICATOR_REGISTRY.filter(m => m.hasPeriods).map(
            m => m.key
        );
        expect(periodKeys.toSorted()).toEqual(['ema', 'ma']);
    });

    it('INDICATOR_META maps every key back to its meta', () => {
        for (const meta of INDICATOR_REGISTRY) {
            expect(INDICATOR_META[meta.key]).toBe(meta);
        }
    });

    it('maps every category to its exact label', () => {
        expect(CATEGORY_LABELS).toStrictEqual({
            trend: '추세',
            momentum: '모멘텀',
            volatility: '변동성',
            volume: '볼륨',
            statistical: '통계',
            smc: 'SMC',
        });
    });

    it('places group-B oscillators in the right categories', () => {
        const byKey = Object.fromEntries(
            INDICATOR_REGISTRY.map(m => [m.key, m.category])
        );
        expect(byKey.mfi).toBe('momentum');
        expect(byKey.williamsR).toBe('momentum');
        expect(byKey.connorsRsi).toBe('momentum');
        expect(byKey.cmf).toBe('momentum');
        expect(byKey.bollingerPercentB).toBe('volatility');
        expect(byKey.hurst).toBe('statistical');
        expect(byKey.varianceRatio).toBe('statistical');
    });

    it('all group-B indicators are pane kind', () => {
        const groupB = [
            'mfi',
            'williamsR',
            'connorsRsi',
            'cmf',
            'bollingerPercentB',
            'hurst',
            'varianceRatio',
        ];
        expect(
            groupB.every(
                key => INDICATOR_META[key as IndicatorKey].kind === 'pane'
            )
        ).toBe(true);
    });
});

describe('groupBindingsByCategory', () => {
    it('groups bindings under their category in CATEGORY_ORDER order', () => {
        const groups = groupBindingsByCategory([
            bindingFor('rsi'),
            bindingFor('ma'),
            bindingFor('bollinger'),
        ]);
        expect(groups.map(g => g.category)).toEqual([
            'trend',
            'momentum',
            'volatility',
        ]);
    });

    it('omits categories with zero bindings (SMC hidden)', () => {
        const groups = groupBindingsByCategory([bindingFor('rsi')]);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.category).toBe('momentum');
        expect(groups.some(g => g.category === 'smc')).toBe(false);
    });

    it('returns empty array when no bindings (worst case)', () => {
        expect(groupBindingsByCategory([])).toEqual([]);
    });

    it('keeps multiple items within the same category', () => {
        const groups = groupBindingsByCategory([
            bindingFor('rsi'),
            bindingFor('macd'),
            bindingFor('cci'),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.items).toHaveLength(3);
    });

    it('carries the category label on each group', () => {
        const groups = groupBindingsByCategory([bindingFor('ma')]);
        expect(groups[0]!.label).toBe(CATEGORY_LABELS.trend);
    });
});
