import { renderHook, act } from '@testing-library/react';
import { useMobileSheet } from '@/views/symbol/hooks/useMobileSheet';
import { SNAP_HALF, SNAP_PEEK } from '@/views/symbol/constants/mobileSheet';

describe('useMobileSheet', () => {
    it('defaults sheetSnap to SNAP_HALF', () => {
        const { result } = renderHook(() => useMobileSheet());
        expect(result.current.sheetSnap).toBe(SNAP_HALF);
    });

    it('defaults mobileSheetContent to null', () => {
        const { result } = renderHook(() => useMobileSheet());
        expect(result.current.mobileSheetContent).toBeNull();
    });

    it('updates sheetSnap', () => {
        const { result } = renderHook(() => useMobileSheet());

        act(() => {
            result.current.setSheetSnap(SNAP_PEEK);
        });

        expect(result.current.sheetSnap).toBe(SNAP_PEEK);
    });

    it('updates mobileSheetContent', () => {
        const { result } = renderHook(() => useMobileSheet());

        act(() => {
            result.current.setMobileSheetContent('test content');
        });

        expect(result.current.mobileSheetContent).toBe('test content');
    });
});
