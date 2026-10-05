import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetStoredChartPreferencesCacheForTests,
    useHasStoredChartPreferences,
} from '@/widgets/chart/hooks/useHasStoredChartPreferences';

describe('useHasStoredChartPreferences', () => {
    beforeEach(() => {
        window.localStorage.clear();
        __resetStoredChartPreferencesCacheForTests();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        window.localStorage.clear();
        __resetStoredChartPreferencesCacheForTests();
    });

    it('저장된 차트 설정이 없으면 false다', () => {
        const { result } = renderHook(() => useHasStoredChartPreferences());
        expect(result.current).toBe(false);
    });

    it('siglens.chart.* 키가 하나라도 있으면 true다', () => {
        window.localStorage.setItem('unrelated', '1');
        window.localStorage.setItem('siglens.chart.overlay.bollinger', 'true');
        const { result } = renderHook(() => useHasStoredChartPreferences());
        expect(result.current).toBe(true);
    });

    it('다른 접두사의 키만 있으면 false다', () => {
        window.localStorage.setItem('siglens.chartish', '1');
        const { result } = renderHook(() => useHasStoredChartPreferences());
        expect(result.current).toBe(false);
    });

    it('반복 렌더에서 localStorage를 다시 훑지 않는다', () => {
        window.localStorage.setItem('a', '1');
        window.localStorage.setItem('b', '2');
        const keySpy = vi.spyOn(Storage.prototype, 'key');
        const { result, rerender } = renderHook(() =>
            useHasStoredChartPreferences()
        );
        expect(result.current).toBe(false);
        const scansAfterFirstRead = keySpy.mock.calls.length;
        expect(scansAfterFirstRead).toBeGreaterThan(0);

        for (let i = 0; i < 5; i += 1) rerender();
        // 두 번째 마운트(다른 컴포넌트)도 캐시를 쓴다.
        renderHook(() => useHasStoredChartPreferences());

        expect(keySpy.mock.calls.length).toBe(scansAfterFirstRead);
    });

    it('storage 이벤트가 오면 다시 계산해 값을 갱신한다', () => {
        const { result } = renderHook(() => useHasStoredChartPreferences());
        expect(result.current).toBe(false);

        act(() => {
            window.localStorage.setItem('siglens.chart.visible', '{}');
            window.dispatchEvent(new StorageEvent('storage'));
        });
        expect(result.current).toBe(true);

        act(() => {
            window.localStorage.clear();
            window.dispatchEvent(new StorageEvent('storage'));
        });
        expect(result.current).toBe(false);
    });
});
