// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { searchParamsRef } = vi.hoisted(() => ({
    searchParamsRef: { value: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));

import { useTimeframeFromUrl } from '@/widgets/overall/hooks/useTimeframeFromUrl';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';

describe('useTimeframeFromUrl', () => {
    // 훅은 라우터 내비게이션 없이 history.replaceState로 주소만 정규화한다
    // (router.replace는 화면을 다시 그려 잘못된 tf가 잠깐 보였다).
    let replaceState: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        searchParamsRef.value = new URLSearchParams();
        // 같은 메서드에 두 번 spyOn하면 vitest가 기존 spy를 그대로 돌려주므로
        // 호출 기록이 테스트 사이에 남는다 — 매번 명시적으로 비운다.
        replaceState = vi
            .spyOn(window.history, 'replaceState')
            .mockImplementation(() => {});
        replaceState.mockClear();
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
            expect(replaceState).toHaveBeenCalledWith(
                null,
                '',
                '/AAPL/overall?tf=1Day'
            );
        });
    });

    it('uses daily until tier hydration completes', () => {
        searchParamsRef.value = new URLSearchParams('tf=1Hour');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, false)
        );

        expect(result.current).toBe(DEFAULT_TIMEFRAME);
        expect(replaceState).not.toHaveBeenCalled();
    });
});
