import type { MockInstance } from 'vitest';
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import {
    MOBILE_ANALYSIS_SHEET_OPEN_DELAY_MS,
    useMobileAnalysisSheet,
} from '@/views/symbol/hooks/useMobileAnalysisSheet';
import {
    SNAP_FULL,
    SNAP_HALF,
    SNAP_PEEK,
} from '@/views/symbol/constants/mobileSheet';

describe('useMobileAnalysisSheet', () => {
    let requestAnimationFrameSpy: MockInstance<
        (callback: FrameRequestCallback) => number
    >;

    beforeEach(() => {
        vi.useFakeTimers();
        // 프레임이 오지 않는 브라우저(일부 인앱 웹뷰) — 시트는 그래도 열려야 한다.
        requestAnimationFrameSpy = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation(() => 0);
    });

    afterEach(() => {
        requestAnimationFrameSpy.mockRestore();
        vi.useRealTimers();
    });

    it('opens after the hydration buffer even when animation frames never fire', () => {
        const onActiveSnapChange = vi.fn();
        const { result } = renderHook(() =>
            useMobileAnalysisSheet({
                activeSnap: SNAP_HALF,
                onActiveSnapChange,
            })
        );

        expect(result.current.isOpen).toBe(false);

        act(() => {
            vi.advanceTimersByTime(MOBILE_ANALYSIS_SHEET_OPEN_DELAY_MS - 1);
        });
        expect(result.current.isOpen).toBe(false);

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current.isOpen).toBe(true);
        // 프레임 콜백에 기대면 프레임이 안 오는 환경에서 다시 터치 전까지 막힌다.
        expect(requestAnimationFrameSpy).not.toHaveBeenCalled();
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
