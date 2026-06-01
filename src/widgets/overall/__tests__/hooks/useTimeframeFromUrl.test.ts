// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const { searchParamsRef } = vi.hoisted(() => ({
    searchParamsRef: { value: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));

import { useTimeframeFromUrl } from '@/widgets/overall/hooks/useTimeframeFromUrl';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';

describe('useTimeframeFromUrl', () => {
    it('유효한 tf 쿼리는 그대로 반환한다', () => {
        searchParamsRef.value = new URLSearchParams('tf=1Hour');
        const { result } = renderHook(() => useTimeframeFromUrl());
        expect(result.current).toBe('1Hour');
    });

    it('유효하지 않은 tf는 DEFAULT_TIMEFRAME으로 폴백한다', () => {
        searchParamsRef.value = new URLSearchParams('tf=not-a-timeframe');
        const { result } = renderHook(() => useTimeframeFromUrl());
        expect(result.current).toBe(DEFAULT_TIMEFRAME);
    });

    it('tf가 없으면 DEFAULT_TIMEFRAME으로 폴백한다', () => {
        searchParamsRef.value = new URLSearchParams();
        const { result } = renderHook(() => useTimeframeFromUrl());
        expect(result.current).toBe(DEFAULT_TIMEFRAME);
    });
});
