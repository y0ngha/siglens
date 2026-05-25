// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { OverlayLegendItem } from '../../types';
import { useOverlayGroups } from '../../hooks/useOverlayGroups';

describe('useOverlayGroups', () => {
    it('returns empty array for empty items', () => {
        const { result } = renderHook(() => useOverlayGroups([]));

        expect(result.current).toEqual([]);
    });

    it('groups MA items together', () => {
        const items: OverlayLegendItem[] = [
            { name: 'MA(20)', color: '#eab308', value: 100 },
            { name: 'MA(50)', color: '#22c55e', value: 98 },
        ];

        const { result } = renderHook(() => useOverlayGroups(items));

        expect(result.current).toHaveLength(1);
        expect(result.current[0].key).toBe('MA');
        expect(result.current[0].items).toHaveLength(2);
    });

    it('groups EMA items together', () => {
        const items: OverlayLegendItem[] = [
            { name: 'EMA(20)', color: '#eab308', value: 100 },
            { name: 'EMA(50)', color: '#22c55e', value: 99 },
        ];

        const { result } = renderHook(() => useOverlayGroups(items));

        expect(result.current).toHaveLength(1);
        expect(result.current[0].key).toBe('EMA');
    });

    it('groups Bollinger Band items together', () => {
        const items: OverlayLegendItem[] = [
            { name: 'BB Upper', color: '#818cf8', value: 110 },
            { name: 'BB Middle', color: '#94a3b8', value: 100 },
            { name: 'BB Lower', color: '#818cf8', value: 90 },
        ];

        const { result } = renderHook(() => useOverlayGroups(items));

        expect(result.current).toHaveLength(1);
        expect(result.current[0].key).toBe('BB');
        expect(result.current[0].items).toHaveLength(3);
    });

    it('groups Ichimoku items together', () => {
        const items: OverlayLegendItem[] = [
            { name: 'Tenkan', color: '#f00', value: 100 },
            { name: 'Kijun', color: '#0f0', value: 99 },
            { name: 'Senkou A', color: '#00f', value: 101 },
        ];

        const { result } = renderHook(() => useOverlayGroups(items));

        expect(result.current).toHaveLength(1);
        expect(result.current[0].key).toBe('Ichimoku');
    });

    it('groups VP items together', () => {
        const items: OverlayLegendItem[] = [
            { name: 'POC', color: '#f00', value: 100 },
            { name: 'VAH', color: '#0f0', value: 110 },
            { name: 'VAL', color: '#00f', value: 90 },
        ];

        const { result } = renderHook(() => useOverlayGroups(items));

        expect(result.current).toHaveLength(1);
        expect(result.current[0].key).toBe('VP');
    });

    it('creates separate groups for different overlay types', () => {
        const items: OverlayLegendItem[] = [
            { name: 'MA(20)', color: '#eab308', value: 100 },
            { name: 'EMA(20)', color: '#eab308', value: 101 },
            { name: 'BB Upper', color: '#818cf8', value: 110 },
        ];

        const { result } = renderHook(() => useOverlayGroups(items));

        expect(result.current).toHaveLength(3);
        expect(result.current.map(g => g.key)).toEqual(['MA', 'EMA', 'BB']);
    });

    it('returns memoized result for same input', () => {
        const items: OverlayLegendItem[] = [
            { name: 'MA(20)', color: '#eab308', value: 100 },
        ];

        const { result, rerender } = renderHook(() => useOverlayGroups(items));

        const firstResult = result.current;
        rerender();
        expect(result.current).toBe(firstResult);
    });
});
