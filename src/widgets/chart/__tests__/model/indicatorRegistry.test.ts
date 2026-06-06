import { describe, it, expect } from 'vitest';
import {
    INDICATOR_REGISTRY,
    INDICATOR_META,
    CATEGORY_ORDER,
    CATEGORY_LABELS,
    groupBindingsByCategory,
    type IndicatorBinding,
} from '../../model/indicatorRegistry';

function bindingFor(key: string, active = false): IndicatorBinding {
    return { meta: INDICATOR_META[key]!, active };
}

describe('indicatorRegistry', () => {
    it('registers exactly the 11 modal-target indicators', () => {
        expect(INDICATOR_REGISTRY).toHaveLength(11);
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
        expect(periodKeys.sort()).toEqual(['ema', 'ma']);
    });

    it('INDICATOR_META maps every key back to its meta', () => {
        for (const meta of INDICATOR_REGISTRY) {
            expect(INDICATOR_META[meta.key]).toBe(meta);
        }
    });

    it('every category has a label', () => {
        for (const category of CATEGORY_ORDER) {
            expect(CATEGORY_LABELS[category]).toBeTruthy();
        }
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
