import type { MockInstance } from 'vitest';
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import {
    MOBILE_ANALYSIS_SHEET_OPEN_DELAY_MS,
    useMobileAnalysisSheet,
} from '@/widgets/symbol-page/hooks/useMobileAnalysisSheet';
import {
    SNAP_FULL,
    SNAP_HALF,
    SNAP_PEEK,
} from '@/widgets/symbol-page/constants/mobileSheet';

describe('useMobileAnalysisSheet', () => {
    let requestAnimationFrameSpy: MockInstance<
        (callback: FrameRequestCallback) => number
    >;
    let cancelAnimationFrameSpy: MockInstance<(frameId: number) => void>;

    beforeEach(() => {
        vi.useFakeTimers();
        requestAnimationFrameSpy = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation(callback =>
                window.setTimeout(() => callback(performance.now()), 16)
            );
        cancelAnimationFrameSpy = vi
            .spyOn(window, 'cancelAnimationFrame')
            .mockImplementation(frameId => window.clearTimeout(frameId));
    });

    afterEach(() => {
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
        vi.useRealTimers();
    });

    it('delays opening until after the first animation frame and hydration buffer', () => {
        const onActiveSnapChange = vi.fn();
        const { result } = renderHook(() =>
            useMobileAnalysisSheet({
                activeSnap: SNAP_HALF,
                onActiveSnapChange,
            })
        );

        expect(result.current.isOpen).toBe(false);

        act(() => {
            vi.advanceTimersByTime(16);
        });
        expect(result.current.isOpen).toBe(false);

        act(() => {
            vi.advanceTimersByTime(MOBILE_ANALYSIS_SHEET_OPEN_DELAY_MS);
        });
        expect(result.current.isOpen).toBe(true);
    });

    it('reopens at peek snap when vaul attempts to close the persistent sheet', () => {
        const onActiveSnapChange = vi.fn();
        const { result } = renderHook(() =>
            useMobileAnalysisSheet({
                activeSnap: SNAP_HALF,
                onActiveSnapChange,
            })
        );

        act(() => {
            result.current.handleOpenChange(false);
        });

        expect(onActiveSnapChange).toHaveBeenCalledWith(SNAP_PEEK);
        expect(result.current.isOpen).toBe(true);
    });

    it('does nothing when handleOpenChange is called with true', () => {
        const onActiveSnapChange = vi.fn();
        const { result } = renderHook(() =>
            useMobileAnalysisSheet({
                activeSnap: SNAP_HALF,
                onActiveSnapChange,
            })
        );

        act(() => {
            result.current.handleOpenChange(true);
        });

        // onActiveSnapChange should NOT be called when open=true
        expect(onActiveSnapChange).not.toHaveBeenCalled();
    });

    it('marks the sheet as full only at the full snap point', () => {
        const onActiveSnapChange = vi.fn();
        const { result, rerender } = renderHook(
            ({ activeSnap }) =>
                useMobileAnalysisSheet({ activeSnap, onActiveSnapChange }),
            { initialProps: { activeSnap: SNAP_HALF } }
        );

        expect(result.current.isFullSnap).toBe(false);

        rerender({ activeSnap: SNAP_FULL });

        expect(result.current.isFullSnap).toBe(true);
    });
});
