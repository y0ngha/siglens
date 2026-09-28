// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartOverlayVisibility } from '../../hooks/useChartOverlayVisibility';
import { STORAGE_KEYS } from '../../constants';

describe('useChartOverlayVisibility', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to pattern/trendline on, the rest off', () => {
        const { result } = renderHook(() => useChartOverlayVisibility());
        expect(result.current.visible.pattern).toBe(true);
        expect(result.current.visible.trendline).toBe(true);
        expect(result.current.visible.divergence).toBe(false);
        expect(result.current.visible.fibonacci).toBe(false);
        expect(result.current.visible.elliott).toBe(false);
    });

    it('toggle flips a category and persists it', () => {
        const { result } = renderHook(() => useChartOverlayVisibility());
        act(() => result.current.toggle('divergence'));
        expect(result.current.visible.divergence).toBe(true);
        const stored = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.chartOverlays) ?? '{}'
        );
        expect(stored.divergence).toBe(true);
    });

    it('fills missing keys from a partial stored value with defaults', () => {
        localStorage.setItem(
            STORAGE_KEYS.chartOverlays,
            JSON.stringify({ elliott: true })
        );
        const { result } = renderHook(() => useChartOverlayVisibility());
        expect(result.current.visible.elliott).toBe(true);
        expect(result.current.visible.pattern).toBe(true);
        expect(result.current.visible.divergence).toBe(false);
    });

    it('toggle after restoring from localStorage flips relative to the merged value', () => {
        localStorage.setItem(
            STORAGE_KEYS.chartOverlays,
            JSON.stringify({ pattern: false })
        );
        const { result } = renderHook(() => useChartOverlayVisibility());
        expect(result.current.visible.pattern).toBe(false);
        act(() => result.current.toggle('pattern'));
        expect(result.current.visible.pattern).toBe(true);
    });
});
