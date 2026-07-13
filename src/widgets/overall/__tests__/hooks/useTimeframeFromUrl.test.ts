// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { searchParamsRef } = vi.hoisted(() => ({
    searchParamsRef: { value: new URLSearchParams() },
}));
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
    useRouter: () => ({ replace: mockReplace }),
}));

import { useTimeframeFromUrl } from '@/widgets/overall/hooks/useTimeframeFromUrl';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';

describe('useTimeframeFromUrl', () => {
    beforeEach(() => {
        searchParamsRef.value = new URLSearchParams();
        mockReplace.mockReset();
    });

    it('유효한 tf 쿼리는 그대로 반환한다', () => {
        searchParamsRef.value = new URLSearchParams('tf=1Hour');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, true)
        );
        expect(result.current).toBe('1Hour');
    });

    it('유효하지 않은 tf는 DEFAULT_TIMEFRAME으로 폴백한다', () => {
        searchParamsRef.value = new URLSearchParams('tf=not-a-timeframe');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, true)
        );
        expect(result.current).toBe(DEFAULT_TIMEFRAME);
    });

    it('tf가 없으면 DEFAULT_TIMEFRAME으로 폴백한다', () => {
        searchParamsRef.value = new URLSearchParams();
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, true)
        );
        expect(result.current).toBe(DEFAULT_TIMEFRAME);
    });

    it('free query is canonicalized to daily after tier hydration', async () => {
        searchParamsRef.value = new URLSearchParams('tf=1Hour');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', true, true)
        );

        expect(result.current).toBe(DEFAULT_TIMEFRAME);
        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/AAPL/overall?tf=1Day', {
                scroll: false,
            });
        });
    });

    it('uses daily until tier hydration completes', () => {
        searchParamsRef.value = new URLSearchParams('tf=1Hour');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, false)
        );

        expect(result.current).toBe(DEFAULT_TIMEFRAME);
        expect(mockReplace).not.toHaveBeenCalled();
    });
});
