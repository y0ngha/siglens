// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndicatorVisibility } from '../../hooks/useIndicatorVisibility';
import { INACTIVE_PANE_INDEX } from '../../constants';

describe('useIndicatorVisibility', () => {
    it('starts with all pane indicators hidden (INACTIVE)', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        expect(result.current.visible.rsi).toBe(false);
        expect(result.current.visible.mfi).toBe(false);
        expect(result.current.paneIndices.rsi).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.varianceRatio).toBe(
            INACTIVE_PANE_INDEX
        );
    });

    it('assigns compacted pane indices in registry order to active panes', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        act(() => result.current.toggle('rsi'));
        act(() => result.current.toggle('mfi'));
        act(() => result.current.toggle('hurst'));
        expect(result.current.paneIndices.rsi).toBe(1);
        expect(result.current.paneIndices.mfi).toBe(2);
        expect(result.current.paneIndices.hurst).toBe(3);
        expect(result.current.paneIndices.macd).toBe(INACTIVE_PANE_INDEX);
    });

    it('toggle off reassigns indices (worst case: middle removed)', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        act(() => result.current.toggle('rsi'));
        act(() => result.current.toggle('macd'));
        act(() => result.current.toggle('cci'));
        act(() => result.current.toggle('macd'));
        expect(result.current.paneIndices.rsi).toBe(1);
        expect(result.current.paneIndices.macd).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.cci).toBe(2);
    });

    it('exposes a paneIndices entry for every pane indicator', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        const paneKeys = [
            'rsi',
            'macd',
            'dmi',
            'stochastic',
            'stochRsi',
            'cci',
            'mfi',
            'williamsR',
            'connorsRsi',
            'cmf',
            'bollingerPercentB',
            'hurst',
            'varianceRatio',
        ] as const;
        for (const k of paneKeys) {
            expect(result.current.paneIndices[k]).toBe(INACTIVE_PANE_INDEX);
        }
    });
});
