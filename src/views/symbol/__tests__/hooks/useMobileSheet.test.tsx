import { renderHook, act } from '@testing-library/react';
import { useMobileSheet } from '@/views/symbol/hooks/useMobileSheet';
import { SNAP_PEEK } from '@/views/symbol/constants/mobileSheet';

describe('useMobileSheet', () => {
    it('초기 스냅은 SNAP_PEEK이다 — ChartContent의 --snap-peek 패딩 예약과 정합을 맞춰 차트를 가리지 않는다', () => {
        const { result } = renderHook(() => useMobileSheet());
        expect(result.current.sheetSnap).toBe(SNAP_PEEK);
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
