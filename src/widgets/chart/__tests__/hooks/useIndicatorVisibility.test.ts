// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useIndicatorVisibility } from '../../hooks/useIndicatorVisibility';
import {
    FIRST_INDICATOR_PANE_INDEX,
    INACTIVE_PANE_INDEX,
} from '../../constants';

describe('useIndicatorVisibility', () => {
    it('returns all indicators hidden initially', () => {
        const { result } = renderHook(() => useIndicatorVisibility());

        expect(result.current.rsiVisible).toBe(false);
        expect(result.current.macdVisible).toBe(false);
        expect(result.current.dmiVisible).toBe(false);
        expect(result.current.stochasticVisible).toBe(false);
        expect(result.current.stochRsiVisible).toBe(false);
        expect(result.current.cciVisible).toBe(false);
    });

    it('sets all paneIndices to inactive when no indicators visible', () => {
        const { result } = renderHook(() => useIndicatorVisibility());

        expect(result.current.paneIndices.rsi).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.macd).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.dmi).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.stochastic).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.stochRsi).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.cci).toBe(INACTIVE_PANE_INDEX);
    });

    it('toggles RSI and assigns first pane index', () => {
        const { result } = renderHook(() => useIndicatorVisibility());

        act(() => {
            result.current.toggleRSI();
        });

        expect(result.current.rsiVisible).toBe(true);
        expect(result.current.paneIndices.rsi).toBe(FIRST_INDICATOR_PANE_INDEX);
    });

    it('assigns sequential pane indices for multiple active indicators', () => {
        const { result } = renderHook(() => useIndicatorVisibility());

        act(() => {
            result.current.toggleRSI();
        });
        act(() => {
            result.current.toggleMACD();
        });

        expect(result.current.paneIndices.rsi).toBe(FIRST_INDICATOR_PANE_INDEX);
        expect(result.current.paneIndices.macd).toBe(
            FIRST_INDICATOR_PANE_INDEX + 1
        );
    });

    it('recalculates pane indices when an indicator is toggled off', () => {
        const { result } = renderHook(() => useIndicatorVisibility());

        act(() => {
            result.current.toggleRSI();
        });
        act(() => {
            result.current.toggleMACD();
        });
        act(() => {
            result.current.toggleDMI();
        });

        act(() => {
            result.current.toggleRSI();
        });

        expect(result.current.paneIndices.rsi).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.macd).toBe(
            FIRST_INDICATOR_PANE_INDEX
        );
        expect(result.current.paneIndices.dmi).toBe(
            FIRST_INDICATOR_PANE_INDEX + 1
        );
    });

    it('toggles all six indicators', () => {
        const { result } = renderHook(() => useIndicatorVisibility());

        act(() => {
            result.current.toggleRSI();
            result.current.toggleMACD();
            result.current.toggleDMI();
            result.current.toggleStochastic();
            result.current.toggleStochRSI();
            result.current.toggleCCI();
        });

        expect(result.current.rsiVisible).toBe(true);
        expect(result.current.macdVisible).toBe(true);
        expect(result.current.dmiVisible).toBe(true);
        expect(result.current.stochasticVisible).toBe(true);
        expect(result.current.stochRsiVisible).toBe(true);
        expect(result.current.cciVisible).toBe(true);

        expect(result.current.paneIndices.cci).toBe(
            FIRST_INDICATOR_PANE_INDEX + 5
        );
    });
});
