import {
    groupOverlayItems,
    formatOverlayValue,
} from '@/widgets/chart/utils/overlayLegendFormat';
import type { OverlayLegendItem } from '@/widgets/chart/types';

describe('formatOverlayValue', () => {
    it('returns "-" for null', () => {
        expect(formatOverlayValue(null)).toBe('-');
    });

    it('formats a number to 2 decimal places', () => {
        expect(formatOverlayValue(100.123)).toBe('100.12');
    });

    it('pads a whole number to 2 decimal places', () => {
        expect(formatOverlayValue(42)).toBe('42.00');
    });

    it('formats zero correctly', () => {
        expect(formatOverlayValue(0)).toBe('0.00');
    });

    it('formats negative numbers correctly', () => {
        expect(formatOverlayValue(-3.14159)).toBe('-3.14');
    });
});

describe('groupOverlayItems', () => {
    it('returns empty array for empty input', () => {
        expect(groupOverlayItems([])).toEqual([]);
    });

    it('groups MA items under "MA" key', () => {
        const items: OverlayLegendItem[] = [
            { name: 'MA(5)', color: '#f00', value: 100 },
            { name: 'MA(20)', color: '#0f0', value: 200 },
        ];

        const result = groupOverlayItems(items);

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('MA');
        expect(result[0].items).toHaveLength(2);
    });

    it('groups EMA items under "EMA" key', () => {
        const items: OverlayLegendItem[] = [
            { name: 'EMA(9)', color: '#f00', value: 100 },
            { name: 'EMA(21)', color: '#0f0', value: 200 },
        ];

        const result = groupOverlayItems(items);

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('EMA');
    });

    it('groups BB items under "BB" key', () => {
        const items: OverlayLegendItem[] = [
            { name: 'BB Upper', color: '#f00', value: 110 },
            { name: 'BB Middle', color: '#0f0', value: 100 },
            { name: 'BB Lower', color: '#00f', value: 90 },
        ];

        const result = groupOverlayItems(items);

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('BB');
        expect(result[0].items).toHaveLength(3);
    });

    it('groups Ichimoku names under "Ichimoku" key', () => {
        const ichimokuNames = [
            'Tenkan',
            'Kijun',
            'Chikou',
            'Senkou A',
            'Senkou B',
        ];
        const items: OverlayLegendItem[] = ichimokuNames.map(name => ({
            name,
            color: '#fff',
            value: 100,
        }));

        const result = groupOverlayItems(items);

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('Ichimoku');
        expect(result[0].items).toHaveLength(5);
    });

    it('groups VP names under "VP" key', () => {
        const items: OverlayLegendItem[] = [
            { name: 'POC', color: '#f00', value: 100 },
            { name: 'VAH', color: '#0f0', value: 110 },
            { name: 'VAL', color: '#00f', value: 90 },
        ];

        const result = groupOverlayItems(items);

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('VP');
        expect(result[0].items).toHaveLength(3);
    });

    it('uses the item name itself as key for ungrouped items', () => {
        const items: OverlayLegendItem[] = [
            { name: 'CustomOverlay', color: '#f00', value: 50 },
        ];

        const result = groupOverlayItems(items);

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('CustomOverlay');
    });

    it('preserves insertion order across different groups', () => {
        const items: OverlayLegendItem[] = [
            { name: 'MA(5)', color: '#f00', value: 100 },
            { name: 'BB Upper', color: '#0f0', value: 110 },
            { name: 'MA(20)', color: '#00f', value: 200 },
            { name: 'BB Lower', color: '#ff0', value: 90 },
        ];

        const result = groupOverlayItems(items);

        expect(result).toHaveLength(2);
        expect(result[0].key).toBe('MA');
        expect(result[1].key).toBe('BB');
        expect(result[0].items).toHaveLength(2);
        expect(result[1].items).toHaveLength(2);
    });

    it('handles mixed grouped and ungrouped items', () => {
        const items: OverlayLegendItem[] = [
            { name: 'MA(5)', color: '#f00', value: 100 },
            { name: 'CustomLine', color: '#0f0', value: 50 },
            { name: 'MA(20)', color: '#00f', value: 200 },
        ];

        const result = groupOverlayItems(items);

        expect(result).toHaveLength(2);
        expect(result[0].key).toBe('MA');
        expect(result[1].key).toBe('CustomLine');
    });
});
